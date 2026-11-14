-- =====================================================================
-- LA CHAT DI MEMO: RITOCCHI DALLA REVISIONE — 14/11/2026
-- =====================================================================
--
-- La 20261114000011 è già applicata e non si riscrive. La revisione del
-- database ha chiesto cinque cose:
--   1. i messaggi che non chiamano nessun modello (Alessio, strumento,
--      avviso) non sono «costo non noto»: non costano niente per natura;
--   2. lo storico dei costi non si modifica né si cancella da fuori: niente
--      DELETE, e in UPDATE si può cambiare solo lo stato del messaggio;
--   3. il tetto di 1 euro a messaggio faceva sparire una spesa già fatta:
--      si alza a 20 (il controllo vero sta nell'app, prima della chiamata);
--   4. il freno orario conta per l'utente della sessione, non per un uuid
--      passato da fuori (il parametro resta, per non cambiare la firma);
--   5. due indici: la dettatura collegata e la data dei messaggi.
-- Non si fa: l'atomicità del freno (la chat è solo di Alessio, un utente,
-- un messaggio alla volta: il margine è di un messaggio).
--
-- consumi_ai e memo_limite_messaggi si riprendono dal corpo VIVO e si
-- cambia una sola ancora ciascuna, controllata.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

do $c$
declare
  v_def text := replace(pg_get_functiondef('public.consumi_ai()'::regprocedure), E'\r', '');
  v_ancora text := 'm.costo_euro, m.costo_euro is not null';
begin
  if v_def like '%(m.modello is null or m.costo_euro is not null)%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'consumi_ai non ha la riga attesa della chat: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora, 'm.costo_euro, (m.modello is null or m.costo_euro is not null)');
end $c$;
revoke all on function consumi_ai() from public, anon, authenticated;

do $f$
declare
  v_def text := replace(pg_get_functiondef('public.memo_limite_messaggi(uuid)'::regprocedure), E'\r', '');
  v_ancora text := 'c.creata_da = p_utente';
begin
  if v_def like '%c.creata_da = auth.uid()%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'memo_limite_messaggi non ha il conteggio atteso: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora, 'c.creata_da = auth.uid()');
end $f$;
revoke all on function memo_limite_messaggi(uuid) from public, anon, authenticated;
grant execute on function memo_limite_messaggi(uuid) to authenticated;

-- Il tetto per messaggio: largo, perché la riga deve poter registrare la spesa vera.
alter table memo_messaggi drop constraint if exists memo_messaggio_costo_sensato;
alter table memo_messaggi add constraint memo_messaggio_costo_sensato
  check (costo_euro is null or (costo_euro >= 0 and costo_euro <= 20));
comment on constraint memo_messaggio_costo_sensato on memo_messaggi is
  'Un messaggio della chat non puo'' costare meno di zero ne'' piu'' di 20 euro: oltre e'' un errore di conto. Il freno vero sta nell''app, prima della chiamata.';

-- Le spiegazioni in italiano dei vincoli della chat (le chiede la prova «vincoli che parlano»).
comment on constraint memo_messaggio_ruolo_noto on memo_messaggi is
  'Chi parla in un messaggio della chat: Alessio, MEMO, uno strumento o un avviso. Un ruolo nuovo va dichiarato qui, non inventato da chi scrive.';
comment on constraint memo_messaggio_stato_noto on memo_messaggi is
  'Il messaggio e'' in corso, fatto, interrotto, fermato dal tetto o finito in errore: non esistono altri stati.';
comment on constraint memo_messaggio_token_sensato on memo_messaggi is
  'I token letti e scritti non possono essere negativi: un numero negativo falserebbe il conto della spesa.';
comment on constraint memo_riferimento_non_vuoto on memo_riferimenti is
  'Il riferimento breve di MEMO non puo'' essere vuoto: senza, la chat non saprebbe a quale riga del gestionale si riferisce.';

-- Storico dei costi: lo si legge, lo si scrive, non si cancella.
drop policy if exists memo_messaggi_titolare on memo_messaggi;
drop policy if exists memo_messaggi_leggi on memo_messaggi;
drop policy if exists memo_messaggi_scrivi on memo_messaggi;
drop policy if exists memo_messaggi_aggiorna on memo_messaggi;
create policy memo_messaggi_leggi on memo_messaggi
  for select to authenticated using ((select is_titolare()));
create policy memo_messaggi_scrivi on memo_messaggi
  for insert to authenticated with check ((select is_titolare()));
create policy memo_messaggi_aggiorna on memo_messaggi
  for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists memo_conversazioni_titolare on memo_conversazioni;
drop policy if exists memo_conversazioni_leggi on memo_conversazioni;
drop policy if exists memo_conversazioni_scrivi on memo_conversazioni;
drop policy if exists memo_conversazioni_aggiorna on memo_conversazioni;
create policy memo_conversazioni_leggi on memo_conversazioni
  for select to authenticated using ((select is_titolare()));
create policy memo_conversazioni_scrivi on memo_conversazioni
  for insert to authenticated with check ((select is_titolare()));
create policy memo_conversazioni_aggiorna on memo_conversazioni
  for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));

create or replace function memo_messaggio_storico_fermo()
returns trigger
language plpgsql
set search_path = public
as $funzione$
begin
  if new.conversazione_id is distinct from old.conversazione_id
     or new.ruolo is distinct from old.ruolo
     or new.testo is distinct from old.testo
     or new.modello is distinct from old.modello
     or new.token_ingresso is distinct from old.token_ingresso
     or new.token_uscita is distinct from old.token_uscita
     or new.costo_euro is distinct from old.costo_euro
     or new.creato_il is distinct from old.creato_il then
    raise exception 'Lo storico dei costi della chat non si modifica: di un messaggio cambia solo lo stato.';
  end if;
  return new;
end $funzione$;
revoke all on function memo_messaggio_storico_fermo() from public, anon, authenticated;

drop trigger if exists memo_messaggio_storico_fermo on memo_messaggi;
create trigger memo_messaggio_storico_fermo
  before update on memo_messaggi
  for each row execute function memo_messaggio_storico_fermo();

create index if not exists idx_memo_messaggi_dettatura
  on memo_messaggi (dettatura_id) where dettatura_id is not null;
create index if not exists idx_memo_messaggi_creato
  on memo_messaggi (creato_il);

do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid;
  v_conv uuid;
  v_msg uuid;
  v_n integer;
  v_noto boolean;
  v_rifiuto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'VERIFICA: serve un titolare.'; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into memo_conversazioni (titolo) values ('ZZ ritocchi chat') returning id into v_conv;
    insert into memo_messaggi (conversazione_id, ruolo, testo, stato)
    values (v_conv, 'alessio', 'ZZ domanda', 'fatto') returning id into v_msg;
    reset role;

    -- 1. senza modello il costo è «noto» (vuoto per natura)
    select x.costo_noto into v_noto from consumi_ai() x where x.fonte = 'chat' and x.modello is null
      order by x.quando desc limit 1;
    if not coalesce(v_noto, false) then
      raise exception 'VERIFICA (1): un messaggio senza modello conta come costo non noto.';
    end if;

    set local role authenticated;
    -- 2. non si cancella; si cambia solo lo stato
    delete from memo_messaggi where id = v_msg;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'VERIFICA (2): un messaggio si è cancellato.'; end if;
    update memo_messaggi set stato = 'interrotto' where id = v_msg;
    v_rifiuto := false;
    begin update memo_messaggi set costo_euro = 0 where id = v_msg;
    exception when others then v_rifiuto := sqlerrm like '%storico dei costi%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (2): il costo si è potuto modificare.'; end if;

    -- 3. il tetto è 20
    insert into memo_messaggi (conversazione_id, ruolo, testo, modello, costo_euro)
    values (v_conv, 'memo', 'ZZ costo alto', 'claude-sonnet-5', 5);
    v_rifiuto := false;
    begin insert into memo_messaggi (conversazione_id, ruolo, testo, costo_euro) values (v_conv, 'memo', 'ZZ troppo', 20.00001);
    exception when check_violation then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (3): oltre 20 euro è passato.'; end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei ritocchi alla chat di MEMO');
  raise notice 'Fatto: la chat non cancella né riscrive lo storico dei costi, i messaggi senza modello non sono costo non noto, il tetto per messaggio è 20 euro. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261114000014', 'la_chat_di_memo_ritocchi')
on conflict (version) do nothing;
