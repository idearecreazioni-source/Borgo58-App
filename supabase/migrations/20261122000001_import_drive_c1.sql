-- =====================================================================
-- L'IMPORT DAL DRIVE, PEZZO C1 (IL DATABASE) — 22/11/2026
-- =====================================================================
-- Alessio ha scelto 27 file del Drive da portare nell'Archivio (e un elenco
-- di altri 136 da tenere solo come elenco). Questa migrazione prepara il
-- database; la pagina che carica i file è il pezzo C2.
--
--   1. I DOCUMENTI portano quattro cose in più:
--        · `no_ai`  — l'interruttore «non far leggere all'AI». Un documento con
--          no_ai acceso sparisce da «Chiedi all'archivio» e dalla chat di MEMO
--          (qui sotto) e dalle letture dei file (nelle funzioni online).
--          Decisione di Alessio il 22/11: per questo primo carico è SPENTO per
--          tutti i file; l'interruttore resta, per bloccarne uno quando vuole.
--        · `sensibile` — una nota libera («IBAN», «documento d'identità»…),
--          solo informativa: non blocca niente.
--        · `impronta_sha256` — l'impronta del file, per riconoscere un doppione.
--          Il database NON lo vieta: lo segnala la pagina.
--        · `lotto_import_id` — il carico da cui arriva, per poterlo annullare.
--   2. I LOTTI (`lotti_import`): un carico = una riga. Non si cancellano mai;
--      si ANNULLANO, e annullare toglie dall'Archivio i documenti di quel lotto.
--   3. TRE SEZIONI NUOVE dell'Archivio: Preventivi, Progetto e planimetrie,
--      Assicurazioni.
--   4. L'ELENCO DEL DRIVE (`elenco_drive`): i file che NON sono nel gestionale,
--      con il loro link, da consultare. MEMO lo usa per rispondere «non è nel
--      gestionale, è nel Drive: ecco il link».
--
-- 🔴 IL REPO È PUBBLICO: qui dentro nessun dato vero. I nomi dei file e i link
--    li carica la pagina (o uno script con un file FUORI dal repo) direttamente
--    nel database di work, col sì di Alessio.
--
-- ⚠️ I FILE DEL DEPOSITO NON SI TOCCANO DA QUI: non esiste una transazione fra
--    database e deposito. Per annullare un lotto la pagina toglie PRIMA i file
--    (le trovi con `import_lotto_percorsi`) e poi chiama `import_lotto_annulla`
--    — lo stesso ordine di `deleteDocument`: se il secondo passo fallisce si
--    vede un documento senza file, e si ripara al tentativo dopo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. I LOTTI
-- ---------------------------------------------------------------------
create table if not exists lotti_import (
  id uuid primary key default gen_random_uuid(),
  creato_il timestamptz not null default now(),
  creato_da uuid default auth.uid(),
  nota text,
  annullato_il timestamptz,
  annullato_da uuid,
  constraint lotto_import_annullo_coerente check ((annullato_il is null) = (annullato_da is null)),
  constraint lotto_import_nota_corta check (nota is null or char_length(nota) <= 300)
);

comment on table lotti_import is
  'Un carico di documenti dal Drive (C1, 22/11/2026). Non si cancella: si annulla, e annullare toglie dall''Archivio i documenti del lotto.';
comment on constraint lotto_import_annullo_coerente on lotti_import is
  'Un lotto annullato dice quando e da chi è stato annullato; uno non annullato non dice niente.';
comment on constraint lotto_import_nota_corta on lotti_import is
  'La nota di un lotto è breve: al massimo 300 caratteri.';

create or replace function lotti_import_non_cancellabili()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  raise exception 'I lotti di import non si cancellano: si annullano, e restano come traccia di cosa è stato caricato.';
end;
$funzione$;

-- ⚠️ Una funzione nuova nasce eseguibile da tutti, anche da chi non è entrato (`anon`). Questa serve solo al
--    trigger, che non chiede il permesso di eseguirla a chi cancella: si chiude.
revoke all on function lotti_import_non_cancellabili() from public, anon, authenticated;

drop trigger if exists lotti_import_bloccati on lotti_import;
create trigger lotti_import_bloccati before delete on lotti_import
  for each row execute function lotti_import_non_cancellabili();

alter table lotti_import enable row level security;
revoke all on table lotti_import from public, anon;
revoke all on table lotti_import from authenticated;
-- Si legge e si apre un lotto dalla pagina; si annulla solo con la funzione.
grant select, insert on table lotti_import to authenticated;

drop policy if exists lotti_import_titolare_legge on lotti_import;
create policy lotti_import_titolare_legge on lotti_import for select to authenticated
  using ((select is_titolare()));
drop policy if exists lotti_import_titolare_apre on lotti_import;
create policy lotti_import_titolare_apre on lotti_import for insert to authenticated
  with check ((select is_titolare()) and annullato_il is null and annullato_da is null
              and creato_da = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 2. I DOCUMENTI: QUATTRO COLONNE IN PIÙ
-- ---------------------------------------------------------------------
alter table documents add column if not exists no_ai boolean not null default false;
alter table documents add column if not exists sensibile text;
alter table documents add column if not exists impronta_sha256 text;
alter table documents add column if not exists lotto_import_id uuid;

comment on column documents.no_ai is
  'Vero = questo documento non va mai fatto leggere all''AI: sparisce da «Chiedi all''archivio», dalla chat di MEMO e dalle letture del file. Lo decide il titolare, file per file.';
comment on column documents.sensibile is
  'Nota libera sul perché il documento è delicato (per esempio «IBAN»). Solo informativa: non blocca niente. Per bloccare le letture dell''AI c''è no_ai.';
comment on column documents.impronta_sha256 is
  'L''impronta SHA-256 del file (64 caratteri esadecimali minuscoli), per riconoscere un doppione. Il database non vieta i doppioni: li segnala la pagina.';
comment on column documents.lotto_import_id is
  'Il lotto di import da cui arriva il documento (vuoto per i documenti caricati a mano). Annullare il lotto toglie questi documenti.';

alter table documents drop constraint if exists documents_impronta_sha256_forma;
alter table documents add constraint documents_impronta_sha256_forma
  check (impronta_sha256 is null or impronta_sha256 ~ '^[0-9a-f]{64}$');
comment on constraint documents_impronta_sha256_forma on documents is
  'L''impronta di un file è un SHA-256: 64 caratteri esadecimali minuscoli.';

alter table documents drop constraint if exists documents_sensibile_corta;
alter table documents add constraint documents_sensibile_corta
  check (sensibile is null or (btrim(sensibile) <> '' and char_length(sensibile) <= 80));
comment on constraint documents_sensibile_corta on documents is
  'La nota «sensibile» di un documento è breve (al massimo 80 caratteri) e, se c''è, non è vuota.';

alter table documents drop constraint if exists documents_lotto_import_id_fkey;
alter table documents add constraint documents_lotto_import_id_fkey
  foreign key (lotto_import_id) references lotti_import(id) on delete restrict;
comment on constraint documents_lotto_import_id_fkey on documents is
  'Il lotto di import di questo documento non esiste. I lotti non si cancellano, quindi il collegamento non si rompe mai.';

create index if not exists idx_documents_impronta on documents (impronta_sha256) where impronta_sha256 is not null;
create index if not exists idx_documents_lotto_import on documents (lotto_import_id) where lotto_import_id is not null;

-- Un documento non entra in un lotto già annullato: un lotto annullato è chiuso, e il suo annullamento
-- non ripasserebbe più a togliere il documento arrivato dopo.
create or replace function documenti_lotto_non_annullato()
returns trigger language plpgsql security definer set search_path = public as $funzione$
begin
  if tg_op = 'UPDATE' and old.lotto_import_id is not distinct from new.lotto_import_id then
    return new;
  end if;
  if exists (select 1 from lotti_import l where l.id = new.lotto_import_id and l.annullato_il is not null) then
    raise exception 'Questo lotto di import e'' gia'' stato annullato: un documento non puo'' entrare in un lotto annullato.';
  end if;
  return new;
end;
$funzione$;

revoke all on function documenti_lotto_non_annullato() from public, anon, authenticated;

drop trigger if exists documenti_lotto_non_annullato on documents;
create trigger documenti_lotto_non_annullato before insert or update of lotto_import_id on documents
  for each row when (new.lotto_import_id is not null) execute function documenti_lotto_non_annullato();

-- ---------------------------------------------------------------------
-- 3. TRE SEZIONI NUOVE
-- ---------------------------------------------------------------------
-- Se il codice esiste già ACCESO non si tocca: se Alessio rinomina un'etichetta, rieseguire non la riporta
-- indietro. Se esiste SPENTO (su work potrebbe essere una sezione «legacy» nata da un valore scritto a mano,
-- con l'etichetta uguale al codice) si riaccende e prende l'etichetta e l'ordine giusti.
insert into sezioni_archivio (codice, etichetta, ordine) values
  ('preventivi',           'Preventivi',               9),
  ('progetto_planimetrie', 'Progetto e planimetrie',  10),
  ('assicurazioni',        'Assicurazioni',           11)
on conflict (codice) do update
  set attiva = true, etichetta = excluded.etichetta, ordine = excluded.ordine
  where not sezioni_archivio.attiva;

-- ---------------------------------------------------------------------
-- 4. «CHIEDI ALL'ARCHIVIO» E LA CHAT DI MEMO NON VEDONO I DOCUMENTI no_ai
-- ---------------------------------------------------------------------
-- Stesso corpo di `documenti_per_domanda` (20260812000010), più un solo `where`.
-- ⚠️ Prima la funzione non filtrava niente apposta («l'elenco resta TUTTO
--    l'Archivio, per poter dire guardati 40, letti 6»). Quel «tutto» ora è
--    «tutto quello che l'AI può leggere»: un documento no_ai non compare
--    nemmeno come scheda.
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
         case when d.ricerca @@ q.chiave then ts_rank(d.ricerca, q.chiave) else 0::real end
    from documents d
    cross join lateral (
      select replace(
               plainto_tsquery('italian', coalesce(p_domanda, ''))::text,
               ' & ', ' | '
             )::tsquery as chiave
    ) q
   where not d.no_ai
   order by 9 desc, d.document_date desc nulls last, d.created_at desc;
$funzione$;

comment on function documenti_per_domanda(text) is
  'I documenti dell''Archivio che l''AI può leggere, in ordine di pertinenza rispetto a una domanda (quelli con no_ai acceso non compaiono). Legge la colonna `ricerca`, tenuta pronta da Postgres. Security INVOKER di proposito — decide la RLS di documents. Nessun limite: il taglio lo fa chi chiama.';

revoke all on function documenti_per_domanda(text) from public, anon;
grant execute on function documenti_per_domanda(text) to authenticated;

-- La lettura della chat (`leggi_documenti`): stesso corpo vivo (20261115000010, limite 150 dalla
-- 20261115000018), più il filtro no_ai.
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

-- 🔴 IL CONFRONTO NOTTURNO DI MEMO (20261115000017) paragona `memo_leggi_documenti(null)` con il numero dei
--    documenti della pagina. Ora la lettura di MEMO salta i `no_ai`: se il confronto contasse anche quelli, ogni
--    documento riservato farebbe scattare un allarme finto ogni notte. Si ripara il corpo VIVO della funzione
--    (cambia una sola riga, controllata: deve comparire una volta sola).
do $confronto$
declare
  v_vecchio constant text := 'into v_pc, v_pt from documents d;';
  v_nuovo   constant text := 'into v_pc, v_pt from documents d where not d.no_ai;';
  v_def     text;
  v_n       integer;
begin
  v_def := replace(pg_get_functiondef('public.memo_confronta_con_le_pagine()'::regprocedure), E'\r', '');
  if v_def like '%' || v_nuovo || '%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'memo_confronta_con_le_pagine non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_vecchio, v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $confronto$;

-- 🔴 LE PROPOSTE DELLA SCHEDA (20261121000002, già su work: non si modifica) leggono i contratti dell'Archivio.
--    Un contratto con «non far leggere all'AI» non deve generare una proposta (il suo titolo e le sue controparti
--    finirebbero nel testo proposto) né una proposta di «spegni». Si ripara il corpo VIVO di
--    `scheda_proposte_calcola()`: due righe, ognuna controllata (deve comparire una volta sola).
do $proposte$
declare
  v_vecchio1 constant text := 'and btrim(coalesce(d0.title, '''')) <> ''''';
  v_nuovo1   constant text := 'and btrim(coalesce(d0.title, '''')) <> '''' and not d0.no_ai';
  v_vecchio2 constant text := 'where v.attiva and d.expiry_date is not null and d.expiry_date < v_oggi';
  v_nuovo2   constant text := 'where v.attiva and d.expiry_date is not null and d.expiry_date < v_oggi and not d.no_ai';
  v_def      text;
  v_n1       integer;
  v_n2       integer;
begin
  v_def := replace(pg_get_functiondef('public.scheda_proposte_calcola()'::regprocedure), E'\r', '');
  if v_def like '%' || v_nuovo1 || '%' and v_def like '%' || v_nuovo2 || '%' then return; end if;
  v_n1 := (length(v_def) - length(replace(v_def, v_vecchio1, ''))) / length(v_vecchio1);
  v_n2 := (length(v_def) - length(replace(v_def, v_vecchio2, ''))) / length(v_vecchio2);
  if v_n1 <> 1 or v_n2 <> 1 then
    raise exception 'scheda_proposte_calcola: le due righe da riparare compaiono % e % volte (attese una e una): confronta il corpo vivo prima di applicare.', v_n1, v_n2;
  end if;
  execute replace(replace(v_def, v_vecchio1, v_nuovo1), v_vecchio2, v_nuovo2);
end $proposte$;

-- ---------------------------------------------------------------------
-- 5. L'ELENCO DEL DRIVE
-- ---------------------------------------------------------------------
create table if not exists elenco_drive (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cartella text not null default '',
  sezione text,
  data_documento date,
  link text not null,
  formato text,
  mb numeric,
  sensibile text,
  importato_documento_id uuid references documents(id) on delete set null,
  creato_il timestamptz not null default now(),
  constraint elenco_drive_nome_presente check (btrim(nome) <> ''),
  constraint elenco_drive_link_https check (link ~ '^https://' and char_length(link) <= 500),
  constraint elenco_drive_mb_positivo check (mb is null or mb >= 0),
  constraint elenco_drive_sensibile_corta check (sensibile is null or char_length(sensibile) <= 80)
);

comment on table elenco_drive is
  'I file del Drive che NON sono (o non solo) nel gestionale, con il link per aprirli: l''elenco da consultare (C1, 22/11/2026). MEMO lo cerca con elenco_drive_cerca. Solo il titolare.';
-- Come per i documenti: un file dell'elenco con no_ai acceso non lo vede MEMO. Spento di partenza.
alter table elenco_drive add column if not exists no_ai boolean not null default false;
comment on column elenco_drive.no_ai is
  'Vero = questo file dell''elenco non va mostrato a MEMO (non compare nelle sue ricerche). Lo decide il titolare. Falso di partenza.';
create index if not exists idx_elenco_drive_importato on elenco_drive (importato_documento_id) where importato_documento_id is not null;
comment on column elenco_drive.sezione is
  'La sezione indicata nell''elenco di Alessio, scritta come testo libero: i file solo-elenco non vanno nell''Archivio, quindi non devono combaciare con le sue sezioni.';
comment on column elenco_drive.importato_documento_id is
  'Il documento dell''Archivio nato da questo file, se è stato importato. Se il documento viene tolto (per esempio annullando il lotto) il file torna «solo nel Drive».';
comment on constraint elenco_drive_nome_presente on elenco_drive is
  'Un file dell''elenco ha un nome.';
comment on constraint elenco_drive_link_https on elenco_drive is
  'Il link di un file del Drive è un indirizzo https, lungo al massimo 500 caratteri.';
comment on constraint elenco_drive_mb_positivo on elenco_drive is
  'La dimensione di un file in MB non può essere negativa.';
comment on constraint elenco_drive_sensibile_corta on elenco_drive is
  'La nota «sensibile» di un file è breve: al massimo 80 caratteri.';
comment on constraint elenco_drive_importato_documento_id_fkey on elenco_drive is
  'Il documento importato da questo file: se il documento viene tolto, il file resta nell''elenco e perde solo il collegamento.';

-- Lo stesso file non entra due volte: ricaricare l'elenco non lo duplica.
create unique index if not exists elenco_drive_link_unico on elenco_drive (link);
comment on index elenco_drive_link_unico is
  'Un file del Drive compare una volta sola nell''elenco: ricaricare lo stesso elenco non crea doppioni.';

alter table elenco_drive enable row level security;
revoke all on table elenco_drive from public, anon;
revoke all on table elenco_drive from authenticated;
grant select, insert, update, delete on table elenco_drive to authenticated;
drop policy if exists elenco_drive_titolare on elenco_drive;
create policy elenco_drive_titolare on elenco_drive for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- La ricerca: parole in AND su nome + cartella + sezione, senza accenti né segni.
-- Una parola lunga si accorcia di una lettera («preventivi» trova «preventivo»).
create or replace function elenco_drive_cerca(p_testo text, p_limite integer default 10)
returns table (id uuid, nome text, cartella text, sezione text, data_documento date, link text,
               formato text, mb numeric, sensibile text, nel_gestionale boolean, trovati integer)
language plpgsql stable security definer set search_path = public as $funzione$
declare
  v_parole text[];
  v_limite integer := least(greatest(coalesce(p_limite, 10), 1), 50);
begin
  if not is_titolare() then raise exception 'L''elenco del Drive e'' riservato al titolare.'; end if;
  select coalesce(array_agg(case when char_length(x.w) > 4 then left(x.w, char_length(x.w) - 1) else x.w end), '{}')
    into v_parole
    from (select w from unnest(string_to_array(scheda_normalizza(p_testo), ' ')) as w
           where char_length(w) >= 2 limit 6) x;
  -- Senza parole valide non si cerca niente: zero righe (non «tutto l'elenco»).
  if coalesce(array_length(v_parole, 1), 0) = 0 then return; end if;
  return query
  select e.id, e.nome, e.cartella, e.sezione, e.data_documento, e.link, e.formato, e.mb, e.sensibile,
         (e.importato_documento_id is not null), (count(*) over ())::integer
    from elenco_drive e
   where not e.no_ai
     and not exists (
           select 1 from unnest(v_parole) as p
            where position(p in scheda_normalizza(e.nome || ' ' || e.cartella || ' ' || coalesce(e.sezione, ''))) = 0)
   order by (e.importato_documento_id is not null), e.data_documento desc nulls last, e.nome
   limit v_limite;
end $funzione$;

comment on function elenco_drive_cerca(text, integer) is
  'Cerca nell''elenco dei file del Drive per parole (tutte presenti nel nome, nella cartella o nella sezione; accenti e segni ignorati). Solo il titolare. I file già importati nel gestionale vengono per ultimi, con nel_gestionale = vero.';

revoke all on function elenco_drive_cerca(text, integer) from public, anon, authenticated;
grant execute on function elenco_drive_cerca(text, integer) to authenticated;

-- Lo strumento della chat (stessa forma di tutte le `memo_leggi_*`).
create or replace function memo_leggi_elenco_drive(p_cerca text default null)
returns table (riga_id uuid, etichetta text, dati jsonb, conteggio integer, totale numeric)
language plpgsql stable security definer set search_path = public as $funzione$
begin
  if not is_titolare() then raise exception 'La chat di MEMO e'' riservata al titolare.'; end if;
  return query
  select r.id, r.nome,
         jsonb_build_object('cartella', r.cartella, 'sezione', r.sezione, 'data_documento', r.data_documento,
                            'link', r.link, 'formato', r.formato, 'mb', r.mb, 'sensibile', r.sensibile,
                            'nel_gestionale', r.nel_gestionale),
         r.trovati, 0::numeric
    from elenco_drive_cerca(p_cerca, 30) r;
end $funzione$;

revoke all on function memo_leggi_elenco_drive(text) from public, anon, authenticated;
grant execute on function memo_leggi_elenco_drive(text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. ANNULLARE UN LOTTO
-- ---------------------------------------------------------------------
-- I percorsi dei file del lotto: la pagina li toglie dal deposito PRIMA di annullare.
create or replace function import_lotto_percorsi(p_lotto uuid)
returns table (documento_id uuid, storage_path text)
language plpgsql stable security definer set search_path = public as $funzione$
begin
  if not is_titolare() then raise exception 'Solo il titolare puo'' vedere un lotto di import.'; end if;
  if not exists (select 1 from lotti_import where id = p_lotto) then raise exception 'Lotto di import non trovato.'; end if;
  return query
  select d.id, d.storage_path from documents d
   where d.lotto_import_id = p_lotto and d.storage_path is not null
   order by d.created_at, d.id;
end $funzione$;

revoke all on function import_lotto_percorsi(uuid) from public, anon, authenticated;
grant execute on function import_lotto_percorsi(uuid) to authenticated;

-- Si può annullare? La pagina lo chiede PRIMA di togliere i file dal deposito: se il lotto è già annullato o un
-- documento è stato usato altrove, tolti i file l'annullamento si fermerebbe e resterebbero documenti senza file.
create or replace function import_lotto_puo_annullare(p_lotto uuid)
returns table (puo boolean, motivo text)
language plpgsql stable security definer set search_path = public as $funzione$
declare
  v_lotto lotti_import%rowtype;
  v_usati integer;
begin
  if not is_titolare() then raise exception 'Solo il titolare puo'' vedere un lotto di import.'; end if;
  select * into v_lotto from lotti_import where id = p_lotto;
  if v_lotto.id is null then raise exception 'Lotto di import non trovato.'; end if;
  if v_lotto.annullato_il is not null then
    return query select false, 'Questo lotto e'' gia'' stato annullato.'::text;
    return;
  end if;
  select count(*) into v_usati from spese_da_collocare s join documents d on d.id = s.documento_id
   where d.lotto_import_id = p_lotto;
  if v_usati > 0 then
    return query select false, format('%s documenti di questo lotto sono gia'' stati usati altrove (come spesa da collocare): non posso annullare il lotto.', v_usati)::text;
    return;
  end if;
  return query select true, null::text;
end $funzione$;

comment on function import_lotto_puo_annullare(uuid) is
  'Dice se un lotto di import si può annullare (puo) e, se no, perché (motivo): già annullato, o con documenti già usati come spesa da collocare. La pagina la chiama prima di togliere i file dal deposito. Sola lettura.';

revoke all on function import_lotto_puo_annullare(uuid) from public, anon, authenticated;
grant execute on function import_lotto_puo_annullare(uuid) to authenticated;

-- Annulla il lotto: toglie i suoi documenti (come `delete_document`: il promemoria collegato si
-- completa) e lo segna annullato, nella stessa transazione. Restituisce quanti documenti ha tolto.
-- ⚠️ Scrive su più tabelle: dalla pagina si chiama SOLO da `operazioni-atomiche`.
create or replace function import_lotto_annulla(p_lotto uuid)
returns integer
language plpgsql security definer set search_path = public as $funzione$
declare
  v_lotto lotti_import%rowtype;
  v_doc record;
  v_tolti integer := 0;
begin
  if not is_titolare() then raise exception 'Solo il titolare puo'' annullare un lotto di import.'; end if;
  select * into v_lotto from lotti_import where id = p_lotto for update;
  if v_lotto.id is null then raise exception 'Lotto di import non trovato.'; end if;
  if v_lotto.annullato_il is not null then raise exception 'Questo lotto e'' gia'' stato annullato.'; end if;

  begin
    for v_doc in select id, task_id from documents where lotto_import_id = p_lotto order by created_at, id for update loop
      if v_doc.task_id is not null then
        update tasks set status = 'completato' where id = v_doc.task_id;
      end if;
      delete from documents where id = v_doc.id;
      v_tolti := v_tolti + 1;
    end loop;
  exception when foreign_key_violation then
    raise exception 'Un documento di questo lotto e'' gia'' stato usato altrove (per esempio come spesa da collocare): non posso annullare il lotto, resta tutto com''era.';
  end;

  update lotti_import set annullato_il = now(), annullato_da = auth.uid() where id = p_lotto;
  return v_tolti;
end $funzione$;

comment on function import_lotto_annulla(uuid) is
  'Annulla un lotto di import: toglie i suoi documenti dall''Archivio (e completa i loro promemoria) e segna il lotto annullato, insieme. I file nel deposito li toglie prima la pagina (vedi import_lotto_percorsi). Un lotto già annullato non si annulla due volte.';

revoke all on function import_lotto_annulla(uuid) from public, anon, authenticated;
grant execute on function import_lotto_annulla(uuid) to authenticated;

-- =====================================================================
-- VERIFICA — dentro una sotto-transazione ANNULLATA, su roba inventata
-- =====================================================================
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_tit uuid;
  v_staff uuid;
  v_lotto uuid;
  v_d1 uuid; v_d2 uuid; v_d3 uuid;
  v_n integer;
  v_no boolean;
  v_ok boolean;
  v_motivo text;
  v_lotto2 uuid;
  v_d4 uuid;
  v_fn text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;

  -- (0a) NESSUNA funzione nuova o rifatta è eseguibile da chi non è entrato (`anon`).
  foreach v_fn in array array[
    'lotti_import_non_cancellabili()', 'documenti_lotto_non_annullato()', 'documenti_per_domanda(text)',
    'memo_leggi_documenti(text)', 'elenco_drive_cerca(text,integer)', 'memo_leggi_elenco_drive(text)',
    'import_lotto_percorsi(uuid)', 'import_lotto_puo_annullare(uuid)', 'import_lotto_annulla(uuid)'] loop
    if has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'VERIFICA (0a): % e'' eseguibile da anon.', v_fn;
    end if;
  end loop;
  -- (0c) le proposte della Scheda non pescano i documenti no_ai.
  if pg_get_functiondef('public.scheda_proposte_calcola()'::regprocedure) not like '%and not d0.no_ai%'
     or pg_get_functiondef('public.scheda_proposte_calcola()'::regprocedure) not like '%d.expiry_date < v_oggi and not d.no_ai%' then
    raise exception 'VERIFICA (0c): le proposte della Scheda pescano ancora i documenti no_ai.';
  end if;

  -- (0) il confronto notturno conta i documenti come li legge MEMO (senza i no_ai).
  if pg_get_functiondef('public.memo_confronta_con_le_pagine()'::regprocedure) not like '%from documents d where not d.no_ai;%' then
    raise exception 'VERIFICA (0): il confronto notturno di MEMO conta ancora anche i documenti no_ai.';
  end if;
  -- (0b) la funzione del trigger non e'' eseguibile da nessuno (era il caso «18 invece di 17» di anon).
  if has_function_privilege('anon', 'lotti_import_non_cancellabili()', 'execute')
     or has_function_privilege('authenticated', 'lotti_import_non_cancellabili()', 'execute') then
    raise exception 'VERIFICA (0b): la funzione del trigger dei lotti e'' eseguibile da chi non deve.';
  end if;

  -- (1) le tre sezioni nuove ci sono e sono accese.
  select count(*) into v_n from sezioni_archivio
   where attiva and codice in ('preventivi', 'progetto_planimetrie', 'assicurazioni');
  if v_n <> 3 then raise exception 'VERIFICA (1): le sezioni nuove accese sono %, non 3.', v_n; end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- (1b) un lotto lo apre solo chi lo firma: «creato da» altrui è rifiutato.
    v_no := false;
    begin insert into lotti_import (nota, creato_da) values ('ZZ lotto altrui', gen_random_uuid());
    exception when insufficient_privilege then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (1b): un lotto e'' stato aperto a nome di un altro.'; end if;
    insert into lotti_import (nota) values ('ZZ lotto di prova') returning id into v_lotto;
    insert into documents (title, doc_type, document_date, testo, lotto_import_id, impronta_sha256, storage_path)
      values ('ZZ documento libero', 'preventivi', current_date, 'zzparolaunica cantina', v_lotto, repeat('a', 64), 'zz/uno.pdf') returning id into v_d1;
    insert into documents (title, doc_type, document_date, testo, lotto_import_id, no_ai, sensibile, storage_path)
      values ('ZZ documento riservato', 'preventivi', current_date, 'zzparolaunica segreto', v_lotto, true, 'IBAN', 'zz/due.pdf') returning id into v_d2;
    insert into documents (title, doc_type, document_date, lotto_import_id)
      values ('ZZ senza file', 'assicurazioni', current_date, v_lotto) returning id into v_d3;

    -- (2) «Chiedi all'archivio» non vede il documento no_ai, nemmeno come scheda.
    select count(*) into v_n from documenti_per_domanda('zzparolaunica') where id in (v_d1, v_d2);
    if v_n <> 1 or exists (select 1 from documenti_per_domanda('zzparolaunica') where id = v_d2) then
      raise exception 'VERIFICA (2): documenti_per_domanda mostra % documenti (atteso solo quello libero) o il riservato.', v_n;
    end if;
    if not exists (select 1 from documenti_per_domanda('zzparolaunica') where id = v_d1 and ha_testo) then
      raise exception 'VERIFICA (2b): il documento libero non compare piu'' con il suo testo.';
    end if;

    -- (3) la chat di MEMO non lo legge nemmeno come scheda.
    select count(*) into v_n from memo_leggi_documenti('ZZ documento');
    if v_n <> 1 or exists (select 1 from memo_leggi_documenti('ZZ documento') where riga_id = v_d2) then
      raise exception 'VERIFICA (3): memo_leggi_documenti da % righe (attesa 1: solo il libero, senza il riservato).', v_n;
    end if;

    -- (4) l'impronta e la nota sensibile rifiutano le forme sbagliate.
    v_no := false;
    begin update documents set impronta_sha256 = 'ABC' where id = v_d3; exception when check_violation then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (4a): un''impronta storta e'' passata.'; end if;
    v_no := false;
    begin update documents set sensibile = '   ' where id = v_d3; exception when check_violation then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (4b): una nota sensibile vuota e'' passata.'; end if;

    -- (5) l'elenco del Drive: cerca senza accenti, per parole, e segna i già importati.
    insert into elenco_drive (nome, cartella, sezione, link, mb, data_documento)
      values ('ZZ Preventivo àcqua e gas — 2026-05-15.pdf', '02_LOCALE/Lavori', 'preventivo', 'https://example.invalid/zz1', 0.2, date '2026-05-15');
    insert into elenco_drive (nome, cartella, sezione, link, importato_documento_id)
      values ('ZZ Contratto affitto.pdf', '01_CONTRATTI', 'contratto', 'https://example.invalid/zz2', v_d1);
    insert into elenco_drive (nome, link, no_ai) values ('ZZ Riservato.pdf', 'https://example.invalid/zz3', true);
    select count(*) into v_n from elenco_drive_cerca('zz riservato', 10);
    if v_n <> 0 then raise exception 'VERIFICA (5h): un file dell''elenco con no_ai e'' stato mostrato a MEMO.'; end if;
    select count(*) into v_n from elenco_drive_cerca('   ', 10);
    if v_n <> 0 then raise exception 'VERIFICA (5i): senza parole la ricerca ha dato % righe, non 0.', v_n; end if;
    select count(*) into v_n from elenco_drive_cerca('a', 10);
    if v_n <> 0 then raise exception 'VERIFICA (5j): con una sola lettera la ricerca ha dato % righe, non 0.', v_n; end if;
    select count(*) into v_n from memo_leggi_elenco_drive(null);
    if v_n <> 0 then raise exception 'VERIFICA (5k): lo strumento della chat senza parole ha dato % righe, non 0.', v_n; end if;
    select count(*) into v_n from elenco_drive_cerca('ZZ preventivi acqua', 10);
    if v_n <> 1 then raise exception 'VERIFICA (5a): la ricerca per parole (plurale, senza accento) trova % righe, non 1.', v_n; end if;
    select count(*) into v_n from elenco_drive_cerca('zz', 10) where nel_gestionale;
    if v_n <> 1 then raise exception 'VERIFICA (5b): i file gia'' importati segnati sono %, non 1.', v_n; end if;
    select count(*) into v_n from elenco_drive_cerca('zz', 1);
    if v_n <> 1 then raise exception 'VERIFICA (5c): il limite 1 da % righe.', v_n; end if;
    select max(trovati) into v_n from elenco_drive_cerca('zz', 1);
    if v_n <> 2 then raise exception 'VERIFICA (5d): il totale trovati e'' %, non 2.', v_n; end if;
    select count(*) into v_n from memo_leggi_elenco_drive('zz');
    if v_n <> 2 then raise exception 'VERIFICA (5e): lo strumento della chat da % righe, non 2.', v_n; end if;
    v_no := false;
    begin insert into elenco_drive (nome, link) values ('ZZ doppione', 'https://example.invalid/zz1');
    exception when unique_violation then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (5f): lo stesso link e'' entrato due volte.'; end if;
    v_no := false;
    begin insert into elenco_drive (nome, link) values ('ZZ non sicuro', 'http://example.invalid/x');
    exception when check_violation then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (5g): un link non https e'' passato.'; end if;

    -- (6) i percorsi del lotto: solo i documenti con un file.
    select count(*) into v_n from import_lotto_percorsi(v_lotto);
    if v_n <> 2 then raise exception 'VERIFICA (6): i percorsi del lotto sono %, non 2.', v_n; end if;

    -- (6b) si può annullare, e la pagina lo sa PRIMA di toccare i file; con un documento già usato altrove, no.
    select puo into v_ok from import_lotto_puo_annullare(v_lotto);
    if not v_ok then raise exception 'VERIFICA (6b): un lotto pulito risulta non annullabile.'; end if;
    -- Un SECONDO lotto, con un documento già usato come spesa collocata in archivio (quella riga non si cancella
    -- più: la guardia delle spese lo vieta, ed è giusto così; qui sparisce con l'annullamento di tutta la verifica).
    insert into lotti_import (nota) values ('ZZ lotto con spesa') returning id into v_lotto2;
    insert into documents (title, doc_type, document_date, lotto_import_id)
      values ('ZZ documento usato', 'preventivi', current_date, v_lotto2) returning id into v_d4;
    reset role;
    insert into spese_da_collocare (provenienza, descrizione, stato, collocata_in, collocata_il, documento_id)
      values ('voce', 'ZZ spesa di prova', 'collocata', 'archivio', now(), v_d4);
    set local role authenticated;
    select puo, motivo into v_ok, v_motivo from import_lotto_puo_annullare(v_lotto2);
    if v_ok or v_motivo is null or v_motivo not like '%spesa da collocare%' then
      raise exception 'VERIFICA (6c): con un documento usato altrove il lotto risulta annullabile (% / %).', v_ok, v_motivo;
    end if;
    v_no := false;
    begin perform import_lotto_annulla(v_lotto2);
    exception when raise_exception then v_no := sqlerrm like '%gia'' stato usato altrove%'; end;
    if not v_no then raise exception 'VERIFICA (6d): l''annullamento non si e'' fermato con il suo messaggio.'; end if;
    if not exists (select 1 from documents where id = v_d4)
       or exists (select 1 from lotti_import where id = v_lotto2 and annullato_il is not null) then
      raise exception 'VERIFICA (6e): l''annullamento fermato ha toccato il documento o il lotto.';
    end if;

    -- (7) annullare: tolgono i 3 documenti, il lotto resta segnato, il file torna «solo nel Drive».
    if import_lotto_annulla(v_lotto) <> 3 then raise exception 'VERIFICA (7a): l''annullamento non ha tolto 3 documenti.'; end if;
    if exists (select 1 from documents where lotto_import_id = v_lotto) then raise exception 'VERIFICA (7b): restano documenti del lotto.'; end if;
    if not exists (select 1 from lotti_import where id = v_lotto and annullato_il is not null and annullato_da = v_tit) then
      raise exception 'VERIFICA (7c): il lotto non risulta annullato dal titolare.';
    end if;
    if exists (select 1 from elenco_drive where link = 'https://example.invalid/zz2' and importato_documento_id is not null) then
      raise exception 'VERIFICA (7d): il file annullato risulta ancora importato.';
    end if;
    v_no := false;
    begin perform import_lotto_annulla(v_lotto); exception when raise_exception then v_no := sqlerrm like '%gia'' stato annullato%'; end;
    if not v_no then raise exception 'VERIFICA (7e): un lotto si e'' annullato due volte.'; end if;
    select puo, motivo into v_ok, v_motivo from import_lotto_puo_annullare(v_lotto);
    if v_ok or v_motivo is null or v_motivo not like '%gia'' stato annullato%' then
      raise exception 'VERIFICA (7f): un lotto annullato risulta ancora annullabile.';
    end if;
    -- (7g) un documento non entra in un lotto già annullato.
    v_no := false;
    begin insert into documents (title, doc_type, document_date, lotto_import_id) values ('ZZ tardivo', 'preventivi', current_date, v_lotto);
    exception when raise_exception then v_no := sqlerrm like '%gia'' stato annullato%'; end;
    if not v_no then raise exception 'VERIFICA (7g): un documento e'' entrato in un lotto annullato.'; end if;

    -- (8) un lotto non si cancella.
    reset role;
    v_no := false;
    begin delete from lotti_import where id = v_lotto; exception when raise_exception then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (8): un lotto si e'' cancellato.'; end if;

    -- (9) lo staff e chi non e' entrato non toccano niente di tutto questo.
    if v_staff is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_no := false;
      begin perform * from elenco_drive_cerca('zz', 10); exception when raise_exception then v_no := true; end;
      if not v_no then raise exception 'VERIFICA (9a): lo staff ha cercato nell''elenco del Drive.'; end if;
      v_no := false;
      begin perform import_lotto_annulla(v_lotto); exception when raise_exception then v_no := true; end;
      if not v_no then raise exception 'VERIFICA (9b): lo staff ha annullato un lotto.'; end if;
      if exists (select 1 from elenco_drive) or exists (select 1 from lotti_import) then
        raise exception 'VERIFICA (9c): lo staff legge l''elenco o i lotti.';
      end if;
      reset role;
    end if;
    perform set_config('request.jwt.claims', null, true);
    set local role anon;
    v_no := false;
    begin perform count(*) from elenco_drive; exception when insufficient_privilege then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (9d): anon legge l''elenco del Drive.'; end if;
    v_no := false;
    begin perform count(*) from lotti_import; exception when insufficient_privilege then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (9e): anon legge i lotti.'; end if;
    reset role;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dell''import dal Drive (C1)');
  raise notice 'Fatto: i documenti hanno no_ai, sensibile, impronta e lotto; tre sezioni nuove; elenco del Drive con ricerca; lotti annullabili. Un documento no_ai non arriva a «Chiedi all''archivio» ne'' alla chat di MEMO. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261122000001', 'import_drive_c1')
on conflict (version) do nothing;
