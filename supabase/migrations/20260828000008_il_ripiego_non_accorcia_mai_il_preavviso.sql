-- ============================================================================
-- 20260828000008 — il ripiego non accorcia mai il preavviso
-- ============================================================================
--
-- DECISIONE DI ALESSIO, 28/08/2026. Gli era stato proposto di sistemare a
-- mano i prodotti colpiti: ha rifiutato, e ha chiesto la correzione del
-- telaio. **Quando la durata manca, il calcolo del preavviso ripiega sul
-- valore PIU' PRUDENTE, mai sul piu' corto.**
--
-- COSA SUCCEDEVA, misurato sul progetto di prova il 28/08.
-- Tolta la durata dai prodotti comprati (28/08, `…004`), il ripiego e'
-- rimasto a decidere in base a DOVE si conserva: due giorni per il frigo,
-- quattordici per tutto il resto. Ma la conservazione da sola non sa
-- distinguere il pesce fresco — dove due giorni sono giusti — dal burro,
-- dal caciocavallo e dalla crema di pistacchio, che in frigo stanno mesi.
-- Era la durata a distinguerli, e la durata non c'e' piu'.
--
-- I numeri veri, prima di questa migrazione (133 prodotti sul progetto di
-- prova):
--   · 133 su 133 ripiegano — **nessuno** ha un preavviso scritto a mano;
--   ·  18 stanno in frigo e ricevevano il ripiego CORTO, due giorni;
--   · 115 ricevevano quattordici giorni.
-- Fra i diciotto: Burro, Caciocavallo ragusano, Crema di pistacchio.
--
-- ⚠️ PERCHE' IL VERSO CONTA, ed e' la ragione della decisione. Un preavviso
--    troppo LUNGO su un prodotto fresco e' un fastidio: lo si vede in
--    elenco prima del necessario. Un preavviso troppo CORTO su un prodotto
--    che dura mesi e' merce buttata, perche' quando compare e' gia' tardi.
--    I due errori non si pagano allo stesso prezzo, quindi il ripiego non
--    sta in mezzo: sta dalla parte che costa meno sbagliare.
--
-- ⚠️ E SUL GESTIONALE VERO PESA DI PIU', non di meno. Qui i prodotti sono
--    133 e finti; a marzo saranno centinaia e veri, e i piu' colpiti
--    sarebbero **freschi e latticini** — cioe' proprio quelli su cui una
--    segnalazione tardiva si butta.
--
-- COME E' SCRITTA, e perche' non e' semplicemente «metti 14».
-- Il ripiego resta espresso come una REGOLA e non come un numero: si
-- prende il PIU' LUNGO fra quello che la conservazione suggerirebbe e la
-- base prudente. Cosi' il giorno che qualcuno aggiungesse una conservazione
-- che ne chiede trenta, il calcolo prenderebbe trenta da solo — mentre
-- scrivere `14` e basta lo avrebbe accorciato in silenzio, che e'
-- esattamente il difetto che questa migrazione chiude.
--
-- ⚠️ Il numero scritto a mano da Alessio VINCE SEMPRE, anche se e' corto:
--    la prudenza e' il ripiego di chi non sa, non un tetto imposto a chi sa.
-- ============================================================================

create or replace function public.preavviso_giorni(
  p_esplicito integer,
  p_conservazione storage_type
)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select case
    -- Chi lo sa comanda: anche due giorni, se li ha scritti lui.
    when p_esplicito is not null and p_esplicito >= 0 then p_esplicito
    -- Nessuno l'ha detto. Non si sceglie in base a dove si conserva —
    -- quella scelta e' esattamente cio' che accorciava il preavviso — si
    -- prende il PIU' PRUDENTE fra i ripieghi possibili.
    else greatest(
      case when p_conservazione in ('frigo_0_4', 'frigo_4_8') then 2 else 14 end,
      14
    )
  end;
$function$;

comment on function public.preavviso_giorni(integer, storage_type) is
  'Quanti giorni prima della scadenza segnalare una partita. Il numero '
  'scritto da Alessio vince sempre. Senza, si RIPIEGA SUL PIU'' PRUDENTE e '
  'mai sul piu'' corto (decisione sua del 28/08/2026): un preavviso lungo su '
  'un prodotto fresco e'' un fastidio, uno corto su un prodotto che dura mesi '
  'e'' merce buttata, e i due errori non costano uguale.';

do $verifica$
declare
  v_foto  jsonb;
  v_corto integer;
  v_frigo integer;
  v_disp  integer;
  v_vuoto integer;
  v_n     integer;
begin
  v_foto := foto_righe();

  -- 1. Chi lo sa comanda, anche corto: la prudenza non e' un tetto.
  v_corto := preavviso_giorni(2, 'frigo_0_4');
  if v_corto <> 2 then
    raise exception 'Un preavviso scritto a mano non viene rispettato: % invece di 2', v_corto;
  end if;

  -- 2. IL CASO DEL DIFETTO: frigo senza numero scritto a mano.
  --    Prima rispondeva 2; deve rispondere 14.
  v_frigo := preavviso_giorni(null, 'frigo_4_8');
  if v_frigo <> 14 then
    raise exception 'Il ripiego del frigo accorcia ancora: % invece di 14', v_frigo;
  end if;

  -- 3. e 4. Gli altri non peggiorano.
  v_disp := preavviso_giorni(null, 'dispensa');
  v_vuoto := preavviso_giorni(null, null);
  if v_disp <> 14 or v_vuoto <> 14 then
    raise exception 'Il ripiego fuori dal frigo e'' cambiato: dispensa % / vuoto %', v_disp, v_vuoto;
  end if;

  -- 5. LA PROPRIETA', non i quattro casi: per NESSUNA conservazione
  --    esistente il ripiego puo' essere piu' corto della base prudente.
  --    Scritta cosi' perche' una conservazione nuova entri da sola nel
  --    controllo, invece di restare fuori finche' qualcuno se ne ricorda.
  select count(*) into v_n
    from unnest(enum_range(null::storage_type)) as c
   where preavviso_giorni(null, c) < 14;
  if v_n <> 0 then
    raise exception 'Ci sono % conservazioni il cui ripiego e'' piu'' corto della base prudente', v_n;
  end if;

  -- 6. E nessun prodotto vero ci rimette: chi ripiega non puo' ricevere
  --    meno di prima. Zero righe, o si nominano.
  select count(*) into v_n
    from ingredients
   where giorni_preavviso_scadenza is null
     and preavviso_giorni(giorni_preavviso_scadenza, storage_type) < 14;
  if v_n <> 0 then
    raise exception 'Ci sono % prodotti che ripiegano su un preavviso piu'' corto di 14', v_n;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'il ripiego del preavviso');

  raise notice 'Il ripiego non accorcia piu'' il preavviso: chi lo scrive a mano comanda, chi non lo scrive riceve il piu'' prudente.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000008', 'il_ripiego_non_accorcia_mai_il_preavviso')
on conflict (version) do nothing;
