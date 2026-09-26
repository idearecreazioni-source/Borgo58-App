-- =====================================================================
-- LA CHIUSURA DELL'ANNO FISCALE — C5, 23/09/2026
-- =====================================================================
--
-- COSA E', in una riga: la fotografia di un anno per un soggetto, fatta
-- con la stessa macchina delle chiusure mensili, che si rifiuta di
-- avvenire in silenzio quando restano conti senza documento fiscale.
--
-- ---------------------------------------------------------------------
-- IL CONTRATTO — cosa fotografa, cosa NON tocca, chi la puo' fare
-- ---------------------------------------------------------------------
-- COSA FOTOGRAFA. Gli stessi numeri del consuntivo mensile, accumulati
--   sui dodici mesi: coperti, ricavi incassati, food cost, costi fissi,
--   costo e numero degli omaggi, conti chiusi. Piu' due numeri che il mese
--   non ha: quanti conti dell'anno sono rimasti SENZA DOCUMENTO FISCALE e
--   quanto valgono.
--
-- ⚠️ E LI PRENDE DAL MESE GIA' CHIUSO QUANDO C'E'. Per ogni mese si legge
--   la fotografia in `consuntivi_mensili` se esiste, altrimenti si misura
--   dal vivo con `misure_del_mese`. E' esattamente cio' che
--   `confronto_a_oggi` fa dal 15/08: **la fotografia del mese vince sulla
--   misura di oggi**, o l'anno racconterebbe una terza verita' accanto
--   alle due che esistono gia'.
--
-- ⚠️ E OGNI VOCE SI ACCUMULA SOLO NEI MESI IN CUI E' MISURATA (regola del
--   15/08). Un anno in cui il food cost non e' mai stato misurabile non
--   vale zero: vale VUOTO, e lo dichiara. *Uno zero si legge «e' andato
--   benissimo».*
--
-- COSA NON TOCCA, ed e' la parte che conta:
--   · **`orders` non viene scritta**. Nessun conto viene riclassificato,
--     fiscalizzato, spostato di anno o «appianato». Chiudere l'anno non
--     cambia un solo dato corrente: legge e fotografa.
--   · **I consuntivi mensili non vengono toccati.** Non ne pretende
--     nessuno e non ne scrive nessuno.
--   · **Non emette documenti** e non parla col registratore telematico.
--
-- CHI LA PUO' FARE: il titolare, e il controllo sta nella funzione
--   (`is_titolare()`, che RIFIUTA invece di filtrare) e nella RLS della
--   tabella. Lo staff non vede nemmeno lo storico.
--
-- COSA RESTA VOLUTAMENTE FUORI:
--   · il **pacchetto per la commercialista** (magazzino al 31/12, beni
--     durevoli, merce senza fattura) — e' C6, e la sua forma la deve dire
--     lei (quesito L22): costruirlo prima vorrebbe dire indovinare un
--     formato, e un lettore che si aspetta un formato sbagliato non da'
--     errore — legge un numero plausibile nella riga sbagliata;
--   · il **caricamento della chiusura ufficiale** per il confronto sui
--     ricavi — C7, che aspetta il primo documento vero (L22);
--   · **ratei e risconti**, esclusi da Alessio;
--   · il **registratore telematico** e qualunque logica di fatturazione.
--
-- ---------------------------------------------------------------------
-- 🔴 IL FERMO SU L21, E PERCHE' QUESTA MIGRAZIONE NON LO DECIDE
-- ---------------------------------------------------------------------
-- Il quesito **L21** alla commercialista e' APERTO: *un conto dell'anno
-- scorso regolarizzato adesso, dopo che l'anno e' gia' stato chiuso, dove
-- finisce — nell'anno in cui il cliente ha mangiato o in quello in cui
-- esce il documento?*
--
-- ⚠️ QUI NON SI RISPONDE, e il modo di non rispondere e' non fare niente
--   a quei conti: la chiusura li **conta**, li **mostra prima**, pretende
--   una **conferma esplicita** per procedere, e poi li lascia esattamente
--   dov'erano. Nessuna riclassificazione automatica, nessuno spostamento
--   di anno, nessun documento inventato.
--
-- ⚠️ E LO SCARTO SI DICHIARA INVECE DI APPIANARLO, che e' la regola gia'
--   in vigore dal 15/08 sugli scontrini ristampati. I ricavi dell'anno
--   comprendono quei conti — perche' i ricavi sono l'incassato dai conti
--   chiusi, e lo sono dal 14/08 in tutto il gestionale, mese compreso — e
--   ACCANTO c'e' il numero di quelli senza documento. Sono due assi
--   diversi, ed e' `quadratura_fiscale` a tenerli distinti da sempre.
--   Toglierli dai ricavi sarebbe gia' una risposta a L21; lasciarli senza
--   dirlo sarebbe appianare.
--
-- ⚠️ QUINDI IL CONFINE E' REALIZZABILE SENZA DECIDERE L21: quello che la
--   chiusura fa e' *contare e dichiarare*, e contare non e' classificare.
--
-- ---------------------------------------------------------------------
-- ALTRE DUE COSE, scritte perche' non si perdano
-- ---------------------------------------------------------------------
-- ⚠️ NIENTE NUOVA DEFINIZIONE DI «GIORNO FISCALE». L'anno comincia e
--   finisce sulla SERATA DI SERVIZIO, come tutto il resto: il perimetro
--   dei conti senza documento passa da `conti_senza_documento`, che
--   filtra su `serata_di_servizio(closed_at)`, e «l'anno e' finito?» si
--   chiede a `serata_di_servizio(now())`. Alle due di notte del 1°
--   gennaio la serata e' ancora il 31 dicembre, e l'anno non e' finito.
--
-- ⚠️ UNA SOLA TABELLA, QUINDI NIENTE CORRIDOIO — stessa forma e stessa
--   ragione di `chiudi_mese`: e' il CALCOLO che tocca mezzo gestionale,
--   non la scrittura. La scrittura e' un `insert` solo, dentro una
--   funzione, cioe' una transazione.
--
-- Idempotente (§7 punto 3). Si auto-registra in fondo (§7 punto 4).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LO STORICO, IMMUTABILE
-- ---------------------------------------------------------------------
create table if not exists chiusure_annuali (
  id                      uuid primary key default gen_random_uuid(),
  entity_id               uuid not null references entities(id) on delete restrict,
  anno                    integer not null,
  chiusa_il               timestamptz not null default now(),
  chiusa_da               uuid,

  -- I numeri dell'anno: VUOTI quando non si sono potuti misurare, mai zero.
  coperti                 numeric,
  ricavi                  numeric,
  food_cost               numeric,
  fissi                   numeric,
  omaggi_costo            numeric,
  omaggi_quanti           integer,
  conti_chiusi            integer not null default 0,

  -- Da dove viene ognuno
  origine_coperti         text not null,
  origine_ricavi          text not null,
  origine_food_cost       text not null,
  origine_fissi           text not null,

  -- Quanti dei dodici mesi erano gia' stati fotografati quando l'anno e'
  -- stato chiuso. Non e' un prerequisito: e' un'informazione su quanta
  -- parte della foto viene da mesi congelati e quanta da una misura.
  mesi_fotografati        integer not null default 0,

  -- 🔴 L'AVVISO, CONSERVATO. Quanti conti e quanto valgono.
  conti_senza_documento   integer not null default 0,
  incasso_senza_documento numeric not null default 0,

  -- Le rifotografie, esattamente come per i mesi (16/08).
  chiusure_precedenti     integer,
  prima_chiusura_il       timestamptz,

  note                    text,
  unique (entity_id, anno)
);

-- ⚠️ I vincoli si aggiungono a parte e solo se mancano: la tabella
--    potrebbe gia' esistere da una riapplicazione, e in quel caso il
--    `create table if not exists` di sopra non li avrebbe messi.
do $vincoli$
begin
  if not exists (select 1 from pg_constraint where conname = 'chiusura_annuale_anno_sensato') then
    alter table chiusure_annuali add constraint chiusura_annuale_anno_sensato
      check (anno between 1900 and 2200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chiusura_annuale_origini_note') then
    alter table chiusure_annuali add constraint chiusura_annuale_origini_note
      check (origine_coperti   in ('misurato', 'assente')
         and origine_ricavi    in ('misurato', 'assente')
         and origine_food_cost in ('misurato', 'assente')
         and origine_fissi     in ('misurato', 'assente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chiusura_annuale_mesi_fotografati') then
    alter table chiusure_annuali add constraint chiusura_annuale_mesi_fotografati
      check (mesi_fotografati between 0 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chiusura_annuale_avviso_coerente') then
    alter table chiusure_annuali add constraint chiusura_annuale_avviso_coerente
      check (conti_senza_documento >= 0
         and incasso_senza_documento >= 0
         and (conti_senza_documento > 0 or incasso_senza_documento = 0));
  end if;
end $vincoli$;

comment on table chiusure_annuali is
  'L''anno com''era il giorno in cui si e'' chiuso, per un soggetto. Stessa macchina dei consuntivi mensili: non si ricalcola, e ogni numero dichiara se e'' stato misurato o se manca. Porta anche quanti conti erano rimasti senza documento fiscale — contati, mai toccati.';

comment on column chiusure_annuali.mesi_fotografati is
  'Quanti dei dodici mesi avevano gia'' il loro consuntivo quando l''anno e'' stato chiuso. Non e'' un prerequisito: un anno si chiude anche senza nessun mese fotografato, e questo numero dice quanta parte della foto viene da mesi congelati.';

comment on column chiusure_annuali.conti_senza_documento is
  'Quanti conti dell''anno erano rimasti senza documento fiscale al momento della chiusura. Zero = chiusura pulita; piu'' di zero = chiusura avvenuta DOPO una conferma esplicita del titolare, ed e'' cosi'' che le due si distinguono nello storico. 🔴 Questi conti NON sono stati toccati: dove finiscono se li regolarizzi dopo e'' il quesito L21 alla commercialista, ancora APERTO.';

comment on column chiusure_annuali.incasso_senza_documento is
  'Quanto valgono, in euro, i conti senza documento contati qui accanto. Non e'' sottratto dai ricavi: i ricavi sono l''incassato dai conti chiusi (14/08), e il documento fiscale e'' un asse diverso. Lo scarto si dichiara, non si appiana (15/08) — e sottrarlo sarebbe gia'' una risposta a L21.';

comment on column chiusure_annuali.chiusure_precedenti is
  'Quante volte questo anno era gia'' stato fotografato e poi cancellato. 0 = e'' la prima. Si legge dal registro delle cancellazioni, non da un contatore da tenere allineato.';

comment on constraint chiusura_annuale_anno_sensato on chiusure_annuali is
  'L''anno di una chiusura sta fra il 1900 e il 2200: fuori di li'' e'' una cifra digitata male, non un anno. 🔴 Il limite basso NON e'' 2020: le verifiche e le prove automatiche si scelgono anni lontani e vuoti per non toccare i dati veri (17/08), e un limite stretto le avrebbe respinte — cioe'' avrebbe impedito di provare la regola invece di proteggerla.';

comment on constraint chiusura_annuale_origini_note on chiusure_annuali is
  'Ogni numero dell''anno deve dire da dove viene: «misurato» oppure «assente». Non esiste un terzo caso, perche'' un numero senza origine si legge come vero.';

comment on constraint chiusura_annuale_mesi_fotografati on chiusure_annuali is
  'I mesi gia'' fotografati vanno da 0 a 12: un anno non ne ha altri.';

comment on constraint chiusura_annuale_avviso_coerente on chiusure_annuali is
  'I conti senza documento e il loro incasso non possono essere negativi, e un incasso senza documento senza nemmeno un conto che lo porti sarebbe un numero senza padrone.';

-- Non si ricalcola: nessun `update`, mai. Stessa regola del mese.
create or replace function vieta_riscrittura_chiusura_annuale()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  raise exception 'Un anno chiuso non si ricalcola. Se e'' sbagliato si cancella e si richiude: cosi'' resta scritto che e'' successo, e la chiusura nuova dichiara di essere una seconda.';
end;
$function$;

-- Anche una funzione trigger nasce aperta al mondo (lezione dell'11/08):
-- l'elenco di chi puo' bussare da fuori non cresce in silenzio.
revoke all on function vieta_riscrittura_chiusura_annuale() from public, anon, authenticated;

drop trigger if exists trg_chiusura_annuale_non_si_riscrive on chiusure_annuali;
create trigger trg_chiusura_annuale_non_si_riscrive
  before update on chiusure_annuali
  for each row execute function vieta_riscrittura_chiusura_annuale();

-- Cancellarla si puo', ma resta la copia: e' una tabella di soldi.
drop trigger if exists trg_log_delete on chiusure_annuali;
create trigger trg_log_delete before delete on chiusure_annuali
  for each row execute function log_deleted_record();

-- ⚠️ LA TASCA NON E' UNA SOCIETA' e non ha un anno fiscale da chiudere.
--    Si riusa il trigger che gia' tiene la tasca fuori da `fiscal_settings`
--    e dagli scenari di previsione: quella funzione e' LA definizione di
--    questa regola, e scriverne una seconda vorrebbe dire tenerle
--    allineate per sempre.
drop trigger if exists trg_niente_chiusura_sulla_tasca on chiusure_annuali;
create trigger trg_niente_chiusura_sulla_tasca
  before insert or update on chiusure_annuali
  for each row execute function vieta_fiscale_sulla_tasca();

alter table chiusure_annuali enable row level security;
drop policy if exists chiusure_annuali_titolare_all on chiusure_annuali;
create policy chiusure_annuali_titolare_all on chiusure_annuali
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ IL PERIMETRO DEL REGISTRO SI DICHIARA, non si lascia «da decidere»:
--    una tabella col trigger addosso e senza decisione scritta e' proprio
--    il caso in cui il guardiano del 26/08 tace, perche' in SQL il terzo
--    stato sparisce dai confronti.
insert into perimetro_registro (tabella, dentro, ragione) values
  ('chiusure_annuali', true,
   'L''anno com''era il giorno in cui si e'' chiuso: sono soldi, ed e'' un documento che si guarda all''indietro. Dentro dal 23/09/2026, come consuntivi_mensili.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 2. COSA SI E' POTUTO MISURARE, DI UN ANNO
-- ---------------------------------------------------------------------
-- ⚠️ NON RIFA' I CONTI DELL'ANNO DA CAPO: cammina i dodici mesi con la
--    macchina che esiste gia'. Per ogni mese, la fotografia se c'e',
--    altrimenti la misura dal vivo — la stessa scelta, nello stesso
--    ordine, che `confronto_a_oggi` fa dal 15/08.
create or replace function misure_dell_anno(p_entity_id uuid, p_anno integer)
returns table (
  coperti                 numeric,
  ricavi                  numeric,
  food_cost               numeric,
  fissi                   numeric,
  omaggi_costo            numeric,
  omaggi_quanti           integer,
  conti_chiusi            integer,
  origine_coperti         text,
  origine_ricavi          text,
  origine_food_cost       text,
  origine_fissi           text,
  mesi_fotografati        integer,
  conti_senza_documento   integer,
  incasso_senza_documento numeric,
  anno_finito             boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  i       integer;
  c       record;
  m       record;
  v_cop numeric := 0; v_ric numeric := 0; v_fc numeric := 0; v_fis numeric := 0;
  n_cop integer := 0; n_ric integer := 0; n_fc integer := 0; n_fis integer := 0;
  v_omc numeric := 0; v_omq integer := 0; v_conti integer := 0;
  v_foto integer := 0;
  v_senza_n integer := 0;
  v_senza_e numeric := 0;
  -- cosa dice il mese: valore e origine
  x_cop numeric; x_ric numeric; x_fc numeric; x_fis numeric;
  o_cop text;    o_ric text;    o_fc text;    o_fis text;
begin
  -- ⚠️ RIFIUTA, non filtra: un filtro nella `where` risponderebbe un
  --    elenco vuoto a chi non deve vedere, e un elenco vuoto si legge
  --    «non c'e' niente» — una rassicurazione falsa (27/08).
  if not is_titolare() then
    raise exception 'I numeri dell''anno sono riservati al titolare.';
  end if;

  for i in 1..12 loop
    select * into c from consuntivi_mensili
     where entity_id = p_entity_id and anno = p_anno and mese = i;

    if c.id is not null then
      v_foto := v_foto + 1;
      x_cop := c.coperti; x_ric := c.ricavi; x_fc := c.food_cost; x_fis := c.fissi;
      o_cop := c.origine_coperti; o_ric := c.origine_ricavi;
      o_fc  := c.origine_food_cost; o_fis := c.origine_fissi;
      v_omc := v_omc + coalesce(c.omaggi_costo, 0);
      v_omq := v_omq + coalesce(c.omaggi_quanti, 0);
      v_conti := v_conti + coalesce(c.conti_chiusi, 0);
    else
      select * into m from misure_del_mese(p_entity_id, p_anno, i);
      x_cop := m.coperti; x_ric := m.ricavi; x_fc := m.food_cost; x_fis := m.fissi;
      o_cop := m.origine_coperti; o_ric := m.origine_ricavi;
      o_fc  := m.origine_food_cost; o_fis := m.origine_fissi;
      v_omc := v_omc + coalesce(m.omaggi_costo, 0);
      v_omq := v_omq + coalesce(m.omaggi_quanti, 0);
      v_conti := v_conti + coalesce(m.conti_chiusi, 0);
    end if;

    -- ⚠️ Ogni voce si accumula SOLO nei mesi in cui e' misurata (15/08).
    if o_cop = 'misurato' then v_cop := v_cop + coalesce(x_cop, 0); n_cop := n_cop + 1; end if;
    if o_ric = 'misurato' then v_ric := v_ric + coalesce(x_ric, 0); n_ric := n_ric + 1; end if;
    if o_fc  = 'misurato' then v_fc  := v_fc  + coalesce(x_fc,  0); n_fc  := n_fc  + 1; end if;
    if o_fis = 'misurato' then v_fis := v_fis + coalesce(x_fis, 0); n_fis := n_fis + 1; end if;
  end loop;

  -- 🔴 I CONTI SENZA DOCUMENTO DELL'ANNO. Il perimetro e' la SERATA, non
  --    il calendario: lo decide `conti_senza_documento`, che e' gia' la
  --    regola unica di questa domanda e filtra su serata_di_servizio().
  select count(*)::integer, coalesce(sum(s.incasso), 0)
    into v_senza_n, v_senza_e
    from conti_senza_documento(
           p_entity_id,
           make_date(p_anno, 1, 1),
           make_date(p_anno, 12, 31)) s;

  return query select
    case when n_cop > 0 then v_cop end,
    case when n_ric > 0 then v_ric end,
    case when n_fc  > 0 then v_fc  end,
    case when n_fis > 0 then v_fis end,
    v_omc,
    v_omq,
    v_conti,
    case when n_cop > 0 then 'misurato' else 'assente' end,
    case when n_ric > 0 then 'misurato' else 'assente' end,
    case when n_fc  > 0 then 'misurato' else 'assente' end,
    case when n_fis > 0 then 'misurato' else 'assente' end,
    v_foto,
    v_senza_n,
    v_senza_e,
    -- ⚠️ «L'anno e' finito» si chiede alla SERATA: alle due di notte del
    --    1° gennaio la serata e' ancora il 31 dicembre, e il servizio di
    --    quell'anno non e' ancora chiuso.
    (serata_di_servizio(now()) > make_date(p_anno, 12, 31));
end;
$function$;

comment on function misure_dell_anno is
  'Cosa si e'' potuto misurare di un anno, per un soggetto. Cammina i dodici mesi: la fotografia del mese se c''e'', altrimenti la misura dal vivo — stessa scelta di confronto_a_oggi (15/08). Ogni voce si accumula solo nei mesi in cui e'' misurata, e cio'' che non si e'' potuto misurare resta VUOTO, mai zero. Porta anche i conti rimasti senza documento fiscale, contati sulla serata di servizio.';

revoke all on function misure_dell_anno(uuid, integer) from public, anon, authenticated;
grant execute on function misure_dell_anno(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. CHIUDERE L'ANNO
-- ---------------------------------------------------------------------
-- ⚠️ LA CONFERMA E' UN PARAMETRO, E A PRETENDERLA E' IL DATABASE. Se
--    restano conti senza documento la chiusura si RIFIUTA, dicendo quanti
--    sono e quanto valgono, finche' chi chiama non dichiara di aver visto.
--    Metterlo nella schermata sarebbe un controllo che chiunque scriva da
--    un'altra porta scavalca — e questa e' una fotografia che non si rifa'.
--
-- ⚠️ E ANNULLARE NON SCRIVE NIENTE, per costruzione: non c'e' nessuna riga
--    in sospeso da ritirare. Chi non conferma semplicemente non chiama
--    questa funzione, oppure la chiama e viene respinto — e un rifiuto non
--    lascia tracce.
create or replace function chiudi_anno(
  p_entity_id uuid,
  p_anno integer,
  p_conferma_conti_senza_documento boolean default false,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m       record;
  v_id    uuid;
  v_prec  integer;
  v_prima timestamptz;
begin
  if not is_titolare() then
    raise exception 'Chiudere un anno e'' riservato al titolare.';
  end if;

  select * into m from misure_dell_anno(p_entity_id, p_anno);

  if not m.anno_finito then
    raise exception 'Il % non e'' ancora finito: una chiusura si scrive ad anno chiuso, e non si potrebbe piu'' rifare. La serata di servizio di adesso e'' il %.',
      p_anno, to_char(serata_di_servizio(now()), 'DD/MM/YYYY');
  end if;

  if exists (select 1 from chiusure_annuali
              where entity_id = p_entity_id and anno = p_anno) then
    raise exception 'Il % e'' gia'' stato chiuso per questo soggetto. Se la fotografia e'' sbagliata si cancella e si richiude: quella nuova dichiarera'' di essere una seconda.', p_anno;
  end if;

  -- 🔴 L'AVVISO, E IL FERMO. Non si chiude in silenzio un anno che lascia
  --    indietro dei conti senza documento: il gestionale dice quanti sono
  --    e quanto valgono, e aspetta che il titolare dichiari di averli visti.
  -- ⚠️ E NON LI TOCCA. Non li riclassifica, non li fiscalizza, non li
  --    sposta di anno. Dove finiscono se vengono regolarizzati dopo e' il
  --    quesito L21, ancora aperto: rispondere qui sarebbe deciderlo.
  if m.conti_senza_documento > 0 and not coalesce(p_conferma_conti_senza_documento, false) then
    raise exception '%, per %. Guardali prima di chiudere: la fotografia non si rifa''. Se vuoi chiudere lo stesso conferma — resteranno esattamente dove sono, e nessuno li spostera''.',
      case when m.conti_senza_documento = 1
           then format('Resta 1 conto del %s senza documento fiscale', p_anno)
           else format('Restano %s conti del %s senza documento fiscale',
                       m.conti_senza_documento, p_anno)
      end,
      euro(m.incasso_senza_documento);
  end if;

  -- ⚠️ Quante volte questo stesso anno e' gia' stato fotografato e poi
  --    cancellato. Si legge dal registro delle cancellazioni invece di
  --    tenere un contatore da qualche parte: la verita' sta gia' li', e un
  --    contatore separato sarebbe un secondo posto da tenere allineato.
  select count(*), min((record->>'chiusa_il')::timestamptz)
    into v_prec, v_prima
    from deleted_records
   where table_name = 'chiusure_annuali'
     and record->>'entity_id' = p_entity_id::text
     and (record->>'anno')::integer = p_anno;

  insert into chiusure_annuali (
    entity_id, anno, chiusa_da,
    coperti, ricavi, food_cost, fissi, omaggi_costo, omaggi_quanti, conti_chiusi,
    origine_coperti, origine_ricavi, origine_food_cost, origine_fissi,
    mesi_fotografati, conti_senza_documento, incasso_senza_documento,
    chiusure_precedenti, prima_chiusura_il, note
  ) values (
    p_entity_id, p_anno, auth.uid(),
    m.coperti, m.ricavi, m.food_cost, m.fissi, m.omaggi_costo, m.omaggi_quanti, m.conti_chiusi,
    m.origine_coperti, m.origine_ricavi, m.origine_food_cost, m.origine_fissi,
    m.mesi_fotografati, m.conti_senza_documento, m.incasso_senza_documento,
    coalesce(v_prec, 0), v_prima, p_note
  ) returning id into v_id;

  return v_id;
end;
$function$;

comment on function chiudi_anno is
  'Fotografa l''anno finito, per un soggetto. Si rifiuta se restano conti senza documento fiscale finche'' il titolare non conferma di averli visti — e anche allora NON li tocca: contarli non e'' classificarli, e dove finisce un conto regolarizzato dopo la chiusura e'' il quesito L21, aperto. Una sola tabella, quindi niente corridoio: e'' il calcolo che tocca mezzo gestionale, non la scrittura.';

revoke all on function chiudi_anno(uuid, integer, boolean, text) from public, anon, authenticated;
grant execute on function chiudi_anno(uuid, integer, boolean, text) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
-- ⚠️ Tutto dentro una sotto-transazione annullata: il registro delle
--    cancellazioni resta acceso e non nasce nessuna lapide finta da
--    togliere. `foto_righe()`/`pretendi_nessun_residuo()` guardano TUTTE
--    le tabelle, non le sole tracciate (26/08).
--
-- ⚠️ L'anno scelto e' il **1996**: il locale apre nel 2027, quindi la'
--    dentro non c'e' e non ci sara' mai niente di vero. Un anno vicino
--    sarebbe un marcatore che smette di essere neutro (17/08).
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_ent      uuid;
  v_ent2     uuid;
  v_tasca    uuid;
  v_conto    uuid;
  v_id       uuid;
  v_id2      uuid;
  m          record;
  r          record;
  v_n        integer;
  v_doc      text;
  v_chiuso   timestamptz;
  v_ricavi   numeric;
  respinto   boolean;
  v_msg      text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_ent   from entities where entity_type = 'srls';
  select id into v_ent2  from entities where entity_type = 'azienda_agricola';
  select id into v_tasca from entities where entity_type = 'tasca';
  if v_ent is null or v_ent2 is null then
    raise exception 'Servono la societa'' e l''azienda agricola per verificare la separazione.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata

    -- =================================================================
    -- (1) CHIUSURA PULITA: nessun conto del 1996, nessun avviso.
    -- =================================================================
    select * into m from misure_dell_anno(v_ent, 1996);
    if m.conti_senza_documento <> 0 then
      raise exception 'Lo stato di partenza non e'' pulito: il 1996 ha gia'' % conti senza documento.', m.conti_senza_documento;
    end if;
    if not m.anno_finito then
      raise exception 'Il 1996 dovrebbe risultare finito.';
    end if;

    v_id := chiudi_anno(v_ent, 1996, false, '__VERIFICA C5__');
    select * into r from chiusure_annuali where id = v_id;
    if r.conti_senza_documento <> 0 then
      raise exception 'La chiusura pulita ha registrato % conti senza documento.', r.conti_senza_documento;
    end if;
    if r.chiusure_precedenti is distinct from 0 then
      raise exception 'La prima chiusura del 1996 doveva dichiarare zero precedenti, dichiara %.', r.chiusure_precedenti;
    end if;
    -- ⚠️ Cio' che non si e' potuto misurare resta VUOTO, mai zero.
    if r.origine_ricavi = 'assente' and r.ricavi is not null then
      raise exception 'Il 1996 non ha ricavi misurati, ma la fotografia ne scrive % invece di lasciare vuoto.', r.ricavi;
    end if;

    -- =================================================================
    -- (2) DUPLICATO IMPEDITO
    -- =================================================================
    respinto := false;
    begin
      perform chiudi_anno(v_ent, 1996, false, null);
    exception when others then
      respinto := true;
      v_msg := sqlerrm;
    end;
    if not respinto then
      raise exception 'Il 1996 si e'' lasciato chiudere due volte.';
    end if;
    if v_msg not like '%gia%' then
      raise exception 'Il rifiuto del duplicato non dice che era gia'' chiuso: «%»', v_msg;
    end if;

    -- =================================================================
    -- (3) LO STORICO NON SI RISCRIVE
    -- =================================================================
    respinto := false;
    begin
      update chiusure_annuali set note = 'cambiata' where id = v_id;
    exception when others then
      respinto := true;
    end;
    if not respinto then
      raise exception 'Una chiusura annuale si e'' lasciata riscrivere.';
    end if;

    -- =================================================================
    -- (4) SEPARAZIONE FRA SOGGETTI: l'agricola puo' chiudere lo stesso
    --     anno, e le due righe non si mescolano.
    -- =================================================================
    v_id2 := chiudi_anno(v_ent2, 1996, false, '__VERIFICA C5 agricola__');
    if v_id2 is null then
      raise exception 'L''azienda agricola non ha potuto chiudere il 1996.';
    end if;
    select count(*) into v_n from chiusure_annuali where anno = 1996;
    if v_n <> 2 then
      raise exception 'Il 1996 doveva avere due chiusure, una per soggetto: ne ha %.', v_n;
    end if;
    if (select entity_id from chiusure_annuali where id = v_id)
       = (select entity_id from chiusure_annuali where id = v_id2) then
      raise exception 'Le due chiusure del 1996 sono dello stesso soggetto.';
    end if;

    -- =================================================================
    -- (5) LA TASCA NON HA UN ANNO FISCALE DA CHIUDERE
    -- =================================================================
    if v_tasca is not null then
      respinto := false;
      begin
        perform chiudi_anno(v_tasca, 1996, true, null);
      exception when others then
        respinto := true;
      end;
      if not respinto then
        raise exception 'La tasca ha potuto chiudere un anno fiscale.';
      end if;
    end if;

    -- =================================================================
    -- (6) 🔴 L'AVVISO: un conto senza documento ferma la chiusura.
    -- =================================================================
    insert into orders (entity_id, table_label, status, closed_at, coperti, coperto_unit_price)
      values (v_ent, '__VERIFICA C5__', 'chiuso',
              (date '1996-06-02' + time '21:00') at time zone 'Europe/Rome', 2, 20)
      returning id into v_conto;

    select * into m from misure_dell_anno(v_ent, 1997);
    if m.conti_senza_documento <> 0 then
      raise exception 'Il conto del 1996 e'' finito nel 1997: il perimetro dell''anno non tiene.';
    end if;

    select * into m from misure_dell_anno(v_ent, 1996);
    if m.conti_senza_documento <> 1 then
      raise exception 'Il conto senza documento del 1996 non e'' stato contato: ne risultano %.', m.conti_senza_documento;
    end if;
    if m.incasso_senza_documento <= 0 then
      raise exception 'Il conto senza documento vale % euro: l''incasso non e'' stato sommato.', m.incasso_senza_documento;
    end if;

    -- Si toglie la chiusura pulita, per poter riprovare sullo stesso anno.
    delete from chiusure_annuali where id = v_id;

    respinto := false;
    v_msg := '';
    begin
      perform chiudi_anno(v_ent, 1996, false, null);
    exception when others then
      respinto := true;
      v_msg := sqlerrm;
    end;
    if not respinto then
      raise exception 'L''anno si e'' chiuso in silenzio pur avendo un conto senza documento.';
    end if;
    -- Il rifiuto dice QUANTI sono e QUANTO valgono: un rifiuto che dice
    -- solo «non posso» non fa sapere cosa si sta per lasciare indietro.
    if v_msg not like '%1 conto%' then
      raise exception 'Il rifiuto non dice quanti conti sono: «%»', v_msg;
    end if;
    if v_msg not like '%€%' then
      raise exception 'Il rifiuto non dice quanto valgono: «%»', v_msg;
    end if;

    -- =================================================================
    -- (7) ANNULLARE NON SCRIVE NIENTE
    -- =================================================================
    select count(*) into v_n from chiusure_annuali where entity_id = v_ent and anno = 1996;
    if v_n <> 0 then
      raise exception 'Il rifiuto ha lasciato % chiusure del 1996.', v_n;
    end if;

    -- =================================================================
    -- (8) CON LA CONFERMA SI CHIUDE — E IL CONTO NON VIENE TOCCATO
    -- =================================================================
    select documento_fiscale, closed_at into v_doc, v_chiuso from orders where id = v_conto;

    v_id := chiudi_anno(v_ent, 1996, true, '__VERIFICA C5 con avviso__');
    select * into r from chiusure_annuali where id = v_id;
    if r.conti_senza_documento <> 1 then
      raise exception 'La chiusura con avviso doveva conservare 1 conto senza documento, ne ha %.', r.conti_senza_documento;
    end if;
    if r.incasso_senza_documento <= 0 then
      raise exception 'La chiusura con avviso non ha conservato l''incasso senza documento.';
    end if;
    -- 🔴 Ed e' cosi' che le due si distinguono nello storico, senza una
    --    seconda colonna che potrebbe contraddire la prima.
    if not (r.conti_senza_documento > 0) then
      raise exception 'La chiusura con avviso non si distingue da una pulita.';
    end if;
    -- ⚠️ E la macchina delle rifotografie e' la stessa del mese: quella
    --    pulita e' stata cancellata poco fa, e questa lo dichiara.
    if r.chiusure_precedenti is distinct from 1 then
      raise exception 'La seconda chiusura del 1996 doveva dichiarare 1 precedente, dichiara %.', r.chiusure_precedenti;
    end if;
    if r.prima_chiusura_il is null then
      raise exception 'La seconda chiusura non dice quando fu la prima.';
    end if;

    -- 🔴 IL CONFINE SU L21: il conto e' ESATTAMENTE dov'era.
    if (select documento_fiscale from orders where id = v_conto) is distinct from v_doc then
      raise exception 'La chiusura ha riclassificato il conto senza documento.';
    end if;
    if (select closed_at from orders where id = v_conto) is distinct from v_chiuso then
      raise exception 'La chiusura ha spostato la data del conto senza documento.';
    end if;
    if (select count(*) from orders where id = v_conto) <> 1 then
      raise exception 'La chiusura ha fatto sparire il conto senza documento.';
    end if;

    -- =================================================================
    -- (9) LO STORICO NON SI MUOVE SE DOPO CAMBIANO I DATI CORRENTI
    -- =================================================================
    v_ricavi := r.ricavi;
    insert into orders (entity_id, table_label, status, closed_at, coperti, coperto_unit_price)
      values (v_ent, '__VERIFICA C5 dopo__', 'chiuso',
              (date '1996-07-07' + time '21:00') at time zone 'Europe/Rome', 4, 25);
    select * into r from chiusure_annuali where id = v_id;
    if r.ricavi is distinct from v_ricavi then
      raise exception 'La fotografia del 1996 e'' cambiata dopo: da % a %.', v_ricavi, r.ricavi;
    end if;
    if r.conti_senza_documento <> 1 then
      raise exception 'La fotografia del 1996 ha ricontato i conti senza documento dopo la chiusura.';
    end if;
    -- ...mentre la MISURA dal vivo si e' mossa: e' la prova che lo
    -- storico e' fermo per scelta, non perche' non ci fosse niente da
    -- vedere.
    select * into m from misure_dell_anno(v_ent, 1996);
    if m.conti_senza_documento <> 2 then
      raise exception 'La misura dal vivo doveva vedere 2 conti senza documento, ne vede %.', m.conti_senza_documento;
    end if;

    -- =================================================================
    -- (10) UN ANNO NON FINITO NON SI CHIUDE
    -- =================================================================
    respinto := false;
    begin
      perform chiudi_anno(v_ent, extract(year from serata_di_servizio(now()))::integer, true, null);
    exception when others then
      respinto := true;
      v_msg := sqlerrm;
    end;
    if not respinto then
      raise exception 'L''anno in corso si e'' lasciato chiudere.';
    end if;
    if v_msg not like '%non e%ancora finito%' then
      raise exception 'Il rifiuto dell''anno in corso non dice che non e'' finito: «%»', v_msg;
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della chiusura annuale');
  perform set_config('request.jwt.claims', null, true);

  raise notice 'Fatto: l''anno si chiude, si rifiuta di chiudersi in silenzio con conti senza documento, non li tocca, e lo storico non si muove piu''. Provato e annullato: zero residui.';
end $verifica$;

-- La migrazione si registra da sé
insert into applied_migrations (version, name)
values ('20260923000003', 'la_chiusura_dell_anno_fiscale')
on conflict (version) do nothing;
