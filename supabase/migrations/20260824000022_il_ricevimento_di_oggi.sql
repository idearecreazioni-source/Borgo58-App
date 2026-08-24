-- =====================================================================
-- IL RICEVIMENTO MERCI: OGGI IN EVIDENZA, IL RESTO IN ARCHIVIO
-- 24/08/2026 — punto (f) della pila, richiesta rimasta fuori dai blocchi
-- =====================================================================
-- 🔴 L'ULTIMA DELLE QUATTRO SCHERMATE HACCP a portare un elenco
-- cronologico infinito. Temperature, pulizie e non conformita' sono state
-- sistemate stamattina; il ricevimento merci era una richiesta di ieri
-- rimasta fuori dai blocchi, e Alessio l'ha rimessa nella pila.
--
-- ⚠️ IL PROBLEMA E' LO STESSO delle altre tre: dopo qualche settimana di
-- consegne quell'elenco diventa illeggibile, e resta la parte piu'
-- importante — **e' la prova che la merce e' stata controllata**. Non si
-- nasconde, si archivia.
--
-- ⚠️ E LA GIORNATA E' LA SERATA DI SERVIZIO, non il calendario: una
-- consegna registrata all'una di notte appartiene alla sera prima. Stessa
-- regola delle altre tre, e per la stessa ragione — davanti a un
-- controllo, una registrazione che sembra mancante dal giorno in cui la
-- si cerca e' peggio di una registrazione assente.
--
-- ⚠️ SI CHIEDE AL DATABASE, non si legge tutto e si filtra nel browser:
-- una lettura senza limite torna al massimo mille righe **senza dirlo**
-- (§8). Qui il perimetro e' un mese, quindi il caso non si presenta per
-- costruzione.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Cosa è arrivato oggi
-- ---------------------------------------------------------------------
create or replace function ricevimenti_di_oggi()
returns table (
  id            uuid,
  fornitore     text,
  prodotti      text,
  quando        timestamptz,
  temperatura   numeric,
  imballo_ok    boolean,
  conforme      boolean,
  nota          text
)
language sql
stable
set search_path = public
as $$
  select r.id, s.name, r.product_description, r.received_at,
         r.temperature_c, r.packaging_ok, r.conformity, r.note
    from haccp_goods_receiving r
    left join suppliers s on s.id = r.supplier_id
   where serata_di_servizio(r.received_at) = serata_di_servizio(now())
   order by r.received_at desc;
$$;

comment on function ricevimenti_di_oggi() is
  'Le consegne registrate nella serata di servizio in corso. ⚠️ La serata, non il giorno di calendario: una consegna dell''una di notte appartiene alla sera prima.';

revoke all on function ricevimenti_di_oggi() from public, anon;
grant execute on function ricevimenti_di_oggi() to authenticated;

-- ---------------------------------------------------------------------
-- 2 · L'archivio di un mese
-- ---------------------------------------------------------------------
create or replace function ricevimenti_del_mese(p_anno integer, p_mese integer)
returns table (
  giorno        date,
  id            uuid,
  fornitore     text,
  prodotti      text,
  quando        timestamptz,
  temperatura   numeric,
  imballo_ok    boolean,
  conforme      boolean,
  nota          text
)
language sql
stable
set search_path = public
as $$
  select serata_di_servizio(r.received_at) as giorno,
         r.id, s.name, r.product_description, r.received_at,
         r.temperature_c, r.packaging_ok, r.conformity, r.note
    from haccp_goods_receiving r
    left join suppliers s on s.id = r.supplier_id
   where serata_di_servizio(r.received_at)
           between make_date(p_anno, p_mese, 1)
               and (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day')::date
   order by serata_di_servizio(r.received_at) desc, r.received_at desc;
$$;

comment on function ricevimenti_del_mese(integer, integer) is
  'Le consegne di un mese, raggruppate per serata di servizio. E'' la parte esibibile: davanti a un controllo dimostra che la merce e'' stata guardata quando e'' entrata.';

revoke all on function ricevimenti_del_mese(integer, integer) from public, anon;
grant execute on function ricevimenti_del_mese(integer, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Quali mesi hanno qualcosa da mostrare
-- ---------------------------------------------------------------------
create or replace function ricevimenti_mesi_con_dati()
returns table (anno integer, mese integer, quante bigint)
language sql
stable
set search_path = public
as $$
  select extract(year from serata_di_servizio(r.received_at))::integer,
         extract(month from serata_di_servizio(r.received_at))::integer,
         count(*)
    from haccp_goods_receiving r
   group by 1, 2
   order by 1 desc, 2 desc;
$$;

comment on function ricevimenti_mesi_con_dati() is
  'I mesi che hanno almeno una consegna, dal piu'' recente. ⚠️ Si costruisce dai dati: un mese vuoto non compare, e nessuno deve ricordarsi di aggiungerlo.';

revoke all on function ricevimenti_mesi_con_dati() from public, anon;
grant execute on function ricevimenti_mesi_con_dati() to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_forn     uuid;
  v_id       uuid;
  v_oggi     integer;
  v_mese     integer;
  v_lapidi   integer;
  v_lapidi2  integer;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_forn from suppliers limit 1;

  -- ⚠️ `haccp_goods_receiving` NON e' fra le tabelle tracciate: misurato
  --    provando a spegnere il trigger delle lapidi, che li' non esiste.
  --    Quindi la consegna di prova si cancella senza lasciare niente — e
  --    il guardiano delle lapidi qui sotto lo controlla lo stesso, perche'
  --    e' una proprieta' e non una fiducia.

  -- (a) 🔴 UNA CONSEGNA ALL'UNA DI NOTTE APPARTIENE ALLA SERA PRIMA, ed e'
  --     il caso che discrimina: registrandola col giorno di calendario
  --     sparirebbe dalla serata in cui e' arrivata davvero.
  insert into haccp_goods_receiving
    (supplier_id, product_description, received_at, temperature_c, packaging_ok, conformity)
  values (v_forn, 'verifica-ricevimento-20260824',
          (serata_di_servizio(now()) + interval '25 hours'), 4, true, true)
  returning id into v_id;

  select count(*) into v_oggi from ricevimenti_di_oggi() where id = v_id;
  if v_oggi <> 1 then
    raise exception 'Una consegna dell''una di notte non compare nella serata: trovata % volte.', v_oggi;
  end if;

  -- (b) E sta nell'archivio del mese giusto — quello della SERATA.
  select count(*) into v_mese
    from ricevimenti_del_mese(
      extract(year from serata_di_servizio(now()))::integer,
      extract(month from serata_di_servizio(now()))::integer)
   where id = v_id;
  if v_mese <> 1 then
    raise exception 'La consegna non compare nell''archivio del mese: trovata % volte.', v_mese;
  end if;

  -- (c) ⚠️ E IL VERSO OPPOSTO: una consegna di due mesi fa NON deve
  --     comparire fra quelle di oggi. Senza questa riga la prova
  --     passerebbe anche se «oggi» restituisse tutto.
  update haccp_goods_receiving
     set received_at = received_at - interval '65 days' where id = v_id;
  select count(*) into v_oggi from ricevimenti_di_oggi() where id = v_id;
  if v_oggi <> 0 then
    raise exception 'Una consegna di due mesi fa compare fra quelle di oggi.';
  end if;

  -- (d) I mesi con dati si costruiscono dai dati.
  if not exists (select 1 from ricevimenti_mesi_con_dati()) then
    raise exception 'Nessun mese risulta avere consegne, ma ce n''e'' almeno una.';
  end if;

  delete from haccp_goods_receiving where id = v_id;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Il ricevimento merci ha il suo «oggi» e il suo archivio, sulla serata di servizio.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000022', 'il_ricevimento_di_oggi') on conflict (version) do nothing;
