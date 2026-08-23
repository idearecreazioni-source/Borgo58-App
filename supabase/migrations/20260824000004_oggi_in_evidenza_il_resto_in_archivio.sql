-- =====================================================================
-- LE TEMPERATURE E LE NON CONFORMITA': OGGI IN EVIDENZA, IL RESTO IN ARCHIVIO
-- 24/08/2026 — blocchi 5a e 5b del mandato delle correzioni del collaudo
-- =====================================================================
-- 🔴 COM'ERANO. Due elenchi cronologici che non finiscono mai. Il registro
-- temperature mostrava «Storico rilevazioni» tagliato a cinquanta righe
-- **senza dichiararlo**, e sotto ce ne sono gia' 732: chi guardava vedeva
-- le ultime cinquanta e nessuno gli diceva che erano le ultime cinquanta.
-- Le non conformita' mescolavano le aperte con quelle chiuse mesi fa.
--
-- ⚠️ E LA LETTURA ERA INTERA: 732 righe oggi, ma quella tabella cresce di
-- qualche riga al giorno per sempre, e una lettura senza limite torna al
-- massimo di mille righe **senza dirlo**. Chiedere un mese alla volta
-- toglie il caso invece di sorvegliarlo.
--
-- ---------------------------------------------------------------------
-- IL GIORNO E' LA SERATA DI SERVIZIO
-- ---------------------------------------------------------------------
-- Le temperature si leggono a giro, anche a fine servizio dopo mezzanotte.
-- A calendario, la rilevazione dell'una di notte finirebbe nel giorno dopo
-- e la giornata che si stava chiudendo risulterebbe **senza controlli** —
-- su un registro esibibile, un buco inventato dal fuso orario. Si passa da
-- `serata_di_servizio()`, il posto unico dove quella regola vive.
--
-- ---------------------------------------------------------------------
-- L'ATTREZZATURA DELLA NON CONFORMITA' DIVENTA UN DATO
-- ---------------------------------------------------------------------
-- Richiesta di Alessio: nell'archivio le non conformita' vanno raggruppate
-- **anche per attrezzatura**, perche' *«se lo stesso frigo va fuori norma
-- tre volte in un giorno e' un guasto da far vedere a un tecnico»*, e un
-- elenco cronologico non lo mostra.
--
-- 🔴 Quel dato oggi esiste **solo dentro una frase**: la descrizione dice
-- «BASE-Congelatore: -17.0 gradi, fuori dal range...». Raggruppare
-- tagliando il testo prima dei due punti funzionerebbe finche' nessuno
-- mette due punti nel nome di un frigo, e il giorno che smette di
-- funzionare non sbaglia rumorosamente: raggruppa male, e basta. Quindi
-- diventa una colonna vera.
--
-- ⚠️ LA FUNZIONE E' RISCRITTA DAL CORPO VIVO DEL DATABASE, non dal file
-- che l'ha creata: fra i due ci stanno tutte le migrazioni che l'hanno
-- toccata dopo, ed e' una trappola in cui questo progetto e' gia' caduto
-- quattro volte.
--
-- ⚠️ QUESTA MIGRAZIONE MODIFICA RIGHE ESISTENTI e lo dichiara: le non
-- conformita' di temperatura gia' scritte ricevono l'attrezzatura,
-- riconosciuta dal nome che apre la loro descrizione. In produzione tocca
-- ZERO righe (li' non ce n'e' nessuna: misurato in sola lettura il 24/08);
-- sul progetto di prova tocca quelle di collaudo. La sanatoria stampa
-- quante ne ha toccate, e **non tocca chi ha gia' un'attrezzatura**.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Quale attrezzatura riguarda una non conformita'
-- ---------------------------------------------------------------------
alter table haccp_non_conformities
  add column if not exists equipment_id uuid references haccp_equipment(id) on delete restrict;

comment on column haccp_non_conformities.equipment_id is
  'L''attrezzatura che ha prodotto la non conformita'', quando ce n''e'' una. Vuota per ricevimento merci, scadenze e altro: per quelle non c''e'' nessuna attrezzatura, e un valore inventato sarebbe peggio del vuoto.';

create index if not exists idx_haccp_nc_equipment
  on haccp_non_conformities (equipment_id, detected_at desc);

-- ---------------------------------------------------------------------
-- 2 · La funzione che le crea, riscritta dal corpo VIVO
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registra_temperatura(p_equipment_id uuid, p_recorded_temp_c numeric, p_note text DEFAULT NULL::text, p_corrective_action text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_eq       haccp_equipment%rowtype;
  v_log      uuid;
  v_nc       uuid;
  v_fuori    boolean := false;
  v_risolta  boolean;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;
  -- ⚠️ `p_recorded_temp_c` NON passa da un controllo di "valore vuoto":
  -- 0 °C e' la temperatura del pesce fresco, non l'assenza di un dato.
  if p_recorded_temp_c is null then
    raise exception 'Serve la temperatura letta';
  end if;

  select * into v_eq from haccp_equipment where id = p_equipment_id;
  if v_eq.id is null then
    raise exception 'Questa attrezzatura non esiste';
  end if;

  insert into haccp_temperature_logs (equipment_id, recorded_temp_c, note, corrective_action)
  values (p_equipment_id, p_recorded_temp_c, nullif(p_note, ''), nullif(p_corrective_action, ''))
  returning id into v_log;

  -- Fuori range solo se un range c'e': senza, non si giudica.
  if v_eq.target_min_c is not null and v_eq.target_max_c is not null then
    v_fuori := p_recorded_temp_c < v_eq.target_min_c or p_recorded_temp_c > v_eq.target_max_c;
  end if;

  if v_fuori then
    -- Se il rimedio e' gia' scritto, la non conformita' nasce chiusa: e'
    -- successo, e' stato gestito, resta scritto. Se non c'e', resta
    -- APERTA — cioe' visibile finche' qualcuno non la chiude.
    v_risolta := nullif(p_corrective_action, '') is not null;

    insert into haccp_non_conformities (
      category, equipment_id, description, detected_at, corrective_action, resolved, resolved_at, note
    ) values (
      'temperatura',
      p_equipment_id,
      v_eq.name || ': ' || trim(to_char(p_recorded_temp_c, 'FM9990.0')) || ' °C, fuori dal range '
        || trim(to_char(v_eq.target_min_c, 'FM9990.0')) || '/'
        || trim(to_char(v_eq.target_max_c, 'FM9990.0')) || ' °C',
      now(),
      nullif(p_corrective_action, ''),
      v_risolta,
      case when v_risolta then now() end,
      nullif(p_note, '')
    )
    returning id into v_nc;
  end if;

  return jsonb_build_object(
    'lettura_id', v_log,
    'fuori_range', v_fuori,
    'non_conformita_id', v_nc,
    'da_chiudere', v_fuori and v_nc is not null and nullif(p_corrective_action, '') is null);
end
$function$;

-- ---------------------------------------------------------------------
-- 3 · La sanatoria delle non conformita' gia' scritte
-- ---------------------------------------------------------------------
-- ⚠️ PERIMETRO STRETTO, dichiarato in tre condizioni: solo categoria
-- «temperatura», solo dove l'attrezzatura e' ancora vuota, e solo se il
-- nome di UNA SOLA attrezzatura apre quella descrizione. Se due nomi
-- combaciassero — «Frigo» e «Frigo pesce» — non si sceglie: si lascia
-- vuoto e si dichiara. *Indovinare qui vorrebbe dire attribuire un guasto
-- all'apparecchio sbagliato.*
do $sanatoria$
declare
  v_tocche  integer := 0;
  v_ambigue integer := 0;
begin
  with candidate as (
    select nc.id as nc_id,
           (select array_agg(e.id)
              from haccp_equipment e
             where nc.description like e.name || ': %') as trovate
      from haccp_non_conformities nc
     where nc.category = 'temperatura'
       and nc.equipment_id is null
  ),
  fatte as (
    update haccp_non_conformities nc
       set equipment_id = c.trovate[1]
      from candidate c
     where nc.id = c.nc_id
       and array_length(c.trovate, 1) = 1
    returning 1
  )
  select count(*) into v_tocche from fatte;

  select count(*) into v_ambigue
    from haccp_non_conformities nc
   where nc.category = 'temperatura'
     and nc.equipment_id is null;

  raise notice 'Non conformita'' di temperatura collegate all''attrezzatura: %. Rimaste senza (nome non riconosciuto o ambiguo): %.',
    v_tocche, v_ambigue;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- 4 · Che cosa e' stato registrato in questa serata
-- ---------------------------------------------------------------------
-- ⚠️ TUTTE le attrezzature, anche quelle NON registrate: e' la meta' che
-- serve davvero. Un elenco di cio' che e' stato fatto non dice quello che
-- manca, e su un registro esibibile e' esattamente il buco da vedere.
create or replace function temperature_di_oggi(p_quando timestamptz default now())
returns table (
  equipment_id  uuid,
  nome          text,
  tipo          text,
  target_min_c  numeric,
  target_max_c  numeric,
  quante_oggi   bigint,
  ultima_temp   numeric,
  ultima_ora    timestamptz,
  ultima_serata date,
  fuori_range   boolean,
  registrata    boolean
)
language sql
stable
set search_path = public
as $$
  with oggi as (select serata_di_servizio(p_quando) as g),
  letture as (
    select l.equipment_id as eq,
           count(*) filter (where serata_di_servizio(l.recorded_at) = (select g from oggi)) as quante,
           max(l.recorded_at) as ultima
      from haccp_temperature_logs l
     group by l.equipment_id
  )
  select e.id, e.name, e.storage_type, e.target_min_c, e.target_max_c,
         coalesce(x.quante, 0),
         u.recorded_temp_c,
         u.recorded_at,
         case when u.recorded_at is null then null else serata_di_servizio(u.recorded_at) end,
         -- ⚠️ Senza un range non si giudica: resta VUOTO, non «conforme».
         case
           when e.target_min_c is null or e.target_max_c is null or u.recorded_temp_c is null then null
           else u.recorded_temp_c < e.target_min_c or u.recorded_temp_c > e.target_max_c
         end,
         coalesce(x.quante, 0) > 0
    from haccp_equipment e
    left join letture x on x.eq = e.id
    left join haccp_temperature_logs u
           on u.equipment_id = e.id and u.recorded_at = x.ultima
   order by (coalesce(x.quante, 0) > 0), e.name;
$$;

comment on function temperature_di_oggi(timestamptz) is
  'Ogni attrezzatura con quante letture ha in questa SERATA di servizio, l''ultima misura e se era fuori range. Le non registrate vengono per prime: sono quello che manca.';

revoke all on function temperature_di_oggi(timestamptz) from public, anon;
grant execute on function temperature_di_oggi(timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · L'archivio delle temperature, un mese alla volta
-- ---------------------------------------------------------------------
create or replace function temperature_del_mese(p_anno integer, p_mese integer)
returns table (
  giorno        date,
  equipment_id  uuid,
  nome          text,
  temperatura   numeric,
  quando        timestamptz,
  target_min_c  numeric,
  target_max_c  numeric,
  fuori_range   boolean,
  nota          text,
  rimedio       text
)
language sql
stable
set search_path = public
as $$
  select serata_di_servizio(l.recorded_at),
         e.id, e.name, l.recorded_temp_c, l.recorded_at,
         e.target_min_c, e.target_max_c,
         case
           when e.target_min_c is null or e.target_max_c is null then null
           else l.recorded_temp_c < e.target_min_c or l.recorded_temp_c > e.target_max_c
         end,
         l.note, l.corrective_action
    from haccp_temperature_logs l
    join haccp_equipment e on e.id = l.equipment_id
   where serata_di_servizio(l.recorded_at)
           between make_date(p_anno, p_mese, 1)
               and (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day')::date
   order by serata_di_servizio(l.recorded_at) desc, e.name, l.recorded_at desc;
$$;

revoke all on function temperature_del_mese(integer, integer) from public, anon;
grant execute on function temperature_del_mese(integer, integer) to authenticated;

create or replace function temperature_mesi_con_dati()
returns table (anno integer, mese integer, quante bigint, fuori bigint)
language sql
stable
set search_path = public
as $$
  select extract(year from serata_di_servizio(l.recorded_at))::integer,
         extract(month from serata_di_servizio(l.recorded_at))::integer,
         count(*),
         count(*) filter (
           where e.target_min_c is not null and e.target_max_c is not null
             and (l.recorded_temp_c < e.target_min_c or l.recorded_temp_c > e.target_max_c))
    from haccp_temperature_logs l
    join haccp_equipment e on e.id = l.equipment_id
   group by 1, 2
   order by 1 desc, 2 desc;
$$;

revoke all on function temperature_mesi_con_dati() from public, anon;
grant execute on function temperature_mesi_con_dati() to authenticated;

-- ---------------------------------------------------------------------
-- 6 · L'archivio delle non conformita', col raggruppamento per apparecchio
-- ---------------------------------------------------------------------
-- ⚠️ CONSERVA PER INTERO cosa e' successo E cosa e' stato fatto: e' la
-- prova che il sistema ha funzionato, ed e' il motivo per cui una
-- non conformita' risolta non si nasconde — si archivia.
create or replace function non_conformita_del_mese(p_anno integer, p_mese integer)
returns table (
  giorno         date,
  nc_id          uuid,
  categoria      text,
  descrizione    text,
  rilevata_il    timestamptz,
  rimedio        text,
  risolta        boolean,
  risolta_il     timestamptz,
  nota           text,
  equipment_id   uuid,
  attrezzatura   text,
  quante_stesso_apparecchio bigint
)
language sql
stable
set search_path = public
as $$
  select serata_di_servizio(nc.detected_at),
         nc.id, nc.category, nc.description, nc.detected_at,
         nc.corrective_action, nc.resolved, nc.resolved_at, nc.note,
         nc.equipment_id, e.name,
         -- 🔴 Quante volte QUELL'apparecchio ha aperto una non conformita'
         -- in QUELLA giornata: tre volte in un giorno e' un guasto, non
         -- tre disattenzioni, e un elenco cronologico non lo dice.
         case
           when nc.equipment_id is null then null
           else count(*) over (
             partition by nc.equipment_id, serata_di_servizio(nc.detected_at))
         end
    from haccp_non_conformities nc
    left join haccp_equipment e on e.id = nc.equipment_id
   where serata_di_servizio(nc.detected_at)
           between make_date(p_anno, p_mese, 1)
               and (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day')::date
   order by serata_di_servizio(nc.detected_at) desc, nc.detected_at desc;
$$;

revoke all on function non_conformita_del_mese(integer, integer) from public, anon;
grant execute on function non_conformita_del_mese(integer, integer) to authenticated;

create or replace function non_conformita_mesi_con_dati()
returns table (anno integer, mese integer, quante bigint, aperte bigint)
language sql
stable
set search_path = public
as $$
  select extract(year from serata_di_servizio(nc.detected_at))::integer,
         extract(month from serata_di_servizio(nc.detected_at))::integer,
         count(*),
         count(*) filter (where not nc.resolved)
    from haccp_non_conformities nc
   group by 1, 2
   order by 1 desc, 2 desc;
$$;

revoke all on function non_conformita_mesi_con_dati() from public, anon;
grant execute on function non_conformita_mesi_con_dati() to authenticated;

-- ---------------------------------------------------------------------
-- 7 · Verifica — e ogni prova misura una DIFFERENZA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_eq       uuid;
  v_altra    uuid;
  r          record;
  v_esito    jsonb;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
  v_nc_prima bigint;
  v_serata   date;
begin
  select count(*) into v_lapidi_p from deleted_records;
  select count(*) into v_nc_prima from haccp_non_conformities;
  v_serata := serata_di_servizio(now());

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Roba creata qui, sempre: mai un'attrezzatura vera.
  insert into haccp_equipment (name, storage_type, target_min_c, target_max_c)
  values ('VERIFICA 824 frigo', 'frigo_0_4', 2, 6) returning id into v_eq;
  insert into haccp_equipment (name, storage_type, target_min_c, target_max_c)
  values ('VERIFICA 824 senza range', 'frigo_4_8', null, null) returning id into v_altra;

  -- (a) Prima di registrare: risulta NON registrata oggi.
  select * into r from temperature_di_oggi() where equipment_id = v_eq;
  if r.registrata then raise exception 'Un''attrezzatura senza letture non puo'' risultare registrata.'; end if;
  if r.quante_oggi <> 0 then raise exception 'Attese 0 letture oggi, contate %.', r.quante_oggi; end if;

  -- (b) Una lettura dentro il range.
  v_esito := registra_temperatura(v_eq, 4.0, null, null);
  if (v_esito ->> 'fuori_range')::boolean then raise exception '4 gradi su 2/6 non e'' fuori range.'; end if;
  select * into r from temperature_di_oggi() where equipment_id = v_eq;
  if not r.registrata then raise exception 'Dopo una lettura l''attrezzatura deve risultare registrata.'; end if;
  if r.fuori_range then raise exception '4 gradi su 2/6 non e'' fuori range.'; end if;

  -- (c) Una fuori range: nasce la non conformita' E porta l'attrezzatura.
  --     ⚠️ 9 gradi e non 6,1: con un valore al bordo, «fuori» e «dentro»
  --     darebbero quasi lo stesso numero e la prova passerebbe anche con
  --     il confronto sbagliato di un decimo.
  v_esito := registra_temperatura(v_eq, 9.0, null, null);
  if not (v_esito ->> 'fuori_range')::boolean then raise exception '9 gradi su 2/6 e'' fuori range.'; end if;
  if not exists (
    select 1 from haccp_non_conformities
     where id = (v_esito ->> 'non_conformita_id')::uuid and equipment_id = v_eq
  ) then
    raise exception 'La non conformita'' nata da una temperatura deve portare la sua attrezzatura.';
  end if;

  -- (d) Senza range non si giudica: il verdetto resta VUOTO, non «conforme».
  perform registra_temperatura(v_altra, 40.0, null, null);
  select * into r from temperature_di_oggi() where equipment_id = v_altra;
  if r.fuori_range is not null then
    raise exception 'Senza range il verdetto deve restare vuoto, e invece vale «%».', r.fuori_range;
  end if;

  -- (e) Il conteggio per apparecchio nella giornata: due non conformita'
  --     dello stesso frigo oggi devono dire DUE.
  perform registra_temperatura(v_eq, 12.0, null, null);
  select * into r from non_conformita_del_mese(
    extract(year from v_serata)::integer, extract(month from v_serata)::integer)
   where equipment_id = v_eq limit 1;
  if r.quante_stesso_apparecchio <> 2 then
    raise exception 'Attese 2 non conformita'' dello stesso apparecchio oggi, contate %.',
      r.quante_stesso_apparecchio;
  end if;

  -- (f) L'archivio delle temperature del mese vede le tre letture di oggi.
  if (select count(*) from temperature_del_mese(
        extract(year from v_serata)::integer, extract(month from v_serata)::integer)
       where equipment_id = v_eq) <> 3 then
    raise exception 'L''archivio del mese non vede le tre letture di oggi.';
  end if;

  -- --- Pulizia: solo le righe di questa verifica, figlie prima delle madri.
  delete from haccp_non_conformities where equipment_id in (v_eq, v_altra);
  delete from haccp_temperature_logs where equipment_id in (v_eq, v_altra);
  delete from haccp_equipment where id in (v_eq, v_altra);

  if (select count(*) from haccp_non_conformities) <> v_nc_prima then
    raise exception 'Le non conformita'' non sono tornate a %.', v_nc_prima;
  end if;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Temperature e non conformita'': verificate. Nessun residuo, % non conformita'' vere.', v_nc_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000004', 'oggi_in_evidenza_il_resto_in_archivio') on conflict (version) do nothing;
