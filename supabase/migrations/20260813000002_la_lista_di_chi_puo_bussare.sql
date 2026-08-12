-- =====================================================================
-- La lista di chi puo' bussare da fuori non cresce in silenzio
-- =====================================================================
-- Rilievo del validatore, 13/08/2026.
--
-- Esiste un controllo anti-deriva: l'elenco delle funzioni dello schema
-- `public` eseguibili dal ruolo `anon` — cioe' da chiunque abbia la
-- chiave pubblica del sito. Nasce dall'11/08, quando si scopri' che
-- **35 funzioni** erano aperte al mondo per il permesso predefinito di
-- Postgres (fra cui fondere clienti e movimentare il magazzino).
--
-- Da allora la regola (§8) e': ogni funzione nuova finisce con
-- `revoke all ... from public, anon, authenticated`, poi il `grant`
-- esplicito a chi serve davvero.
--
-- LA REGOLA E' STATA DISATTESA DUE VOLTE, il 12/08: `chiave_articolo` e
-- `nome_ingrediente_chiave` sono nate senza revoca e l'elenco e' passato
-- da 12 a 14 **senza che nessuno lo dicesse**. Nessun dato usciva — sono
-- due normalizzatori puri, trasformano un testo in un altro testo e non
-- guardano nessuna tabella — ma non e' questo il punto: un elenco che
-- cresce in silenzio non e' piu' un controllo, e la prossima funzione
-- potrebbe non essere innocua.
--
-- Quindi due cose, non una.
--
-- 1. LE DUE VENGONO CHIUSE, non documentate come eccezioni. Tutti e tre
--    i loro chiamanti (`abbina_righe_carico`, `esegui_azione_posta`,
--    `trova_o_crea_ingrediente`) sono `security definer` e girano come
--    proprietario: nessun ruolo applicativo ha bisogno di eseguirle.
--    Verificato anche che non compaiano in nessun indice funzionale ne'
--    vincolo, dove una revoca si sarebbe fatta sentire su un `insert`
--    normale invece che su una chiamata diretta.
--
-- 2. L'ELENCO DIVENTA AUTOMATICO. Finora era un controllo che il
--    validatore rifaceva a mano: quindi si accorgeva della deriva
--    **dopo**, e solo se guardava. Ora `funzioni_aperte_ad_anon()`
--    risponde chi c'e' dentro, la verifica qui sotto pretende che siano
--    esattamente le 12 attese, e una prova automatica lo richiede a ogni
--    giro. Una funzione nuova lasciata aperta fa diventare rossa una
--    prova, invece di restare in attesa che qualcuno se ne accorga.
--    (§5: preferire l'automazione alla disciplina — la disciplina si
--    degrada, l'automazione no.)
--
-- ⚠️ Le 12 che restano NON sono tutte innocue per definizione, e non le
-- sto dichiarando a posto: sono lo stato di partenza congelato. Fra
-- queste ce ne sono di `security definer` con `proacl` nullo
-- (`abbina_righe_carico`), che meritano un giro loro. Questa migrazione
-- ferma la deriva; non fa quell'audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. I due normalizzatori si chiudono
-- ---------------------------------------------------------------------
comment on function chiave_articolo(text) is
  'Normalizzatore puro: la dicitura di un fornitore ridotta a cio'' che conta per riconoscerla. Non legge nessuna tabella. Eseguibile solo dalle funzioni che la usano, che girano come proprietario.';

comment on function nome_ingrediente_chiave(text) is
  'Normalizzatore puro: il nome di un ingrediente ridotto a cio'' che conta per capire se e'' lo stesso. Non legge nessuna tabella. Eseguibile solo dalle funzioni che la usano, che girano come proprietario.';

revoke all on function chiave_articolo(text) from public, anon, authenticated;
revoke all on function nome_ingrediente_chiave(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. L'elenco si puo' chiedere, invece di doverlo ricostruire
-- ---------------------------------------------------------------------
create or replace function funzioni_aperte_ad_anon()
returns table (nome text)
language sql
stable
security definer
set search_path = public
as $funzione$
  select distinct p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'execute')
   order by 1;
$funzione$;

comment on function funzioni_aperte_ad_anon() is
  'Chi puo'' bussare da fuori: le funzioni di `public` eseguibili con la sola chiave pubblica del sito. Serve a far fallire una prova quando l''elenco cresce, invece di aspettare che qualcuno lo ricontrolli a mano.';

revoke all on function funzioni_aperte_ad_anon() from public, anon, authenticated;
grant execute on function funzioni_aperte_ad_anon() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  -- Lo stato congelato: 12 nomi, in ordine alfabetico. Chi tocca questa
  -- lista sta cambiando chi puo' entrare da fuori, e deve saperlo.
  v_attese text[] := array[
    'abbina_righe_carico',
    'check_recipe_component',
    'generate_foraged_lot',
    'is_titolare',
    'log_recipe_status_change',
    'normalize_phone',
    'public_reservation_options',
    'set_aggiornato_il',
    'set_task_visibility',
    'set_updated_at',
    'submit_public_reservation',
    'task_origin_visible_to_staff'
  ];
  v_ora     text[];
  v_inPiu   text[];
  v_inMeno  text[];
begin
  select array_agg(nome order by nome) into v_ora from funzioni_aperte_ad_anon();
  v_ora := coalesce(v_ora, array[]::text[]);

  select coalesce(array_agg(x order by x), array[]::text[]) into v_inPiu
    from unnest(v_ora) x where x <> all (v_attese);
  select coalesce(array_agg(x order by x), array[]::text[]) into v_inMeno
    from unnest(v_attese) x where x <> all (v_ora);

  -- 1. Le due del 12/08 non ci sono piu'.
  if 'chiave_articolo' = any (v_ora) or 'nome_ingrediente_chiave' = any (v_ora) then
    raise exception 'I due normalizzatori sono ancora eseguibili con la chiave pubblica.';
  end if;

  -- 2. E non se n'e' chiusa nessuna per sbaglio: il form pubblico deve
  --    continuare a funzionare per chi non e' loggato.
  if array_length(v_inMeno, 1) > 0 then
    raise exception 'Si sono chiuse funzioni che devono restare aperte: %. Il form pubblico potrebbe non funzionare piu''.',
      array_to_string(v_inMeno, ', ');
  end if;

  -- 3. Nessuna aggiunta silenziosa.
  if array_length(v_inPiu, 1) > 0 then
    raise exception 'Queste funzioni sono eseguibili da fuori e non erano nell''elenco: %. Se e'' voluto, va aggiunta qui e detto perche''.',
      array_to_string(v_inPiu, ', ');
  end if;

  if array_length(v_ora, 1) <> 12 then
    raise exception 'Attese 12 funzioni aperte, ne risultano %.', array_length(v_ora, 1);
  end if;

  raise notice 'Chi puo'' bussare da fuori: 12, congelate e verificate a ogni giro.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000002', 'la_lista_di_chi_puo_bussare')
on conflict (version) do nothing;

select nome from funzioni_aperte_ad_anon();
