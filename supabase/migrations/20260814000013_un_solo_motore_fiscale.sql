-- ---------------------------------------------------------------------
-- Un solo motore fiscale — aliquote, agevolazioni e acconti in un posto
-- ---------------------------------------------------------------------
-- Blocco 3 del mandato «dal magazzino che scende alla rotta economica»,
-- primo pezzo. Vincolo architetturale del mandato, ratificato da Alessio
-- il 14/08/2026 scegliendo «assorbe»:
--
--   «UN SOLO MOTORE FISCALE: aliquote, basi e agevolazioni (IRES, IRAP,
--    maxi-deduzione, acconti) vivono in un posto solo, parametri
--    modificabili da Alessio dopo il confronto con Laura, e simulatore e
--    proiezione ci attingono entrambi. Due semplificazioni diverse che
--    danno due numeri diversi sono vietate per costruzione.»
--
-- PERCHÉ ASSORBE E NON AFFIANCA. Il Simulatore esiste dal 02/08 e calcola
-- già IRES e IRAP — ma in JavaScript, dentro la schermata. Se la
-- Proiezione si fosse costruita il proprio calcolo, il gestionale avrebbe
-- avuto **due conti diversi sulla stessa cosa**, e chi guarda non avrebbe
-- avuto modo di sapere quale credere. Da qui in avanti il calcolo sta in
-- questa funzione, e il Simulatore la interroga: resta il posto dove si
-- chiede «e se…», smette di essere un secondo motore. Deduzioni e
-- Catalogo strumenti restano dove sono — rispondono a domande diverse
-- (quali spese sono deducibili, quali agevolazioni esistono) e
-- alimentano la Proiezione invece di duplicarla.
--
-- ⚠️ COSA RESTA SEMPLIFICATO, DICHIARATO E NON NASCOSTO. L'IRAP continua
-- a essere calcolata sull'utile come l'IRES: è il rilievo 2 del referto
-- del 13/08, ancora aperto, e non si inventa una formula. La differenza
-- rispetto a prima è che **la frase che lo dice esce dalla funzione
-- insieme al numero**: prima viveva nel testo di una schermata, e una
-- seconda schermata avrebbe potuto mostrare lo stesso numero senza
-- l'avvertenza. Ora il numero e il suo limite viaggiano insieme.
--
-- ⚠️ SUI VALORI PREDEFINITI, dopo la lezione del 14/08 (una colonna nuova
-- `not null default` risponde al posto di chi non ha risposto). Letto col
-- connettore prima di scrivere: `fiscal_settings` ha **una riga sola**,
-- quella della S.r.l.s. Le colonne aggiunte qui non esistevano, quindi
-- nessun valore intenzionale viene sovrascritto. E dove «non l'ho ancora
-- deciso» è uno stato vero — la maxi-deduzione, che aspetta Laura — il
-- predefinito è **spenta**: un'agevolazione applicata da sola darebbe un
-- numero più basso del vero, sempre nella stessa direzione, che è il modo
-- di sbagliare che questo progetto continua a incontrare.
--
-- Idempotente (§7 punto 3).

-- =====================================================================
-- 1. I parametri: uno solo per ogni cosa, tutti suoi
-- =====================================================================
alter table fiscal_settings
  add column if not exists maxideduzione_attiva          boolean,
  add column if not exists maxideduzione_percento        numeric(5,2),
  add column if not exists acconto_percento              numeric(5,2),
  add column if not exists acconto_prima_rata_percento   numeric(5,2),
  add column if not exists acconto_soglia_minima         numeric(10,2),
  add column if not exists prima_scadenza_mese           smallint,
  add column if not exists prima_scadenza_giorno         smallint,
  add column if not exists seconda_scadenza_mese         smallint,
  add column if not exists seconda_scadenza_giorno       smallint,
  add column if not exists parametri_confermati_da_laura date;

-- I valori di partenza si scrivono UNA volta e solo dove la colonna è
-- ancora vuota: rieseguendo la migrazione non si sovrascrive ciò che
-- Alessio ha nel frattempo cambiato dopo aver parlato con Laura.
update fiscal_settings set
  maxideduzione_attiva        = coalesce(maxideduzione_attiva, false),
  maxideduzione_percento      = coalesce(maxideduzione_percento, 20.00),
  acconto_percento            = coalesce(acconto_percento, 100.00),
  acconto_prima_rata_percento = coalesce(acconto_prima_rata_percento, 40.00),
  acconto_soglia_minima       = coalesce(acconto_soglia_minima, 51.65),
  prima_scadenza_mese         = coalesce(prima_scadenza_mese, 6),
  prima_scadenza_giorno       = coalesce(prima_scadenza_giorno, 30),
  seconda_scadenza_mese       = coalesce(seconda_scadenza_mese, 11),
  seconda_scadenza_giorno     = coalesce(seconda_scadenza_giorno, 30);

-- ⚠️ E ORA IL VALORE PREDEFINITO, che è la metà che mancava — trovata
-- applicando sul progetto di prova, dove `fiscal_settings` è VUOTA
-- (quelle righe le crea Alessio dal Simulatore, non una migrazione).
-- Riempire solo le righe esistenti avrebbe funzionato benissimo in
-- produzione, dove la riga c'è, e avrebbe lasciato **senza parametri
-- ogni riga creata dopo**: l'azienda agricola quando nascerà, o un
-- ripristino da zero. Il calendario delle imposte non avrebbe dato un
-- errore — avrebbe restituito righe vuote, che è il modo peggiore.
--
-- Non è il default del 14/08 che risponde al posto di chi non ha
-- risposto: lì la colonna descriveva una scelta che l'utente aveva già
-- fatto in altro modo. Qui la scelta non esisteva, e il predefinito è
-- il punto di partenza dichiarato — che Alessio cambia dopo Laura.
alter table fiscal_settings
  alter column maxideduzione_attiva        set default false,
  alter column maxideduzione_percento      set default 20.00,
  alter column acconto_percento            set default 100.00,
  alter column acconto_prima_rata_percento set default 40.00,
  alter column acconto_soglia_minima       set default 51.65,
  alter column prima_scadenza_mese         set default 6,
  alter column prima_scadenza_giorno       set default 30,
  alter column seconda_scadenza_mese       set default 11,
  alter column seconda_scadenza_giorno     set default 30;

-- E il vincolo che lo tiene vero: una riga senza questi valori non deve
-- poter esistere, altrimenti il difetto torna dalla porta di servizio.
alter table fiscal_settings
  alter column maxideduzione_attiva        set not null,
  alter column maxideduzione_percento      set not null,
  alter column acconto_percento            set not null,
  alter column acconto_prima_rata_percento set not null,
  alter column acconto_soglia_minima       set not null,
  alter column prima_scadenza_mese         set not null,
  alter column prima_scadenza_giorno       set not null,
  alter column seconda_scadenza_mese       set not null,
  alter column seconda_scadenza_giorno     set not null;

do $vincoli$
begin
  if not exists (select 1 from pg_constraint where conname = 'fiscal_settings_scadenze_valide') then
    -- Il giorno arriva fino a 31 perche' le scadenze vere sono il 30. Un
    -- 31 su un mese che non ce l'ha non diventa un errore a schermo: chi
    -- costruisce la data lo riporta all'ultimo giorno di quel mese.
    alter table fiscal_settings add constraint fiscal_settings_scadenze_valide check (
      prima_scadenza_mese     between 1 and 12 and prima_scadenza_giorno   between 1 and 31
      and seconda_scadenza_mese between 1 and 12 and seconda_scadenza_giorno between 1 and 31
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fiscal_settings_percentuali_valide') then
    alter table fiscal_settings add constraint fiscal_settings_percentuali_valide check (
      ires_rate >= 0 and irap_rate >= 0
      and maxideduzione_percento >= 0 and maxideduzione_percento <= 100
      and acconto_percento >= 0 and acconto_percento <= 200
      and acconto_prima_rata_percento >= 0 and acconto_prima_rata_percento <= 100
    );
  end if;
end $vincoli$;

comment on column fiscal_settings.maxideduzione_attiva is
  'Maxi-deduzione del costo del lavoro (D.Lgs. 216/2023). Nasce SPENTA e la accende Alessio dopo Laura: un''agevolazione applicata da sola abbasserebbe le imposte stimate sempre nella stessa direzione.';
comment on column fiscal_settings.acconto_prima_rata_percento is
  'Quanta parte dell''acconto si versa alla prima scadenza; il resto alla seconda. Serve al CALENDARIO degli esborsi: e'' la cassa di giugno che tradisce, non il totale dell''anno.';
comment on column fiscal_settings.parametri_confermati_da_laura is
  'Il giorno in cui la commercialista ha confermato questi parametri. Finche'' e'' vuota, ogni schermata che mostra un''imposta scrive che e'' una semplificazione.';

-- =====================================================================
-- 2. Il motore — l'unico posto dove si calcola un'imposta
-- =====================================================================
create or replace function calcola_imposte(
  p_entity_id uuid,
  p_imponibile numeric,
  p_costo_lavoro_incrementale numeric default 0
)
returns table (
  imponibile           numeric,
  deduzione_extra      numeric,
  imponibile_ires      numeric,
  aliquota_ires        numeric,
  aliquota_irap        numeric,
  ires                 numeric,
  irap                 numeric,
  totale               numeric,
  maxideduzione_attiva boolean,
  confermati_da_laura  date,
  avvertenza           text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s fiscal_settings%rowtype;
  v_base numeric;
  v_ded  numeric;
begin
  -- Portiere: `security definer` gira senza RLS, quindi il controllo va
  -- rimesso dentro (rilievo del validatore del 13/08). Chi non deve
  -- vedere riceve un rifiuto, non un elenco vuoto: una schermata vuota e'
  -- una rassicurazione falsa.
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select * into s from fiscal_settings where entity_id = p_entity_id;
  if s.entity_id is null then
    raise exception 'Non ci sono parametri fiscali per questa entita'': impostali dal Simulatore.';
  end if;

  v_base := coalesce(p_imponibile, 0);

  -- La maxi-deduzione abbassa la base IRES, mai quella IRAP, e solo se
  -- Alessio l'ha accesa.
  v_ded := case
             when coalesce(s.maxideduzione_attiva, false)
             then round(coalesce(p_costo_lavoro_incrementale, 0) * s.maxideduzione_percento / 100, 2)
             else 0
           end;

  return query select
    v_base,
    v_ded,
    greatest(v_base - v_ded, 0),
    s.ires_rate,
    s.irap_rate,
    round(greatest(v_base - v_ded, 0) * s.ires_rate / 100, 2),
    round(greatest(v_base, 0)         * s.irap_rate / 100, 2),
    round(greatest(v_base - v_ded, 0) * s.ires_rate / 100, 2)
      + round(greatest(v_base, 0)     * s.irap_rate / 100, 2),
    coalesce(s.maxideduzione_attiva, false),
    s.parametri_confermati_da_laura,
    case
      when s.parametri_confermati_da_laura is not null then
        'Parametri confermati con la commercialista il '
        || to_char(s.parametri_confermati_da_laura, 'DD/MM/YYYY')
        || '. L''IRAP resta calcolata sull''utile: e'' una semplificazione, non la base vera.'
      else
        'Stima semplificata, ancora da confermare con la commercialista. '
        || 'L''IRAP qui e'' calcolata sull''utile come l''IRES, ma ha una base sua — '
        || 'il valore della produzione netta — in cui interessi e parte del costo del lavoro non si scalano. '
        || 'Con dipendenti quella base e'' di solito piu'' alta dell''utile, quindi questo numero '
        || 'tende a essere PIU'' BASSO del vero.'
    end;
end;
$function$;

comment on function calcola_imposte is
  'L''unico posto dove si calcola un''imposta (14/08/2026). Simulatore e Proiezione chiamano questa: due semplificazioni diverse che danno due numeri diversi sono vietate per costruzione. Restituisce il numero E il suo limite, cosi'' non possono separarsi.';

revoke all on function calcola_imposte(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function calcola_imposte(uuid, numeric, numeric) to authenticated;

-- =====================================================================
-- 3. Il quando, non solo il quanto
-- =====================================================================
-- ⚠️ È la parte che il mandato chiede espressamente, e la ragione è
-- scritta lì: «è la cassa di giugno che tradisce, non il totale». Un'osteria
-- che a giugno paga il saldo dell'anno prima E il primo acconto di
-- quest'anno può avere un anno in utile e restare senza soldi in un mese.
--
-- Aiutante: il giorno chiesto, o l'ultimo del mese se quel giorno non
-- esiste. Piccolo e senza sorprese, quindi `immutable`.
create or replace function giorno_del_mese(p_anno integer, p_mese integer, p_giorno integer)
returns date
language sql
immutable
set search_path = public
as $function$
  select make_date(p_anno, p_mese, least(
    p_giorno,
    extract(day from (make_date(p_anno, p_mese, 1) + interval '1 month - 1 day'))::integer
  ));
$function$;

revoke all on function giorno_del_mese(integer, integer, integer) from public, anon, authenticated;
grant execute on function giorno_del_mese(integer, integer, integer) to authenticated;

-- Metodo previsionale: gli acconti dell'anno si commisurano all'imposta
-- che l'anno stesso sta maturando — che è ciò che una PROIEZIONE sa dire.
-- Il metodo storico (acconti sull'anno precedente) è quello che userà
-- Laura a consuntivo; qui darebbe zero per il primo anno di attività, che
-- è il caso di Borgo 58 e sarebbe l'esatto contrario di un avviso utile.
create or replace function calendario_imposte(
  p_entity_id uuid,
  p_anno integer,
  p_imposte_anno numeric,
  p_imposte_anno_precedente numeric default null
)
returns table (
  scadenza date,
  voce     text,
  importo  numeric,
  nota     text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  s              fiscal_settings%rowtype;
  v_acconto      numeric;
  v_prima        numeric;
  v_seconda      numeric;
  v_acconto_prec numeric;
  d_prima        date;
  d_seconda      date;
  d_prima_dopo   date;
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select * into s from fiscal_settings where entity_id = p_entity_id;
  if s.entity_id is null then
    raise exception 'Non ci sono parametri fiscali per questa entita''.';
  end if;

  -- Un giorno che quel mese non ha (il 31 di novembre) diventa l'ultimo
  -- giorno del mese invece di far esplodere il calendario: una data
  -- impossibile e' un errore di impostazione, non un motivo per non
  -- mostrare a Alessio quando escono i soldi.
  d_prima      := giorno_del_mese(p_anno,     s.prima_scadenza_mese,   s.prima_scadenza_giorno);
  d_seconda    := giorno_del_mese(p_anno,     s.seconda_scadenza_mese, s.seconda_scadenza_giorno);
  d_prima_dopo := giorno_del_mese(p_anno + 1, s.prima_scadenza_mese,   s.prima_scadenza_giorno);

  v_acconto := round(greatest(coalesce(p_imposte_anno, 0), 0) * s.acconto_percento / 100, 2);
  if v_acconto < s.acconto_soglia_minima then v_acconto := 0; end if;
  v_prima   := round(v_acconto * s.acconto_prima_rata_percento / 100, 2);
  v_seconda := v_acconto - v_prima;

  v_acconto_prec := round(greatest(coalesce(p_imposte_anno_precedente, 0), 0) * s.acconto_percento / 100, 2);
  if v_acconto_prec < s.acconto_soglia_minima then v_acconto_prec := 0; end if;

  if p_imposte_anno_precedente is not null then
    return query select
      d_prima,
      'Saldo ' || (p_anno - 1)::text,
      round(greatest(p_imposte_anno_precedente, 0) - v_acconto_prec, 2),
      'Quanto resta dell''anno scorso dopo gli acconti gia'' versati.';
  end if;

  return query select d_prima, 'Primo acconto ' || p_anno::text, v_prima,
    case when v_acconto = 0
         then 'Sotto la soglia: nessun acconto dovuto.'
         else 'Insieme al saldo dell''anno prima: e'' il mese in cui esce piu'' cassa.' end;

  return query select d_seconda, 'Secondo acconto ' || p_anno::text, v_seconda,
    'La seconda rata dell''acconto.';

  return query select d_prima_dopo, 'Saldo ' || p_anno::text,
    round(greatest(coalesce(p_imposte_anno, 0), 0) - v_acconto, 2),
    'Si paga l''anno prossimo, insieme al primo acconto di quell''anno.';
end;
$function$;

comment on function calendario_imposte is
  'Quando escono i soldi delle imposte, non solo quanti (14/08/2026). Metodo previsionale, coerente con una proiezione; le percentuali e le date sono parametri di Alessio, non numeri nel codice.';

revoke all on function calendario_imposte(uuid, integer, numeric, numeric) from public, anon, authenticated;
grant execute on function calendario_imposte(uuid, integer, numeric, numeric) to authenticated;

-- =====================================================================
-- 4. Verifica (§7 punti 1-3)
-- =====================================================================
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;   -- la S.r.l.s.: si LEGGE, non si tocca
  v_prova    uuid;   -- l'entita' su cui girano le prove
  r          record;
  n          integer;
  respinto   boolean;
  v_c_erano  integer;   -- quante righe di parametri c'erano PRIMA
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  select id into v_ente from entities where entity_type = 'srls';
  if v_titolare is null or v_staff is null or v_ente is null then
    raise exception 'Servono entita'', titolare e staff per questa verifica.';
  end if;

  select count(*) into v_c_erano from fiscal_settings;

  -- Ogni riga deve avere i parametri nuovi: nessuna colonna vuota che
  -- farebbe fallire il calcolo la prima volta che serve davvero.
  select count(*) into n from fiscal_settings
   where maxideduzione_attiva is null or acconto_percento is null
      or prima_scadenza_mese is null or seconda_scadenza_mese is null;
  if n > 0 then
    raise exception 'Ci sono % righe di parametri fiscali incomplete.', n;
  end if;

  -- ⚠️ Non si pretende che la riga della S.r.l.s. esista: in produzione
  -- c'è, sul progetto di prova NO — quelle righe le crea Alessio dal
  -- Simulatore, non una migrazione. Una verifica che lo desse per
  -- scontato passerebbe di là e si fermerebbe di qua, e sarebbe la terza
  -- volta che una prova gira su uno stato di partenza diverso da quello
  -- vero proprio nel punto che conta.

  -- ⚠️ LE PROVE NON GIRANO SUI PARAMETRI DI ALESSIO. La prima stesura di
  -- questo blocco cambiava le sue aliquote e le rimetteva alla fine: e'
  -- esattamente la forma di verifica che il 14/08 ha lasciato due tavoli
  -- in mezzo ai divani — bastava un'eccezione a meta' strada e le
  -- aliquote restavano quelle della prova, in silenzio. Qui si lavora su
  -- una riga NUOVA, che alla fine sparisce; se qualcosa esplode a meta',
  -- la transazione la porta via con se' e i suoi parametri non sono mai
  -- stati toccati.
  select id into v_prova from entities where entity_type <> 'srls' limit 1;
  if v_prova is null then
    raise exception 'Serve una seconda entita'' per provare senza toccare i parametri veri.';
  end if;
  if exists (select 1 from fiscal_settings where entity_id = v_prova) then
    raise exception 'La seconda entita'' ha gia'' dei parametri fiscali: la verifica non li tocca.';
  end if;

  -- ⚠️ Si scrivono SOLO le due aliquote: tutto il resto deve arrivare dai
  -- valori predefiniti. È la prova che una riga creata domani nasce
  -- completa — il difetto trovato applicando sul progetto di prova.
  insert into fiscal_settings (entity_id, ires_rate, irap_rate)
  values (v_prova, 24, 3.9);

  select count(*) into n from fiscal_settings
   where entity_id = v_prova
     and acconto_percento = 100 and acconto_prima_rata_percento = 40
     and prima_scadenza_mese = 6 and seconda_scadenza_mese = 11
     and maxideduzione_attiva = false;
  if n <> 1 then
    raise exception 'Una riga di parametri fiscali creata adesso non nasce completa.';
  end if;

  -- ⚠️ IL PORTIERE, VISTO RESPINGERE DAVVERO (§7 punto 2). Lo staff non
  -- deve ricevere un elenco vuoto: deve ricevere un rifiuto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin
    perform * from calcola_imposte(v_prova, 10000);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Lo staff ha potuto calcolare le imposte.';
  end if;
  respinto := false;
  begin
    perform * from calendario_imposte(v_prova, 2027, 10000);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Lo staff ha potuto vedere il calendario delle imposte.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Il calcolo, coi numeri a mano. Aliquote note: 24 e 3,9.
  select * into r from calcola_imposte(v_prova, 10000, 100000);
  if r.ires <> 2400.00 then raise exception 'IRES su 10.000 attesa 2.400, trovata %', r.ires; end if;
  if r.irap <> 390.00  then raise exception 'IRAP su 10.000 attesa 390, trovata %',  r.irap; end if;
  if r.totale <> 2790.00 then raise exception 'Totale imposte atteso 2.790, trovato %', r.totale; end if;
  -- ⚠️ Spenta, la maxi-deduzione non deve toccare NIENTE, nemmeno se
  -- riceve una base: e' il caso che conta, perche' e' lo stato di partenza.
  if r.deduzione_extra <> 0 then
    raise exception 'La maxi-deduzione e'' spenta ma ha ridotto la base di %', r.deduzione_extra;
  end if;
  -- La frase deve nominare l'IRAP e dire che e' una semplificazione: sono
  -- le due cose che rendono il numero leggibile per quello che e'.
  if r.avvertenza not like '%IRAP%' or r.avvertenza not like '%semplific%' then
    raise exception 'Il numero e'' uscito senza la frase che ne dichiara il limite: «%»', r.avvertenza;
  end if;

  -- Accesa, abbassa la base IRES e NON quella IRAP.
  update fiscal_settings set maxideduzione_attiva = true, maxideduzione_percento = 20
   where entity_id = v_prova;
  select * into r from calcola_imposte(v_prova, 10000, 5000);
  if r.deduzione_extra <> 1000.00 then
    raise exception 'Deduzione extra attesa 1.000, trovata %', r.deduzione_extra;
  end if;
  if r.ires <> 2160.00 then raise exception 'IRES con maxi-deduzione attesa 2.160, trovata %', r.ires; end if;
  if r.irap <> 390.00 then
    raise exception 'La maxi-deduzione ha abbassato anche l''IRAP (%): non deve.', r.irap;
  end if;

  -- Una perdita non genera imposte negative.
  select * into r from calcola_imposte(v_prova, -5000, 5000);
  if r.ires <> 0 or r.irap <> 0 then
    raise exception 'Con una perdita sono uscite imposte: % e %', r.ires, r.irap;
  end if;

  -- Il calendario: due rate d'acconto e il saldo che cade l'anno dopo.
  update fiscal_settings set maxideduzione_attiva = false where entity_id = v_prova;
  select count(*) into n from calendario_imposte(v_prova, 2027, 10000);
  if n <> 3 then
    raise exception 'Senza l''anno precedente il calendario deve avere 3 righe, ne ha %', n;
  end if;
  select count(*) into n from calendario_imposte(v_prova, 2027, 10000, 8000);
  if n <> 4 then
    raise exception 'Con l''anno precedente il calendario deve avere 4 righe, ne ha %', n;
  end if;

  select * into r from calendario_imposte(v_prova, 2027, 10000)
   where voce like 'Primo acconto%';
  if r.importo <> 4000.00 then
    raise exception 'Primo acconto atteso 4.000 (40%% di 10.000), trovato %', r.importo;
  end if;
  if extract(month from r.scadenza) <> 6 then
    raise exception 'Il primo acconto non cade nel mese impostato: %', r.scadenza;
  end if;
  select * into r from calendario_imposte(v_prova, 2027, 10000) where voce like 'Secondo acconto%';
  if r.importo <> 6000.00 then
    raise exception 'Secondo acconto atteso 6.000, trovato %', r.importo;
  end if;
  -- ⚠️ Il saldo dell'anno cade nell'anno DOPO: se cadesse nello stesso,
  -- il calendario direbbe che a giugno esce meno cassa di quanta ne esce.
  select * into r from calendario_imposte(v_prova, 2027, 10000) where voce = 'Saldo 2027';
  if extract(year from r.scadenza) <> 2028 then
    raise exception 'Il saldo del 2027 non cade nel 2028 ma il %', r.scadenza;
  end if;

  -- Sotto la soglia minima non si versa nessun acconto.
  select * into r from calendario_imposte(v_prova, 2027, 40) where voce like 'Primo acconto%';
  if r.importo <> 0 then
    raise exception 'Sotto la soglia e'' uscito un acconto di %', r.importo;
  end if;

  -- Un giorno che il mese non ha non fa esplodere il calendario.
  if giorno_del_mese(2027, 2, 31) <> date '2027-02-28' then
    raise exception 'Il 31 di febbraio non e'' diventato l''ultimo giorno del mese.';
  end if;

  -- Via la riga di prova, e si controlla il singolo: un conteggio totale
  -- direbbe «uno» anche se fosse sparita quella sbagliata.
  delete from fiscal_settings where entity_id = v_prova;
  if exists (select 1 from fiscal_settings where entity_id = v_prova) then
    raise exception 'La riga di prova dei parametri fiscali e'' rimasta.';
  end if;
  -- E quello che c'era prima c'e' ancora, tanto in produzione (una riga)
  -- quanto sul progetto di prova (nessuna).
  select count(*) into n from fiscal_settings;
  if n <> v_c_erano then
    raise exception 'Le righe di parametri fiscali erano %, adesso sono %.', v_c_erano, n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Motore fiscale unico: calcolo verificato a mano, portiere che respinge lo staff, calendario con acconti e saldo nell''anno giusto — e i parametri di Alessio mai toccati.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000013', 'un_solo_motore_fiscale')
on conflict (version) do nothing;

select
  (select count(*) from fiscal_settings)                                     as entita_con_parametri,
  (select count(*) from fiscal_settings where maxideduzione_attiva)          as con_maxideduzione,
  (select count(*) from fiscal_settings where parametri_confermati_da_laura is not null) as confermati_da_laura;
