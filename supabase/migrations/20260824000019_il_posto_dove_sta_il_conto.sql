-- =====================================================================
-- IL POSTO DOVE VIENE REGISTRATO IL CONTO BANCARIO
-- 24/08/2026 — la struttura, non il multi-conto
-- =====================================================================
-- Alessio potrebbe aprire DUE conti correnti, e ha chiesto di predisporre
-- adesso: *«aggiungi solo il posto dove il conto viene registrato, senza
-- cambiare nessuna schermata finche' il conto e' uno»*.
--
-- 🔴 PERCHE' ADESSO E NON DOPO, misurato: in prima nota ci sono **zero
-- movimenti**. Oggi questa colonna non deve rispondere per nessuno. Il
-- giorno che ci fossero trecento movimenti gia' registrati, aggiungerla
-- vorrebbe dire decidere **riga per riga su quale conto e' passata** — e
-- quella decisione il gestionale non puo' prenderla: nei dati c'e' scritto
-- «banca», non quale. **La finestra si chiude al primo bonifico
-- registrato, non a marzo.**
--
-- ⚠️ IL DIFETTO CHE SI EVITA NON E' UN ERRORE, E' UN NUMERO PLAUSIBILE:
-- con due conti veri e un gestionale che ne conosce uno, il saldo banca
-- continuerebbe a comparire sommando i due in una cifra che **non
-- corrisponde a nessuno dei due estratti conto**. Nessun avviso, nessun
-- rosso: solo una riconciliazione che non torna mai e una causa che
-- risale a mesi prima.
--
-- ---------------------------------------------------------------------
-- COSA NON SI FA, e perche'
-- ---------------------------------------------------------------------
-- · **Nessuna riga di partenza.** Un conto «principale» inventato qui
--   sarebbe un nome scelto da me al posto suo, e la tabella nasce vuota
--   perche' il conto non esiste ancora.
-- · **Nessuna schermata cambia.** Le schermate del multi-conto — scegliere
--   il conto quando registri, i due saldi affiancati, il trasferimento fra
--   conti — vogliono decisioni che oggi non si possono prendere: quante
--   banche, quali nomi, quale conto fa cosa. Costruirle adesso vuol dire
--   indovinare.
-- · **`v_cash_balance` non si tocca.** Continua a dire UN saldo banca, ed
--   e' giusto finche' il conto e' uno. Il giorno che ne compare un secondo
--   si scompone — ed e' un lavoro che si potra' fare, perche' il dato per
--   scomporlo da domani c'e'.
--
-- ⚠️ QUINDI LA STRUTTURA C'E' E TACE. E' la forma minima che rende
-- possibile il seguito senza anticiparne nessuna scelta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · I conti
-- ---------------------------------------------------------------------
create table if not exists conti_bancari (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id) on delete restrict,
  nome         text not null,
  -- ⚠️ Facoltativo: oggi la banca non e' scelta, e pretendere l'IBAN
  -- vorrebbe dire non poter registrare il conto finche' non arriva la
  -- lettera. Serve alla riconciliazione, non all'identita' del conto.
  iban         text,
  attivo       boolean not null default true,
  note         text,
  creato_il    timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

comment on table conti_bancari is
  'I conti correnti del locale, uno per riga. Nasce vuota: il conto lo registra Alessio quando lo apre. ⚠️ Finche'' di conti ce n''e'' uno solo nessuna schermata cambia — la tabella serve perche'' il giorno che ne compare un secondo i movimenti sappiano gia'' da quale sono passati, invece di doverlo ricostruire a memoria.';

comment on column conti_bancari.nome is
  'Come lo chiama Alessio: «Conto Intesa», «Conto operativo». Non e'' l''intestazione della banca — e'' il nome con cui lo riconosce lui in un elenco.';

-- Un conto con lo stesso nome due volte nella stessa societa' non e'
-- un secondo conto: e' un doppione che rende ambiguo ogni movimento.
create unique index if not exists uniq_conto_per_nome
  on conti_bancari (entity_id, lower(nome));

alter table conti_bancari
  drop constraint if exists conto_nome_non_vuoto;
alter table conti_bancari
  add constraint conto_nome_non_vuoto check (length(btrim(nome)) > 0);
comment on constraint conto_nome_non_vuoto on conti_bancari is
  'Un conto senza nome non si puo'' scegliere da un elenco: il nome e'' l''unica cosa che lo distingue dall''altro.';

-- ⚠️ `set_updated_at()` NON SI RIUSA QUI: scrive `updated_at`, e questa
-- colonna si chiama `aggiornato_il`. E' la trappola del 12/08 gia' scritta
-- negli appunti — e l'errore arriva a tempo di ESECUZIONE, sul primo
-- aggiornamento, non creando il trigger.
--
-- ⚠️ E la funzione va scritta, non evitata: `formati_tavolo` e
-- `impostazioni_tesoreria` hanno la stessa colonna e **nessun trigger**,
-- quindi la' `aggiornato_il` resta fermo al giorno della creazione — cioe'
-- e' una colonna che dice una cosa falsa. Qui no.
create or replace function set_aggiornato_il()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

comment on function set_aggiornato_il() is
  'Tiene aggiornata la colonna `aggiornato_il`. Gemella di `set_updated_at()`, che scrive `updated_at`: sono due perche'' le colonne hanno due nomi, e riusare quella sbagliata fallisce al primo aggiornamento e non creando il trigger.';

revoke all on function set_aggiornato_il() from public, anon, authenticated;

drop trigger if exists trg_conti_bancari_aggiornato on conti_bancari;
create trigger trg_conti_bancari_aggiornato
  before update on conti_bancari
  for each row execute function set_aggiornato_il();

-- ---------------------------------------------------------------------
-- 2 · Il legame col movimento
-- ---------------------------------------------------------------------
-- ⚠️ `on delete restrict`, mai `set null`: un conto che sparisce
-- lasciando i suoi movimenti senza padrone e' il difetto chiuso il
-- 16/08 sulle fatture — li' era nello SCHEMA, e nessuna funzione poteva
-- curarlo finche' lo schema diceva il contrario.
alter table cash_movements
  add column if not exists conto_id uuid references conti_bancari(id) on delete restrict;

comment on column cash_movements.conto_id is
  'Su quale conto e'' passato il movimento. ⚠️ Vuoto finche'' i conti registrati sono zero o uno: in quel caso non c''e'' niente da distinguere, e chiedere di scegliere sarebbe una domanda con una risposta sola.';

create index if not exists idx_cash_movements_conto on cash_movements (conto_id)
  where conto_id is not null;

-- ---------------------------------------------------------------------
-- 3 · La regola che si accende da sola
-- ---------------------------------------------------------------------
-- 🔴 QUESTA E' LA PARTE CHE FA FUNZIONARE «la struttura c'e' e tace».
-- Il conto NON e' obbligatorio adesso — sarebbe un campo in piu' da
-- riempire per una scelta che non esiste. Diventa obbligatorio **da solo**
-- il giorno in cui i conti attivi di quella societa' sono due o piu':
-- da quel momento «banca» ha smesso di essere un posto ed e' diventata
-- una categoria, e un movimento che non dice quale conto e' un movimento
-- che nessun estratto conto potra' mai confermare.
--
-- ⚠️ E il rifiuto dice cosa fare, non solo cosa manca (regola del 16/08:
-- un rifiuto senza via d'uscita e' un vicolo cieco).
create or replace function pretendi_il_conto_quando_servono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_quanti integer;
begin
  if new.mezzo is distinct from 'banca' or new.conto_id is not null then
    return new;
  end if;

  select count(*) into v_quanti
    from conti_bancari c
   where c.entity_id = new.entity_id and c.attivo;

  if v_quanti > 1 then
    raise exception
      'Ci sono % conti bancari attivi: questo movimento deve dire su quale e'' passato. Scegli il conto, oppure disattiva quelli che non usi da Cassa.',
      v_quanti
      using errcode = 'P0001';
  end if;

  -- ⚠️ Con UN conto solo lo si riempie da se': non e' una scelta, e
  -- chiederla sarebbe una domanda con una risposta sola. Cosi' i
  -- movimenti di oggi nascono gia' attribuiti, e il giorno del secondo
  -- conto non c'e' nessuno storico da ricostruire — che e' precisamente
  -- il motivo per cui questa migrazione si fa adesso.
  if v_quanti = 1 then
    select c.id into new.conto_id
      from conti_bancari c
     where c.entity_id = new.entity_id and c.attivo;
  end if;

  return new;
end $$;

comment on function pretendi_il_conto_quando_servono() is
  'Riempie da se'' il conto del movimento quando ce n''e'' uno solo, e lo PRETENDE quando ce ne sono due o piu''. ⚠️ Cosi'' la struttura non chiede niente finche'' non c''e'' niente da scegliere, e comincia a chiederlo esattamente nel momento in cui «banca» smette di essere un posto e diventa una categoria.';

revoke all on function pretendi_il_conto_quando_servono() from public, anon, authenticated;

drop trigger if exists trg_conto_quando_serve on cash_movements;
create trigger trg_conto_quando_serve
  before insert or update of mezzo, conto_id, entity_id on cash_movements
  for each row execute function pretendi_il_conto_quando_servono();

-- ---------------------------------------------------------------------
-- 4 · I permessi: e' denaro, quindi e' del titolare
-- ---------------------------------------------------------------------
alter table conti_bancari enable row level security;

drop policy if exists conti_bancari_titolare on conti_bancari;
create policy conti_bancari_titolare on conti_bancari
  for all to authenticated
  using ((select is_titolare()))
  with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_entita   uuid;
  v_a        uuid;
  v_b        uuid;
  v_mov      uuid;
  v_respinto boolean;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_causale  uuid;
  v_conto    uuid;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_entita from entities limit 1;
  select id into v_causale from cash_causali where active and kind = 'uscita' limit 1;

  -- ⚠️ IL REGISTRO DELLE CANCELLAZIONI SI SPEGNE PRIMA: `cash_movements`
  --     e' una tabella tracciata, e i movimenti di prova lascerebbero
  --     quattro righe finte in un registro esibibile che nessuno puo'
  --     ripulire dall'app. Il guardiano le ha contate al primo colpo.
  --     ⚠️ Si spegne SOLO quello: gli altri trigger di questa tabella —
  --     compreso quello che sto provando — devono restare vivi, ed e' il
  --     motivo per cui non si usa `session_replication_role` (11/08).
  alter table cash_movements disable trigger trg_log_delete;
  if v_entita is null or v_causale is null then
    raise exception 'Manca un''entita'' o una causale: impossibile verificare.';
  end if;

  -- (a) La tabella nasce VUOTA. ⚠️ Se questa riga fallisce vuol dire che
  --     qualcuno ha seminato un conto inventato: e' esattamente quello
  --     che questa migrazione non deve fare.
  if exists (select 1 from conti_bancari) then
    raise notice 'Ci sono gia'' dei conti registrati: la verifica lavora accanto a loro.';
  end if;

  -- (b) Con ZERO conti, un movimento in banca passa come prima. E' la
  --     proprieta' che vale «nessuna schermata cambia».
  insert into cash_movements (entity_id, direction, amount, causale_id, movement_date, mezzo, business_purpose)
  values (v_entita, 'uscita', 1.00, v_causale, current_date, 'banca', 'verifica-conto-20260824')
  returning id, conto_id into v_mov, v_conto;
  if v_conto is not null then
    raise exception 'Con zero conti il movimento ha ricevuto un conto dal nulla.';
  end if;
  delete from cash_movements where id = v_mov;

  -- (c) Con UN conto, si riempie da se'.
  insert into conti_bancari (entity_id, nome) values (v_entita, 'verifica-conto-A-20260824')
  returning id into v_a;

  insert into cash_movements (entity_id, direction, amount, causale_id, movement_date, mezzo, business_purpose)
  values (v_entita, 'uscita', 1.00, v_causale, current_date, 'banca', 'verifica-conto-20260824')
  returning id, conto_id into v_mov, v_conto;
  if v_conto is distinct from v_a then
    raise exception 'Con un conto solo il movimento non e'' stato attribuito: %.', v_conto;
  end if;
  delete from cash_movements where id = v_mov;

  -- (d) 🔴 CON DUE, LO PRETENDE. E' il momento in cui «banca» smette di
  --     essere un posto.
  insert into conti_bancari (entity_id, nome) values (v_entita, 'verifica-conto-B-20260824')
  returning id into v_b;

  v_respinto := false;
  begin
    insert into cash_movements (entity_id, direction, amount, causale_id, movement_date, mezzo, business_purpose)
    values (v_entita, 'uscita', 1.00, v_causale, current_date, 'banca', 'verifica-conto-20260824');
  exception when sqlstate 'P0001' then v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Con due conti attivi il movimento e'' passato senza dire su quale.';
  end if;

  -- (e) ⚠️ IL VERSO OPPOSTO: dicendo quale, passa. Un vincolo che
  --     rifiuta anche il caso buono e'' peggio di nessun vincolo.
  insert into cash_movements (entity_id, direction, amount, causale_id, movement_date, mezzo, conto_id, business_purpose)
  values (v_entita, 'uscita', 1.00, v_causale, current_date, 'banca', v_b, 'verifica-conto-20260824')
  returning id into v_mov;
  delete from cash_movements where id = v_mov;

  -- (f) ⚠️ E LA CASSA NON C'ENTRA: un movimento in contanti non deve mai
  --     chiedere un conto bancario, nemmeno con dieci conti aperti.
  insert into cash_movements (entity_id, direction, amount, causale_id, movement_date, mezzo, business_purpose)
  values (v_entita, 'uscita', 1.00, v_causale, current_date, 'cassa', 'verifica-conto-20260824')
  returning id into v_mov;
  delete from cash_movements where id = v_mov;

  -- (h) 🔴 IL LEGAME RIFIUTA, NON SCOLLEGA — e senza questa prova non lo
  --     verificava niente: la colonna si crea con `if not exists`, quindi
  --     riapplicando la migrazione una regola cambiata nella definizione
  --     non ha nessun effetto, e la controprova restava verde.
  --     ⚠️ E' il difetto dello SCHEMA chiuso il 16/08 sulle fatture: un
  --     conto che sparisce lasciando i suoi movimenti senza padrone.
  declare v_regola text; v_bloccato boolean := false;
  begin
    select confdeltype into v_regola
      from pg_constraint
     where conrelid = 'cash_movements'::regclass and contype = 'f'
       and confrelid = 'conti_bancari'::regclass;
    if v_regola is distinct from 'r' then
      raise exception 'Il legame verso il conto e'' «%» invece di «r» (rifiuta).', v_regola;
    end if;

    -- E morde davvero: un conto con un movimento sopra non si cancella.
    insert into cash_movements (entity_id, direction, amount, causale_id, movement_date, mezzo, conto_id, business_purpose)
    values (v_entita, 'uscita', 1.00, v_causale, current_date, 'banca', v_a, 'verifica-conto-20260824')
    returning id into v_mov;
    begin
      delete from conti_bancari where id = v_a;
    exception when foreign_key_violation then v_bloccato := true;
    end;
    if not v_bloccato then
      raise exception 'Un conto con dei movimenti sopra e'' stato cancellato.';
    end if;
    delete from cash_movements where id = v_mov;
  end;

  -- (g) Si toglie quello che ha creato lei, per identificativo.
  delete from conti_bancari where id in (v_a, v_b);

  alter table cash_movements enable trigger trg_log_delete;

  -- Riacceso va VERIFICATO: lasciarlo spento vuol dire movimenti
  -- cancellati che smettono di lasciare traccia, in silenzio.
  declare v_acceso boolean;
  begin
    select t.tgenabled <> 'D' into v_acceso
      from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
     where cl.relname = 'cash_movements' and t.tgname = 'trg_log_delete';
    if not coalesce(v_acceso, false) then
      raise exception 'Il registro delle cancellazioni e'' rimasto spento sui movimenti.';
    end if;
  end;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il posto del conto c''e'': tace con uno, lo pretende con due, e la cassa non lo chiede mai.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000019', 'il_posto_dove_sta_il_conto') on conflict (version) do nothing;
