-- =====================================================================
-- Borgo 58 · Il sollecito, finché non lo chiudi
-- =====================================================================
-- 20/09/2026.
--
-- 🔴 COSA MANCAVA. Un avviso dell'Agenda parte UNA VOLTA SOLA: passata
--    quella, il task resta lì e non lo ricorda più niente. Chi vuole essere
--    ripreso — «ricordamelo ogni giorno finché non l'ho fatto» — oggi non
--    ha nessuna casella.
--
-- ---------------------------------------------------------------------
-- LE REGOLE, E OGNUNA HA UN PERCHE'
-- ---------------------------------------------------------------------
-- ⚠️ E' SPENTO, E RESTA SPENTO SU TUTTO CIO' CHE ESISTE GIA'. Le due
--    colonne nascono VUOTE e senza predefinito: un predefinito qui non
--    sarebbe una comodità, sarebbe **il gestionale che decide di mandare
--    messaggi che nessuno ha chiesto** — su 78 task già scritti.
--
-- 🔴 SI PUO' SOLLECITARE SOLO CIO' CHE HA UN AVVISO, ed è un vincolo del
--    database e non un controllo della schermata: il sollecito si conta
--    **a partire dall'avviso**, quindi senza avviso non ha un punto da cui
--    contare. Un sollecito senza avviso non sarebbe «un po' meno utile»:
--    sarebbe una cadenza che parte da un istante che non esiste.
--
-- ⚠️ IL PRIMO AVVISO RESTA QUELLO NORMALE. Il sollecito non anticipa e non
--    sostituisce niente: comincia dopo, al passo scelto.
--
-- ⚠️ SI FERMA DA SE' QUANDO IL TASK SI CHIUDE O SPARISCE, e non perché
--    qualcuno se ne ricordi: il giro guarda `status <> 'completato'`, e un
--    task cancellato non c'è più. Non esiste nessuna coda da ripulire.
--
-- ⚠️ STESSE UNITA' DELLA RICORRENZA — giorni, settimane, mesi, anni — e
--    stessa forma «ogni N unità». Un secondo modello (ore? minuti?) sarebbe
--    un secondo vocabolario da tenere d'accordo, e in questo progetto i
--    vocabolari doppi hanno già morso tre volte. ⚠️ Il prezzo, dichiarato:
--    un sollecito a ore non si può chiedere. È una rinuncia, non una
--    dimenticanza — e un avviso ogni ora somiglia più a un martello che a
--    un promemoria.
--
-- 🔴 OGNI SOLLECITO E' UNA CONSEGNA A SE', ed è ciò che impedisce i
--    doppioni. La chiave di consegna è `(task, istante dell'occorrenza)`:
--    due giri sovrapposti che guardano lo stesso sollecito compongono la
--    STESSA chiave, e l'indice unico ne lascia passare uno solo. Con una
--    chiave per task, invece, il secondo sollecito sarebbe stato scambiato
--    per un doppione del primo e non sarebbe mai partito.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. LE GUARDIE — questa migrazione si rifiuta invece di indovinare
-- ---------------------------------------------------------------------
do $guardia$
declare
  v_send text;
  v_comp text;
begin
  select pg_get_functiondef(p.oid) into v_send from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'send_due_task_reminders' and p.prokind = 'f';
  select pg_get_functiondef(p.oid) into v_comp from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'completa_task' and p.prokind = 'f';

  if v_send is null or v_comp is null then
    raise exception 'GUARDIA: send_due_task_reminders o completa_task non esistono qui.';
  end if;
  if position('timeout_milliseconds := 30000' in v_send) = 0 then
    raise exception 'GUARDIA: il giro che manda non è quello del 20260920000002 (l''attesa di 30 secondi). Leggi il corpo vivo prima di applicare.';
  end if;
  if position('avviso_del_successivo' in v_comp) = 0 then
    raise exception 'GUARDIA: completa_task non è quella del 20260920000003 (l''avviso che viaggia). Leggi il corpo vivo prima di applicare.';
  end if;
  if position('sollecito_ogni' in v_send) > 0 then
    raise exception 'GUARDIA: il giro conosce già i solleciti: questa migrazione è già stata applicata, o superata da un''altra.';
  end if;
end $guardia$;

-- ---------------------------------------------------------------------
-- 1. LE DUE COLONNE — vuote, e vuote restano
-- ---------------------------------------------------------------------
alter table tasks add column if not exists sollecito_ogni smallint;
alter table tasks add column if not exists sollecito_unita text;

comment on column tasks.sollecito_ogni is
  'Ogni quanto ripetere l''avviso finché il task resta aperto. Vuoto = nessun sollecito, ed è lo stato di tutti i task che esistevano prima.';
comment on column tasks.sollecito_unita is
  'L''unità del sollecito: le stesse quattro della ricorrenza. Vuota insieme a sollecito_ogni.';

alter table tasks drop constraint if exists sollecito_intero;
alter table tasks add constraint sollecito_intero
  check ((sollecito_ogni is null) = (sollecito_unita is null));
comment on constraint sollecito_intero on tasks is
  'Un sollecito è «ogni N unità»: o ci sono tutti e due i pezzi, o non c''è il sollecito. Mezzo sollecito sarebbe una cadenza che nessuno sa calcolare.';

alter table tasks drop constraint if exists sollecito_ogni_sensato;
alter table tasks add constraint sollecito_ogni_sensato
  check (sollecito_ogni is null or (sollecito_ogni between 1 and 999));
comment on constraint sollecito_ogni_sensato on tasks is
  'Si sollecita da 1 a 999 unità: «ogni 0» sarebbe una cadenza che non passa mai, e un numero enorme è un errore di digitazione.';

alter table tasks drop constraint if exists sollecito_unita_valida;
alter table tasks add constraint sollecito_unita_valida
  check (sollecito_unita is null or sollecito_unita in ('giorni', 'settimane', 'mesi', 'anni'));
comment on constraint sollecito_unita_valida on tasks is
  'Le unità del sollecito sono le stesse quattro della ricorrenza: giorni, settimane, mesi, anni. Un secondo vocabolario sarebbe un secondo posto da tenere d''accordo.';

-- 🔴 IL VINCOLO CHE TIENE IN PIEDI TUTTO IL RESTO: senza avviso non c'è un
--    istante da cui contare, quindi il sollecito non si può nemmeno scrivere.
alter table tasks drop constraint if exists sollecito_vuole_un_avviso;
alter table tasks add constraint sollecito_vuole_un_avviso
  check (sollecito_ogni is null or remind_at is not null);
comment on constraint sollecito_vuole_un_avviso on tasks is
  'Si sollecita solo ciò che ha un promemoria: il sollecito si conta a partire da quello, e senza non avrebbe un punto da cui partire.';

-- ---------------------------------------------------------------------
-- 2. QUANDO CADE IL SOLLECITO DOVUTO ADESSO
-- ---------------------------------------------------------------------
-- 🔴 STA IN UNA FUNZIONE SUA PER POTERLA PROVARE su istanti inventati,
--    senza aspettare giorni e senza far partire niente.
-- ⚠️ RESTITUISCE L'ULTIMA OCCORRENZA DOVUTA, non la prima: se il gestionale
--    è stato fermo tre giorni, chi riapre non deve ricevere tre messaggi in
--    fila — ne riceve uno, quello di adesso. *Un recupero a raffica si
--    impara a ignorare come un allarme che grida sempre.*
-- ⚠️ E CONTA PER SALTI VERI, non dividendo: un mese non è un numero fisso di
--    giorni, e «ogni 1 mese» dal 31 gennaio deve cadere dove cade il mese.
create or replace function istante_sollecito(
  p_avviso timestamptz,
  p_ogni smallint,
  p_unita text,
  p_adesso timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $funzione$
declare
  v_passo interval;
  v_qui   timestamptz;
  v_prec  timestamptz;
  i       integer := 0;
begin
  if p_avviso is null or p_ogni is null or p_unita is null or p_adesso is null then
    return null;
  end if;

  v_passo := case p_unita
               when 'giorni'    then p_ogni * interval '1 day'
               when 'settimane' then p_ogni * interval '1 week'
               when 'mesi'      then p_ogni * interval '1 month'
               when 'anni'      then p_ogni * interval '1 year'
               else null
             end;
  if v_passo is null then
    return null;
  end if;

  v_qui := p_avviso;
  loop
    i := i + 1;
    -- ⚠️ UN TETTO AI GIRI, e non è prudenza generica: senza, una cadenza
    --    minuscola su un task aperto da un anno terrebbe il database in un
    --    ciclo lunghissimo a ogni passata dei cinque minuti.
    if i > 2000 then
      return v_prec;
    end if;
    v_prec := v_qui;
    v_qui := v_qui + v_passo;
    if v_qui > p_adesso then
      -- La prima occorrenza è DOPO l'avviso: se non se n'è compiuta
      -- nemmeno una, non c'è niente da sollecitare.
      return case when v_prec = p_avviso then null else v_prec end;
    end if;
  end loop;
end
$funzione$;

comment on function istante_sollecito(timestamptz, smallint, text, timestamptz) is
  'L''ultima occorrenza del sollecito già dovuta a un certo istante, oppure vuoto se non se n''è compiuta ancora nessuna. Decide e basta: non manda niente, così si può provare su istanti inventati.';

revoke all on function istante_sollecito(timestamptz, smallint, text, timestamptz) from public, anon, authenticated;
grant execute on function istante_sollecito(timestamptz, smallint, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 3. IL GIRO CHE MANDA — dal corpo del 20260920000002, con i solleciti
-- ---------------------------------------------------------------------
-- ⚠️ CAMBIA UNA COSA SOLA: da dove escono le coppie «task + istante». Prima
--    era una query sola sul primo avviso; adesso ogni task ne può produrre
--    due, e da lì in giù il corpo è identico riga per riga.
create or replace function send_due_task_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  r        record;
  v_firma  text;
  v_anon   text;
  v_base   text;
  v_req    bigint;
  v_tent   integer;
  v_chiave text;
  v_riga   uuid;
  v_fermi  integer;
begin
  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';

  -- Se non si può notificare, NON si marca niente come inviato — altrimenti
  -- sparirebbe senza essere mai arrivato. E non si segna il giro come
  -- riuscito: questo è un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Promemoria Telegram saltati: parola d''ordine o chiave assenti dal Vault.';
    perform segnala_allarme(
      'notifiche_senza_chiavi',
      'I promemoria non partono: manca la parola d''ordine nel Vault del database.'
    );
    return;
  end if;

  -- 🔴 L'INDIRIZZO È QUELLO DI QUESTO DATABASE, e se manca ci si ferma qui.
  v_base := url_delle_funzioni();

  for r in
    select t.*, a.quando, chiave_di_consegna(t.id, a.quando) as chiave_consegna
      from tasks t
      join lateral (
        -- 1. IL PRIMO AVVISO, quello di sempre: finché non è partito.
        select t.remind_at as quando
         where t.remind_at is not null
           and t.remind_at <= now()
           and t.reminder_sent_at is null
        union all
        -- 2. IL SOLLECITO, e solo DOPO che il primo avviso è partito: il
        --    primo resta quello normale, il sollecito non lo anticipa.
        select istante_sollecito(t.remind_at, t.sollecito_ogni, t.sollecito_unita, now())
         where t.sollecito_ogni is not null
           and t.reminder_sent_at is not null
      ) a on a.quando is not null and a.quando <= now()
     -- ⚠️ CHIUSO VUOL DIRE ZITTO, e vale per tutt'e due i rami: è qui che il
     --    sollecito si ferma quando il task viene fatto. Un task cancellato
     --    non compare perché non c'è più.
     where t.status <> 'completato'
       -- Uno alla volta per consegna: finché una richiesta è in volo non se
       -- ne accoda un'altra per lo stesso avviso.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, a.quando) and i.esito = 'in_volo')
       -- 🔴 UNA CONSEGNA GIA' RIUSCITA NON SI RIPETE. Per il primo avviso lo
       --    diceva già `reminder_sent_at`; per un sollecito serve questa
       --    riga, o la stessa occorrenza ripartirebbe a ogni giro dei cinque
       --    minuti finché non arriva quella dopo.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, a.quando) and i.esito = 'riuscito')
       -- 🔴 DA «NON LO SAPRÒ MAI» NON SI RIPROVA. Riprovare potrebbe mandare
       --    un secondo Telegram, e questo giro non lo fa mai. La riga resta
       --    con reminder_sent_at vuoto, visibile e allarmata.
       and not exists (
         select 1 from invii_promemoria i
          where i.chiave = chiave_di_consegna(t.id, a.quando) and i.esito = 'esito_ignoto')
       -- ⚠️ UN TETTO AI TENTATIVI, ed è la lezione del 12/08: un lavoro che
       --    ritenta all'infinito chiede all'infinito. Il conto è PER
       --    CONSEGNA, non per task: un avviso spostato riparte da capo,
       --    ed è giusto — è un'altra consegna.
       and (select count(*) from invii_promemoria i
             where i.chiave = chiave_di_consegna(t.id, a.quando)) < 3
  loop
    -- ⚠️ OGNI AVVISO IN UN BLOCCO SUO: senza, un solo inciampo — una corsa
    --    persa sull'indice, un errore di rete — annullerebbe il giro INTERO
    --    e con esso gli avvisi già presi in carico.
    begin
      v_chiave := r.chiave_consegna;
      if v_chiave is null then
        continue;
      end if;

      select coalesce(max(i.tentativo), 0) + 1 into v_tent
        from invii_promemoria i where i.chiave = v_chiave;

      -- 🔴 IL POSSESSO PRIMA DELLA RICHIESTA, ED È UNA SCRITTURA. Se un
      --    altro giro ha già preso questo avviso, qui non si scrive niente
      --    e `v_riga` resta vuota: **non si accoda**.
      insert into invii_promemoria (task_id, chiave, tentativo)
      values (r.id, v_chiave, v_tent)
      on conflict (chiave) where esito = 'in_volo' do nothing
      returning id into v_riga;

      if v_riga is null then
        continue;
      end if;

      -- 🔴 LA CHIAVE VIAGGIA CON LA RICHIESTA: è ciò che permette a chi
      --    riceve di riconoscere un ritentativo invece di mandare un
      --    secondo Telegram.
      select net.http_post(
        url := v_base || '/notify-telegram-reservation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon,
          'x-borgo58-firma', v_firma
        ),
        body := jsonb_build_object(
          'type', 'task_reminder',
          'chiave_consegna', v_chiave,
          'task', to_jsonb(r) - 'chiave_consegna' - 'quando'),
        -- Trenta secondi: il perché sta nella 20260920000002.
        timeout_milliseconds := 30000
      ) into v_req;

      update invii_promemoria set richiesta_id = v_req where id = v_riga;

      -- 🔴 QUI NON SI SCRIVE `reminder_sent_at`: la richiesta è soltanto
      --    ACCODATA. Lo scrive `raccogli_esiti_promemoria`, e solo davanti a
      --    una risposta.
    exception when others then
      raise warning 'Promemoria %: % ', r.id, sqlerrm;
    end;
  end loop;

  -- ⚠️ CHI NON PUÒ PIÙ PARTIRE NON SPARISCE E NON TACE: né chi ha esaurito
  --    i tentativi, né chi è finito in «non lo saprò mai».
  select count(*) into v_fermi
    from tasks t
   where t.remind_at is not null
     and t.remind_at <= now()
     and t.reminder_sent_at is null
     and t.status <> 'completato'
     and (
       exists (select 1 from invii_promemoria i
                where i.chiave = chiave_di_consegna(t.id, t.remind_at)
                  and i.esito = 'esito_ignoto')
       or (select count(*) from invii_promemoria i
            where i.chiave = chiave_di_consegna(t.id, t.remind_at)) >= 3
     );

  if v_fermi > 0 then
    perform segnala_allarme(
      'promemoria_senza_recapito',
      'Ci sono ' || v_fermi || ' avvisi dell''Agenda che non riescono a partire. Non sono stati persi: restano scritti, e il perché è nel registro degli invii. Alcuni potrebbero essere arrivati senza che si sia potuto confermarlo — in quel caso non vengono rimandati, per non mandarli due volte.',
      jsonb_build_object('quanti', v_fermi));
  end if;

  -- Il giro è arrivato in fondo: è questa riga che permette di accorgersi,
  -- fra mezz'ora, che il giro NON è più arrivato in fondo.
  insert into stato_lavori (nome, ultimo_successo) values ('promemoria_agenda', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
end;
$function$;

revoke all on function send_due_task_reminders() from public, anon, authenticated;

-- rete-guardie: send_due_task_reminders — la query del primo avviso non sta piu' nella clausola principale: le stesse condizioni (avviso non partito, non in volo, non ignoto, tetto dei tentativi) vivono adesso nel ramo laterale e nel where, accanto a quelle del sollecito. Niente si perde, e si aggiunge il rifiuto di una consegna gia' riuscita.

-- ---------------------------------------------------------------------
-- 4. LA RICORRENZA EREDITA ANCHE IL SOLLECITO
-- ---------------------------------------------------------------------
-- ⚠️ MA SOLO SE L'AVVISO C'E'. Un task ricorrente senza scadenza fa nascere
--    il successivo senza avviso (regola della 20260920000003): portargli
--    dietro il sollecito lo farebbe sbattere contro il vincolo — cioè
--    CHIUDERE UN TASK FALLIREBBE, in sala, per una casella secondaria.
create or replace function completa_task(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
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
                       remind_at, sollecito_ogni, sollecito_unita)
    values (v_t.title, v_t.description, v_data, v_t.due_time, v_t.priority, 'da_fare',
            v_t.category, v_t.origine_modulo, v_t.visibile_staff, v_t.preferito,
            v_t.ricorrenza_ogni, v_t.ricorrenza_unita, p_id,
            v_avviso,
            case when v_avviso is null then null else v_t.sollecito_ogni end,
            case when v_avviso is null then null else v_t.sollecito_unita end)
    returning id into v_nuovo;
  end if;

  return v_nuovo;
end;
$function$;

revoke all on function completa_task(uuid) from public, anon, authenticated;
grant execute on function completa_task(uuid) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_lap0   integer;
  v_lap1   integer;
  v_tit    uuid;
  v_miei   uuid[] := '{}';
  v_id     uuid;
  v_nuovo  uuid;
  v_n      integer;
  v_preso  boolean;
  v_avviso timestamptz := now() - interval '10 days';
begin
  select count(*) into v_lap0 from deleted_records;
  select ur.user_id into v_tit from user_roles ur where ur.role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: la verifica non puo'' impersonare nessuno.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- -------------------------------------------------------------------
  -- 1. SPENTO DAPPERTUTTO, COMPRESO CIO' CHE C'ERA GIA'
  -- -------------------------------------------------------------------
  -- ⚠️ E' una PROPRIETA', non un conteggio: vale su tutti e due i database
  --    e con qualunque numero di righe.
  select count(*) into v_n from tasks where sollecito_ogni is not null;
  if v_n <> 0 then
    raise exception 'VERIFICA: % task sono nati con un sollecito che nessuno ha chiesto.', v_n;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tasks'
                and column_name in ('sollecito_ogni', 'sollecito_unita')
                and column_default is not null) then
    raise exception 'VERIFICA: una colonna del sollecito ha un predefinito: risponderebbe al posto di chi non ha risposto.';
  end if;

  -- -------------------------------------------------------------------
  -- 2. SENZA AVVISO NON SI PUO' SOLLECITARE
  -- -------------------------------------------------------------------
  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff, sollecito_ogni, sollecito_unita)
    values ('VERIFICA-20SET sollecito senza avviso', 'da_fare', 'altro', true, 1, 'giorni');
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: un sollecito senza promemoria e'' stato accettato.';
  end if;

  -- E mezzo sollecito nemmeno.
  v_preso := false;
  begin
    insert into tasks (title, status, category, visibile_staff, remind_at, sollecito_ogni)
    values ('VERIFICA-20SET mezzo sollecito', 'da_fare', 'altro', true, v_avviso, 2);
  exception when check_violation then v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: un numero senza unita'' e'' stato accettato.';
  end if;

  -- -------------------------------------------------------------------
  -- 3. QUANDO CADE IL SOLLECITO — su istanti inventati, senza mandare niente
  -- -------------------------------------------------------------------
  -- Prima che ne sia passato uno: niente.
  if istante_sollecito(v_avviso, 1::smallint, 'giorni',
                       v_avviso + interval '3 hours') is not null then
    raise exception 'VERIFICA: e'' stato sollecitato qualcosa prima della prima scadenza.';
  end if;
  -- Dopo tre giorni e mezzo: l'ULTIMA dovuta, cioè il terzo giorno — non il
  -- primo, o chi riapre dopo una pausa riceverebbe la raffica arretrata.
  if istante_sollecito(v_avviso, 1::smallint, 'giorni', v_avviso + interval '3 days 12 hours')
       is distinct from v_avviso + interval '3 days' then
    raise exception 'VERIFICA: il sollecito dovuto non e'' l''ultimo compiuto.';
  end if;
  -- ⚠️ E i mesi contano per salti veri, non a trenta giorni.
  if istante_sollecito(timestamptz '2026-01-31 09:00+01', 1::smallint, 'mesi',
                       timestamptz '2026-03-05 09:00+01')
       is distinct from timestamptz '2026-03-31 09:00+02' - interval '1 month' then
    raise exception 'VERIFICA: il sollecito mensile non cade dove cade il mese.';
  end if;
  -- Un'unita' che nessuno sa calcolare non produce niente.
  if istante_sollecito(v_avviso, 1::smallint, 'lune piene', now()) is not null then
    raise exception 'VERIFICA: un''unita'' sconosciuta ha prodotto un sollecito.';
  end if;

  -- -------------------------------------------------------------------
  -- 4. LA RICORRENZA EREDITA IL SOLLECITO
  -- -------------------------------------------------------------------
  insert into tasks (title, due_date, due_time, remind_at, status, category, visibile_staff,
                     ricorrenza_ogni, ricorrenza_unita, sollecito_ogni, sollecito_unita)
  values ('VERIFICA-20SET eredita', date '2026-03-01', time '10:00',
          istante_della_scadenza(date '2026-03-01', time '10:00') - interval '1 hour',
          'da_fare', 'altro', true, 1, 'mesi', 2, 'giorni')
  returning id into v_id;
  v_miei := v_miei || v_id;

  v_nuovo := completa_task(v_id);
  v_miei := v_miei || v_nuovo;
  select count(*) into v_n from tasks t
   where t.id = v_nuovo and t.sollecito_ogni = 2 and t.sollecito_unita = 'giorni'
     and t.remind_at is not null;
  if v_n <> 1 then
    raise exception 'VERIFICA: il task rigenerato non ha ereditato il sollecito.';
  end if;

  -- -------------------------------------------------------------------
  -- 5. E IL RAMO CHE PROTEGGE LA CHIUSURA: senza avviso, niente sollecito
  -- -------------------------------------------------------------------
  -- 🔴 Senza questo ramo, chiudere un ricorrente senza scadenza fallirebbe
  --    contro il vincolo — cioè un gesto di tutti i giorni si romperebbe
  --    per una casella secondaria.
  insert into tasks (title, remind_at, status, category, visibile_staff,
                     ricorrenza_ogni, ricorrenza_unita, sollecito_ogni, sollecito_unita)
  values ('VERIFICA-20SET senza scadenza', v_avviso, 'da_fare', 'altro', true,
          1, 'mesi', 1, 'giorni')
  returning id into v_id;
  v_miei := v_miei || v_id;

  v_nuovo := completa_task(v_id);
  v_miei := v_miei || v_nuovo;
  select count(*) into v_n from tasks t
   where t.id = v_nuovo and t.remind_at is null and t.sollecito_ogni is null;
  if v_n <> 1 then
    raise exception 'VERIFICA: chiudendo un ricorrente senza scadenza il sollecito non e'' stato lasciato indietro.';
  end if;

  -- -------------------------------------------------------------------
  -- 6. CHIUSO VUOL DIRE ZITTO
  -- -------------------------------------------------------------------
  -- ⚠️ Si guarda la condizione nel corpo vivo del giro, non si manda niente:
  --    provarlo davvero vorrebbe dire far partire Telegram.
  if pg_get_functiondef('public.send_due_task_reminders'::regproc)
       not like '%t.status <> ''completato''%' then
    raise exception 'VERIFICA: il giro che manda non esclude piu'' i task chiusi.';
  end if;
  if pg_get_functiondef('public.send_due_task_reminders'::regproc)
       not like '%i.esito = ''riuscito''%' then
    raise exception 'VERIFICA: il giro non esclude le consegne gia'' riuscite: lo stesso sollecito ripartirebbe ogni cinque minuti.';
  end if;

  -- -------------------------------------------------------------------
  -- Si ripulisce: solo cio' che questa verifica ha creato
  -- -------------------------------------------------------------------
  perform set_config('request.jwt.claims', null, true);
  delete from tasks where id = any(v_miei);
  select count(*) into v_n from tasks where id = any(v_miei);
  if v_n <> 0 then
    raise exception 'VERIFICA: sono rimasti % task di prova.', v_n;
  end if;

  select count(*) into v_lap1 from deleted_records;
  if v_lap1 <> v_lap0 then
    raise exception 'VERIFICA: il registro delle cancellazioni e'' passato da % a %.', v_lap0, v_lap1;
  end if;
  perform pretendi_nessun_residuo(v_foto, 'la verifica del sollecito');

  raise notice 'Il sollecito e'' spento di suo, si conta dall''avviso, e si eredita con la ricorrenza.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260920000004', 'il_sollecito_finche_non_lo_chiudi') on conflict (version) do nothing;
