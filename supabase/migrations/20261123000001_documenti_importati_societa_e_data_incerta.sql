-- 23/11/2026 — Revisione generale di work, punti 1 e 3: i documenti importati dal Drive.
--
-- 1. I 27 documenti importati il 22/11 non hanno nessuna società: le proposte della Scheda (`scheda_proposte_calcola`)
--    guardano solo i documenti di Borgo 58 S.r.l.s., quindi i contratti nuovi non diventano mai una proposta.
--    L'import ora mette la società di partenza (codice della pagina); qui si sistemano quelli GIÀ caricati.
-- 3. Una data presa dall'ultima modifica del file («10/10/2026 (modifica)» nella mappa) è un punto di partenza, non la
--    data del documento. Nell'anteprima c'era «da verificare», ma nel database il segno non restava: MEMO la presentava
--    come certa. Ora il segno si salva sul documento (`data_incerta`), la pagina lo mostra e MEMO lo legge.
--
-- ⚠️ Solo UI + database: nessuna funzione cloud toccata qui. Il testo di MEMO (memo-chat) è un rilascio a parte.

-- ⚠️ Il nome NON contiene «verifica»: le prove cercano le lapidi di verifica con `record::text ilike '%verifica%'`, e il nome di una
--    colonna finisce in OGNI lapide di documento cancellato (la riga è salvata intera).
alter table documents add column if not exists data_incerta boolean not null default false;

comment on column documents.data_incerta is
  'La data del documento è un punto di partenza (per esempio l''ultima modifica del file importato), non quella vera: la pagina la segnala e MEMO dice «data non sicura». Si spegne da solo quando qualcuno cambia la data, o col pulsante «La data è giusta».';

-- Chi cambia la data di un documento l'ha guardata: il segno si spegne, a meno che lo stesso aggiornamento lo scriva
-- apertamente (per esempio per riaccenderlo). Un aggiornamento che non tocca la data non lo cambia.
create or replace function documenti_data_verificata()
returns trigger language plpgsql set search_path = public as $funzione$
begin
  if new.document_date is distinct from old.document_date
     and new.data_incerta is not distinct from old.data_incerta then
    new.data_incerta := false;
  end if;
  return new;
end $funzione$;
-- Una funzione-trigger non deve poterla chiamare nessuno a mano (le prove dei permessi contano le funzioni aperte).
revoke all on function documenti_data_verificata() from public, anon, authenticated;

drop trigger if exists documenti_data_verificata on documents;
create trigger documenti_data_verificata before update of document_date on documents
  for each row execute function documenti_data_verificata();

-- La lettura della chat (`leggi_documenti`): stesso corpo vivo della 20261122000001, più il segno.
-- rete-guardie: memo_leggi_documenti — il campo si chiama ora data_incerta (il nome con «verifica» sporcava le lapidi di prova; mai arrivato su work)
create or replace function memo_leggi_documenti(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $funzione$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  with righe as (
    select d.id, d.title, d.amount, d.document_date as ord1, d.created_at as ord2,
           jsonb_build_object('tipo', d.doc_type, 'controparti', d.counterparties,
             'importo', d.amount, 'data_documento', d.document_date,
             'data_incerta', d.data_incerta,
             'data_scadenza', d.expiry_date, 'nome_file', d.file_name,
             'ha_file', d.storage_path is not null, 'nota', d.note) as dettaglio
      from documents d
     where not d.no_ai
       and (p_cerca is null
        or d.title ilike '%' || p_cerca || '%'
        or coalesce(d.doc_type, '') ilike '%' || p_cerca || '%'
        or coalesce(d.counterparties, '') ilike '%' || p_cerca || '%')
  ) select id, title, dettaglio, count(*) over ()::integer, coalesce(sum(amount) over (), 0) from righe
   order by ord1 desc nulls last, ord2 desc, id limit 150;
end $funzione$;

revoke all on function memo_leggi_documenti(text) from public, anon, authenticated;
grant execute on function memo_leggi_documenti(text) to authenticated;

-- I documenti GIÀ importati.
-- (a) La società: solo quelli di un lotto d'import che ancora non ne hanno una.
update documents
   set entity_id = (select id from entities where entity_type = 'srls' order by id limit 1)
 where lotto_import_id is not null
   and entity_id is null
   and exists (select 1 from entities where entity_type = 'srls');

-- (b) Le date incerte: la revisione del 23/11 ha trovato su work 14 documenti importati col 10/10/2026 e 4 col
--     17/05/2026, quasi certamente date di modifica del file. Si segnano. Se uno dei due giorni fosse vero, basta il
--     pulsante «La data è giusta». Su Prova non ci sono documenti di questo tipo: non cambia niente.
update documents
   set data_incerta = true
 where lotto_import_id is not null
   and document_date in (date '2026-10-10', date '2026-05-17');

-- VERIFICA: se qualcosa non è come dichiarato, la migrazione si ferma con un errore.
do $verifica$
declare
  v_id uuid;
  v_dopo boolean;
  v_srls uuid;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'documents' and column_name = 'data_incerta') then
    raise exception 'VERIFICA (1): manca la colonna documents.data_incerta.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'documenti_data_verificata' and not tgisinternal) then
    raise exception 'VERIFICA (2): manca il trigger che spegne il segno quando la data cambia.';
  end if;
  if pg_get_functiondef('public.memo_leggi_documenti(text)'::regprocedure) not like '%data_incerta%' then
    raise exception 'VERIFICA (3): memo_leggi_documenti non legge il segno.';
  end if;

  -- (4) Nessun documento importato resta senza società (se la società c'è).
  select id into v_srls from entities where entity_type = 'srls';
  if v_srls is not null and exists (select 1 from documents where lotto_import_id is not null and entity_id is null) then
    raise exception 'VERIFICA (4): ci sono ancora documenti importati senza società.';
  end if;

  -- (5) Il comportamento del segno, in un blocco annullato (zero residui).
  begin
    insert into documents (title, doc_type, document_date, data_incerta)
    values ('ZZ verifica data da verificare', 'contratti', date '2026-10-10', true)
    returning id into v_id;
    update documents set note = 'x' where id = v_id;
    select data_incerta into v_dopo from documents where id = v_id;
    if v_dopo is not true then raise exception 'VERIFICA (5a): cambiare un''altra cosa ha spento il segno.'; end if;
    update documents set document_date = date '2026-09-01' where id = v_id;
    select data_incerta into v_dopo from documents where id = v_id;
    if v_dopo is not false then raise exception 'VERIFICA (5b): cambiare la data non ha spento il segno.'; end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  if exists (select 1 from documents where title = 'ZZ verifica data da verificare') then
    raise exception 'VERIFICA (5c): resta un documento di verifica.';
  end if;

  raise notice 'Fatto: i documenti importati sono collegati a Borgo 58 S.r.l.s.; il segno «data da verificare» si salva, si spegne cambiando la data e MEMO lo legge. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261123000001', 'documenti_importati_societa_e_data_incerta')
on conflict (version) do nothing;
