-- =====================================================================
-- IL BADGE HACCP GUARDAVA IL CALENDARIO MENTRE IL REGISTRO GUARDA LA SERATA
-- 24/08/2026 — opzionale C del mandato: le frasi diventate false
-- =====================================================================
-- 🔴 TROVATO RILEGGENDO CIO' CHE E' STATO TOCCATO STANOTTE, ed e' la
-- famiglia peggiore che questo progetto conosce: **due parti dello stesso
-- programma che raccontano cose diverse dello stesso fatto**.
--
-- La schermata del registro temperature, riscritta poche ore fa, decide
-- «oggi» con la SERATA DI SERVIZIO — perche' le temperature si leggono a
-- giro, anche dopo mezzanotte. La schermata iniziale di HACCP contava le
-- letture fuori range di «oggi» col GIORNO DI CALENDARIO, con un
-- `new Date().toDateString()` scritto nel browser.
--
-- ⚠️ IL CASO CHE FA MALE NON E' QUELLO CHE SI NOTA. Alle 03:00 del 24
-- agosto la serata in corso e' ancora il 23: se in quella serata ci sono
-- state tre letture fuori range, il badge della schermata iniziale diceva
-- **zero**, cioe' «stanotte va tutto bene», mentre il registro sotto ne
-- mostrava tre. E' la stessa forma del manuale HACCP che stampava
-- «conforme» dove il database apriva una non conformita' (19/08): nessuna
-- delle due parti e' rotta — il difetto vive **nello spazio fra le due**.
--
-- ⚠️ NON ERA FALSA QUANDO E' STATA SCRITTA: il giorno di calendario era
-- l'unica idea di «oggi» che il gestionale avesse. E' diventata falsa
-- stanotte, quando la schermata sotto ha cambiato metro — ed e' esattamente
-- il motivo per cui chi riscrive una schermata deve rileggere chi la
-- nomina.
--
-- ---------------------------------------------------------------------
-- E LA LETTURA ERA INTERA
-- ---------------------------------------------------------------------
-- Per contare le letture di oggi, la schermata iniziale si portava a casa
-- **tutte** le rilevazioni (732 sul progetto di prova) e le filtrava nel
-- browser, piu' tutte le non conformita'. Quella tabella cresce ogni
-- giorno e non si ferma mai: una lettura senza limite torna al massimo di
-- mille righe **senza dirlo**, e il badge avrebbe cominciato a contare su
-- un pezzo — sempre verso il basso, cioe' sempre rassicurando.
-- *Un controllo chiede al database la risposta, non i dati su cui
-- calcolarla.*
-- =====================================================================

create or replace function haccp_riepilogo_oggi(p_quando timestamptz default now())
returns table (
  fuori_range_oggi          bigint,
  attrezzature_da_leggere   bigint,
  non_conformita_aperte     bigint,
  pulizie_dovute            bigint,
  serata                    date
)
language sql
stable
set search_path = public
as $$
  select
    -- Le LETTURE fuori range di questa serata, non le attrezzature: due
    -- letture storte sullo stesso frigo sono due fatti, e il badge deve
    -- dire quanti sono.
    (select count(*)
       from haccp_temperature_logs l
       join haccp_equipment e on e.id = l.equipment_id
      where serata_di_servizio(l.recorded_at) = serata_di_servizio(p_quando)
        and e.target_min_c is not null and e.target_max_c is not null
        and (l.recorded_temp_c < e.target_min_c or l.recorded_temp_c > e.target_max_c)),
    -- ⚠️ E QUELLO CHE MANCA, che nessun badge diceva: le attrezzature
    -- ancora senza nessuna lettura in questa serata. Un modulo che conta
    -- solo i problemi trovati tace su quelli non ancora cercati.
    (select count(*) from temperature_di_oggi(p_quando) where not registrata),
    (select count(*) from haccp_non_conformities where not resolved),
    (select count(*) from pulizie_di_oggi(p_quando) where dovuta),
    serata_di_servizio(p_quando);
$$;

comment on function haccp_riepilogo_oggi(timestamptz) is
  'I quattro numeri della schermata iniziale HACCP, contati sulla SERATA di servizio come il registro sotto. Prima il browser leggeva tutte le rilevazioni e filtrava per giorno di calendario: due metri diversi per lo stesso «oggi».';

revoke all on function haccp_riepilogo_oggi(timestamptz) from public, anon;
grant execute on function haccp_riepilogo_oggi(timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — e misura la DIFFERENZA fra i due metri
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_eq       uuid;
  r          record;
  v_serata   date;
  v_calend   date;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
  v_nc_prima bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;
  select count(*) into v_nc_prima from haccp_non_conformities;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into haccp_equipment (name, storage_type, target_min_c, target_max_c)
  values ('VERIFICA 825 frigo', 'frigo_0_4', 2, 6) returning id into v_eq;

  -- 🔴 L'ISTANTE CHE DISCRIMINA: le 03:00 di una notte, quando la serata
  -- di servizio e' ANCORA IL GIORNO PRIMA. E' l'unico momento in cui i due
  -- metri danno risposte diverse, quindi e' l'unico su cui provare: a
  -- mezzogiorno passerebbe anche il conteggio sbagliato.
  v_calend := (now() at time zone 'Europe/Rome')::date;
  v_serata := serata_di_servizio(((v_calend + time '03:00') at time zone 'Europe/Rome'));

  if v_serata = v_calend then
    raise exception 'Le 03:00 dovrebbero appartenere alla serata precedente: ora_fine_serata e'' impostata male?';
  end if;

  -- Una lettura fuori range alle 22:00 della serata precedente.
  insert into haccp_temperature_logs (equipment_id, recorded_temp_c, recorded_at)
  values (v_eq, 15.0, (v_serata + time '22:00') at time zone 'Europe/Rome');

  -- Chiesto alle 03:00: appartiene a questa serata, quindi si conta.
  select * into r from haccp_riepilogo_oggi(((v_calend + time '03:00') at time zone 'Europe/Rome'));
  if r.fuori_range_oggi < 1 then
    raise exception 'Alle 03:00 la lettura delle 22:00 della stessa serata deve contare, e conta %.',
      r.fuori_range_oggi;
  end if;
  if r.serata <> v_serata then
    raise exception 'La serata dichiarata e'' % invece di %.', r.serata, v_serata;
  end if;

  -- Chiesto a mezzogiorno del giorno dopo: e' un'altra serata, non si conta.
  select * into r from haccp_riepilogo_oggi(((v_calend + time '12:00') at time zone 'Europe/Rome'));
  if r.serata <> v_calend then
    raise exception 'A mezzogiorno la serata e'' oggi, e vale %.', r.serata;
  end if;

  -- ⚠️ E l'attrezzatura senza letture in QUESTA serata risulta da leggere:
  -- e' la meta' che nessun badge diceva.
  if r.attrezzature_da_leggere < 1 then
    raise exception 'Un''attrezzatura senza letture in questa serata deve risultare da leggere.';
  end if;

  -- --- Pulizia: solo le righe di questa verifica.
  delete from haccp_non_conformities where equipment_id = v_eq;
  delete from haccp_temperature_logs where equipment_id = v_eq;
  delete from haccp_equipment where id = v_eq;

  if (select count(*) from haccp_non_conformities) <> v_nc_prima then
    raise exception 'Le non conformita'' non sono tornate a %.', v_nc_prima;
  end if;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Riepilogo HACCP di oggi: verificato sui due metri, nessun residuo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000005', 'il_badge_haccp_guarda_la_serata') on conflict (version) do nothing;
