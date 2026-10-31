-- LA STAMPA INCERTA DICE UNA COSA SOLA, E IL BAR VEDE LA SUA — 31/10/2026.
--
-- Due rilievi del controllo finale del 30/10 (A2 e A3), approvati da
-- Alessio il 31/10.
--
-- 🔴 A2 · UN FOGLIO «INCERTO» DICEVA DUE COSE OPPOSTE. Quando la stampante
--    risponde a metà, il ponte segna il foglio «incerto» (forse è uscito).
--    La pagina Cucina scriveva «Non si sa se è uscito» e sotto, dalla
--    frase del codice, «la stampante non l'ha stampato»: chi legge la
--    seconda preme «Ristampa» e la comanda esce due volte. Il codice
--    `risposta_a_meta` (e `rifiutato`) non aveva una frase sua e cadeva
--    nell'«altrimenti».
--    ⚠️ Per un foglio incerto lo stato NON porta più nessuna frase
--    d'errore: qualunque codice abbia, la cosa da dire è una sola, ed è la
--    pagina a dirla («guarda la carta prima»). E niente si ristampa da
--    solo: il ponte prende solo i lavori `in_coda` (20261028000005), e
--    questa migrazione lo riprova.
--
-- 🔴 A3 · IL BAR NON SAPEVA SE IL SUO FOGLIO ERA USCITO. `stato_stampa_cucina`
--    guardava solo la cucina. Nasce `stato_stampa(reparto)`, uguale per i
--    due; `stato_stampa_cucina()` resta come scorciatoia, così il
--    gestionale già pubblicato continua a funzionare.

-- ---------------------------------------------------------------------
-- 1. Le frasi fisse dei codici
-- ---------------------------------------------------------------------
-- 🔴 SOLO FRASI FISSE, MAI IL TESTO DEL PONTE (come in 20261029000001):
--    il testo può contenere l'indirizzo della stampante.
create or replace function public.frase_di_stampa(p_codice text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case p_codice
    when 'carta_finita' then 'la carta è finita: cambia il rotolo.'
    when 'coperchio_aperto' then 'il coperchio della stampante è aperto: chiudilo.'
    when 'non_risponde' then 'la stampante non risponde: è accesa? Ha la rete?'
    when 'interrotto' then 'il ponte si è fermato a metà.'
    when 'errore' then 'la stampante segnala un errore: spegnila e riaccendila.'
    when 'risposta_a_meta' then 'la stampante ha risposto a metà: guarda se il foglio è uscito.'
    when 'rifiutato' then 'la stampante non ha accettato il foglio: guarda la pagina Stampanti.'
    when 'pronto' then null
    when 'sconosciuto' then null
    else case when p_codice is null then null else 'la stampante non l''ha stampato.' end
  end
$function$;

revoke all on function public.frase_di_stampa(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Lo stato della stampa, per reparto
-- ---------------------------------------------------------------------
create or replace function public.stato_stampa(p_reparto order_destination)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_disp dispositivi%rowtype;
begin
  -- ⚠️ Solo chi ha un ruolo nel locale, come `manda_alla_stampante`: un
  --    account senza ruolo non deve leggere i fogli dei conti aperti
  --    (revisione ECC, 31/10; la versione della cucina guardava solo il login).
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  select * into v_disp from dispositivi where id = stampante_del_reparto(p_reparto);
  return jsonb_build_object(
    'stampante', case when v_disp.id is null then null else jsonb_build_object(
      'nome', v_disp.nome, 'stato', v_disp.ultimo_stato, 'testo', frase_di_stampa(v_disp.ultimo_stato)) end,
    'ponte_acceso', exists (select 1 from chiavi_ponte c
                             where c.revocata_il is null and c.ultimo_battito > now() - interval '90 seconds'),
    'lavori', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'tipo', l.tipo, 'stato', l.stato, 'righe', to_jsonb(l.righe),
               'chiamata_id', l.chiamata_id,
               -- ⚠️ Un incerto non ha frase d'errore: vedi la testa del file.
               'errore', case when l.stato = 'incerto' then null else frase_di_stampa(l.errore_codice) end,
               'creato_il', l.creato_il)
               order by l.creato_il)
        from lavori_stampa l join orders o on o.id = l.order_id and o.status = 'aperto'
       where l.reparto = p_reparto and l.tipo in ('comanda', 'chiamata')), '[]'::jsonb));
end $function$;

create or replace function public.stato_stampa_cucina()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select stato_stampa('cucina')
$function$;

revoke all on function public.stato_stampa(order_destination) from public, anon, authenticated;
revoke all on function public.stato_stampa_cucina() from public, anon, authenticated;
grant execute on function public.stato_stampa(order_destination) to authenticated;
grant execute on function public.stato_stampa_cucina() to authenticated;

comment on function public.stato_stampa(order_destination) is
  'Per le pagine Cucina e Bar: la stampante del reparto, se il ponte è acceso, e i fogli dei conti aperti con il loro stato nella coda. Un foglio incerto non porta frase d''errore.';
comment on function public.stato_stampa_cucina() is
  'Come stato_stampa(''cucina''): resta per il gestionale pubblicato prima del 31/10/2026.';

-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_ordine   uuid;
  v_disp     uuid;
  v_k        jsonb;
  v_vino     uuid;
  v_lavoro   uuid;
  v_r        jsonb;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  if has_function_privilege('anon', 'stato_stampa(order_destination)', 'execute')
     or not has_function_privilege('authenticated', 'stato_stampa(order_destination)', 'execute')
     or has_function_privilege('anon', 'stato_stampa_cucina()', 'execute')
     or not has_function_privilege('authenticated', 'stato_stampa_cucina()', 'execute') then
    raise exception 'VERIFICA: i permessi dello stato della stampa non sono quelli dichiarati.';
  end if;

  -- (1) Le frasi: «a metà» dice di guardare, non che non è uscito.
  if frase_di_stampa('risposta_a_meta') is null
     or frase_di_stampa('risposta_a_meta') like '%non l''ha stampato%'
     or frase_di_stampa('rifiutato') is null then
    raise exception 'VERIFICA (1): «a metà» e «rifiutato» non hanno la loro frase.';
  end if;

  begin
    -- Una stampante finta per il bar; quelle vere di Prova si spengono per
    -- la durata della verifica (si annulla tutto).
    update dispositivi set attivo = false where attivo and tipo = 'stampante_comande';
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
    values ('ZZ bar della verifica', 'stampante_comande', 'simulatore', '127.0.0.1', 19191, 'bar')
    returning id into v_disp;

    insert into orders (entity_id, table_label, status)
    values (v_ente, 'ZZ tavolo del bar', 'aperto') returning id into v_ordine;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ spritz', 'bar', 1, 1) returning id into v_vino;
    update order_items set sent_at = now() where id = v_vino;
    select id into v_lavoro from lavori_stampa where order_id = v_ordine and reparto = 'bar' and stato = 'in_coda';
    if v_lavoro is null then
      raise exception 'VERIFICA (2): l''invio al bar con una stampante non ha accodato il foglio.';
    end if;

    -- (3) Il ponte lo prende e risponde «a metà»: il foglio è incerto.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_k := crea_chiave_ponte('ZZ mini-PC del bar');
    perform set_config('request.jwt.claims', null, true);
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or (v_r->0->>'id')::uuid <> v_lavoro then
      raise exception 'VERIFICA (3a): il ponte non ha preso il foglio del bar: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'incerto', 'risposta_a_meta',
                               'Risposta a metà da 127.0.0.1', 'errore', '{}');
    if (select stato from lavori_stampa where id = v_lavoro) <> 'incerto' then
      raise exception 'VERIFICA (3b): il foglio a metà non è incerto.';
    end if;

    -- (4) Nessuna ristampa da sola: al giro dopo il ponte non lo riprende.
    if jsonb_array_length(ponte_prendi_lavori(v_k->>'chiave', 5)) <> 0 then
      raise exception 'VERIFICA (4): un foglio incerto è tornato in coda da solo.';
    end if;

    -- (5) Lo staff, dal Bar, vede la sua stampante e il foglio incerto,
    --     senza frase d'errore e senza indirizzi. La Cucina non lo vede.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := stato_stampa('bar');
    if v_r->'stampante'->>'nome' <> 'ZZ bar della verifica'
       or not exists (select 1 from jsonb_array_elements(v_r->'lavori') l
                       where (l->>'id')::uuid = v_lavoro and l->>'stato' = 'incerto' and l->'errore' = 'null'::jsonb) then
      raise exception 'VERIFICA (5a): il Bar non vede il suo foglio incerto come deve: %.', v_r;
    end if;
    if v_r::text ~ '\d+\.\d+\.\d+\.\d+' then
      raise exception 'VERIFICA (5b): lo stato della stampa del bar mostra un indirizzo allo staff.';
    end if;
    if stato_stampa_cucina()->'lavori' @> jsonb_build_array(jsonb_build_object('id', v_lavoro)) then
      raise exception 'VERIFICA (5c): la Cucina vede un foglio del bar.';
    end if;
    -- (6) «Ristampa» dal Bar: una persona ha guardato, il foglio torna in
    --     coda al posto dell'incerto.
    if manda_alla_stampante(array[v_vino], null, false) is null then
      raise exception 'VERIFICA (6a): la ristampa dal Bar non è entrata in coda.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    -- ⚠️ Si guarda la coda DOPO aver lasciato il ruolo dello staff: la RLS
    --    di `lavori_stampa` la mostra solo al titolare, e da staff questo
    --    controllo non leggerebbe niente e passerebbe sempre (revisione ECC).
    if (select stato from lavori_stampa where id = v_lavoro) is distinct from 'annullato'
       or not exists (select 1 from lavori_stampa where v_vino = any(righe) and stato = 'in_coda') then
      raise exception 'VERIFICA (6b): la ristampa dal Bar non ha sostituito il foglio incerto.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della stampa incerta e del bar');

  raise notice 'Fatto: «a metà» e «rifiutato» hanno la loro frase; il bar accoda il suo foglio, lo vede incerto senza frase d''errore e senza indirizzi; un incerto non torna in coda da solo; la ristampa del bar lo sostituisce; la cucina non vede il bar. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261031000001', 'la_stampa_incerta_e_il_bar')
on conflict (version) do nothing;
