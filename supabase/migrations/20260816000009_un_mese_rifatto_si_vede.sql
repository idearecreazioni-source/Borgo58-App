-- =====================================================================
-- Un mese rifatto si vede
-- =====================================================================
-- Blocco 5 del mandato di correzione (16/08/2026), la parte che tocca il
-- database. Il resto del blocco — le conferme sulle azioni distruttive e
-- le vie di ritorno — vive nelle schermate e non qui.
--
-- IL VICOLO CIECO: `cancellaConsuntivo` esiste nel codice del sito e
-- nessuna schermata la chiama. Un mese fotografato per sbaglio restava
-- fotografato, e il trigger `vieta_riscrittura_consuntivo` impedisce di
-- ricalcolarlo — dice testualmente «se e' sbagliato si cancella e si
-- richiude», ma da nessuna parte si poteva cancellare.
--
-- LA CONDIZIONE DI ALESSIO, che cambia la forma della cura (16/08/2026):
--
--   *«Un mese rifatto deve vedersi. Se la fotografia di aprile viene
--   cancellata e rifatta, la schermata deve dire che quel mese e' stato
--   rifatto e quando — altrimenti un numero che cambia passa in silenzio,
--   che e' la famiglia di difetti contro cui e' nato tutto questo lavoro.»*
--
-- E: *«due gesti separati, non "cancella e rifai" in un colpo solo: prima
-- si cancella, poi si rifotografa. Cosi' non si sovrascrive per inerzia.»*
--
-- Quindi non basta aprire la porta: la seconda fotografia deve PORTARE
-- ADDOSSO il fatto di essere una seconda. Il numero e il suo limite
-- viaggiano insieme — stessa forma dell'avvertenza di `calcola_imposte()`
-- e delle righe mai inviate del Blocco 4.
--
-- ⚠️ E il fatto NON si tiene con un contatore che qualcuno deve ricordarsi
-- di incrementare: si LEGGE dal registro delle cancellazioni, che e' gia'
-- il posto dove le fotografie cancellate finiscono (`consuntivi_mensili`
-- e' fra le tabelle sorvegliate). Un contatore separato sarebbe un secondo
-- posto dove vive la stessa verita', ed e' quello che questo mandato passa
-- il tempo a togliere.
--
-- ⚠️ Stato di partenza VERO, letto col connettore prima di scrivere: in
-- produzione ci sono **ZERO mesi chiusi**. Le colonne nuove nascono quindi
-- senza dover rispondere al posto di nessuno — e restano comunque
-- NULLABLE, perche' `null` qui vuol dire «non lo so» ed e' la risposta
-- vera per una riga arrivata da un ripristino vecchio (lezione del 14/08).
-- =====================================================================

alter table consuntivi_mensili
  add column if not exists chiusure_precedenti integer,
  add column if not exists prima_chiusura_il   timestamptz;

comment on column consuntivi_mensili.chiusure_precedenti is
  'Quante volte questo mese era gia'' stato fotografato e poi cancellato. 0 = e'' la prima. NULL = riga anteriore al 16/08/2026, quindi non lo sappiamo — e dirlo e'' meglio che scrivere zero.';

comment on column consuntivi_mensili.prima_chiusura_il is
  'Quando questo mese fu fotografato la PRIMA volta, se e'' stato rifatto. Serve a rispondere «da quando questo numero e'' cambiato».';

-- ---------------------------------------------------------------------
-- Chiudere un mese sa dire se e' la prima volta
-- ---------------------------------------------------------------------
create or replace function chiudi_mese(p_entity_id uuid, p_anno integer, p_mese integer, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m        record;
  v_id     uuid;
  v_prec   integer;
  v_prima  timestamptz;
begin
  if not is_titolare() then
    raise exception 'Chiudere un mese e'' riservato al titolare.';
  end if;

  if make_date(p_anno, p_mese, 1) + interval '1 month' > now() then
    raise exception 'Il % non e'' ancora finito: un consuntivo si scrive a mese chiuso, e non si potrebbe piu'' rifare.',
      to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  if exists (select 1 from consuntivi_mensili
              where entity_id = p_entity_id and anno = p_anno and mese = p_mese) then
    raise exception 'Il % e'' gia'' stato chiuso.', to_char(make_date(p_anno, p_mese, 1), 'MM/YYYY');
  end if;

  -- ⚠️ Quante volte questo stesso mese e' gia' stato fotografato e poi
  -- cancellato. Si legge dal registro delle cancellazioni invece di
  -- tenere un contatore da qualche parte: la verita' sta gia' li', e un
  -- contatore separato sarebbe un secondo posto da tenere allineato.
  select count(*), min((record->>'chiuso_il')::timestamptz)
    into v_prec, v_prima
    from deleted_records
   where table_name = 'consuntivi_mensili'
     and record->>'entity_id' = p_entity_id::text
     and (record->>'anno')::integer = p_anno
     and (record->>'mese')::integer = p_mese;

  select * into m from misure_del_mese(p_entity_id, p_anno, p_mese);

  insert into consuntivi_mensili (
    entity_id, anno, mese, chiuso_da,
    coperti, ricavi, food_cost, fissi, omaggi_costo, omaggi_quanti, conti_chiusi,
    origine_coperti, origine_ricavi, origine_food_cost, origine_fissi, note,
    chiusure_precedenti, prima_chiusura_il
  ) values (
    p_entity_id, p_anno, p_mese, auth.uid(),
    m.coperti, m.ricavi, m.food_cost, m.fissi, m.omaggi_costo, m.omaggi_quanti, m.conti_chiusi,
    m.origine_coperti, m.origine_ricavi, m.origine_food_cost, m.origine_fissi, p_note,
    coalesce(v_prec, 0), v_prima
  ) returning id into v_id;

  return v_id;
end;
$function$;

comment on function chiudi_mese is
  'Fotografa il mese finito, e dichiara se e'' una RIFOTOGRAFIA: quante volte quel mese era gia'' stato chiuso e cancellato, e quando lo fu la prima volta (16/08/2026, condizione di Alessio). Un numero che cambia senza dirlo e'' la famiglia di difetti contro cui e'' nato il mandato di correzione. Una sola tabella, quindi niente corridoio: e'' il calcolo che tocca mezzo gestionale, non la scrittura.';

revoke all on function chiudi_mese(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function chiudi_mese(uuid, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica sul campo (§5 punti 1-3)
-- ---------------------------------------------------------------------
-- ⚠️ Nessun gestore d'eccezione sul blocco esterno; perimetro fatto solo
-- di roba creata qui. Il mese usato e' **nel passato remoto e su
-- un'entita' vera ma con un anno che non esistera' mai come dato reale**:
-- `chiudi_mese` rifiuta i mesi non ancora finiti, quindi serve una data
-- passata, e 2019 e' prima che il locale esistesse.
do $verifica$
declare
  v_titolare uuid;
  e1 uuid;
  v_id1 uuid; v_id2 uuid;
  v_prec integer; v_prima timestamptz; v_chiuso1 timestamptz;
  respinto boolean;
  n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;

  -- 1. La PRIMA fotografia dichiara di essere la prima.
  v_id1 := chiudi_mese(e1, 2019, 3, '__PROVA B5__');
  select chiusure_precedenti, prima_chiusura_il, chiuso_il
    into v_prec, v_prima, v_chiuso1
    from consuntivi_mensili where id = v_id1;
  if v_prec is distinct from 0 then
    raise exception 'La prima fotografia dichiara % chiusure precedenti invece di 0.', v_prec;
  end if;
  if v_prima is not null then
    raise exception 'La prima fotografia dichiara una chiusura anteriore che non esiste.';
  end if;

  -- 2. Rifarla senza cancellarla e' respinto: due gesti separati, non uno.
  respinto := false;
  begin
    perform chiudi_mese(e1, 2019, 3, '__PROVA B5 bis__');
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Un mese gia'' chiuso si e'' lasciato rifotografare senza cancellarlo prima.';
  end if;

  -- 3. E ricalcolarlo resta impossibile: il sigillo del 14/08 non e' stato
  -- allentato da questa migrazione.
  respinto := false;
  begin
    update consuntivi_mensili set ricavi = 1 where id = v_id1;
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Un mese chiuso si e'' lasciato ricalcolare.';
  end if;

  -- 4. Cancellata e rifatta, la seconda fotografia LO DICHIARA.
  delete from consuntivi_mensili where id = v_id1;
  v_id2 := chiudi_mese(e1, 2019, 3, '__PROVA B5 rifatto__');
  select chiusure_precedenti, prima_chiusura_il
    into v_prec, v_prima
    from consuntivi_mensili where id = v_id2;
  if v_prec is distinct from 1 then
    raise exception 'La fotografia rifatta dichiara % chiusure precedenti invece di 1.', v_prec;
  end if;
  if v_prima is null then
    raise exception 'La fotografia rifatta non sa dire quando il mese fu chiuso la prima volta.';
  end if;
  if abs(extract(epoch from (v_prima - v_chiuso1))) > 1 then
    raise exception 'La data della prima chiusura non e'' quella vera: % invece di %.', v_prima, v_chiuso1;
  end if;

  -- 5. E un mese DIVERSO non eredita il conteggio del vicino.
  v_id1 := chiudi_mese(e1, 2019, 4, '__PROVA B5 altro mese__');
  select chiusure_precedenti into v_prec from consuntivi_mensili where id = v_id1;
  if v_prec is distinct from 0 then
    raise exception 'Un mese mai chiuso prima dichiara % chiusure precedenti.', v_prec;
  end if;

  -- PULIZIA. ⚠️ Anche il registro delle cancellazioni: girando come
  -- proprietaria, le lapidi della prova non devono restare a raccontare
  -- fotografie che non sono mai esistite.
  delete from consuntivi_mensili where id in (v_id1, v_id2);
  delete from deleted_records
   where table_name = 'consuntivi_mensili'
     and record->>'note' like '\_\_PROVA B5%';

  select count(*) into n from consuntivi_mensili where note like '\_\_PROVA B5%';
  if n <> 0 then raise exception 'La verifica ha lasciato % consuntivi.', n; end if;
  select count(*) into n from deleted_records
   where table_name = 'consuntivi_mensili' and record->>'note' like '\_\_PROVA B5%';
  if n <> 0 then raise exception 'La verifica ha lasciato % lapidi nel registro.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Blocco 5: un mese si puo'' rifare, e la seconda fotografia dice di esserlo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000009', 'un_mese_rifatto_si_vede')
on conflict (version) do nothing;

select
  (select count(*) from consuntivi_mensili)                                     as mesi_chiusi,
  (select count(*) from consuntivi_mensili where coalesce(chiusure_precedenti, 0) > 0) as mesi_rifatti,
  (select count(*) from deleted_records where table_name = 'consuntivi_mensili') as fotografie_cancellate;
