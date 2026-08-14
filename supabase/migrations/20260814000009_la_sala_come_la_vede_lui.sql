-- ---------------------------------------------------------------------
-- La sala come la vede lui: divani, Chef Table, e i tavoli che si girano
-- ---------------------------------------------------------------------
-- Alessio ha aperto la pianta il 14/08 — mezz'ora dopo la consegna — e ha
-- rimandato indietro uno screenshot con tre correzioni disegnate sopra in
-- rosso. Nessuna delle tre e' una richiesta in piu': sono tre punti in cui
-- il disegno non e' la sua sala, e una pianta che non si riconosce a colpo
-- d'occhio non serve a niente (§3 del mandato).
--
--   1. Lo Chef Table era al bancone in fondo a destra. Non e' li'.
--      L'ha barrato e ha scritto dove sta davvero: in cima alla sala
--      bassa, verso il centro — che e' anche dove la planimetria mette il
--      banco di passaggio.
--   2. I due tavoli rettangolari li vuole VERTICALI. Anche qui la
--      planimetria gli dava ragione e non l'ho seguita: nel file di
--      Sweet Home 3D i rettangolari sono girati di un quarto, e io ho
--      seguito la descrizione a parole del mandato («180 × 90») invece
--      del disegno.
--   3. Le tre postazioni divano erano troppo a sinistra. Ha disegnato tre
--      quadrati rossi dove vanno: circa due metri piu' a destra.
--
-- ⚠️ QUESTA MIGRAZIONE ALLENTA UN VINCOLO DEL MANDATO, e va detto.
-- Il §4 elencava «niente rotazione» fra le cose da tenere povere. Alessio
-- ha chiesto «la possibilita' di ruotarli se possibile»: e' una sua
-- decisione, non una deriva di chi implementa. Ma si allenta il minimo
-- indispensabile — **un quarto di giro, non un angolo libero**: un
-- booleano che scambia larghezza e profondita', non un campo di gradi.
-- Un tavolo in una sala si gira di traverso; non lo si mette a 37°.
--
-- ⚠️ E LA MISURA VERA NON CAMBIA. Il tavolo resta 180 × 90 in tabella,
-- perche' quella e' la sua misura fisica: e' il DISEGNO a girarlo. Se
-- avessi scambiato i due numeri, fra sei mesi la scheda del tavolo
-- avrebbe raccontato un mobile che non esiste.
--
-- La rotazione segue la stessa regola della posizione: si gira **per una
-- giornata**, e «questa diventa la sala di sempre» la porta nella base.
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. Il quarto di giro
-- =====================================================================
alter table dining_tables
  add column if not exists ruotato boolean not null default false;

alter table disposizioni_giornaliere
  add column if not exists ruotato boolean not null default false;

comment on column dining_tables.ruotato is
  'Un quarto di giro nel DISEGNO: larghezza e profondita'' si scambiano. Le misure in tabella restano quelle fisiche del mobile. Non esiste un angolo libero, per scelta.';

-- =====================================================================
-- 2. Le tre correzioni, col perimetro stretto
-- =====================================================================
-- Ogni riga si tocca solo se sta ESATTAMENTE dove l'aveva messa la
-- migrazione precedente. Se nel frattempo l'ha spostata Alessio, non si
-- tocca niente: una migrazione non sovrascrive una scelta di chi
-- apparecchia (stessa regola di `20260814000008`).
do $correzioni$
declare
  n integer;
begin
  -- I divani, circa due metri a destra.
  update dining_tables set x = 300 where label = 'Divano 1' and x = 100 and y = 800;
  update dining_tables set x = 620 where label = 'Divano 2' and x = 420 and y = 800;
  update dining_tables set x = 940 where label = 'Divano 3' and x = 740 and y = 800;

  -- Lo Chef Table in cima alla sala bassa, dove ha scritto lui e dove la
  -- planimetria mette il banco.
  update dining_tables set x = 980, y = 530
   where label = 'Chef Table' and x = 1850 and y = 650;

  -- I due rettangolari, girati.
  update dining_tables set ruotato = true
   where tipo = 'tavolo' and larghezza_cm = 180 and profondita_cm = 90 and not ruotato;

  select count(*) into n
  from dining_tables
  where active and (
       (label = 'Divano 1'   and x = 100)
    or (label = 'Divano 2'   and x = 420)
    or (label = 'Divano 3'   and x = 740)
    or (label = 'Chef Table' and x = 1850)
  );
  if n > 0 then
    raise exception 'Sono rimaste % sagome nella posizione vecchia.', n;
  end if;
end $correzioni$;

-- =====================================================================
-- 3. La pianta del giorno, che ora sa anche come sono girate
-- =====================================================================
-- ⚠️ La funzione restituisce le misure GIA' girate: chi disegna non deve
-- ricordarsi di scambiarle, altrimenti la sala e' giusta in una schermata
-- e sbagliata nell'altra. E' lo stesso motivo per cui la pianta e' una
-- sola.
--
-- ⚠️ Un `create or replace` non basta quando cambiano le colonne
-- restituite: va cancellata e rifatta. E dopo un `drop` i permessi
-- tornano aperti al mondo — trappola gia' costata una correzione con
-- `create_ingredient` il 13/08. Si richiudono qui sotto, e la verifica lo
-- controlla.
drop function if exists pianta_del_giorno(date);

create function pianta_del_giorno(p_data date)
returns table (
  id uuid, label text, tipo text, forma text, zona text,
  larghezza_cm integer, profondita_cm integer,
  spostabile boolean, posti_fissi integer,
  x integer, y integer, ruotato boolean, spostato boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.label, t.tipo, t.forma, t.zona,
         case when coalesce(d.ruotato, t.ruotato) then t.profondita_cm else t.larghezza_cm  end,
         case when coalesce(d.ruotato, t.ruotato) then t.larghezza_cm  else t.profondita_cm end,
         t.spostabile, t.posti_fissi,
         coalesce(d.x, t.x), coalesce(d.y, t.y),
         coalesce(d.ruotato, t.ruotato),
         d.dining_table_id is not null
  from dining_tables t
  left join disposizioni_giornaliere d
    on d.dining_table_id = t.id and d.data = p_data
  where t.active
  order by t.position;
$$;

comment on function pianta_del_giorno is
  'La sala com''è quel giorno: pianta base + scostamenti della data, con le misure già girate. Un solo calcolo per Sala e orari e per le Comande.';

revoke all on function pianta_del_giorno(date) from public, anon, authenticated;
grant execute on function pianta_del_giorno(date) to authenticated;

-- =====================================================================
-- 4. Promuovere porta nella base anche il verso
-- =====================================================================
-- Senza questa riga, «questa diventa la sala di sempre» promuoverebbe la
-- posizione e lascerebbe indietro la rotazione: da domani i tavoli
-- sarebbero dove li ha messi lui ma girati come prima — e nessuna delle
-- due cose sembrerebbe sbagliata guardandola.
create or replace function promuovi_disposizione(p_data date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not (select is_titolare()) then
    raise exception 'Solo il titolare può cambiare la disposizione base della sala.';
  end if;

  select count(*) into n from disposizioni_giornaliere where data = p_data;
  if n = 0 then
    raise exception 'Quel giorno la sala è già disposta come la base: non c''è niente da promuovere.';
  end if;

  update dining_tables t
     set x = d.x, y = d.y, ruotato = d.ruotato
    from disposizioni_giornaliere d
   where d.dining_table_id = t.id and d.data = p_data;

  delete from disposizioni_giornaliere where data = p_data;

  return jsonb_build_object('sagome_spostate', n);
end;
$$;

revoke all on function promuovi_disposizione(date) from public, anon, authenticated;
grant execute on function promuovi_disposizione(date) to authenticated;

-- =====================================================================
-- 5. Verifica (§7 punti 1-3)
-- =====================================================================
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_t1       uuid;
  v_domani   date := (now() at time zone 'Europe/Rome')::date + 400;  -- data lontana: nessuna serata vera
  v_riga     record;
  v_out      jsonb;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per questa verifica.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- I permessi dopo il drop: la trappola del 13/08 non deve ripetersi.
  if has_function_privilege('anon', 'pianta_del_giorno(date)', 'execute') then
    raise exception 'Dopo il drop, la pianta è tornata leggibile con la sola chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'pianta_del_giorno(date)', 'execute') then
    raise exception 'La pianta non è più leggibile da chi ha il gestionale aperto.';
  end if;

  -- Le tre correzioni sono nei dati.
  if (select x from dining_tables where label = 'Divano 3') <> 940 then
    raise exception 'I divani non sono stati spostati.';
  end if;
  if (select zona from dining_tables where label = 'Chef Table') = 'bancone'
     and (select x from dining_tables where label = 'Chef Table') = 1850 then
    raise exception 'Lo Chef Table è ancora al bancone.';
  end if;

  -- ⚠️ Il quarto di giro cambia il DISEGNO e non la misura del mobile.
  select * into v_riga from pianta_del_giorno(current_date) where label = 'T1';
  if v_riga.larghezza_cm <> 90 or v_riga.profondita_cm <> 180 then
    raise exception 'T1 non risulta girato nel disegno: % × %.', v_riga.larghezza_cm, v_riga.profondita_cm;
  end if;
  if (select larghezza_cm from dining_tables where label = 'T1') <> 180 then
    raise exception 'Girando il tavolo è cambiata la sua misura vera: in tabella non è più 180 di larghezza.';
  end if;
  select id into v_t1 from dining_tables where label = 'T1';

  -- Girarlo per una giornata sola vale per quella giornata e basta.
  insert into disposizioni_giornaliere (data, dining_table_id, x, y, ruotato)
  values (v_domani, v_t1, 400, 400, false)
  on conflict (data, dining_table_id) do update set x = 400, y = 400, ruotato = false;

  select * into v_riga from pianta_del_giorno(v_domani) where label = 'T1';
  if v_riga.larghezza_cm <> 180 or not v_riga.spostato then
    raise exception 'Lo scostamento del giorno non riporta il tavolo diritto: % × %.', v_riga.larghezza_cm, v_riga.profondita_cm;
  end if;
  select * into v_riga from pianta_del_giorno(current_date) where label = 'T1';
  if v_riga.larghezza_cm <> 90 then
    raise exception 'Girare un tavolo per un giorno ha cambiato anche gli altri giorni.';
  end if;

  -- Promuovere porta nella base anche il verso, non solo la posizione.
  v_out := promuovi_disposizione(v_domani);
  if (select ruotato from dining_tables where id = v_t1) then
    raise exception 'La promozione ha lasciato indietro la rotazione.';
  end if;
  if (select x from dining_tables where id = v_t1) <> 400 then
    raise exception 'La promozione non ha portato la posizione.';
  end if;

  -- Si rimette T1 esattamente com'era: girato, e dov'era.
  update dining_tables set x = 1450, y = 90, ruotato = true where id = v_t1;

  -- Lo staff continua a non poter promuovere.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  begin
    perform promuovi_disposizione(v_domani);
    raise exception 'Lo staff ha potuto promuovere la disposizione.';
  exception when sqlstate 'P0001' then null;
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Nessuna sagoma esce dalla sala, girata compresa.
  select count(*) into n
  from pianta_del_giorno(current_date)
  where x < 0 or y < 0 or x + larghezza_cm > 2070 or y + profondita_cm > 1030;
  if n > 0 then
    raise exception '% sagome escono dal perimetro della sala.', n;
  end if;

  -- Nessuna sagoma della sala bassa sta addosso a un divano o allo Chef
  -- Table: e' la prova che le posizioni nuove non hanno creato un
  -- pasticcio peggiore di quello che correggevano.
  select count(*) into n
  from pianta_del_giorno(current_date) a
  join pianta_del_giorno(current_date) b on b.id <> a.id
  where not a.spostabile
    and a.x < b.x + b.larghezza_cm and a.x + a.larghezza_cm > b.x
    and a.y < b.y + b.profondita_cm and a.y + a.profondita_cm > b.y;
  if n > 0 then
    raise exception '% sovrapposizioni fra un arredo fisso e un''altra sagoma.', n;
  end if;

  delete from disposizioni_giornaliere where data = v_domani;
  perform set_config('request.jwt.claims', null, true);

  raise notice 'Sala corretta: divani a destra, Chef Table in cima alla sala bassa, rettangolari girati. Il quarto di giro non tocca le misure vere.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000009', 'la_sala_come_la_vede_lui')
on conflict (version) do nothing;

select label, tipo, larghezza_cm, profondita_cm, ruotato, x, y
from pianta_del_giorno(current_date)
order by label;
