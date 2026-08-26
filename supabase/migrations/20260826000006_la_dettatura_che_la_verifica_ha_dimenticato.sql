-- ============================================================================
-- IL RESIDUO CHE UNA VERIFICA HA DIMENTICATO — 26/08/2026
-- ============================================================================
--
-- 🔴 DIFETTO MIO, TROVATO MISURANDO LA PRODUZIONE DOPO AVER APPLICATO, non
--    fidandomi del «residui: zero» che la verifica stessa dichiarava.
--    In `dettature` e' rimasta **una riga** creata dalla verifica della
--    `20260826000005`, con la sua azione: «buttane due chili che sono
--    andati a male».
--
-- ----------------------------------------------------------------------------
-- LA CAUSA, ED E' PIU' UTILE DEL RESIDUO
-- ----------------------------------------------------------------------------
-- La verifica si segnava l'identificativo di cio' che creava — come vuole la
-- regola del 23/08 — ma **in una variabile che poi ha riusato**:
--
--     v_dett := (v_ris->>'dettatura_id')::uuid;   -- caso (A)
--     ...
--     v_dett := (v_ris->>'dettatura_id')::uuid;   -- caso (C), la sovrascrive
--     ...
--     delete from dettature where id = v_dett;    -- cancella (C)
--     delete from dettature where id = v_dett;    -- cancella (C) di nuovo
--
-- Due cancellazioni, **una sola riga tolta**, e la prima rimasta li'.
--
-- ⚠️ LA REGOLA DEL 23/08 ERA RISPETTATA ALLA LETTERA E TRADITA NELLA
--    SOSTANZA: «si cancella solo per identificativo, perche' te lo sei
--    segnato». L'identificativo me l'ero segnato — in un posto che poi ho
--    sovrascritto. *Una variabile riusata non e' un promemoria: e' l'ultimo
--    valore che ci e' passato dentro.*
--
-- ⚠️ E IL CONTROLLO FINALE NON POTEVA ACCORGERSENE, perche' guardava le
--    LAPIDI (`deleted_records`) e `dettature` non e' una tabella tracciata:
--    zero lapidi prima, zero dopo, e una riga di prova rimasta in mezzo ai
--    dati veri. Il guardiano c'era e guardava altrove.
--
-- ⚠️ La forma giusta, per chi scrive la prossima: **un array**, non una
--    variabile — `v_miei := v_miei || v_dett;` e alla fine
--    `delete ... where id = any(v_miei)`. E' quello che
--    `righeMie()` fa gia' per le prove dal client (tests/app/aiuto.js): la
--    stessa regola mancava alle verifiche delle migrazioni.
--
-- ----------------------------------------------------------------------------
-- IL PERIMETRO, E PERCHE' E' FATTO COSI'
-- ----------------------------------------------------------------------------
-- ⚠️ NON un identificativo scritto a mano — sarebbe un fossile che su una
--    ricostruzione da zero non esiste. NON un conteggio («se non sono
--    esattamente due, fermati») — sarebbe una fotografia travestita da
--    regola, ed e' l'errore del 16/08.
--
-- Il perimetro e' una PROPRIETA' verificabile, e sono tre condizioni
-- insieme: il testo e' **uno di quelli scritti dentro le verifiche**, la
-- provenienza e' `app`, e la riga e' **anteriore all'istante in cui questa
-- migrazione e' stata scritta**. Le tre insieme non possono descrivere una
-- dettatura vera: quelle frasi le ha scritte una verifica, non una bocca.
-- ============================================================================

do $pulizia$
declare
  v_prima   integer;
  v_tolte   integer;
  v_dopo    integer;
  v_azioni  integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
  -- Le frasi che le verifiche delle migrazioni della voce hanno dettato.
  v_frasi text[] := array[
    'buttane due chili che sono andati a male',
    'butta due chili di una cosa che non c''e''',
    'di quella roba ce ne sono quattro chili',
    'di quella verdura ce ne sono tre chili',
    'pomodori quattro chili, la cella a tre gradi, ricordami di chiamare il fornitore, e segna cinquanta euro di cassa',
    'ho lavato i pavimenti, e poi quella cosa la'' del coso',
    'butta due chili di una cosa che non c''e'', e ricordami di ordinare il pane',
    'ricordami di controllare il freezer',
    'la cella a tre gradi',
    'VERIFICA-lettura di una dettatura',
    'verifica della migrazione'
  ];
  -- L'istante in cui questa migrazione e' stata scritta. Tutto cio' che e'
  -- nato dopo e' di qualcuno che ha parlato davvero.
  v_confine timestamptz := '2026-08-26 15:00:00+00';
begin
  select count(*) into v_lapidi_pre from deleted_records;
  select count(*) into v_prima from dettature;

  delete from dettature d
   where d.testo = any(v_frasi)
     and d.provenienza = 'app'
     and d.creato_il < v_confine;
  get diagnostics v_tolte = row_count;

  select count(*) into v_dopo from dettature;
  select count(*) into v_azioni from azioni_dettate;

  -- ⚠️ SI DICHIARA QUANTE RIGHE HA TOCCATO, sempre — anche zero (regola del
  --    16/08). Uno zero qui non e' un errore: vuol dire «gia' fatto», o
  --    «questo database non ha mai avuto quel residuo», che e' il caso di
  --    una ricostruzione da zero. Ma il silenzio ha gia' ingannato quattro
  --    volte, e questa migrazione nasce proprio da un silenzio.
  raise notice 'Dettature prima: %, tolte: %, rimaste: % (con % azioni collegate).',
    v_prima, v_tolte, v_dopo, v_azioni;

  -- ------------------------------------------------------------------
  -- Verifica: nessuna riga di verifica sopravvive, e le azioni collegate
  -- se ne sono andate con lei (la chiave esterna e' `on delete cascade`).
  -- ------------------------------------------------------------------
  if exists (select 1 from dettature d
              where d.testo = any(v_frasi) and d.creato_il < v_confine) then
    raise exception 'E'' rimasta almeno una dettatura di verifica';
  end if;

  if exists (select 1 from azioni_dettate a
              where not exists (select 1 from dettature d where d.id = a.dettatura_id)) then
    raise exception 'Sono rimaste azioni senza la loro dettatura';
  end if;

  -- ⚠️ E il registro delle cancellazioni non deve essersi mosso: `dettature`
  --    non e' una tabella tracciata, quindi toglierne una non lascia lapidi.
  --    Se ne comparisse una, vorrebbe dire che il perimetro ha preso
  --    qualcos'altro.
  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La pulizia ha lasciato % lapidi: ha toccato una tabella che non doveva',
      v_lapidi_post - v_lapidi_pre;
  end if;

  raise notice 'Il residuo della verifica non c''e'' piu'', e il registro delle cancellazioni non si e'' mosso.';
end $pulizia$;

insert into applied_migrations (version, name)
values ('20260826000006', 'la_dettatura_che_la_verifica_ha_dimenticato')
on conflict (version) do nothing;
