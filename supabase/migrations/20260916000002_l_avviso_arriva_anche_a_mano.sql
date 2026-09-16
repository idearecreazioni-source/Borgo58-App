-- =====================================================================
-- L'AVVISO TELEGRAM ARRIVA ANCHE A «FALLO A MANO» — 16/09/2026
-- =====================================================================
-- 🔴 IL DIFETTO, visto usando MEMO. Un appunto vocale capisce quattro cose
--    distinte: QUANDO SUCCEDE l'impegno (`data`, `ora`) e QUANDO AVVISARE
--    (`avviso_data`, `avviso_ora`). Approvando l'appunto arrivano tutte e
--    quattro. Scegliendo «Fallo a mano», invece, il modulo dell'Agenda si
--    apriva con titolo, descrizione, giorno e ora dell'impegno e i campi del
--    Promemoria Telegram **vuoti** — e poi «Fallo a mano» chiude l'appunto
--    lo stesso.
--    ⚠️ Quindi la notifica spariva SENZA NESSUN ERRORE: nessuna riga rossa,
--       nessun avviso, e chi salvava credeva di avere il promemoria. È la
--       famiglia dei difetti silenziosi di questo progetto — il valore che
--       non arriva e nessuno lo dice.
--
-- 🔴 PERCHÉ SERVE UNA MIGRAZIONE E NON BASTA IL BROWSER: quali campi
--    arrivano al modulo NON lo decide la schermata, lo decide questa
--    funzione. È scritto nel telaio stesso (`src/lib/daVoce.js`): *«quello
--    che questo file non decide: dove si va e quali campi. Vive nel
--    database, perché è l'unico posto da cui una verifica può accorgersi
--    che un tipo nuovo è rimasto senza via d'uscita»*. Il client riceve
--    `azione_campi()` e nient'altro: senza queste due righe, non ha modo di
--    conoscere l'avviso.
--
-- ⚠️ COSA CAMBIA, ESATTAMENTE: due chiavi in più nel solo ramo
--    «promemoria». Nient'altro. Gli altri undici rami sono ricopiati
--    identici — `create or replace` vuole il corpo intero, e riscriverne
--    uno monco cancellerebbe i rami non ricopiati.
--
-- ⚠️ NON TOCCA NESSUNA TABELLA E NESSUNA RIGA: `azione_campi` è una
--    funzione di sola lettura (`stable`) che trasforma un jsonb in un altro
--    jsonb. Nessun `insert`, nessun `update`, nessun `delete`, nessuna
--    colonna nuova, nessun permesso nuovo (i `grant` stanno dalla
--    20260827000012 e non si toccano).
--
-- ⚠️ IL LIMITE, DICHIARATO: il corpo qui sotto è ripreso dall'ultima
--    migrazione che l'ha definita (20260911000001), non dal corpo VIVO del
--    database — da qui il database non si può interrogare. La regola del
--    progetto dice che una funzione si riscrive dal corpo vivo: **prima di
--    applicare questa migrazione va confrontata** con
--    `npm run funzione:viva azione_campi -- --prova`. Se il corpo vivo
--    avesse qualcosa in più, va riportato qui.

-- ----------------------------------------------------------------------------
-- 1. La funzione, col ramo «promemoria» completo
-- ----------------------------------------------------------------------------

create or replace function public.azione_campi(p_tipo text, p_dati jsonb)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(
    case p_tipo
      when 'giacenza' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto', nullif(p_dati->>'ingredient_id', ''),
        'quanto',   nullif(p_dati->>'quanto_ce', ''),
        'note',     nullif(p_dati->>'note', '')))

      when 'temperatura' then jsonb_strip_nulls(jsonb_build_object(
        'attrezzatura', nullif(p_dati->>'equipment_id', ''),
        'gradi',        nullif(p_dati->>'gradi', ''),
        'note',         nullif(p_dati->>'note', '')))

      when 'promemoria' then jsonb_strip_nulls(jsonb_build_object(
        'titolo',      nullif(p_dati->>'titolo', ''),
        'descrizione', nullif(p_dati->>'descrizione', ''),
        'scadenza',    nullif(p_dati->>'data', ''),
        -- L'ora dell'impegno arriva al modulo a mano (11/09/2026).
        'ora',         nullif(p_dati->>'ora', ''),
        -- 🔴 E DAL 16/09 ANCHE L'AVVISO. Sono l'altra coppia di date, e non
        --    vanno confuse con le due qui sopra: `scadenza`/`ora` dicono
        --    quando succede la cosa, queste quando avvisare — quasi sempre
        --    un altro giorno.
        -- ⚠️ `jsonb_strip_nulls` le toglie quando non ci sono, quindi
        --    «nessun avviso chiesto» resta «nessun campo», e il modulo non
        --    riempie niente. Un avviso non chiesto non deve comparire.
        'avviso_data', nullif(p_dati->>'avviso_data', ''),
        'avviso_ora',  nullif(p_dati->>'avviso_ora', ''),
        'priorita',    valore_del_vocabolario('tasks', 'priority', p_dati->>'priorita'),
        'categoria',   valore_del_vocabolario('tasks', 'category', p_dati->>'categoria')))

      when 'pulizia' then jsonb_strip_nulls(jsonb_build_object(
        'compito', nullif(p_dati->>'task_id', ''),
        'note',    nullif(p_dati->>'note', '')))

      when 'lista_spesa' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto',  nullif(p_dati->>'ingredient_id', ''),
        'nome',      nullif(p_dati->>'nome_libero', ''),
        'quantita',  nullif(p_dati->>'quantita', ''),
        'unita',     valore_del_vocabolario('shopping_list_items', 'unit', p_dati->>'unita'),
        'note',      nullif(p_dati->>'note', '')))

      -- ⚠️ Niente quantità e niente unità: la spesa spicciola non le ha.
      --    Un campo che la schermata non possiede resterebbe lì a non
      --    riempire niente.
      -- ⚠️ E NEMMENO LA NOTA, per la stessa ragione e con un prezzo che va
      --    detto: la schermata della spesa spicciola ha due campi soli,
      --    cosa serve e la categoria. La nota detta resta nell'appunto e
      --    viene scritta quando lo si APPROVA — è la via normale. A perdersi
      --    è solo se si sceglie di finire a mano, e allora è meglio saperlo
      --    che ritrovarsela scritta in un campo che non si vede.
      when 'spesa_spicciola' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome_libero', ''),
        'categoria', nullif(p_dati->>'categoria', '')))

      when 'merce_buttata' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto', nullif(p_dati->>'ingredient_id', ''),
        'quantita', nullif(p_dati->>'quantita', ''),
        -- ⚠️ Il motivo e' fissato: questo tipo di azione E' lo spreco. Non
        --    e' un valore indovinato, e' cio' che l'azione significa — e
        --    passa dal vocabolario come tutti gli altri, cosi' se un giorno
        --    quell'elenco cambiasse questo campo tacerebbe invece di
        --    scrivere un motivo che non esiste piu'.
        'motivo',   valore_del_vocabolario('stock_consumptions', 'reason', 'spreco'),
        'note',     nullif(p_dati->>'note', '')))

      -- ⚠️ NIENTE CAUSALE E NIENTE MEZZO: sulla tasca la causale non si
      --    salva (SPEC-0005 — il menu non c'e', quello che si vede e'
      --    «Indeducibile», che e' la regola fiscale e la scrive il
      --    database), e il mezzo e' il contante per definizione. Un campo
      --    che la schermata non offre resterebbe li' a non riempire niente.
      -- ⚠️ E NEMMENO IL VERSO: dalla tasca escono soldi e basta, e la
      --    schermata ci arriva gia' ferma su «uscita».
      when 'spesa_tasca' then jsonb_strip_nulls(jsonb_build_object(
        'importo',     nullif(p_dati->>'importo', ''),
        'descrizione', nullif(p_dati->>'descrizione', ''),
        'data',        nullif(p_dati->>'data', '')))

      when 'movimento_cassa' then jsonb_strip_nulls(jsonb_build_object(
        'verso',       valore_del_vocabolario('cash_movements', 'direction', p_dati->>'verso'),
        'importo',     nullif(p_dati->>'importo', ''),
        'data',        nullif(p_dati->>'data', ''),
        'causale',     nullif(p_dati->>'causale_id', ''),
        'mezzo',       valore_del_vocabolario('cash_movements', 'mezzo', p_dati->>'mezzo'),
        'descrizione', nullif(concat_ws(' · ',
          (select 'Fornitore: ' || s.name from suppliers s
            where s.id = nullif(p_dati->>'supplier_id', '')::uuid),
          nullif(p_dati->>'descrizione', '')), ''),
        'note',        nullif(p_dati->>'note', '')))

      when 'carico_merce' then jsonb_strip_nulls(jsonb_build_object(
        'prodotto',  nullif(p_dati->>'ingredient_id', ''),
        'quantita',  nullif(p_dati->>'quantita', ''),
        'fornitore', nullif(p_dati->>'supplier_id', ''),
        'scadenza',  nullif(p_dati->>'scadenza', ''),
        'costo',     nullif(p_dati->>'costo_unitario', ''),
        'lotto',     nullif(p_dati->>'lotto', ''),
        'note',      nullif(p_dati->>'note', '')))

      when 'prodotto_nuovo' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome', ''),
        'categoria', valore_del_vocabolario('ingredients', 'category', p_dati->>'categoria'),
        'unita',     valore_del_vocabolario('ingredients', 'unit', p_dati->>'unita')))

      when 'ricetta' then jsonb_strip_nulls(jsonb_build_object(
        'nome',      nullif(p_dati->>'nome', ''),
        'categoria', valore_del_vocabolario('recipes', 'category', p_dati->>'categoria'),
        'porzioni',  nullif(p_dati->>'porzioni', ''),
        'note',      nullif(p_dati->>'sentito', '')))

      else null
    end, '{}'::jsonb);
$function$;

comment on function public.azione_campi(text, jsonb) is
  'Quali campi gia'' capiti arrivano al modulo quando si finisce a mano una cosa detta a voce. Dal 16/09/2026 un promemoria porta anche il giorno e l''ora dell''AVVISO Telegram: prima si perdevano, e la notizia spariva senza nessun errore.';

-- ----------------------------------------------------------------------------
-- 2. La verifica
-- ----------------------------------------------------------------------------
-- ⚠️ NON SCRIVE NIENTE E NON LEGGE NESSUN DATO VERO: `azione_campi` è una
--    funzione pura sui suoi due argomenti, quindi la verifica le passa dei
--    jsonb inventati e guarda cosa risponde. Nessuna riga creata, nessuna da
--    ripulire, nessuna lapide nel registro delle cancellazioni.

do $verifica$
declare
  v_con  jsonb;
  v_senza jsonb;
  v_mezzo jsonb;
  v_cassa jsonb;
begin
  -- 1. L'avviso completo arriva, e non si confonde con le date dell'impegno.
  v_con := azione_campi('promemoria', jsonb_build_object(
    'titolo', 'Appuntamento in banca',
    'data', '2026-09-19', 'ora', '11:00',
    'avviso_data', '2026-09-18', 'avviso_ora', '15:00'));

  if v_con->>'avviso_data' is distinct from '2026-09-18'
     or v_con->>'avviso_ora' is distinct from '15:00' then
    raise exception 'Il giorno e l''ora dell''avviso non arrivano al modulo: %', v_con;
  end if;
  if v_con->>'scadenza' is distinct from '2026-09-19'
     or v_con->>'ora' is distinct from '11:00' then
    raise exception 'Le date dell''impegno si sono confuse con quelle dell''avviso: %', v_con;
  end if;

  -- 2. 🔴 NESSUN AVVISO CHIESTO = NESSUN CAMPO. Se comparissero vuoti, il
  --    modulo si aprirebbe con un promemoria che nessuno ha chiesto.
  v_senza := azione_campi('promemoria', jsonb_build_object(
    'titolo', 'Chiamare il tecnico', 'data', '2026-09-19'));
  if v_senza ? 'avviso_data' or v_senza ? 'avviso_ora' then
    raise exception 'Senza avviso chiesto sono comparsi lo stesso i campi della notifica: %', v_senza;
  end if;

  -- 3. Mezzo avviso: arriva il pezzo detto, e l'altro resta assente. Chi
  --    guarda vede cosa manca invece di trovarsi un'ora inventata.
  v_mezzo := azione_campi('promemoria', jsonb_build_object(
    'titolo', 'Ritirare le analisi', 'avviso_data', '2026-09-18'));
  if v_mezzo->>'avviso_data' is distinct from '2026-09-18' then
    raise exception 'Il giorno dell''avviso detto da solo non arriva: %', v_mezzo;
  end if;
  if v_mezzo ? 'avviso_ora' then
    raise exception 'L''ora dell''avviso non era stata detta e compare lo stesso: %', v_mezzo;
  end if;

  -- 4. ⚠️ GLI ALTRI RAMI NON SONO CAMBIATI. `create or replace` riscrive
  --    tutta la funzione: se uno fosse caduto nel ricopiarlo, la sua via
  --    d'uscita a mano smetterebbe di funzionare in silenzio.
  v_cassa := azione_campi('movimento_cassa', jsonb_build_object(
    'importo', '30', 'verso', 'uscita'));
  if v_cassa->>'importo' is distinct from '30' or v_cassa->>'verso' is distinct from 'uscita' then
    raise exception 'Il ramo della prima nota non risponde piu'' come prima: %', v_cassa;
  end if;
  if azione_campi('carico_merce', jsonb_build_object('quantita', '5'))->>'quantita' is distinct from '5' then
    raise exception 'Il ramo del carico merce e'' andato perso nella riscrittura.';
  end if;
  if azione_campi('ricetta', jsonb_build_object('nome', 'Caponata'))->>'nome' is distinct from 'Caponata' then
    raise exception 'Il ramo delle ricette e'' andato perso nella riscrittura.';
  end if;
  -- Un tipo che non ha campi resta senza campi, non diventa null.
  if azione_campi('nota_non_capita', '{}'::jsonb) is distinct from '{}'::jsonb then
    raise exception 'Un tipo senza campi non risponde piu'' con un oggetto vuoto.';
  end if;

  raise notice 'azione_campi: l''avviso Telegram arriva anche a mano, e senza avviso resta vuoto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260916000002', 'l_avviso_arriva_anche_a_mano') on conflict (version) do nothing;
