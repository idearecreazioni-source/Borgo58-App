-- =====================================================================
-- I DUE CONTI DI PROVA RIMASTI APERTI SI ANNULLANO — non si chiudono
-- 19/08/2026
-- =====================================================================
-- Richiesta di Alessio, dopo che il rimisuramento dell'elenco dei dati di
-- collaudo ha trovato **due conti ancora aperti** dal 18/08 (T1 e T6),
-- mentre gli appunti dicevano che non ce n'erano piu'.
--
-- 🔴 ANNULLATI, NON CHIUSI, ed e' la cosa da non sbagliare. **Chiudere un
-- conto scrive un incasso**; in produzione oggi ci sono **zero movimenti di
-- cassa**, ed e' la proprieta' che ha reso questi lavori a costo zero e che
-- serve ancora per il collaudo generale. Chiuderli la butterebbe via per
-- due conti finti. Un conto annullato invece, per tutto il resto del
-- gestionale, e' un conto che non e' mai esistito: non incassa e non
-- scarica magazzino (regola del 13/08).
--
-- ⚠️ E SI TOCCA DA UNA MIGRAZIONE, non con una query a mano: sono dati veri
-- del locale, e il Contratto non fa eccezioni per «sono solo due righe di
-- prova». La migrazione dichiara cosa tocca, controlla di non aver toccato
-- altro, e resta nel repository.
--
-- ⚠️ IL PERIMETRO E' UNA PROPRIETA', NON DUE IDENTIFICATIVI: «i conti
-- rimasti aperti da PRIMA di oggi». Scrivere i due `id` sarebbe un fossile —
-- e sarebbe anche una migrazione che, riapplicata su un altro database, non
-- fa niente senza dirlo. Cosi' invece la regola resta leggibile: *un conto
-- aperto da ieri non e' un conto, e' un residuo.*
--
-- ⚠️ E SI FERMA SE TROVA QUALCOSA CHE NON E' UN RESIDUO: un conto aperto
-- vecchio ma con dei pagamenti sopra, o con uno sconto/omaggio collegato,
-- non e' roba di collaudo — li' la migrazione rifiuta invece di decidere.
-- =====================================================================

do $annulla$
declare
  v_confine   timestamptz := (date '2026-08-19')::timestamp at time zone 'Europe/Rome';
  v_residui   integer;
  v_sospetti  integer;
  v_mov_p     integer;
  v_mov_d     integer;
  v_scar_p    integer;
  v_scar_d    integer;
  v_lap_p     integer;
  v_lap_d     integer;
  v_quali     text;
begin
  select count(*) into v_mov_p  from cash_movements;
  select count(*) into v_scar_p from stock_consumptions;
  select count(*) into v_lap_p  from deleted_records;

  -- Chi non e' un residuo: aperto da prima del confine, ma con dei soldi
  -- sopra. Se ce n'e' anche uno solo, non si tocca niente.
  select count(*) into v_sospetti
    from orders o
   where o.status = 'aperto'
     and o.created_at < v_confine
     and (o.discount_gift_id is not null
          or exists (select 1 from order_payments p where p.order_id = o.id));
  if v_sospetti > 0 then
    raise exception
      'Ci sono % conti aperti da prima di oggi con dei pagamenti o uno sconto sopra: non sono residui di collaudo, e non li tocco.',
      v_sospetti;
  end if;

  select count(*), string_agg(o.table_label || ' del ' ||
           to_char(o.created_at at time zone 'Europe/Rome', 'DD/MM alle HH24:MI'), ', ')
    into v_residui, v_quali
    from orders o
   where o.status = 'aperto' and o.created_at < v_confine;

  -- ⚠️ SI DICHIARA QUANTE RIGHE TOCCA, anche quando sono zero (regola del
  -- 16/08): uno zero vuol dire «gia' fatto» o «questo database non li
  -- aveva», e va detto invece che taciuto.
  raise notice 'Conti di prova rimasti aperti: % (%).', v_residui, coalesce(v_quali, 'nessuno');

  update orders
     set status        = 'annullato',
         cancel_reason = 'Conto di collaudo rimasto aperto, annullato dalla migrazione 20260819000011',
         closed_at     = now()
   where status = 'aperto' and created_at < v_confine;

  -- =========== I CONTROLLI ===========
  -- 1 · Non resta nessun residuo.
  select count(*) into v_residui from orders
   where status = 'aperto' and created_at < v_confine;
  if v_residui <> 0 then
    raise exception 'Restano % conti di prova aperti.', v_residui;
  end if;

  -- 2 · LA PROPRIETA' CHE VALE PIU' DI TUTTE: non e' entrato nessun euro.
  --     E' la ragione per cui si annulla invece di chiudere, e va
  --     controllata invece che sperata.
  select count(*) into v_mov_d from cash_movements;
  if v_mov_d <> v_mov_p then
    raise exception 'I movimenti di cassa sono passati da % a %: annullare un conto non deve scrivere niente in prima nota.',
      v_mov_p, v_mov_d;
  end if;

  -- 3 · E non e' uscita merce: un conto annullato non scarica il magazzino
  --     (decisione di Alessio del 13/08).
  select count(*) into v_scar_d from stock_consumptions;
  if v_scar_d <> v_scar_p then
    raise exception 'Gli scarichi di magazzino sono passati da % a %: un conto annullato non deve scaricare niente.',
      v_scar_p, v_scar_d;
  end if;

  -- 4 · E il registro delle cancellazioni non si e' mosso: qui non si
  --     cancella niente, si cambia uno stato.
  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lap_p, v_lap_d;
  end if;

  raise notice 'I conti di prova rimasti aperti sono annullati, e nessun euro e'' entrato.';
end $annulla$;

insert into applied_migrations (version, name)
values ('20260819000011', 'i_conti_di_prova_si_annullano')
on conflict (version) do nothing;
