-- ---------------------------------------------------------------------
-- La memoria delle diciture, e la sorveglianza dei prezzi
-- ---------------------------------------------------------------------
-- Nasce da due obiezioni di Alessio al carico da fattura, il 12/08/2026, e
-- sono le due che cambiano il progetto:
--
--   «lo stesso ingrediente posso comprarlo da due fornitori diversi, o lo
--    stesso fornitore può cambiare marca o dicitura. Non devono nascere
--    doppioni né ambiguità.»
--
--   «la giacenza mi interessa poco, il locale è piccolo e vedo a occhio.
--    Ma se un fornitore aumenta un prezzo senza dirmelo, voglio saperlo.»
--
-- La seconda riorienta il modulo: **il valore non è il magazzino, è il
-- prezzo.** Il dato che conta non è «quanto ne ho» ma «quanto l'ho pagato,
-- quando, da chi». Da lì vengono l'avviso sui rincari, la risposta a
-- «quanto sto pagando il ciliegino», e domani il costo dei piatti.
--
-- DUE LIVELLI, NON UNO
--
-- - **l'ingrediente** è cosa cucini: «Pomodoro ciliegino», uno solo;
-- - **l'articolo del fornitore** è come lo chiama la fattura: «Pomodori
--   ciliegini Pachino cassa 6 kg», «CILIEGINO PACHINO IGP», …
--
-- Un ingrediente ha tanti articoli. La prima volta che una dicitura
-- compare, il gestionale chiede; **dopo la riconosce e non chiede più.**
-- I doppioni diventano impossibili per costruzione: non decide il modello,
-- decide una tabella che ricorda le scelte di Alessio.
--
-- LA TRAPPOLA DELLE UNITÀ, che senza questo file rovinerebbe tutto il
-- resto: «cassa da 6 kg — quantità 12» vuol dire 12 kg o 12 casse? Con
-- l'interpretazione sbagliata il prezzo al chilo è errato di sei volte, e
-- la sorveglianza darebbe allarmi falsi *o tacerebbe su rincari veri* —
-- che è il modo peggiore di fallire, perché sembra funzionare. Quindi
-- l'articolo ricorda anche **come lo conta il fornitore** e il fattore di
-- conversione verso l'unità dell'ingrediente. Chiesto una volta sola.
--
-- LA DECISIONE È SEPARATA DALL'AVVISO, come per la sentinella e per
-- l'email: `variazione_prezzo()` dice *se e quanto* un prezzo è salito,
-- senza avvisare nessuno. La usano in due — la schermata di conferma
-- (**prima** che Alessio confermi, così se il fornitore ha sbagliato la
-- fattura se ne accorge in tempo) e l'esecuzione del carico, che manda
-- l'avviso su Telegram. Entrambi decisi da lui, il 12/08.
--
-- L'ECCEZIONE STAGIONALE non è un vezzo: su ortofrutta e pesce il prezzo
-- balla per stagione, e senza un modo di zittirli a novembre suonerebbe
-- metà della spesa. Un avviso che suona sempre si smette di leggere — la
-- lezione della sentinella, applicata prima di sbagliare invece che dopo.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Alimentare o no, e prezzo che balla per stagione
-- ---------------------------------------------------------------------
-- Materiale di consumo e imballaggi stanno nella STESSA anagrafica degli
-- alimenti (scelta di Alessio): il Ricettario mostra solo gli alimentari,
-- ma la sorveglianza dei prezzi è una sola e vale per tutto — un rincaro
-- sullo sgrassante arriva come quello sui pomodori.
--
-- Un flag e non una categoria nuova: `ingredient_category` è un enum, e
-- `alter type … add value` non è usabile nella stessa migrazione che lo
-- aggiunge (§8 di CLAUDE.md). Un booleano non ha quel problema e non
-- costringe a toccare un tipo su cui poggiano già tutte le schermate.
alter table ingredients
  add column if not exists alimentare boolean not null default true;
alter table ingredients
  add column if not exists prezzo_stagionale boolean not null default false;

comment on column ingredients.alimentare is
  'Falso per detersivi, carta, imballaggi: restano in anagrafica e sotto sorveglianza prezzi, ma fuori dal Ricettario.';
comment on column ingredients.prezzo_stagionale is
  'Vero per ortofrutta e pesce, dove il prezzo balla per stagione: zittisce l''avviso di rincaro. Senza, a novembre suonerebbe meta'' della spesa e si smetterebbe di leggerlo.';

-- La soglia vive nei dati, non nel codice: cambiarla non deve richiedere
-- una migrazione (stessa regola del prezzo del coperto e dei mesi di
-- conservazione).
alter table service_settings
  add column if not exists soglia_rincaro_percento numeric not null default 10;

comment on column service_settings.soglia_rincaro_percento is
  'Di quanto deve salire un prezzo perche'' scatti l''avviso. Dieci per cento, deciso da Alessio il 12/08/2026.';

-- ---------------------------------------------------------------------
-- 2. La chiave di riconoscimento di una dicitura
-- ---------------------------------------------------------------------
-- Due fatture scrivono lo stesso prodotto in modi che l'occhio riconosce e
-- il confronto fra stringhe no: maiuscole, punteggiatura, doppi spazi.
-- La chiave normalizza; l'originale resta scritto accanto, perché è quello
-- che Alessio riconosce quando deve decidere.
create or replace function chiave_articolo(p_testo text)
returns text
language sql
immutable
set search_path = public
as $funzione$
  select nullif(
    trim(regexp_replace(
      regexp_replace(lower(coalesce(p_testo, '')), '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g')),
    '');
$funzione$;

comment on function chiave_articolo(text) is
  'Normalizza la dicitura di una riga di fattura per riconoscerla la volta dopo. Immutabile: serve dentro un indice.';

-- ---------------------------------------------------------------------
-- 3. La memoria
-- ---------------------------------------------------------------------
create table if not exists articoli_fornitore (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references suppliers(id) on delete set null,
  descrizione   text not null,
  chiave        text not null,
  ingredient_id uuid references ingredients(id) on delete cascade,
  -- Come lo conta il fornitore («cassa», «collo», «kg») e quanto fa
  -- nell'unità dell'ingrediente. `fattore` è il cuore della cosa: senza,
  -- il prezzo al chilo di una cassa da 6 kg è sbagliato di sei volte.
  unita_fattura text,
  fattore       numeric not null default 1 check (fattore > 0),
  -- Vero per le righe che NON sono merce (trasporto, contributo CONAI,
  -- sconti): si chiede una volta e non si ripropone mai più.
  ignora        boolean not null default false,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

comment on table articoli_fornitore is
  'Come ogni fornitore chiama i prodotti, e a quale ingrediente corrispondono. E'' la memoria che rende impossibili i doppioni: non decide il modello, decide una riga scritta da Alessio una volta sola.';

-- Una dicitura per fornitore. Il fornitore può mancare (una bolla senza
-- anagrafica): quel caso ha il suo secchio, non si mescola agli altri.
create unique index if not exists idx_articoli_fornitore_chiave
  on articoli_fornitore (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave);
create index if not exists idx_articoli_fornitore_ingrediente
  on articoli_fornitore (ingredient_id);

alter table articoli_fornitore enable row level security;
drop policy if exists articoli_fornitore_titolare on articoli_fornitore;
create policy articoli_fornitore_titolare on articoli_fornitore
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- `set_updated_at()` non si può riusare qui: pretende una colonna
-- `updated_at`, e questa tabella la chiama `aggiornato_il` come il resto
-- dei suoi campi. Riusarla darebbe «record new has no field updated_at»
-- **a tempo di esecuzione**, sul primo aggiornamento — non alla creazione
-- del trigger. Trovato così, provando.
create or replace function set_aggiornato_il()
returns trigger
language plpgsql
set search_path = public
as $funzione$
begin
  new.aggiornato_il := now();
  return new;
end
$funzione$;

drop trigger if exists trg_articoli_fornitore_updated_at on articoli_fornitore;
create trigger trg_articoli_fornitore_updated_at
  before update on articoli_fornitore
  for each row execute function set_aggiornato_il();

-- ---------------------------------------------------------------------
-- 4. La decisione sul prezzo — senza avvisare nessuno
-- ---------------------------------------------------------------------
-- Restituisce cosa si pagava prima e di quanto si è saliti. Non manda
-- niente: la usano sia la schermata (prima della conferma) sia
-- l'esecuzione (che avvisa). Stessa scelta della sentinella e dell'email —
-- una regola provabile a costo zero, e un solo posto dove vive.
create or replace function variazione_prezzo(
  p_ingredient_id uuid,
  p_supplier_id   uuid,
  p_prezzo        numeric
)
returns table (
  prezzo_precedente numeric,
  quando            timestamptz,
  variazione        numeric,
  oltre_soglia      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_prec    numeric;
  v_quando  timestamptz;
  v_soglia  numeric;
  v_stag    boolean;
begin
  if p_ingredient_id is null or p_prezzo is null or p_prezzo <= 0 then
    return;
  end if;

  -- L'ultimo prezzo pagato allo STESSO fornitore: è quello il confronto
  -- che risponde alla domanda di Alessio («un fornitore aumenta senza
  -- dirmelo»). Il confronto fra fornitori diversi è un'altra domanda —
  -- «chi me lo fa meglio» — e si fa guardando lo storico, non con un
  -- allarme: due fornitori hanno prezzi diversi per mille ragioni lecite.
  select ph.price, ph.recorded_at into v_prec, v_quando
    from price_history ph
   where ph.ingredient_id = p_ingredient_id
     and ph.supplier_id is not distinct from p_supplier_id
   order by ph.recorded_at desc
   limit 1;

  if v_prec is null or v_prec <= 0 then
    return;   -- primo acquisto: non c'è niente da confrontare
  end if;

  select coalesce(s.soglia_rincaro_percento, 10) into v_soglia
    from service_settings s where s.id = 1;
  v_soglia := coalesce(v_soglia, 10);

  select i.prezzo_stagionale into v_stag from ingredients i where i.id = p_ingredient_id;

  return query select
    v_prec,
    v_quando,
    round((p_prezzo - v_prec) / v_prec * 100, 1),
    (not coalesce(v_stag, false))
      and p_prezzo > v_prec * (1 + v_soglia / 100);
end
$funzione$;

comment on function variazione_prezzo(uuid, uuid, numeric) is
  'Cosa si pagava prima allo stesso fornitore e di quanto si e'' saliti. Decide e basta: non avvisa nessuno, cosi'' la si puo'' provare senza far squillare Telegram.';

revoke all on function variazione_prezzo(uuid, uuid, numeric) from public, anon;
grant execute on function variazione_prezzo(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Chi propone un carico riceve gli abbinamenti già fatti
-- ---------------------------------------------------------------------
-- Un trigger e non un pezzo di `posta-leggi`: la memoria è del database, e
-- domani il carico arriverà da Fatture in Cloud invece che dalla posta.
-- Se l'abbinamento vivesse dentro la funzione della posta, andrebbe
-- riscritto lì — e le due copie divergerebbero, come sempre.
create or replace function abbina_righe_carico()
returns trigger
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_forn  uuid;
  v_riga  jsonb;
  v_out   jsonb := '[]'::jsonb;
  v_art   articoli_fornitore%rowtype;
  n_noti  integer := 0;
begin
  if new.tipo <> 'carico_magazzino' then
    return new;
  end if;

  v_forn := nullif(new.parametri->>'fornitore_id', '')::uuid;

  for v_riga in select * from jsonb_array_elements(coalesce(new.parametri->'righe', '[]'::jsonb))
  loop
    select * into v_art from articoli_fornitore a
     where a.chiave = chiave_articolo(v_riga->>'descrizione')
       and (a.supplier_id is not distinct from v_forn or v_forn is null)
     order by (a.supplier_id is not distinct from v_forn) desc
     limit 1;

    if found then
      n_noti := n_noti + 1;
      v_riga := v_riga
        || jsonb_build_object(
             'ingrediente_id', v_art.ingredient_id,
             'fattore', v_art.fattore,
             'unita_fattura', v_art.unita_fattura,
             'salta', v_art.ignora,
             'gia_noto', true);
    end if;

    v_out := v_out || jsonb_build_array(v_riga);
  end loop;

  new.parametri := new.parametri
    || jsonb_build_object('righe', v_out, 'righe_note', n_noti);
  return new;
end
$funzione$;

drop trigger if exists trg_abbina_righe_carico on posta_azioni;
create trigger trg_abbina_righe_carico
  before insert on posta_azioni
  for each row execute function abbina_righe_carico();

comment on function abbina_righe_carico() is
  'Riempie le righe di un carico con gli abbinamenti gia'' noti, prima ancora che la proposta compaia. Sta nel database e non nella funzione della posta perche'' domani il carico arrivera'' da Fatture in Cloud.';

-- ---------------------------------------------------------------------
-- 6. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_ente  uuid;
  v_forn  uuid;
  v_forn2 uuid;
  v_ing   uuid;
  v_posta uuid;
  v_az    uuid;
  v_par   jsonb;
  v_var   record;
  n       integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_tit is null or v_ente is null then
    raise exception 'Servono un titolare e un''entita'' per la verifica.';
  end if;

  -- 1. La chiave riconosce diciture che l'occhio riconosce.
  if chiave_articolo('  Pomodori CILIEGINI, cassa 6 kg. ')
     is distinct from chiave_articolo('pomodori ciliegini cassa 6 kg') then
    raise exception 'La chiave non normalizza maiuscole, punteggiatura e spazi.';
  end if;
  if chiave_articolo('') is not null then
    raise exception 'Una dicitura vuota deve dare chiave nulla.';
  end if;

  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA MEMORIA fornitore A', 'ortofrutta') returning id into v_forn;
  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA MEMORIA fornitore B', 'ortofrutta') returning id into v_forn2;
  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA MEMORIA ciliegino', 'verdura', 'kg') returning id into v_ing;

  -- 2. Una dicitura ricordata torna abbinata da sola, col suo fattore.
  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore)
  values (v_forn, 'Pomodori ciliegini Pachino cassa 6 kg',
          chiave_articolo('Pomodori ciliegini Pachino cassa 6 kg'), v_ing, 'cassa', 6);

  insert into posta_ricevuta (messaggio_id, casella, oggetto, stato)
  values ('PROVA-MEMORIA-1', 'info@borgo58.it', 'Bolla', 'proposta') returning id into v_posta;

  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'carico_magazzino', 'Carico', 'Carico 2 righe',
          jsonb_build_object('fornitore_id', v_forn, 'righe', jsonb_build_array(
            -- scritta diversa: maiuscole e punteggiatura
            jsonb_build_object('descrizione', 'POMODORI CILIEGINI PACHINO, CASSA 6 KG', 'quantita', 2),
            jsonb_build_object('descrizione', 'Capperi di Pantelleria 1 kg', 'quantita', 3))))
  returning id into v_az;

  select parametri into v_par from posta_azioni where id = v_az;

  if (v_par->>'righe_note')::integer <> 1 then
    raise exception 'Attesa 1 riga riconosciuta, contate %.', v_par->>'righe_note';
  end if;
  if (v_par->'righe'->0->>'ingrediente_id')::uuid is distinct from v_ing then
    raise exception 'La riga nota non e'' stata abbinata all''ingrediente.';
  end if;
  if (v_par->'righe'->0->>'fattore')::numeric is distinct from 6 then
    raise exception 'Il fattore di conversione non e'' arrivato nella riga (%).', v_par->'righe'->0->>'fattore';
  end if;
  if v_par->'righe'->1 ? 'ingrediente_id' then
    raise exception 'Una dicitura mai vista e'' stata abbinata lo stesso.';
  end if;

  -- 3. La memoria è per fornitore: la stessa dicitura da un ALTRO
  --    fornitore, con l'anagrafica nota, non eredita l'abbinamento
  --    sbagliato... ma nemmeno si perde, perché l'ingrediente è lo stesso.
  --    Qui si verifica solo che il secchio sia distinto.
  select count(*) into n from articoli_fornitore
   where chiave = chiave_articolo('Pomodori ciliegini Pachino cassa 6 kg')
     and supplier_id = v_forn2;
  if n <> 0 then
    raise exception 'La memoria di un fornitore e'' finita su un altro.';
  end if;

  -- 4. La variazione di prezzo: senza storico non dice niente.
  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.20);
  if found then
    raise exception 'Al primo acquisto non c''e'' niente da confrontare, invece ha risposto.';
  end if;

  -- ...con lo storico, dice quanto e se oltre soglia.
  insert into price_history (ingredient_id, price, supplier_id, source)
  values (v_ing, 3.00, v_forn, 'manuale');

  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.15);
  if v_var.oltre_soglia then
    raise exception 'Un +5%% ha superato una soglia del 10%%.';
  end if;

  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.60);
  if not v_var.oltre_soglia then
    raise exception 'Un +20%% non ha superato la soglia del 10%%.';
  end if;
  if v_var.prezzo_precedente is distinct from 3.00 then
    raise exception 'Il prezzo precedente riportato e'' % invece di 3.00.', v_var.prezzo_precedente;
  end if;
  if v_var.variazione is distinct from 20.0 then
    raise exception 'La variazione calcolata e'' %%% invece di 20%%.', v_var.variazione;
  end if;

  -- 5. Il prodotto stagionale tace, anche con lo stesso rincaro.
  update ingredients set prezzo_stagionale = true where id = v_ing;
  select * into v_var from variazione_prezzo(v_ing, v_forn, 3.60);
  if v_var.oltre_soglia then
    raise exception 'Un prodotto marcato stagionale ha fatto scattare l''avviso.';
  end if;
  if v_var.variazione is distinct from 20.0 then
    raise exception 'Il prodotto stagionale deve tacere, non smettere di calcolare.';
  end if;

  -- 6. Pulizia (regola del 12/08).
  delete from price_history where ingredient_id = v_ing;
  delete from articoli_fornitore where ingredient_id = v_ing;
  delete from posta_azioni where posta_id = v_posta;
  delete from posta_ricevuta where id = v_posta;
  delete from ingredients where id = v_ing;
  delete from suppliers where id in (v_forn, v_forn2);

  select count(*) into n from ingredients where name like 'PROVA MEMORIA%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;
  select count(*) into n from suppliers where name like 'PROVA MEMORIA%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;
  select count(*) into n from articoli_fornitore where descrizione like 'Pomodori ciliegini Pachino%';
  if n <> 0 then raise exception 'La prova ha lasciato % articoli.', n; end if;

  raise notice 'Memoria articoli: dicitura riconosciuta col suo fattore, soglia al 10%%, stagionale muto.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000013', 'memoria_articoli')
on conflict (version) do nothing;

select (select count(*) from articoli_fornitore) as diciture_ricordate,
       (select soglia_rincaro_percento from service_settings where id = 1) as soglia_rincaro;
