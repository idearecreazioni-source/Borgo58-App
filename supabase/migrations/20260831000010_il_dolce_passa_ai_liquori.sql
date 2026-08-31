-- =====================================================================
-- «DOLCE E DA MEDITAZIONE» PASSA AI LIQUORI — 31/08/2026
-- =====================================================================
--
-- 🔴 CORREZIONE DI ALESSIO su una mia proposta. Le categorie di Vini e
-- Liquori erano nate il 31/08 come **proposta da correggere leggendo** — il
-- precedente e' del 29/08 sui materiali, dove aveva chiesto lui di
-- proporgliele. Le ha guardate, e ne sposta una.
--
-- Risultato voluto, parole sue:
--   Vini                  → Rosso · Bianco · Rosato · Bollicine
--   Liquori e distillati  → Amari · Distillati · Liquori dolci ·
--                           Dolce e da meditazione
--
-- ⚠️ SI SPOSTA, NON SI DISTRUGGE (regola del 27/08). Cambiano **mondo e
-- ordine**, non il codice: il codice e' l'identificativo con cui i prodotti
-- puntano alla categoria, e cambiarlo vorrebbe dire cancellarla e ricrearne
-- una nuova — cioe' orfanare tutto quello che la porta.
-- ⚠️ **Misurato prima**: oggi la portano **zero prodotti**, quindi lo
-- spostamento non tocca niente di scritto. Ma la forma resta quella giusta
-- anche per il giorno in cui ce ne saranno, che e' precisamente il motivo
-- per cui la regola esiste.
--
-- ⚠️ E IL CODICE RESTA `vino_dolce` DENTRO IL MONDO DEI LIQUORI, che a
-- leggerlo fra sei mesi sembra un errore e non lo e': un codice e' un
-- identificativo, non una descrizione. Sta scritto qui perche' nessuno lo
-- «raddrizzi» credendo di sistemare qualcosa.
--
-- ⚠️ L'ORDINE lo mette **in fondo ai liquori** (430, dopo il 420 di «Liquori
-- dolci»): e' l'ordine in cui Alessio li ha elencati, e in questo progetto
-- l'ordine di un elenco e' un suo dato — *un elemento che si sposta da solo
-- e' un elemento che si cerca due volte*.

do $sposta$
declare v_prima text; v_quanti integer;
begin
  select mondo into v_prima from categorie_ingrediente where codice = 'vino_dolce';
  if v_prima is null then
    raise exception 'La categoria «vino_dolce» non esiste: niente da spostare.';
  end if;

  update categorie_ingrediente
     set mondo = 'liquori', ordine = 430
   where codice = 'vino_dolce';
  get diagnostics v_quanti = row_count;

  -- ⚠️ La sanatoria dichiara quante righe tocca (regola del 16/08): uno zero
  --    non e' un errore — vuol dire «gia' fatto» — ma va detto.
  raise notice 'Spostata da «%» a «liquori»: % riga.', v_prima, v_quanti;
end $sposta$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare v_vini integer; v_liq integer; v_mondo text; v_ordine integer; v_persi integer;
begin
  select mondo, ordine into v_mondo, v_ordine
    from categorie_ingrediente where codice = 'vino_dolce';
  -- ⚠️ `is distinct from` e non `<>`: contro un valore che puo' essere vuoto
  --    un `<>` vale NULL e l'if NON entra, cioe' approverebbe la rottura che
  --    deve prendere (trappola del 27/08).
  if v_mondo is distinct from 'liquori' then
    raise exception '«Dolce e da meditazione» sta in «%», doveva passare ai liquori',
      coalesce(v_mondo, '(vuoto)');
  end if;
  if v_ordine is distinct from 430 then
    raise exception 'L''ordine e'' %, doveva essere 430 — in fondo ai liquori',
      coalesce(v_ordine::text, '(vuoto)');
  end if;

  -- I due conti che Alessio ha chiesto di vedere.
  select count(*) into v_vini from categorie_ingrediente where mondo = 'vini';
  select count(*) into v_liq  from categorie_ingrediente where mondo = 'liquori';
  if v_vini <> 4 then
    raise exception 'Il mondo Vini ha % categorie, dovevano essere 4', v_vini;
  end if;
  if v_liq <> 4 then
    raise exception 'Il mondo Liquori ha % categorie, dovevano essere 4', v_liq;
  end if;

  -- 🔴 E NIENTE E' STATO DISTRUTTO: la categoria e' ancora **legale** per i
  --    prodotti che la portano. Se fosse stata cancellata e ricreata con un
  --    codice nuovo, quelli sarebbero rimasti orfani — e oggi sono zero,
  --    quindi il difetto sarebbe passato inosservato fino al giorno in cui
  --    non lo sono piu'.
  select count(*) into v_persi
    from ingredients i
    left join categorie_ingrediente c on c.codice = i.category
   where c.codice is null;
  if v_persi <> 0 then
    raise exception '% prodotti puntano a una categoria che non esiste piu''', v_persi;
  end if;

  raise notice 'Fatto: Vini 4, Liquori 4, nessun prodotto orfano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000010', 'il_dolce_passa_ai_liquori') on conflict (version) do nothing;
