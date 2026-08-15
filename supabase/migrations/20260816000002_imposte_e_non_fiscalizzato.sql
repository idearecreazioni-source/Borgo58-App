-- ---------------------------------------------------------------------
-- Le imposte, e quanto non è ancora fiscalizzato
-- ---------------------------------------------------------------------
-- Decisione di Alessio del 16/08/2026, dopo una discussione in cui aveva
-- ragione lui sul problema e io sulla soluzione — quindi vale la pena
-- scrivere per intero come è finita.
--
-- IL SUO RILIEVO: *«proprio perché il sistema deve mostrarmi la situazione
-- reale, non dovrebbe considerare i conti non scontrinati nelle previsioni
-- finché non vengono regolarizzati, altrimenti nel frattempo mi
-- fornirebbero uno specchio della situazione errato»*.
--
-- ⚠️ PERCHÉ TOGLIERLI DAI RICAVI SAREBBE STATO PEGGIO. Da quello stesso
-- numero escono lo **scontrino medio**, il **food cost in percentuale** —
-- quello che gli interessa di più, il 30% contro il 40% — e tutto lo
-- **scostamento** dal piano. Ricavi ridotti li avrebbero falsati tutti e
-- tre: un food cost calcolato su ricavi parziali sembra altissimo, e
-- manderebbe a cercare un problema in cucina che non esiste. Lo specchio
-- si sarebbe storto dall'altra parte, e su più schermate invece che su una.
--
-- ⚠️ E UNA SECONDA RAGIONE, DETTA E ACCETTATA: un numero che **migliora
-- quando non si emette un documento** è un incentivo messo dentro lo
-- strumento. Non è quello che vuole, ma sarebbe la forma che avrebbe
-- preso — più conti in sospeso, più bassa la tassa stimata.
--
-- LA SOLUZIONE SCELTA: si sdoppia **sulle imposte**, non sui ricavi. Due
-- cifre affiancate — la stima su tutto l'incassato e la stima sul solo
-- fiscalizzato — e la cifra vera sta in mezzo finché i conti in sospeso
-- non vengono regolarizzati. Lo stesso modo in cui il gestionale già
-- tratta le voci non misurate: non le riempie e non le nasconde, le
-- dichiara.
--
-- ⚠️ E IL MOTORE FISCALE RESTA UNO SOLO. Qui non si calcola nessuna
-- imposta: `calcola_imposte()` viene **chiamata due volte** con due basi
-- diverse. Scrivere un secondo calcolo «per il fiscalizzato» sarebbe
-- esattamente il difetto che il 15/08 si è finito di togliere.
--
-- Idempotente (§7 punto 3), con blocco di verifica e auto-registrazione.
-- ---------------------------------------------------------------------

-- =====================================================================
-- Quanto dei ricavi di un anno non ha ancora un documento fiscale
-- =====================================================================
-- ⚠️ Legge dai conti chiusi, come i ricavi: è **la stessa fonte**, filtrata
-- diversamente. Se leggesse da un'altra parte, i due numeri potrebbero
-- diventare incoerenti e nessuno saprebbe quale credere.
create or replace function ricavi_non_fiscalizzati(
  p_entity_id uuid,
  p_anno      integer
)
returns table (
  importo   numeric,
  conti     integer,
  promesse  numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  return query
  with conti_anno as (
    select o.documento_fiscale,
           coalesce(d.collected_amount, t.totale) as incasso
      from orders o
      left join discounts_gifts d on d.id = o.discount_gift_id
      cross join lateral totale_conto(o.id) t
     where o.entity_id = p_entity_id
       and o.status in ('chiuso', 'omaggiato')
       and extract(year from o.closed_at) = p_anno
  ),
  sospesi as (
    select * from conti_anno
     where incasso > 0
       and (documento_fiscale is null or documento_fiscale = 'fattura_da_emettere')
  )
  select coalesce((select sum(incasso) from sospesi), 0),
         coalesce((select count(*) from sospesi), 0)::integer,
         coalesce((select sum(incasso) from sospesi
                    where documento_fiscale = 'fattura_da_emettere'), 0);
end;
$function$;

revoke all on function ricavi_non_fiscalizzati(uuid, integer) from public, anon, authenticated;
grant execute on function ricavi_non_fiscalizzati(uuid, integer) to authenticated;

-- =====================================================================
-- Le due cifre, che non si separano mai
-- =====================================================================
create or replace function imposte_e_fiscalizzato(
  p_entity_id uuid,
  p_anno      integer,
  p_imponibile numeric,
  p_costo_lavoro numeric default 0
)
returns table (
  su_tutto_incassato   numeric,
  su_solo_fiscalizzato numeric,
  non_fiscalizzato     numeric,
  conti_sospesi        integer,
  avvertenza           text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_sosp   numeric;
  v_conti  integer;
  v_prom   numeric;
  v_tutto  numeric;
  v_fisc   numeric;
  imp      record;
  v_limite text;
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select r.importo, r.conti, r.promesse into v_sosp, v_conti, v_prom
    from ricavi_non_fiscalizzati(p_entity_id, p_anno) r;

  -- ⚠️ Due chiamate allo STESSO motore, non due calcoli.
  select * into imp from calcola_imposte(p_entity_id, p_imponibile, p_costo_lavoro);
  v_tutto  := imp.totale;
  v_limite := imp.avvertenza;

  select * into imp
    from calcola_imposte(p_entity_id, greatest(p_imponibile - v_sosp, 0), p_costo_lavoro);
  v_fisc := imp.totale;

  return query select
    v_tutto, v_fisc, v_sosp, v_conti,
    (case
       when v_conti = 0 then
         'Tutti i conti incassati dell''anno hanno il loro documento fiscale: le due stime coincidono.'
       else
         v_conti || ' conti incassati non hanno ancora un documento fiscale. '
         || 'La cifra vera sta FRA le due: si sposta verso la prima man mano che li regolarizzi.'
         || (case when v_prom > 0
                  then ' Di quei conti, una parte sono fatture che hai promesso e devi ancora emettere.'
                  else '' end)
     end)
    -- Il limite del motore fiscale viaggia comunque, come sempre: le due
    -- cifre restano stime, e la semplificazione dell'IRAP vale per
    -- entrambe.
    || ' ' || coalesce(v_limite, '');
end;
$function$;

comment on function imposte_e_fiscalizzato is
  'Due cifre affiancate (16/08/2026, decisione di Alessio): imposte stimate su tutto l''incassato e sul solo fiscalizzato. La vera sta in mezzo finche'' i conti in sospeso non sono regolarizzati. NON calcola nulla: chiama due volte calcola_imposte(), perche'' il motore fiscale resta uno solo.';

revoke all on function imposte_e_fiscalizzato(uuid, integer, numeric, numeric) from public, anon, authenticated;
grant execute on function imposte_e_fiscalizzato(uuid, integer, numeric, numeric) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_ente     uuid;
  v_titolare uuid;
  v_staff    uuid;
  v_c1       uuid;
  v_c2       uuid;
  t          record;
  r          record;
  n          integer;
  respinto   boolean;
  v_ha_fisc  boolean;
begin
  select id into v_ente from entities where entity_type = 'srls' limit 1;
  if v_ente is null then select id into v_ente from entities limit 1; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_ente is null or v_titolare is null then
    raise exception 'Prerequisiti mancanti.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Due conti chiusi nel 2090: uno scontrinato, uno no.
  insert into orders (entity_id, table_label, status, payment_method, coperti,
                      coperto_unit_price, opened_at, closed_at, note, documento_fiscale,
                      documento_emesso_il)
  values (v_ente, '__PROVA IMP A__', 'chiuso', 'contante', 0, 5,
          make_date(2090,3,1), make_date(2090,3,1), '__PROVA IMPOSTE__', 'scontrino', make_date(2090,3,1))
  returning id into v_c1;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_c1, 'Piatto', 'cucina', 1, 100);

  insert into orders (entity_id, table_label, status, payment_method, coperti,
                      coperto_unit_price, opened_at, closed_at, note)
  values (v_ente, '__PROVA IMP B__', 'chiuso', 'contante', 0, 5,
          make_date(2090,3,2), make_date(2090,3,2), '__PROVA IMPOSTE__')
  returning id into v_c2;
  insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
  values (v_c2, 'Piatto', 'cucina', 1, 400);

  select * into r from ricavi_non_fiscalizzati(v_ente, 2090);
  if r.importo <> 400 or r.conti <> 1 then
    raise exception 'Non fiscalizzato: % su % conti, attesi 400 su 1.', r.importo, r.conti;
  end if;

  -- ⚠️ QUI SI CHIUDE UNA TRAPPOLA CHE QUESTO PROGETTO HA GIÀ INCONTRATO
  -- TRE VOLTE. `fiscal_settings` ha una riga in PRODUZIONE (la S.r.l.s.) e
  -- nessuna sul progetto di prova, perché quelle righe le crea Alessio dal
  -- Simulatore e non una migrazione. Saltando i controlli quando la riga
  -- manca, tutta la parte fiscale di questa verifica avrebbe girato **per
  -- la prima volta in produzione** — cioè la prova sarebbe stata su uno
  -- stato di partenza diverso da quello vero esattamente nel punto
  -- rilevante (12/08, 14/08, 15/08: sempre la stessa lezione).
  --
  -- Quindi, se manca, se ne crea una **temporanea** e la si toglie alla
  -- fine. Se c'è, è di Alessio e non si tocca: si legge e basta.
  select exists (select 1 from fiscal_settings f where f.entity_id = v_ente) into v_ha_fisc;
  if not v_ha_fisc then
    insert into fiscal_settings (entity_id) values (v_ente);
  end if;

  begin
    select * into t from imposte_e_fiscalizzato(v_ente, 2090, 1000, 0);

    -- ⚠️ Le due cifre devono essere DIVERSE quando c'è del sospeso: se
    -- coincidessero, l'informazione che questo blocco esiste per dare non
    -- ci sarebbe.
    if t.su_tutto_incassato <= t.su_solo_fiscalizzato then
      raise exception 'Con 400 di ricavi non fiscalizzati le due stime non differiscono (% e %).',
        t.su_tutto_incassato, t.su_solo_fiscalizzato;
    end if;
    if t.non_fiscalizzato <> 400 or t.conti_sospesi <> 1 then
      raise exception 'Le due cifre non riportano il sospeso giusto.';
    end if;
    if position('sta FRA le due' in t.avvertenza) = 0 then
      raise exception 'L''avvertenza non dice che la cifra vera sta in mezzo.';
    end if;

    -- ⚠️ E il calcolo NON è un secondo motore: la stima su tutto deve
    -- coincidere esattamente con calcola_imposte() sullo stesso
    -- imponibile. Se un domani qualcuno ci scrivesse dentro un calcolo
    -- proprio, questo controllo diventerebbe rosso.
    if t.su_tutto_incassato <> (select totale from calcola_imposte(v_ente, 1000, 0)) then
      raise exception 'La stima su tutto non coincide col motore fiscale unico.';
    end if;
    if t.su_solo_fiscalizzato <> (select totale from calcola_imposte(v_ente, 600, 0)) then
      raise exception 'La stima sul fiscalizzato non coincide col motore fiscale unico.';
    end if;

    -- Regolarizzandolo, le due cifre tornano a coincidere.
    update orders set documento_fiscale = 'scontrino', documento_emesso_il = make_date(2090,3,3)
     where id = v_c2;
    select * into t from imposte_e_fiscalizzato(v_ente, 2090, 1000, 0);
    if t.su_tutto_incassato <> t.su_solo_fiscalizzato then
      raise exception 'Regolarizzati tutti i conti, le due stime restano diverse.';
    end if;
    if position('coincidono' in t.avvertenza) = 0 then
      raise exception 'L''avvertenza non dichiara che le due stime coincidono.';
    end if;
  end;

  -- ---- Il portiere ------------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform * from ricavi_non_fiscalizzati(v_ente, 2090);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge i ricavi non fiscalizzati.';
    end if;
    respinto := false;
    begin
      perform * from imposte_e_fiscalizzato(v_ente, 2090, 1000, 0);
    exception when sqlstate 'P0001' then respinto := true;
    end;
    if not respinto then
      raise exception 'Lo staff legge le due stime delle imposte.';
    end if;
  end if;

  -- ---- Pulizia -----------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ⚠️ Si RIMETTE com'era: se la riga dei parametri fiscali l'ha creata
  -- questa verifica, se ne va con lei. Se c'era gia', e' di Alessio e
  -- resta intatta — non e' stata toccata in nessun punto.
  if not v_ha_fisc then
    delete from fiscal_settings where entity_id = v_ente;
  end if;

  delete from order_items where order_id in (select id from orders where note = '__PROVA IMPOSTE__');
  delete from stock_consumptions where order_id in (select id from orders where note = '__PROVA IMPOSTE__');
  delete from anomalie_scarico where order_id in (select id from orders where note = '__PROVA IMPOSTE__');
  delete from orders where note = '__PROVA IMPOSTE__';

  select count(*) into n from orders where note = '__PROVA IMPOSTE__';
  if n <> 0 then
    raise exception 'La verifica ha lasciato % conti.', n;
  end if;
  select count(*) into n from fiscal_settings where entity_id = v_ente;
  if (v_ha_fisc and n <> 1) or ((not v_ha_fisc) and n <> 0) then
    raise exception 'I parametri fiscali non sono tornati come erano (righe: %).', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Imposte: due cifre affiancate, la vera in mezzo, e il motore fiscale resta uno solo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260816000002', 'imposte_e_non_fiscalizzato')
on conflict (version) do nothing;

select
  (select count(*) from orders where status in ('chiuso','omaggiato')
     and (documento_fiscale is null or documento_fiscale = 'fattura_da_emettere')) as conti_sospesi;
