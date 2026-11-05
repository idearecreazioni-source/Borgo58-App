-- =====================================================================
-- L'ANNULLO DELLO SCONTRINO E LA CHIUSURA GIORNALIERA — 04/11/2026,
-- chiesto da Alessio al collaudo, dopo il primo scontrino riuscito:
-- «implementa una procedura automatica per l'annullamento dello scontrino e
-- della chiusura fiscale».
-- =====================================================================
--
-- I comandi vengono dal manuale Epson «ePOS Fiscal Print Solution
-- Development Guide» Rev. U (§5.6 documento di annullo, §5.8 chiusura), non
-- dalla memoria. Il ponte li compone in `ponte/protocolli/fpmate.mjs`.
--
-- 🔴 L'ANNULLO. Il titolare annulla uno scontrino USCITO DI SICURO
--    (`stampato`), mai uno incerto o fallito. Il registratore lo cerca con
--    «VOID chiusura numero data matricola»: i primi tre li ha salvati il
--    ponte dalla risposta dello scontrino, la matricola è un campo nuovo
--    del registratore (stampata sullo scontrino). Al massimo UN annullo non
--    annullato per scontrino: un indice unico, come per lo scontrino.
-- 🔴 LA CHIUSURA GIORNALIERA (Z). Solo il titolare, una alla volta per
--    registratore: una in coda o in corso blocca la seconda.
-- 🔴 Tutti e due seguono le regole dello scontrino: il ponte non riprova
--    mai, «mandato senza risposta» è INCERTO, una riga fiscale non si
--    cancella mai (né col battito del ponte né col registratore).
--
-- ⚠️ FUORI: il reso con le righe (rendere solo alcuni piatti), la lettura
--    della matricola dal registratore (`getSerialNumber` c'è solo da
--    fpmate.cgi 1.043, e il nostro non la manda nemmeno nelle risposte).
-- ⚠️ Niente in produzione: lì non c'è nessun registratore acceso.

-- ---------------------------------------------------------------------
-- 1. La matricola del registratore
-- ---------------------------------------------------------------------
alter table dispositivi add column if not exists matricola text;
alter table dispositivi drop constraint if exists dispositivo_matricola_ben_scritta;
alter table dispositivi add constraint dispositivo_matricola_ben_scritta
  check (matricola is null or (tipo = 'registratore_fiscale' and matricola ~ '^[0-9A-Z]{11}$'));
comment on column dispositivi.matricola is
  'Per il registratore: la matricola fiscale di undici caratteri (per esempio 99IEC123456), stampata in fondo a ogni scontrino. Serve ad annullare uno scontrino.';
comment on constraint dispositivo_matricola_ben_scritta on dispositivi is
  'La matricola è di undici lettere maiuscole o cifre, e ce l''ha solo il registratore.';
-- Il titolare la scrive dalla pagina Stampanti: le colonne che può
-- scrivere sono elencate una per una dal 28/10 (revisione del database).
grant insert (matricola), update (matricola) on dispositivi to authenticated;

-- ---------------------------------------------------------------------
-- 2. La coda ammette annullo e chiusura
-- ---------------------------------------------------------------------
alter table lavori_stampa add column if not exists scontrino_id uuid references lavori_stampa(id) on delete restrict;
comment on column lavori_stampa.scontrino_id is
  'Per un annullo: lo scontrino che annulla.';
create index if not exists lavori_stampa_scontrino_id on lavori_stampa (scontrino_id) where scontrino_id is not null;

alter table lavori_stampa drop constraint if exists lavoro_tipo_di_questo_passo;
alter table lavori_stampa add constraint lavoro_tipo_di_questo_passo
  check (tipo in ('prova', 'stato', 'comanda', 'chiamata', 'scontrino', 'annullo', 'chiusura'));
comment on constraint lavoro_tipo_di_questo_passo on lavori_stampa is
  'La coda accetta prove di stampa, letture di stato, comande, biglietti del turno, scontrini fiscali, annulli di uno scontrino e chiusure giornaliere.';

comment on column lavori_stampa.tipo is
  'prova = un foglio di prova; stato = chiedere all''apparecchio come sta; comanda = il foglio di una comanda; chiamata = il biglietto «avanti col prossimo turno»; scontrino = lo scontrino fiscale di un conto chiuso; annullo = il documento che annulla uno scontrino; chiusura = la chiusura fiscale giornaliera (Z) del registratore.';

alter table lavori_stampa drop constraint if exists lavoro_legami_del_tipo;
alter table lavori_stampa add constraint lavoro_legami_del_tipo
  check (case tipo
           when 'comanda' then order_id is not null and reparto is not null and chiamata_id is null
                          and coalesce(cardinality(righe), 0) between 1 and 200 and scontrino_id is null
           when 'chiamata' then order_id is not null and chiamata_id is not null
                           and reparto = 'cucina' and righe is null and scontrino_id is null
           when 'scontrino' then order_id is not null and chiamata_id is null
                            and reparto is null and righe is null and scontrino_id is null
           when 'annullo' then order_id is not null and scontrino_id is not null and chiamata_id is null
                          and reparto is null and righe is null
           else order_id is null and chiamata_id is null and reparto is null and righe is null and scontrino_id is null
         end);
comment on constraint lavoro_legami_del_tipo on lavori_stampa is
  'Una comanda dice di quale conto, reparto e righe è (al massimo 200); un biglietto del turno dice quale biglietto; uno scontrino dice di quale conto; un annullo dice quale scontrino annulla; prova, stato e chiusura non sono legati a nessun conto.';

-- 🔴 I due vincoli che reggono il passo.
create unique index if not exists lavori_stampa_un_annullo_per_scontrino
  on lavori_stampa (scontrino_id) where tipo = 'annullo' and stato <> 'annullato';
comment on index lavori_stampa_un_annullo_per_scontrino is
  'Al massimo un annullo non annullato per scontrino: niente annulli doppi, nemmeno con un doppio clic.';
-- ⚠️ Anche una chiusura INCERTA blocca (revisione del database, 04/11):
--    forse è già stata trasmessa all'Agenzia, e la seconda si fa solo dopo
--    che il titolare ha guardato il registratore e l'ha tolta.
create unique index if not exists lavori_stampa_una_chiusura_aperta_per_registratore
  on lavori_stampa (dispositivo_id) where tipo = 'chiusura' and stato in ('in_coda', 'in_corso', 'incerto');
comment on index lavori_stampa_una_chiusura_aperta_per_registratore is
  'Una chiusura giornaliera in coda, in corso o incerta blocca la seconda sullo stesso registratore.';

-- ---------------------------------------------------------------------
-- 3. Scadenze, annullo dei lavori, battito, cancellazione del registratore
-- ---------------------------------------------------------------------
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

  -- Uno scontrino o un annullo fermo in coda da sei ore non esce più da
  -- solo: FALLITO, così resta lì e blocca finché il titolare non decide.
  update lavori_stampa
     set stato = 'fallito', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Rimasto in coda più di sei ore: non lo emetto più da solo.'
   where stato = 'in_coda' and tipo in ('scontrino', 'annullo') and creato_il < now() - interval '6 hours';

  -- ⚠️ Una chiusura giornaliera chiesta e mai partita non scatta ore dopo,
  --    magari a giornata nuova già cominciata: dopo mezz'ora è fallita.
  update lavori_stampa
     set stato = 'fallito', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Rimasta in coda più di mezz''ora: la chiusura non la faccio più da solo, richiedila.'
   where stato = 'in_coda' and tipo = 'chiusura' and creato_il < now() - interval '30 minutes';
end $function$;

revoke all on function public.scadi_lavori_abbandonati() from public, anon, authenticated;

-- rete-guardie: annulla_lavoro_stampa — il rifiuto «potrebbe stare ancora emettendo questo scontrino» diventa «… lavorando su questo documento fiscale»: la stessa regola dei 30 minuti, ora per scontrino, annullo e chiusura
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
  -- ⚠️ Un lavoro fiscale «interrotto» (preso dal ponte, poi silenzio) si
  --    annulla solo dopo mezz'ora: prima il ponte potrebbe starlo ancora
  --    facendo (revisione del database, 04/11).
  if exists (select 1 from lavori_stampa
              where id = p_id and tipo in ('scontrino', 'annullo', 'chiusura') and stato = 'incerto'
                and errore_codice = 'interrotto' and preso_il > now() - interval '30 minutes') then
    raise exception 'Il ponte potrebbe stare ancora lavorando su questo documento fiscale: guarda il registratore e riprova fra mezz''ora.';
  end if;
  update lavori_stampa
     set stato = 'annullato', finito_il = now(),
         errore_testo = case when tipo in ('scontrino', 'annullo', 'chiusura')
                             then 'Annullato dal titolare dopo aver guardato il registratore.'
                             else errore_testo end
   where id = p_id
     and (stato in ('in_coda', 'incerto') or (stato = 'fallito' and tipo in ('scontrino', 'annullo', 'chiusura')));
  if not found then
    raise exception 'Questo lavoro non si può più annullare: o è già finito, o il ponte lo sta stampando adesso.';
  end if;
end $function$;

revoke all on function public.annulla_lavoro_stampa(uuid) from public, anon, authenticated;
grant execute on function public.annulla_lavoro_stampa(uuid) to authenticated;

-- I documenti fiscali restano per sempre; il resto del battito è quello
-- del 20261104000001.
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
  -- Scontrini, annulli e chiusure restano per sempre.
  delete from lavori_stampa
   where tipo not in ('scontrino', 'annullo', 'chiusura')
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

-- rete-guardie: registratore_con_scontrini_non_si_cancella — il rifiuto «ha emesso scontrini» diventa «ha emesso documenti fiscali»: lo stesso divieto, ora anche per annulli e chiusure
-- ⚠️ `security definer`: legge la coda qualunque sia chi cancella, anche
--    chi per la RLS non la vedrebbe (revisione del database, 04/11).
create or replace function public.registratore_con_scontrini_non_si_cancella()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if exists (select 1 from lavori_stampa
              where dispositivo_id = old.id and tipo in ('scontrino', 'annullo', 'chiusura')) then
    raise exception '«%» ha emesso documenti fiscali: non si cancella, si spegne.', old.nome;
  end if;
  return old;
end $function$;

revoke all on function public.registratore_con_scontrini_non_si_cancella() from public, anon, authenticated;

-- 🔴 E NEMMENO CANCELLANDO IL CONTO (revisione del database, 04/11): i
--    lavori seguono anche il conto (`order_id ... on delete cascade`), e il
--    titolare può cancellare un conto dalle API. Un conto con documenti
--    fiscali non si cancella; i conti di prova degli script non ne hanno.
create or replace function public.conto_con_scontrini_non_si_cancella()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if exists (select 1 from lavori_stampa
              where order_id = old.id and tipo in ('scontrino', 'annullo')) then
    raise exception 'Il conto «%» ha uno scontrino fiscale: non si cancella.', old.table_label;
  end if;
  return old;
end $function$;

revoke all on function public.conto_con_scontrini_non_si_cancella() from public, anon, authenticated;

drop trigger if exists conto_con_scontrini_non_si_cancella on orders;
create trigger conto_con_scontrini_non_si_cancella
  before delete on orders
  for each row execute function conto_con_scontrini_non_si_cancella();

-- ---------------------------------------------------------------------
-- 4. Annullare uno scontrino
-- ---------------------------------------------------------------------
-- Il riferimento che il registratore vuole (manuale §5.6.2):
-- «VOID zzzz nnnn ggmmaaaa matricola». NULL se i dati non bastano.
create or replace function public.riferimento_annullo(p_esito jsonb, p_matricola text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_esito->'scontrino'->>'chiusura' ~ '^\d{1,4}$'
     and p_esito->'scontrino'->>'numero' ~ '^\d{1,4}$'
     -- ⚠️ `case` e non `and`: Postgres non promette l'ordine di un `and`,
     --    e il numero si legge solo dopo che la forma è giusta.
     and case when p_esito->'scontrino'->>'data' ~ '^\d{1,2}/\d{1,2}/\d{4}$'
              then split_part(p_esito->'scontrino'->>'data', '/', 1)::int between 1 and 31
               and split_part(p_esito->'scontrino'->>'data', '/', 2)::int between 1 and 12
              else false end
     and p_matricola ~ '^[0-9A-Z]{11}$'
    then 'VOID ' || lpad(p_esito->'scontrino'->>'chiusura', 4, '0')
      || ' ' || lpad(p_esito->'scontrino'->>'numero', 4, '0')
      || ' ' || lpad(split_part(p_esito->'scontrino'->>'data', '/', 1), 2, '0')
             || lpad(split_part(p_esito->'scontrino'->>'data', '/', 2), 2, '0')
             || split_part(p_esito->'scontrino'->>'data', '/', 3)
      || ' ' || p_matricola
  end
$function$;

revoke all on function public.riferimento_annullo(jsonb, text) from public, anon, authenticated;

create or replace function public.accoda_annullo(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order orders%rowtype;
  v_s     lavori_stampa%rowtype;
  v_disp  dispositivi%rowtype;
  v_rif   text;
  v_id    uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può annullare uno scontrino.';
  end if;
  perform scadi_lavori_abbandonati();

  -- Il conto si blocca: due tocchi insieme passano uno alla volta.
  select * into v_order from orders where id = p_order for update;
  if v_order.id is null then
    raise exception 'Questo conto non c''è più: ricarica la pagina.';
  end if;

  select * into v_s from lavori_stampa
   where order_id = p_order and tipo = 'scontrino' and stato <> 'annullato';
  if v_s.id is null then
    raise exception 'Questo conto non ha uno scontrino da annullare.';
  end if;
  -- 🔴 Mai annullare uno scontrino che non è uscito di sicuro.
  if v_s.stato <> 'stampato' then
    raise exception 'Lo scontrino di questo conto non è uscito di sicuro (%): non si annulla. Guarda il registratore.', v_s.stato;
  end if;
  if exists (select 1 from lavori_stampa where scontrino_id = v_s.id and tipo = 'annullo' and stato <> 'annullato') then
    raise exception 'L''annullo di questo scontrino è già stato chiesto: guarda come è andato, non rifarlo.';
  end if;

  select * into v_disp from dispositivi where id = v_s.dispositivo_id;
  if v_disp.id is null or not v_disp.attivo then
    raise exception 'Il registratore che ha emesso questo scontrino è spento nel gestionale: accendilo dalla pagina Stampanti.';
  end if;
  if v_disp.matricola is null then
    raise exception 'Manca la matricola del registratore: scrivila nella pagina Stampanti (è stampata in fondo allo scontrino).';
  end if;
  if v_s.esito->'scontrino'->>'matricola' is not null and v_s.esito->'scontrino'->>'matricola' <> v_disp.matricola then
    raise exception 'La matricola scritta nel gestionale non è quella che il registratore ha messo sullo scontrino: correggila nella pagina Stampanti.';
  end if;
  v_rif := riferimento_annullo(v_s.esito, v_disp.matricola);
  if v_rif is null then
    raise exception 'Mancano numero, data o chiusura di questo scontrino: annullalo a mano dal registratore.';
  end if;

  begin
    insert into lavori_stampa (dispositivo_id, tipo, order_id, scontrino_id, contenuto)
    values (v_disp.id, 'annullo', p_order, v_s.id,
            v_s.contenuto || jsonb_build_object('riferimento', v_rif))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'L''annullo di questo scontrino è già stato chiesto: guarda come è andato, non rifarlo.';
  end;
  return v_id;
end $function$;

revoke all on function public.accoda_annullo(uuid) from public, anon, authenticated;
grant execute on function public.accoda_annullo(uuid) to authenticated;
comment on function public.accoda_annullo(uuid) is
  'Accoda l''annullo dello scontrino uscito di un conto. Solo il titolare, al massimo uno per scontrino (indice lavori_stampa_un_annullo_per_scontrino).';

-- ---------------------------------------------------------------------
-- 5. La chiusura giornaliera
-- ---------------------------------------------------------------------
create or replace function public.chiedi_chiusura(p_dispositivo uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_disp dispositivi%rowtype;
  v_id   uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può fare la chiusura giornaliera.';
  end if;
  perform scadi_lavori_abbandonati();

  select * into v_disp from dispositivi where id = p_dispositivo;
  if v_disp.id is null or v_disp.tipo <> 'registratore_fiscale' then
    raise exception 'La chiusura giornaliera si fa solo sul registratore.';
  end if;
  if not v_disp.attivo then
    raise exception '«%» è spento nel gestionale: accendilo prima.', v_disp.nome;
  end if;
  if exists (select 1 from lavori_stampa where dispositivo_id = p_dispositivo and tipo = 'chiusura'
                                         and stato = 'incerto') then
    raise exception 'L''ultima chiusura giornaliera è incerta: guarda il registratore, e se non è uscita toglila dalla pagina Stampanti prima di rifarla.';
  end if;
  if exists (select 1 from lavori_stampa where dispositivo_id = p_dispositivo and tipo = 'chiusura'
                                         and stato in ('in_coda', 'in_corso')) then
    raise exception 'Una chiusura giornaliera è già in corso: aspetta che finisca.';
  end if;

  begin
    insert into lavori_stampa (dispositivo_id, tipo, contenuto)
    values (p_dispositivo, 'chiusura', '{}'::jsonb)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Una chiusura giornaliera è già in corso: aspetta che finisca.';
  end;
  return v_id;
end $function$;

revoke all on function public.chiedi_chiusura(uuid) from public, anon, authenticated;
grant execute on function public.chiedi_chiusura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Cosa vede chi chiude il conto, e cosa vede il titolare
-- ---------------------------------------------------------------------
create or replace function public.stato_scontrino(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_l lavori_stampa%rowtype;
  v_a lavori_stampa%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  select * into v_l from lavori_stampa
   where order_id = p_order and tipo = 'scontrino'
   order by (stato <> 'annullato') desc, creato_il desc
   limit 1;
  if v_l.id is not null then
    select * into v_a from lavori_stampa
     where scontrino_id = v_l.id and tipo = 'annullo'
     order by (stato <> 'annullato') desc, creato_il desc
     limit 1;
  end if;
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
        when 'stampato' then case when v_a.stato = 'stampato' then 'Scontrino annullato.' else 'Scontrino emesso.' end
        when 'incerto' then 'Mandato, ma la risposta non è arrivata: forse è uscito, forse no. Guarda il registratore prima di rifarlo.'
        when 'fallito' then 'Non è uscito: ' || coalesce(frase_di_stampa(v_l.errore_codice), 'il registratore non l''ha emesso.') || ' Per rifarlo, il titolare lo annulla dalla pagina Stampanti.'
        when 'annullato' then 'Annullato.'
      end) end,
    'annullo', case when v_a.id is null then null else jsonb_build_object(
      'stato', v_a.stato,
      'numero', v_a.esito->'annullo'->>'numero',
      'data', v_a.esito->'annullo'->>'data',
      'frase', case v_a.stato
        when 'in_coda' then 'Annullo in coda: il ponte lo manda al registratore.'
        when 'in_corso' then 'Il registratore sta facendo l''annullo.'
        when 'stampato' then 'Scontrino annullato.'
        when 'incerto' then 'Annullo mandato, ma la risposta non è arrivata: guarda il registratore prima di rifarlo.'
        when 'fallito' then 'L''annullo non è riuscito. Guarda il registratore.'
        when 'annullato' then 'Annullo tolto dalla coda.'
      end) end);
end $function$;

revoke all on function public.stato_scontrino(uuid) from public, anon, authenticated;
grant execute on function public.stato_scontrino(uuid) to authenticated;

-- Gli ultimi scontrini, per il titolare nella pagina Stampanti: da qui si
-- annullano.
create or replace function public.scontrini_recenti(p_limite integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare vede gli scontrini.';
  end if;
  return coalesce((
    select jsonb_agg(x.riga order by x.creato_il desc)
      from (
        select s.creato_il, jsonb_build_object(
                 'order_id', s.order_id,
                 'tavolo', o.table_label,
                 'stato', s.stato,
                 'totale', s.contenuto->'totale',
                 'numero', s.esito->'scontrino'->>'numero',
                 'data', s.esito->'scontrino'->>'data',
                 'ora', s.esito->'scontrino'->>'ora',
                 'chiusura', s.esito->'scontrino'->>'chiusura',
                 'riferimento', riferimento_annullo(s.esito, d.matricola),
                 'annullo', (select jsonb_build_object('stato', a.stato, 'numero', a.esito->'annullo'->>'numero',
                                                       'errore', a.errore_testo)
                               from lavori_stampa a
                              where a.scontrino_id = s.id and a.tipo = 'annullo'
                              order by (a.stato <> 'annullato') desc, a.creato_il desc limit 1)) as riga
          from lavori_stampa s
          join orders o on o.id = s.order_id
          join dispositivi d on d.id = s.dispositivo_id
         where s.tipo = 'scontrino' and s.stato <> 'annullato'
         order by s.creato_il desc
         limit greatest(1, least(coalesce(p_limite, 20), 50))
      ) x), '[]'::jsonb);
end $function$;

revoke all on function public.scontrini_recenti(integer) from public, anon, authenticated;
grant execute on function public.scontrini_recenti(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Verifica
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
  v_scontr   uuid;
  v_annullo  uuid;
  v_z        uuid;
  v_r        jsonb;
  v_ok       boolean;
  v_titolare_claims text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles, e un''entità.';
  end if;
  v_titolare_claims := json_build_object('sub', v_titolare, 'role', 'authenticated')::text;

  if has_function_privilege('anon', 'accoda_annullo(uuid)', 'execute')
     or has_function_privilege('anon', 'chiedi_chiusura(uuid)', 'execute')
     or has_function_privilege('anon', 'scontrini_recenti(integer)', 'execute')
     or has_function_privilege('authenticated', 'riferimento_annullo(jsonb, text)', 'execute') then
    raise exception 'VERIFICA: i permessi di annullo e chiusura non sono quelli dichiarati.';
  end if;

  -- (0) Il riferimento ha la forma del manuale.
  if riferimento_annullo('{"scontrino":{"numero":"14","data":"4/11/2026","chiusura":"1627"}}', '99IEC123456')
     <> 'VOID 1627 0014 04112026 99IEC123456'
     or riferimento_annullo('{"scontrino":{"numero":"14","data":"4/11/2026"}}', '99IEC123456') is not null then
    raise exception 'VERIFICA (0): il riferimento dell''annullo non ha la forma del manuale.';
  end if;

  begin
    update dispositivi set attivo = false where attivo;
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta)
    values ('ZZ registratore della verifica', 'registratore_fiscale', 'simulatore', '127.0.0.1', 19193)
    returning id into v_disp;

    insert into orders (entity_id, table_label, status, coperti)
    values (v_ente, 'ZZ tavolo dell''annullo', 'aperto', 0) returning id into v_ordine;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ calice', 'bar', 1, 5);
    update order_items set sent_at = now() where order_id = v_ordine;

    perform set_config('request.jwt.claims', v_titolare_claims, true);
    perform close_order_paid(v_ordine, 'contante', 0, null, false);
    v_scontr := accoda_scontrino(v_ordine);
    v_k := crea_chiave_ponte('ZZ ponte dell''annullo');

    -- (1) Uno scontrino in coda non si annulla.
    v_ok := false;
    begin
      perform accoda_annullo(v_ordine);
    exception when others then v_ok := sqlerrm like '%non è uscito di sicuro%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (1): si è potuto annullare uno scontrino non ancora uscito.';
    end if;

    -- (2) Uscito, ma senza matricola: non si annulla e lo dice.
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_scontr, 'stampato', null, null, 'pronto',
      '{"scontrino":{"numero":"14","data":"4/11/2026","ora":"9:33","chiusura":"1627"}}'::jsonb);
    perform set_config('request.jwt.claims', v_titolare_claims, true);
    v_ok := false;
    begin
      perform accoda_annullo(v_ordine);
    exception when others then v_ok := sqlerrm like '%matricola%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (2): l''annullo senza matricola non si è fermato.';
    end if;

    -- (3) Il titolare scrive la matricola come dalla pagina Stampanti; poi
    --     un annullo, col riferimento giusto; il secondo no.
    set local role authenticated;
    update dispositivi set matricola = '99IEC123456' where id = v_disp;
    reset role;
    if (select matricola from dispositivi where id = v_disp) is distinct from '99IEC123456' then
      raise exception 'VERIFICA (3): il titolare non è riuscito a scrivere la matricola.';
    end if;
    v_annullo := accoda_annullo(v_ordine);
    if (select contenuto->>'riferimento' from lavori_stampa where id = v_annullo) <> 'VOID 1627 0014 04112026 99IEC123456'
       or (select jsonb_array_length(contenuto->'righe') from lavori_stampa where id = v_annullo) <> 1 then
      raise exception 'VERIFICA (3a): l''annullo non porta il riferimento e le righe dello scontrino.';
    end if;
    v_ok := false;
    begin
      perform accoda_annullo(v_ordine);
    exception when others then v_ok := sqlerrm like '%già stato chiesto%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (3b): un secondo annullo dello stesso scontrino è entrato in coda.';
    end if;
    perform set_config('request.jwt.claims', null, true);
    v_ok := false;
    begin
      insert into lavori_stampa (dispositivo_id, tipo, order_id, scontrino_id)
      values (v_disp, 'annullo', v_ordine, v_scontr);
    exception when unique_violation then v_ok := true;
    end;
    if not v_ok then
      raise exception 'VERIFICA (3c): l''indice non ferma un secondo annullo.';
    end if;

    -- (4) Lo staff non annulla e non chiude la giornata.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_ok := false;
    begin
      perform accoda_annullo(v_ordine);
    exception when others then v_ok := sqlerrm like '%Solo il titolare%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (4a): lo staff ha potuto chiedere un annullo.';
    end if;
    v_ok := false;
    begin
      perform chiedi_chiusura(v_disp);
    exception when others then v_ok := sqlerrm like '%Solo il titolare%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (4b): lo staff ha potuto chiedere la chiusura giornaliera.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (5) Il ponte manda l'annullo, nessuna risposta: incerto, non torna in coda.
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or v_r->0->>'tipo' <> 'annullo' then
      raise exception 'VERIFICA (5a): il ponte non ha preso l''annullo: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_annullo, 'incerto', 'risposta_a_meta', 'nessuna risposta', 'errore', '{}');
    if jsonb_array_length(ponte_prendi_lavori(v_k->>'chiave', 5)) <> 0 then
      raise exception 'VERIFICA (5b): un annullo incerto è tornato in coda da solo.';
    end if;

    -- (6) Il titolare guarda e lo toglie; il secondo annullo esce e il conto
    --     dice «scontrino annullato».
    perform set_config('request.jwt.claims', v_titolare_claims, true);
    perform annulla_lavoro_stampa(v_annullo);
    v_annullo := accoda_annullo(v_ordine);
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_annullo, 'stampato', null, null, 'pronto',
      '{"annullo":{"numero":"15","data":"4/11/2026"}}'::jsonb);
    perform set_config('request.jwt.claims', v_titolare_claims, true);
    v_r := stato_scontrino(v_ordine);
    if v_r->'lavoro'->>'frase' <> 'Scontrino annullato.' or v_r->'annullo'->>'numero' <> '15' then
      raise exception 'VERIFICA (6a): il conto non dice «scontrino annullato»: %.', v_r;
    end if;
    v_r := scontrini_recenti(5);
    if not exists (select 1 from jsonb_array_elements(v_r) e
                    where (e->>'order_id')::uuid = v_ordine and e->'annullo'->>'stato' = 'stampato') then
      raise exception 'VERIFICA (6b): gli scontrini recenti non mostrano l''annullo: %.', v_r;
    end if;

    -- (6c) Il conto con lo scontrino non si cancella.
    v_ok := false;
    begin
      delete from orders where id = v_ordine;
    exception when others then v_ok := sqlerrm like '%non si cancella%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (6c): il conto con lo scontrino si è potuto cancellare.';
    end if;

    -- (7) La chiusura giornaliera: una sola in coda, poi esce.
    v_z := chiedi_chiusura(v_disp);
    v_ok := false;
    begin
      perform chiedi_chiusura(v_disp);
    exception when others then v_ok := sqlerrm like '%già in corso%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (7a): una seconda chiusura giornaliera è entrata in coda.';
    end if;
    perform set_config('request.jwt.claims', null, true);
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or v_r->0->>'tipo' <> 'chiusura' then
      raise exception 'VERIFICA (7b): il ponte non ha preso la chiusura: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_z, 'stampato', null, null, 'pronto', '{"chiusura":{"chiusura":"1628"}}'::jsonb);
    perform set_config('request.jwt.claims', v_titolare_claims, true);
    v_z := chiedi_chiusura(v_disp);
    if v_z is null then
      raise exception 'VERIFICA (7c): dopo una chiusura finita non se ne può chiedere un''altra.';
    end if;
    -- (7d) Quella dopo resta senza risposta: incerta, e blocca la terza.
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    perform ponte_esito_lavoro(v_k->>'chiave', v_z, 'incerto', 'risposta_a_meta', 'nessuna risposta', 'errore', '{}');
    perform set_config('request.jwt.claims', v_titolare_claims, true);
    v_ok := false;
    begin
      perform chiedi_chiusura(v_disp);
    exception when others then v_ok := sqlerrm like '%incerta%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (7d): con una chiusura incerta se n''è potuta chiedere un''altra.';
    end if;
    perform set_config('request.jwt.claims', null, true);

    -- (8) I documenti fiscali vecchi non li cancella il battito.
    update lavori_stampa set finito_il = now() - interval '400 days'
     where dispositivo_id = v_disp and tipo in ('annullo', 'chiusura') and finito_il is not null;
    perform ponte_battito(v_k->>'chiave', 'verifica', 'verifica');
    if (select count(*) from lavori_stampa where dispositivo_id = v_disp and tipo in ('annullo', 'chiusura')) <> 4 then
      raise exception 'VERIFICA (8): il battito del ponte ha cancellato un annullo o una chiusura.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''annullo e della chiusura');

  raise notice 'Fatto: il riferimento ha la forma del manuale; si annulla solo uno scontrino uscito, con la matricola, una volta sola (anche scrivendo nella tabella), e solo il titolare; un annullo incerto non torna in coda; il conto dice «scontrino annullato»; una chiusura giornaliera alla volta; il battito non cancella i documenti fiscali. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000002', 'l_annullo_e_la_chiusura_giornaliera')
on conflict (version) do nothing;
