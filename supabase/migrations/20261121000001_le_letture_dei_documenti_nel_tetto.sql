-- =====================================================================
-- LE LETTURE DEI DOCUMENTI ENTRANO NEL TETTO — 21/11/2026 (pezzo C0)
-- =====================================================================
--
-- Il tetto mensile dell'assistente (`spesa_ai_del_mese`, 30 euro) somma
-- quello che `consumi_ai()` elenca. Il 20/11 abbiamo contato le chiamate al
-- modello che il tetto NON vedeva:
--
--   · `documento-leggi` (trascrizione dei PDF e delle foto con Opus 5, e la
--     proposta di scheda con Haiku): non scriveva i token da nessuna parte.
--     Era la fonte che costa di piu' per chiamata (fino a 16.000 token di
--     uscita) ed era l'unica fuori dal conto.
--   · `assistente-archivio` scriveva i token (tabella `domande_archivio`, gia'
--     dentro `consumi_ai`) ma non guardava il tetto PRIMA di spendere:
--     contata, ma mai fermata. Qui non c'e' niente da cambiare nel database:
--     il freno sta nella funzione.
--   · `memo-chat` non contava i token della cache dei prompt: con la cache
--     accesa (pezzo S2) il costo sarebbe stato sottostimato e il tetto
--     sarebbe scattato tardi.
--
-- Cosa fa questa migrazione:
--   1. la tabella `letture_documento`: una riga per ogni chiamata al modello
--      fatta da `documento-leggi` (modello, token in, token out). Come per
--      l'archivio e la posta, il costo NON si scrive: si calcola al momento
--      dal listino, cosi' un prezzo corretto vale anche per il passato.
--   2. `consumi_ai()` guadagna la fonte 'documento'. Il corpo si riprende
--      dalla versione VIVA e si cambia solo quella riga (stessa tecnica della
--      migrazione 20261114000014): se qualcuno ha cambiato la funzione nel
--      frattempo, la migrazione si ferma invece di scavalcarlo.
--   3. `memo_messaggi` impara a ricordare i token di cache (lettura e
--      scrittura), che costano diversamente dai token normali.
--
-- ⚠️ Un modello fuori listino NON costa zero in silenzio: `consumi_ai`
--    dichiara `costo_noto = false`, come per l'archivio.
-- ⚠️ I costi gia' scritti nelle altre fonti non si toccano.
-- Idempotente (si puo' rilanciare), con verifica finale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Il registro delle letture dei documenti
-- ---------------------------------------------------------------------
create table if not exists letture_documento (
  id             uuid primary key default gen_random_uuid(),
  creato_il      timestamptz not null default now(),
  creato_da      uuid references auth.users(id) on delete set null,
  documento_id   uuid references documents(id) on delete set null,
  gesto          text not null,
  modello        text not null,
  token_domanda  integer not null default 0,
  token_risposta integer not null default 0
);

comment on table letture_documento is
  'Ogni chiamata al modello fatta per leggere un documento: la trascrizione di un PDF o di una foto, e la proposta di scheda. Il documento NON e'' qui. Il costo non si scrive: lo calcola consumi_ai() dal listino.';
comment on column letture_documento.gesto is
  'Che cosa si e'' chiesto al modello: la trascrizione fedele del file oppure la proposta di scheda.';
comment on column letture_documento.documento_id is
  'Il documento letto, se gia'' in archivio. Vuoto per un file letto prima di essere salvato (la scheda non esiste ancora).';

alter table letture_documento drop constraint if exists lettura_documento_gesto_noto;
alter table letture_documento
  add constraint lettura_documento_gesto_noto check (gesto in ('trascrizione', 'proposta'));
comment on constraint lettura_documento_gesto_noto on letture_documento is
  'Una lettura di documento e'' una trascrizione o una proposta di scheda: non esistono altri gesti.';

alter table letture_documento drop constraint if exists lettura_documento_token_sensati;
alter table letture_documento
  add constraint lettura_documento_token_sensati check (token_domanda >= 0 and token_risposta >= 0);
comment on constraint lettura_documento_token_sensati on letture_documento is
  'I token letti e scritti non possono essere negativi: un numero negativo falserebbe il conto della spesa.';

create index if not exists idx_letture_documento_data on letture_documento (creato_il desc);

alter table letture_documento enable row level security;
drop policy if exists letture_documento_titolare on letture_documento;
create policy letture_documento_titolare on letture_documento
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. consumi_ai(): la nuova fonte, dal corpo VIVO
-- ---------------------------------------------------------------------
do $f$
declare
  v_def text := replace(pg_get_functiondef('public.consumi_ai()'::regprocedure), E'\r', '');
  v_ancora text := E'  select ''chat'', m.creato_il,';
  v_nuova text := $n$  select 'documento'::text, d.creato_il, d.modello, d.token_domanda, d.token_risposta,
         case when c.modello is null then null
              else round(d.token_domanda::numeric / 1000000 * c.euro_milione_in
                       + d.token_risposta::numeric / 1000000 * c.euro_milione_out, 5) end,
         c.modello is not null
    from letture_documento d
    left join costo_modello_ai c on c.modello = d.modello
  union all
$n$;
begin
  if v_def like '%letture_documento%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'consumi_ai non ha la riga attesa della chat: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora, v_nuova || v_ancora);
end $f$;
-- Le due porte chiuse il 29/08 (migrazione 20260829000004): chi ricrea la
-- funzione le deve richiudere, altrimenti la spesa dell'assistente si
-- leggerebbe da fuori.
revoke all on function consumi_ai() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. La chat ricorda i token della cache
-- ---------------------------------------------------------------------
alter table memo_messaggi
  add column if not exists token_cache_lettura integer not null default 0,
  add column if not exists token_cache_scrittura integer not null default 0;
comment on column memo_messaggi.token_cache_lettura is
  'Token riletti dalla cache dei prompt: costano un decimo dei token d''ingresso normali. Zero finche'' la chat non usa la cache.';
comment on column memo_messaggi.token_cache_scrittura is
  'Token scritti nella cache dei prompt: costano una volta e un quarto i token d''ingresso normali. Zero finche'' la chat non usa la cache.';

alter table memo_messaggi drop constraint if exists memo_messaggio_cache_sensata;
alter table memo_messaggi
  add constraint memo_messaggio_cache_sensata check (token_cache_lettura >= 0 and token_cache_scrittura >= 0);
comment on constraint memo_messaggio_cache_sensata on memo_messaggi is
  'I token della cache non possono essere negativi: un numero negativo falserebbe il conto della spesa della chat.';

-- Lo storico dei costi della chat non si modifica (trigger del 14/11): i token
-- di cache entrano nel costo, quindi entrano anche nel blocco. Dal corpo VIVO.
do $t$
declare
  v_def text := replace(pg_get_functiondef('public.memo_messaggio_storico_fermo()'::regprocedure), E'', '');
  v_ancora text := 'or new.token_uscita is distinct from old.token_uscita';
begin
  if v_def like '%token_cache_lettura%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'memo_messaggio_storico_fermo non ha la riga attesa: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora, v_ancora || E'
     or new.token_cache_lettura is distinct from old.token_cache_lettura
     or new.token_cache_scrittura is distinct from old.token_cache_scrittura');
end $t$;
revoke all on function memo_messaggio_storico_fermo() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. La verifica: se qualcosa non e' al suo posto, tutto si ferma
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_def text := pg_get_functiondef('public.consumi_ai()'::regprocedure);
  v_fonti text[];
begin
  if v_def not like '%letture_documento%' then
    raise exception 'consumi_ai non comprende le letture dei documenti.';
  end if;
  if v_def not like '%memo_messaggi%' or v_def not like '%domande_archivio%' then
    raise exception 'consumi_ai ha perso una fonte che c''era: il corpo vivo non e'' quello atteso.';
  end if;
  if has_function_privilege('authenticated', 'public.consumi_ai()', 'execute')
     or has_function_privilege('anon', 'public.consumi_ai()', 'execute') then
    raise exception 'consumi_ai e'' tornata leggibile da fuori: le due porte del 29/08 vanno richiuse.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.letture_documento'::regclass) then
    raise exception 'letture_documento senza protezione per riga.';
  end if;
  -- Nessuna tabella con un modello e dei token che il conto non conosca.
  select array_agg(tabella) into v_fonti from fonti_ai_scoperte();
  if v_fonti is not null then
    raise exception 'Fonti AI fuori dal conto della spesa: %', v_fonti;
  end if;
  if pg_get_functiondef('public.memo_messaggio_storico_fermo()'::regprocedure) not like '%token_cache_scrittura%' then
    raise exception 'Lo storico della chat non protegge i token della cache.';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'memo_messaggi'
         and column_name in ('token_cache_lettura', 'token_cache_scrittura')) <> 2 then
    raise exception 'memo_messaggi non ricorda i token della cache.';
  end if;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20261121000001', 'le_letture_dei_documenti_nel_tetto') on conflict (version) do nothing;
