-- =====================================================================
-- UNA COMMISSIONE, UNA UNITA'
-- 24/08/2026 — la parte del debito «percento» che morde per prima
-- =====================================================================
-- 🔴 IL CASO, chiesto da Alessio dopo che il validatore l'ha verificato
-- in produzione: `commissione_pos_percento` esiste in DUE tabelle, con
-- DUE unita' diverse.
--
--   scenari_proiezione.commissione_pos_percento     numeric(6,4)  FRAZIONE
--     0,015 = 1,5%   ->  ricavi * elettronici * commissione
--   impostazioni_tesoreria.commissione_pos_percento numeric(5,2)  PUNTI
--     1,5   = 1,5%   ->  (lordo + mance) * commissione / 100
--
-- ⚠️ E CIASCUNA META' E' COERENTE CON SE' STESSA — ed e' esattamente
-- questo che la rende pericolosa. Chi usa il gestionale digita «1,5» in
-- tutte e due le schermate e vede «1,5%» in tutte e due: **oggi l'utente
-- non puo' sbagliare.** A sbagliare e' chi scrive codice o semina dati,
-- che e' esattamente come sono nate le aliquote a 0,24.
--
-- 🔴 IL GIORNO IN CUI MORDE SI SA QUAL E': la commissione e' **un solo
-- fatto del mondo** — quanto trattiene la banca — e prima o poi qualcuno
-- vorra' leggerla da un posto solo (la Proiezione che usa la commissione
-- vera invece di quella prevista). Copiare il valore da una tabella
-- all'altra lo sbaglia **di cento volte**, e il risultato resta
-- plausibile: l'1,5% diventa 0,015% oppure 150%. La seconda si nota
-- subito, la prima sparisce nell'arrotondamento — ed e' quella che fa
-- danno.
--
-- ⚠️ OGGI TACE SOLO PERCHE' LA COLONNA E' VUOTA: zero righe in
-- `impostazioni_tesoreria`, in produzione **e** sulla prova (misurato,
-- non dedotto). Alessio la riempira' quando sceglie la banca e configura
-- il POS — fra qualche settimana. **Adesso la conversione non tocca
-- nessun dato; fra un mese sarebbe una migrazione con dentro una
-- decisione su un numero vero.**
--
-- ---------------------------------------------------------------------
-- QUALE CONVENZIONE VINCE, E PERCHE' NON E' LA PIU' DIFFUSA
-- ---------------------------------------------------------------------
-- Nel database i punti sono maggioritari (13 colonne contro 9), e «1,5»
-- si scrive come lo dice la banca. Verrebbe da uniformare li'. **E'
-- sbagliato**, e si vede solo guardando le schermate:
--
--   · in `PrevisioneForm` TUTTE le percentuali passano da `daPercento` —
--     food cost, pagamenti elettronici, tasso, pressione. Portare la sola
--     commissione in punti farebbe di quel campo **un'eccezione dentro la
--     stessa schermata**: un difetto peggiore di quello che chiude.
--   · in tesoreria la colonna e' **vuota**: cambiarla costa zero righe e
--     due punti di codice (la schermata e il calcolo).
--
-- Quindi: **frazione**, e la tesoreria si adegua. Chi scrive continua a
-- digitare «1,5» e a leggere «1,5%» — la conversione e' una faccenda del
-- database e non deve affacciarsi.
--
-- ⚠️ LE ALTRE COPPIE «STESSO NOME, TABELLE DIVERSE» SONO STATE CERCATE
-- (chiesto da Alessio: «se altre coppie hanno lo stesso problema,
-- chiudile insieme a questa»). Il setaccio ne ha trovate nove; otto **non
-- sono ambiguita' di unita'**:
--   · `importo`, `total_amount`, `unit_price`, `price` — tutti euro,
--     cambia solo la capienza o i decimali (12,2 contro 14,2). Leggendoli
--     non c'e' nessuna scelta da fare.
--   · `coperti` — numeri di persone dappertutto.
--   · `differenza`, `quantita`, `quantity` — ⚠️ nomi uguali su **concetti
--     diversi**: euro di cassa contro chili di giacenza, porzioni ordinate
--     contro chili di ricetta. E' un problema di *leggibilita'*, non di
--     unita': nessuno puo' prendere l'una per l'altra, perche' non
--     rispondono alla stessa domanda. Annotati, non toccati.
-- **`commissione_pos_percento` e' l'unica dove lo stesso identico fatto
-- e' conservato in due unita'.**
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La colonna passa in frazione
-- ---------------------------------------------------------------------
-- ⚠️ La conversione dei valori esistenti c'e' lo stesso, anche se oggi non
-- ha niente da convertire: **una sanatoria dichiara quanto ha toccato**
-- (regola del 16/08), e uno zero e' un'informazione. E se questa
-- migrazione girasse su un database dove qualcuno ha gia' scritto in
-- punti, deve saperlo fare.
do $conversione$
declare
  v_tipo    text;
  v_toccate integer := 0;
begin
  select format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_attribute a
    join pg_class t on t.oid = a.attrelid
   where t.relname = 'impostazioni_tesoreria'
     and a.attname = 'commissione_pos_percento';

  if v_tipo = 'numeric(5,2)' then
    -- Prima il vincolo vecchio, o rifiuterebbe i valori nuovi.
    alter table impostazioni_tesoreria
      drop constraint if exists impostazioni_tesoreria_commissione_pos_percento_check;

    update impostazioni_tesoreria
       set commissione_pos_percento = commissione_pos_percento / 100
     where commissione_pos_percento is not null;
    get diagnostics v_toccate = row_count;

    alter table impostazioni_tesoreria
      alter column commissione_pos_percento type numeric(6,4);

    raise notice 'Commissione POS portata in frazione. Righe convertite: %.', v_toccate;
  else
    raise notice 'La commissione POS e'' gia'' in frazione (%): niente da convertire.', v_tipo;
  end if;
end $conversione$;

-- ---------------------------------------------------------------------
-- 2 · Il vincolo che la protegge
-- ---------------------------------------------------------------------
-- ⚠️ Il limite CERTO e' 0..1: sopra 1 non e' una frazione. Il limite
-- SOSPETTO — una commissione oltre il 10% — non si rifiuta: si mostra
-- (`numeri_sospetti()`), perche' e' strano, non impossibile.
--
-- ⚠️ E il vincolo vecchio arrivava a 10 **punti**: chi avesse scritto la
-- frazione (0,015) sarebbe passato lo stesso, e chi scrivera' i punti
-- (1,5) sarebbe passato lo stesso. Accettava tutti e due i significati —
-- che e' la forma silenziosa che questo giro chiude dappertutto.
alter table impostazioni_tesoreria
  drop constraint if exists impostazioni_tesoreria_commissione_pos_percento_check;

-- ⚠️ E ANCHE IL PROPRIO, o la seconda applicazione si ferma su «è già
-- lì». Trovato dalla controprova e non rileggendo: rompendo apposta il
-- limite per vedere se la verifica diventava rossa, la migrazione si è
-- fermata **prima** di arrivarci — quindi il rosso non provava niente.
-- Riapplicare a mano una migrazione è normale in questo progetto (§5.3).
alter table impostazioni_tesoreria
  drop constraint if exists tesoreria_commissione_e_una_frazione;

alter table impostazioni_tesoreria
  add constraint tesoreria_commissione_e_una_frazione
  check (commissione_pos_percento is null
         or (commissione_pos_percento >= 0 and commissione_pos_percento <= 1));

comment on constraint tesoreria_commissione_e_una_frazione on impostazioni_tesoreria is
  'La commissione del POS si conserva come frazione: 1,5% si scrive 0,015. Nella schermata si digita 1,5 e la conversione la fa il gestionale — se questo rifiuto compare, il numero sta arrivando in punti da qualche parte che non converte.';

-- ---------------------------------------------------------------------
-- 3 · Il calcolo smette di dividere per cento
-- ---------------------------------------------------------------------
-- ⚠️ CORPO PRESO DAL DATABASE VIVO, non dal file che l'ha creata (regola
-- del 18/08): fra la migrazione del 15/08 e oggi quella funzione e' stata
-- toccata — le quote con carta al posto dei conti chiusi con carta — e
-- ricopiarla dal file l'avrebbe riportata indietro in silenzio.
--
-- ⚠️ Cambiano TRE punti, e il terzo e' quello che si dimentica:
--   · le commissioni:  * v_comm / 100        ->  * v_comm
--   · il netto:        * (100 - v_comm) / 100 ->  * (1 - v_comm)
--   · la FRASE:        percento(v_comm * 100)      ->  percento(v_comm)
-- Senza il terzo il numero sarebbe giusto e la frase direbbe «al netto
-- della commissione dello 0,015%»: un numero giusto con accanto una
-- didascalia falsa, che e' peggio di un numero sbagliato.
create or replace function pos_in_transito(p_entity_id uuid)
returns table(lordo numeric, mance numeric, commissioni numeric,
              netto_atteso numeric, conti integer, avvertenza text)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_giorni integer;
  v_comm   numeric;
  v_lordo  numeric;
  v_mance  numeric;
  v_conti  integer;
  v_da     date;
begin
  if not is_titolare() then
    raise exception 'I saldi sono riservati al titolare.';
  end if;

  select i.giorni_accredito_pos, i.commissione_pos_percento
    into v_giorni, v_comm
    from impostazioni_tesoreria i where i.entity_id = p_entity_id;

  v_da := case when v_giorni is null then null else oggi_a_roma() - v_giorni end;

  -- ⚠️ Le QUOTE con carta, non i conti «chiusi con carta»: un conto pagato
  -- meta' e meta' portava zero al POS, e il giorno dell'accredito la
  -- banca avrebbe versato una cifra che il gestionale non aspettava.
  select coalesce(sum(p.importo), 0), count(distinct p.order_id)
    into v_lordo, v_conti
    from order_payments p
    join orders o on o.id = p.order_id
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and p.mezzo = 'carta'
     and (v_da is null or (o.closed_at at time zone 'Europe/Rome')::date >= v_da);

  select coalesce(sum(tc.amount), 0) into v_mance
    from tips_collected tc
   where tc.entity_id = p_entity_id
     and tc.mezzo = 'carta'
     and (v_da is null or tc.collected_date >= v_da);

  return query select
    v_lordo,
    v_mance,
    case when v_comm is null then null else round((v_lordo + v_mance) * v_comm, 2) end,
    case when v_comm is null then null else round((v_lordo + v_mance) * (1 - v_comm), 2) end,
    v_conti,
    (case when v_giorni is null
          then 'Non so in quanti giorni accredita la banca, quindi qui c''e'' TUTTO l''incassato con carta, anche quello gia'' arrivato. '
          else 'Incassi con carta degli ultimi ' || v_giorni || ' giorni. ' end)
    || (case when v_comm is null
             then 'E l''importo e'' LORDO: non so quanto trattiene di commissione. Impostali quando la banca risponde (domanda B2).'
             else 'Al netto della commissione del ' || percento(v_comm * 100) || '%.' end)
    || (case when v_mance > 0
             then ' Comprende ' || euro(v_mance)
                  || ' euro di mance: la banca accredita anche quelle, ma non sono ricavi tuoi.'
             else '' end);
end;
$function$;

revoke all on function pos_in_transito(uuid) from public, anon;
grant execute on function pos_in_transito(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — e la controprova, che e' la parte che discrimina
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_entita   uuid;
  v_tipo     text;
  v_respinto boolean;
  v_comm     numeric;
  v_avv      text;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_esisteva boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_entita from entities limit 1;
  if v_entita is null then
    raise exception 'Nessuna entita'': impossibile verificare.';
  end if;

  -- (a) La colonna e' davvero una frazione a quattro decimali.
  select format_type(a.atttypid, a.atttypmod) into v_tipo
    from pg_attribute a join pg_class t on t.oid = a.attrelid
   where t.relname = 'impostazioni_tesoreria'
     and a.attname = 'commissione_pos_percento';
  if v_tipo <> 'numeric(6,4)' then
    raise exception 'La commissione POS e'' rimasta %, non numeric(6,4).', v_tipo;
  end if;

  select exists(select 1 from impostazioni_tesoreria where entity_id = v_entita)
    into v_esisteva;

  -- (b) ⚠️ LA CONTROPROVA CHE DISCRIMINA: il numero scritto in PUNTI
  --     dev'essere respinto. Col vincolo vecchio (0..10) un 1,5 passava
  --     senza un fiato, ed era sbagliato di cento volte.
  v_respinto := false;
  begin
    insert into impostazioni_tesoreria (entity_id, commissione_pos_percento)
    values (v_entita, 1.5)
    on conflict (entity_id) do update set commissione_pos_percento = 1.5;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    raise exception 'Una commissione scritta in punti (1,5) e'' stata accettata: il vincolo non discrimina.';
  end if;

  -- (c) E la frazione legittima passa. ⚠️ Il verso opposto conta quanto il
  --     primo: un limite che rifiuta anche i casi buoni e'' peggio di
  --     nessun limite.
  insert into impostazioni_tesoreria (entity_id, commissione_pos_percento, giorni_accredito_pos)
  values (v_entita, 0.015, 2)
  on conflict (entity_id) do update
    set commissione_pos_percento = 0.015, giorni_accredito_pos = 2;

  select commissione_pos_percento into v_comm
    from impostazioni_tesoreria where entity_id = v_entita;
  if v_comm <> 0.015 then
    raise exception 'La frazione legittima non e'' stata conservata: %.', v_comm;
  end if;

  -- (d) Il calcolo usa la frazione senza dividere, E LA FRASE DICE 1,5.
  --     ⚠️ Si guarda la frase perche' e'' il punto che si dimentica: il
  --     numero puo'' essere giusto con la didascalia falsa.
  select p.avvertenza into v_avv from pos_in_transito(v_entita) p;
  if v_avv not like '%commissione del 1,5%' then
    raise exception 'La frase non dichiara 1,5 per cento: «%».', v_avv;
  end if;

  -- (d-bis) ⚠️ E IL NUMERO, NON SOLO LA FRASE — SU QUALCOSA DA
  --     CALCOLARE. Trovato dalla controprova: rimettendo il `/ 100` nel
  --     calcolo la verifica restava **verde**, perche' senza incassi con
  --     carta il risultato e' zero in tutti e due i casi. E' la trappola
  --     del caso vuoto (§8, 17/08): la prova girava su uno stato dove non
  --     c'era niente da sbagliare.
  --
  --     Una mancia su carta da 100 euro basta: entra nello stesso calcolo
  --     degli incassi, e su 100 le due risposte si separano — 1,50 se il
  --     numero e'' una frazione, 0,02 se qualcuno lo divide ancora.
  declare
    v_mancia     uuid;
    v_comm_e     numeric;
    v_comm_prima numeric;
    v_acceso     boolean;
  begin
    select p.commissioni into v_comm_prima from pos_in_transito(v_entita) p;
    -- ⚠️ Il trigger delle lapidi si spegne PRIMA, o cancellare la mancia
    --     di prova lascerebbe una riga finta in un registro esibibile che
    --     nessuno puo'' ripulire dall''app (§8, 11/08 e 19/08).
    alter table tips_collected disable trigger trg_log_delete;

    insert into tips_collected (entity_id, amount, collected_date, mezzo, note)
    values (v_entita, 100, oggi_a_roma(), 'carta', 'verifica 20260824000015')
    returning id into v_mancia;

    select p.commissioni into v_comm_e from pos_in_transito(v_entita) p;
    -- ⚠️ LA DIFFERENZA, non il totale: sul progetto di prova ci sono gia'
    --     incassi con carta, e pretendere «1,50» ha dato 2,27 — rosso per
    --     lo stato di partenza invece che per il difetto. Una prova misura
    --     la differenza che produce LEI.
    if round(v_comm_e - v_comm_prima, 2) is distinct from 1.50 then
      raise exception 'Cento euro di mance all''1,5%% hanno aggiunto % di commissione invece di 1,50.',
        round(v_comm_e - v_comm_prima, 2);
    end if;

    -- Si cancella per identificativo, mai «l''ultima inserita» (23/08).
    delete from tips_collected where id = v_mancia;

    alter table tips_collected enable trigger trg_log_delete;

    -- ⚠️ Riacceso va VERIFICATO: lasciarlo spento vuol dire cancellazioni
    --     che smettono di lasciare traccia, in silenzio.
    select tgenabled <> 'D' into v_acceso
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'tips_collected' and t.tgname = 'trg_log_delete';
    if not coalesce(v_acceso, false) then
      raise exception 'Il registro delle cancellazioni e'' rimasto spento sulle mance.';
    end if;
  end;

  -- (e) Si rimette com'era. ⚠️ Si RIMETTE, non si cancella (regola del
  --     14/08): se la riga esisteva prima, cancellarla porterebbe via
  --     impostazioni di Alessio.
  if v_esisteva then
    update impostazioni_tesoreria
       set commissione_pos_percento = null, giorni_accredito_pos = null
     where entity_id = v_entita;
  else
    delete from impostazioni_tesoreria where entity_id = v_entita;
  end if;

  -- (f) Nessuna lapide lasciata dietro.
  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La commissione POS e'' una frazione in tutte e due le tabelle, e i punti vengono respinti.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000015', 'una_commissione_una_unita') on conflict (version) do nothing;
