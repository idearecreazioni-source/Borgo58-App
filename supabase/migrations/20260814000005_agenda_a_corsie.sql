-- =====================================================================
-- L'Agenda ridisegnata (Blocco 1 del mandato cumulativo)
-- =====================================================================
-- Oggi l'Agenda e' un elenco piatto con tre filtri — cerca, priorita',
-- stato — che non rispondono alla domanda vera: **cosa devo fare
-- adesso**. Letto in produzione col connettore, lo stato di fatto:
--
--   · 20 impegni in tutto;
--   · **5 senza scadenza**, che in un elenco ordinato per data finiscono
--     in fondo e non li guarda piu' nessuno — sono invisibili;
--   · **quattro convenzioni diverse** per la categoria su venti righe:
--     `Adempimenti societari`, `Documenti`, `amministrativo`, e vuoto.
--
-- ---------------------------------------------------------------------
-- 1. LE CATEGORIE SI CHIUDONO, MA NESSUN MODULO SI ROMPE
-- ---------------------------------------------------------------------
-- La categoria e' testo libero e la scrivono **cinque posti diversi**:
-- l'Archivio documenti, la Posta, la Proiezione fiscale, il Personale e
-- Alessio a mano. Mettere un vincolo e basta romperebbe quattro flussi
-- che oggi funzionano.
--
-- Quindi la regola va **prima** del vincolo: un trigger normalizza cio'
-- che arriva (`categoria_task()`), e solo dopo il vincolo pretende un
-- valore dell'elenco chiuso. Chi scrive continua a scrivere come sa, e
-- una quinta convenzione **non puo' nascere**: e' automazione al posto
-- della disciplina (§5), non una convenzione da ricordare.
--
-- ⚠️ **Cio' che non si sa dove mettere finisce in «altro», non nella
--    casella piu' probabile.** Una classificazione plausibile e sbagliata
--    e' peggio di una dichiarata incerta: la si legge come vera.
--
-- ---------------------------------------------------------------------
-- 2. L'URGENZA LA DICE LA DATA, NON UN CAMPO
-- ---------------------------------------------------------------------
-- I tre livelli di priorita' erano **dichiarati a mano**, e infatti su
-- venti righe valgono `alta` per tutti gli adempimenti societari e
-- `media` per tutto il resto: non distinguono niente. L'urgenza vera e'
-- **quanto manca alla scadenza**, e quella il database ce l'ha gia'.
--
-- Resta **una stella** per «questo per me conta», che e' un'altra cosa e
-- non si puo' calcolare.
--
-- ⚠️ La colonna `priority` **non viene cancellata**: e' `not null` e la
--    scrivono ancora dei moduli. Smette di comparire nelle schermate;
--    toglierla e' un lavoro a se', da fare quando nessuno la scrive piu'.
--
-- ---------------------------------------------------------------------
-- 3. LE CORSIE, E PERCHE' LE CALCOLA IL DATABASE
-- ---------------------------------------------------------------------
-- In ritardo · questa settimana · piu' avanti · quando capita. La corsia
-- la decide `agenda_corsie()`, non la schermata: **il badge del modulo e
-- la lista devono contare la stessa cosa**, e due conteggi diversi sullo
-- stesso schermo sono la lezione dei rincari (schermo e Telegram che
-- dicevano due numeri).
--
-- ⚠️ **Le date sono LOCALI.** «Oggi» calcolato in UTC, fra mezzanotte e
--    le due, e' ieri: un impegno di stasera risulterebbe scaduto mentre
--    il locale e' ancora aperto. Trappola gia' costata 14 punti
--    nell'audit dell'08/08.
--
-- ⚠️ **«Quando capita» non deve diventare un cimitero**: ogni riga porta
--    da quanti giorni e' li' (`giorni_in_lista`), e quella corsia **non
--    entra mai nel badge**. Un badge fermo su venti smette di essere
--    un'informazione e si impara a ignorarlo — come il triangolo degli
--    avvisi prima che i rincari avessero un titolo loro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La stella e la ricorrenza
-- ---------------------------------------------------------------------
alter table tasks add column if not exists preferito boolean not null default false;
alter table tasks add column if not exists ricorrenza text;

alter table tasks drop constraint if exists ricorrenza_valida;
alter table tasks add constraint ricorrenza_valida
  check (ricorrenza is null or ricorrenza in ('mensile', 'trimestrale', 'semestrale', 'annuale'));

comment on column tasks.preferito is
  'La stella: «questo per me conta». E'' l''unica priorita'' rimasta dichiarata a mano, perche'' e'' l''unica che il database non puo'' calcolare.';
comment on column tasks.ricorrenza is
  'Se valorizzata, chiudendo l''impegno ne nasce il successivo. Senza, un adempimento annuale sparisce chiuso e riappare come dimenticanza l''anno dopo.';

-- ---------------------------------------------------------------------
-- 2. Le categorie: una regola sola, applicata da un trigger
-- ---------------------------------------------------------------------
create or replace function categoria_task(p_testo text)
returns text
language sql
immutable
as $funzione$
  select case
    when p_testo is null or btrim(p_testo) = '' then 'altro'
    when lower(p_testo) in ('fisco_scadenze', 'documenti', 'fornitori_pagamenti',
                            'personale', 'haccp_locale', 'altro') then lower(p_testo)
    -- Le quattro convenzioni trovate in produzione, piu' quelle scritte
    -- dai moduli. Ognuna e' una riga dichiarata, non un indovinello.
    when lower(p_testo) like 'adempimenti%'   then 'fisco_scadenze'
    when lower(p_testo) like 'fiscal%'        then 'fisco_scadenze'
    when lower(p_testo) like 'document%'      then 'documenti'
    when lower(p_testo) like 'personal%'      then 'personale'
    when lower(p_testo) like 'haccp%'         then 'haccp_locale'
    when lower(p_testo) like 'fornitor%'      then 'fornitori_pagamenti'
    -- ⚠️ «amministrativo» non si traduce da solo: sotto quella parola in
    --    produzione ci sono pagamenti di fatture E date di locazione. Chi
    --    non si sa dove mettere va in «altro», non nella casella piu'
    --    probabile: una classificazione plausibile e sbagliata si legge
    --    come vera.
    else 'altro'
  end;
$funzione$;

revoke all on function categoria_task(text) from public, anon, authenticated;

create or replace function normalizza_categoria_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  new.category := categoria_task(new.category);
  return new;
end;
$funzione$;

revoke all on function normalizza_categoria_task() from public, anon, authenticated;

drop trigger if exists trg_categoria_task on tasks;
create trigger trg_categoria_task
  before insert or update of category on tasks
  for each row execute function normalizza_categoria_task();

-- Le righe di oggi, tradotte una volta sola. Il pagamento di una fattura
-- e' l'unico caso di «amministrativo» che si puo' collocare senza
-- indovinare: lo dice il titolo, non la categoria.
update tasks
   set category = case
     when lower(coalesce(category, '')) = 'amministrativo'
      and (lower(title) like '%fattura%' or lower(title) like '%pagamento%')
       then 'fornitori_pagamenti'
     else categoria_task(category)
   end;

alter table tasks drop constraint if exists categoria_chiusa;
alter table tasks add constraint categoria_chiusa
  check (category in ('fisco_scadenze', 'documenti', 'fornitori_pagamenti',
                      'personale', 'haccp_locale', 'altro'));

-- ---------------------------------------------------------------------
-- 3. Le corsie — una regola sola per la lista e per il badge
-- ---------------------------------------------------------------------
create or replace function agenda_corsie()
returns table (
  id              uuid,
  title           text,
  description     text,
  due_date        date,
  due_time        time,
  category        text,
  origine_modulo  text,
  preferito       boolean,
  ricorrenza      text,
  status          text,
  visibile_staff  boolean,
  corsia          text,
  giorni_in_lista integer,
  giorni_alla_scadenza integer
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select t.id, t.title, t.description, t.due_date, t.due_time,
         t.category, t.origine_modulo, t.preferito, t.ricorrenza,
         t.status::text, t.visibile_staff,
         case
           when t.due_date is null              then 'quando_capita'
           when t.due_date < v_oggi             then 'in_ritardo'
           -- «Questa settimana» vuol dire da oggi a sette giorni, non
           -- fino a domenica: il lunedi' l'orizzonte non deve accorciarsi
           -- a un giorno solo.
           when t.due_date <= v_oggi + 7        then 'questa_settimana'
           else 'piu_avanti'
         end,
         (v_oggi - t.created_at::date)::integer,
         case when t.due_date is not null then (t.due_date - v_oggi)::integer end
    from tasks t
   where t.status <> 'completato'
     -- La RLS su `tasks` distingue gia' cosa vede lo staff; qui si gira
     -- come proprietario, quindi il filtro va rimesso a mano.
     and (is_titolare() or t.visibile_staff)
   order by
     case
       when t.due_date is null then 3
       when t.due_date < v_oggi then 0
       when t.due_date <= v_oggi + 7 then 1
       else 2
     end,
     t.preferito desc,
     t.due_date asc nulls last,
     t.due_time asc nulls last,
     t.created_at asc;
end;
$funzione$;

comment on function agenda_corsie() is
  'Gli impegni aperti con la loro corsia, calcolata sulla data LOCALE. Una regola sola: il badge del modulo e la lista contano la stessa cosa.';

revoke all on function agenda_corsie() from public, anon;
grant execute on function agenda_corsie() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Chiudere un impegno che torna
-- ---------------------------------------------------------------------
-- Due scritture sulla stessa tabella che devono riuscire o fallire
-- insieme: se la chiusura passa e la rigenerazione no, un adempimento
-- annuale sparisce e riappare l'anno dopo come una dimenticanza.
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
                       category, origine_modulo, visibile_staff, preferito, ricorrenza)
    values (v_t.title, v_t.description, v_data, v_t.due_time, v_t.priority, 'da_fare',
            v_t.category, v_t.origine_modulo, v_t.visibile_staff, v_t.preferito, v_t.ricorrenza)
    returning id into v_nuovo;
  end if;

  return v_nuovo;
end;
$funzione$;

revoke all on function completa_task(uuid) from public, anon;
grant execute on function completa_task(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_oggi     date := (now() at time zone 'Europe/Rome')::date;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_r uuid; v_next uuid;
  v_row record;
  n integer;
  respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per questa verifica.';
  end if;

  -- 1. Nessuna categoria fuori dall'elenco e' sopravvissuta.
  select count(*) into n from tasks
   where category not in ('fisco_scadenze','documenti','fornitori_pagamenti',
                          'personale','haccp_locale','altro');
  if n <> 0 then raise exception '% impegni hanno ancora una categoria libera.', n; end if;

  -- 2. Il trigger chiude la porta a una quinta convenzione.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  insert into tasks (title, priority, status, category, due_date, visibile_staff)
  values ('PROVA AG ritardo', 'media', 'da_fare', 'Adempimenti societari', v_oggi - 3, false)
  returning id into v_a;
  if (select category from tasks where id = v_a) <> 'fisco_scadenze' then
    raise exception 'Il trigger non ha tradotto una convenzione vecchia.';
  end if;

  insert into tasks (title, priority, status, category, due_date, visibile_staff)
  values ('PROVA AG oggi', 'media', 'da_fare', 'roba mai vista', v_oggi, false)
  returning id into v_b;
  if (select category from tasks where id = v_b) <> 'altro' then
    raise exception 'Una categoria sconosciuta non e'' finita in «altro».';
  end if;

  insert into tasks (title, priority, status, due_date, visibile_staff)
  values ('PROVA AG fra un mese', 'media', 'da_fare', v_oggi + 30, false) returning id into v_c;
  insert into tasks (title, priority, status, visibile_staff)
  values ('PROVA AG senza data', 'media', 'da_fare', false) returning id into v_d;
  update tasks set created_at = now() - interval '90 days' where id = v_d;

  -- 3. Le quattro corsie, coi casi veri.
  select * into v_row from agenda_corsie() where id = v_a;
  if v_row.corsia <> 'in_ritardo' then raise exception 'Un impegno scaduto non e'' in ritardo.'; end if;
  select * into v_row from agenda_corsie() where id = v_b;
  if v_row.corsia <> 'questa_settimana' then raise exception 'Un impegno di oggi non e'' in questa settimana.'; end if;
  select * into v_row from agenda_corsie() where id = v_c;
  if v_row.corsia <> 'piu_avanti' then raise exception 'Un impegno fra un mese non e'' piu'' avanti.'; end if;

  select * into v_row from agenda_corsie() where id = v_d;
  if v_row.corsia <> 'quando_capita' then
    raise exception 'Un impegno senza data non e'' in «quando capita».';
  end if;
  -- ⚠️ L'anzianita' e' cio' che impedisce a quella corsia di diventare un
  --    cimitero: senza, una voce ferma da tre mesi sembra scritta ieri.
  if v_row.giorni_in_lista < 89 then
    raise exception 'L''anzianita'' di una voce senza data non torna: % giorni.', v_row.giorni_in_lista;
  end if;

  -- 4. NESSUN impegno senza scadenza resta fuori da «quando capita».
  --    ⚠️ Si verifica la REGOLA, non il numero: in produzione quelle
  --    righe sono cinque, sul progetto di prova sono altre. Una verifica
  --    tarata sui dati di un solo database passa dove non deve — e' la
  --    lezione del 12/08, quando una migrazione provata su uno stato di
  --    partenza diverso da quello vero ruppe la produzione.
  select count(*) into n
    from tasks t
   where t.status <> 'completato'
     and t.due_date is null
     and not exists (
       select 1 from agenda_corsie() c where c.id = t.id and c.corsia = 'quando_capita'
     );
  if n <> 0 then
    raise exception '% impegni senza scadenza sono rimasti fuori da «quando capita».', n;
  end if;

  -- 5. Il badge conta ritardo + oggi, e NON «quando capita».
  select count(*) into n from agenda_corsie()
   where corsia = 'in_ritardo' or (corsia = 'questa_settimana' and giorni_alla_scadenza = 0);
  if n < 2 then raise exception 'Il badge non conta il ritardo e l''oggi (%).', n; end if;
  select count(*) into n from agenda_corsie()
   where corsia = 'quando_capita'
     and (corsia = 'in_ritardo' or giorni_alla_scadenza = 0);
  if n <> 0 then raise exception '«Quando capita» e'' finito nel badge.'; end if;

  -- 6. La stella non e' un livello di priorita': ordina, non classifica.
  update tasks set preferito = true where id = v_c;
  if not (select preferito from agenda_corsie() where id = v_c) then
    raise exception 'La stella non arriva in lista.';
  end if;

  -- 7. Una ricorrenza chiusa genera la successiva, alla SUA data.
  insert into tasks (title, priority, status, due_date, ricorrenza, category)
  values ('PROVA AG ricorrente', 'media', 'da_fare', v_oggi - 10, 'annuale', 'fisco_scadenze')
  returning id into v_r;
  v_next := completa_task(v_r);
  if v_next is null then raise exception 'Chiudendo un impegno ricorrente non ne e'' nato un altro.'; end if;
  if (select due_date from tasks where id = v_next) <> (v_oggi - 10 + interval '1 year')::date then
    raise exception 'Il ricorrente e'' tornato alla data sbagliata: %.',
      (select due_date from tasks where id = v_next);
  end if;
  if (select status from tasks where id = v_r)::text <> 'completato' then
    raise exception 'Il ricorrente chiuso non risulta completato.';
  end if;

  -- 8. Chiuderlo due volte non ne genera un terzo.
  respinto := false;
  begin perform completa_task(v_r);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Un impegno gia'' fatto si e'' lasciato chiudere due volte.'; end if;

  -- 9. Un impegno chiuso esce dalle corsie.
  select count(*) into n from agenda_corsie() where id = v_r;
  if n <> 0 then raise exception 'Un impegno completato compare ancora in lista.'; end if;

  -- 10. Lo staff non vede gli impegni del titolare (§3.18: era una fuga
  --     di dati attiva, e non deve tornare da questa porta).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  select count(*) into n from agenda_corsie() where id in (v_a, v_b, v_c, v_d);
  if n <> 0 then
    raise exception 'Lo staff vede % impegni riservati al titolare.', n;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- 11. L'elenco di chi bussa da fuori non e' cresciuto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  select count(*) into n from funzioni_aperte_ad_anon();
  if n <> 12 then raise exception 'L''elenco anonimi e'' passato a %.', n; end if;
  perform set_config('request.jwt.claims', null, true);

  -- ---- Pulizia (§5 punto 8) ----------------------------------------
  delete from tasks where title like 'PROVA AG%';
  select count(*) into n from tasks where title like 'PROVA AG%';
  if n <> 0 then raise exception 'La prova ha lasciato % impegni.', n; end if;

  raise notice 'Agenda a corsie: categorie chiuse senza rompere nessun modulo, l''urgenza dalla data, e «quando capita» dichiara la sua eta''.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260814000005', 'agenda_a_corsie')
on conflict (version) do nothing;

select category, count(*) from tasks group by category order by 1;
