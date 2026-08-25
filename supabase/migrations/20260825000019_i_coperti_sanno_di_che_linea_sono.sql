-- ============================================================================
-- I COPERTI SANNO DI CHE LINEA SONO — 25/08/2026
-- ============================================================================
--
-- ✅ DECISIONE DI ALESSIO: serve un filtro nelle Comande che divida chi
--    CENA da chi fa APERICENA, per sapere quanti coperti fa la sala e
--    quanti l'area lunch.
--
-- ⚠️ PERCHE' SERVE, e non e' una comodita' di lettura: la Proiezione ha
--    SEI linee — sala, lunch, chef table, lounge apericena, eventi,
--    barattoli — e oggi **nessun modulo misura quelle diverse dalla
--    sala**. Senza questa distinzione non c'e' modo di confrontare la
--    realta' con la previsione, e il confronto e' l'unica cosa per cui
--    la Proiezione esiste.
--    🔴 E il peso di quel buco e' stato misurato stasera: il pareggio
--    della Previsione di partenza chiede **6.099 coperti con la sola
--    sala** e **3.167 con le accessorie**, contro i 5.495 previsti. Le
--    linee accessorie non sono un extra del piano: sono quello che lo
--    tiene in piedi — e non le misura nessuno.
--
-- ----------------------------------------------------------------------------
-- MISURATO PRIMA DI COSTRUIRE — non esisteva gia'
-- ----------------------------------------------------------------------------
-- Il mandato chiedeva di cercare un modo gia' esistente di distinguere i
-- coperti per linea, ed estenderlo invece di affiancarne uno nuovo.
-- Cercato nel catalogo, in tutte le colonne che potessero somigliarci:
--
--   · `service_hours.servizio`  → **pranzo | cena**. E' la FASCIA ORARIA,
--     non la linea: un apericena resta «cena» come momento della
--     giornata. Non risponde alla domanda.
--   · `order_items.turno`       → il giro delle portate in cucina.
--   · `dining_tables.tipo`      → tavolo, divano, chef table: la forma
--     del mobile, non che cosa ci si fa sopra.
--   · `scenario_linee_accessorie.linea` → le linee della PREVISIONE,
--     testo libero deciso da Alessio. E' il lato con cui ci si
--     confrontera', non il lato che misura.
--   · `orders` → 21 colonne, **nessuna** che nomini una linea.
--
-- Quindi si costruisce. ⚠️ Ma il nome dei valori si prende da quelli
-- della Proiezione — `sala`, `lunch` — perche' il giorno del confronto
-- le due parti si chiamino allo stesso modo.
--
-- ----------------------------------------------------------------------------
-- 🔴 LA COLONNA NASCE VUOTA, E VUOTO NON E' «SALA»
-- ----------------------------------------------------------------------------
-- La tentazione e' un `default 'sala'`: quasi tutti i conti sono di sala,
-- e cosi' non si tocca niente. Ma un valore predefinito su una colonna
-- nuova **risponde al posto di chi non ha risposto** (lezione del
-- 14/08, pagata con nove scostamenti della pianta che si ritrovarono
-- addosso un «quel giorno il tavolo era diritto» che nessuno aveva
-- scritto).
--
-- I conti gia' chiusi nessuno li ha classificati: dire che sono di sala
-- e' una risposta inventata da chi scrive la migrazione. Restano
-- **vuoti**, e il conteggio li mostra come terzo numero — mai sommati
-- alla sala. *Uno zero al posto dei non dichiarati direbbe che tutti
-- sono di sala, ed e' precisamente il numero che si vuole misurare.*
--
-- ⚠️ LE ALTRE QUATTRO LINEE NON SONO IN QUESTO MANDATO, ma il vincolo e'
--    scritto perche' aggiungerle sia una riga: e' un vocabolario chiuso
--    con dentro due valori, non un booleano «e' lunch si/no». Un booleano
--    avrebbe reso impossibile la chef table senza rifare tutto.
-- ============================================================================

alter table orders
  add column if not exists linea text;

comment on column orders.linea is
  'Di che linea sono i coperti di questo conto: `sala` (chi cena), `lunch` (l''area dell''apericena). VUOTO vuol dire che nessuno l''ha detto — non «sala»: i conti chiusi prima del 25/08/2026 non sono mai stati classificati, e contarli come sala falserebbe proprio il numero che si vuole misurare. Le altre quattro linee della Proiezione (chef table, lounge, eventi, barattoli) si aggiungono qui quando serviranno.';

alter table orders drop constraint if exists linea_del_conto_nota;
alter table orders
  add constraint linea_del_conto_nota
  check (linea is null or linea in ('sala', 'lunch'));

comment on constraint linea_del_conto_nota on orders is
  'La linea di un conto puo'' essere «sala» o «lunch», oppure restare vuota se nessuno l''ha ancora detta. Un valore diverso e'' un errore di chi scrive: se serve una linea nuova va aggiunta qui, cosi'' il conteggio dei coperti e la schermata restano d''accordo.';

create index if not exists idx_orders_linea on orders (linea) where linea is not null;

-- ----------------------------------------------------------------------------
-- Il conteggio — e si legge da fuori
-- ----------------------------------------------------------------------------
-- ⚠️ IL MANDATO CHIEDE UN CONTEGGIO UTILIZZABILE, non solo una vista: i
--    coperti di sala e quelli di lunch devono poter essere letti da
--    fuori, perche' serviranno al confronto con la Proiezione. Per questo
--    e' una funzione con un periodo, non un filtro dentro una schermata.
--
-- ⚠️ LA GIORNATA E' LA SERATA DI SERVIZIO, non il calendario: un conto
--    chiuso all'una di notte appartiene alla sera prima. E' la regola
--    delle 5 del mattino, e qui si usa la funzione che gia' esiste invece
--    di riscriverne il ragionamento — sarebbe il dodicesimo posto in cui
--    questo gestionale decide da se' che giorno e'.
create or replace function coperti_per_linea(
  p_dal date,
  p_al  date
)
returns table(
  linea          text,
  conti          integer,
  coperti        integer,
  incasso_euro   numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Il conteggio dei coperti per linea e'' riservato al titolare.';
  end if;

  return query
  select
    -- ⚠️ Il vuoto diventa una RIGA A SE', non sparisce e non si somma a
    --    «sala»: chi guarda deve vedere quanti coperti nessuno ha
    --    classificato, che e' la misura di quanto ci si puo' fidare del
    --    resto.
    coalesce(o.linea, 'non dichiarata')::text,
    count(*)::integer,
    coalesce(sum(o.coperti), 0)::integer,
    coalesce(sum(incasso_conto(o.id)), 0)::numeric
  from orders o
  where o.status = 'chiuso'
    and o.closed_at is not null
    and serata_di_servizio(o.closed_at) between p_dal and p_al
  group by coalesce(o.linea, 'non dichiarata')
  order by 1;
end $funzione$;

comment on function coperti_per_linea(date, date) is
  'Quanti conti, quanti coperti e quanto incasso ha fatto ciascuna linea in un periodo, contando per SERATA DI SERVIZIO. I conti che nessuno ha classificato compaiono come riga a se'' — mai sommati alla sala. Serve al confronto con la Proiezione, che ha sei linee di cui oggi solo la sala e'' misurata.';

revoke all on function coperti_per_linea(date, date) from public, anon, authenticated;
grant execute on function coperti_per_linea(date, date) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di conti creati qui, cancellati per
--    identificativo. `orders` NON e' fra le tabelle tracciate da
--    `deleted_records` (verificato il 19/08), quindi cancellarli non
--    lascia lapidi — ma le sue RIGHE si', e infatti qui non se ne
--    creano.
do $verifica$
declare
  v_tit   uuid;
  v_ent   uuid;
  v_sala  uuid;
  v_lunch uuid;
  v_muto  uuid;
  v_r     record;
  v_n     integer;
  v_ok    boolean;
  v_oggi  date;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare in user_roles.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then raise exception 'Nessuna societa''.'; end if;

  -- ⚠️ UNA SERATA LONTANA DA QUELLE VERE: cosi' il conteggio guarda solo
  --    i conti di questa verifica, e non si mescola con quelli di
  --    Alessio. Il locale apre nel 2027, quindi il 1995 non incrocia
  --    niente (stessa scelta del 17/08 sui movimenti di prova).
  v_oggi := date '1995-06-15';

  insert into orders (entity_id, table_label, status, coperti, opened_at, closed_at, linea)
  values (v_ent, 'ZZ verifica sala', 'chiuso', 4,
          v_oggi + time '20:00', v_oggi + time '22:30', 'sala')
  returning id into v_sala;

  insert into orders (entity_id, table_label, status, coperti, opened_at, closed_at, linea)
  values (v_ent, 'ZZ verifica lunch', 'chiuso', 3,
          v_oggi + time '19:00', v_oggi + time '20:15', 'lunch')
  returning id into v_lunch;

  -- Un conto che nessuno ha classificato.
  insert into orders (entity_id, table_label, status, coperti, opened_at, closed_at)
  values (v_ent, 'ZZ verifica muto', 'chiuso', 7,
          v_oggi + time '21:00', v_oggi + time '23:00')
  returning id into v_muto;

  -- ------------------------------------------------------------------
  -- (A) Le due linee si contano separate.
  --     ⚠️ I coperti sono 4 e 3 apposta: numeri DIVERSI fra loro e dal
  --     terzo (7), cosi' una funzione che li scambiasse o li sommasse
  --     darebbe un risultato diverso. Con due volte 4 non si
  --     distinguerebbe niente.
  -- ------------------------------------------------------------------
  select * into v_r from coperti_per_linea(v_oggi, v_oggi) where linea = 'sala';
  if v_r.coperti <> 4 then
    raise exception 'La sala conta % coperti invece di 4', v_r.coperti;
  end if;

  select * into v_r from coperti_per_linea(v_oggi, v_oggi) where linea = 'lunch';
  if v_r.coperti <> 3 then
    raise exception 'Il lunch conta % coperti invece di 3', v_r.coperti;
  end if;

  -- ------------------------------------------------------------------
  -- (B) I non dichiarati sono una riga a se', e NON finiscono in sala.
  --     🔴 E' il verso che conta: se si sommassero alla sala, la sala
  --     direbbe 11 e nessuno saprebbe che 7 di quei coperti non li ha
  --     classificati nessuno.
  -- ------------------------------------------------------------------
  select * into v_r from coperti_per_linea(v_oggi, v_oggi) where linea = 'non dichiarata';
  if v_r.coperti <> 7 then
    raise exception 'I coperti non dichiarati sono % invece di 7', v_r.coperti;
  end if;

  select * into v_r from coperti_per_linea(v_oggi, v_oggi) where linea = 'sala';
  if v_r.coperti <> 4 then
    raise exception 'I non dichiarati sono finiti dentro la sala: %', v_r.coperti;
  end if;

  select count(*) into v_n from coperti_per_linea(v_oggi, v_oggi);
  if v_n <> 3 then
    raise exception 'Le righe del conteggio sono % invece di 3', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- (C) Una linea inventata e' respinta dal database, non dalla
  --     schermata.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    update orders set linea = 'terrazza' where id = v_sala;
    raise exception 'ATTESO RIFIUTO: linea inventata accettata';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then raise exception 'Una linea inventata e'' passata'; end if;

  -- ------------------------------------------------------------------
  -- (D) Nessun conto di Alessio si e' ritrovato una linea addosso.
  --     ⚠️ E' la lezione del 14/08 verificata invece che promessa: la
  --     colonna non ha un valore predefinito, quindi tutti i conti
  --     preesistenti devono avere la linea VUOTA.
  -- ------------------------------------------------------------------
  select count(*) into v_n
    from orders where linea is not null and id not in (v_sala, v_lunch, v_muto);
  if v_n <> 0 then
    raise exception '% conti preesistenti hanno una linea che nessuno ha scritto', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia
  -- ------------------------------------------------------------------
  delete from orders where id in (v_sala, v_lunch, v_muto);
  select count(*) into v_n from orders where id in (v_sala, v_lunch, v_muto);
  if v_n <> 0 then raise exception 'Sono rimasti % conti della verifica', v_n; end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'I coperti sanno di che linea sono: sala e lunch si contano separate, i non dichiarati restano una riga a se'' e nessun conto vecchio si e'' ritrovato una linea addosso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000019', 'i_coperti_sanno_di_che_linea_sono')
on conflict (version) do nothing;
