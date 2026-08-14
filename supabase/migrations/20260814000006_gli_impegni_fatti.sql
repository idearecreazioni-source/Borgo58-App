-- =====================================================================
-- Gli impegni fatti: dove finiscono, e come si torna indietro
-- =====================================================================
-- Rifinitura chiesta da Alessio guardando l'Agenda nuova. Con le corsie,
-- un impegno segnato «fatto» **sparisce dalla schermata** — e fin qui e'
-- giusto, la lista deve rispondere a *cosa devo fare adesso*. Ma cosi'
-- un tocco sbagliato non si poteva piu' annullare, e togliendo il
-- pulsante «elimina i completati» non restava nemmeno un posto dove
-- vederli.
--
-- ⚠️ **Il caso che rende la cosa non banale sono le RICORRENZE.** Chiudere
--    un impegno che torna ne fa nascere subito un altro. Rimetterlo «da
--    fare» senza toccare il successore lascerebbe **due righe per lo
--    stesso adempimento**, e la seconda sembrerebbe legittima: nessuno
--    saprebbe che e' un residuo. Per questo il successore porta scritto
--    da chi e' nato (`generato_da`), e riaprendo l'originale viene tolto
--    — ma **solo se nessuno l'ha ancora toccato**. Se e' gia' stato
--    chiuso a sua volta resta dov'e', e la schermata lo dice.
-- =====================================================================

alter table tasks
  add column if not exists generato_da uuid references tasks(id) on delete set null;

comment on column tasks.generato_da is
  'Se questo impegno e'' nato chiudendone un altro ricorrente, qui c''e'' quale. Serve a non lasciare due righe per lo stesso adempimento quando si annulla un «fatto».';

create index if not exists idx_tasks_generato_da on tasks (generato_da) where generato_da is not null;

-- ---------------------------------------------------------------------
-- 1. Chi genera il successore adesso lo firma
-- ---------------------------------------------------------------------
create or replace function completa_task(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_t     tasks%rowtype;
  v_nuovo uuid;
  v_data  date;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_t from tasks where id = p_id for update;
  if v_t.id is null then raise exception 'Impegno non trovato'; end if;
  if not (is_titolare() or v_t.visibile_staff) then
    raise exception 'Questo impegno non e'' tuo';
  end if;
  if v_t.status = 'completato' then
    raise exception 'Questo impegno risulta gia'' fatto';
  end if;

  update tasks set status = 'completato' where id = p_id;

  if v_t.ricorrenza is not null then
    -- Si conta dalla scadenza, non da oggi: un adempimento annuale
    -- chiuso in ritardo deve tornare alla SUA data, non spostarsi in
    -- avanti di quanto si e' tardato.
    v_data := coalesce(v_t.due_date, (now() at time zone 'Europe/Rome')::date);
    v_data := case v_t.ricorrenza
                when 'mensile'     then v_data + interval '1 month'
                when 'trimestrale' then v_data + interval '3 months'
                when 'semestrale'  then v_data + interval '6 months'
                when 'annuale'     then v_data + interval '1 year'
              end::date;

    insert into tasks (title, description, due_date, due_time, priority, status,
                       category, origine_modulo, visibile_staff, preferito, ricorrenza,
                       generato_da)
    values (v_t.title, v_t.description, v_data, v_t.due_time, v_t.priority, 'da_fare',
            v_t.category, v_t.origine_modulo, v_t.visibile_staff, v_t.preferito, v_t.ricorrenza,
            p_id)
    returning id into v_nuovo;
  end if;

  return v_nuovo;
end;
$funzione$;

revoke all on function completa_task(uuid) from public, anon;
grant execute on function completa_task(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Rimettere «da fare» — e portarsi dietro il successore
-- ---------------------------------------------------------------------
create or replace function riapri_task(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_t        tasks%rowtype;
  v_succ     tasks%rowtype;
  v_tolto    boolean := false;
  v_rimasto  boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_t from tasks where id = p_id for update;
  if v_t.id is null then raise exception 'Impegno non trovato'; end if;
  if not (is_titolare() or v_t.visibile_staff) then
    raise exception 'Questo impegno non e'' tuo';
  end if;
  if v_t.status <> 'completato' then
    raise exception 'Questo impegno non risulta fatto';
  end if;

  update tasks set status = 'da_fare' where id = p_id;

  -- Il successore nato da questa chiusura.
  select * into v_succ from tasks where generato_da = p_id limit 1;
  if v_succ.id is not null then
    if v_succ.status = 'da_fare' then
      -- Nessuno l'ha ancora toccato: era solo la conseguenza del «fatto»
      -- che stiamo annullando, e due righe per lo stesso adempimento
      -- sarebbero indistinguibili da due impegni veri.
      delete from tasks where id = v_succ.id;
      v_tolto := true;
    else
      -- Ci ha gia' lavorato sopra: non si cancella il lavoro di nessuno
      -- per annullare un tocco. Lo si dice e basta.
      v_rimasto := true;
    end if;
  end if;

  return jsonb_build_object('successore_tolto', v_tolto, 'successore_rimasto', v_rimasto);
end;
$funzione$;

revoke all on function riapri_task(uuid) from public, anon;
grant execute on function riapri_task(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Cosa e' stato fatto di recente
-- ---------------------------------------------------------------------
create or replace function agenda_fatti(p_giorni integer default 30)
returns table (
  id             uuid,
  title          text,
  category       text,
  due_date       date,
  origine_modulo text,
  ricorrenza     text,
  visibile_staff boolean,
  fatto_il       timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select t.id, t.title, t.category, t.due_date, t.origine_modulo,
         t.ricorrenza, t.visibile_staff, t.updated_at
    from tasks t
   where t.status = 'completato'
     and (is_titolare() or t.visibile_staff)
     -- `updated_at` e' quando e' stato chiuso: e' l'ultima cosa che gli
     -- e' successa. Non e' una data di chiusura vera, e per questo la
     -- finestra e' generosa invece che precisa.
     and t.updated_at > now() - make_interval(days => greatest(coalesce(p_giorni, 30), 1))
   order by t.updated_at desc;
end;
$funzione$;

comment on function agenda_fatti(integer) is
  'Gli impegni chiusi di recente. Esistono perche'' un «fatto» premuto per sbaglio deve poter tornare indietro: senza, la spunta e'' irreversibile e nessuno la usa con serenita''.';

revoke all on function agenda_fatti(integer) from public, anon;
grant execute on function agenda_fatti(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_a uuid; v_r uuid; v_succ uuid; v_out jsonb;
  n integer; respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'Serve un titolare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- 1. Un impegno normale: si chiude, si rivede fra i fatti, si riapre.
  insert into tasks (title, priority, status, due_date, visibile_staff, category)
  values ('PROVA FATTI semplice', 'media', 'da_fare', v_oggi, false, 'altro')
  returning id into v_a;

  perform completa_task(v_a);
  select count(*) into n from agenda_fatti(30) where id = v_a;
  if n <> 1 then raise exception 'Un impegno chiuso non compare fra i fatti.'; end if;
  select count(*) into n from agenda_corsie() where id = v_a;
  if n <> 0 then raise exception 'Un impegno chiuso compare ancora nelle corsie.'; end if;

  v_out := riapri_task(v_a);
  if (select status from tasks where id = v_a)::text <> 'da_fare' then
    raise exception 'Riaprendo, l''impegno non e'' tornato da fare.';
  end if;
  select count(*) into n from agenda_corsie() where id = v_a;
  if n <> 1 then raise exception 'Un impegno riaperto non torna nelle corsie.'; end if;

  -- 2. ⚠️ IL CASO CHE CONTA: un ricorrente riaperto non deve lasciare due
  --    righe per lo stesso adempimento.
  insert into tasks (title, priority, status, due_date, ricorrenza, visibile_staff, category)
  values ('PROVA FATTI ricorrente', 'media', 'da_fare', v_oggi, 'annuale', false, 'fisco_scadenze')
  returning id into v_r;

  v_succ := completa_task(v_r);
  if v_succ is null then raise exception 'Il ricorrente non ha generato il successore.'; end if;
  if (select generato_da from tasks where id = v_succ) <> v_r then
    raise exception 'Il successore non porta scritto da chi e'' nato.';
  end if;

  v_out := riapri_task(v_r);
  if (v_out->>'successore_tolto')::boolean is not true then
    raise exception 'Riaprendo il ricorrente, il successore non e'' stato tolto.';
  end if;
  select count(*) into n from tasks where id = v_succ;
  if n <> 0 then raise exception 'Il successore e'' rimasto: due righe per lo stesso adempimento.'; end if;

  -- 3. ...ma se qualcuno ci ha gia' lavorato sopra, NON si cancella.
  v_succ := completa_task(v_r);
  update tasks set status = 'completato' where id = v_succ;
  v_out := riapri_task(v_r);
  if (v_out->>'successore_rimasto')::boolean is not true then
    raise exception 'Il successore gia'' lavorato doveva restare, e va detto.';
  end if;
  select count(*) into n from tasks where id = v_succ;
  if n <> 1 then raise exception 'E'' stato cancellato il lavoro di qualcun altro.'; end if;

  -- 4. Un impegno da fare non si «riapre».
  respinto := false;
  begin perform riapri_task(v_a);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Un impegno da fare si e'' lasciato riaprire.'; end if;

  perform set_config('request.jwt.claims', null, true);

  -- 5. L'elenco anonimi non e' cresciuto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then raise exception 'L''elenco anonimi e'' passato a %.', n; end if;
  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from tasks where generato_da in (select id from tasks where title like 'PROVA FATTI%');
  delete from tasks where title like 'PROVA FATTI%';
  select count(*) into n from tasks where title like 'PROVA FATTI%';
  if n <> 0 then raise exception 'La prova ha lasciato % impegni.', n; end if;

  raise notice 'Impegni fatti: si rivedono, si riaprono, e un ricorrente riaperto non lascia doppioni.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260814000006', 'gli_impegni_fatti')
on conflict (version) do nothing;

select count(*) as fatti_ultimi_30_giorni from tasks
 where status = 'completato' and updated_at > now() - interval '30 days';
