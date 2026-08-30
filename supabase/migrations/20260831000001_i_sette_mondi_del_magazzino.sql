-- =====================================================================
-- I SETTE MONDI DEL MAGAZZINO — 31/08/2026
-- =====================================================================
--
-- 🔴 LA DECISIONE E' DI ALESSIO, e l'ordine e' il suo: **Alimentari · Vini ·
-- Bevande · Liquori e distillati · Materiale di consumo · Pulizia e
-- sanificazione · Varie ed eventuali**.
--
-- 🔴 IL DIFETTO CHE CHIUDE, MISURATO PRIMA DI SCRIVERE. Oggi i mondi sono
-- **DUE** — `categorie_ingrediente.ambito`, che vale 'alimenti' (15
-- categorie) o 'materiali' (6). Quindi un vino finirebbe dentro la categoria
-- «Bevande» del mondo 'alimenti', **in mezzo alla farina e al pesce**.
--
-- ⚠️ E SI FA ADESSO PERCHE' ADESSO COSTA ZERO: misurato il 31/08 sul
-- gestionale vero, gli ingredienti sono **ZERO**, le confezioni **ZERO**, le
-- voci di carta **ZERO**. Non c'e' niente da riclassificare. Fra un mese, con
-- quaranta etichette caricate, la stessa modifica avrebbe dentro una
-- decisione su ogni riga gia' scritta — e quelle decisioni non hanno una
-- risposta giusta.
--
-- ⚠️ VALE LA REGOLA DEL 27/08: **una categoria spenta resta legale** per i
-- prodotti che la portano, non si distrugge. Qui non si spegne niente: le
-- categorie esistenti **cambiano mondo**, che e' un'altra cosa.
--
-- ---------------------------------------------------------------------
-- DOVE VA OGNI CATEGORIA CHE C'E' GIA', e perche'
-- ---------------------------------------------------------------------
--   · le 14 categorie alimentari  → «Alimentari»
--   · `bevande`                   → «Bevande»  ⚠️ NON si spegne e non si
--     duplica: **cambia mondo**. Spegnerla e crearne una gemella lascerebbe
--     due parole per la stessa cosa, che e' il difetto chiuso il 30/08 con
--     «Varie ed eventuali» e «Altro».
--   · `pulizia`                   → «Pulizia e sanificazione» (mondo suo)
--   · `varie_materiali`           → «Varie ed eventuali» (mondo suo)
--   · le altre 4 dei materiali    → «Materiale di consumo»
--
-- ⚠️ VINI E LIQUORI NASCONO CON LE LORO CATEGORIE, ed e' una PROPOSTA da
-- correggere, non un dato deciso. Senza, quei due mondi nascerebbero vuoti e
-- un vino non avrebbe dove stare — cioe' il mondo esisterebbe e non
-- servirebbe a niente. Il precedente e' del 29/08 sui materiali: *«ha chiesto
-- esplicitamente che le proponga io e che lui le corregga leggendo»*.
-- Il mondo «Bevande» invece la categoria ce l'ha gia' e non se ne inventano
-- altre.

-- ---------------------------------------------------------------------
-- 1. IL CATALOGO DEI MONDI — elenco chiuso, come le sezioni dell'archivio
-- ---------------------------------------------------------------------
create table if not exists mondi_magazzino (
  codice text primary key,
  nome   text not null,
  ordine integer not null,
  attivo boolean not null default true,
  creato_il timestamptz not null default now()
);

comment on table mondi_magazzino is
  'I sette mondi in cui si divide il magazzino (Alessio, 31/08/2026). Elenco '
  'chiuso: una categoria appartiene a uno di questi e a nessun altro.';
comment on column mondi_magazzino.ordine is
  'L''ordine e'' quello deciso da Alessio, non alfabetico e non per quantita'': '
  'un mondo che si sposta perche'' e'' cresciuto e'' un mondo che si cerca due volte.';

alter table mondi_magazzino enable row level security;

drop policy if exists mondi_magazzino_select on mondi_magazzino;
create policy mondi_magazzino_select on mondi_magazzino
  for select to authenticated using (true);

drop policy if exists mondi_magazzino_scrittura on mondi_magazzino;
create policy mondi_magazzino_scrittura on mondi_magazzino
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

insert into mondi_magazzino (codice, nome, ordine) values
  ('alimentari',        'Alimentari',              1),
  ('vini',              'Vini',                    2),
  ('bevande',           'Bevande',                 3),
  ('liquori',           'Liquori e distillati',    4),
  ('materiale_consumo', 'Materiale di consumo',    5),
  ('pulizia',           'Pulizia e sanificazione', 6),
  ('varie',             'Varie ed eventuali',      7)
on conflict (codice) do nothing;

-- ---------------------------------------------------------------------
-- 2. OGNI CATEGORIA APPARTIENE A UN MONDO
-- ---------------------------------------------------------------------
alter table categorie_ingrediente add column if not exists mondo text;

-- ⚠️ La sanatoria dichiara quante righe tocca (regola del 16/08): uno zero
--    non e' un errore — vuol dire «gia' fatto» — ma va detto.
do $sanatoria$
declare v_n integer;
begin
  update categorie_ingrediente set mondo = case
    when codice = 'bevande'         then 'bevande'
    when codice = 'pulizia'         then 'pulizia'
    when codice = 'varie_materiali' then 'varie'
    when ambito = 'materiali'       then 'materiale_consumo'
    else 'alimentari'
  end
  where mondo is null;
  get diagnostics v_n = row_count;
  raise notice 'Categorie a cui e'' stato dato un mondo: %', v_n;
end $sanatoria$;

-- Le categorie proposte per i due mondi che nascerebbero vuoti.
insert into categorie_ingrediente (codice, nome, ordine, attiva, di_sistema, ambito, mondo) values
  ('vino_rosso',      'Rosso',                300, true, true, 'alimenti', 'vini'),
  ('vino_bianco',     'Bianco',               310, true, true, 'alimenti', 'vini'),
  ('vino_rosato',     'Rosato',               320, true, true, 'alimenti', 'vini'),
  ('vino_bollicine',  'Bollicine',            330, true, true, 'alimenti', 'vini'),
  ('vino_dolce',      'Dolce e da meditazione',340, true, true, 'alimenti', 'vini'),
  ('liquori_amari',   'Amari',                400, true, true, 'alimenti', 'liquori'),
  ('liquori_distillati','Distillati',         410, true, true, 'alimenti', 'liquori'),
  ('liquori_dolci',   'Liquori dolci',        420, true, true, 'alimenti', 'liquori')
on conflict (codice) do nothing;

alter table categorie_ingrediente alter column mondo set not null;

alter table categorie_ingrediente drop constraint if exists categorie_ingrediente_mondo_fkey;
alter table categorie_ingrediente
  add constraint categorie_ingrediente_mondo_fkey
  foreign key (mondo) references mondi_magazzino(codice) on delete restrict;

comment on column categorie_ingrediente.mondo is
  'Il mondo del magazzino a cui questa categoria appartiene (31/08/2026). '
  'Legame, non testo: un ottavo mondo non si puo'' scrivere.';
comment on column categorie_ingrediente.ambito is
  'PRECEDE i mondi e resta per non riscrivere il passato: dice se una '
  'categoria e'' nata fra gli alimenti o fra i materiali. Chi deve sapere '
  'DOVE sta una cosa nel magazzino guarda `mondo`, non questa.';

-- ---------------------------------------------------------------------
-- 3. L'ELENCO DEI MONDI, COL CONTO DI COSA CI SIA DENTRO
-- ---------------------------------------------------------------------
-- ⚠️ Il conto lo fa il database e non la schermata: due posti che contano la
--    stessa cosa prima o poi dicono due numeri diversi.
create or replace function mondi_del_magazzino()
returns table (codice text, nome text, ordine integer, attivo boolean, quanti_prodotti integer)
language sql
stable
security invoker
set search_path = public
as $$
  select m.codice, m.nome, m.ordine, m.attivo,
         (select count(*)::integer
            from ingredients i
            join categorie_ingrediente c on c.codice = i.category
           where c.mondo = m.codice)
    from mondi_magazzino m
   order by m.ordine;
$$;

comment on function mondi_del_magazzino is
  'I sette mondi con quanti prodotti ci sono dentro. `security invoker`: '
  'decide la RLS di `ingredients`, non una seconda serratura da tenere '
  'allineata.';

revoke all on function mondi_del_magazzino() from public, anon, authenticated;
grant execute on function mondi_del_magazzino() to authenticated;

-- ---------------------------------------------------------------------
-- 4. VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_mondi integer; v_senza integer; v_bevande text; v_pulizia text; v_varie text;
  v_carta text; v_alim integer; v_ok boolean;
begin
  select count(*) into v_mondi from mondi_magazzino;
  if v_mondi <> 7 then
    raise exception 'I mondi devono essere 7, sono %', v_mondi;
  end if;

  -- Nessuna categoria senza mondo: e' la proprieta' che il `not null` e la
  -- chiave esterna rendono vera, e la si controlla invece di sperarla.
  select count(*) into v_senza from categorie_ingrediente where mondo is null;
  if v_senza <> 0 then
    raise exception '% categorie senza mondo', v_senza;
  end if;

  -- Le tre categorie che il mandato nomina una per una.
  select mondo into v_bevande from categorie_ingrediente where codice = 'bevande';
  select mondo into v_pulizia from categorie_ingrediente where codice = 'pulizia';
  select mondo into v_varie   from categorie_ingrediente where codice = 'varie_materiali';
  -- ⚠️ `is distinct from` e non `<>`: contro un valore che puo' essere vuoto
  --    un `<>` vale NULL e l'if NON entra — cioe' approverebbe proprio la
  --    rottura che deve prendere (trappola del 27/08).
  if v_bevande is distinct from 'bevande' then
    raise exception 'Bevande deve stare nel mondo bevande, sta in %', coalesce(v_bevande,'(vuoto)');
  end if;
  if v_pulizia is distinct from 'pulizia' then
    raise exception 'Pulizia deve essere un mondo suo, sta in %', coalesce(v_pulizia,'(vuoto)');
  end if;
  if v_varie is distinct from 'varie' then
    raise exception 'Varie ed eventuali deve essere un mondo suo, sta in %', coalesce(v_varie,'(vuoto)');
  end if;

  -- Le altre quattro dei materiali restano dentro «Materiale di consumo».
  select mondo into v_carta from categorie_ingrediente where codice = 'carta_monouso';
  if v_carta is distinct from 'materiale_consumo' then
    raise exception 'Carta e monouso deve stare in materiale_consumo, sta in %', coalesce(v_carta,'(vuoto)');
  end if;

  -- Gli alimenti restano fra gli Alimentari, meno le bevande.
  select count(*) into v_alim from categorie_ingrediente
   where ambito = 'alimenti' and mondo = 'alimentari';
  if v_alim < 14 then
    raise exception 'Gli Alimentari dovrebbero avere almeno 14 categorie, ne hanno %', v_alim;
  end if;

  -- Un ottavo mondo dev'essere IMPOSSIBILE, non sconsigliato.
  begin
    insert into categorie_ingrediente (codice, nome, ordine, ambito, mondo)
    values ('__prova__', 'Prova', 999, 'alimenti', 'mondo_inventato');
    raise exception 'UN MONDO INVENTATO E'' PASSATO: il legame non tiene';
  exception when foreign_key_violation then
    null; -- respinto, com'e' giusto
  end;

  -- E la funzione RISPONDE, non solo esiste: un corpo che si crea non e' un
  -- corpo che funziona (lezione del 17/08).
  select count(*) = 7 into v_ok from mondi_del_magazzino();
  if not v_ok then
    raise exception 'mondi_del_magazzino() non restituisce i sette mondi';
  end if;

  raise notice 'Fatto: sette mondi, ogni categoria ne ha uno, un ottavo e'' respinto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000001', 'i_sette_mondi_del_magazzino') on conflict (version) do nothing;
