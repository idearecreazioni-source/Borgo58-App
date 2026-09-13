-- =====================================================================
-- MEMO: UN TITOLO BREVE NON COMBACIA PER CASO
-- =====================================================================
-- 13/09/2026. Difetto trovato il 12/09 sul progetto di prova e annotato
-- sulla #58: un impegno aperto intitolato «Test» e' diventato candidato in
-- tutte le prove vocali dell'Agenda, perche' le loro frasi cominciano con
-- «TEST-AUTO…». Nove prove rosse in tre file sul giro di master `7dc76fb`.
--
-- 🔴 LA CAUSA, precisa. `impegni_compatibili` (20260909000003) ha tre
--    gradini, e il terzo — «uno contiene l'altro» — confrontava due
--    STRINGHE con `like '%…%'`:
--      · senza confini di parola: «arte» dentro «partenze», «iva» dentro
--        «arrivano»;
--      · e dopo `voce_titolo_nudo`, che riduce trattini e simboli a spazi:
--        «TEST-AUTO scelta#k9x2» diventa «test auto scelta k9x2», e a quel
--        punto «test» sembra una parola a se' — anche con un confronto a
--        parole intere. Il pezzo di un codice o di un prefisso tecnico si
--        travestiva da parola.
--    ⚠️ La soglia di tre lettere guardava solo la frase detta, mai il
--    titolo: un titolo di quattro lettere passava ovunque stesse.
--
-- ✅ LA REGOLA NUOVA, sul solo terzo gradino: si contengono **parole
--    intere e pezzi interi**. Un testo si divide prima nei pezzi che chi
--    l'ha scritto ha separato davvero (spazi, virgole, apostrofi…); i pezzi
--    tenuti insieme da un trattino, un cancelletto, una barra o un punto
--    («TEST-AUTO», «F24-bis», «scelta#k9x2») restano UN pezzo. Il testo
--    corto combacia solo se le sue parole compaiono di fila in quello
--    lungo **cominciando e finendo sul bordo di un pezzo**. Quindi:
--      · «Test» non sta dentro «TEST-AUTO» (finirebbe a meta' pezzo);
--      · «F24» non sta dentro «F24-bis»; «IVA» non sta dentro «arrivano»;
--      · «IVA» sta dentro «pagare l'IVA di settembre» (parola intera);
--      · «Check-up caldaia» sta dentro «il check-up della caldaia» (col
--        gradino senza articoli, come prima).
--
-- ⚠️ NESSUNA SOGLIA DI LUNGHEZZA NUOVA, e non per prudenza: una soglia
--    toglie anche i titoli brevi giusti («IVA», «TARI», «F24»). La verifica
--    qui sotto contiene i casi che una soglia romperebbe.
--
-- ⚠️ COSA NON CAMBIA, apposta:
--      · gradino 1 (parola per parola) e gradino 2 (senza articoli e
--        preposizioni): identici;
--      · la soglia di tre lettere sulla frase detta: identica;
--      · la scala e il «non si sceglie fra pari» di chi chiama
--        (`voce_risolvi_dati`, #58): la funzione continua a ELENCARE, e chi
--        chiama esegue solo se sul gradino migliore ne resta uno;
--      · un appunto senza candidati resta non approvabile, come prima
--        (`agenda_quale_impegno`, «non l'ho trovato fra quelli aperti»):
--        il falso abbinamento diventa un «da chiarire», mai uno
--        spostamento o una chiusura proposti;
--      · niente si scrive in Agenda senza l'approvazione esplicita.
--
-- ⚠️ IL PREZZO, dichiarato: un FRAMMENTO di un pezzo col trattino non
--    combacia piu' al terzo gradino («up caldaia» contro «Check-up
--    caldaia»). Il pezzo intero e le parole intere continuano a combaciare,
--    e il titolo detto uguale resta al gradino 1.
--
-- ⚠️ IL CORPO DI `impegni_compatibili` viene dall'ultima migrazione che la
--    definisce (20260909000003), NON dal database: il mandato del 13/09
--    vieta di leggere i database condivisi. Prima di applicarla al progetto
--    di prova va confrontato col corpo vivo (`npm run funzione:viva --
--    impegni_compatibili --prova`), come vuole la regola del 18/08.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. Il testo diviso nei pezzi che chi l'ha scritto ha separato davvero
-- ---------------------------------------------------------------------------
-- ⚠️ SI RIUSA `voce_titolo_nudo` SU OGNI PEZZO, invece di ricopiarne gli
--    accenti e le minuscole: se un giorno quella cambia, questa la segue.
--    Dentro un pezzo le parole restano unite da «+», fra un pezzo e l'altro
--    c'e' uno spazio: «TEST-AUTO scelta#k9x2 commercialistax» diventa
--    «test+auto scelta+k9x2 commercialistax».
-- ⚠️ I SEPARATORI SONO UN ELENCO, non «tutto cio' che non e' una lettera»:
--    trattino, cancelletto, barra, trattino basso e punto NON ci sono, ed
--    e' esattamente questo che tiene insieme un codice.
create or replace function voce_titolo_segnato(p_testo text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(string_agg(replace(g.nudo, ' ', '+'), ' ' order by g.pos), '')
    from (
      select voce_titolo_nudo(p.pezzo) as nudo, p.pos
        from regexp_split_to_table(
               coalesce(p_testo, ''),
               '[][[:space:],;:!?"«»(){}''’‘`—–]+')
             with ordinality as p(pezzo, pos)
    ) g
   where g.nudo is not null;
$$;
comment on function voce_titolo_segnato(text) is
  'Il testo di un impegno o di una frase detta, diviso nei pezzi che chi l''ha scritto ha separato davvero: dentro un pezzo le parole sono unite da «+» («TEST-AUTO» diventa «test+auto»), fra i pezzi c''e'' uno spazio. Serve perche'' un pezzo di un codice non combaci come se fosse una parola.';

-- ---------------------------------------------------------------------------
-- 2. Lo stesso, senza articoli e preposizioni
-- ---------------------------------------------------------------------------
-- ⚠️ SI TOLGONO SOLO I PEZZI FATTI DI UNA PAROLA VUOTA, mai una parola
--    dentro un pezzo: «Check-in» e' un pezzo solo, e togliergli «in»
--    lascerebbe «check», che combacerebbe con cose che non c'entrano.
-- ⚠️ QUALI SONO LE PAROLE VUOTE lo decide `voce_titolo_essenziale`, che ha
--    l'elenco: una parola da sola che quella riduce a niente e' vuota. Un
--    elenco solo, in un posto solo.
create or replace function voce_titolo_segnato_essenziale(p_testo text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(string_agg(g.pezzo, ' ' order by g.pos), '')
    from unnest(string_to_array(voce_titolo_segnato(p_testo), ' '))
         with ordinality as g(pezzo, pos)
   where g.pezzo like '%+%'
      or voce_titolo_essenziale(g.pezzo) is not null;
$$;
comment on function voce_titolo_segnato_essenziale(text) is
  'Come voce_titolo_segnato, senza i pezzi fatti di un solo articolo o una sola preposizione. Una parola dentro un pezzo col trattino non si toglie mai.';

-- ---------------------------------------------------------------------------
-- 3. Il corto sta dentro il lungo a parole e pezzi interi?
-- ---------------------------------------------------------------------------
-- ⚠️ LE PAROLE DEL CORTO devono comparire di fila nel lungo; fra l'una e
--    l'altra va bene sia uno spazio sia un «+» (così «check up» detto
--    staccato combacia con «Check-up»), ma il primo e l'ultimo devono stare
--    sul BORDO di un pezzo: prima un inizio o uno spazio, dopo uno spazio o
--    una fine — mai un «+», che vorrebbe dire «a meta' pezzo».
-- ⚠️ RICEVE SOLO TESTI GIA' SEGNATI: le parole sono fatte di sole lettere e
--    cifre (lo garantisce `voce_titolo_nudo`), quindi entrano nel modello
--    senza nessun carattere speciale. Un vuoto non combacia con niente.
create or replace function voce_contiene_parole(p_lungo text, p_corto text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    p_lungo ~ ('(^| )' ||
               array_to_string(regexp_split_to_array(p_corto, '[ +]'), '[ +]') ||
               '( |$)'),
    false);
$$;
comment on function voce_contiene_parole(text, text) is
  'Vero se le parole del testo corto compaiono di fila in quello lungo cominciando e finendo sul bordo di un pezzo (testi segnati da voce_titolo_segnato). Un vuoto non combacia con niente.';

-- ---------------------------------------------------------------------------
-- 4. Quanto un titolo combacia con quello che e' stato detto
-- ---------------------------------------------------------------------------
-- ⚠️ E' LA SCALA DI `impegni_compatibili` TOLTA DALLA TABELLA, e per una
--    ragione sola: cosi' la regola si prova coi testi, senza scrivere
--    nessuna riga in Agenda — la verifica qui sotto non tocca un impegno.
--    Gradini 1 e 2 e soglia di tre lettere sono gli stessi di prima, riga
--    per riga; cambia solo il 3.
create or replace function voce_grado_compatibile(p_detto text, p_titolo text)
returns smallint
language sql
immutable
set search_path = public
as $$
  with x as (
    select voce_titolo_nudo(p_detto)                 as n,
           voce_titolo_essenziale(p_detto)           as e,
           voce_titolo_segnato(p_detto)              as ns,
           voce_titolo_segnato_essenziale(p_detto)   as es,
           voce_titolo_nudo(p_titolo)                as tn,
           voce_titolo_essenziale(p_titolo)          as te,
           voce_titolo_segnato(p_titolo)             as tns,
           voce_titolo_segnato_essenziale(p_titolo)  as tes
  )
  select (case
            when length(coalesce(x.n, '')) < 3 then null
            when x.tn = x.n then 1
            when x.e is not null and length(x.e) >= 3
             and x.te is not null and length(x.te) >= 3
             and x.te = x.e then 2
            when voce_contiene_parole(x.tns, x.ns)
              or voce_contiene_parole(x.ns, x.tns)
              or (x.e is not null and length(x.e) >= 3
                  and x.te is not null and length(x.te) >= 3
                  and (voce_contiene_parole(x.tes, x.es)
                       or voce_contiene_parole(x.es, x.tes))) then 3
          end)::smallint
    from x;
$$;
comment on function voce_grado_compatibile(text, text) is
  'Quanto un titolo combacia con quello che e'' stato detto: 1 parola per parola, 2 le stesse parole senza articoli e preposizioni, 3 uno contiene l''altro a parole e pezzi interi, vuoto se non combacia. Sotto le tre lettere dette non combacia niente.';

-- ---------------------------------------------------------------------------
-- 5. Quali impegni aperti potrebbero essere quello che ha detto
-- ---------------------------------------------------------------------------
-- ⚠️ STESSA FIRMA, STESSO ORDINE, STESSI PERMESSI: `create or replace` con
--    le stesse colonne di ritorno non tocca i permessi, quindi qui NON c'e'
--    nessun `grant` (trappola del 24 e del 27/08) e nessun `drop`.
-- rete-guardie: impegni_compatibili — le chiamate a voce_titolo_nudo e voce_titolo_essenziale si spostano dentro voce_grado_compatibile, che le fa entrambe: la regola e' la stessa, cambia solo dove vive
create or replace function impegni_compatibili(p_testo text)
returns table (id uuid, title text, due_date date, grado smallint)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.title, t.due_date, g.grado
    from tasks t
         cross join lateral (select voce_grado_compatibile(p_testo, t.title) as grado) g
   where t.status <> 'completato'
     and g.grado is not null
   order by g.grado, t.due_date nulls last, t.created_at;
$$;
comment on function impegni_compatibili(text) is
  'Gli impegni APERTI che potrebbero essere quello nominato a voce, ognuno col GRADO di quanto combacia (voce_grado_compatibile): 1 parola per parola, 2 senza articoli e preposizioni, 3 uno contiene l''altro a parole e pezzi interi. Non sceglie: chi chiama guarda il gradino migliore ed esegue solo se li'' dentro ne e'' rimasto uno.';

-- ⚠️ Non sono di nessuno, come le altre traduttrici della voce: ci si arriva
--    solo da dentro il database.
revoke all on function voce_titolo_segnato(text) from public, anon, authenticated;
revoke all on function voce_titolo_segnato_essenziale(text) from public, anon, authenticated;
revoke all on function voce_contiene_parole(text, text) from public, anon, authenticated;
revoke all on function voce_grado_compatibile(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICA — nessuna riga scritta: la regola si prova sui testi
-- ---------------------------------------------------------------------------
-- ⚠️ OGNI CASO E' UNA DOMANDA A CUI `impegni_compatibili` RISPONDE: fra i
--    titoli dati, quali stanno sul gradino migliore. E' la stessa cosa che
--    guarda chi chiama, quindi un caso rosso qui e' un appunto sbagliato
--    in Agenda. Si nominano TUTTI i casi rossi, non il primo.
do $verifica$
declare
  r          record;
  v_min      smallint;
  v_ottenuti text[];
  v_attesi   text[];
  v_rossi    text[] := '{}';
  v_n        integer := 0;
  v_fn       text;
begin
  for r in
    select * from (values
      -- casi:inizio
      ('test_dentro_test_auto', 'TEST-AUTO#k9x2 commercialistax',
        array['Test'], array[]::text[]),
      ('il_caso_vero_due_candidati_e_test', 'TEST-AUTO scelta#k9x2 commercialistax',
        array['TEST-AUTO scelta#k9x2 commercialistax andarex', 'TEST-AUTO scelta#k9x2 commercialistax passarex', 'Test'],
        array['TEST-AUTO scelta#k9x2 commercialistax andarex', 'TEST-AUTO scelta#k9x2 commercialistax passarex']),
      ('detto_breve_dentro_un_prefisso_tecnico', 'test',
        array['TEST-AUTO riunione'], array[]::text[]),
      ('codice_dentro_un_codice_piu_lungo', 'F24-bis di settembre',
        array['F24'], array[]::text[]),
      ('titolo_dentro_una_parola_piu_lunga', 'pagare le partenze',
        array['Arte'], array[]::text[]),
      ('sigla_dentro_una_parola_piu_lunga', 'arrivano le casse',
        array['IVA'], array[]::text[]),
      ('titolo_breve_detto_da_solo', 'IVA',
        array['IVA', 'Test', 'Arte'], array['IVA']),
      ('titolo_breve_in_una_frase', 'pagare l''IVA di settembre',
        array['IVA'], array['IVA']),
      ('titolo_breve_con_una_trappola_accanto', 'IVA del testo unico',
        array['IVA', 'Test'], array['IVA']),
      ('titolo_composto', 'rinnovo della firma digitale',
        array['Rinnovo firma digitale', 'Comprare la carta'], array['Rinnovo firma digitale']),
      ('titolo_composto_con_una_trappola_accanto', 'rinnovo della firma digitale per la partenza',
        array['Rinnovo firma digitale', 'Arte'], array['Rinnovo firma digitale']),
      ('titolo_col_trattino_detto_uguale', 'check up caldaia',
        array['Check-up caldaia'], array['Check-up caldaia']),
      ('titolo_col_trattino_dentro_una_frase', 'fare il check-up della caldaia',
        array['Check-up caldaia'], array['Check-up caldaia']),
      ('parola_intera_di_un_titolo_col_trattino', 'caldaia',
        array['Check-up caldaia'], array['Check-up caldaia']),
      ('trattino_detto_staccato', 'check up',
        array['Check-up caldaia'], array['Check-up caldaia']),
      -- ⚠️ SIGLE COI PUNTI E CODICI: un pezzo tenuto insieme da punti o
      --    trattini resta uno, quindi non si spezza in lettere e non combacia
      --    con un codice diverso che ne e' solo l'inizio.
      ('srl_detta_con_i_punti', 'assemblea della S.r.l.',
        array['Assemblea S.r.l.', 'Assemblea condominio'], array['Assemblea S.r.l.']),
      ('srl_dentro_una_frase', 'pagare il notaio per la S.r.l.',
        array['Notaio S.r.l.'], array['Notaio S.r.l.']),
      ('una_lettera_dentro_una_sigla_coi_punti', 'pagare la S.r.l.',
        array['R'], array[]::text[]),
      ('f24_detto_uguale', 'F24',
        array['F24'], array['F24']),
      ('f24_in_una_frase', 'pagare l''F24 di giugno',
        array['F24', 'F24-bis'], array['F24']),
      ('codice_col_trattino_detto_intero', 'F24-bis',
        array['F24', 'F24-bis'], array['F24-bis']),
      ('codice_col_trattino_in_una_frase', 'pagare F24-bis entro venerdì',
        array['F24-bis', 'F24'], array['F24-bis']),
      ('codice_dentro_un_codice_col_punto', 'modello 730.1 integrativo',
        array['730'], array[]::text[]),
      ('codice_col_punto_detto_intero', 'modello 730.1',
        array['730', 'Modello 730.1'], array['Modello 730.1']),
      -- ⚠️ IL PREZZO DICHIARATO, scritto come caso perche' non sia una frase:
      --    un frammento di un pezzo col trattino non combacia piu'.
      ('prezzo_frammento_di_un_pezzo_col_trattino', 'up caldaia',
        array['Check-up caldaia'], array[]::text[]),
      ('due_candidati_veri', 'commercialista',
        array['Andare dal commercialista', 'Chiamare il commercialista'],
        array['Andare dal commercialista', 'Chiamare il commercialista']),
      ('nessun_candidato_con_trappole', 'TEST-AUTO xilofonox marmellatox',
        array['Test', 'Arte', 'IVA'], array[]::text[]),
      ('nessun_candidato', 'xilofono',
        array['Comprare la carta'], array[]::text[]),
      ('app_variante_naturale', 'TEST-AUTO agenda3#k9 rinnovo della firmax digitalex',
        array['TEST-AUTO agenda3#k9 Rinnovo firmax digitalex', 'TEST-AUTO agenda3#k9 Comprare la cartax fornox'],
        array['TEST-AUTO agenda3#k9 Rinnovo firmax digitalex']),
      ('app_maiuscole_e_punteggiatura', 'TEST-AUTO AGENDA3#K9,  VERIFICA   del CAFFE!! zorbax.',
        array['TEST-AUTO agenda3#k9 Verifica caffè zorbax'],
        array['TEST-AUTO agenda3#k9 Verifica caffè zorbax']),
      ('app_due_pari', 'TEST-AUTO agenda3#k9 ordinex di verdurax',
        array['TEST-AUTO agenda3#k9 Ordinex verdurax', 'TEST-AUTO agenda3#k9 Ordinex delle verdurax'],
        array['TEST-AUTO agenda3#k9 Ordinex verdurax', 'TEST-AUTO agenda3#k9 Ordinex delle verdurax']),
      ('app_esatto_vince', 'TEST-AUTO agenda3#k9 Panex kalox',
        array['TEST-AUTO agenda3#k9 Panex kalox', 'TEST-AUTO agenda3#k9 Panex kalox e lattex'],
        array['TEST-AUTO agenda3#k9 Panex kalox']),
      ('app_spostare_con_la_variante', 'TEST-AUTO agenda3#k9 la consegnax di vimox',
        array['TEST-AUTO agenda3#k9 Consegnax vimox', 'TEST-AUTO agenda3#k9 Consegnax panex'],
        array['TEST-AUTO agenda3#k9 Consegnax vimox']),
      ('app_proposto_e_somigliante', 'TEST-AUTO agenda3#k9 Revisionex cappax',
        array['TEST-AUTO agenda3#k9 Revisionex cappax', 'TEST-AUTO agenda3#k9 Revisionex della cappax'],
        array['TEST-AUTO agenda3#k9 Revisionex cappax']),
      ('app_scelta_due_candidati', 'TEST-AUTO scelta#k9 commercialistax',
        array['TEST-AUTO scelta#k9 commercialistax andarex', 'TEST-AUTO scelta#k9 commercialistax passarex'],
        array['TEST-AUTO scelta#k9 commercialistax andarex', 'TEST-AUTO scelta#k9 commercialistax passarex'])
      -- casi:fine
    ) as c(caso, detto, titoli, attesi)
  loop
    v_n := v_n + 1;
    select min(voce_grado_compatibile(r.detto, t)) into v_min from unnest(r.titoli) t;
    select coalesce(array_agg(t order by t), '{}') into v_ottenuti
      from unnest(r.titoli) t
     where voce_grado_compatibile(r.detto, t) is not distinct from v_min
       and v_min is not null;
    select coalesce(array_agg(a order by a), '{}') into v_attesi from unnest(r.attesi) a;
    if v_ottenuti is distinct from v_attesi then
      v_rossi := v_rossi || format('%s (attesi %s, ottenuti %s)', r.caso, v_attesi, v_ottenuti);
    end if;
  end loop;
  if coalesce(array_length(v_rossi, 1), 0) > 0 then
    raise exception 'Il riconoscimento degli impegni non da'' i candidati attesi in % casi su %: %',
      array_length(v_rossi, 1), v_n, array_to_string(v_rossi, ' · ');
  end if;

  -- ⚠️ Si puo' correggere l'aiuto e lasciare il chiamante com'era: la
  --    verifica passerebbe e il difetto resterebbe vivo (lezione del 13/08).
  if pg_get_functiondef('impegni_compatibili(text)'::regprocedure) not like '%voce_grado_compatibile%' then
    raise exception 'impegni_compatibili non usa voce_grado_compatibile: la regola nuova non e'' collegata';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = 'impegni_compatibili(text)'::regprocedure) then
    raise exception 'impegni_compatibili ha perso security definer: dallo staff non vedrebbe gli impegni';
  end if;
  foreach v_fn in array array['voce_titolo_segnato(text)', 'voce_titolo_segnato_essenziale(text)',
                              'voce_contiene_parole(text,text)', 'voce_grado_compatibile(text,text)',
                              'impegni_compatibili(text)'] loop
    if has_function_privilege('anon', v_fn, 'execute')
       or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception '% e'' eseguibile dal browser: doveva restare chiusa', v_fn;
    end if;
  end loop;

  raise notice 'MEMO: % casi di riconoscimento come attesi; un titolo breve non combacia piu'' dentro un pezzo di parola o di codice.', v_n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260913000001', 'un_titolo_breve_non_combacia_per_caso') on conflict (version) do nothing;
