-- =====================================================================
-- Un problema registrato deve avere un rimedio
-- =====================================================================
-- Rilievi 3 e 4 del referto del 13/08, che sono lo stesso difetto in due
-- registri diversi, più il rilievo 6.
--
-- ---------------------------------------------------------------------
-- 3 e 4 — il fuori range e la merce non conforme
-- ---------------------------------------------------------------------
-- Il registro temperature confrontava la lettura col range del frigo e
-- scriveva **«Fuori range»** in rosso. Poi: l'azione correttiva era
-- facoltativa, non nasceva nessuna non conformità, e niente impediva di
-- salvare e andare avanti. Identico al ricevimento merci: si toglie la
-- spunta a «conforme» — merce rotta, arrivata calda — e non succedeva
-- niente.
--
-- ⚠️ PERCHÉ È PEGGIO DI NON AVERLO SCRITTO. Quei registri si esibiscono a
-- un'ispezione. Una riga «frigo a +12 °C, fuori range» senza niente
-- accanto non è un buco nella documentazione: è una **dichiarazione
-- firmata** che te ne sei accorto e non hai fatto nulla. L'ispettore non
-- trova un'omissione, trova una prova.
--
-- ⚠️ E PERCHÉ NON SI BLOCCA IL SALVATAGGIO. La tentazione era pretendere
-- l'azione correttiva prima di poter registrare. Sarebbe stato l'errore
-- peggiore: davanti a un campo obbligatorio, alle undici di sera, uno non
-- scrive il rimedio — **non registra la lettura**. E una misurazione
-- persa è irrecuperabile, mentre un rimedio scritto dopo è ancora un
-- rimedio. Quindi la lettura si salva SEMPRE, e il problema apre da sé
-- una non conformità che resta **aperta** finché qualcuno non la chiude.
-- Il registro diventa: «me ne sono accorto, ecco cosa ho fatto» — oppure,
-- se nessuno la chiude, «me ne sono accorto e c'è ancora una cosa in
-- sospeso», che è vero e visibile invece che nascosto.
--
-- Sono due tabelle in una transazione (la lettura e la non conformità):
-- categoria B4, quindi funzione Postgres e corridoio, non due scritture
-- in fila dal browser.
--
-- ---------------------------------------------------------------------
-- 6 — le ferie
-- ---------------------------------------------------------------------
-- I giorni erano un numero digitato a mano che poteva essere vuoto o non
-- c'entrare niente con le date («dal 1 al 15 agosto, 2 giorni»), e due
-- permessi potevano sovrapporsi senza che nessuno dicesse niente.
-- Innocuo finché non c'è personale; il giorno in cui qualcuno chiede
-- quante ferie gli restano, la risposta non è affidabile.
--
-- I giorni ora si calcolano dalle date se non vengono scritti — restano
-- correggibili a mano per i mezzi giorni e i permessi a ore — e la
-- sovrapposizione è **impedita dal database**, non segnalata dopo.
-- =====================================================================

-- ⚠️ `btree_gist` NON va installata in `public`. Installandola lì porta
-- con sé ~190 funzioni di supporto (`cash_dist`, `date_dist`, …), tutte
-- eseguibili con la chiave pubblica del sito: l'elenco di chi può bussare
-- da fuori passa da 12 a 200 in un colpo solo.
--
-- Non è un ragionamento a tavolino: **è successo**. La prova automatica
-- costruita stamattina — quella che congela l'elenco a 12 — è diventata
-- rossa su questa riga poche ore dopo essere stata scritta, e ha preso
-- chi l'aveva costruita. È il modo giusto di funzionare, ed è la
-- differenza fra un controllo e una buona intenzione.
create schema if not exists extensions;

do $$
begin
  -- Se una passata precedente l'aveva messa in public, si sposta: prima
  -- via il vincolo che ne dipende, poi l'estensione.
  if exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'btree_gist' and n.nspname = 'public'
  ) then
    alter table employee_leaves drop constraint if exists employee_leaves_niente_sovrapposizioni;
    drop extension btree_gist;
  end if;
end
$$;

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 1. La temperatura: si registra sempre, e il fuori range lascia traccia
-- ---------------------------------------------------------------------
create or replace function registra_temperatura(
  p_equipment_id      uuid,
  p_recorded_temp_c   numeric,
  p_note              text default null,
  p_corrective_action text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
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
      category, description, detected_at, corrective_action, resolved, resolved_at, note
    ) values (
      'temperatura',
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
$funzione$;

comment on function registra_temperatura(uuid, numeric, text, text) is
  'Registra una lettura di temperatura. La lettura si salva SEMPRE — una misurazione persa e'' irrecuperabile — e se e'' fuori range apre da se'' una non conformita'', chiusa se il rimedio c''e'' gia'', aperta altrimenti.';

revoke all on function registra_temperatura(uuid, numeric, text, text) from public, anon;
grant execute on function registra_temperatura(uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Il ricevimento merci: stessa forma, stesso rimedio
-- ---------------------------------------------------------------------
create or replace function registra_ricevimento_merci(
  p_supplier_id         uuid,
  p_product_description text,
  p_temperature_c       numeric default null,
  p_packaging_ok        boolean default true,
  p_conformity          boolean default true,
  p_note                text default null,
  p_azione              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_ric  uuid;
  v_nc   uuid;
  v_male boolean;
  v_risolta boolean;
  v_forn text;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;
  if nullif(trim(coalesce(p_product_description, '')), '') is null then
    raise exception 'Serve la descrizione della merce ricevuta';
  end if;

  insert into haccp_goods_receiving (
    supplier_id, product_description, temperature_c, packaging_ok, conformity, note
  ) values (
    p_supplier_id, p_product_description, p_temperature_c,
    coalesce(p_packaging_ok, true), coalesce(p_conformity, true), nullif(p_note, '')
  )
  returning id into v_ric;

  v_male := not coalesce(p_conformity, true) or not coalesce(p_packaging_ok, true);

  if v_male then
    select name into v_forn from suppliers where id = p_supplier_id;
    v_risolta := nullif(p_azione, '') is not null;

    insert into haccp_non_conformities (
      category, description, detected_at, corrective_action, resolved, resolved_at, note
    ) values (
      'ricevimento',
      'Merce non conforme al ricevimento: ' || p_product_description
        || coalesce(' — ' || v_forn, '')
        || case when not coalesce(p_conformity, true) then ' — prodotto non conforme' else '' end
        || case when not coalesce(p_packaging_ok, true) then ' — imballaggio non integro' else '' end
        || coalesce(' — ' || trim(to_char(p_temperature_c, 'FM9990.0')) || ' °C', ''),
      now(),
      nullif(p_azione, ''),
      v_risolta,
      case when v_risolta then now() end,
      nullif(p_note, '')
    )
    returning id into v_nc;
  end if;

  return jsonb_build_object(
    'ricevimento_id', v_ric,
    'non_conforme', v_male,
    'non_conformita_id', v_nc,
    'da_chiudere', v_male and nullif(p_azione, '') is null);
end
$funzione$;

comment on function registra_ricevimento_merci(uuid, text, numeric, boolean, boolean, text, text) is
  'Registra un ricevimento merci. Se la merce non e'' conforme o l''imballaggio non e'' integro, apre da se'' una non conformita'': prima restava scritto che la merce era da respingere ed era entrata comunque, senza traccia di cosa si fosse deciso.';

revoke all on function registra_ricevimento_merci(uuid, text, numeric, boolean, boolean, text, text) from public, anon;
grant execute on function registra_ricevimento_merci(uuid, text, numeric, boolean, boolean, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Le ferie: i giorni si contano, le sovrapposizioni non si accettano
-- ---------------------------------------------------------------------
create or replace function conta_giorni_permesso()
returns trigger
language plpgsql
set search_path = public
as $funzione$
begin
  if new.end_date < new.start_date then
    raise exception 'Il permesso finisce prima di cominciare (dal % al %)', new.start_date, new.end_date;
  end if;
  -- Solo se non e' stato scritto: mezze giornate e permessi a ore
  -- restano una decisione di chi li registra.
  if new.days is null then
    new.days := (new.end_date - new.start_date) + 1;
  end if;
  return new;
end
$funzione$;

-- ⚠️ Anche una funzione trigger nasce eseguibile da chiunque abbia la
-- chiave pubblica del sito (§8). Questa revoca non e' una formalita': la
-- prova automatica che congela l'elenco a 12 e' diventata rossa proprio
-- su questa riga, poche ore dopo essere stata scritta. Il controllo ha
-- preso chi l'aveva costruito, che e' il modo giusto di funzionare.
revoke all on function conta_giorni_permesso() from public, anon, authenticated;

drop trigger if exists trg_conta_giorni_permesso on employee_leaves;
create trigger trg_conta_giorni_permesso
  before insert or update on employee_leaves
  for each row execute function conta_giorni_permesso();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employee_leaves_niente_sovrapposizioni') then
    -- La classe di operatori gist per uuid vive in `extensions`: va resa
    -- visibile per questa sola istruzione.
    perform set_config('search_path', 'public, extensions', true);
    alter table employee_leaves add constraint employee_leaves_niente_sovrapposizioni
      exclude using gist (
        employee_id with =,
        daterange(start_date, end_date, '[]') with &&
      );
  end if;
end
$$;

comment on constraint employee_leaves_niente_sovrapposizioni on employee_leaves is
  'Lo stesso dipendente non puo'' essere in ferie e in malattia negli stessi giorni. Impedito dal database, non segnalato dopo.';

-- ---------------------------------------------------------------------
-- 4. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_eq   uuid;
  v_forn uuid;
  v_dip  uuid;
  v_out  jsonb;
  v_titolare uuid;
  v_giorni numeric;
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'Nessun titolare in user_roles.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into haccp_equipment (name, target_min_c, target_max_c)
  values ('PROVA NC frigo', 0, 4) returning id into v_eq;

  -- 1. Dentro il range: nessuna non conformita'.
  v_out := registra_temperatura(v_eq, 2);
  if (v_out->>'fuori_range')::boolean then
    raise exception 'Una temperatura nel range risulta fuori range.';
  end if;
  select count(*) into n from haccp_non_conformities where description like 'PROVA NC frigo%';
  if n <> 0 then raise exception 'Una lettura regolare ha aperto una non conformita''.'; end if;

  -- 2. ZERO GRADI E' UNA TEMPERATURA, non un dato mancante: e' dentro il
  --    range e non deve essere scambiata per «non misurato».
  v_out := registra_temperatura(v_eq, 0);
  if (v_out->>'fuori_range')::boolean then
    raise exception 'Zero gradi e'' stato trattato come fuori range.';
  end if;

  -- 3. Fuori range SENZA rimedio: la lettura si salva lo stesso e resta
  --    una non conformita' APERTA.
  v_out := registra_temperatura(v_eq, 12);
  if not (v_out->>'fuori_range')::boolean then
    raise exception '12 gradi in un frigo 0/4 non risulta fuori range.';
  end if;
  if v_out->>'lettura_id' is null then
    raise exception 'La lettura fuori range non e'' stata salvata: una misurazione persa e'' irrecuperabile.';
  end if;
  if not (v_out->>'da_chiudere')::boolean then
    raise exception 'Un fuori range senza rimedio non ha lasciato niente da chiudere.';
  end if;
  select count(*) into n from haccp_non_conformities
   where description like 'PROVA NC frigo%' and not resolved;
  if n <> 1 then raise exception 'Non conformita'' aperte: % invece di 1.', n; end if;

  -- 4. Fuori range CON il rimedio gia' scritto: nasce chiusa.
  v_out := registra_temperatura(v_eq, 11, null, 'Spostata la merce nel frigo 2 e chiamato il tecnico');
  if (v_out->>'da_chiudere')::boolean then
    raise exception 'Con il rimedio scritto la non conformita'' e'' rimasta aperta.';
  end if;
  select count(*) into n from haccp_non_conformities
   where description like 'PROVA NC frigo%' and resolved;
  if n <> 1 then raise exception 'Non conformita'' chiuse: % invece di 1.', n; end if;

  -- 5. Senza range non si giudica: nessun falso allarme.
  declare v_eq2 uuid;
  begin
    insert into haccp_equipment (name) values ('PROVA NC senza range') returning id into v_eq2;
    v_out := registra_temperatura(v_eq2, 40);
    if (v_out->>'fuori_range')::boolean then
      raise exception 'Un''attrezzatura senza range ha prodotto un fuori range.';
    end if;
    delete from haccp_temperature_logs where equipment_id = v_eq2;
    delete from haccp_equipment where id = v_eq2;
  end;

  -- 6. Ricevimento merci non conforme: apre una non conformita'.
  insert into suppliers (entity_id, name, category)
  values (v_ente, 'PROVA NC fornitore', 'ortofrutta') returning id into v_forn;

  v_out := registra_ricevimento_merci(v_forn, 'PROVA NC cassa di pomodori', 12, true, false, null, null);
  if not (v_out->>'non_conforme')::boolean then
    raise exception 'Merce dichiarata non conforme non risulta non conforme.';
  end if;
  select count(*) into n from haccp_non_conformities
   where category = 'ricevimento' and description like '%PROVA NC cassa%' and not resolved;
  if n <> 1 then raise exception 'Il ricevimento non conforme non ha aperto niente.'; end if;

  -- 7. ...e un ricevimento regolare non apre niente.
  v_out := registra_ricevimento_merci(v_forn, 'PROVA NC cassa regolare', 3, true, true, null, null);
  if (v_out->>'non_conforme')::boolean then
    raise exception 'Un ricevimento regolare risulta non conforme.';
  end if;

  -- 8. Le ferie: i giorni si contano da soli.
  insert into employees (entity_id, first_name, last_name, role)
  values (v_ente, 'PROVA', 'NC Dipendente', 'sala') returning id into v_dip;

  insert into employee_leaves (employee_id, leave_type, start_date, end_date)
  values (v_dip, 'ferie', '2027-08-01', '2027-08-15');
  select days into v_giorni from employee_leaves where employee_id = v_dip;
  if v_giorni <> 15 then raise exception 'Dal 1 al 15 sono % giorni invece di 15.', v_giorni; end if;

  -- 9. ...ma un numero scritto a mano resta (mezze giornate, permessi a ore).
  insert into employee_leaves (employee_id, leave_type, start_date, end_date, days)
  values (v_dip, 'permesso', '2027-09-01', '2027-09-01', 0.5);
  select days into v_giorni from employee_leaves where employee_id = v_dip and leave_type = 'permesso';
  if v_giorni is distinct from 0.5 then raise exception 'La mezza giornata scritta a mano e'' stata riscritta (risulta %).', v_giorni; end if;

  -- 10. Due permessi sovrapposti: rifiutati dal database.
  begin
    insert into employee_leaves (employee_id, leave_type, start_date, end_date)
    values (v_dip, 'malattia', '2027-08-10', '2027-08-20');
    raise exception 'Due permessi sovrapposti sono stati accettati.';
  exception when exclusion_violation then
    null;  -- e' il rifiuto che ci si aspetta
  end;

  -- 11. Un permesso che finisce prima di cominciare non entra.
  begin
    insert into employee_leaves (employee_id, leave_type, start_date, end_date)
    values (v_dip, 'ferie', '2027-10-10', '2027-10-01');
    raise exception 'Un permesso a rovescio e'' stato accettato.';
  exception when sqlstate 'P0001' then
    null;
  end;

  -- 12. Pulizia (regola del 12/08).
  delete from employee_leaves where employee_id = v_dip;
  delete from employees where id = v_dip;
  delete from haccp_non_conformities where description like '%PROVA NC%';
  delete from haccp_goods_receiving where product_description like 'PROVA NC%';
  delete from haccp_temperature_logs where equipment_id = v_eq;
  delete from haccp_equipment where id = v_eq;
  delete from suppliers where id = v_forn;

  select count(*) into n from haccp_non_conformities where description like '%PROVA NC%';
  if n <> 0 then raise exception 'La prova ha lasciato % non conformita''.', n; end if;
  select count(*) into n from haccp_equipment where name like 'PROVA NC%';
  if n <> 0 then raise exception 'La prova ha lasciato % attrezzature.', n; end if;

  raise notice 'Un problema registrato lascia un rimedio da chiudere, e le ferie si contano da sole.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000011', 'un_problema_ha_un_rimedio')
on conflict (version) do nothing;

select count(*) filter (where not resolved) as non_conformita_aperte,
       count(*)                             as totali
  from haccp_non_conformities;
