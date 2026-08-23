-- =====================================================================
-- L'ALLARME CHE DESCRIVE UN GUASTO PASSATO, E LE DOMANDE DI PROVA
-- 24/08/2026 — coda del blocco di pulizia, decisa da Alessio
-- =====================================================================
-- Due decisioni sue, prese guardando i numeri veri.
--
-- ---------------------------------------------------------------------
-- 1. L'ALLARME DEL 12/08 SI SPEGNE
-- ---------------------------------------------------------------------
-- Ieri l'avevo lasciato: *«racconta un guasto vero, e gli avvisi veri non
-- sono dati di prova»* (§8). Aveva ragione la meta' che guardava
-- **com'era nato**; gli mancava la meta' che guarda **com'e' adesso**.
--
-- 🔴 LA MISURA CHE HA DECISO: `lettura_posta` ha girato con successo il
-- **23/08 alle 22:00**, e tutti gli altri cinque lavori sono in orario.
-- Quell'avviso descrive un problema che non esiste piu' **da undici
-- giorni**.
--
-- Parole di Alessio, e diventano una regola: *«un allarme acceso dopo che
-- la causa e' passata e' peggio di nessun allarme, perche' abitua a
-- ignorarli.»* E' la stessa famiglia del freno anti-tempesta che zittiva i
-- rincari (13/08) e dell'allarme falso della sentinella (18/08): **il
-- danno di un avviso sbagliato non e' l'avviso, e' che insegna a non
-- guardare**.
--
-- ⚠️ NON SI TOGLIE PER DATA, SI TOGLIE PER PROPRIETA'. La condizione e'
-- che **il lavoro di cui si lamenta abbia girato dopo**: se un giorno
-- fosse davvero fermo, questa migrazione non lo zittirebbe. Una pulizia
-- che spegne un allarme ancora valido e' esattamente il difetto che
-- l'allarme esisteva per impedire.
--
-- ---------------------------------------------------------------------
-- 2. LE SEI DOMANDE ALL'ARCHIVIO SE NE VANNO
-- ---------------------------------------------------------------------
-- Erano prove di come funziona l'assistente («quanto pagherò di affitto
-- dopo un anno?», e la stessa domanda riscritta quattro volte con un
-- refuso corretto): non lasciano niente di utile, e i documenti a cui si
-- riferivano non ci sono piu'.
--
-- ⚠️ **LE 14 DISPOSIZIONI DELLA SALA RESTANO**, e la distinzione e' sua:
-- *«sono la pianta del mio locale, lavoro mio, e mi possono servire come
-- base.»* Le domande sono una prova; le disposizioni sono un gesto.
-- ⚠️ E' scritto qui perche' fra sei mesi la differenza non sara' ovvia:
-- due tabelle riempite negli stessi giorni di collaudo, e solo una e'
-- roba di prova.
--
-- ---------------------------------------------------------------------
-- ⚠️ Nessuna delle due tabelle e' tracciata (controllato, non dedotto):
-- queste cancellazioni non lasciano tracce nel registro. E' anche il
-- motivo per cui questa migrazione puo' venire DOPO la 024, che il
-- registro lo svuota.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La verifica del meccanismo — gira SEMPRE
-- ---------------------------------------------------------------------
-- ⚠️ Come nella 024: senza, dove non c'e' niente da togliere questa
-- migrazione passerebbe verde senza aver provato niente.
do $verifica$
declare
  v_n integer;
begin
  -- Un allarme finto che si lamenta di un lavoro CHE STA BENE: deve
  -- rientrare nel perimetro.
  insert into allarmi (tipo, messaggio)
  values ('lavoro_fermo_lettura_posta', 'ZZ verifica: lavoro fermo da sempre');

  select count(*) into v_n
    from allarmi a
   where a.messaggio like 'ZZ verifica%'
     and exists (
       select 1 from stato_lavori s
        where s.nome = 'lettura_posta' and s.ultimo_successo > a.creato_il - interval '1 second'
     );
  -- ⚠️ La condizione confronta l'allarme col successo del lavoro. Su un
  -- allarme appena creato il successo e' PRECEDENTE, quindi non deve
  -- rientrare: e' il verso che protegge un allarme ancora valido.
  if v_n <> 0 then
    raise exception 'Un allarme appena nato risulta gia'' superato: la condizione guarda dalla parte sbagliata.';
  end if;

  delete from allarmi where messaggio like 'ZZ verifica%';
  select count(*) into v_n from allarmi where messaggio like 'ZZ verifica%';
  if v_n <> 0 then raise exception 'La verifica ha lasciato % allarmi.', v_n; end if;

  raise notice 'Verifica passata: un allarme piu'' recente del successo del lavoro NON viene spento.';
end $verifica$;


-- ---------------------------------------------------------------------
-- 2. Le due pulizie, e cio' che non deve muoversi
-- ---------------------------------------------------------------------
do $pulizia$
declare
  v_soldi  integer;
  v_all    integer;
  v_dom    integer;
  v_quando timestamptz;
  v_disp_prima integer;
  v_disp_dopo  integer;
  v_lav_prima  integer;
  v_lav_dopo   integer;
begin
  -- 🔴 SI CONTA PRIMA CIO' CHE NON DEVE MUOVERSI.
  --
  -- ⚠️ E il primo tentativo di questo controllo era sbagliato: pretendeva
  -- che le disposizioni fossero **almeno una**, e sul progetto di prova
  -- sono **zero** — quelle sono dati della produzione. La migrazione si e'
  -- fermata su un database sanissimo.
  --
  -- La proprieta' giusta non e' «ce ne sono»: e' **«quante ce n'erano,
  -- tante ce ne sono»**. Vale su qualunque database, anche vuoto. E' la
  -- lezione del 16/08: *un guardiano deve esprimere una proprieta', non
  -- una quantita'.*
  select count(*) into v_disp_prima from disposizioni_giornaliere;
  select count(*) into v_lav_prima from stato_lavori;

  -- --- L'allarme superato: si toglie SOLO se il lavoro ha girato dopo.
  select s.ultimo_successo into v_quando from stato_lavori s where s.nome = 'lettura_posta';

  select count(*) into v_all
    from allarmi a
   where a.tipo = 'lavoro_fermo_lettura_posta'
     and v_quando is not null
     and v_quando > a.creato_il;

  delete from allarmi a
   where a.tipo = 'lavoro_fermo_lettura_posta'
     and v_quando is not null
     and v_quando > a.creato_il;

  if v_all = 0 then
    raise notice 'Nessun allarme da spegnere: o non ce n''era, o il lavoro non ha ancora girato dopo.';
  else
    raise notice 'Allarmi spenti perche'' il lavoro ha ripreso a girare (ultimo successo: %): %', v_quando, v_all;
  end if;

  -- --- Le domande all'archivio: stessa condizione della 024.
  select (select count(*) from cash_movements) + (select count(*) from supplier_invoices)
    into v_soldi;
  if v_soldi > 0 then
    raise notice 'Domande all''archivio: NON toccate, qui il gestionale ha gia'' dei movimenti.';
  else
    select count(*) into v_dom from domande_archivio;
    delete from domande_archivio;
    raise notice 'Domande di prova all''archivio tolte: %', v_dom;
  end if;

  -- --- E cio' che non doveva muoversi non si e' mosso.
  select count(*) into v_disp_dopo from disposizioni_giornaliere;
  select count(*) into v_lav_dopo from stato_lavori;

  if v_disp_dopo <> v_disp_prima then
    raise exception 'Le disposizioni della sala sono passate da % a %: sono lavoro suo, non dovevano essere toccate.',
      v_disp_prima, v_disp_dopo;
  end if;
  if v_lav_dopo <> v_lav_prima then
    raise exception 'Lo stato dei lavori e'' passato da % a %.', v_lav_prima, v_lav_dopo;
  end if;

  raise notice 'Non si e'' mosso cio'' che non doveva: % disposizioni della sala, % lavori sorvegliati.',
    v_disp_dopo, v_lav_dopo;
end $pulizia$;

insert into applied_migrations (version, name)
values ('20260824000001', 'l_allarme_spento_e_le_domande') on conflict (version) do nothing;
