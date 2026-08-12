-- ---------------------------------------------------------------------
-- Chiedi all'archivio — l'assistente che risponde sui documenti
-- ---------------------------------------------------------------------
-- Il pezzo che la consegna «posta viva» aveva lasciato pronto senza
-- costruirlo: `documents.testo` conserva il contenuto di ogni documento
-- letto dall'assistente, e non serviva ancora a niente. Serve adesso.
--
-- COSA RISOLVE. Oggi l'Archivio si cerca per titolo: bisogna già sapere
-- come si chiama il documento e cosa c'è scritto dentro. «Quanto ho
-- speso dal notaio» e «quando scade il contratto di locazione» non sono
-- ricerche per titolo — sono domande, e la risposta sta dentro i file.
--
-- DUE PEZZI, NON UNO, E LA DIVISIONE NON È CASUALE
--
-- 1. `documenti_per_domanda()` — il database mette i documenti in ordine
--    di pertinenza rispetto alla domanda, cercando nel titolo, nella
--    controparte, nelle note **e nel contenuto**. Non decide niente e non
--    chiama nessuno: risponde «questi, in quest'ordine».
--
-- 2. La funzione online `assistente-archivio` prende quell'ordine, riempie
--    il contesto del modello finché ha spazio, e fa la domanda.
--
-- Il motivo della divisione è lo stesso di ieri con la sentinella: la
-- parte che si può provare a costo zero si prova a costo zero. Il
-- ranking è verificabile dentro questa migrazione, senza chiamare l'AI e
-- senza spendere un centesimo.
--
-- LA RILEVANZA È CALCOLATA SU TUTTO L'ARCHIVIO, SENZA LIMITE — di
-- proposito. Un limite qui produrrebbe la trappola del §8 di CLAUDE.md
-- (documenti che sembrano completi e non lo sono): la domanda «ho ricevuto
-- niente da questo fornitore?» con un limite risponderebbe «no» guardando
-- solo i primi. Il taglio lo fa chi chiama, sul contesto del modello, e
-- **dice quanti documenti ha guardato**.
--
-- IL PERMESSO NON SI REIMPLEMENTA: `documenti_per_domanda()` è
-- `security invoker` — nessun `definer`, nessuna scorciatoia. È la RLS di
-- `documents` (titolare-only) a decidere cosa si vede, come per qualunque
-- altra lettura dell'Archivio. Uno del personale che la chiamasse riceve
-- zero righe, non un rifiuto: non c'è una seconda serratura da tenere
-- allineata alla prima.
--
-- QUANTO COSTA, SCRITTO DOVE SI VEDE: `domande_archivio` tiene domanda,
-- risposta e token di ogni giro. Serve a due cose — rileggere una risposta
-- senza ripagarla, e vedere la spesa crescere prima che sia cresciuta. È
-- il conteggio che la consegna precedente aveva dichiarato mancante.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Quali documenti c'entrano con questa domanda
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
         -- Zero significa ZERO. `ts_rank` da solo, quando non c'è nessuna
         -- corrispondenza, non restituisce 0 ma 1e-20: un numero
         -- piccolissimo e diverso da zero, che chi chiama leggerebbe come
         -- «un po' pertinente» e infilerebbe nel contesto del modello.
         -- Trovato dalla verifica qui sotto, non leggendo il codice.
         case when v.tsv @@ q.chiave then ts_rank(v.tsv, q.chiave) else 0::real end
    -- Pertinenza prima, poi il più recente: due documenti che c'entrano
    -- uguale sono ordinati dal più nuovo, che è quasi sempre quello giusto.
    from documents d
    cross join lateral (
      -- Una domanda non è una ricerca: «chi mi fa la manutenzione della
      -- caldaia?» pretesa tutta intera non trova niente, perché nessun
      -- documento contiene anche il «fa». Le parole si cercano quindi in
      -- alternativa fra loro, e chi ne contiene di più viene prima.
      -- Il giro da `plainto_tsquery` non è un vezzo: è lui che toglie la
      -- punteggiatura e le parole vuote e riduce ogni parola alla radice
      -- («manutenzione» → «manutenzion»). Costruire la stessa cosa
      -- spezzando la frase a mano vorrebbe dire riscrivere l'italiano.
      select replace(
               plainto_tsquery('italian', coalesce(p_domanda, ''))::text,
               ' & ', ' | '
             )::tsquery as chiave
    ) q
    cross join lateral (
      select to_tsvector('italian',
               coalesce(d.title, '')          || ' ' ||
               coalesce(d.doc_type, '')       || ' ' ||
               coalesce(d.counterparties, '') || ' ' ||
               coalesce(d.note, '')           || ' ' ||
               coalesce(d.testo, '')) as tsv
    ) v
   order by 9 desc, d.document_date desc nulls last, d.created_at desc;
$funzione$;

comment on function documenti_per_domanda(text) is
  'I documenti dell''Archivio in ordine di pertinenza rispetto a una domanda: titolo, controparte, note e contenuto. Security INVOKER di proposito — decide la RLS di documents, non questa funzione. Nessun limite: il taglio lo fa chi chiama.';

-- Nessuna riga per chi non è autenticato. Al personale non serve la
-- revoca per essere escluso — ci pensa la RLS — ma la porta si chiude
-- comunque dove si può chiuderla.
revoke all on function documenti_per_domanda(text) from public, anon;
grant execute on function documenti_per_domanda(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Cosa è stato chiesto, cosa è stato risposto, quanto è costato
-- ---------------------------------------------------------------------
create table if not exists domande_archivio (
  id                uuid primary key default gen_random_uuid(),
  domanda           text not null,
  risposta          text,
  documenti_guardati integer,
  documenti_letti   integer,
  modello           text,
  token_domanda     integer,
  token_risposta    integer,
  creato_il         timestamptz not null default now()
);

comment on table domande_archivio is
  'Le domande fatte all''Archivio e le risposte. Serve a rileggere senza ripagare, e a vedere la spesa dell''AI crescere prima che sia cresciuta.';
comment on column domande_archivio.documenti_guardati is
  'Quanti documenti sono stati messi in ordine di pertinenza (tutto l''Archivio visibile).';
comment on column domande_archivio.documenti_letti is
  'Quanti sono stati davvero passati al modello: la differenza col precedente e'' cio'' che la risposta NON ha guardato.';

create index if not exists idx_domande_archivio_data on domande_archivio (creato_il desc);

alter table domande_archivio enable row level security;
drop policy if exists domande_archivio_titolare on domande_archivio;
create policy domande_archivio_titolare on domande_archivio
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 3. Verifica (§7 punti 1-3) — dai ruoli veri, senza chiamare l'AI
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

  -- Due documenti di prova: uno parla di caldaie, l'altro no. Il primo
  -- deve vincere su una domanda che parla di caldaie — e vincere per il
  -- CONTENUTO, non per il titolo, che non la nomina.
  insert into documents (title, doc_type, counterparties, testo)
  values ('PROVA ARCHIVIO manutenzione', 'contratto', 'Ditta di prova',
          'Contratto di manutenzione ordinaria della caldaia della cucina, canone annuo di 480 euro.')
  returning id into v_doc;

  insert into documents (title, doc_type, counterparties, testo)
  values ('PROVA ARCHIVIO tovagliato', 'preventivo', 'Altra ditta di prova',
          'Preventivo per la fornitura di tovaglie e tovaglioli in lino.')
  returning id into v_altro;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1. La domanda pesca il documento giusto, e lo pesca dal CONTENUTO: la
  --    parola «caldaia» non compare nel titolo di nessuno dei due.
  --    Si confrontano i due documenti di prova fra loro, non con l'intero
  --    archivio: una verifica che dipende dai documenti veri di Alessio
  --    passerebbe oggi e fallirebbe il giorno che ne arriva un altro.
  select rilevanza into v_rango  from documenti_per_domanda('chi mi fa la manutenzione della caldaia?') where id = v_doc;
  select rilevanza into v_rango2 from documenti_per_domanda('chi mi fa la manutenzione della caldaia?') where id = v_altro;

  if v_rango is null or v_rango <= 0 then
    raise exception 'Il documento che parla di caldaie ha rilevanza nulla: la ricerca nel contenuto non funziona.';
  end if;
  if v_rango2 is null or v_rango2 >= v_rango then
    raise exception 'Il documento che non c''entra (rilevanza %) non sta sotto a quello che c''entra (%).', v_rango2, v_rango;
  end if;

  -- 2. Il documento che non c'entra è comunque presente, con rilevanza
  --    zero: l'elenco è tutto l'Archivio in ordine, non una selezione.
  --    È ciò che permette a chi chiama di dire "guardati 40, letti 6".
  select count(*) into n from documenti_per_domanda('caldaia')
   where id in (v_doc, v_altro);
  if n <> 2 then
    raise exception 'L''elenco ha restituito % dei 2 documenti di prova: non è tutto l''Archivio.', n;
  end if;

  -- 3. Una domanda che non somiglia a niente non inventa pertinenze.
  select rilevanza into v_rango from documenti_per_domanda('xilofono marziano')
   where id = v_doc;
  if v_rango is null or v_rango > 0 then
    raise exception 'Una domanda senza attinenza produce rilevanza % invece di zero.', v_rango;
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- 4. Il personale non vede niente: nessuna riga, e senza che questa
  --    funzione contenga un solo controllo di ruolo. Provato su un
  --    archivio NON vuoto (§5 punto 2 di CLAUDE.md).
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into n from documenti_per_domanda('caldaia');

    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', null, true);

    if n <> 0 then
      raise exception 'Il personale vede % documenti dell''Archivio.', n;
    end if;
  else
    raise warning 'Nessun utente non-titolare in user_roles: la prova della RLS sull''Archivio è stata saltata.';
  end if;

  -- 5. Il registro delle domande esiste ed è del solo titolare.
  select count(*) into n from pg_policies
   where tablename = 'domande_archivio' and policyname = 'domande_archivio_titolare';
  if n <> 1 then
    raise exception 'Il registro delle domande non ha la sua policy.';
  end if;

  -- 6. Pulizia (regola di Alessio del 12/08): via i documenti di prova, e
  --    via anche la loro copia nel registro delle cancellazioni — che
  --    altrimenti resterebbe lì a raccontare una caldaia che non esiste.
  delete from documents where id in (v_doc, v_altro);
  delete from deleted_records
   where table_name = 'documents' and record_id in (v_doc::text, v_altro::text);

  select count(*) into n from documents where title like 'PROVA ARCHIVIO%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % documenti nell''Archivio.', n;
  end if;
  select count(*) into n from deleted_records
   where table_name = 'documents' and record_id in (v_doc::text, v_altro::text);
  if n <> 0 then
    raise exception 'La prova ha lasciato % righe nel registro delle cancellazioni.', n;
  end if;

  raise notice 'Chiedi all''archivio: pertinenza dal contenuto, archivio intero in ordine, personale a zero righe.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000009', 'chiedi_all_archivio')
on conflict (version) do nothing;

select count(*) as documenti_in_archivio,
       count(*) filter (where testo is not null and length(testo) > 0) as con_contenuto_leggibile
  from documents;
