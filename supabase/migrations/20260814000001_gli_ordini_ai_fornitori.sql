-- =====================================================================
-- Gli ordini ai fornitori (Fase B del mandato «filiera della spesa»)
-- =====================================================================
-- La lista si e' riempita (Fase A). Adesso l'ordine deve partire **nella
-- lingua del fornitore**: lui non sa cos'e' il «Pomodoro ciliegino», sa
-- cos'e' la «cassa da 6 kg di Pachino IGP». Quella dicitura il gestionale
-- ce l'ha gia' — e' `articoli_fornitore`, costruita il 12/08 leggendo le
-- fatture — e questa fase serve a usarla nel verso opposto: non piu'
-- «capire cosa mi ha fatturato», ma «chiedergli quello che mi serve
-- chiamandolo come lo chiama lui».
--
-- ---------------------------------------------------------------------
-- LA REGOLA CHE COMANDA TUTTA LA FASE
-- ---------------------------------------------------------------------
-- **Il sistema propone, Alessio invia.** Il gestionale non manda niente:
-- prepara un testo, lo fa correggere, e apre WhatsApp **sul telefono di
-- Alessio, col suo numero**. Un ordine che parte da solo e' un ordine di
-- cui nessuno si e' accorto — e la merce arriva lo stesso.
--
-- ⚠️ **«Inviato» qui vuol dire «ho aperto WhatsApp con questo testo».**
--    Il gestionale non puo' sapere se ha davvero premuto invio, e non
--    deve fingere di saperlo: la schermata lo dice, e un ordine si
--    annulla — le righe tornano da comprare. Registrarlo comunque non e'
--    facoltativo: senza registrazione questa fase nasce cieca e la
--    riconciliazione con la fattura (fuori perimetro, ma prevista) non
--    avra' niente contro cui confrontare.
--
-- ⚠️ **LA TRAPPOLA DELLE UNITA', di nuovo, e stavolta sulle quantita'.**
--    Il 12/08 un `fattore` sbagliato produceva un prezzo al chilo errato
--    di sei volte, e la sorveglianza taceva sui rincari veri. Qui lo
--    stesso numero decide **quante casse chiedere**: servono 10 kg, la
--    cassa e' da 6 → **2 casse, non 1,67**, perche' nessuno vende due
--    terzi di cassa. Si arrotonda **per eccesso** (mancare merce costa
--    piu' che avanzarne) e si scrivono **tutti e due i numeri** nella
--    riga, cosi' un fattore sbagliato si vede prima di premere invio
--    invece che alla consegna.
--
-- ⚠️ **Se non so come lo chiama lui, lo dico.** Un ingrediente senza
--    dicitura per quel fornitore finisce nel testo col **nome interno**,
--    e la riga e' marcata: mai far credere che sia il suo nome. Un
--    ordine con la parola sbagliata si risolve con una telefonata; un
--    ordine che *sembra* nella sua lingua e non lo e' fa arrivare la
--    merce sbagliata.
--
-- ⚠️ **Il numero di telefono si mostra sempre accanto al pulsante.** Un
--    numero senza prefisso normalizzato a caso manderebbe l'ordine a uno
--    sconosciuto. Il gestionale non indovina: normalizza il minimo, e
--    lascia che sia Alessio a vedere dove sta per scrivere.
--
-- **Il confronto fra fornitori non e' una funzione nuova**: e'
-- `varianti_ingrediente()`, la tabella disegnata da Alessio il 12/08, che
-- gia' ordina dalla piu' conveniente e dice chi, quanto e quando.
-- Riusarla invece di riscriverla e' la stessa ragione per cui esiste
-- `orderTotals()`: due regole per la stessa domanda danno due risposte.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. L'ordine e le sue righe
-- ---------------------------------------------------------------------
create table if not exists ordini_fornitore (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references suppliers(id) on delete restrict,
  stato        text not null default 'inviato'
                 check (stato in ('inviato', 'ricevuto', 'annullato')),
  canale       text check (canale in ('whatsapp', 'telefono', 'email', 'altro')),
  testo        text,
  inviato_il   timestamptz not null default now(),
  ricevuto_il  timestamptz,
  note         text,
  creato_da    uuid,
  creato_il    timestamptz not null default now()
);

comment on table ordini_fornitore is
  'Un ordine mandato a un fornitore. «Inviato» vuol dire che il messaggio e'' stato aperto col testo pronto: il gestionale non puo'' sapere se e'' partito davvero, e non finge di saperlo.';

create table if not exists ordini_fornitore_righe (
  id                    uuid primary key default gen_random_uuid(),
  ordine_id             uuid not null references ordini_fornitore(id) on delete cascade,
  shopping_list_item_id uuid references shopping_list_items(id) on delete set null,
  ingredient_id         uuid references ingredients(id) on delete set null,
  articolo_id           uuid references articoli_fornitore(id) on delete set null,
  -- La dicitura del fornitore FOTOGRAFATA: domani puo' cambiare, questo
  -- ordine no. Senza, la riconciliazione con la fattura confronterebbe
  -- la fattura di ieri col catalogo di oggi.
  descrizione           text not null,
  quantita              numeric not null check (quantita > 0),
  unita                 text,
  quantita_base         numeric,
  unita_base            text,
  prezzo_atteso         numeric,
  creato_il             timestamptz not null default now()
);

comment on column ordini_fornitore_righe.quantita is
  'Quanto si e'' chiesto NELL''UNITA'' DEL FORNITORE (2 casse). `quantita_base` dice quanto serviva davvero (10 kg): due numeri, perche'' un fattore sbagliato si veda prima della consegna.';
comment on column ordini_fornitore_righe.prezzo_atteso is
  'L''ultimo prezzo pagato per quella dicitura, per unita'' dell''ingrediente (€/kg), come nello storico. Serve alla riconciliazione con la fattura: non e'' un impegno del fornitore.';

create index if not exists idx_ordini_fornitore_quando on ordini_fornitore (inviato_il desc);
create index if not exists idx_ordini_righe_ordine on ordini_fornitore_righe (ordine_id);
create index if not exists idx_ordini_righe_articolo on ordini_fornitore_righe (articolo_id);

alter table ordini_fornitore enable row level security;
alter table ordini_fornitore_righe enable row level security;

drop policy if exists ordini_fornitore_titolare on ordini_fornitore;
create policy ordini_fornitore_titolare on ordini_fornitore
  for all using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists ordini_fornitore_righe_titolare on ordini_fornitore_righe;
create policy ordini_fornitore_righe_titolare on ordini_fornitore_righe
  for all using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2. La bozza: le righe della lista, dette come le dice lui
-- ---------------------------------------------------------------------
create or replace function bozza_ordine(p_supplier_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_forn      suppliers%rowtype;
  v_righe     jsonb;
  v_testo     text;
  v_telefono  text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' preparare un ordine';
  end if;

  select * into v_forn from suppliers where id = p_supplier_id;
  if v_forn.id is null then
    raise exception 'Fornitore non trovato';
  end if;

  -- Il numero per WhatsApp: si tolgono spazi e simboli e si scarta lo 00
  -- internazionale. Se non c'e' gia' il prefisso, si mette 39.
  --
  -- ⚠️ **Lo zero iniziale NON si toglie.** In quasi tutto il mondo il
  --    prefisso urbano perde lo zero passando al formato internazionale;
  --    **in Italia no**: +39 0932 123456 e' la forma giusta, e togliere
  --    quello zero manderebbe l'ordine a un numero diverso da quello
  --    scritto in rubrica. Un errore che non si vede: il messaggio parte
  --    lo stesso, e arriva a uno sconosciuto.
  --
  -- ⚠️ Un numero gia' internazionale si riconosce da 39 **e** dalla
  --    lunghezza: un cellulare come 391 234 5678 comincia per 39 senza
  --    essere prefissato, e trattarlo come tale lo storpierebbe.
  --
  -- Comunque vada, il numero completo torna indietro e la schermata lo
  -- MOSTRA accanto al pulsante: e' Alessio a vedere dove sta per
  -- scrivere, non il gestionale a indovinare per lui.
  v_telefono := regexp_replace(coalesce(v_forn.contact_phone, ''), '[^0-9]', '', 'g');
  if v_telefono like '00%' then v_telefono := substring(v_telefono from 3); end if;
  if v_telefono <> '' and not (v_telefono like '39%' and length(v_telefono) >= 12) then
    v_telefono := '39' || v_telefono;
  end if;
  v_telefono := nullif(v_telefono, '');

  with righe as (
    select
      sli.id                                             as riga_lista_id,
      sli.ingredient_id,
      a.id                                               as articolo_id,
      -- Se non so come lo chiama lui, uso il nome interno E LO DICO.
      coalesce(a.descrizione, i.name, sli.custom_name)   as descrizione,
      (a.id is not null)                                 as dicitura_sua,
      a.unita_fattura,
      a.fattore,
      sli.quantity_needed                                as quantita_base,
      coalesce(sli.unit, i.unit)::text                   as unita_base,
      -- Quante confezioni chiedere: per eccesso, perche' nessuno vende
      -- due terzi di cassa e mancare merce costa piu' che avanzarne.
      case
        when a.fattore is not null and a.fattore > 0 and sli.quantity_needed is not null
          then ceil(sli.quantity_needed / a.fattore)
        else sli.quantity_needed
      end                                                as quantita,
      ultimo.price                                       as prezzo_atteso
    from shopping_list_items sli
    left join ingredients i on i.id = sli.ingredient_id
    -- Fra le diciture di quel fornitore per quell'ingrediente si prende
    -- quella comprata piu' di recente: e' quella che lui riconosce.
    left join lateral (
      select af.*
        from articoli_fornitore af
        left join lateral (
          select max(ph.recorded_at) as quando
            from price_history ph where ph.articolo_id = af.id
        ) u on true
       where af.supplier_id = p_supplier_id
         and af.ingredient_id = sli.ingredient_id
         and not af.ignora
       order by u.quando desc nulls last, af.creato_il desc
       limit 1
    ) a on true
    left join lateral (
      select ph.price
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    where sli.supplier_id = p_supplier_id
      and sli.status = 'da_comprare'
    order by coalesce(a.descrizione, i.name, sli.custom_name)
  )
  select
    coalesce(jsonb_agg(to_jsonb(righe)), '[]'::jsonb),
    string_agg(
      '• ' || righe.descrizione
        || case when righe.quantita is not null
             then ' — ' || trim(trailing '.' from trim(trailing '0' from to_char(righe.quantita, 'FM999999990.999')))
                  || coalesce(' ' || righe.unita_fattura, '')
             else '' end,
      E'\n' order by righe.descrizione)
  into v_righe, v_testo
  from righe;

  if v_testo is null then
    return jsonb_build_object(
      'fornitore', v_forn.name,
      'supplier_id', v_forn.id,
      'telefono', v_telefono,
      'telefono_scritto', v_forn.contact_phone,
      'righe', '[]'::jsonb,
      'testo', null);
  end if;

  v_testo :=
    'Buongiorno, ordine per Borgo 58 — '
    || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
    || E'\n\n' || v_testo || E'\n\nGrazie!';

  return jsonb_build_object(
    'fornitore', v_forn.name,
    'supplier_id', v_forn.id,
    'telefono', v_telefono,
    'telefono_scritto', v_forn.contact_phone,
    'righe', v_righe,
    'testo', v_testo);
end;
$funzione$;

comment on function bozza_ordine(uuid) is
  'Le righe della lista assegnate a un fornitore, dette con la sua dicitura e nelle sue confezioni, piu'' il testo del messaggio. Non scrive niente e non manda niente.';

revoke all on function bozza_ordine(uuid) from public, anon, authenticated;
grant execute on function bozza_ordine(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Registrare l'ordine — tre tabelle, una decisione (B4)
-- ---------------------------------------------------------------------
create or replace function registra_ordine(
  p_supplier_id uuid,
  p_testo       text,
  p_righe       jsonb,
  p_canale      text default 'whatsapp'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id    uuid;
  v_n     integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un ordine';
  end if;
  if p_righe is null or jsonb_array_length(p_righe) = 0 then
    raise exception 'Un ordine senza righe non si registra';
  end if;
  if p_canale is not null and p_canale not in ('whatsapp', 'telefono', 'email', 'altro') then
    raise exception 'Canale non valido: %', p_canale;
  end if;

  insert into ordini_fornitore (supplier_id, canale, testo, creato_da)
  values (p_supplier_id, coalesce(p_canale, 'altro'), p_testo, auth.uid())
  returning id into v_id;

  insert into ordini_fornitore_righe (
    ordine_id, shopping_list_item_id, ingredient_id, articolo_id,
    descrizione, quantita, unita, quantita_base, unita_base, prezzo_atteso
  )
  select
    v_id,
    (r->>'riga_lista_id')::uuid,
    (r->>'ingredient_id')::uuid,
    (r->>'articolo_id')::uuid,
    r->>'descrizione',
    (r->>'quantita')::numeric,
    r->>'unita_fattura',
    (r->>'quantita_base')::numeric,
    r->>'unita_base',
    (r->>'prezzo_atteso')::numeric
  from jsonb_array_elements(p_righe) r;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Nessuna riga valida nell''ordine';
  end if;

  -- Le righe della lista passano a «ordinata»: non spariscono, cosi' si
  -- vede cosa e' stato chiesto e non e' ancora arrivato.
  update shopping_list_items
     set status = 'ordinata'
   where id in (
     select (r->>'riga_lista_id')::uuid from jsonb_array_elements(p_righe) r
   )
     and status = 'da_comprare';

  return v_id;
end;
$funzione$;

revoke all on function registra_ordine(uuid, text, jsonb, text) from public, anon;
grant execute on function registra_ordine(uuid, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Annullare: le righe tornano da comprare (B4)
-- ---------------------------------------------------------------------
-- Serve perche' «inviato» qui e' una dichiarazione di Alessio, non un
-- fatto verificabile: se WhatsApp non si e' aperto, o ci ha ripensato,
-- la lista non deve restare bloccata su «ordinata» per sempre.
create or replace function annulla_ordine(p_ordine_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ordine ordini_fornitore%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' annullare un ordine';
  end if;

  select * into v_ordine from ordini_fornitore where id = p_ordine_id for update;
  if v_ordine.id is null then
    raise exception 'Ordine non trovato';
  end if;
  if v_ordine.stato = 'annullato' then
    raise exception 'Questo ordine e'' gia'' annullato';
  end if;
  if v_ordine.stato = 'ricevuto' then
    raise exception 'Questo ordine risulta gia'' arrivato: non si annulla, la merce c''e''';
  end if;

  update ordini_fornitore set stato = 'annullato' where id = p_ordine_id;

  update shopping_list_items
     set status = 'da_comprare'
   where status = 'ordinata'
     and id in (
       select r.shopping_list_item_id
         from ordini_fornitore_righe r
        where r.ordine_id = p_ordine_id
          and r.shopping_list_item_id is not null
     );
end;
$funzione$;

revoke all on function annulla_ordine(uuid) from public, anon;
grant execute on function annulla_ordine(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Gli ordini fatti
-- ---------------------------------------------------------------------
create or replace function ordini_fatti(p_dal date default null, p_al date default null)
returns table (
  id          uuid,
  fornitore   text,
  supplier_id uuid,
  stato       text,
  canale      text,
  inviato_il  timestamptz,
  ricevuto_il timestamptz,
  righe       integer,
  testo       text
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere gli ordini ai fornitori';
  end if;

  return query
  select o.id, s.name::text, o.supplier_id, o.stato, o.canale,
         o.inviato_il, o.ricevuto_il,
         (select count(*) from ordini_fornitore_righe r where r.ordine_id = o.id)::integer,
         o.testo
    from ordini_fornitore o
    left join suppliers s on s.id = o.supplier_id
   where (p_dal is null or (o.inviato_il at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (o.inviato_il at time zone 'Europe/Rome')::date <= p_al)
   order by o.inviato_il desc;
end;
$funzione$;

revoke all on function ordini_fatti(date, date) from public, anon, authenticated;
grant execute on function ordini_fatti(date, date) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_f1       uuid;
  v_f2       uuid;
  v_ing      uuid;
  v_art1     uuid;
  v_art2     uuid;
  v_riga     uuid;
  v_riga2    uuid;
  v_ordine   uuid;
  v_bozza    jsonb;
  v_r        jsonb;
  v_var      record;
  n          integer;
  respinto   boolean;
begin
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null or v_staff is null then
    raise exception 'Servono un''entita'', un titolare e uno staff per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Due fornitori che vendono la stessa cosa, con due diciture diverse.
  insert into suppliers (entity_id, name, category, contact_phone)
  values (v_ente, 'PROVA ORD Mililli', 'ortofrutta', '0932 123456') returning id into v_f1;
  insert into suppliers (entity_id, name, category, contact_phone)
  values (v_ente, 'PROVA ORD Rossi', 'ortofrutta', '+39 333 9999999') returning id into v_f2;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA ORD pomodoro', 'verdura', 'kg') returning id into v_ing;

  -- La cassa da 6 kg: e' il `fattore` che decide quante casse chiedere.
  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore)
  values (v_f1, 'Pomodori ciliegini di Pachino IGP, cassa da 6 kg',
          chiave_articolo('Pomodori ciliegini di Pachino IGP, cassa da 6 kg'), v_ing, 'casse', 6)
  returning id into v_art1;
  insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore)
  values (v_f2, 'Ciliegino siciliano vaschetta 500 g',
          chiave_articolo('Ciliegino siciliano vaschetta 500 g'), v_ing, 'vaschette', 0.5)
  returning id into v_art2;

  insert into price_history (ingredient_id, price, supplier_id, source, articolo_id)
  values (v_ing, 3.90, v_f1, 'manuale', v_art1);
  insert into price_history (ingredient_id, price, supplier_id, source, articolo_id)
  values (v_ing, 4.50, v_f2, 'manuale', v_art2);

  -- 1. Il confronto fra fornitori NON e' una funzione nuova: e' quella
  --    disegnata da Alessio, e mette in cima la piu' conveniente.
  select * into v_var from varianti_ingrediente(v_ing) limit 1;
  if v_var.fornitore_id <> v_f1 then
    raise exception 'Il confronto non propone il fornitore piu'' conveniente.';
  end if;
  select count(*) into n from varianti_ingrediente(v_ing);
  if n <> 2 then
    raise exception 'Il confronto deve MOSTRARE entrambi, non scegliere in silenzio (ne mostra %).', n;
  end if;

  -- 2. Servono 10 kg dal primo fornitore: la cassa e' da 6.
  v_riga := add_shopping_list_item(v_ing, null, v_f1, 10, 'kg'::unit_type, null);

  v_bozza := bozza_ordine(v_f1);
  v_r := v_bozza->'righe'->0;

  if v_r->>'descrizione' <> 'Pomodori ciliegini di Pachino IGP, cassa da 6 kg' then
    raise exception 'La bozza non usa la dicitura del fornitore: «%».', v_r->>'descrizione';
  end if;
  if (v_r->>'dicitura_sua')::boolean is not true then
    raise exception 'La riga non dichiara che la dicitura e'' davvero la sua.';
  end if;
  -- ⚠️ 10 / 6 = 1,67 → 2 casse. Mai 1, mai 1,67.
  if (v_r->>'quantita')::numeric <> 2 then
    raise exception 'Le casse da chiedere dovrebbero essere 2, risultano %.', v_r->>'quantita';
  end if;
  if (v_r->>'quantita_base')::numeric <> 10 then
    raise exception 'Il fabbisogno vero (10 kg) non e'' rimasto nella riga.';
  end if;
  if (v_r->>'prezzo_atteso')::numeric <> 3.90 then
    raise exception 'Il prezzo atteso non e'' l''ultimo pagato su quella dicitura.';
  end if;
  if v_bozza->>'testo' not like '%cassa da 6 kg — 2 casse%' then
    raise exception 'Il testo del messaggio non e'' leggibile: «%».', v_bozza->>'testo';
  end if;
  -- ⚠️ Il numero: 0932 123456 → 390932123456. Lo zero RESTA: in Italia
  --    fa parte del numero anche in forma internazionale, e toglierlo
  --    manderebbe l'ordine a uno sconosciuto senza che nessuno se ne
  --    accorga.
  if v_bozza->>'telefono' <> '390932123456' then
    raise exception 'Il numero per WhatsApp e'' sbagliato: «%».', v_bozza->>'telefono';
  end if;
  -- ...e un numero gia' internazionale non si tocca.
  if (bozza_ordine(v_f2))->>'telefono' <> '393339999999' then
    raise exception 'Un numero gia'' col prefisso e'' stato storpiato: «%».',
      (bozza_ordine(v_f2))->>'telefono';
  end if;

  -- 3. Una riga di cui non conosco la dicitura del fornitore si dichiara.
  v_riga2 := add_shopping_list_item(null, 'PROVA ORD sacchetti sottovuoto', v_f1, 3, null, null);
  v_bozza := bozza_ordine(v_f1);
  select r into v_r from jsonb_array_elements(v_bozza->'righe') r
   where r->>'descrizione' like '%sacchetti%';
  if v_r is null then
    raise exception 'Una riga fuori anagrafica e'' sparita dalla bozza.';
  end if;
  if (v_r->>'dicitura_sua')::boolean is not false then
    raise exception 'Una riga senza dicitura del fornitore risulta detta nella sua lingua.';
  end if;

  -- 4. Si registra l'ordine: le righe passano a «ordinata», non spariscono.
  v_ordine := registra_ordine(v_f1, v_bozza->>'testo', v_bozza->'righe', 'whatsapp');
  select count(*) into n from ordini_fornitore_righe where ordine_id = v_ordine;
  if n <> 2 then raise exception 'L''ordine ha % righe invece di 2.', n; end if;
  if (select status from shopping_list_items where id = v_riga) <> 'ordinata' then
    raise exception 'La riga della lista non e'' passata a «ordinata».';
  end if;
  if (select count(*) from shopping_list_items where id = v_riga) <> 1 then
    raise exception 'La riga ordinata e'' sparita dalla lista.';
  end if;

  -- La dicitura e' FOTOGRAFATA: se domani cambia, l'ordine resta com'era.
  update articoli_fornitore set descrizione = 'CAMBIATA' where id = v_art1;
  select count(*) into n from ordini_fornitore_righe
   where ordine_id = v_ordine and descrizione like '%cassa da 6 kg%';
  if n <> 1 then
    raise exception 'La dicitura dell''ordine e'' cambiata insieme al catalogo.';
  end if;

  -- 5. Un ordine senza righe non si registra.
  respinto := false;
  begin perform registra_ordine(v_f1, 'niente', '[]'::jsonb, 'whatsapp');
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Un ordine vuoto e'' stato registrato.'; end if;

  -- 6. Annullare riporta le righe in lista: «inviato» e' una sua
  --    dichiarazione, non un fatto che il gestionale possa verificare.
  perform annulla_ordine(v_ordine);
  if (select stato from ordini_fornitore where id = v_ordine) <> 'annullato' then
    raise exception 'L''ordine non risulta annullato.';
  end if;
  if (select status from shopping_list_items where id = v_riga) <> 'da_comprare' then
    raise exception 'Annullando l''ordine la riga non e'' tornata da comprare.';
  end if;

  respinto := false;
  begin perform annulla_ordine(v_ordine);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Un ordine gia'' annullato si e'' lasciato annullare due volte.'; end if;

  -- Un ordine gia' arrivato non si annulla: la merce c'e'.
  v_bozza := bozza_ordine(v_f1);
  v_ordine := registra_ordine(v_f1, v_bozza->>'testo', v_bozza->'righe', 'telefono');
  update ordini_fornitore set stato = 'ricevuto', ricevuto_il = now() where id = v_ordine;
  respinto := false;
  begin perform annulla_ordine(v_ordine);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Un ordine gia'' arrivato si e'' lasciato annullare.'; end if;

  -- 7. L'elenco degli ordini fatti.
  select count(*) into n from ordini_fatti();
  if n < 2 then raise exception 'Gli ordini fatti non risultano (ne trova %).', n; end if;

  perform set_config('request.jwt.claims', null, true);

  -- 8. I portieri: qui dentro ci sono fornitori, quantita' e prezzi.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin perform bozza_ordine(v_f1);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto preparare un ordine.'; end if;

  respinto := false;
  begin perform ordini_fatti();
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto leggere gli ordini ai fornitori.'; end if;

  respinto := false;
  begin perform registra_ordine(v_f1, 'x', '[{"descrizione":"x","quantita":1}]'::jsonb, 'whatsapp');
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto registrare un ordine.'; end if;

  respinto := false;
  begin perform annulla_ordine(v_ordine);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Lo staff ha potuto annullare un ordine.'; end if;
  perform set_config('request.jwt.claims', null, true);

  -- 9. L'elenco di chi puo' bussare da fuori non e' cresciuto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then
    raise exception 'L''elenco di chi puo'' bussare da fuori e'' passato a %.', n;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from ordini_fornitore_righe where ordine_id in
    (select id from ordini_fornitore where supplier_id in (v_f1, v_f2));
  delete from ordini_fornitore where supplier_id in (v_f1, v_f2);
  delete from shopping_list_items where id in (v_riga, v_riga2);
  delete from price_history where ingredient_id = v_ing;
  delete from articoli_fornitore where id in (v_art1, v_art2);
  delete from stock_lots where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;
  delete from suppliers where id in (v_f1, v_f2);

  select count(*) into n from suppliers where name like 'PROVA ORD%';
  if n <> 0 then raise exception 'La prova ha lasciato % fornitori.', n; end if;
  select count(*) into n from ingredients where name like 'PROVA ORD%';
  if n <> 0 then raise exception 'La prova ha lasciato % ingredienti.', n; end if;

  raise notice 'Ordini ai fornitori: la dicitura e'' la sua, le casse sono intere, e il gestionale non manda niente.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260814000001', 'gli_ordini_ai_fornitori')
on conflict (version) do nothing;

select count(*) as ordini, count(*) filter (where stato = 'inviato') as in_attesa
  from ordini_fornitore;
