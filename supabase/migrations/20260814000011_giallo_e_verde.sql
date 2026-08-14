-- ---------------------------------------------------------------------
-- Giallo e verde: l'ora si vede dal colore, non si spunta a mano
-- ---------------------------------------------------------------------
-- Idea di Alessio, guardando la pianta dal telefono, e **ha sostituito
-- una cosa che avevo costruito io**: la spunta *«sa che il tavolo
-- potrebbe essere ancora occupato quando arriva»*.
--
-- Il suo ragionamento, che è migliore del mio: quella spunta chiedeva a
-- lui di dichiarare una cosa che il gestionale **può già dedurre
-- dall'ora di arrivo**. Chi arriva presto libera il tavolo per la seconda
-- serata; chi arriva tardi no. Colorando le due cose in modo diverso, un
-- tavolo mezzo giallo e mezzo verde racconta la serata a colpo d'occhio —
-- e il secondo cliente sa di poter aspettare senza che nessuno debba
-- ricordarsi di spuntare niente.
--
-- ⚠️ IL VERDE AVVISA, NON BLOCCA (decisione esplicita di Alessio fra tre
-- strade). Nessun vincolo nuovo nel database: due prenotazioni sullo
-- stesso tavolo restano ammesse a qualunque ora. Se due persone gli dicono
-- che mangiano al volo, ce li mette. Un gestionale che blocca una cosa
-- che in sala si fa è un gestionale che si impara ad aggirare.
--
-- ⚠️ L'ORA DI SOGLIA È UN DATO, NON UNA RIGA DI CODICE. D'estate, di
-- sabato o fra un anno quell'ora cambia, e cambiarla non deve richiedere
-- una modifica al programma — come il prezzo del coperto e gli orari di
-- servizio. Vive in `service_settings` e la cambia lui da «Sala e orari».
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. L'ora che separa il primo giro dal secondo
-- =====================================================================
alter table service_settings
  add column if not exists ora_primo_turno time not null default '20:00';

comment on column service_settings.ora_primo_turno is
  'Fin quando un arrivo lascia il tavolo libero per una seconda serata. Chi arriva entro quest''ora è "presto" (giallo), dopo è "tardi" (verde). Serve a vedere, non a impedire: nessun vincolo la usa.';

-- =====================================================================
-- 2. Via la spunta del rischio — e via davvero, non spenta
-- =====================================================================
-- La colonna la scriveva solo quella spunta. Lasciarla lì, sempre falsa,
-- sarebbe la «colonna spenta» che questo progetto ha appena finito di
-- togliere dalla capienza: fra tre mesi qualcuno la ritrova e la
-- riaccende credendo di riparare qualcosa.
--
-- ⚠️ Cambia la firma di due funzioni, quindi vanno cancellate e rifatte
-- (un parametro in meno fa una funzione *nuova*, e due sovrapposte
-- renderebbero ambigua ogni chiamata per nome — 42725, a runtime). E dopo
-- un `drop` i permessi tornano aperti al mondo: si richiudono in fondo, e
-- la verifica lo controlla.
drop function if exists assegna_prenotazione(uuid, uuid[], boolean, boolean);
drop function if exists crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text, boolean);

alter table prenotazione_tavoli drop column if exists rischio_accettato;

-- =====================================================================
-- 3. Le due funzioni, senza il parametro che non serve più
-- =====================================================================
create or replace function assegna_prenotazione(
  p_reservation_id uuid,
  p_tavoli         uuid[],
  p_conferma       boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res       reservations%rowtype;
  v_etichette text[];
  n_mancanti  integer;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_res from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Prenotazione non trovata';
  end if;
  if v_res.status in ('rifiutata', 'annullata') then
    raise exception 'Questa prenotazione è stata %: riaprila prima di assegnarle un tavolo.', v_res.status;
  end if;

  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Serve almeno un tavolo: una prenotazione confermata senza tavolo non dice dove far sedere nessuno.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);
  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste più in sala.';
  end if;

  -- Riassegnare sostituisce l'insieme: l'elenco dei tavoli di una
  -- prenotazione è quello che si vede adesso sulla pianta, non la somma
  -- di tutti i ripensamenti.
  delete from prenotazione_tavoli where reservation_id = p_reservation_id;

  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select p_reservation_id, d.id, d.label
  from dining_tables d
  where d.id = any(p_tavoli);

  select array_agg(etichetta_al_momento order by etichetta_al_momento)
    into v_etichette
  from prenotazione_tavoli where reservation_id = p_reservation_id;

  if coalesce(p_conferma, false) and v_res.status <> 'confermata' then
    update reservations set status = 'confermata' where id = p_reservation_id;
  end if;

  return jsonb_build_object(
    'tavoli',     array_length(v_etichette, 1),
    'etichette',  to_jsonb(v_etichette),
    'confermata', coalesce(p_conferma, false) or v_res.status = 'confermata'
  );
end;
$$;

comment on function assegna_prenotazione is
  'Assegna una prenotazione a uno o più tavoli e, se richiesto, la conferma. B4: stato della prenotazione + N righe di collegamento, una transazione.';

revoke all on function assegna_prenotazione(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function assegna_prenotazione(uuid, uuid[], boolean) to authenticated;

create or replace function crea_prenotazione_su_tavoli(
  p_data     date,
  p_ora      time,
  p_persone  integer,
  p_nome     text,
  p_tavoli   uuid[],
  p_telefono text default null,
  p_email    text default null,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_etichette text[];
  n_mancanti  integer;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Serve il nome di chi prenota.';
  end if;
  if p_persone is null or p_persone < 1 or p_persone > 200 then
    raise exception 'Numero di persone non valido.';
  end if;
  if p_ora is null then
    raise exception 'Serve l''ora di arrivo.';
  end if;
  if p_data is null or p_data < (now() at time zone 'Europe/Rome')::date then
    raise exception 'Quella data è già passata.';
  end if;
  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Tocca sulla pianta i tavoli dove li fai sedere.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);
  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste più in sala.';
  end if;

  insert into reservations (
    type, status, source,
    reservation_date, reservation_time, party_size,
    customer_name, customer_phone, customer_email, notes
  ) values (
    'prenotazione', 'confermata', 'interno',
    p_data, p_ora, p_persone,
    trim(p_nome),
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_id;

  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento)
  select v_id, d.id, d.label from dining_tables d where d.id = any(p_tavoli);

  select array_agg(etichetta_al_momento order by etichetta_al_momento)
    into v_etichette
  from prenotazione_tavoli where reservation_id = v_id;

  return jsonb_build_object(
    'reservation_id', v_id,
    'tavoli',         array_length(v_etichette, 1),
    'etichette',      to_jsonb(v_etichette)
  );
end;
$$;

comment on function crea_prenotazione_su_tavoli is
  'Prende una prenotazione dalla pianta della sala: nasce confermata, sui tavoli toccati, senza email e senza avviso. B4: prenotazione + righe di collegamento, una transazione.';

revoke all on function crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text)
  from public, anon, authenticated;
grant execute on function crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text)
  to authenticated;

-- =====================================================================
-- 4. Verifica (§7 punti 1-3)
-- =====================================================================
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_t        uuid[];
  v_out      jsonb;
  v_id       uuid;
  v_id2      uuid;
  v_data     date := (now() at time zone 'Europe/Rome')::date + 320;
  v_soglia   time;
  respinto   boolean;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per questa verifica.';
  end if;

  -- La soglia esiste ed è un'ora vera.
  select ora_primo_turno into v_soglia from service_settings where id = 1;
  if v_soglia is null then
    raise exception 'L''ora che separa il primo giro dal secondo non è impostata.';
  end if;

  -- La spunta del rischio non c'è più. Rimossa, non spenta.
  if exists (select 1 from information_schema.columns
              where table_name = 'prenotazione_tavoli' and column_name = 'rischio_accettato') then
    raise exception 'La colonna del rischio accettato è ancora lì: spenta non basta, andava rimossa.';
  end if;

  -- ⚠️ Le firme vecchie non devono sopravvivere: due funzioni con lo
  -- stesso nome e un parametro di differenza rendono ambigua ogni
  -- chiamata (42725, e si scopre a runtime).
  select count(*) into n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('assegna_prenotazione', 'crea_prenotazione_su_tavoli');
  if n <> 2 then
    raise exception 'Ci sono % funzioni con quei nomi invece di 2: una firma vecchia è sopravvissuta.', n;
  end if;

  -- I permessi dopo il drop: la trappola del 13/08 non deve ripetersi.
  if has_function_privilege('anon', 'assegna_prenotazione(uuid, uuid[], boolean)', 'execute')
     or has_function_privilege('anon', 'crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text)', 'execute') then
    raise exception 'Dopo il drop, le prenotazioni sono diventate scrivibili con la sola chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text)', 'execute') then
    raise exception 'Chi è in sala non può più prendere una prenotazione.';
  end if;

  select array_agg(id) into v_t from (
    select id from dining_tables where active and tipo = 'tavolo' order by position limit 1
  ) q;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  -- Le due funzioni girano ancora, con la firma nuova.
  v_out := crea_prenotazione_su_tavoli(v_data, '19:30', 2, 'PROVA COLORI presto', v_t);
  v_id := (v_out->>'reservation_id')::uuid;

  -- ⚠️ IL SECONDO GIRO RESTA AMMESSO, e senza nessuna spunta: è la
  -- decisione di Alessio — il colore avvisa, non blocca.
  v_out := crea_prenotazione_su_tavoli(v_data, '21:30', 2, 'PROVA COLORI tardi', v_t);
  v_id2 := (v_out->>'reservation_id')::uuid;

  select count(*) into n from prenotazione_tavoli where dining_table_id = v_t[1]
    and reservation_id in (v_id, v_id2);
  if n <> 2 then
    raise exception 'Lo stesso tavolo non ha accettato due prenotazioni a orari diversi: % righe.', n;
  end if;

  -- La regola del colore è una lettura, non un vincolo: qui si controlla
  -- solo che i due orari stiano dalle due parti della soglia, che è ciò
  -- che la schermata userà per decidere giallo o verde.
  if not ((select reservation_time from reservations where id = v_id) <= v_soglia) then
    raise exception 'La prenotazione delle 19:30 non risulta entro la soglia (%).', v_soglia;
  end if;
  if (select reservation_time from reservations where id = v_id2) <= v_soglia then
    raise exception 'La prenotazione delle 21:30 risulta entro la soglia (%).', v_soglia;
  end if;

  -- E assegnare continua a funzionare, sostituendo l'insieme.
  v_out := assegna_prenotazione(v_id2, v_t, true);
  if (v_out->>'tavoli')::integer <> 1 then
    raise exception 'L''assegnazione con la firma nuova non funziona.';
  end if;

  respinto := false;
  begin perform crea_prenotazione_su_tavoli(v_data, '20:00', 2, '  ', v_t);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Accettata una prenotazione senza nome.'; end if;

  delete from reservations where id in (v_id, v_id2);
  select count(*) into n from reservations where customer_name like 'PROVA COLORI%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % prenotazioni nel database.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Giallo e verde: la soglia è le % e vive nelle impostazioni. La spunta del rischio non c''è più, e il secondo giro resta ammesso.', v_soglia;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000011', 'giallo_e_verde')
on conflict (version) do nothing;

select
  (select ora_primo_turno from service_settings where id = 1)                as ora_primo_turno,
  (select count(*) from information_schema.columns
    where table_name = 'prenotazione_tavoli' and column_name = 'rischio_accettato') as spunta_rimasta,
  (select count(*) from prenotazione_tavoli)                                 as tavoli_assegnati;
