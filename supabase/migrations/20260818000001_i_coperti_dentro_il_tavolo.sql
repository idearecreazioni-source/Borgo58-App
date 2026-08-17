-- ---------------------------------------------------------------------
-- I coperti dentro il tavolo, e «c'e' posto?» dal telefono
-- ---------------------------------------------------------------------
-- Mandato «La sala e le prenotazioni» (docs/mandati/20260818_la_sala_e_le_prenotazioni.md),
-- giro B: i punti 2 e 1. Decisioni di Alessio del 18/08/2026.
--
-- COSA CAMBIA, IN UNA FRASE: sul tavolo si legge quanti ne tiene, e
-- accostandone due il numero SCENDE invece di restare fermo.
--
-- ⚠️ ROVESCIAMENTO DICHIARATO (docs/decisioni_rovesciate.md, n. 2). Il
-- 14/08 si era deciso che nel sistema non esiste una capacita' per tavolo,
-- e il vincolo `dining_tables_sagoma_check` lo scriveva: un `tavolo` con
-- `posti_fissi` viene rifiutato. Quel vincolo NON viene toccato qui — e
-- non e' un cavillo per dire che il rovesciamento non c'e' stato. C'e':
-- l'invariante del 14/08 diceva «nessun numero di coperti e' associato a
-- un tavolo», e metterlo sul FORMATO a cui il tavolo punta e' associarcelo
-- a un passo di distanza. Il racconto sta nel riepilogo, il conteggio
-- nell'elenco dei rovesciamenti.
--
-- PERCHE' LA CAPACITA' STA SUL FORMATO E NON SULLA SAGOMA. Alessio non ha
-- detto «i 180 non si accostano perche' sono larghi»: ha detto «perche'
-- sono di uno stile diverso». Lo stile e' una proprieta' del formato, non
-- della geometria — quindi il formato registra la sua RAGIONE invece di un
-- suo effetto, e due 90x90 di un altro stile domani sarebbero un formato
-- diverso, correttamente non accostabile a questi sette. Tre cose in una
-- riga sola: la capacita' e' un suo dato modificabile senza migrazione, la
-- regola dell'accostamento e' scritta e non dedotta dalle misure, e un
-- formato nuovo comprato domani e' una riga.
--
-- ⚠️ `posti_fissi` E `formati_tavolo.coperti_base` NON SONO UN DOPPIONE, e
-- va scritto o il prossimo che legge ci mette un guardiano. Rispondono a
-- due domande diverse e non si incontrano mai: `posti_fissi` e'
-- un'etichetta su un arredo FISSO (divano, Chef Table) ed e' dichiarato
-- FUORI dal conteggio di «c'e' posto?» — chi chiama per cenare vuole un
-- tavolo, chi chiama per l'aperitivo puo' scegliere; `coperti_base`
-- alimenta quel conteggio e vive solo sui tavoli. Il discriminante del
-- 17/08 («direbbero *esattamente* la stessa cosa?») risponde no, quindi
-- nessun riflesso e nessuna rete.
--
-- DOVE FINISCE LA GEOMETRIA E COMINCIA LA REGOLA. Se due tavoli si toccano
-- e' geometria — non puo' venire da nessun'altra parte che dalla
-- posizione. Quanti ne tengono e' aritmetica SCRITTA: somma meno due per
-- ogni giunzione. Il gruppo resta DERIVATO per data e non e' una tabella:
-- il Contratto §5 («nessuna entita' gruppo di tavoli») resta vero.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

-- =====================================================================
-- 1. I FORMATI — dato di Alessio, non costante nel codice
-- =====================================================================

create table if not exists formati_tavolo (
  id            uuid primary key default gen_random_uuid(),
  nome          text    not null unique,
  coperti_base  integer not null check (coperti_base between 1 and 30),
  attivo        boolean not null default true,
  created_at    timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

comment on table formati_tavolo is
  'I formati di tavolo della sala, con quanti ne tiene ognuno. Dato di Alessio: cambiare un numero e'' un UPDATE, non una migrazione. Due tavoli si accostano solo se sono dello STESSO formato — lo stile, non la misura.';
comment on column formati_tavolo.coperti_base is
  'Coperti di UN tavolo di questo formato, da solo. Accostandone piu'' d''uno il totale scende: somma meno due per ogni giunzione.';

alter table formati_tavolo enable row level security;

-- Select aperto (in sala si legge quanti ne tiene un tavolo), scrittura al
-- titolare: e' un'impostazione, non un gesto di servizio. Tutte e quattro
-- le operazioni nominate — in Postgres sono policy indipendenti (§3.18) —
-- e tutte `to authenticated`: dal 16/08 zero policy sono intestate al
-- ruolo `public`, ed e' una proprieta' che una policy nuova puo' rompere.
drop policy if exists formati_select_all   on formati_tavolo;
drop policy if exists formati_ins_titolare on formati_tavolo;
drop policy if exists formati_upd_titolare on formati_tavolo;
drop policy if exists formati_del_titolare on formati_tavolo;
create policy formati_select_all   on formati_tavolo for select to authenticated using (true);
create policy formati_ins_titolare on formati_tavolo for insert to authenticated with check ((select is_titolare()));
create policy formati_upd_titolare on formati_tavolo for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy formati_del_titolare on formati_tavolo for delete to authenticated using ((select is_titolare()));

-- I numeri sono di Alessio, dati il 18/08. `do nothing` e' corretto qui
-- perche' sono righe NUOVE: se esistono gia', il valore che c'e' e' il suo
-- e non va riportato indietro (lezione del 12/08 — seminare `do nothing`
-- va bene solo se il valore vecchio significa ancora la stessa cosa).
insert into formati_tavolo (nome, coperti_base) values
  ('Quadrato 90x90',      4),
  ('Rettangolare 180x90', 6)
on conflict (nome) do nothing;

-- =====================================================================
-- 2. OGNI TAVOLO HA IL SUO FORMATO
-- =====================================================================

alter table dining_tables
  add column if not exists formato_id uuid references formati_tavolo(id);

comment on column dining_tables.formato_id is
  'Il formato del tavolo: da qui vengono i coperti e con questo si decide se due tavoli sono accostabili. Obbligatorio sui tavoli, vietato su divani e Chef Table (che hanno posti_fissi e stanno fuori dal conteggio).';

-- SANATORIA, una volta sola, e dichiara quante righe ha toccato (regola
-- del 16/08). Il valore predefinito e la sanatoria sono due cose diverse e
-- servono entrambe (lezione del 15/08): qui non c'e' nessun predefinito —
-- una colonna che ammette «non l'ho deciso» non deve rispondere al posto
-- di nessuno (lezione del 14/08) — quindi le righe esistenti si riempiono
-- esplicitamente, e solo dove sono vuote.
do $sanatoria$
declare
  n_quadrati integer;
  n_lunghi   integer;
  n_orfani   integer;
begin
  update dining_tables t set formato_id = f.id
    from formati_tavolo f
   where t.tipo = 'tavolo' and t.formato_id is null
     and f.nome = 'Quadrato 90x90'
     and least(t.larghezza_cm, t.profondita_cm) = 90
     and greatest(t.larghezza_cm, t.profondita_cm) = 90;
  get diagnostics n_quadrati = row_count;

  update dining_tables t set formato_id = f.id
    from formati_tavolo f
   where t.tipo = 'tavolo' and t.formato_id is null
     and f.nome = 'Rettangolare 180x90'
     and least(t.larghezza_cm, t.profondita_cm) = 90
     and greatest(t.larghezza_cm, t.profondita_cm) = 180;
  get diagnostics n_lunghi = row_count;

  raise notice 'Sanatoria formati: % tavoli quadrati, % tavoli lunghi (0 e 0 = gia'' fatto).', n_quadrati, n_lunghi;

  -- ⚠️ Un tavolo di una misura che nessun formato descrive non si indovina
  -- e non si lascia passare: senza formato non avrebbe coperti, e il
  -- conteggio della serata sarebbe piu' basso del vero SENZA nessun
  -- errore. Ci si ferma dicendo quale.
  select count(*) into n_orfani from dining_tables where tipo = 'tavolo' and formato_id is null;
  if n_orfani > 0 then
    raise exception E'% tavoli non hanno un formato: %.\nVanno creati i formati mancanti (nome e coperti) prima di riapplicare.',
      n_orfani,
      (select string_agg(label || ' (' || larghezza_cm || 'x' || profondita_cm || ')', ', ')
         from dining_tables where tipo = 'tavolo' and formato_id is null);
  end if;
end $sanatoria$;

-- Un tavolo ha un formato; un arredo fisso non ce l'ha. Vincolo NUOVO e
-- separato: `dining_tables_sagoma_check` resta esattamente com'era.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dining_tables_formato_check') then
    alter table dining_tables add constraint dining_tables_formato_check
      check ((tipo = 'tavolo') = (formato_id is not null));
  end if;
end $$;

-- =====================================================================
-- 3. LA SOGLIA — parametro suo, non numero nel codice
-- =====================================================================
-- 25 e' il numero di Alessio, dichiarato nel mandato: piu' basso di quel
-- che la sala regge, di proposito, per il rodaggio. Il predefinito qui non
-- risponde al posto suo — E' la sua risposta.
alter table service_settings
  add column if not exists soglia_coperti_serata integer not null default 25;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_soglia_check') then
    alter table service_settings add constraint service_settings_soglia_check
      check (soglia_coperti_serata between 1 and 500);
  end if;
end $$;

comment on column service_settings.soglia_coperti_serata is
  'Sopra questi coperti confermati per una serata il gestionale AVVISA. Non impedisce mai: decide Alessio.';

-- =====================================================================
-- 4. LA CORREZIONE A MANO — una sola, sull'insieme
-- =====================================================================
-- ⚠️ UN SOLO MECCANISMO, e il «contro il muro» NON si costruisce. Un flag
-- «contro il muro» e una correzione a mano darebbero lo stesso numero per
-- due strade, e il flag sa solo sottrarre — cioe' e' strettamente meno
-- espressivo. Peggio del doppione: potrebbero CONTRADDIRSI, e allora
-- servirebbe una regola di precedenza inventata da chi scrive il codice.
-- Il posto perso contro il muro si scrive come tutti gli altri motivi:
-- correggendo il numero e dicendo perche'.
--
-- ⚠️ LA CHIAVE E' L'INSIEME DI TAVOLI DI QUEL GIORNO — un tavolo singolo
-- e' un insieme di uno. Alessio corregge il numero che GUARDA, che e'
-- quello del rettangolo; chiedergli di attribuire a un tavolo la
-- differenza di un tavolone e' un'aritmetica che nessuno fa.
--
-- ⚠️ E LA CORREZIONE DECADE QUANDO L'INSIEME CAMBIA — decisione di
-- Alessio: sciogliendo un tavolone il numero torna a quello calcolato. Non
-- serve cancellare niente: se l'insieme non e' piu' un gruppo, nessuna
-- riga combacia. **Sparire e' il comportamento voluto**, ed e' la
-- distinzione che al 17/08 mancava un nome: cio' che rende un valore che
-- sparisce un difetto altrove non e' la sparizione — e' il SILENZIO. Qui
-- lo schermo lo dice.
create table if not exists correzioni_coperti (
  id            uuid primary key default gen_random_uuid(),
  data          date    not null,
  tavoli        uuid[]  not null,
  coperti       integer not null check (coperti between 0 and 200),
  ragione       text,
  aggiornato_il timestamptz not null default now(),
  unique (data, tavoli)
);

comment on table correzioni_coperti is
  'Il numero di coperti corretto A MANO per un insieme di tavoli in una giornata. Un tavolo singolo e'' un insieme di uno. Decade da se'' quando l''insieme cambia: nessuna riga combacia piu'', e il numero torna al calcolato.';
comment on column correzioni_coperti.tavoli is
  'L''insieme che identifica il rettangolo, SEMPRE ordinato per id da un trigger. Ordinato per id e non per etichetta: rinominare un tavolo non deve far perdere una correzione.';

-- ⚠️ Senza questa normalizzazione la correzione fallirebbe IN SILENZIO: in
-- Postgres due array con gli stessi elementi in ordine diverso non sono
-- uguali, quindi un client che passasse l'insieme in ordine sparso
-- scriverebbe una riga che non combacera' mai con nessun gruppo — nessun
-- errore, e il numero corretto non comparirebbe mai.
create or replace function ordina_tavoli_correzione()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select array_agg(distinct t order by t) into new.tavoli from unnest(new.tavoli) as t;
  if new.tavoli is null or array_length(new.tavoli, 1) is null then
    raise exception 'Una correzione dei coperti deve riferirsi ad almeno un tavolo.';
  end if;
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists trg_ordina_tavoli_correzione on correzioni_coperti;
create trigger trg_ordina_tavoli_correzione
  before insert or update on correzioni_coperti
  for each row execute function ordina_tavoli_correzione();

alter table correzioni_coperti enable row level security;

-- ⚠️ Tutte e quattro le operazioni aperte allo staff, ed e' una scelta
-- dichiarata invece che ereditata. `disposizioni_giornaliere` — la tabella
-- sorella — tiene update e delete al titolare; qui no, perche' una
-- correzione che chi l'ha scritta non puo' correggere e' un vicolo cieco,
-- che questo progetto conta come difetto a se' (mandato di correzione,
-- n. 8). Non e' un documento e non muove soldi: e' un appunto per una
-- serata. Se Alessio preferisce stringerla, sono due policy.
drop policy if exists correzioni_select on correzioni_coperti;
drop policy if exists correzioni_insert on correzioni_coperti;
drop policy if exists correzioni_update on correzioni_coperti;
drop policy if exists correzioni_delete on correzioni_coperti;
create policy correzioni_select on correzioni_coperti for select to authenticated using (true);
create policy correzioni_insert on correzioni_coperti for insert to authenticated with check (true);
create policy correzioni_update on correzioni_coperti for update to authenticated using (true) with check (true);
create policy correzioni_delete on correzioni_coperti for delete to authenticated using (true);

create index if not exists idx_correzioni_coperti_data on correzioni_coperti (data);

-- =====================================================================
-- 5. IL CALCOLO — un posto solo, sopra pianta_del_giorno()
-- =====================================================================
-- ⚠️ Si appoggia a `pianta_del_giorno(p_data)`, che e' gia' l'unico posto
-- dove la pianta base e lo scostamento del giorno si sommano. Cosi' la
-- sala disegnata e il conteggio di «c'e' posto?» non possono dire due
-- numeri diversi — stesso principio di `orderTotals()`.
--
-- Le due misure della geometria, e perche' quei numeri:
--   · TOLLERANZA 5 cm — l'aggancio della pianta e' a 10 cm, quindi due
--     tavoli accostati si toccano esatti e due tavoli distanti sono ad
--     almeno 10: 5 sta in mezzo e non confonde i due casi.
--   · CONTATTO MINIMO 30 cm — due tavoli che si sfiorano a uno spigolo
--     non sono un tavolone, e senza questa soglia lo diventerebbero.
create or replace function coperti_del_giorno(p_data date)
returns table (
  tavoli            uuid[],
  etichette         text[],
  giunzioni         integer,
  coperti_calcolati integer,
  coperti           integer,
  corretto          boolean,
  ragione           text
)
language sql
stable
set search_path = public
as $fn$
  with recursive sagome as (
    select p.id,
           p.label,
           t.formato_id,
           f.coperti_base,
           p.x                                                                      as x1,
           p.y                                                                      as y1,
           p.x + (case when p.ruotato then p.profondita_cm else p.larghezza_cm end)  as x2,
           p.y + (case when p.ruotato then p.larghezza_cm  else p.profondita_cm end) as y2
      from pianta_del_giorno(p_data) p
      join dining_tables  t on t.id = p.id and t.active
      join formati_tavolo f on f.id = t.formato_id
     where p.tipo = 'tavolo'
  ),
  coppie as (
    -- Due tavoli sono accostati se sono dello STESSO formato e i loro
    -- rettangoli si toccano su un lato. Il formato e' la regola di
    -- Alessio («stesso stile»); il contatto e' geometria.
    select a.id as a, b.id as b
      from sagome a
      join sagome b on a.id < b.id
     where a.formato_id = b.formato_id
       and (
             (     (abs(a.x2 - b.x1) <= 5 or abs(b.x2 - a.x1) <= 5)
               and least(a.y2, b.y2) - greatest(a.y1, b.y1) >= 30 )
          or (     (abs(a.y2 - b.y1) <= 5 or abs(b.y2 - a.y1) <= 5)
               and least(a.x2, b.x2) - greatest(a.x1, b.x1) >= 30 )
           )
  ),
  archi as (
    select a, b from coppie
    union all
    select b, a from coppie
  ),
  raggiunge as (
    -- Chiusura transitiva: ogni tavolo raggiunge tutti quelli del proprio
    -- tavolone. `union` (non `union all`) e' anche cio' che la fa finire.
    select id as nodo, id as altro from sagome
    union
    select r.nodo, ar.b from raggiunge r join archi ar on ar.a = r.altro
  ),
  capo as (
    -- ⚠️ `min(uuid)` NON esiste in Postgres: si passa dal testo. Misurato,
    -- non supposto — una funzione `language sql` con dentro un aggregato
    -- inesistente si crea lo stesso su alcune configurazioni e fallisce
    -- alla prima chiamata («un corpo che si crea non e' un corpo che
    -- funziona», 17/08).
    select nodo, min(altro::text)::uuid as capo from raggiunge group by nodo
  ),
  gruppi as (
    select c.capo,
           array_agg(s.id    order by s.id)    as tavoli,
           array_agg(s.label order by s.label) as etichette,
           sum(s.coperti_base)::integer        as somma
      from capo c
      join sagome s on s.id = c.nodo
     group by c.capo
  ),
  gi as (
    select c.capo, count(*)::integer as n
      from coppie p
      join capo c on c.nodo = p.a
     group by c.capo
  )
  select g.tavoli,
         g.etichette,
         coalesce(gi.n, 0),
         greatest(g.somma - 2 * coalesce(gi.n, 0), 0)::integer,
         coalesce(k.coperti, greatest(g.somma - 2 * coalesce(gi.n, 0), 0))::integer,
         (k.coperti is not null),
         k.ragione
    from gruppi g
    left join gi on gi.capo = g.capo
    left join correzioni_coperti k on k.data = p_data and k.tavoli = g.tavoli
   order by g.etichette;
$fn$;

comment on function coperti_del_giorno(date) is
  'I tavoloni di una giornata: quali tavoli, quante giunzioni, quanti coperti calcolati e quanti veri. Somma dei coperti base meno due per ogni giunzione; se c''e'' una correzione a mano per quell''insieme, vince lei e `corretto` lo dice.';

-- =====================================================================
-- 6. «C'E' POSTO?» — la risposta, col suo limite attaccato
-- =====================================================================
-- ⚠️ Il numero e la frase che ne dichiara il limite viaggiano INSIEME,
-- come per `calcola_imposte()`: un avviso che vive nel testo di una
-- schermata non protegge la seconda schermata che mostra lo stesso numero.
--
-- ⚠️ LE RICHIESTE IN ATTESA NON SI SOMMANO AI CONFERMATI, e si dichiarano
-- a parte. Dal 14/08 una richiesta in attesa non tiene niente (rovesciamento
-- n. 1); sommarla direbbe «prenotati» di gente che non ha prenotato. Ma
-- nasconderla farebbe superare la soglia confermandone quattro insieme,
-- quindi si vede accanto.
--
-- ⚠️ E IL CONTEGGIO GUARDA I SOLI TAVOLI: divani e Chef Table restano
-- fuori perche' sono un'altra formula (l'aperitivo), non perche' sono
-- stati dimenticati. La frase lo dice.
create or replace function posto_per_la_serata(p_data date)
returns table (
  capienza     integer,
  prenotati    integer,
  in_attesa    integer,
  restanti     integer,
  soglia       integer,
  oltre_soglia boolean,
  avvertenza   text
)
language sql
stable
set search_path = public
as $fn$
  with c as (
    select coalesce(sum(coperti), 0)::integer as capienza from coperti_del_giorno(p_data)
  ),
  r as (
    select coalesce(sum(party_size) filter (where status = 'confermata'), 0)::integer          as prenotati,
           coalesce(sum(party_size) filter (where status = 'richiesta_in_attesa'), 0)::integer as in_attesa
      from reservations where reservation_date = p_data
  ),
  s as (
    select soglia_coperti_serata as soglia from service_settings where id = 1
  )
  select c.capienza,
         r.prenotati,
         r.in_attesa,
         (c.capienza - r.prenotati)::integer,
         s.soglia,
         (r.prenotati >= s.soglia),
         concat_ws(' ',
           'Il conteggio guarda i soli tavoli: divani e Chef Table restano fuori, sono un''altra formula.',
           case when r.in_attesa > 0
                then 'Ci sono anche ' || r.in_attesa || ' coperti in richieste ancora da confermare, che non sono contati qui.'
           end,
           -- ⚠️ IL LIMITE MISURATO E DICHIARATO: la capienza si calcola coi
           -- formati di OGGI. Cambiando domani un formato da 4 a 5, una
           -- serata gia' passata direbbe un numero diverso da quello su
           -- cui si era deciso. Per le decisioni future e' giusto (si
           -- decide sempre col numero di adesso); sul passato va detto.
           case when p_data < (now() at time zone 'Europe/Rome')::date
                then 'Serata passata: la capienza e'' ricalcolata coi formati di oggi, non e'' una fotografia di allora.'
           end
         )
    from c, r, s;
$fn$;

comment on function posto_per_la_serata(date) is
  'La risposta a «c''e'' posto?» per una serata: capienza dalla disposizione di quel giorno, coperti confermati, richieste in attesa contate a parte, e la soglia di avviso di Alessio. AVVISA, non impedisce. Porta con se'' la frase che dichiara i propri limiti.';

revoke all on function coperti_del_giorno(date)   from public, anon, authenticated;
revoke all on function posto_per_la_serata(date)  from public, anon, authenticated;
revoke all on function ordina_tavoli_correzione() from public, anon, authenticated;
grant execute on function coperti_del_giorno(date)  to authenticated;
grant execute on function posto_per_la_serata(date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ CHIAMA cio' che ha creato, non guarda solo che esista: «un corpo che
-- si crea non e' un corpo che funziona» (17/08). Postgres accetta una
-- funzione che ne usa una inesistente e se ne accorge solo eseguendola —
-- ed e' gia' successo qui dentro: `min(uuid)` NON esiste, misurato prima
-- di scrivere.
--
-- ⚠️ NESSUN GESTORE D'ECCEZIONE SUL BLOCCO ESTERNO (lezione del 15/08):
-- inghiottirebbe anche il fallimento delle proprie asserzioni, e la
-- migrazione passerebbe verde con la verifica rotta.
--
-- ⚠️ LA DATA DI PROVA E' NEL PASSATO, e non e' un posto neutro scelto a
-- caso: il locale apre nel 2027, quindi il 1995 non sara' mai una serata
-- vera (lezione del 17/08 — un marcatore smette di essere innocuo appena
-- la dimensione che usa acquista un significato). Il perimetro e'
-- dichiarato vuoto PRIMA e ricontrollato vuoto DOPO.
do $verifica$
declare
  d          constant date := date '1995-06-15';
  q          uuid[];
  l          uuid[];
  base_q     integer;
  base_l     integer;
  somma_base integer;
  cap1       integer;
  cap2       integer;
  n          integer;
  gruppo_q   uuid[];
  gruppo_l   uuid[];
  v_cop      integer;
  v_giunz    integer;
  v_corr     boolean;
  v_soglia   integer;
  v_prenot   integer;
  v_attesa   integer;
  v_rest     integer;
  v_oltre    boolean;
  v_avv      text;
  acceso     char;
begin
  -- --- Il perimetro e' vuoto prima di cominciare ---
  select count(*) into n from disposizioni_giornaliere where data = d;
  if n <> 0 then raise exception 'La data di prova % ha gia'' % scostamenti: la verifica non parte su roba di qualcun altro.', d, n; end if;
  select count(*) into n from correzioni_coperti where data = d;
  if n <> 0 then raise exception 'La data di prova % ha gia'' % correzioni.', d, n; end if;
  select count(*) into n from reservations where reservation_date = d;
  if n <> 0 then raise exception 'La data di prova % ha gia'' % prenotazioni.', d, n; end if;

  -- --- La sala deve poter reggere la prova, e la condizione e' dichiarata ---
  select array_agg(t.id order by t.label) into q
    from dining_tables t join formati_tavolo f on f.id = t.formato_id
   where t.tipo = 'tavolo' and t.active and f.nome = 'Quadrato 90x90';
  select array_agg(t.id order by t.label) into l
    from dining_tables t join formati_tavolo f on f.id = t.formato_id
   where t.tipo = 'tavolo' and t.active and f.nome = 'Rettangolare 180x90';

  if coalesce(array_length(q, 1), 0) < 3 or coalesce(array_length(l, 1), 0) < 2 then
    raise exception E'La verifica ha bisogno di almeno 3 tavoli quadrati e 2 rettangolari, e ce ne sono % e %.\nSe la sala e'' cambiata davvero, va cambiata anche questa prova — non aggirata.',
      coalesce(array_length(q, 1), 0), coalesce(array_length(l, 1), 0);
  end if;

  select coperti_base into base_q from formati_tavolo where nome = 'Quadrato 90x90';
  select coperti_base into base_l from formati_tavolo where nome = 'Rettangolare 180x90';
  select sum(f.coperti_base) into somma_base
    from dining_tables t join formati_tavolo f on f.id = t.formato_id
   where t.tipo = 'tavolo' and t.active;

  -- =================================================================
  -- DISPOSIZIONE A — tutti separati
  -- =================================================================
  insert into disposizioni_giornaliere (data, dining_table_id, x, y, ruotato)
  select d, t.id, (row_number() over (order by t.label))::integer * 300, 0, false
    from dining_tables t where t.tipo = 'tavolo' and t.active;

  select coalesce(sum(coperti), 0) into cap1 from coperti_del_giorno(d);
  if cap1 <> somma_base then
    raise exception 'Tutti separati: la capienza dovrebbe essere % e invece e'' %.', somma_base, cap1;
  end if;
  select count(*) into n from coperti_del_giorno(d) where giunzioni <> 0;
  if n <> 0 then raise exception 'Tutti separati e ci sono % gruppi con giunzioni.', n; end if;

  -- =================================================================
  -- DISPOSIZIONE B — tre quadrati in fila, i due lunghi accostati
  -- =================================================================
  update disposizioni_giornaliere set x =   0, y =   0 where data = d and dining_table_id = q[1];
  update disposizioni_giornaliere set x =  90, y =   0 where data = d and dining_table_id = q[2];
  update disposizioni_giornaliere set x = 180, y =   0 where data = d and dining_table_id = q[3];
  update disposizioni_giornaliere set x =   0, y = 300 where data = d and dining_table_id = l[1];
  update disposizioni_giornaliere set x = 180, y = 300 where data = d and dining_table_id = l[2];

  -- ⚠️ LA PROVA CHE VALE E' LA DIFFERENZA, non il numero: stessa sera,
  -- stessi tavoli, due disposizioni, due totali. Tre giunzioni in piu'
  -- devono togliere esattamente sei coperti. Un conteggio che ignorasse
  -- le giunzioni passerebbe la prova A e fallirebbe qui.
  select coalesce(sum(coperti), 0) into cap2 from coperti_del_giorno(d);
  if cap2 <> cap1 - 6 then
    raise exception 'Accostando tre giunzioni la capienza doveva scendere da % a %, e invece dice %.', cap1, cap1 - 6, cap2;
  end if;

  select tavoli, coperti_calcolati, giunzioni into gruppo_q, v_cop, v_giunz
    from coperti_del_giorno(d) where tavoli @> array[q[1]];
  if v_giunz <> 2 or v_cop <> 3 * base_q - 4 or array_length(gruppo_q, 1) <> 3 then
    raise exception 'Tre quadrati in fila: attesi 3 tavoli, 2 giunzioni e % coperti; letti %, % e %.',
      3 * base_q - 4, array_length(gruppo_q, 1), v_giunz, v_cop;
  end if;

  select tavoli, coperti_calcolati, giunzioni into gruppo_l, v_cop, v_giunz
    from coperti_del_giorno(d) where tavoli @> array[l[1]];
  if v_giunz <> 1 or v_cop <> 2 * base_l - 2 or array_length(gruppo_l, 1) <> 2 then
    raise exception 'Due lunghi accostati: attesi 2 tavoli, 1 giunzione e % coperti; letti %, % e %.',
      2 * base_l - 2, array_length(gruppo_l, 1), v_giunz, v_cop;
  end if;

  -- =================================================================
  -- LA CORREZIONE A MANO — su tutti e due i formati
  -- =================================================================
  -- ⚠️ Su ENTRAMBI: una regola scritta solo per i quadrati passerebbe una
  -- prova costruita solo sui quadrati.
  insert into correzioni_coperti (data, tavoli, coperti, ragione)
  values (d, gruppo_q, 9, 'prova: uno contro il muro'),
         (d, gruppo_l, 11, 'prova: sta piu'' largo');

  select coperti, corretto into v_cop, v_corr from coperti_del_giorno(d) where tavoli @> array[q[1]];
  if v_cop <> 9 or not v_corr then raise exception 'Quadrati: la correzione a mano non e'' arrivata (% , corretto=%).', v_cop, v_corr; end if;
  select coperti, corretto into v_cop, v_corr from coperti_del_giorno(d) where tavoli @> array[l[1]];
  if v_cop <> 11 or not v_corr then raise exception 'Lunghi: la correzione a mano non e'' arrivata (%, corretto=%).', v_cop, v_corr; end if;

  -- --- SOPRAVVIVE a un ricalcolo che NON cambia l'insieme ---
  -- I due lunghi si spostano insieme: restano accostati, il gruppo e' lo
  -- stesso, il calcolo rifa' tutto da capo. Il numero corretto deve
  -- restare. (Una correzione che decade sempre passerebbe la prova dopo
  -- e fallirebbe questa: sono discriminanti solo insieme.)
  update disposizioni_giornaliere set x = x + 40 where data = d and dining_table_id = any(l[1:2]);
  select coperti, corretto into v_cop, v_corr from coperti_del_giorno(d) where tavoli @> array[l[1]];
  if v_cop <> 11 or not v_corr then
    raise exception 'La correzione doveva sopravvivere a uno spostamento che non cambia l''insieme, e invece dice % (corretto=%).', v_cop, v_corr;
  end if;

  -- --- DECADE quando l'insieme cambia ---
  update disposizioni_giornaliere set x = 2000, y = 2000 where data = d and dining_table_id = l[2];
  select coperti, corretto into v_cop, v_corr from coperti_del_giorno(d) where tavoli = array[l[1]];
  if v_cop <> base_l or v_corr then
    raise exception 'Sciolto il tavolone, il lungo doveva tornare a % calcolati e invece dice % (corretto=%).', base_l, v_cop, v_corr;
  end if;
  -- e la correzione dell'ALTRO formato, il cui insieme non e' cambiato,
  -- non deve essere stata toccata
  select coperti, corretto into v_cop, v_corr from coperti_del_giorno(d) where tavoli @> array[q[1]];
  if v_cop <> 9 or not v_corr then raise exception 'Sciogliendo i lunghi si e'' persa la correzione dei quadrati (%).', v_cop; end if;

  -- --- E TORNA se l'insieme si riforma lo stesso giorno ---
  -- Scelta dichiarata: la riga non si cancella da sola. Un trascinamento
  -- per sbaglio non deve distruggere un numero scritto a mano.
  update disposizioni_giornaliere set x = 220, y = 300 where data = d and dining_table_id = l[2];
  select coperti, corretto into v_cop, v_corr from coperti_del_giorno(d) where tavoli @> array[l[1]];
  if v_cop <> 11 or not v_corr then
    raise exception 'Riaccostati lo stesso giorno, la correzione doveva tornare e invece dice % (corretto=%).', v_cop, v_corr;
  end if;

  -- =================================================================
  -- DISPOSIZIONE C — formati diversi NON si fondono
  -- =================================================================
  -- Il gesto e' spento fra i due gruppi anche nel calcolo: un quadrato e
  -- un lungo che si toccano restano due cose.
  delete from correzioni_coperti where data = d;
  update disposizioni_giornaliere set x = 3000, y = 3000 where data = d;
  update disposizioni_giornaliere set x =   0, y = 1000 where data = d and dining_table_id = q[1];
  update disposizioni_giornaliere set x =  90, y = 1000 where data = d and dining_table_id = l[1];

  select coperti_calcolati, array_length(tavoli, 1) into v_cop, n
    from coperti_del_giorno(d) where tavoli = array[q[1]];
  if n <> 1 or v_cop <> base_q then
    raise exception 'Un quadrato accostato a un lungo si e'' fuso: gruppo da % tavoli, % coperti.', n, v_cop;
  end if;
  select array_length(tavoli, 1) into n from coperti_del_giorno(d) where tavoli = array[l[1]];
  if n <> 1 then raise exception 'Il lungo si e'' fuso col quadrato: gruppo da % tavoli.', n; end if;

  -- =================================================================
  -- «C'E' POSTO?» — coi conti veri, e senza far squillare il telefono
  -- =================================================================
  -- ⚠️ Il trigger delle notifiche si spegne e si RIACCENDE, e il
  -- riaccendersi si verifica (lezione dell'11/08: una prenotazione finta
  -- e' arrivata su Telegram come fosse un cliente vero, e lasciare il
  -- trigger spento significa richieste che non arrivano piu', in
  -- silenzio). Spegnimento e riaccensione stanno dentro lo stesso blocco:
  -- se un'asserzione fallisce, il blocco intero torna indietro e il
  -- trigger non puo' restare giu'.
  alter table reservations disable trigger trg_notify_reservation_telegram;

  update disposizioni_giornaliere set x = 3000, y = 3000 where data = d;
  insert into disposizioni_giornaliere (data, dining_table_id, x, y, ruotato)
  select d, t.id, (row_number() over (order by t.label))::integer * 300, 0, false
    from dining_tables t where t.tipo = 'tavolo' and t.active
  on conflict (data, dining_table_id) do update
     set x = excluded.x, y = excluded.y, ruotato = excluded.ruotato;

  insert into reservations (type, status, source, reservation_date, reservation_time, party_size, customer_name)
  values ('prenotazione', 'confermata',          'interno', d, '20:00', 6, 'VERIFICA coperti'),
         ('prenotazione', 'richiesta_in_attesa', 'interno', d, '21:00', 4, 'VERIFICA attesa');

  select capienza, prenotati, in_attesa, restanti, soglia, oltre_soglia, avvertenza
    into v_cop, v_prenot, v_attesa, v_rest, v_soglia, v_oltre, v_avv
    from posto_per_la_serata(d);

  if v_cop <> somma_base then raise exception 'Capienza attesa %, letta %.', somma_base, v_cop; end if;
  -- ⚠️ Le richieste in attesa NON si sommano ai confermati (rovesciamento
  -- n. 1, 14/08) ma si dichiarano: 6 prenotati, 4 in attesa, mai 10.
  if v_prenot <> 6 then raise exception 'Prenotati attesi 6, letti %.', v_prenot; end if;
  if v_attesa <> 4 then raise exception 'In attesa attesi 4, letti %.', v_attesa; end if;
  if v_rest <> somma_base - 6 then raise exception 'Restanti attesi %, letti %.', somma_base - 6, v_rest; end if;
  -- La soglia e' un dato di Alessio: si verifica la PROPRIETA', non il
  -- numero (un numero letto dalla produzione e' un fossile, 16/08).
  if v_oltre <> (v_prenot >= v_soglia) then raise exception 'L''avviso di soglia non segue la soglia.'; end if;
  if v_avv not like '%divani e Chef Table%' then raise exception 'L''avvertenza non dichiara chi resta fuori dal conteggio: %', v_avv; end if;
  if v_avv not like '%da confermare%' then raise exception 'L''avvertenza non nomina le richieste in attesa: %', v_avv; end if;
  -- ⚠️ Il limite misurato: su una serata passata la capienza e'
  -- ricalcolata coi formati di oggi, e lo dice.
  if v_avv not like '%Serata passata%' then raise exception 'Su una data passata manca la dichiarazione del ricalcolo: %', v_avv; end if;

  -- =================================================================
  -- PULIZIA — e il perimetro si ricontrolla vuoto
  -- =================================================================
  delete from reservations            where reservation_date = d;
  delete from correzioni_coperti      where data = d;
  delete from disposizioni_giornaliere where data = d;

  alter table reservations enable trigger trg_notify_reservation_telegram;
  select tgenabled into acceso from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'reservations' and t.tgname = 'trg_notify_reservation_telegram';
  if acceso <> 'O' then raise exception 'Il trigger delle notifiche e'' rimasto spento (%): le richieste dei clienti non arriverebbero piu''.', acceso; end if;

  select count(*) into n from disposizioni_giornaliere where data = d;
  if n <> 0 then raise exception 'Restano % scostamenti della prova.', n; end if;
  select count(*) into n from correzioni_coperti where data = d;
  if n <> 0 then raise exception 'Restano % correzioni della prova.', n; end if;
  select count(*) into n from reservations where reservation_date = d;
  if n <> 0 then raise exception 'Restano % prenotazioni della prova.', n; end if;

  -- --- E cio' che la migrazione governa e' come deve essere ---
  select count(*) into n from dining_tables where tipo = 'tavolo' and formato_id is null;
  if n <> 0 then raise exception '% tavoli senza formato.', n; end if;
  select count(*) into n from dining_tables where tipo <> 'tavolo' and formato_id is not null;
  if n <> 0 then raise exception '% arredi fissi hanno un formato, che non devono avere.', n; end if;
  -- Il vincolo del 14/08 e' ancora esattamente quello: il rovesciamento
  -- e' nel disegno, non in una difesa tolta di nascosto.
  if not exists (select 1 from pg_constraint where conname = 'dining_tables_sagoma_check') then
    raise exception 'dining_tables_sagoma_check non c''e'' piu''.';
  end if;
  select count(*) into n from pg_policies where tablename in ('formati_tavolo', 'correzioni_coperti') and 'public' = any(roles);
  if n <> 0 then raise exception '% policy nuove intestate al ruolo public.', n; end if;

  raise notice 'I coperti dentro il tavolo: % separati, % accostati. La differenza e'' la prova.', cap1, cap2;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000001', 'i_coperti_dentro_il_tavolo')
on conflict (version) do nothing;
