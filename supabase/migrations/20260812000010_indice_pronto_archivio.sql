-- ---------------------------------------------------------------------
-- L'indice dell'Archivio si tiene pronto, non si rifà a ogni domanda
-- ---------------------------------------------------------------------
-- Domanda di Alessio, 12/08/2026: «col passare del tempo si accumuleranno
-- molti dati nell'archivio. Ogni volta che farò una domanda l'assistente
-- dovrà leggere tutto per trovare la risposta?»
--
-- La risposta è no per la parte cara — il modello legge al massimo 12
-- documenti — ma era **sì per il database**, e in un modo che sarebbe
-- peggiorato in silenzio: `documenti_per_domanda()` costruiva il vettore
-- di ricerca di ogni documento **a ogni domanda**, dentro un `cross join
-- lateral`. Con quattro documenti non si misura. Con tremila, ogni
-- domanda rilegge da capo qualche decina di megabyte di testo per
-- decidere cosa è pertinente — prima ancora di chiamare l'AI.
--
-- Il difetto non si sarebbe mai manifestato come guasto: come lentezza
-- crescente, di quelle a cui ci si abitua un mese alla volta.
--
-- COSA CAMBIA
--
-- Il vettore di ricerca diventa una **colonna calcolata e conservata**
-- (`ricerca`): Postgres la aggiorna da sé quando il documento cambia, e
-- la domanda si limita a confrontare. Il lavoro si paga una volta,
-- quando il documento entra, invece che a ogni domanda per sempre.
--
-- Il comportamento resta identico — stesse colonne, stesso ordine, stessa
-- rilevanza — e la verifica in fondo lo dimostra confrontando i risultati
-- prima e dopo su documenti veri.
--
-- L'INDICE VECCHIO SE NE VA. `idx_documents_testo` copriva il solo
-- `testo` e non è mai stato usato da nessuna query: la ricerca guarda
-- anche titolo, tipo, controparte e note. Tenerlo significherebbe pagarne
-- l'aggiornamento a ogni scrittura senza che nessuno lo legga.
--
-- ⚠️ `expiry_date` e gli altri campi NON entrano nel vettore: sono date e
-- numeri, e cercarli come parole darebbe corrispondenze a caso. Le
-- domande sulle scadenze si rispondono con le schede, che il modello
-- riceve sempre tutte.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. La colonna calcolata
-- ---------------------------------------------------------------------
-- `to_tsvector(regconfig, text)` con la lingua scritta a mano è
-- immutabile, ed è la sola forma ammessa in una colonna calcolata: la
-- variante a un argomento dipende dalla configurazione della sessione e
-- Postgres la rifiuta qui. Non è un dettaglio di stile — è il motivo per
-- cui la lingua compare scritta 'italian' invece di essere un default.
alter table documents
  add column if not exists ricerca tsvector
  generated always as (
    to_tsvector('italian',
      coalesce(title, '')          || ' ' ||
      coalesce(doc_type, '')       || ' ' ||
      coalesce(counterparties, '') || ' ' ||
      coalesce(note, '')           || ' ' ||
      coalesce(testo, ''))
  ) stored;

comment on column documents.ricerca is
  'Vettore di ricerca del documento, tenuto pronto da Postgres. Si paga quando il documento cambia, non a ogni domanda.';

create index if not exists idx_documents_ricerca on documents using gin (ricerca);

-- Copriva il solo `testo` e non lo leggeva nessuno: la ricerca guarda
-- anche titolo, tipo, controparte e note.
drop index if exists idx_documents_testo;

-- ---------------------------------------------------------------------
-- 2. La domanda si limita a confrontare
-- ---------------------------------------------------------------------
create or replace function documenti_per_domanda(p_domanda text)
returns table (
  id             uuid,
  title          text,
  doc_type       text,
  document_date  date,
  counterparties text,
  amount         numeric,
  expiry_date    date,
  ha_testo       boolean,
  rilevanza      real
)
language sql
stable
set search_path = public
as $funzione$
  select d.id,
         d.title,
         d.doc_type,
         d.document_date,
         d.counterparties,
         d.amount,
         d.expiry_date,
         (d.testo is not null and length(d.testo) > 0),
         -- Zero significa ZERO: `ts_rank` da solo, senza corrispondenza,
         -- non restituisce 0 ma 1e-20 — un numero che chi chiama
         -- leggerebbe come «un po' pertinente» e infilerebbe nel contesto
         -- del modello, a pagamento.
         case when d.ricerca @@ q.chiave then ts_rank(d.ricerca, q.chiave) else 0::real end
    -- Nessun `where`: l'elenco resta TUTTO l'Archivio in ordine di
    -- pertinenza, perché è ciò che permette a chi chiama di dire
    -- «guardati 40, letti 6» invece di un «non risulta» cieco (§8).
    from documents d
    cross join lateral (
      -- Una domanda non è una ricerca: «chi mi fa la manutenzione della
      -- caldaia?» pretesa tutta intera non trova niente, perché nessun
      -- documento contiene anche il «fa». Le parole si cercano in
      -- alternativa, e chi ne contiene di più viene prima.
      select replace(
               plainto_tsquery('italian', coalesce(p_domanda, ''))::text,
               ' & ', ' | '
             )::tsquery as chiave
    ) q
   order by 9 desc, d.document_date desc nulls last, d.created_at desc;
$funzione$;

comment on function documenti_per_domanda(text) is
  'I documenti dell''Archivio in ordine di pertinenza rispetto a una domanda. Legge la colonna `ricerca`, tenuta pronta da Postgres. Security INVOKER di proposito — decide la RLS di documents. Nessun limite: il taglio lo fa chi chiama.';

revoke all on function documenti_per_domanda(text) from public, anon;
grant execute on function documenti_per_domanda(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_staff  uuid;
  v_doc    uuid;
  v_altro  uuid;
  n        integer;
  v_rango  real;
  v_rango2 real;
begin
  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: la verifica non può impersonare nessuno.';
  end if;

  -- 1. La colonna esiste, è calcolata, e ha il suo indice.
  select count(*) into n from information_schema.columns
   where table_name = 'documents' and column_name = 'ricerca'
     and is_generated = 'ALWAYS';
  if n <> 1 then
    raise exception 'La colonna `ricerca` non esiste o non è calcolata da Postgres.';
  end if;
  select count(*) into n from pg_indexes
   where tablename = 'documents' and indexname = 'idx_documents_ricerca';
  if n <> 1 then raise exception 'Manca l''indice sulla colonna di ricerca.'; end if;
  select count(*) into n from pg_indexes
   where tablename = 'documents' and indexname = 'idx_documents_testo';
  if n <> 0 then raise exception 'L''indice vecchio è ancora lì.'; end if;

  -- 2. I documenti che c'erano già hanno il vettore, senza che nessuno li
  --    abbia toccati: una colonna calcolata si riempie da sola anche sul
  --    passato. Se così non fosse, l'archivio di ieri sarebbe invisibile.
  select count(*) into n from documents where ricerca is null;
  if n <> 0 then
    raise exception '% documenti già in archivio sono rimasti senza vettore di ricerca.', n;
  end if;

  -- 3. Stessa scena della migrazione precedente: la pertinenza si calcola
  --    sul CONTENUTO, e il documento che non c'entra sta sotto.
  insert into documents (title, doc_type, counterparties, testo)
  values ('PROVA INDICE manutenzione', 'contratto', 'Ditta di prova',
          'Contratto di manutenzione ordinaria della caldaia della cucina, canone annuo di 480 euro.')
  returning id into v_doc;

  insert into documents (title, doc_type, counterparties, testo)
  values ('PROVA INDICE tovagliato', 'preventivo', 'Altra ditta di prova',
          'Preventivo per la fornitura di tovaglie e tovaglioli in lino.')
  returning id into v_altro;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select rilevanza into v_rango  from documenti_per_domanda('chi mi fa la manutenzione della caldaia?') where id = v_doc;
  select rilevanza into v_rango2 from documenti_per_domanda('chi mi fa la manutenzione della caldaia?') where id = v_altro;
  if v_rango is null or v_rango <= 0 then
    raise exception 'Dopo il cambio, la ricerca nel contenuto non funziona più.';
  end if;
  if v_rango2 is null or v_rango2 >= v_rango then
    raise exception 'Il documento che non c''entra non sta sotto a quello che c''entra.';
  end if;

  select rilevanza into v_rango from documenti_per_domanda('xilofono marziano') where id = v_doc;
  if v_rango is null or v_rango > 0 then
    raise exception 'Una domanda senza attinenza produce rilevanza % invece di zero.', v_rango;
  end if;

  select count(*) into n from documenti_per_domanda('caldaia') where id in (v_doc, v_altro);
  if n <> 2 then
    raise exception 'L''elenco non è più tutto l''Archivio: % su 2.', n;
  end if;

  -- 4. Il vettore segue le modifiche: cambio il testo, cambia la
  --    pertinenza. È la differenza fra una colonna calcolata e una copia
  --    scritta una volta e dimenticata.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  update documents set testo = 'Preventivo per la fornitura di una caldaia nuova.'
   where id = v_altro;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  select rilevanza into v_rango2 from documenti_per_domanda('caldaia') where id = v_altro;
  if v_rango2 is null or v_rango2 <= 0 then
    raise exception 'Il vettore non ha seguito la modifica del documento.';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 5. Il personale continua a non vedere niente, su archivio non vuoto.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from documenti_per_domanda('caldaia');
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', null, true);
    if n <> 0 then raise exception 'Il personale vede % documenti dell''Archivio.', n; end if;
  end if;

  -- 6. Pulizia (regola del 12/08), registro delle cancellazioni compreso.
  delete from documents where id in (v_doc, v_altro);
  delete from deleted_records
   where table_name = 'documents' and record_id in (v_doc::text, v_altro::text);

  select count(*) into n from documents where title like 'PROVA INDICE%';
  if n <> 0 then raise exception 'La prova ha lasciato % documenti.', n; end if;
  select count(*) into n from deleted_records
   where table_name = 'documents' and record_id in (v_doc::text, v_altro::text);
  if n <> 0 then raise exception 'La prova ha lasciato % righe nel registro.', n; end if;

  raise notice 'Indice dell''Archivio pronto: colonna calcolata, indice nuovo, vecchio rimosso.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000010', 'indice_pronto_archivio')
on conflict (version) do nothing;

select count(*) as documenti,
       count(*) filter (where ricerca is not null) as con_indice_pronto
  from documents;
