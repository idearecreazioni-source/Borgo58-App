-- ============================================================================
-- UN MOVIMENTO DI BANCA HA IL SUO CONTO — 25/08/2026
-- ============================================================================
--
-- ✅ DECISIONE DI ALESSIO: un movimento di banca deve avere un conto, e
--    finche' il conto e' uno solo lo mette il gestionale da se'.
--
-- 🔴 E IL LAVORO ERA GIA' FATTO PER TRE QUARTI — scoperto applicando, non
--    leggendo. Su `cash_movements` c'era gia' `trg_conto_quando_serve`
--    (`pretendi_il_conto_quando_servono`), che con UN conto solo lo
--    riempie da se' e con PIU' D'UNO rifiuta. Il mandato lo dava per
--    inesistente perche' erano stati letti i **vincoli** della colonna —
--    e li' non c'e' che la chiave esterna. *Contare non e' leggere*, e i
--    trigger non sono vincoli.
--
-- 🔴 IL BUCO VERO E' PIU' STRETTO, ED E' UNO SOLO: con **zero** conti
--    registrati quella funzione non fa niente e il movimento passa con
--    il conto vuoto. E' esattamente il caso di oggi in produzione, dove
--    `conti_bancari` e' vuota: il primo bonifico vero nascerebbe orfano.
--
-- ⚠️ QUINDI SI ESTENDE LA FUNZIONE CHE C'E', non se ne affianca una
--    seconda. Due trigger che decidono la stessa cosa sono un doppione, e
--    la regola del progetto e' chiara: se due posti direbbero *esattamente*
--    la stessa cosa, il secondo si toglie. Il primo tentativo di questa
--    migrazione ne aveva creato uno, e viene rimosso qui sotto.
--
-- ⚠️ MISURATO PRIMA DI SCRIVERE:
--    · PRODUZIONE (letto dal validatore oggi): 0 conti, 0 movimenti.
--    · PROGETTO DI PROVA: `mezzo` assume due valori soli — `cassa` (37) e
--      `banca` (20) — e **tutti e venti quelli di banca avevano il conto
--      vuoto**, tutti della stessa societa'. `conti_bancari` era vuota
--      anche qui.
--    · Nessuna delle SETTE funzioni che inseriscono in `cash_movements`
--      nomina `conto_id`: chiudi_riga_lista, pareggia_anticipazione,
--      pay_supplier_invoice, registra_conteggio_cassa,
--      registra_prestito_privato, registra_restituzione_prestito,
--      versa_in_banca. E' il motivo per cui la regola sta in un trigger e
--      non dentro le funzioni: correggerle una per una vorrebbe dire
--      «trovarle tutte», e l'ottava che nascera' domani ricomincerebbe.
--
-- 🔴 IL VINCOLO ASSOLUTO DELLA SANATORIA: se non c'e' niente da sanare,
--    NON DEVE NASCERE NESSUN CONTO. In produzione la banca non e' ancora
--    scelta, e un conto inventato dal gestionale sarebbe un dato falso in
--    mezzo ai dati veri. Il ciclo gira **solo** sulle societa' che hanno
--    gia' movimenti di banca orfani: sulla prova ne ha trovata una, in
--    produzione nessuna.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il conto di sempre
-- ----------------------------------------------------------------------------
-- ⚠️ SERVE PERCHE' IL RIFIUTO CON PIU' CONTI DIVENTI SUPERABILE. Fino a
--    oggi, due conti attivi volevano dire che ogni movimento nato dentro
--    una funzione — un pagamento fattura, un versamento — veniva
--    respinto, e non c'era nessun modo di dire «di solito e' questo».
--
-- ⚠️ UN PREDEFINITO SU UNA COLONNA NUOVA RISPONDE AL POSTO DI CHI NON HA
--    RISPOSTO (lezione del 14/08). Qui non succede, ed e' misurato:
--    `conti_bancari` aveva ZERO righe sia in produzione sia sulla prova,
--    quindi quel `false` non scrive niente su nessuno. E resta la
--    risposta giusta in avanti: un conto appena registrato non e' quello
--    di sempre finche' qualcuno non lo dice.
alter table conti_bancari
  add column if not exists predefinito boolean not null default false;

comment on column conti_bancari.predefinito is
  'Il conto su cui il gestionale mette i movimenti di banca quando nessuno ne indica uno. Ne esiste al massimo uno attivo per societa'': lo garantisce un indice, non un controllo di schermata.';

-- ⚠️ UN INDICE, NON UN CONTROLLO NELLA SCHERMATA. Due conti «di sempre»
--    nella stessa societa' renderebbero ambiguo ogni movimento che non
--    nomina il conto — e l'ambiguita' si risolverebbe a caso.
create unique index if not exists uq_conto_predefinito_per_entita
  on conti_bancari (entity_id)
  where predefinito and attivo;

-- ----------------------------------------------------------------------------
-- 2. La sanatoria — e dichiara quante righe ha toccato
-- ----------------------------------------------------------------------------
-- ⚠️ Idempotente: rieseguita non trova piu' movimenti orfani e non fa
--    nulla. E uno zero NON e' un errore — vuol dire «gia' fatto», oppure
--    «su questo database non c'era niente da fare». Va detto (16/08),
--    perche' e' il silenzio ad aver ingannato, non il numero.
do $sanatoria$
declare
  v_ent       uuid;
  v_conto     uuid;
  v_n         integer;
  v_creati    integer := 0;
  v_assegnati integer := 0;
begin
  for v_ent in
    select distinct entity_id from cash_movements
     where mezzo <> 'cassa' and conto_id is null
  loop
    select id into v_conto
      from conti_bancari
     where entity_id = v_ent and predefinito and attivo;

    if v_conto is null then
      -- C'e' gia' un conto attivo, solo nessuno l'ha marcato: si marca
      -- quello, invece di inventarne un secondo.
      select id into v_conto
        from conti_bancari
       where entity_id = v_ent and attivo
       order by creato_il
       limit 1;

      if v_conto is not null then
        update conti_bancari set predefinito = true where id = v_conto;
      else
        insert into conti_bancari (entity_id, nome, attivo, predefinito, note)
        values (v_ent, 'Conto corrente', true, true,
                'Creato dalla migrazione del 25/08/2026: c''erano gia'' dei movimenti di banca senza conto, e senza un conto a cui attaccarli sarebbero rimasti orfani per sempre. Il nome e l''IBAN si correggono da Cassa.')
        returning id into v_conto;
        v_creati := v_creati + 1;
      end if;
    end if;

    update cash_movements
       set conto_id = v_conto
     where entity_id = v_ent and mezzo <> 'cassa' and conto_id is null;
    get diagnostics v_n = row_count;
    v_assegnati := v_assegnati + v_n;
  end loop;

  raise notice 'Sanatoria: % conti creati, % movimenti di banca assegnati.', v_creati, v_assegnati;
end $sanatoria$;

-- ----------------------------------------------------------------------------
-- 3. La regola che c'era, con il caso che le mancava
-- ----------------------------------------------------------------------------
-- ⚠️ Corpo ripreso VIVO dal database (`pg_get_functiondef`). Cambiano due
--    cose e basta: il caso ZERO, che prima passava in silenzio, e il
--    conto di sempre, che rende superabile il rifiuto con piu' conti.
--
-- rete-guardie: pretendi_il_conto_quando_servono — il messaggio del
--   rifiuto con piu' conti cambia APPOSTA. Quello vecchio diceva solo
--   «scegli il conto, oppure disattiva quelli che non usi», e da oggi
--   c'e' una seconda via che prima non esisteva: segnare il conto di
--   sempre. Un messaggio che non nomina la via d'uscita nuova manda a
--   disattivare un conto vero per far passare un movimento.
create or replace function pretendi_il_conto_quando_servono()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_quanti integer;
begin
  if new.mezzo is distinct from 'banca' or new.conto_id is not null then
    return new;
  end if;

  select count(*) into v_quanti
    from conti_bancari c
   where c.entity_id = new.entity_id and c.attivo;

  -- 🔴 IL CASO CHE MANCAVA (25/08/2026). Con zero conti registrati questa
  -- funzione non faceva niente e il movimento nasceva orfano: nessun
  -- errore, nessuna traccia, e il giorno del secondo conto non c'e' piu'
  -- modo di sapere da dove sono usciti quei soldi. E' la stessa forma del
  -- silenzio che si e' appena chiuso sul magazzino.
  if v_quanti = 0 then
    raise exception
      'Questo movimento passa dalla banca, ma non c''e'' nessun conto corrente registrato: aprilo da Cassa → Conti correnti e riprova.'
      using errcode = 'P0001';
  end if;

  if v_quanti > 1 then
    -- ⚠️ Con piu' conti si guarda quello di sempre PRIMA di rifiutare:
    -- senza, ogni pagamento di fattura e ogni versamento nato dentro una
    -- funzione verrebbe respinto, e nessuna schermata avrebbe modo di
    -- indicare il conto. Il rifiuto resta dove la scelta serve davvero.
    select c.id into new.conto_id
      from conti_bancari c
     where c.entity_id = new.entity_id and c.attivo and c.predefinito;

    if new.conto_id is null then
      raise exception
        'Ci sono % conti bancari attivi e nessuno e'' segnato come quello di sempre: scegli il conto di questo movimento, oppure segna il conto principale da Cassa.',
        v_quanti
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  -- ⚠️ Con UN conto solo lo si riempie da se': non e' una scelta, e
  -- chiederla sarebbe una domanda con una risposta sola. Cosi' i
  -- movimenti di oggi nascono gia' attribuiti, e il giorno del secondo
  -- conto non c'e' nessuno storico da ricostruire — che e' precisamente
  -- il motivo per cui questa migrazione si fa adesso.
  select c.id into new.conto_id
    from conti_bancari c
   where c.entity_id = new.entity_id and c.attivo;

  return new;
end $function$;

revoke all on function pretendi_il_conto_quando_servono() from public, anon, authenticated;

-- ⚠️ Il primo tentativo di questa migrazione aveva creato un SECONDO
--    trigger che decideva la stessa cosa. Si toglie: due posti che
--    decidono lo stesso fatto prima o poi ne dicono due versioni, e a
--    quel punto vince chi si chiama prima in ordine alfabetico — che non
--    e' un criterio.
drop trigger if exists trg_conto_bancario_obbligatorio on cash_movements;
drop function if exists conto_bancario_obbligatorio();

-- ----------------------------------------------------------------------------
-- 4. E la rete sotto il trigger
-- ----------------------------------------------------------------------------
-- ⚠️ Il trigger RIEMPIE, il vincolo GARANTISCE, e sono due cose diverse:
--    un trigger si puo' spegnere — le verifiche lo fanno di continuo — un
--    vincolo `check` no. Senza, basterebbe un `disable trigger`
--    dimenticato acceso per riaprire il buco in silenzio.
alter table cash_movements drop constraint if exists movimento_di_banca_ha_un_conto;
alter table cash_movements
  add constraint movimento_di_banca_ha_un_conto
  check (mezzo = 'cassa' or conto_id is not null);

comment on constraint movimento_di_banca_ha_un_conto on cash_movements is
  'Un movimento che passa dalla banca dice da quale conto: senza, il giorno che i conti diventano due non c''e'' piu'' modo di sapere da dove sono usciti i soldi. I contanti no: quelli stanno nel cassetto.';

-- ============================================================================
-- VERIFICA — i quattro casi, e il contante che continua a passare
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di roba che la verifica ha creato: la societa'
--    no (non se ne inventa una), i conti e i movimenti si'. Si cancellano
--    per identificativo (23/08), mai «l'ultimo inserito».
do $verifica$
declare
  v_ent        uuid;
  v_causale    uuid;
  v_conto_a    uuid;
  v_conto_b    uuid;
  v_mov        uuid;
  v_mov_cassa  uuid;
  v_letto      uuid;
  v_preesist   uuid[];
  v_ok         boolean;
  v_n          integer;
  v_lapidi_pre  integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;
  select id into v_ent from entities order by created_at limit 1;
  select id into v_causale from cash_causali where active limit 1;
  if v_ent is null or v_causale is null then
    raise exception 'Manca la societa'' o una causale: impossibile verificare.';
  end if;

  -- ⚠️ I conti che c'erano prima si mettono da parte e si rimettono
  --    com'erano: una verifica non deve poter cambiare una scelta di
  --    Alessio (lezione del 14/08 — si salva e si riscrive, non si
  --    ricorda a mano cosa si era toccato).
  select array_agg(id) into v_preesist
    from conti_bancari where entity_id = v_ent and attivo;
  update conti_bancari set attivo = false
   where id = any(coalesce(v_preesist, array[]::uuid[]));

  -- ------------------------------------------------------------------
  -- CASO 1 — ZERO conti: si rifiuta, e lo dice in italiano.
  --          E' il caso che mancava, cioe' l'unica cosa che questa
  --          migrazione cambia davvero nel comportamento.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo)
    values (v_ent, 'uscita', 10.00, current_date, v_causale, 'banca');
    raise exception 'ATTESO RIFIUTO: un movimento di banca e'' passato senza nessun conto registrato';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      if sqlerrm not like '%nessun conto corrente registrato%' then
        raise exception 'Rifiutato con la frase sbagliata: «%»', sqlerrm;
      end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Il caso «zero conti» non ha rifiutato';
  end if;

  -- ------------------------------------------------------------------
  -- CASO 2 — UN conto solo: il gestionale lo mette da se'.
  -- ------------------------------------------------------------------
  insert into conti_bancari (entity_id, nome, attivo, predefinito)
  values (v_ent, 'ZZ verifica conto A', true, false)
  returning id into v_conto_a;

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo)
  values (v_ent, 'uscita', 10.00, current_date, v_causale, 'banca')
  returning id into v_mov;

  select conto_id into v_letto from cash_movements where id = v_mov;
  if v_letto is distinct from v_conto_a then
    raise exception 'Con un conto solo il movimento non l''ha preso: % invece di %', v_letto, v_conto_a;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 3 — DUE conti e nessuno «di sempre»: si rifiuta invece di
  --          indovinare. Un movimento sul conto sbagliato non da'
  --          nessun errore: da' due saldi che non tornano.
  -- ------------------------------------------------------------------
  insert into conti_bancari (entity_id, nome, attivo, predefinito)
  values (v_ent, 'ZZ verifica conto B', true, false)
  returning id into v_conto_b;

  v_ok := false;
  begin
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo)
    values (v_ent, 'uscita', 20.00, current_date, v_causale, 'banca');
    raise exception 'ATTESO RIFIUTO: con due conti il gestionale ne ha scelto uno a caso';
  exception
    when sqlstate 'P0001' then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      if sqlerrm not like '%nessuno e%segnato come quello di sempre%' then
        raise exception 'Rifiutato con la frase sbagliata: «%»', sqlerrm;
      end if;
      v_ok := true;
  end;
  if not v_ok then
    raise exception 'Il caso «due conti» non ha rifiutato';
  end if;

  -- ------------------------------------------------------------------
  -- CASO 3-bis — marcato quello di sempre, il movimento ci va sopra.
  --              Senza questo verso il rifiuto sarebbe un vicolo cieco.
  -- ------------------------------------------------------------------
  update conti_bancari set predefinito = true where id = v_conto_b;

  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo)
  values (v_ent, 'uscita', 30.00, current_date, v_causale, 'banca')
  returning id into v_mov;
  select conto_id into v_letto from cash_movements where id = v_mov;
  if v_letto is distinct from v_conto_b then
    raise exception 'Il movimento non e'' finito sul conto di sempre';
  end if;

  -- E due «conti di sempre» non possono esistere: lo dice l'indice.
  v_ok := false;
  begin
    update conti_bancari set predefinito = true where id = v_conto_a;
    raise exception 'ATTESO RIFIUTO: due conti di sempre nella stessa societa''';
  exception
    when unique_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then
    raise exception 'L''indice non impedisce due conti «di sempre»';
  end if;

  -- ------------------------------------------------------------------
  -- CASO 4 — il contante passa come prima, senza nessun conto.
  --          Senza questo verso, una regola troppo larga bloccherebbe
  --          il gesto piu' frequente della cassa.
  -- ------------------------------------------------------------------
  insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo)
  values (v_ent, 'uscita', 5.00, current_date, v_causale, 'cassa')
  returning id into v_mov_cassa;
  select conto_id into v_letto from cash_movements where id = v_mov_cassa;
  if v_letto is not null then
    raise exception 'A un movimento di contanti e'' stato attaccato un conto corrente';
  end if;

  -- ------------------------------------------------------------------
  -- E il vincolo regge anche col trigger spento: e' la rete sotto.
  -- ------------------------------------------------------------------
  alter table cash_movements disable trigger trg_conto_quando_serve;
  v_ok := false;
  begin
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo)
    values (v_ent, 'uscita', 40.00, current_date, v_causale, 'banca');
    raise exception 'ATTESO RIFIUTO: col trigger spento e'' passato un movimento di banca senza conto';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  alter table cash_movements enable trigger trg_conto_quando_serve;
  if not v_ok then
    raise exception 'Il vincolo non regge quando il trigger e'' spento';
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo, e i conti tornano com'erano
  -- ------------------------------------------------------------------
  -- ⚠️ `cash_movements` E' TRACCIATA: ogni riga cancellata lascia una
  --    copia nel registro delle cancellazioni, che e' esibibile e che
  --    nessuno puo' ripulire dall'app. Righe di prova li' dentro sono
  --    dati finti in mezzo ai dati veri, e rompono il guardiano che ogni
  --    migrazione usa per difendersi. Il trigger si spegne nominandolo, e
  --    dopo si controlla di averlo riacceso.
  alter table cash_movements disable trigger trg_log_delete;

  delete from cash_movements where id in (v_mov, v_mov_cassa);
  delete from cash_movements where conto_id in (v_conto_a, v_conto_b);
  delete from conti_bancari  where id in (v_conto_a, v_conto_b);

  alter table cash_movements enable trigger trg_log_delete;
  update conti_bancari set attivo = true
   where id = any(coalesce(v_preesist, array[]::uuid[]));

  select count(*) into v_n
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'cash_movements' and not t.tgisinternal and t.tgenabled = 'D';
  if v_n <> 0 then
    raise exception 'Sono rimasti % trigger spenti su cash_movements', v_n;
  end if;

  -- ⚠️ UNA PROPRIETA', NON UNA QUANTITA': nessun movimento di banca resta
  --    orfano. Vale su tutti e due i database e resta vera domani.
  select count(*) into v_n
    from cash_movements where mezzo <> 'cassa' and conto_id is null;
  if v_n <> 0 then
    raise exception 'Restano % movimenti di banca senza conto', v_n;
  end if;

  -- E il doppione e' sparito davvero: un trigger solo decide il conto.
  select count(*) into v_n from pg_trigger where tgname = 'trg_conto_bancario_obbligatorio';
  if v_n <> 0 then
    raise exception 'Il secondo trigger e'' ancora li''';
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_lapidi_post - v_lapidi_pre;
  end if;

  raise notice 'Un movimento di banca ha il suo conto: con un conto solo lo mette il gestionale, con due chiede, con nessuno rifiuta — e il contante passa come prima.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000009', 'un_movimento_di_banca_ha_il_suo_conto')
on conflict (version) do nothing;
