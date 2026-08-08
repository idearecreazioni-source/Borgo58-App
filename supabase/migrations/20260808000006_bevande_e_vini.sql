-- ---------------------------------------------------------------------
-- Bevande e vini (§3.2.1) — deciso da Alessio l'08/08/2026
-- ---------------------------------------------------------------------
-- La carta dei vini e' una schermata a se' nel disegno delle comande, ma
-- finora non aveva da dove pescare i dati: il Ricettario modella i piatti,
-- e menu_items pretende una ricetta collegata. Un Nero d'Avola non e' una
-- ricetta e non lo diventera' mai.
--
-- Deciso: vini e bevande si gestiscono nell'Editor Menu insieme al resto
-- dell'offerta, ma vivono in una tabella propria invece di essere forzati
-- dentro le ricette. In sala, oggi, l'unico modo di ordinarli e' la "voce
-- libera" riscritta a mano ogni volta.
--
-- Due livelli:
--   section  = 'vini' (schermata carta dei vini, separata) o 'bevande'
--              (elenco principale, accanto ai piatti)
--   category = il gruppo dentro la sezione: bollicine, bianchi, rossi,
--              rosati, meditazione / birre, analcolici, caffetteria...
--              Testo libero di proposito: la carta di un'osteria cambia, e
--              non deve servire una migrazione per aggiungere "vermouth".
--
-- Idempotente (§7 punto 3).

create table if not exists bar_items (
  id            uuid primary key default gen_random_uuid(),
  section       text not null check (section in ('vini', 'bevande')),
  category      text not null,
  name          text not null,
  producer      text,                                   -- cantina o produttore
  serving       text,                                   -- "calice", "bottiglia", "33 cl"
  selling_price numeric(12,2) not null check (selling_price >= 0),
  position      integer not null default 0,
  active        boolean not null default true,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table bar_items is
  'Vini e bevande in carta (§3.2.1). Tabella propria e non menu_items: quest''ultima pretende una ricetta collegata, e una bevanda non e'' una ricetta. Nessuna colonna economica riservata (il prezzo di vendita lo deve vedere anche la sala), quindi niente vista _display: basta la RLS.';

comment on column bar_items.section is
  'vini = finiscono nella schermata separata "Carta dei vini"; bevande = compaiono nell''elenco principale accanto ai piatti.';
comment on column bar_items.serving is
  'Formato servito: calice, bottiglia, 33 cl. Lo stesso vino puo'' stare in carta due volte con prezzi diversi.';
comment on column bar_items.selling_price is
  'Prezzo che paga il cliente, IVA INCLUSA (confermato da Alessio l''08/08/2026). E'' l''importo che finisce sul conto cosi'' com''e''.';

-- Correzione di una scritta sbagliata su menu_items.selling_price, che
-- diceva "IVA esclusa". I prezzi del menu sono e sono sempre stati quelli
-- che paga il cliente, IVA inclusa — confermato da Alessio l'08/08/2026.
-- Non e' pignoleria: e' la nota che, il giorno dell'integrazione col
-- registratore telematico, farebbe aggiungere l'IVA a un prezzo che ce
-- l'ha gia' dentro.
comment on column menu_items.selling_price is
  'Prezzo che paga il cliente, IVA INCLUSA. La dicitura precedente ("IVA esclusa") era errata: corretta l''08/08/2026 dopo conferma di Alessio. NON aggiungere IVA a questo importo.';

create index if not exists idx_bar_items_carta
  on bar_items(section, category, position) where active;

drop trigger if exists trg_bar_items_updated_at on bar_items;
create trigger trg_bar_items_updated_at before update on bar_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: la sala legge, solo il titolare modifica la carta
-- ---------------------------------------------------------------------
-- Il prezzo di vendita qui NON e' un dato riservato: senza, la sala non
-- puo' prendere un ordine ne' fare il conto. Quello che resta al titolare
-- e' decidere cosa c'e' in carta e a quanto.
-- La restrizione va replicata su ogni operazione, non solo su select
-- (§3.18): in Postgres sono policy indipendenti.
alter table bar_items enable row level security;

drop policy if exists bar_items_select_all on bar_items;
create policy bar_items_select_all on bar_items
  for select to authenticated using (true);

drop policy if exists bar_items_ins_titolare on bar_items;
create policy bar_items_ins_titolare on bar_items
  for insert to authenticated with check ((select is_titolare()));

drop policy if exists bar_items_upd_titolare on bar_items;
create policy bar_items_upd_titolare on bar_items
  for update to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists bar_items_del_titolare on bar_items;
create policy bar_items_del_titolare on bar_items
  for delete to authenticated using ((select is_titolare()));

grant select, insert, update, delete on bar_items to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  policy_count integer;
  rls_attiva boolean;
  id_prova uuid;
begin
  if to_regclass('public.bar_items') is null then
    raise exception 'La tabella bar_items non esiste: la migrazione non ha fatto quello che dichiara.';
  end if;

  select relrowsecurity into rls_attiva
  from pg_class where oid = 'public.bar_items'::regclass;
  if not rls_attiva then
    raise exception 'RLS non attiva su bar_items: la carta sarebbe modificabile da chiunque.';
  end if;

  select count(*) into policy_count
  from pg_policies where schemaname = 'public' and tablename = 'bar_items';
  if policy_count < 4 then
    raise exception 'bar_items ha solo % policy: servono select/insert/update/delete (§3.18).', policy_count;
  end if;

  -- Il vincolo sulla sezione deve reggere: una carta con sezioni
  -- inventate manderebbe i vini nella schermata sbagliata.
  begin
    insert into bar_items (section, category, name, selling_price)
    values ('sezione_inesistente', 'x', 'prova', 1)
    returning id into id_prova;
    delete from bar_items where id = id_prova;
    raise exception 'Il vincolo sulla sezione non funziona: accettata una sezione inventata.';
  exception
    when check_violation then null;
  end;

  raise notice 'bar_items pronta: % policy, RLS attiva, sezioni vincolate a vini/bevande.', policy_count;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260808000006', 'bevande_e_vini')
on conflict (version) do nothing;

select
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'bar_items') as policy,
  (select count(*) from bar_items)                                                           as voci_in_carta;
