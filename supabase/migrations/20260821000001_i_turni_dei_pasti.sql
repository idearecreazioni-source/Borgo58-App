-- I TURNI DEI PASTI — la cucina sa con quali turni escono le pietanze
-- =====================================================================
-- Deciso da Alessio il 21/08/2026. Misura in
-- docs/referti/20260821_i_turni_dei_pasti.md.
--
-- 🔴 IL TURNO STA SULLA RIGA, E NON POTEVA STARE ALTROVE. La Cucina
-- raggruppa da sempre per invio (`order_id + sent_at`), e `sendDraftItems`
-- scrive **un solo istante su tutte le righe** che partono insieme: segnando
-- la comanda intera e premendo «Invia» una volta — che è il caso normale —
-- antipasti, pasta, secondi e dolci escono con lo stesso orario, cioè un
-- foglio solo e nessun turno. E al contrario, un piatto aggiunto dieci
-- minuti dopo ma **dello stesso turno** prende un istante diverso: due
-- fogli per una cosa sola. Il difetto si vede nei due versi, quindi turno e
-- invio sono due cose diverse.
--
-- 🔴 E IL TURNO NON SI DEDUCE MAI DALLA CATEGORIA DEL PIATTO. Nell'esempio
-- di Alessio il primo turno ha **due antipasti e una pasta**: i turni li
-- compone lui, secondo come vuole far mangiare quel tavolo. Una regola che
-- li ricavasse dalla portata sbaglierebbe **in silenzio**, e sembrerebbe
-- giusta a chi non era al tavolo.

-- ---------------------------------------------------------------------
-- 1 · Il turno della riga
-- ---------------------------------------------------------------------
-- ⚠️ IL PREDEFINITO 1 È UNA RISPOSTA, e qui è quella GIUSTA — che è il
-- motivo per cui si può mettere. La regola del 14/08 dice che un valore
-- predefinito su righe già esistenti risponde al posto di chi usa il
-- gestionale; qui la risposta è vera per costruzione: **finora tutta la
-- comanda usciva insieme**, cioè era tutta il primo turno. Non si sta
-- indovinando niente.
alter table order_items
  add column if not exists turno smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'order_items'::regclass and conname = 'order_items_turno_check'
  ) then
    -- ⚠️ Nessun tetto: quanti turni faccia un tavolo lo decide Alessio, e un
    -- massimo scritto qui sarebbe una regola nostra sul suo servizio.
    alter table order_items add constraint order_items_turno_check check (turno >= 1);
  end if;
end $$;

comment on column order_items.turno is
  'Il turno con cui questa pietanza esce dalla cucina. Lo compone chi serve, non si deduce MAI dalla categoria del piatto: nel primo turno possono esserci due antipasti e una pasta. 1 di partenza = tutto insieme, che è come si lavorava prima del 21/08.';

-- ---------------------------------------------------------------------
-- 2 · «Avanti col prossimo turno»
-- ---------------------------------------------------------------------
-- 🔴 IL BIGLIETTO È GENERICO E SENZA LIMITAZIONI, deciso da Alessio: non
-- conta i turni, non si spegne quando sono finiti, non impedisce di premerlo
-- due volte. **La cucina ha già la comanda completa e vede da sé cosa resta
-- da cucinare** — il biglietto dice solo «adesso». Era stata proposta la
-- versione che dichiara quale turno sta chiamando e si spegne alla fine:
-- l'ha scartata, e non si rimette da qui.
--
-- 🔴 PERCHÉ È UNA RIGA E NON UN MESSAGGIO A SCHERMO. Il biglietto esce dalla
-- **stampante**: all'apertura in cucina ci saranno mini-PC, tablet e
-- termiche. Il pattern è quello dell'ARCHITETTURA §4.2 — *l'app scrive la
-- richiesta in una tabella, l'agente la legge, stampa e segna l'esito* —
-- e una riga funziona con tutti e due i lettori: **oggi** la pagina Cucina,
-- dove qualcuno guarda e preme; **domani** l'agente sul mini-PC, senza
-- cambiare niente qui.
--
-- ⚠️ E QUESTA NON È LA CODA DI STAMPA, che **non esiste** (misurato il
-- 21/08: zero tabelle). È il contenuto di un biglietto, che si conserva e
-- sa se è già uscito. Il giorno che la coda si costruisce, questa riga
-- diventa ciò che la coda legge — non la coda stessa. Farla adesso vorrebbe
-- dire disegnare la coda intorno all'unico documento che oggi la userebbe.
create table if not exists chiamate_turno (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  creata_il   timestamptz not null default now(),
  creata_da   uuid,
  -- Quando è uscita dalla stampante. Stessa forma di `order_items.prepared_at`
  -- nella pagina Cucina: qui «stampata» vuol dire *il foglio è uscito*, non
  -- *la cucina ha capito*.
  stampata_il timestamptz
);

comment on table chiamate_turno is
  'Un biglietto «avanti col prossimo turno» mandato in cucina: la frase e il numero del tavolo. Generico per decisione di Alessio (21/08): non dice quale turno, non si spegne, non conta niente.';

create index if not exists idx_chiamate_turno_da_stampare
  on chiamate_turno (creata_il) where stampata_il is null;

alter table chiamate_turno enable row level security;

-- Tabella condivisa: chi serve la crea, chi stampa la segna. Nessun dato
-- economico, quindi le stesse policy delle comande.
do $$
begin
  if not exists (select 1 from pg_policy where polrelid = 'chiamate_turno'::regclass and polname = 'chiamate_turno_select_all') then
    create policy chiamate_turno_select_all on chiamate_turno for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'chiamate_turno'::regclass and polname = 'chiamate_turno_insert_all') then
    create policy chiamate_turno_insert_all on chiamate_turno for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'chiamate_turno'::regclass and polname = 'chiamate_turno_update_all') then
    create policy chiamate_turno_update_all on chiamate_turno for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'chiamate_turno'::regclass and polname = 'chiamate_turno_delete_titolare') then
    create policy chiamate_turno_delete_titolare on chiamate_turno for delete to authenticated using ((select is_titolare()));
  end if;
end $$;

-- ⚠️ L'INVARIANTE STA NEL DATABASE, non nella schermata (Contratto §4): un
-- biglietto su un conto già chiuso non vuol dire niente, e il pulsante che
-- lo evita è una difesa sola. Il messaggio dice cosa fare al posto suo.
create or replace function vieta_chiamata_su_conto_chiuso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stato text;
begin
  select status into v_stato from orders where id = new.order_id;
  if v_stato is distinct from 'aperto' then
    raise exception 'Questo tavolo non ha un conto aperto: non c''è nessun turno da chiamare.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chiamata_su_conto_aperto on chiamate_turno;
create trigger trg_chiamata_su_conto_aperto
  before insert on chiamate_turno
  for each row execute function vieta_chiamata_su_conto_chiuso();

revoke all on function vieta_chiamata_su_conto_chiuso() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente    uuid;
  v_ordine  uuid;
  v_riga    uuid;
  v_chiam   uuid;
  v_turno   smallint;
  respinto  boolean := false;
  v_lapidi  integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  insert into orders (entity_id, table_label, status, note)
  values (v_ente, 'VERIFICA turni', 'aperto', 'VERIFICA turni')
  returning id into v_ordine;

  -- --- Il predefinito: una riga senza turno e' il primo ---
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_ordine, 'VERIFICA antipasto', 'cucina', 1, 10)
  returning id into v_riga;
  select turno into v_turno from order_items where id = v_riga;
  if v_turno <> 1 then
    raise exception 'Una riga senza turno non nasce nel primo: dice %.', v_turno;
  end if;

  -- --- E i turni si scrivono ---
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
  values (v_ordine, 'VERIFICA secondo', 'cucina', 3, 20, 2);
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
  values (v_ordine, 'VERIFICA dolce', 'cucina', 2, 6, 3);
  if (select count(distinct turno) from order_items where order_id = v_ordine) <> 3 then
    raise exception 'I tre turni non risultano distinti.';
  end if;

  -- --- Turno zero: respinto ---
  begin
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
    values (v_ordine, 'VERIFICA turno zero', 'cucina', 1, 1, 0);
  exception when check_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Un turno zero si e'' lasciato scrivere.';
  end if;

  -- --- Il biglietto: si crea su un conto aperto ---
  insert into chiamate_turno (order_id) values (v_ordine) returning id into v_chiam;
  if (select stampata_il from chiamate_turno where id = v_chiam) is not null then
    raise exception 'Un biglietto appena creato risulta gia'' stampato.';
  end if;

  -- --- E si puo' premere due volte: e' voluto ---
  -- ⚠️ Decisione di Alessio: il biglietto e' generico e non si spegne. Se un
  -- domani qualcuno mettesse un blocco, questo controllo diventa rosso e
  -- costringe a rileggere la decisione invece di scoprirla.
  insert into chiamate_turno (order_id) values (v_ordine);
  if (select count(*) from chiamate_turno where order_id = v_ordine) <> 2 then
    raise exception 'Il secondo biglietto sullo stesso tavolo e'' stato rifiutato: qualcuno ha messo un limite che Alessio aveva scartato.';
  end if;

  -- --- Su un conto chiuso: respinto dal DATABASE, non dalla schermata ---
  update orders set status = 'chiuso', closed_at = now() where id = v_ordine;
  respinto := false;
  begin
    insert into chiamate_turno (order_id) values (v_ordine);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un biglietto si e'' lasciato scrivere su un conto chiuso.';
  end if;

  -- --- Pulizia del perimetro ---
  -- ⚠️ IL CONTO SI RIAPRE PRIMA DI PULIRE, e il perche' vale la riga: su un
  -- conto chiuso il database RIFIUTA di togliere una riga servita (regola
  -- del 16/08 — il totale su cui si e' incassato non deve cambiare dopo).
  -- La verifica lo ha scoperto fermandosi, non rileggendo: e' la rete che
  -- funziona, non un intralcio da aggirare.
  update orders set status = 'aperto', closed_at = null where id = v_ordine;
  delete from chiamate_turno where order_id = v_ordine;
  -- ⚠️ E IL REGISTRO DELLE CANCELLAZIONI NON DEVE PRENDERSI LE RIGHE DI
  -- PROVA: `order_items` e' fra le tabelle tracciate, quindi ognuna di
  -- queste tre righe lascerebbe una **lapide** che nessuno puo' ripulire
  -- dall'app — dati finti in mezzo a un registro esibibile (difetto vero
  -- del 19/08). Il trigger si spegne per la sola pulizia e si riaccende
  -- CONTROLLANDO che sia riacceso: lasciarlo spento vorrebbe dire perdere
  -- in silenzio le cancellazioni vere.
  alter table order_items disable trigger trg_log_delete;
  delete from order_items where order_id = v_ordine;
  alter table order_items enable trigger trg_log_delete;
  if (select tgenabled from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where c.relname = 'order_items' and t.tgname = 'trg_log_delete') <> 'O' then
    raise exception 'Il registro delle cancellazioni e'' rimasto spento su order_items.';
  end if;
  delete from orders where id = v_ordine;

  if (select count(*) from deleted_records) <> v_lapidi then
    raise exception 'Le lapidi sono passate da % a %.', v_lapidi, (select count(*) from deleted_records);
  end if;

  raise notice 'Turni: predefinito 1, tre turni distinti, turno zero respinto; biglietto creabile due volte di fila e respinto su un conto chiuso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260821000001', 'i_turni_dei_pasti')
on conflict (version) do nothing;
