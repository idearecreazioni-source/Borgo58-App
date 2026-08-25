-- =====================================================================
-- «AGGIORNATO IL» SI CHIEDE AL DATABASE, NON ALL'OROLOGIO DEL TABLET
-- 25/08/2026 — le cinque colonne che potevano dire il falso
-- =====================================================================
-- 🔴 MISURATO, E LA MISURA HA CORRETTO LA DIAGNOSI. La voce in coda diceva
-- «due tabelle su cui la colonna non viene mai aggiornata». Interrogando
-- il catalogo, le tabelle con una colonna «aggiornato il» **senza nessun
-- trigger che la tocchi** sono **cinque**:
--
--   · correzioni_coperti.aggiornato_il      (ha un trigger, ma ordina i
--                                            tavoli: non tocca la data)
--   · disposizioni_giornaliere.aggiornato_il
--   · formati_tavolo.aggiornato_il
--   · impostazioni_tesoreria.aggiornato_il
--   · service_hours.updated_at
--
-- Le altre **trenta** colonne dello stesso nome il trigger ce l'hanno:
-- queste cinque erano l'eccezione, non la regola.
--
-- 🔴 E NON ERA VERO CHE «NON VIENE MAI AGGIORNATA»: viene aggiornata
-- **dall'applicazione**, che ci scrive `new Date().toISOString()`. Il
-- difetto vero sono due, ed è peggio di quello dichiarato:
--
--   1. **L'ORA È QUELLA DEL DISPOSITIVO.** È l'orologio del tablet o del
--      telefono, non quello del database. Questo progetto lo sa già dal
--      20/08 — *un istante si chiede al database, come un numero; i due
--      orologi non sono lo stesso orologio* — e lì una prova era
--      diventata rossa per pochi millisecondi di scarto. Su un tablet
--      lasciato spento per giorni lo scarto è ben altro.
--
--   2. **DIPENDE DA CHI SI RICORDA DI SCRIVERLA.** Misurato nel codice:
--      su `correzioni_coperti`, `disposizioni_giornaliere` e
--      `impostazioni_tesoreria` c'è una sola strada che la scrive, e
--      basta che una scrittura nuova — o una funzione SQL, che
--      l'applicazione non attraversa affatto — dimentichi il campo perché
--      la colonna resti indietro **senza nessun errore**. Una data ferma
--      non somiglia a un guasto: somiglia a una cosa che nessuno ha
--      toccato.
--
-- ⚠️ LA CURA È QUELLA CHE IL PROGETTO USA GIÀ TRENTA VOLTE: il trigger.
-- Non è una preferenza di stile — è la differenza fra una regola che vale
-- **da qualunque porta si entri** e una che vale solo dalle porte che
-- qualcuno si è ricordato di attrezzare.
-- =====================================================================
--
-- ---------------------------------------------------------------------
-- Un allarme falso della rete dei portieri, guardato e chiuso qui
-- ---------------------------------------------------------------------
-- ⚠️ La `20260825000001` risulta «chiamare» `scale_che_non_tornano()` in
-- un blocco senza claims. Guardato: **non la chiama**. Il nome compare
-- due volte dentro delle stringhe — `to_regprocedure('public.…()')`, che
-- chiede al catalogo se la funzione esiste, e il testo del messaggio che
-- elenca cosa manca. Nessuno dei due esegue niente.
-- ⚠️ Le chiamate vere di quella migrazione stanno tutte nel suo blocco di
-- verifica, che i claims li imposta in cima — controllato riga per riga,
-- non dedotto dal fatto che la migrazione è passata.
-- ⚠️ E la dichiarazione sta QUI e non là, perché una migrazione già
-- applicata non si riscrive (regola del 23/08).
--
-- rete-portieri: 20260825000001 chiama scale_che_non_tornano — il nome compare solo dentro `to_regprocedure('…')` e nel testo di un messaggio; le chiamate vere sono nel blocco di verifica, che imposta i claims in cima.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Il trigger sulle cinque
-- ---------------------------------------------------------------------
-- ⚠️ `set_aggiornato_il` e `set_updated_at` sono due funzioni distinte
-- perché le colonne si chiamano in due modi: si prende quella giusta per
-- ogni tabella, non si rinomina niente. Rinominare una colonna che il
-- client interroga per nome sarebbe un lavoro a sé, e non è questo.
drop trigger if exists set_aggiornato_il on correzioni_coperti;
create trigger set_aggiornato_il before update on correzioni_coperti
  for each row execute function set_aggiornato_il();

drop trigger if exists set_aggiornato_il on disposizioni_giornaliere;
create trigger set_aggiornato_il before update on disposizioni_giornaliere
  for each row execute function set_aggiornato_il();

drop trigger if exists set_aggiornato_il on formati_tavolo;
create trigger set_aggiornato_il before update on formati_tavolo
  for each row execute function set_aggiornato_il();

drop trigger if exists set_aggiornato_il on impostazioni_tesoreria;
create trigger set_aggiornato_il before update on impostazioni_tesoreria
  for each row execute function set_aggiornato_il();

drop trigger if exists set_updated_at on service_hours;
create trigger set_updated_at before update on service_hours
  for each row execute function set_updated_at();

-- ⚠️ SOLO `before update`, MAI `before insert`, ed è la stessa lezione del
-- 14/08 sulle colonne nuove: su una riga appena creata «aggiornato il»
-- vuoto vuol dire **«mai modificata da quando esiste»**, ed è
-- un'informazione vera. Riempirlo alla nascita risponderebbe al posto di
-- chi non ha ancora risposto — e le trenta tabelle che il trigger ce
-- l'hanno si comportano già così.

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA, su roba propria
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_id       uuid;
  v_prima    timestamptz;
  v_dopo     timestamptz;
  v_scarto   interval;
  v_senza    integer;
  r          record;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) LA PROPRIETÀ, non un elenco: nessuna tabella di `public` deve
  --     avere una colonna «aggiornato il» senza il trigger che la tiene
  --     viva. ⚠️ Scritta così, il giorno che nasce una tabella nuova con
  --     quella colonna e senza trigger, questa verifica se ne accorge —
  --     cosa che un elenco di cinque nomi non farebbe.
  select count(*) into v_senza
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid
   where n.nspname = 'public' and t.relkind = 'r'
     and a.attnum > 0 and not a.attisdropped
     and a.attname in ('updated_at', 'aggiornato_il')
     and not exists (
       select 1 from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
        where tg.tgrelid = t.oid and not tg.tgisinternal
          and p.proname in ('set_updated_at', 'set_aggiornato_il'));
  if v_senza > 0 then
    for r in
      select t.relname, a.attname
        from pg_class t
        join pg_namespace n on n.oid = t.relnamespace
        join pg_attribute a on a.attrelid = t.oid
       where n.nspname = 'public' and t.relkind = 'r'
         and a.attnum > 0 and not a.attisdropped
         and a.attname in ('updated_at', 'aggiornato_il')
         and not exists (
           select 1 from pg_trigger tg join pg_proc p on p.oid = tg.tgfoid
            where tg.tgrelid = t.oid and not tg.tgisinternal
              and p.proname in ('set_updated_at', 'set_aggiornato_il'))
    loop
      raise notice '  senza trigger: %.%', r.relname, r.attname;
    end loop;
    raise exception '% colonne «aggiornato il» possono restare indietro senza che nessuno se ne accorga.', v_senza;
  end if;

  -- (b) 🔴 LA PROVA CHE DISCRIMINA, su una riga NOSTRA: si scrive una data
  --     palesemente falsa e il trigger deve sovrascriverla con l'ora del
  --     database. ⚠️ Senza questo, il punto (a) direbbe solo che i
  --     trigger ESISTONO — non che funzionano.
  insert into formati_tavolo (nome, coperti_base, attivo)
  values ('_prova 25082026', 2, false)
  returning id into v_id;

  update formati_tavolo set aggiornato_il = '1990-01-01'::timestamptz where id = v_id;
  select aggiornato_il into v_prima from formati_tavolo where id = v_id;

  if v_prima < now() - interval '1 day' then
    raise exception 'Il trigger non ha sovrascritto la data finta: «aggiornato il» dice ancora %.', v_prima;
  end if;

  -- ⚠️ E DEV'ESSERE L'ORA DEL DATABASE, non una qualunque ora recente: si
  --     controlla che lo scarto da `now()` sia trascurabile. È il punto
  --     dell'intera migrazione — l'ora del tablet passerebbe il controllo
  --     di sopra e fallirebbe questo se fosse sfasata.
  v_scarto := now() - v_prima;
  if v_scarto > interval '5 seconds' or v_scarto < interval '-5 seconds' then
    raise exception 'La data scritta non è l''ora del database: scarto di %.', v_scarto;
  end if;

  -- (c) 🔴 IL CASO CHE CONTA DAVVERO: un aggiornamento che **non nomina**
  --     la colonna. È esattamente quello che succede quando una scrittura
  --     nuova, o una funzione SQL, si dimentica il campo — cioè il difetto
  --     che questa migrazione chiude. Con il solo punto (b) si proverebbe
  --     che il trigger corregge una data sbagliata scritta apposta, non
  --     che la scrive quando nessuno gliela passa.
  --
  -- ⚠️ PER AVERE UNA DATA VECCHIA SU CUI PROVARE BISOGNA SPEGNERE IL
  --     TRIGGER: acceso, sovrascrive anche questa. Si spegne, si scrive,
  --     si riaccende — e si CONTROLLA di averlo riacceso, perché lasciarlo
  --     spento vorrebbe dire chiudere il difetto e riaprirlo nella stessa
  --     migrazione.
  --
  -- ⚠️ E NON SI PROVA CHE LA DATA «AVANZA» FRA DUE AGGIORNAMENTI: dentro
  --     una transazione `now()` è **un istante solo** (trappola del 16/08,
  --     ricomparsa il 20/08), quindi due update di fila danno la stessa
  --     identica data. Non è un difetto del trigger: è come si comportano
  --     tutte e trenta le altre tabelle.
  alter table formati_tavolo disable trigger set_aggiornato_il;
  update formati_tavolo set aggiornato_il = '1990-01-01'::timestamptz where id = v_id;
  alter table formati_tavolo enable trigger set_aggiornato_il;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.formati_tavolo'::regclass
       and tgname = 'set_aggiornato_il' and tgenabled <> 'D')
  then
    raise exception 'Il trigger è rimasto spento su formati_tavolo.';
  end if;

  select aggiornato_il into v_prima from formati_tavolo where id = v_id;
  if v_prima > '1991-01-01'::timestamptz then
    raise exception 'Non sono riuscito a mettere la data vecchia: la prova non discriminerebbe.';
  end if;

  -- L'aggiornamento che NON nomina la colonna.
  update formati_tavolo set coperti_base = 3 where id = v_id;
  select aggiornato_il into v_dopo from formati_tavolo where id = v_id;
  if v_dopo <= v_prima then
    raise exception 'Un aggiornamento che non nomina la colonna la lascia indietro: era %, adesso %.', v_prima, v_dopo;
  end if;

  -- Si ripulisce cio' che questa verifica ha creato, per identificativo.
  delete from formati_tavolo where id = v_id;
  if exists (select 1 from formati_tavolo where id = v_id) then
    raise exception 'La verifica ha lasciato il proprio formato di prova.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Nessuna colonna «aggiornato il» senza trigger, e la data la scrive il database.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000003', 'l_ora_si_chiede_al_database') on conflict (version) do nothing;
