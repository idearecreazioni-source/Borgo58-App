-- =====================================================================
-- LE COSE DA FARE IN CUCINA
-- 29/08/2026 — Blocco 3 (punti 3e e 3f) del mandato del 29/08 (sera)
-- =====================================================================
-- Decisione di Alessio: accanto a ogni preparazione un pulsante che la
-- aggiunge al volo a una lista di cose da fare. Le regole sono sue:
--
--   · la stessa cosa aggiunta due volte **NON si duplica**: il gestionale
--     dice che c'e' gia', come fa gia' l'aggiunta delle categorie;
--   · una voce **si toglie da sola** quando si registra la preparazione;
--     fino ad allora resta in attesa, e si mostra **da quanti giorni**;
--   · se manca un ingrediente, **avvertenza accanto alla riga — NON un
--     blocco**, cliccabile, che porta a comprarlo;
--   · una preparazione puo' essere resa **ricorrente**, e deve seguire i
--     giorni in cui **SI LAVORA IN CUCINA** — non quelli di apertura al
--     pubblico;
--   · un ricorrente **non si duplica**: se la voce precedente e' ancora in
--     lista, non se ne aggiunge un'altra.
--
-- ---------------------------------------------------------------------
-- MISURATO PRIMA DI SCRIVERE, sul progetto di prova
-- ---------------------------------------------------------------------
--   · **41 preparazioni** nel Ricettario, e **14** hanno almeno una
--     produzione registrata: la lista serve a quelle che si rifanno.
--   · **Nessuna tabella** di questo genere esiste: si costruisce da zero.
--   · 🔴 **`si_lavora_in_cucina()` NON LA CHIAMA NESSUNO.** Misurato:
--     zero funzioni del database, zero righe del client. È nata ieri col
--     calendario della cucina ed è rimasta senza lettori. **Questo blocco
--     è il suo primo lettore**, ed è la ragione per cui quel calendario
--     era stato costruito.
--
-- ---------------------------------------------------------------------
-- ⚠️ IL TERZO STATO DEL CALENDARIO, e come si comporta qui
-- ---------------------------------------------------------------------
-- `si_lavora_in_cucina(data)` ha **tre** risposte: si', no, e **vuoto** —
-- «non l'ha ancora detto nessuno». Le sette caselle nascono per lo piu'
-- vuote apposta.
--
-- 🔴 **Vuoto NON vale come «no»**, e non è una scelta mia: la migrazione
-- che ha creato quel calendario (`20260829000005`) lo scrive nero su
-- bianco — *«un no inventato spegnerebbe le preparazioni ricorrenti in
-- silenzio, che è il modo peggiore di spegnerle»*. Era una previsione
-- scritta il giorno prima per il lavoro di oggi, e qui si onora: si salta
-- **solo** quando qualcuno ha detto esplicitamente di no.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La lista
-- ---------------------------------------------------------------------
create table if not exists preparazioni_da_fare (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null references recipes(id) on delete cascade,
  aggiunta_il   timestamptz not null default now(),
  aggiunta_da   uuid,
  da_ricorrenza boolean not null default false,
  nota          text
);

comment on table preparazioni_da_fare is
  'Le preparazioni da fare, una riga per preparazione. Si toglie da sola quando la produzione viene registrata.';
comment on column preparazioni_da_fare.da_ricorrenza is
  'L''ha messa un ricorrente o una mano? Serve a distinguere «me lo sono segnato» da «lo fa il gestionale».';

-- ⚠️ UNA RIGA PER PREPARAZIONE, ed è il vincolo che rende impossibile il
-- doppione invece di segnalarlo. La schermata dice «c'è già» PRIMA, ma la
-- barriera è qui: sono tre le porte che scrivono (il pulsante, la voce, il
-- ricorrente notturno), e un controllo per porta è un controllo dimenticato.
create unique index if not exists uq_preparazione_da_fare
  on preparazioni_da_fare (recipe_id);

create index if not exists idx_da_fare_aggiunta on preparazioni_da_fare (aggiunta_il);

alter table preparazioni_da_fare enable row level security;

-- ⚠️ APERTA A TUTTO LO STAFF, e non è una svista: questa lista si legge e
-- si scrive **in cucina**, che è dove si decide cosa fare oggi. Non porta
-- nessun costo e nessun prezzo — solo il nome di una preparazione — e
-- sbagliare una riga si disfa con un tocco. Stessa forma di
-- `settimana_cucina`, nata ieri con lo stesso ragionamento.
drop policy if exists da_fare_lettura on preparazioni_da_fare;
create policy da_fare_lettura on preparazioni_da_fare
  for select to authenticated using (true);
drop policy if exists da_fare_scrittura on preparazioni_da_fare;
create policy da_fare_scrittura on preparazioni_da_fare
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 2. Le ricorrenti
-- ---------------------------------------------------------------------
create table if not exists preparazioni_ricorrenti (
  recipe_id            uuid primary key references recipes(id) on delete cascade,
  ogni_giorni          integer not null,
  ultima_messa_in_lista date,
  attiva               boolean not null default true,
  creato_il            timestamptz not null default now(),
  aggiornato_il        timestamptz not null default now()
);

-- ⚠️ IL LIMITE È «CERTO», quindi RIFIUTA (regola del 24/08): sotto un
-- giorno non è una ricorrenza, e sopra l'anno non è più un promemoria.
alter table preparazioni_ricorrenti drop constraint if exists ricorrenti_ogni_giorni_check;
alter table preparazioni_ricorrenti add constraint ricorrenti_ogni_giorni_check
  check (ogni_giorni >= 1 and ogni_giorni <= 365);
comment on constraint ricorrenti_ogni_giorni_check on preparazioni_ricorrenti is
  'Ogni quanti giorni rifarla: da 1 a 365. Sotto un giorno non e'' una ricorrenza, sopra un anno non e'' piu'' un promemoria.';

comment on table preparazioni_ricorrenti is
  'Le preparazioni che entrano in lista da sole a intervalli regolari, SOLO nei giorni in cui si lavora in cucina.';
comment on column preparazioni_ricorrenti.ultima_messa_in_lista is
  'L''ultima volta che il lavoro notturno l''ha messa in lista. Vuoto = mai, quindi entra al primo giro utile.';

alter table preparazioni_ricorrenti enable row level security;
drop policy if exists ricorrenti_lettura on preparazioni_ricorrenti;
create policy ricorrenti_lettura on preparazioni_ricorrenti
  for select to authenticated using (true);
drop policy if exists ricorrenti_scrittura on preparazioni_ricorrenti;
create policy ricorrenti_scrittura on preparazioni_ricorrenti
  for all to authenticated using (true) with check (true);

drop trigger if exists trg_ricorrenti_aggiornato_il on preparazioni_ricorrenti;
create trigger trg_ricorrenti_aggiornato_il
  before update on preparazioni_ricorrenti
  for each row execute function set_aggiornato_il();

-- ---------------------------------------------------------------------
-- 3. Aggiungere e togliere
-- ---------------------------------------------------------------------
-- ⚠️ RISPONDE «C'ERA GIÀ» invece di sollevare un errore: aggiungere due
-- volte la stessa cosa non è un guasto, è un gesto normale di chi non si
-- ricorda. La frase la compone qui, dove si sa il nome.
create or replace function aggiungi_da_fare(p_recipe_id uuid, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $corpo$
declare
  v_nome  text;
  v_tipo  recipe_type;
  v_prima timestamptz;
begin
  select r.name, r.recipe_type into v_nome, v_tipo from recipes r where r.id = p_recipe_id;
  if v_nome is null then
    raise exception 'Questa preparazione non esiste.';
  end if;
  -- ⚠️ Solo le PREPARAZIONI: un piatto finito non si «produce», si serve.
  -- Il rifiuto dice cosa è, non solo che non si può.
  if v_tipo = 'piatto_finito' then
    raise exception '«%» è un piatto del menu, non una preparazione: non si produce in anticipo.', v_nome;
  end if;

  select d.aggiunta_il into v_prima from preparazioni_da_fare d where d.recipe_id = p_recipe_id;
  if found then
    return jsonb_build_object(
      'aggiunta', false,
      'gia_c_era', true,
      'messaggio', format('«%s» è già fra le cose da fare, da %s.', v_nome,
        case
          when (now()::date - v_prima::date) = 0 then 'oggi'
          when (now()::date - v_prima::date) = 1 then 'ieri'
          else format('%s giorni', now()::date - v_prima::date)
        end));
  end if;

  insert into preparazioni_da_fare (recipe_id, aggiunta_da, nota)
  values (p_recipe_id, auth.uid(), nullif(trim(p_nota), ''));

  return jsonb_build_object('aggiunta', true, 'gia_c_era', false,
    'messaggio', format('«%s» è fra le cose da fare.', v_nome));
end;
$corpo$;

revoke all on function aggiungi_da_fare(uuid, text) from public, anon, authenticated;
grant execute on function aggiungi_da_fare(uuid, text) to authenticated;

create or replace function togli_da_fare(p_recipe_id uuid)
returns void
language sql
security definer
set search_path = public
as $corpo$
  delete from preparazioni_da_fare where recipe_id = p_recipe_id;
$corpo$;

revoke all on function togli_da_fare(uuid) from public, anon, authenticated;
grant execute on function togli_da_fare(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Cosa c'è da fare, e da quanto
-- ---------------------------------------------------------------------
create or replace function cose_da_fare()
returns table (
  recipe_id      uuid,
  nome           text,
  aggiunta_il    timestamptz,
  giorni_in_attesa integer,
  da_ricorrenza  boolean,
  ricorre_ogni   integer,
  nota           text
)
language sql
stable
security definer
set search_path = public
as $corpo$
  select d.recipe_id, r.name, d.aggiunta_il,
         (now()::date - d.aggiunta_il::date)::integer,
         d.da_ricorrenza, ric.ogni_giorni, d.nota
    from preparazioni_da_fare d
    join recipes r on r.id = d.recipe_id
    left join preparazioni_ricorrenti ric
           on ric.recipe_id = d.recipe_id and ric.attiva
   order by d.aggiunta_il;
$corpo$;

comment on function cose_da_fare() is
  'Le preparazioni in attesa, con da quanti giorni sono li''. L''anzianita'' si vede: una lista senza eta'' diventa un cimitero.';

revoke all on function cose_da_fare() from public, anon, authenticated;
grant execute on function cose_da_fare() to authenticated;

-- ---------------------------------------------------------------------
-- 5. La voce si toglie DA SOLA quando la produzione viene registrata
-- ---------------------------------------------------------------------
-- ⚠️ È UN TRIGGER e non una riga dentro `registra_produzione`: le porte da
-- cui una produzione può entrare sono già due (la schermata e, un giorno,
-- la voce), e una riga dentro una sola di loro è una riga dimenticata
-- nell'altra.
create or replace function togli_da_fare_dopo_la_produzione()
returns trigger
language plpgsql
set search_path = public
as $corpo$
begin
  delete from preparazioni_da_fare where recipe_id = new.recipe_id;
  return new;
end;
$corpo$;

revoke all on function togli_da_fare_dopo_la_produzione() from public, anon, authenticated;

drop trigger if exists trg_togli_da_fare_dopo_la_produzione on produzioni;
create trigger trg_togli_da_fare_dopo_la_produzione
  after insert on produzioni
  for each row execute function togli_da_fare_dopo_la_produzione();

-- ---------------------------------------------------------------------
-- 6. Quali ingredienti mancano — AVVERTENZA, non blocco
-- ---------------------------------------------------------------------
-- ⚠️ NON blocca niente, ed è una decisione di Alessio: si può cominciare a
-- cucinare e comprare quello che manca. Serve a dirlo **accanto alla
-- riga**, con dove andarlo a prendere.
--
-- ⚠️ I FORNITORI SONO UN ELENCO, non uno: lo stesso ingrediente si compra
-- da più parti, e la riga deve dirlo — altrimenti si ordina tre volte
-- credendo di ordinare una.
create or replace function ingredienti_che_mancano(p_recipe_id uuid, p_dosi numeric default 1)
returns table (
  ingredient_id uuid,
  nome          text,
  unita         text,
  serve         numeric,
  ce_ne         numeric,
  manca         numeric,
  fornitori     jsonb
)
language sql
stable
security definer
set search_path = public
as $corpo$
  select f.ingredient_id,
         i.name,
         v.unit::text,
         round(f.quantita, 4),
         round(coalesce(v.current_quantity, 0), 4),
         round(f.quantita - coalesce(v.current_quantity, 0), 4),
         coalesce((
           select jsonb_agg(distinct jsonb_build_object('id', s.id, 'nome', s.name))
             from articoli_fornitore a
             join suppliers s on s.id = a.supplier_id
            where a.ingredient_id = f.ingredient_id
         ), '[]'::jsonb)
    from fabbisogno_preparazione(p_recipe_id, p_dosi) f
    join ingredients i on i.id = f.ingredient_id
    left join v_stock_levels v on v.ingredient_id = f.ingredient_id
   -- ⚠️ Le spezie a pizzico restano fuori (decisione del 23/08): di quelle
   -- il magazzino non racconta la giacenza, quindi «ne manca» sarebbe una
   -- frase su un numero che nessuno tiene.
   where coalesce(i.tenuto_in_magazzino, true)
     and f.quantita > coalesce(v.current_quantity, 0)
   order by i.name;
$corpo$;

comment on function ingredienti_che_mancano(uuid, numeric) is
  'Cosa manca per fare questa preparazione, e da chi si compra. AVVISA, non blocca: si comincia lo stesso e si compra quello che manca.';

revoke all on function ingredienti_che_mancano(uuid, numeric) from public, anon, authenticated;
grant execute on function ingredienti_che_mancano(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Le ricorrenti: impostarle e spegnerle
-- ---------------------------------------------------------------------
create or replace function imposta_ricorrenza(p_recipe_id uuid, p_ogni_giorni integer)
returns void
language plpgsql
security definer
set search_path = public
as $corpo$
begin
  if p_ogni_giorni is null then
    -- ⚠️ SI SPEGNE, non si cancella: `ultima_messa_in_lista` è la memoria
    -- di quando è stata messa l'ultima volta, e buttarla farebbe rientrare
    -- la preparazione il giorno stesso che la si riaccende.
    update preparazioni_ricorrenti set attiva = false where recipe_id = p_recipe_id;
    return;
  end if;

  insert into preparazioni_ricorrenti (recipe_id, ogni_giorni, attiva)
  values (p_recipe_id, p_ogni_giorni, true)
  on conflict (recipe_id) do update
    set ogni_giorni = excluded.ogni_giorni, attiva = true;
end;
$corpo$;

revoke all on function imposta_ricorrenza(uuid, integer) from public, anon, authenticated;
grant execute on function imposta_ricorrenza(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Il lavoro notturno delle ricorrenti
-- ---------------------------------------------------------------------
create or replace function aggiungi_ricorrenti_del_giorno()
returns integer
language plpgsql
security definer
set search_path = public
as $corpo$
declare
  v_oggi    date := (now() at time zone 'Europe/Rome')::date;
  v_cucina  boolean := si_lavora_in_cucina((now() at time zone 'Europe/Rome')::date);
  v_messe   integer := 0;
  r         record;
begin
  -- 🔴 SI SALTA SOLO SU UN «NO» ESPLICITO. Vuoto vuol dire «non l'ha
  -- ancora detto nessuno», e trattarlo come un no spegnerebbe le
  -- ricorrenti in silenzio — che è il modo peggiore di spegnerle, e sta
  -- scritto nella migrazione che ha creato quel calendario.
  -- ⚠️ Il battito si scrive LO STESSO: una giornata senza cucina non è un
  -- guasto, e la sentinella non deve gridare per un giorno di riposo.
  if v_cucina is false then
    insert into stato_lavori (nome, ultimo_successo) values ('ricorrenti_cucina', now())
      on conflict (nome) do update set ultimo_successo = now();
    return 0;
  end if;

  for r in
    select ric.recipe_id, ric.ogni_giorni
      from preparazioni_ricorrenti ric
     where ric.attiva
       and (ric.ultima_messa_in_lista is null
            or ric.ultima_messa_in_lista + ric.ogni_giorni <= v_oggi)
       -- ⚠️ NON SI DUPLICA: se la voce precedente è ancora in lista, quella
       -- preparazione non è stata fatta — rimetterla non aggiunge niente e
       -- fa sembrare che ne servano due.
       and not exists (select 1 from preparazioni_da_fare d where d.recipe_id = ric.recipe_id)
  loop
    insert into preparazioni_da_fare (recipe_id, da_ricorrenza) values (r.recipe_id, true);
    update preparazioni_ricorrenti set ultima_messa_in_lista = v_oggi where recipe_id = r.recipe_id;
    v_messe := v_messe + 1;
  end loop;

  insert into stato_lavori (nome, ultimo_successo) values ('ricorrenti_cucina', now())
    on conflict (nome) do update set ultimo_successo = now();

  return v_messe;
end;
$corpo$;

comment on function aggiungi_ricorrenti_del_giorno() is
  'Mette in lista le preparazioni ricorrenti scadute, SOLO nei giorni in cui si lavora in cucina. Un «non lo so» non le spegne: si salta solo su un no esplicito.';

revoke all on function aggiungi_ricorrenti_del_giorno() from public, anon, authenticated;

-- ⚠️ ALLE 6 DEL MATTINO ITALIANE, cioè prima che qualcuno entri in cucina.
-- `pg_cron` ragiona in UTC e l'Italia cambia ora due volte l'anno: si
-- pianifica alle 4 E alle 5 UTC, e passa solo quella che cade alle 6
-- locali. È la stessa forma dell'avviso delle scadenze.
select cron.unschedule('ricorrenti-cucina')
 where exists (select 1 from cron.job where jobname = 'ricorrenti-cucina');
select cron.schedule('ricorrenti-cucina', '0 4,5 * * *',
  $cron$ select case when extract(hour from (now() at time zone 'Europe/Rome')) = 6
                     then aggiungi_ricorrenti_del_giorno() end; $cron$);

-- ⚠️ UN LAVORO PIANIFICATO CHE NESSUNO SORVEGLIA È UN ALLARME (regola del
-- 12/08): la sentinella fa il censimento nei due versi, e senza questa
-- riga griderebbe entro un quarto d'ora.
insert into lavori_sorvegliati (nome_lavoro, nome_cron, tolleranza_minuti, cosa_smette)
values ('ricorrenti_cucina', 'ricorrenti-cucina', 1560,
  'Le preparazioni ricorrenti non entrano piu'' da sole nelle cose da fare: ci si accorge che manca il fondo bruno quando serve.')
on conflict (nome_lavoro) do update
  set nome_cron = excluded.nome_cron,
      tolleranza_minuti = excluded.tolleranza_minuti,
      cosa_smette = excluded.cosa_smette;

-- ⚠️ E IL BATTITO NASCE ADESSO, non al primo giro. Senza questa riga il
-- lavoro risulterebbe «mai eseguito» dal momento in cui viene pianificato
-- fino alle sei del mattino dopo, e la sentinella griderebbe per un lavoro
-- che non ha ancora avuto occasione di girare — cioe' un allarme falso,
-- che e' il modo in cui una sentinella si impara a ignorare.
--
-- ⚠️ `do nothing` e non `do update`: se la riga c'e' gia', vuol dire che il
-- lavoro ha davvero girato, e riscriverla direbbe una cosa falsa su quando.
-- (E' l'altra faccia della trappola del 12/08: la' il `do nothing` mentiva
-- perche' il SIGNIFICATO del valore era cambiato; qui il significato e'
-- nuovo di zecca, quindi non mente.)
insert into stato_lavori (nome, ultimo_successo)
values ('ricorrenti_cucina', now())
on conflict (nome) do nothing;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_ric      uuid;
  v_ric2     uuid;
  v_ing      uuid;
  v_ent      uuid;
  v_miei_r   uuid[] := array[]::uuid[];
  v_miei_i   uuid[] := array[]::uuid[];
  v_prod     uuid;
  v_r        jsonb;
  v_quanti   integer;
  v_dow      integer;
  v_cucina   jsonb;
  v_messe    integer;
  v_respinto boolean;
  v_piatto   uuid;
begin
  -- (0) LE SOSTITUZIONI HANNO ATTECCHITO?
  if pg_get_functiondef('aggiungi_ricorrenti_del_giorno()'::regprocedure)
       not like '%si_lavora_in_cucina%' then
    raise exception 'Il lavoro delle ricorrenti non guarda il calendario della cucina.';
  end if;
  if not exists (select 1 from cron.job where jobname = 'ricorrenti-cucina') then
    raise exception 'Il lavoro «ricorrenti-cucina» non e'' pianificato.';
  end if;
  if not exists (select 1 from lavori_sorvegliati where nome_lavoro = 'ricorrenti_cucina') then
    raise exception 'Il lavoro nuovo non e'' sorvegliato: la sentinella griderebbe entro un quarto d''ora.';
  end if;

  -- ⚠️ IL PERIMETRO SE LO COSTRUISCE QUESTA VERIFICA: due preparazioni sue
  -- e un ingrediente suo. Se domani Alessio cancellasse le sue ricette,
  -- questo blocco non cambierebbe risposta.
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'Non c''e'' nessuna societa'': la verifica non ha un perimetro suo.';
  end if;

  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('VERIFICA-29AGO fondo', 'antipasto', 'preparazione', 2, 'kg')
  returning id into v_ric;
  v_miei_r := v_miei_r || v_ric;

  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('VERIFICA-29AGO salsa', 'antipasto', 'preparazione', 1, 'kg')
  returning id into v_ric2;
  v_miei_r := v_miei_r || v_ric2;

  insert into recipes (name, category, recipe_type)
  values ('VERIFICA-29AGO piatto', 'antipasto', 'piatto_finito')
  returning id into v_piatto;
  v_miei_r := v_miei_r || v_piatto;

  insert into ingredients (entity_id, name, category, unit, alimentare)
  values (v_ent, 'VERIFICA-29AGO carota', 'verdura', 'kg', true)
  returning id into v_ing;
  v_miei_i := v_miei_i || v_ing;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ric, v_ing, 3, 'kg');

  -- (1) SI AGGIUNGE, e la risposta lo dice.
  v_r := aggiungi_da_fare(v_ric, null);
  if (v_r ->> 'aggiunta') is distinct from 'true' then
    raise exception 'La preparazione non entra fra le cose da fare: %', v_r;
  end if;

  -- (2) 🔴 LA SECONDA VOLTA NON SI DUPLICA, e lo DICE invece di rompersi.
  v_r := aggiungi_da_fare(v_ric, null);
  if (v_r ->> 'gia_c_era') is distinct from 'true' then
    raise exception 'Aggiungendola due volte non dice che c''era gia'': %', v_r;
  end if;
  select count(*) into v_quanti from preparazioni_da_fare where recipe_id = v_ric;
  if v_quanti <> 1 then
    raise exception 'La stessa preparazione compare % volte in lista.', v_quanti;
  end if;

  -- (3) UN PIATTO DEL MENU VIENE RESPINTO, e il rifiuto dice cos'e'.
  v_respinto := false;
  begin
    perform aggiungi_da_fare(v_piatto, null);
  exception when sqlstate 'P0001' then
    v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Un piatto finito e'' entrato fra le cose da fare.';
  end if;

  -- (4) 🔴 GLI INGREDIENTI CHE MANCANO SI VEDONO. Servono 3 kg di carota e
  --     in magazzino non ce n'e' nessuna: deve comparire.
  select count(*) into v_quanti from ingredienti_che_mancano(v_ric, 1);
  if v_quanti <> 1 then
    raise exception 'L''ingrediente che manca non compare (trovati %).', v_quanti;
  end if;

  -- (5) E IL VERSO OPPOSTO: la preparazione senza ingredienti non deve
  --     dare falsi allarmi. Un guardiano che grida sempre si spegne.
  select count(*) into v_quanti from ingredienti_che_mancano(v_ric2, 1);
  if v_quanti <> 0 then
    raise exception 'Una preparazione senza ingredienti dichiara % mancanze.', v_quanti;
  end if;

  -- (6) 🔴 REGISTRANDO LA PRODUZIONE, LA VOCE SE NE VA DA SOLA.
  insert into produzioni (recipe_id, ingredient_id, dosi, quantita_ottenuta, unita)
  values (v_ric, v_ing, 1, 2, 'kg')
  returning id into v_prod;

  if exists (select 1 from preparazioni_da_fare where recipe_id = v_ric) then
    raise exception 'Registrata la produzione, la voce e'' rimasta fra le cose da fare.';
  end if;
  delete from produzioni where id = v_prod;

  -- (7) LE RICORRENTI: entrano da sole quando si lavora in cucina.
  v_dow := extract(dow from (now() at time zone 'Europe/Rome')::date)::integer;
  select to_jsonb(s) into v_cucina from settimana_cucina s where s.weekday = v_dow;
  update settimana_cucina set si_lavora = true where weekday = v_dow;

  perform imposta_ricorrenza(v_ric2, 3);
  v_messe := aggiungi_ricorrenti_del_giorno();
  if not exists (select 1 from preparazioni_da_fare where recipe_id = v_ric2 and da_ricorrenza) then
    raise exception 'La ricorrente non e'' entrata in lista (messe: %).', v_messe;
  end if;

  -- (8) E RILANCIANDOLO NON SI DUPLICA: la voce precedente e' ancora li'.
  v_messe := aggiungi_ricorrenti_del_giorno();
  select count(*) into v_quanti from preparazioni_da_fare where recipe_id = v_ric2;
  if v_quanti <> 1 then
    raise exception 'La ricorrente si e'' duplicata (% righe).', v_quanti;
  end if;

  -- (9) 🔴 CON UN «NO» ESPLICITO SI SALTA, e con un «non lo so» NO.
  --     È la differenza fra i tre stati, ed è il caso su cui il calendario
  --     della cucina è stato costruito ieri.
  delete from preparazioni_da_fare where recipe_id = v_ric2;
  update preparazioni_ricorrenti set ultima_messa_in_lista = null where recipe_id = v_ric2;
  update settimana_cucina set si_lavora = false where weekday = v_dow;
  perform aggiungi_ricorrenti_del_giorno();
  if exists (select 1 from preparazioni_da_fare where recipe_id = v_ric2) then
    raise exception 'In un giorno in cui NON si lavora in cucina la ricorrente e'' entrata lo stesso.';
  end if;

  update settimana_cucina set si_lavora = null where weekday = v_dow;
  perform aggiungi_ricorrenti_del_giorno();
  if not exists (select 1 from preparazioni_da_fare where recipe_id = v_ric2) then
    raise exception 'Un «non lo so» ha spento la ricorrente: e'' il modo peggiore di spegnerla.';
  end if;

  -- Si rimette tutto com'era: le righe INTERE.
  delete from preparazioni_da_fare where recipe_id = any(v_miei_r);
  delete from preparazioni_ricorrenti where recipe_id = any(v_miei_r);
  delete from recipe_ingredients where recipe_id = any(v_miei_r);
  delete from recipes where id = any(v_miei_r);
  delete from ingredients where id = any(v_miei_i);
  update settimana_cucina sc set si_lavora = (v_cucina ->> 'si_lavora')::boolean
   where sc.weekday = v_dow;

  perform pretendi_nessun_residuo(v_foto, 'la verifica delle cose da fare in cucina');
  raise notice 'Le cose da fare non si duplicano, si tolgono da sole con la produzione, e le ricorrenti seguono i giorni in cui si lavora in cucina.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000016', 'le_cose_da_fare_in_cucina') on conflict (version) do nothing;
