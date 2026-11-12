-- =====================================================================
-- LA SALA NUOVA
-- 12/11/2026 — decisioni di Alessio dell'11/11 sulla pianta nuova
-- (file Sweet Home 3D «Borgo 58 prova bagni»)
-- =====================================================================
--
-- La pianta del locale è cambiata. Da oggi in sala ci sono:
--   · 12 tavoli: T1 e T2 GRANDI 160×80 (in verticale, 4 sedie),
--     T3…T12 PICCOLI 70×80 (2 sedie), quasi tutti a coppie;
--   · 3 salottini (Divano 1-3) lungo la parete in basso, 6 posti
--     ciascuno, prenotabili come prima;
--   · la Chef Table SPENTA: «da togliere per ora». Spenta e non
--     cancellata, perché ordini e prenotazioni vecchie la nominano.
--
-- 🔴 UNA SOLA SALA. Niente più «sala alta» e «sala bassa»: la colonna
--    `zona` resta (serve a dire tavoli / divani / bancone) ma i due valori
--    diventano uno solo, 'sala'. Il vincolo li vieta da qui in avanti.
--    Era la strada meno invasiva: nessuna schermata leggeva `zona` per
--    distinguere le due sale, la distinzione stava solo nel disegno.
--
-- 🔴 LO STORICO NON SI TOCCA. I tavoli esistenti si AGGIORNANO sul posto
--    (stesso id, stesso nome): prenotazioni e conti vecchi continuano a
--    puntare a «T5», e il nome scritto al momento (`etichetta_al_momento`)
--    resta quello che era. Nessuna riga di dining_tables si cancella.
--    I tavoli che mancano (T10, T11, T12) si creano.
--    ⚠️ Il prezzo, dichiarato: «T5» di una prenotazione di agosto era un
--    quadrato 90×90 della sala vecchia, e oggi lo stesso nome è un piccolo
--    70×80 in un altro punto. Il locale non è ancora aperto: quelle righe
--    sono prove, non serate vere.
--
-- 🔴 LE DISPOSIZIONI DI UNA GIORNATA SI TOLGONO TUTTE. Erano scostamenti
--    scritti nelle coordinate della sala vecchia (2070 × 1030): sulla
--    pianta nuova (1990 × 950, misurata dentro i muri) metterebbero i
--    tavoli in punti che non vogliono dire niente, anche fuori dal
--    disegno. Su Prova sono 4, tutte di fine agosto; su work vanno
--    contate al rilascio (la migrazione lo dice).
--
-- 🔴 I FORMATI. Due nuovi: «Piccolo 70x80» (2 coperti) e «Grande 160x80»
--    (4 coperti), i numeri delle sedie disegnate nella pianta. I formati
--    vecchi restano (li nominano i tavoli spenti e lo storico) ma si
--    spengono: la pagina «Sala e orari» mostra solo quelli in uso.
--    ⚠️ Il «meno due per ogni giunzione» resta com'è: per due piccoli
--    accostati dà 2+2-2 = 2, mentre nella pianta la coppia ha 4 sedie.
--    È una domanda per Alessio, non una cosa da decidere qui: intanto la
--    serata si corregge a mano dalla pianta, come oggi.
--
-- ⚠️ IDEMPOTENTE, e qui non è una formalità: la sala si rifà UNA volta
--    sola. Un secondo giro, dopo che Alessio ha spostato i tavoli e premuto
--    «questa diventa la sala di sempre», rimetterebbe tutto al punto di
--    partenza. Il segno che è già fatto: un tavolo del formato «Grande
--    160x80» esiste.
--
-- Le posizioni sono quelle della pianta, arrotondate a 10 cm, con
-- l'origine allo spigolo interno in alto a sinistra dei muri. Lo stesso
-- riferimento lo usa il fondale (src/lib/calcoli/sala.js).
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. I FORMATI NUOVI — `do nothing`: se esistono già, il numero è di Alessio
-- ---------------------------------------------------------------------------
insert into formati_tavolo (nome, coperti_base) values
  ('Piccolo 70x80', 2),
  ('Grande 160x80', 4)
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------------
-- 2. UNA SOLA SALA — la zona 'sala' al posto di sala_alta / sala_bassa
-- ---------------------------------------------------------------------------
-- Il vincolo si rifà con gli stessi controlli di prima (20260814000007):
-- cambia SOLO l'elenco delle zone. Prima si toglie, poi si sistemano le
-- righe, poi si rimette: altrimenti l'update non passerebbe.
-- ⚠️ Il vincolo si rifà con la tabella bloccata (ACCESS EXCLUSIVE fino alla
-- fine): la tabella è piccola, ma se qualcuno la sta leggendo a lungo è meglio
-- fermarsi dopo 5 secondi che bloccare la sala (revisione del 12/11).
set local lock_timeout = '5s';

alter table dining_tables drop constraint if exists dining_tables_sagoma_check;

update dining_tables set zona = 'sala' where zona in ('sala_alta', 'sala_bassa');

alter table dining_tables alter column zona set default 'sala';

alter table dining_tables add constraint dining_tables_sagoma_check check (
  tipo  in ('tavolo', 'divano', 'chef_table')
  and forma in ('rettangolo', 'tondo')
  and zona  in ('sala', 'divani', 'bancone')
  and larghezza_cm  between 30 and 800
  and profondita_cm between 30 and 800
  and x between 0 and 5000
  and y between 0 and 5000
  and (case when tipo = 'tavolo' then posti_fissi is null
            else posti_fissi is not null and posti_fissi between 1 and 30 end)
  and (case when tipo = 'tavolo' then true else spostabile = false end)
);

comment on column dining_tables.zona is
  'sala | divani | bancone. Dal 12/11/2026 la sala è una sola: niente più sala_alta / sala_bassa.';

-- ---------------------------------------------------------------------------
-- 3. LA SALA NUOVA — una volta sola
-- ---------------------------------------------------------------------------
do $sala$
declare
  v_piccolo  uuid;
  v_grande   uuid;
  n_scost    integer;
  v_scost    text;
  n_spenti   integer;
  v_spenti   text;
  n_formati  integer;
begin
  select id into v_piccolo from formati_tavolo where nome = 'Piccolo 70x80';
  select id into v_grande  from formati_tavolo where nome = 'Grande 160x80';

  -- Due segni, perché uno solo può sparire: la riga nel registro, e un
  -- tavolo del formato grande (se Alessio un giorno cambiasse il formato di
  -- T1 e T2, il registro basta da solo).
  if exists (select 1 from applied_migrations where version = '20261112000004')
     or exists (select 1 from dining_tables where formato_id = v_grande) then
    perform set_config('borgo58.sala_nuova_rifatta', 'no', false);
    raise notice 'La sala nuova c''è già: nessun tavolo spostato.';
    return;
  end if;

  -- Il segno per la verifica qui sotto: i conti esatti (12 tavoli, 3
  -- salottini…) valgono solo per il giro che ha appena rifatto la sala. Su
  -- un secondo giro la sala è di Alessio, e può già essere diversa.
  perform set_config('borgo58.sala_nuova_rifatta', 'si', false);

  -- Le disposizioni delle giornate, scritte nella sala vecchia. Prima dei
  -- tavoli: è un'informazione che si dichiara contando.
  -- ⚠️ Cancellarle è irreversibile: prima si scrivono per intero nel
  -- messaggio della migrazione (sono poche), così restano nel registro di
  -- chi l'ha applicata invece che sparire con un numero.
  select string_agg(format('%s %s (%s, %s%s)', g.data, t.label, g.x, g.y,
                           case when g.ruotato then ', girato' else '' end), '; ' order by g.data, t.label)
    into v_scost
    from disposizioni_giornaliere g join dining_tables t on t.id = g.dining_table_id;
  delete from disposizioni_giornaliere where true;
  get diagnostics n_scost = row_count;
  if n_scost > 0 then
    raise notice 'Disposizioni di giornata della sala vecchia, tolte: %.', v_scost;
  end if;

  -- I tavoli e i salottini. `on conflict (label) do update` aggiorna quelli
  -- che ci sono (stesso id: lo storico resta attaccato) e crea quelli nuovi.
  -- Grandi: 160×80 girati, cioè in verticale come nella pianta.
  -- Piccoli: 80 di larghezza × 70 di profondità; T10 è l'unico in verticale.
  insert into dining_tables (label, position, active, tipo, forma, zona,
                             larghezza_cm, profondita_cm, spostabile, posti_fissi,
                             formato_id, x, y, ruotato)
  values
    ('T1',        0, true, 'tavolo', 'rettangolo', 'sala',   160,  80, true,  null, v_grande,  450,   0, true),
    ('T2',        1, true, 'tavolo', 'rettangolo', 'sala',   160,  80, true,  null, v_grande,  650, 270, true),
    ('T3',        2, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 700,   0, false),
    ('T4',        3, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 700,  70, false),
    ('T5',        4, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 950,   0, false),
    ('T6',        5, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 950,  70, false),
    ('T7',        6, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 360, 340, false),
    ('T8',        7, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 910, 240, false),
    ('T9',        8, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 910, 310, false),
    ('T10',       9, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 650, 520, true),
    ('T11',      10, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 920, 500, false),
    ('T12',      11, true, 'tavolo', 'rettangolo', 'sala',    80,  70, true,  null, v_piccolo, 920, 570, false),
    ('Divano 1', 12, true, 'divano', 'rettangolo', 'divani', 220, 200, false, 6,    null,      300, 750, false),
    ('Divano 2', 13, true, 'divano', 'rettangolo', 'divani', 220, 200, false, 6,    null,      520, 750, false),
    ('Divano 3', 14, true, 'divano', 'rettangolo', 'divani', 220, 200, false, 6,    null,      740, 750, false)
  on conflict (label) do update set
    position      = excluded.position,
    active        = true,
    tipo          = excluded.tipo,
    forma         = excluded.forma,
    zona          = excluded.zona,
    larghezza_cm  = excluded.larghezza_cm,
    profondita_cm = excluded.profondita_cm,
    spostabile    = excluded.spostabile,
    posti_fissi   = excluded.posti_fissi,
    formato_id    = excluded.formato_id,
    x             = excluded.x,
    y             = excluded.y,
    ruotato       = excluded.ruotato;

  -- La Chef Table si spegne (resta in tabella, con il suo storico), e con
  -- lei qualunque altra sagoma accesa che la pianta nuova non ha. Si
  -- dichiara quali, perché spegnere un tavolo è una cosa che si vede.
  with spente as (
    update dining_tables
       set active = false, position = 15
     where active
       and label <> all (array['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12',
                               'Divano 1','Divano 2','Divano 3'])
    returning label
  )
  select count(*), coalesce(string_agg(label, ', '), '') into n_spenti, v_spenti from spente;

  -- I formati della sala vecchia si spengono, se nessun tavolo acceso li usa.
  update formati_tavolo f
     set attivo = false
   where f.attivo
     and f.nome in ('Quadrato 90x90', 'Rettangolare 180x90')
     and not exists (select 1 from dining_tables t where t.formato_id = f.id and t.active);
  get diagnostics n_formati = row_count;

  raise notice 'Sala nuova: 12 tavoli e 3 salottini al loro posto. Spente: % (%). Disposizioni di giornata tolte: %. Formati vecchi spenti: %.',
    n_spenti, v_spenti, n_scost, n_formati;
end $sala$;

-- ---------------------------------------------------------------------------
-- 4. VERIFICA — prima sui dati, poi dentro una sotto-transazione annullata
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_n        integer;
  v_testo    text;
  v_rifiuto  boolean;
  v_vincolo  text;
  v_rifatta  boolean := coalesce(current_setting('borgo58.sala_nuova_rifatta', true), '') = 'si';
begin
  -- (2) Nessuna zona vecchia, su nessuna riga (accese o spente). Vale
  --     sempre: il vincolo nuovo lo garantisce anche dopo.
  if exists (select 1 from dining_tables where zona not in ('sala', 'divani', 'bancone')) then
    raise exception 'VERIFICA (2): ci sono ancora sagome in «sala alta» o «sala bassa».';
  end if;

  -- (1) Cosa è acceso: 12 tavoli (10 piccoli, 2 grandi), 3 divani, niente
  --     Chef Table. E la Chef Table c'è ancora, spenta.
  -- ⚠️ Solo sul giro che ha rifatto la sala (vedi sopra).
  if v_rifatta then
  select count(*) into v_n
    from dining_tables t join formati_tavolo f on f.id = t.formato_id
   where t.active and t.tipo = 'tavolo' and f.nome = 'Piccolo 70x80'
     and t.larghezza_cm = 80 and t.profondita_cm = 70;
  if v_n <> 10 then raise exception 'VERIFICA (1): i tavoli piccoli accesi sono %, invece di 10.', v_n; end if;

  select count(*) into v_n
    from dining_tables t join formati_tavolo f on f.id = t.formato_id
   where t.active and t.tipo = 'tavolo' and f.nome = 'Grande 160x80'
     and t.larghezza_cm = 160 and t.profondita_cm = 80;
  if v_n <> 2 then raise exception 'VERIFICA (1): i tavoli grandi accesi sono %, invece di 2.', v_n; end if;

  -- Non solo quanti: QUALI. Un nome scritto diverso su work (uno spazio,
  -- una maiuscola) creerebbe un doppione e spegnerebbe il vecchio, e i
  -- conteggi passerebbero lo stesso.
  select string_agg(label, ',' order by position) into v_testo from dining_tables where active;
  if v_testo is distinct from 'T1,T2,T3,T4,T5,T6,T7,T8,T9,T10,T11,T12,Divano 1,Divano 2,Divano 3' then
    raise exception 'VERIFICA (1): le sagome accese sono «%», non quelle della pianta nuova.', v_testo;
  end if;

  select count(*) into v_n from dining_tables where active and tipo = 'tavolo';
  if v_n <> 12 then raise exception 'VERIFICA (1): i tavoli accesi sono %, invece di 12.', v_n; end if;

  select count(*) into v_n from dining_tables where active and tipo = 'divano' and posti_fissi = 6;
  if v_n <> 3 then raise exception 'VERIFICA (1): i salottini accesi sono %, invece di 3.', v_n; end if;

  if exists (select 1 from dining_tables where active and tipo = 'chef_table') then
    raise exception 'VERIFICA (1): la Chef Table è ancora accesa.';
  end if;
  if not exists (select 1 from dining_tables where tipo = 'chef_table') then
    raise exception 'VERIFICA (1): la Chef Table è sparita: andava spenta, non cancellata.';
  end if;
  if exists (select 1 from disposizioni_giornaliere) then
    raise exception 'VERIFICA (1): sono rimaste disposizioni di giornata della sala vecchia.';
  end if;

  -- (3) Tutto dentro la sala nuova (1990 × 950), col verso vero.
  select string_agg(label, ', ') into v_testo
    from dining_tables
   where active
     and (x + case when ruotato then profondita_cm else larghezza_cm end > 1990
       or y + case when ruotato then larghezza_cm else profondita_cm end > 950);
  if v_testo is not null then
    raise exception 'VERIFICA (3): fuori dal disegno della sala nuova: %.', v_testo;
  end if;

  -- (4) Nessuna sagoma accesa sopra un'altra.
  select string_agg(a.label || ' su ' || b.label, ', ') into v_testo
    from dining_tables a
    join dining_tables b on a.id < b.id and b.active
   where a.active
     and a.x < b.x + case when b.ruotato then b.profondita_cm else b.larghezza_cm end
     and b.x < a.x + case when a.ruotato then a.profondita_cm else a.larghezza_cm end
     and a.y < b.y + case when b.ruotato then b.larghezza_cm else b.profondita_cm end
     and b.y < a.y + case when a.ruotato then a.larghezza_cm else a.profondita_cm end;
  if v_testo is not null then
    raise exception 'VERIFICA (4): sagome una sopra l''altra: %.', v_testo;
  end if;

  -- (5) Ogni tavolo acceso ha un formato acceso: senza, la pagina «Sala e
  --     orari» non mostrerebbe il numero da cambiare.
  if exists (select 1 from dining_tables t join formati_tavolo f on f.id = t.formato_id
              where t.active and not f.attivo) then
    raise exception 'VERIFICA (5): un tavolo acceso ha un formato spento.';
  end if;
  end if;  -- fine dei conti esatti del giro che ha rifatto la sala

  begin  -- <<< la sotto-transazione che verrà annullata
    -- (6) Le coppie della pianta sono tavoloni per il conteggio: 4 coppie
    --     da 2, e gli altri 4 tavoli da soli. Si guarda una data senza
    --     disposizioni, cioè la sala di sempre.
    if v_rifatta then
    select count(*) into v_n from coperti_del_giorno('1990-01-01') where cardinality(tavoli) = 2;
    if v_n <> 4 then
      raise exception 'VERIFICA (6): le coppie di tavoli accostati sono %, invece di 4.', v_n;
    end if;
    select count(*) into v_n from coperti_del_giorno('1990-01-01') where cardinality(tavoli) = 1;
    if v_n <> 4 then
      raise exception 'VERIFICA (6): i tavoli da soli sono %, invece di 4.', v_n;
    end if;

    -- (7) La pianta del giorno disegna 15 sagome, senza la Chef Table.
    select count(*) into v_n from pianta_del_giorno('1990-01-01');
    if v_n <> 15 then
      raise exception 'VERIFICA (7): la pianta del giorno ha % sagome, invece di 15.', v_n;
    end if;
    end if;

    -- (8) Una zona vecchia si rifiuta, e la rifiuta il vincolo delle sagome
    --     (non un altro vincolo per caso).
    begin
      v_rifiuto := false;
      insert into dining_tables (label, position, tipo, zona, larghezza_cm, profondita_cm, formato_id, x, y)
      select 'ZZ verifica sala', 999, 'tavolo', 'sala_alta', 80, 70, id, 4000, 4000
        from formati_tavolo where nome = 'Piccolo 70x80';
    exception when check_violation then
      get stacked diagnostics v_vincolo = constraint_name;
      v_rifiuto := v_vincolo = 'dining_tables_sagoma_check';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8): è entrata una sagoma in «sala alta».'; end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della sala nuova');

  -- Il segno è servito: non deve restare nella connessione per un altro giro.
  perform set_config('borgo58.sala_nuova_rifatta', 'no', false);

  if v_rifatta then
    raise notice 'Fatto: la sala è quella della pianta nuova (12 tavoli, 3 salottini, Chef Table spenta), in una sola zona. Provato e annullato: zero residui.';
  else
    raise notice 'La sala c''era già: controllati solo le zone e il rifiuto di «sala alta» (i conti esatti valgono solo sul giro che rifà la sala).';
  end if;
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000004', 'la_sala_nuova')
on conflict (version) do nothing;
