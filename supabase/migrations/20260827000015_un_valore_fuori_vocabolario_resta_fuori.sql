-- ============================================================================
-- UN VALORE FUORI VOCABOLARIO RESTA FUORI — 27/08/2026
-- ============================================================================
--
-- 🔴 TROVATO APRENDO LA SCHERMATA, non rileggendo. Provando a mano il
--    promemoria dettato, la categoria è arrivata come `fisco` — che fra le
--    sei ammesse **non c'è**. Cosa è successo:
--      · a schermo il menu mostrava **`fisco_scadenze`**, cioè la prima
--        della lista, perché un `<select>` con un valore che non è fra le
--        sue opzioni mostra la prima;
--      · nel database è finito **`altro`**.
--    **Nessuno dei due è quello che era stato passato**, e nessuno dei due
--    l'ha scelto una persona. Nessun errore, da nessuna parte.
--
-- ⚠️ QUEL CASO L'AVEVO COSTRUITO IO col dato di prova, e va detto: il prompt
--    della voce per il promemoria **non chiede la categoria**, quindi da lì
--    non può arrivare. Ma **per altri campi la chiede eccome** — la
--    categoria di una ricetta, la categoria e l'unità di un prodotto nuovo,
--    l'unità di una riga di spesa, il verso e il mezzo di un movimento —
--    e un modello che risponde fuori elenco è la cosa più normale del mondo.
--
-- ----------------------------------------------------------------------------
-- PERCHÉ È PIÙ GRAVE SULLA VIA A MANO CHE SU QUELLA AUTOMATICA
-- ----------------------------------------------------------------------------
-- Via automatica (`fai_azione_dettata`) un valore storto **fa fallire**
-- l'azione contro il vincolo del database: rumoroso, visibile, e la riga
-- resta in attesa col suo errore accanto.
--
-- Via a mano diventa **silenzioso**: il modulo si riempie con un valore
-- plausibile che nessuno ha scelto, e chi salva non ha modo di accorgersene.
-- 🔴 *La strada che esiste per essere più sicura sarebbe diventata la più
-- pericolosa delle due.*
--
-- ----------------------------------------------------------------------------
-- LA CURA È LA REGOLA CHE `azione_campi` AVEVA GIÀ SCRITTA
-- ----------------------------------------------------------------------------
-- «Un campo che non si sa resta fuori, mai riempito con un valore
-- plausibile». Un valore fuori vocabolario **non si sa**: quindi resta
-- fuori, e il campo si apre col suo predefinito — che è un valore che il
-- modulo sceglie apertamente, non uno che sembra venire dalla voce.
--
-- ⚠️ E il controllo NON è un elenco scritto a mano: passa da
--    `vocabolari_chiusi()`, che si costruisce dai cataloghi e conosce sia i
--    tipi `enum` sia i vincoli `check` su una colonna sola. Un vocabolario
--    nuovo entra da solo, e una voce nuova non va aggiunta da nessuna parte.
--
-- ⚠️ **Sette dei nove campi interessati sono enum, due sono testo con
--    vincolo** (`cash_movements.mezzo`, `stock_consumptions.reason`) — più
--    `tasks.category`. Un controllo che coprisse solo gli enum lascerebbe
--    scoperto proprio il campo su cui il difetto è stato visto.
-- ============================================================================

create or replace function valore_del_vocabolario(
  p_tabella text, p_colonna text, p_valore text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- ⚠️ Se la colonna NON ha un vocabolario chiuso, il valore passa: qui non
  --    si inventa una validazione che il database non chiede. Si filtra solo
  --    dove il database stesso ha già detto quali valori esistono.
  select case
    when nullif(btrim(coalesce(p_valore, '')), '') is null then null
    when not exists (
      select 1 from vocabolari_chiusi() v
       where v.tabella = p_tabella and v.colonna = p_colonna)
      then p_valore
    when exists (
      select 1 from vocabolari_chiusi() v
       where v.tabella = p_tabella and v.colonna = p_colonna
         and p_valore = any(v.valori))
      then p_valore
    else null
  end;
$$;

comment on function valore_del_vocabolario(text, text, text) is
  'Il valore, se appartiene al vocabolario chiuso di quella colonna; altrimenti VUOTO. Serve a non riempire un campo con un valore che nessuno ha scelto: un `select` con un valore fuori elenco mostra la prima opzione, che e'' plausibile e falsa. Se la colonna non ha un vocabolario, il valore passa — qui non si inventa una regola che il database non ha.';

revoke all on function valore_del_vocabolario(text, text, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- `azione_campi` filtra i campi che hanno un vocabolario di destinazione
-- ----------------------------------------------------------------------------
-- ⚠️ La coppia tabella/colonna è quella dove quel campo va a finire DAVVERO
--    quando la schermata salva: `categoria` di una ricetta è
--    `recipes.category`, quella di un prodotto è `ingredients.category`.
--    Sono due vocabolari diversi, e confonderli filtrerebbe col metro
--    sbagliato.

create or replace function azione_campi(p_tipo text, p_dati jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
$$;

comment on function azione_campi(text, jsonb) is
  'Quello che il gestionale ha gia'' capito, tradotto nel vocabolario della SCHERMATA dove si va a finirlo a mano. ⚠️ NON E'' CONCESSA A NESSUNO: la chiama solo `azione_a_mano`, che ha il portiere. Legge `suppliers` per comporre la dicitura del fornitore. ⚠️ I campi con un vocabolario chiuso passano da `valore_del_vocabolario()`: un valore fuori elenco RESTA FUORI, perche'' un menu a tendina che riceve un valore che non ha mostra la PRIMA opzione — plausibile, e scelta da nessuno.';

revoke all on function azione_campi(text, jsonb) from public, anon, authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit uuid;
  v_ris jsonb;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: non c''e'' nessun titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ------------------------------------------------------------------
  -- 1. Il valore BUONO passa
  -- ------------------------------------------------------------------
  if valore_del_vocabolario('tasks', 'category', 'fisco_scadenze') <> 'fisco_scadenze' then
    raise exception 'Una categoria vera e'' stata scartata: il filtro e'' piu'' stretto del database.';
  end if;
  if valore_del_vocabolario('recipes', 'category', 'primo') <> 'primo' then
    raise exception 'Una categoria di ricetta vera e'' stata scartata.';
  end if;

  -- ------------------------------------------------------------------
  -- 2. 🔴 Il valore FUORI ELENCO resta fuori — il caso visto a schermo
  -- ------------------------------------------------------------------
  if valore_del_vocabolario('tasks', 'category', 'fisco') is not null then
    raise exception 'Una categoria che non esiste e'' passata: a schermo diventerebbe la prima della lista.';
  end if;
  if valore_del_vocabolario('recipes', 'category', 'contorno_inventato') is not null then
    raise exception 'Una categoria di ricetta inventata e'' passata.';
  end if;

  -- ------------------------------------------------------------------
  -- 3. Una colonna SENZA vocabolario lascia passare tutto
  -- ------------------------------------------------------------------
  -- ⚠️ Qui non si inventa una validazione che il database non chiede: il
  --    titolo di un promemoria e' testo libero e deve restare tale.
  if valore_del_vocabolario('tasks', 'title', 'Chiamare Laura') <> 'Chiamare Laura' then
    raise exception 'Un campo di testo libero e'' stato filtrato come se avesse un vocabolario.';
  end if;

  -- ------------------------------------------------------------------
  -- 4. E la funzione intera si comporta di conseguenza
  -- ------------------------------------------------------------------
  v_ris := azione_campi('promemoria', jsonb_build_object(
    'titolo', 'Chiamare il commercialista', 'categoria', 'fisco', 'priorita', 'alta'));
  if v_ris ? 'categoria' then
    raise exception 'La categoria fuori elenco e'' arrivata alla schermata: %', v_ris;
  end if;
  if v_ris->>'titolo' <> 'Chiamare il commercialista' then
    raise exception 'Il filtro ha portato via anche il titolo: %', v_ris;
  end if;
  -- ⚠️ `alta` E' una priorita' vera: deve passare, altrimenti il filtro
  --    starebbe scartando tutto invece che il solo valore storto.
  if v_ris->>'priorita' <> 'alta' then
    raise exception 'Una priorita'' vera e'' stata scartata: %', v_ris;
  end if;

  -- E il caso di Alessio continua a funzionare per intero.
  v_ris := azione_campi('movimento_cassa', jsonb_build_object(
    'verso', 'uscita', 'importo', '30', 'mezzo', 'cassa'));
  if v_ris->>'verso' <> 'uscita' or v_ris->>'mezzo' <> 'cassa' or v_ris->>'importo' <> '30' then
    raise exception 'Il movimento di cassa ha perso dei campi buoni: %', v_ris;
  end if;

  -- Lo spreco resta lo spreco.
  v_ris := azione_campi('merce_buttata', jsonb_build_object('quantita', '1.2'));
  if v_ris->>'motivo' <> 'spreco' then
    raise exception 'Il motivo dello scarico non e'' piu'' «spreco»: %', v_ris;
  end if;

  raise notice 'Un valore fuori vocabolario resta fuori; quelli veri passano tutti; i campi liberi non sono toccati.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000015', 'un_valore_fuori_vocabolario_resta_fuori') on conflict (version) do nothing;
