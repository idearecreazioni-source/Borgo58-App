-- =====================================================================
-- UN PROMEMORIA ASPETTA CHE ARRIVO A CASA — 28/10/2026, chiesto da Alessio:
--   «esiste un modo per legare un task ad una posizione? del tipo
--   "ricordami di fare questo quando arrivo a casa"».
-- =====================================================================
--
-- 🔴 NON E' UNA TABELLA NUOVA: E' UNA COLONNA DELL'IMPEGNO, `tasks.luogo`.
--    Un promemoria per luogo si spunta, si rimanda e si ripete come ogni
--    altro impegno; cambia solo QUANDO viene ricordato. Lo ricorda il
--    telefono, con un'automazione dell'app Comandi che all'arrivo chiede
--    al gestionale cosa c'e' per quel posto (`luogo_promemoria`, nella
--    20261028000003).
--
-- ⚠️ I LUOGHI SONO UN ELENCO CHIUSO, deciso da Alessio: Casa e Ristorante.
--    Il vincolo `luogo_chiuso` li ammette; `constants.js` (TASK_LUOGHI) li
--    scrive in italiano. Aggiungerne uno e' questa stessa riga, piu' una.
--    `null` vuol dire «nessun luogo», ed e' il caso di quasi tutti.
--
-- ⚠️ Cosa cambia, e solo questo:
--    1. la colonna `luogo` e il suo vincolo, con un indice per la lettura
--       che fa il telefono (solo gli aperti con un luogo);
--    2. `agenda_corsie()` restituisce anche il luogo, in fondo: la
--       schermata ci mette l'etichetta. Il tipo restituito cambia, quindi
--       la funzione si toglie e si ricrea (come nella 20260910000001);
--    3. `completa_task` porta il luogo sull'impegno successivo di un
--       ricorrente: altrimenti «ogni settimana, a casa: cambiare la
--       lettiera» perderebbe la casa al secondo giro, senza nessun errore.
--    Nessuna riga esistente cambia: nessun impegno ha oggi un luogo.
--
-- ⚠️ I due corpi sono presi dal DATABASE VIVO il 28/10/2026 (produzione e
--    progetto di prova identici, ultima migrazione 20261027000002), non
--    dai file che li hanno creati. Permessi ripresi da `proacl`: tutt'e due
--    eseguibili da `authenticated`, da nessun altro.

-- ---------------------------------------------------------------------
-- 1. La colonna, il vincolo, l'indice
-- ---------------------------------------------------------------------
alter table tasks add column if not exists luogo text;

alter table tasks drop constraint if exists luogo_chiuso;
alter table tasks add constraint luogo_chiuso
  check (luogo is null or luogo in ('casa', 'ristorante'));

comment on constraint luogo_chiuso on tasks is
  'Un promemoria per luogo e'' legato a uno dei posti che Alessio ha scelto: casa o ristorante. Vuoto vuol dire nessun luogo.';
comment on column tasks.luogo is
  'Dove va ricordato questo impegno: all''arrivo in quel posto il telefono lo chiede al gestionale (luogo_promemoria) e lo mostra in una notifica, finche'' non si spunta.';

create index if not exists idx_tasks_luogo_aperti on tasks (luogo)
  where luogo is not null and status <> 'completato';

-- ---------------------------------------------------------------------
-- 2. L'Agenda restituisce il luogo
-- ---------------------------------------------------------------------
drop function if exists public.agenda_corsie();

CREATE OR REPLACE FUNCTION public.agenda_corsie()
 RETURNS TABLE(id uuid, title text, description text, due_date date, due_time time without time zone, category text, origine_modulo text, preferito boolean, ricorrenza_ogni smallint, ricorrenza_unita text, status text, visibile_staff boolean, corsia text, giorni_in_lista integer, giorni_alla_scadenza integer, luogo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_oggi date := oggi_a_roma();
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select t.id, t.title, t.description, t.due_date, t.due_time,
         t.category, t.origine_modulo, t.preferito,
         t.ricorrenza_ogni, t.ricorrenza_unita,
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
         -- ⚠️ Le due date del sottrarre devono stare nello STESSO fuso: con
         -- `v_oggi` di Roma e `created_at` di Greenwich, un impegno scritto
         -- dopo mezzanotte nasceva gia' vecchio di un giorno. In «quando
         -- capita» l'anzianita' e' l'unica cosa che si guarda.
         (v_oggi - (t.created_at at time zone 'Europe/Rome')::date)::integer,
         case when t.due_date is not null then (t.due_date - v_oggi)::integer end,
         -- 28/10/2026: il luogo del promemoria, per l'etichetta in Agenda.
         t.luogo
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
$function$;

revoke all on function public.agenda_corsie() from public, anon, authenticated;
grant execute on function public.agenda_corsie() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Il successivo di un ricorrente tiene il luogo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.completa_task(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_t      tasks%rowtype;
  v_nuovo  uuid;
  v_data   date;
  v_avviso timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_t from tasks where id = p_id for update;
  if v_t.id is null then raise exception 'Task non trovato'; end if;
  if not (is_titolare() or v_t.visibile_staff) then
    raise exception 'Questo task non e'' tuo';
  end if;
  if v_t.status = 'completato' then
    raise exception 'Questo task risulta gia'' fatto';
  end if;

  update tasks set status = 'completato' where id = p_id;

  if v_t.ricorrenza_ogni is not null then
    -- Si conta dalla scadenza, non da oggi: un adempimento annuale
    -- chiuso in ritardo deve tornare alla SUA data, non spostarsi in
    -- avanti di quanto si e'' tardato.
    v_data := coalesce(v_t.due_date, (now() at time zone 'Europe/Rome')::date);
    v_data := (v_data + case v_t.ricorrenza_unita
                          when 'giorni'    then v_t.ricorrenza_ogni * interval '1 day'
                          when 'settimane' then v_t.ricorrenza_ogni * interval '1 week'
                          when 'mesi'      then v_t.ricorrenza_ogni * interval '1 month'
                          when 'anni'      then v_t.ricorrenza_ogni * interval '1 year'
                          else null
                        end)::date;
    if v_data is null then
      raise exception 'Non so ogni quanto si ripete questo task: l''unita'' «%» non la conosco.',
        coalesce(v_t.ricorrenza_unita, 'vuota');
    end if;

    -- 🔴 L'AVVISO VIAGGIA COL TASK, alla stessa distanza dalla scadenza.
    --    `reminder_sent_at` invece NON si copia: il task nuovo non ha
    --    ancora avvisato nessuno, e portarselo dietro lo farebbe nascere
    --    «gia' avvisato» — cioe' muto per sempre.
    v_avviso := avviso_del_successivo(v_t.remind_at, v_t.due_date, v_data, v_t.due_time);

    insert into tasks (title, description, due_date, due_time, priority, status,
                       category, origine_modulo, visibile_staff, preferito,
                       ricorrenza_ogni, ricorrenza_unita, generato_da,
                       remind_at, sollecito_ogni, sollecito_unita, luogo)
    values (v_t.title, v_t.description, v_data, v_t.due_time, v_t.priority, 'da_fare',
            v_t.category, v_t.origine_modulo, v_t.visibile_staff, v_t.preferito,
            v_t.ricorrenza_ogni, v_t.ricorrenza_unita, p_id,
            v_avviso,
            case when v_avviso is null then null else v_t.sollecito_ogni end,
            case when v_avviso is null then null else v_t.sollecito_unita end,
            -- 28/10/2026: un promemoria per luogo che si ripete resta di quel luogo.
            v_t.luogo)
    returning id into v_nuovo;
  end if;

  return v_nuovo;
end;
$function$;

revoke all on function public.completa_task(uuid) from public, anon, authenticated;
grant execute on function public.completa_task(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_id       uuid;
  v_nuovo    uuid;
  v_luogo    text;
  v_rifiuto  boolean := false;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Un promemoria per casa si scrive e l'Agenda lo restituisce col
    --     suo luogo.
    insert into tasks (title, priority, status, category, visibile_staff, luogo,
                       ricorrenza_ogni, ricorrenza_unita)
    values ('PROVA LUOGO', 'media', 'da_fare', 'altro', true, 'casa', 1, 'settimane')
    returning id into v_id;
    select luogo into v_luogo from agenda_corsie() where id = v_id;
    if v_luogo is distinct from 'casa' then
      raise exception 'VERIFICA (1): l''Agenda restituisce il luogo «%».', v_luogo;
    end if;

    -- (2) Chiuso, il successivo del ricorrente e' ancora di casa.
    v_nuovo := completa_task(v_id);
    select luogo into v_luogo from tasks where id = v_nuovo;
    if v_nuovo is null or v_luogo is distinct from 'casa' then
      raise exception 'VERIFICA (2): il successivo ha il luogo «%».', v_luogo;
    end if;

    -- (3) Un luogo fuori elenco si rifiuta (verso del rifiuto).
    begin
      update tasks set luogo = 'garage' where id = v_nuovo;
    exception when check_violation then
      v_rifiuto := true;
    end;
    if not v_rifiuto then
      raise exception 'VERIFICA (3): il luogo «garage» e'' stato accettato.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del luogo dei promemoria');

  raise notice 'Fatto: un impegno puo'' avere un luogo (casa o ristorante), l''Agenda lo restituisce e il successivo di un ricorrente lo tiene; un luogo fuori elenco si rifiuta. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261028000001', 'un_promemoria_aspetta_che_arrivo_a_casa')
on conflict (version) do nothing;
