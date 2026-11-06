-- =====================================================================
-- LO SCONTRINO DALLA CHIUSURA DEL CONTO — 04/11/2026, deciso da Alessio
-- durante il collaudo dal fornitore: «implementiamo adesso che abbiamo la
-- possibilità di provare e siamo in fase di collaudo».
-- =====================================================================
--
-- 🔴 COSA CAMBIA. Un conto chiuso e pagato può chiedere UNO scontrino
--    fiscale al registratore (Epson FP-81 II RT, FPMate): la coda accetta
--    il tipo 'scontrino', il ponte lo compone e lo manda, e dalla risposta
--    salva numero, data, ora e numero di chiusura nell'esito del lavoro.
--
-- 🔴 MAI DUE SCONTRINI PER LO STESSO CONTO. Un indice unico tiene al
--    massimo un lavoro 'scontrino' non annullato per conto: un doppio clic,
--    due telefoni o una rete che cade e fa ripremere trovano il primo e si
--    fermano. Un lavoro fallito o incerto resta lì e blocca: rifare lo
--    scontrino vuol dire che il titolare ha guardato il registratore e ha
--    annullato quel lavoro dalla pagina Stampanti. La riga dello scontrino
--    non si cancella mai: né il battito del ponte né la cancellazione del
--    registratore se la portano via.
--
-- 🔴 IL CONTENUTO LO SCRIVE IL DATABASE, non il browser: righe e prezzi
--    vengono da `order_items` e da `totale_conto()`, i pagamenti da
--    `order_payments`. Se le righe non fanno il totale pagato (sconto,
--    omaggio, caparra scalata) lo scontrino non si accoda: in questo passo
--    si fa a mano sul registratore.
--
-- ⚠️ FUORI DA QUESTO PASSO: annullo e reso, chiusura giornaliera, reparti
--    per IVA (oggi reparto 1 per tutto), conto diviso, e il segno
--    «scontrinato» su `orders.documento_fiscale` scritto dal ponte.
-- ⚠️ Niente in produzione: lì non c'è nessun registratore acceso, quindi
--    nessuno scontrino si può accodare.

-- ---------------------------------------------------------------------
-- 1. La coda ammette lo scontrino, legato al suo conto
-- ---------------------------------------------------------------------
alter table lavori_stampa drop constraint if exists lavoro_tipo_di_questo_passo;
alter table lavori_stampa add constraint lavoro_tipo_di_questo_passo
  check (tipo in ('prova', 'stato', 'comanda', 'chiamata', 'scontrino'));
comment on constraint lavoro_tipo_di_questo_passo on lavori_stampa is
  'La coda accetta prove di stampa, letture di stato, comande, biglietti del turno e scontrini fiscali di un conto chiuso.';

comment on column lavori_stampa.tipo is
  'prova = un foglio di prova; stato = chiedere all''apparecchio come sta; comanda = il foglio di una comanda per la cucina o il bar; chiamata = il biglietto «avanti col prossimo turno»; scontrino = lo scontrino fiscale di un conto chiuso, sul registratore.';

alter table lavori_stampa drop constraint if exists lavoro_legami_del_tipo;
alter table lavori_stampa add constraint lavoro_legami_del_tipo
  check (case tipo
           when 'comanda' then order_id is not null and reparto is not null and chiamata_id is null
                          and coalesce(cardinality(righe), 0) between 1 and 200
           when 'chiamata' then order_id is not null and chiamata_id is not null
                           and reparto = 'cucina' and righe is null
           when 'scontrino' then order_id is not null and chiamata_id is null
                            and reparto is null and righe is null
           else order_id is null and chiamata_id is null and reparto is null and righe is null
         end);
comment on constraint lavoro_legami_del_tipo on lavori_stampa is
  'Una comanda dice di quale conto, reparto e righe è (al massimo 200); un biglietto del turno dice quale biglietto; uno scontrino dice di quale conto; una prova o uno stato non sono legati a nessun conto.';

-- 🔴 Il vincolo che regge tutto il passo.
create unique index if not exists lavori_stampa_uno_scontrino_per_conto
  on lavori_stampa (order_id) where tipo = 'scontrino' and stato <> 'annullato';
comment on index lavori_stampa_uno_scontrino_per_conto is
  'Al massimo uno scontrino non annullato per conto: niente scontrini doppi, nemmeno con un doppio clic o una rete che cade.';

-- ---------------------------------------------------------------------
-- 2. Uno scontrino in coda non scade con la chiusura del conto
-- ---------------------------------------------------------------------
-- Come il 29/10, con una differenza: l'annullo «conto chiuso, non serve
-- più» vale solo per comande e biglietti. Uno scontrino si chiede proprio
-- a conto chiuso, e annullarlo da sé vorrebbe dire uno scontrino perso.
create or replace function public.scadi_lavori_abbandonati()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  update lavori_stampa
     set stato = 'incerto', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Il ponte ha preso questo lavoro e non ha più risposto: forse è uscito, forse no. Guarda la stampante e decidi tu.'
   where stato = 'in_corso' and preso_il < now() - interval '5 minutes';

  update lavori_stampa l
     set stato = 'annullato', finito_il = now(),
         errore_testo = 'Il conto è stato chiuso prima che il ponte stampasse: non serve più.'
   where l.stato = 'in_coda' and l.order_id is not null and l.tipo in ('comanda', 'chiamata')
     and exists (select 1 from orders o where o.id = l.order_id and o.status <> 'aperto');

  update lavori_stampa
     set stato = 'annullato', finito_il = now(),
         errore_testo = 'Rimasto in coda più di tre ore: non lo stampo più da solo.'
   where stato = 'in_coda' and tipo in ('comanda', 'chiamata') and creato_il < now() - interval '3 hours';

  -- ⚠️ Uno scontrino fermo in coda da sei ore (ponte o registratore spenti)
  --    non esce più da solo con la data e il numero di un altro giorno
  --    (revisione del database, 04/11). Diventa FALLITO e non annullato:
  --    non è uscito niente, ma resta lì e blocca, finché il titolare non
  --    decide.
  update lavori_stampa
     set stato = 'fallito', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Rimasto in coda più di sei ore: non lo emetto più da solo.'
   where stato = 'in_coda' and tipo = 'scontrino' and creato_il < now() - interval '6 hours';
end $function$;

revoke all on function public.scadi_lavori_abbandonati() from public, anon, authenticated;

-- 🔴 LA RIGA DELLO SCONTRINO È IL VINCOLO, quindi non si cancella mai da
--    sola (revisione del database, 04/11). Il battito del ponte tiene corta
--    la coda cancellando i fogli vecchi: gli scontrini no, altrimenti dopo
--    trenta giorni lo stesso conto ne potrebbe avere un secondo. Il resto
--    del battito è quello del 28/10.
create or replace function public.ponte_battito(p_chiave text, p_versione text, p_host text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_elenco jsonb;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;

  update chiavi_ponte
     set ultimo_battito = now(),
         versione = left(p_versione, 40),
         host = left(p_host, 80)
   where id = v_chiave;

  -- La coda si tiene corta da se': i fogli usciti per un mese, quelli
  -- andati storti per tre (servono a capire un guasto che ritorna).
  -- Gli scontrini restano per sempre.
  delete from lavori_stampa
   where tipo <> 'scontrino'
     and ((stato in ('stampato', 'annullato') and finito_il < now() - interval '30 days')
       or (stato in ('fallito', 'incerto') and finito_il < now() - interval '90 days'));

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'nome', d.nome, 'tipo', d.tipo, 'protocollo', d.protocollo,
           'indirizzo', host(d.indirizzo), 'porta', d.porta, 'reparto', d.reparto)
           order by d.nome), '[]'::jsonb)
    into v_elenco
    from dispositivi d where d.attivo;

  return jsonb_build_object('ora', now(), 'dispositivi', v_elenco);
end $function$;

revoke all on function public.ponte_battito(text, text, text) from public, anon, authenticated;
grant execute on function public.ponte_battito(text, text, text) to anon, authenticated;

-- 🔴 E NEMMENO CANCELLANDO IL REGISTRATORE: i lavori seguono l'apparecchio
--    (`on delete cascade`), quindi un registratore cancellato si porterebbe
--    via gli scontrini e il loro vincolo. Un registratore che ha emesso
--    scontrini si spegne, non si cancella.
create or replace function public.registratore_con_scontrini_non_si_cancella()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (select 1 from lavori_stampa where dispositivo_id = old.id and tipo = 'scontrino') then
    raise exception '«%» ha emesso scontrini: non si cancella, si spegne.', old.nome;
  end if;
  return old;
end $function$;

revoke all on function public.registratore_con_scontrini_non_si_cancella() from public, anon, authenticated;

drop trigger if exists registratore_con_scontrini_non_si_cancella on dispositivi;
create trigger registratore_con_scontrini_non_si_cancella
  before delete on dispositivi
  for each row execute function registratore_con_scontrini_non_si_cancella();

-- Il titolare può annullare anche uno scontrino FALLITO: è il modo per
-- rifarlo dopo aver guardato il registratore (l'indice unico, sopra, non
-- ne lascia accodare un secondo finché il primo non è annullato).
create or replace function public.annulla_lavoro_stampa(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può annullare un lavoro di stampa.';
  end if;
  perform scadi_lavori_abbandonati();
  -- ⚠️ Uno scontrino «interrotto» (preso dal ponte, poi silenzio) si
  --    annulla solo dopo mezz'ora: prima il ponte potrebbe starlo ancora
  --    stampando (revisione del database, 04/11).
  if exists (select 1 from lavori_stampa
              where id = p_id and tipo = 'scontrino' and stato = 'incerto'
                and errore_codice = 'interrotto' and preso_il > now() - interval '30 minutes') then
    raise exception 'Il ponte potrebbe stare ancora emettendo questo scontrino: guarda il registratore e riprova fra mezz''ora.';
  end if;
  update lavori_stampa
     set stato = 'annullato', finito_il = now(),
         errore_testo = case when tipo = 'scontrino'
                             then 'Annullato dal titolare dopo aver guardato il registratore.'
                             else errore_testo end
   where id = p_id
     and (stato in ('in_coda', 'incerto') or (stato = 'fallito' and tipo = 'scontrino'));
  if not found then
    raise exception 'Questo lavoro non si può più annullare: o è già finito, o il ponte lo sta stampando adesso.';
  end if;
end $function$;

revoke all on function public.annulla_lavoro_stampa(uuid) from public, anon, authenticated;
grant execute on function public.annulla_lavoro_stampa(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Chiedere lo scontrino di un conto
-- ---------------------------------------------------------------------
create or replace function public.registratore_acceso()
returns uuid
language sql
stable
set search_path to 'public'
as $function$
  select id from dispositivi
   where attivo and tipo = 'registratore_fiscale'
   order by creato_il
   limit 1
$function$;

revoke all on function public.registratore_acceso() from public, anon, authenticated;

create or replace function public.accoda_scontrino(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order   orders%rowtype;
  v_disp    uuid;
  v_tot     record;
  v_righe   jsonb;
  v_somma   numeric(12,2);
  v_pagato  numeric(12,2);
  v_pag     jsonb;
  v_id      uuid;
begin
  -- Solo chi ha un ruolo nel locale (staff o titolare), come le comande.
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  perform scadi_lavori_abbandonati();

  -- ⚠️ `for update`: chi riapre il conto o lo richiude aspetta che lo
  --    scontrino sia in coda, e due tocchi insieme passano uno alla volta
  --    (revisione del database, 04/11).
  select * into v_order from orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'Questo conto non c''è più: ricarica la pagina.';
  end if;
  if v_order.status <> 'chiuso' then
    raise exception 'Lo scontrino si fa su un conto chiuso e pagato.';
  end if;
  if v_order.closed_at < now() - interval '12 hours' then
    raise exception 'Questo conto è stato chiuso più di dodici ore fa: lo scontrino si fa a mano sul registratore.';
  end if;
  if v_order.discount_gift_id is not null then
    raise exception 'Questo conto ha uno sconto o un omaggio: per ora lo scontrino si fa a mano sul registratore.';
  end if;
  if v_order.documento_fiscale is not null then
    raise exception 'Per questo conto è già segnato un documento fiscale: niente scontrino in più.';
  end if;

  v_disp := registratore_acceso();
  if v_disp is null then
    raise exception 'Nessun registratore acceso nel gestionale: accendilo dalla pagina Stampanti.';
  end if;

  -- 🔴 Prima di tutto il resto, così la frase è quella giusta anche se
  --    poi le righe non tornassero.
  if exists (select 1 from lavori_stampa where order_id = p_order and tipo = 'scontrino' and stato <> 'annullato') then
    raise exception 'Lo scontrino di questo conto è già stato chiesto: guarda come è andata, non rifarlo.';
  end if;

  select * into v_tot from totale_conto(p_order);

  -- Una riga per piatto inviato, col supplemento delle sostituzioni nel
  -- prezzo di ognuno. Un prezzo zero non va sullo scontrino.
  select coalesce(jsonb_agg(jsonb_build_object(
           'descrizione', x.nome, 'quantita', x.quantita, 'prezzo', x.prezzo, 'reparto', 1)
           order by x.ordine), '[]'::jsonb),
         coalesce(sum(x.quantita * x.prezzo), 0)
    into v_righe, v_somma
    from (
      select i.created_at as ordine, i.quantity as quantita,
             (i.unit_price + coalesce((select sum(s.costo_aggiuntivo) from order_item_sostituzioni s
                                        where s.order_item_id = i.id), 0))::numeric(12,2) as prezzo,
             left(case when r.recipe_type = 'finger' then 'bis di ' || r.name
                       else coalesce(nullif(r.name, ''), i.free_text_name, 'Piatto') end, 60) as nome
        from order_items i
        left join recipes r on r.id = i.recipe_id
       where i.order_id = p_order and i.voided_at is null and i.sent_at is not null
    ) x
   where x.prezzo > 0;

  if coalesce(v_tot.coperti, 0) > 0 and coalesce(v_tot.prezzo_coperto, 0) > 0 then
    v_righe := v_righe || jsonb_build_array(jsonb_build_object(
      'descrizione', 'Coperto', 'quantita', v_tot.coperti, 'prezzo', v_tot.prezzo_coperto, 'reparto', 1));
    v_somma := v_somma + v_tot.coperti * v_tot.prezzo_coperto;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('mezzo', p.mezzo, 'importo', p.importo) order by p.created_at), '[]'::jsonb),
         coalesce(sum(p.importo), 0)
    into v_pag, v_pagato
    from order_payments p where p.order_id = p_order;

  if jsonb_array_length(v_righe) = 0 or v_somma <= 0 then
    raise exception 'Questo conto non ha righe da mettere sullo scontrino.';
  end if;
  if jsonb_array_length(v_righe) > 100 then
    raise exception 'Questo conto ha più di 100 righe: per ora lo scontrino si fa a mano sul registratore.';
  end if;
  -- ⚠️ Righe e pagamenti devono tornare al centesimo, e col totale del
  --    conto: altrimenti il registratore scriverebbe un incasso diverso da
  --    quello della cassa (caparra scalata, arrotondamenti).
  if abs(v_somma - v_tot.totale) > 0.005 or abs(v_pagato - v_somma) > 0.005 then
    raise exception 'Le righe fanno %, il pagato %: con una caparra o uno sconto, per ora lo scontrino si fa a mano sul registratore.',
      euro(v_somma), euro(v_pagato);
  end if;

  begin
    insert into lavori_stampa (dispositivo_id, tipo, order_id, contenuto)
    values (v_disp, 'scontrino', p_order,
            jsonb_build_object('tavolo', v_order.table_label, 'righe', v_righe,
                               'pagamenti', v_pag, 'totale', v_somma))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Lo scontrino di questo conto è già stato chiesto: guarda come è andata, non rifarlo.';
  end;
  return v_id;
end $function$;

revoke all on function public.accoda_scontrino(uuid) from public, anon, authenticated;
grant execute on function public.accoda_scontrino(uuid) to authenticated;
comment on function public.accoda_scontrino(uuid) is
  'Accoda lo scontrino fiscale di un conto chiuso sul registratore acceso. Al massimo uno per conto (indice lavori_stampa_uno_scontrino_per_conto).';

-- ---------------------------------------------------------------------
-- 4. Com'è andato lo scontrino di un conto, per chi chiude
-- ---------------------------------------------------------------------
-- 🔴 SOLO FRASI FISSE, MAI IL TESTO DEL PONTE (stessa regola di
--    `stato_stampa`): niente indirizzi a chi lavora in sala.
create or replace function public.stato_scontrino(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_l lavori_stampa%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  select * into v_l from lavori_stampa
   where order_id = p_order and tipo = 'scontrino'
   order by (stato <> 'annullato') desc, creato_il desc
   limit 1;
  return jsonb_build_object(
    'registratore', registratore_acceso() is not null,
    'lavoro', case when v_l.id is null then null else jsonb_build_object(
      'stato', v_l.stato,
      'numero', v_l.esito->'scontrino'->>'numero',
      'data', v_l.esito->'scontrino'->>'data',
      'ora', v_l.esito->'scontrino'->>'ora',
      'chiusura', v_l.esito->'scontrino'->>'chiusura',
      'frase', case v_l.stato
        when 'in_coda' then 'In coda: il ponte lo manda al registratore.'
        when 'in_corso' then 'Il registratore lo sta stampando.'
        when 'stampato' then 'Scontrino emesso.'
        when 'incerto' then 'Mandato, ma la risposta non è arrivata: forse è uscito, forse no. Guarda il registratore prima di rifarlo.'
        when 'fallito' then 'Non è uscito: ' || coalesce(frase_di_stampa(v_l.errore_codice), 'il registratore non l''ha emesso.') || ' Per rifarlo, il titolare lo annulla dalla pagina Stampanti.'
        when 'annullato' then 'Annullato.'
      end) end);
end $function$;

revoke all on function public.stato_scontrino(uuid) from public, anon, authenticated;
grant execute on function public.stato_scontrino(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica
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
  v_lavoro   uuid;
  v_r        jsonb;
  v_ok       boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles, e un''entità.';
  end if;

  if has_function_privilege('anon', 'accoda_scontrino(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'accoda_scontrino(uuid)', 'execute')
     or has_function_privilege('anon', 'stato_scontrino(uuid)', 'execute')
     or has_function_privilege('authenticated', 'registratore_acceso()', 'execute') then
    raise exception 'VERIFICA: i permessi dello scontrino non sono quelli dichiarati.';
  end if;

  begin
    -- Le stampanti e i registratori veri di Prova si spengono per la durata
    -- della verifica (si annulla tutto); uno finto prende il loro posto.
    update dispositivi set attivo = false where attivo;
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta)
    values ('ZZ registratore della verifica', 'registratore_fiscale', 'simulatore', '127.0.0.1', 19192)
    returning id into v_disp;

    insert into orders (entity_id, table_label, status, coperti)
    values (v_ente, 'ZZ tavolo dello scontrino', 'aperto', 0) returning id into v_ordine;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ calice', 'bar', 2, 5),
           (v_ordine, 'ZZ acqua', 'bar', 1, 2.5);
    update order_items set sent_at = now() where order_id = v_ordine;

    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- (1) Su un conto aperto lo scontrino non si chiede.
    v_ok := false;
    begin
      perform accoda_scontrino(v_ordine);
    exception when others then v_ok := sqlerrm like '%conto chiuso%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (1): uno scontrino è entrato in coda su un conto aperto.';
    end if;

    -- (2) Chiuso e pagato in due modi: righe, pagamenti e totale tornano.
    perform close_order_paid(v_ordine, null, 0,
      '[{"mezzo":"contante","importo":7.5},{"mezzo":"carta","importo":5}]'::jsonb, false);
    v_lavoro := accoda_scontrino(v_ordine);
    if v_lavoro is null then
      raise exception 'VERIFICA (2a): lo scontrino del conto chiuso non è entrato in coda.';
    end if;

    -- (3) Il secondo clic trova il primo e si ferma.
    v_ok := false;
    begin
      perform accoda_scontrino(v_ordine);
    exception when others then v_ok := sqlerrm like '%già stato chiesto%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (3): un secondo scontrino per lo stesso conto è entrato in coda.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (3b) Nemmeno scrivendo nella tabella si scavalca l'indice.
    v_ok := false;
    begin
      insert into lavori_stampa (dispositivo_id, tipo, order_id) values (v_disp, 'scontrino', v_ordine);
    exception when unique_violation then v_ok := true;
    end;
    if not v_ok then
      raise exception 'VERIFICA (3b): l''indice non ferma un secondo scontrino per lo stesso conto.';
    end if;

    v_r := (select contenuto from lavori_stampa where id = v_lavoro);
    if (v_r->>'totale')::numeric <> 12.5 or jsonb_array_length(v_r->'righe') <> 2
       or jsonb_array_length(v_r->'pagamenti') <> 2 then
      raise exception 'VERIFICA (2b): il contenuto dello scontrino non è quello del conto: %.', v_r;
    end if;

    -- (4) La chiusura del conto non lo annulla da sé.
    perform scadi_lavori_abbandonati();
    if (select stato from lavori_stampa where id = v_lavoro) <> 'in_coda' then
      raise exception 'VERIFICA (4): lo scontrino in coda si è annullato da solo a conto chiuso.';
    end if;

    -- (5) Il ponte lo prende e risponde «a metà»: incerto, e non torna in coda.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_k := crea_chiave_ponte('ZZ ponte dello scontrino');
    perform set_config('request.jwt.claims', null, true);
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or v_r->0->>'tipo' <> 'scontrino' then
      raise exception 'VERIFICA (5a): il ponte non ha preso lo scontrino: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'incerto', 'risposta_a_meta',
                               'Mandato a 127.0.0.1, nessuna risposta', 'errore', '{}');
    if jsonb_array_length(ponte_prendi_lavori(v_k->>'chiave', 5)) <> 0 then
      raise exception 'VERIFICA (5b): uno scontrino incerto è tornato in coda da solo.';
    end if;

    -- (6) Lo staff vede «incerto» con la frase fissa, senza indirizzi, e
    --     non può rifarlo.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := stato_scontrino(v_ordine);
    if v_r->'lavoro'->>'stato' <> 'incerto' or v_r->'lavoro'->>'frase' not like '%Guarda il registratore%'
       or v_r::text ~ '\d+\.\d+\.\d+\.\d+' or not (v_r->>'registratore')::boolean then
      raise exception 'VERIFICA (6a): lo stato dello scontrino incerto non è quello giusto: %.', v_r;
    end if;
    v_ok := false;
    begin
      perform accoda_scontrino(v_ordine);
    exception when others then v_ok := sqlerrm like '%già stato chiesto%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (6b): dopo un incerto si è potuto chiedere un altro scontrino.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (7) Il titolare ha guardato e annulla: ora se ne può chiedere uno, e
    --     il ponte che risponde «emesso» lascia numero e chiusura leggibili.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    perform annulla_lavoro_stampa(v_lavoro);
    v_lavoro := accoda_scontrino(v_ordine);
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'stampato', null, null, 'pronto',
      '{"lingua":"fpmate","scontrino":{"numero":"14","data":"4/11/2026","ora":"9:33","chiusura":"1627","importo":"12,50"}}'::jsonb);
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := stato_scontrino(v_ordine);
    if v_r->'lavoro'->>'stato' <> 'stampato' or v_r->'lavoro'->>'numero' <> '14'
       or v_r->'lavoro'->>'chiusura' <> '1627' then
      raise exception 'VERIFICA (7): lo scontrino emesso non mostra numero e chiusura: %.', v_r;
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (8) Il battito del ponte non cancella gli scontrini vecchi, e il
    --     registratore che li ha emessi non si cancella.
    update lavori_stampa set finito_il = now() - interval '400 days' where order_id = v_ordine and tipo = 'scontrino';
    perform ponte_battito(v_k->>'chiave', 'verifica', 'verifica');
    if (select count(*) from lavori_stampa where order_id = v_ordine and tipo = 'scontrino') <> 2 then
      raise exception 'VERIFICA (8a): il battito del ponte ha cancellato uno scontrino.';
    end if;
    v_ok := false;
    begin
      delete from dispositivi where id = v_disp;
    exception when others then v_ok := sqlerrm like '%non si cancella%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (8b): il registratore con scontrini si è potuto cancellare.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dello scontrino dalla chiusura');

  raise notice 'Fatto: lo scontrino si chiede solo a conto chiuso, uno per conto (anche scrivendo nella tabella), con righe e pagamenti del conto; la chiusura non lo annulla; un incerto non torna in coda e non si rifà finché il titolare non lo annulla; l''emesso mostra numero e chiusura. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000001', 'lo_scontrino_dalla_chiusura')
on conflict (version) do nothing;
