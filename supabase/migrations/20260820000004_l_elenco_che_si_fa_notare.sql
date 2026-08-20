-- =====================================================================
-- L'ELENCO CHE SI FA NOTARE — blocco 1 del mandato del registratore
-- 20/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260820_il_registratore_telematico.md
--
-- 🔴 IL GESTO CHE SI STA PROTEGGENDO. All'apertura il cameriere chiudera' il
-- conto sul gestionale e lo scontrino uscira' da solo. Per lui e' UN gesto,
-- per la macchina sono DUE — ed e' li' che nasce tutto: il caso che fa male
-- non e' quello in cui i totali coincidono, e' **il conto chiuso e lo
-- scontrino non uscito**. Nel gestionale l'incasso c'e', fiscalmente non
-- esiste, e il cliente e' gia' fuori dalla porta.
--
-- ⚠️ QUESTO BLOCCO NON CREA UN MODULO NUOVO: meta' esiste gia'
-- (`orders.documento_fiscale`, `conti_da_fiscalizzare`, `quadratura_fiscale`,
-- `documento_emesso_il`). Qui si aggiungono le tre cose che mancavano.
--
-- 1 · L'ELENCO SI FA NOTARE. Il conto si chiude sempre — la sala non si
--     blocca mai davanti al cliente — ma la **chiusura della giornata** non
--     si completa in silenzio finche' quell'elenco non e' vuoto o Alessio non
--     ne ha preso atto. *Un elenco che nessuno guarda non e' una rete*: e' la
--     stessa ragione per cui l'export si rifiuta e il manuale HACCP si
--     dichiara incompleto.
--     ⚠️ E «prendere atto» LASCIA UNA TRACCIA: `conteggi_cassa` registra
--     quanti conti restavano da fiscalizzare quella sera. Un permesso che non
--     si vede piu' e' un permesso che nessuno puo' contare.
--
-- 2 · LA SEGNALAZIONE MANUALE, e la puo' fare CHIUNQUE sia in sala. Serve
--     anche col registratore piu' moderno, perche' c'e' un buco che nessun
--     protocollo copre: **la stampante che risponde «fatto» e stampa una
--     pagina bianca**. Solo un occhio umano la vede.
--
-- 3 · LO SCARTO FRA LE DUE GIORNATE SI DICHIARA, NON SI APPIANA. Uno
--     scontrino ristampato il giorno dopo porta la data di quando esce,
--     mentre l'incasso appartiene alla serata in cui il cliente ha pagato.
--     L'incasso **resta nella serata giusta** e lo scarto si dice. Spostarlo
--     per far coincidere i due mondi farebbe risultare quella serata **piu'
--     magra del vero**.
--     🔴 E QUI C'ERA UN BUCO: `setDocumentoFiscale` scriveva
--     `documento_emesso_il` **solo per le fatture**, e per gli scontrini lo
--     azzerava. Uno scontrino ristampato tre giorni dopo non aveva nessuna
--     data, quindi lo scarto **non era nemmeno rappresentabile**. Ora la
--     data si scrive per tutti e due.
--
-- ⚠️ IL SIMULATORE NON E' DI QUESTO BLOCCO, ma il blocco e' disegnato
-- sapendo che arrivera': il punto in cui il gestionale parla col registratore
-- e' **uno solo e sostituibile** (`src/lib/registratore.js`), altrimenti il
-- simulatore dovrebbe infilarsi in dieci posti.
-- =====================================================================

-- ---------------------------------------------------------------------
-- LA REGOLA, IN UN POSTO SOLO
-- ---------------------------------------------------------------------
-- ⚠️ «Quali conti non hanno un documento» era scritto dentro
-- `conti_da_fiscalizzare`, che ha un portiere e serve alla schermata. Adesso
-- serve anche alla chiusura della giornata: se la copiassi la', due copie
-- della stessa regola comincerebbero a divergere al primo ritocco.
create or replace function conti_senza_documento(
  p_entity_id uuid,
  p_dal date default null,
  p_al  date default null
)
returns table(
  order_id   uuid,
  chiuso_il  timestamptz,
  tavolo     text,
  incasso    numeric,
  pagamento  text,
  coperti    integer,
  serata     date
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.closed_at, o.table_label,
         coalesce(d.collected_amount, t.totale),
         coalesce(o.payment_method::text, 'non indicato'),
         o.coperti,
         serata_di_servizio(o.closed_at)
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and (p_dal is null or serata_di_servizio(o.closed_at) >= p_dal)
     and (p_al  is null or serata_di_servizio(o.closed_at) <= p_al)
     and coalesce(d.collected_amount, t.totale) > 0
     and (o.documento_fiscale is null or o.documento_fiscale = 'fattura_da_emettere')
   order by o.closed_at desc;
$$;

revoke all on function conti_senza_documento(uuid, date, date) from public, anon, authenticated;

-- La schermata continua a chiamare la stessa di prima, che adesso e' un
-- involucro col portiere attorno alla regola unica.
create or replace function conti_da_fiscalizzare(
  p_entity_id uuid,
  p_dal date default null,
  p_al  date default null
)
returns table(
  order_id   uuid,
  chiuso_il  timestamptz,
  tavolo     text,
  incasso    numeric,
  pagamento  text,
  stato      text,
  coperti    integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  select c.order_id, c.chiuso_il, c.tavolo, c.incasso, c.pagamento,
         coalesce(o.documento_fiscale, 'da dire'), c.coperti
    from conti_senza_documento(p_entity_id, v_dal, v_al) c
    join orders o on o.id = c.order_id;
end;
$$;


-- ---------------------------------------------------------------------
-- LO SCARTO FRA LE DUE GIORNATE
-- ---------------------------------------------------------------------
-- ⚠️ Non e' un errore da correggere: e' un fatto da dichiarare. L'incasso
-- resta nella serata del cliente, il documento porta la data in cui e'
-- uscito, e questa funzione dice dove le due cose non coincidono — cosi' chi
-- confronta col registratore sa in quale giornata dell'apparecchio ritrovare
-- quel corrispettivo.
create or replace function conti_fiscalizzati_in_ritardo(
  p_entity_id uuid,
  p_dal date default null,
  p_al  date default null
)
returns table(
  order_id     uuid,
  tavolo       text,
  serata       date,
  emesso_il    date,
  giorni_dopo  integer,
  incasso      numeric,
  documento    text,
  numero       text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  select o.id, o.table_label,
         serata_di_servizio(o.closed_at), o.documento_emesso_il,
         (o.documento_emesso_il - serata_di_servizio(o.closed_at))::integer,
         coalesce(d.collected_amount, t.totale),
         o.documento_fiscale, o.documento_numero
    from orders o
    left join discounts_gifts d on d.id = o.discount_gift_id
    cross join lateral totale_conto(o.id) t
   where o.entity_id = p_entity_id
     and o.status in ('chiuso', 'omaggiato')
     and o.documento_fiscale in ('scontrino', 'fattura')
     and o.documento_emesso_il is not null
     and o.documento_emesso_il <> serata_di_servizio(o.closed_at)
     and serata_di_servizio(o.closed_at) between v_dal and v_al
   order by o.closed_at desc;
end;
$$;

revoke all on function conti_fiscalizzati_in_ritardo(uuid, date, date) from public, anon, authenticated;
grant execute on function conti_fiscalizzati_in_ritardo(uuid, date, date) to authenticated;


-- ---------------------------------------------------------------------
-- LA SEGNALAZIONE DELLA SALA
-- ---------------------------------------------------------------------
create table if not exists segnalazioni_fiscali (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  segnalato_il  timestamptz not null default now(),
  segnalato_da  uuid,
  nota          text,
  stato_prima   text
);

comment on table segnalazioni_fiscali is
  'Chi in sala ha detto «questo scontrino non e'' uscito», e quando (20/08/2026). ⚠️ Serve anche col registratore piu'' moderno: la stampante che risponde «fatto» e stampa una pagina bianca non la vede nessun protocollo, solo un occhio.';

create index if not exists idx_segnalazioni_fiscali_conto
  on segnalazioni_fiscali (order_id, segnalato_il desc);

alter table segnalazioni_fiscali enable row level security;

-- ⚠️ Lettura aperta allo staff: qui dentro non ci sono importi, e chi ha
-- segnalato deve poter vedere che la segnalazione c'e'. La scrittura passa
-- solo dalla funzione.
drop policy if exists segnalazioni_fiscali_select on segnalazioni_fiscali;
create policy segnalazioni_fiscali_select on segnalazioni_fiscali
  for select to authenticated using (true);

create or replace function segnala_scontrino_non_uscito(
  p_order_id uuid,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conto  orders;
  v_prima  text;
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per segnalare uno scontrino.';
  end if;

  select * into v_conto from orders where id = p_order_id;
  if not found then
    raise exception 'Questo conto non esiste piu''.';
  end if;
  if v_conto.status not in ('chiuso', 'omaggiato') then
    raise exception 'Si segnala solo un conto gia'' chiuso: questo e'' ancora %.', v_conto.status;
  end if;

  -- ⚠️ UNA FATTURA NON SI DISFA DA QUI, e il rifiuto dice cosa fare: ha un
  -- numero, e un numero emesso non si toglie con un tocco in sala. Il
  -- meccanismo che serve esiste gia' (Cassa → Incassato e scontrinato).
  if v_conto.documento_fiscale = 'fattura' then
    raise exception 'Su questo conto risulta una fattura numero %: una fattura non si disfa dalla sala. Dillo ad Alessio, si corregge da Cassa.',
      coalesce(v_conto.documento_numero, 'senza numero');
  end if;

  v_prima := coalesce(v_conto.documento_fiscale, 'da dire');

  update orders
     set documento_fiscale = null,
         documento_numero = null,
         documento_emesso_il = null
   where id = p_order_id;

  insert into segnalazioni_fiscali (order_id, segnalato_da, nota, stato_prima)
  values (p_order_id, auth.uid(), nullif(btrim(p_nota), ''), v_prima);

  return jsonb_build_object(
    'order_id', p_order_id,
    'stato_prima', v_prima,
    'messaggio',
      case when v_prima = 'scontrino'
           then 'Segnalato: il conto torna fra quelli da fiscalizzare.'
           else 'Segnalato: il conto era gia'' fra quelli da fiscalizzare, e adesso c''e'' scritto perche''.'
      end
  );
end;
$$;

revoke all on function segnala_scontrino_non_uscito(uuid, text) from public, anon, authenticated;
grant execute on function segnala_scontrino_non_uscito(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- LA CHIUSURA DELLA GIORNATA CHE NON SI COMPLETA IN SILENZIO
-- ---------------------------------------------------------------------
alter table conteggi_cassa
  add column if not exists conti_da_fiscalizzare integer not null default 0;

comment on column conteggi_cassa.conti_da_fiscalizzare is
  'Quanti conti incassati restavano senza documento fiscale la sera in cui si e'' chiuso il cassetto (20/08/2026). ⚠️ Zero e'' il caso normale. Un numero diverso da zero vuol dire che Alessio ha chiuso la giornata PRENDENDO ATTO: il permesso resta scritto, altrimenti nessuno potrebbe contarlo.';

create or replace function registra_conteggio_cassa(
  p_entity_id uuid,
  p_contato numeric,
  p_data date default serata_di_servizio(),
  p_nota text default null,
  p_preso_atto boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teorico   numeric;
  v_diff      numeric;
  v_causale   uuid;
  v_movimento uuid;
  v_conteggio uuid;
  v_serata    date := coalesce(p_data, serata_di_servizio());
  v_aperti    integer;
begin
  if not is_titolare() then
    raise exception 'Il conteggio del cassetto e'' riservato al titolare.';
  end if;
  if p_contato is null or p_contato < 0 then
    raise exception 'Quanto hai contato nel cassetto? Serve un importo, anche zero.';
  end if;

  -- 🔴 L'ELENCO SI FA NOTARE QUI, e non in una schermata da aprire di
  -- propria iniziativa. ⚠️ Guarda quella serata **e tutte quelle prima**: un
  -- conto rimasto indietro tre giorni fa e' precisamente quello che nessuno
  -- ricorda piu'.
  select count(*) into v_aperti
    from conti_senza_documento(p_entity_id, null, v_serata);

  if v_aperti > 0 and not coalesce(p_preso_atto, false) then
    raise exception
      'Ci sono % conti incassati senza documento fiscale fino a questa serata. Sistemali da Cassa → Incassato e scontrinato, oppure chiudi lo stesso prendendone atto: il numero resta scritto sul conteggio.',
      v_aperti;
  end if;

  select contante_atteso into v_teorico from saldo_tesoreria(p_entity_id);
  v_diff := round(p_contato - v_teorico, 2);

  insert into conteggi_cassa
    (entity_id, contato_il, teorico, contato, differenza, nota, contato_da, conti_da_fiscalizzare)
  values (p_entity_id, v_serata, v_teorico, p_contato, v_diff, p_nota, auth.uid(), v_aperti)
  returning id into v_conteggio;

  if v_diff <> 0 then
    select id into v_causale from cash_causali
     where di_sistema
       and label = case when v_diff < 0 then 'Differenza di cassa in meno'
                        else 'Differenza di cassa in più' end
     limit 1;
    if v_causale is null then
      raise exception 'Manca la causale di sistema per la differenza di cassa.';
    end if;

    insert into cash_movements
      (entity_id, direction, amount, movement_date, causale_id, mezzo, tipo_documento, note)
    values
      (p_entity_id,
       case when v_diff < 0 then 'uscita' else 'entrata' end::cash_direction,
       abs(v_diff),
       v_serata,
       v_causale,
       'cassa',
       'non_documentato',
       'Differenza rilevata contando il cassetto il '
         || to_char(v_serata, 'DD/MM/YYYY')
         || coalesce('. ' || p_nota, ''))
    returning id into v_movimento;

    update conteggi_cassa set movimento_id = v_movimento where id = v_conteggio;
  end if;

  return v_conteggio;
end;
$$;

revoke all on function registra_conteggio_cassa(uuid, numeric, date, text, boolean) from public, anon, authenticated;
grant execute on function registra_conteggio_cassa(uuid, numeric, date, text, boolean) to authenticated;

-- ⚠️ La versione a quattro parametri va TOLTA, non lasciata accanto: in
-- Postgres un parametro in piu' fa una funzione NUOVA, e due sovrapposte
-- rendono ambigua ogni chiamata per nome (42725, a tempo di esecuzione).
-- Lasciandola, il corridoio avrebbe potuto continuare a chiamare quella
-- vecchia — cioe' la chiusura della giornata SENZA la rete.
drop function if exists registra_conteggio_cassa(uuid, numeric, date, text);


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_conto  uuid;
  v_ok     boolean;
  v_msg    text;
  v_n      integer;
  v_esito  jsonb;
  v_cont   uuid;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  -- 1 · CON L'ELENCO VUOTO LA GIORNATA SI CHIUDE NORMALMENTE.
  --     🔴 E' la prova all'incontrario, senza la quale la seconda non
  --     misurerebbe niente: un avviso che compare sempre e' un avviso che si
  --     impara a ignorare. Si sceglie una serata lontana e vuota.
  select count(*) into v_n from conti_senza_documento(v_ente, null, date '1995-06-01');
  if v_n <> 0 then
    raise exception 'La serata di prova non e'' vuota: questo controllo non distinguerebbe niente.';
  end if;
  v_cont := registra_conteggio_cassa(v_ente, 0, date '1995-06-01', '__VERIFICA__ elenco vuoto');
  if (select conti_da_fiscalizzare from conteggi_cassa where id = v_cont) <> 0 then
    raise exception 'Con l''elenco vuoto il conteggio dichiara conti da fiscalizzare.';
  end if;

  -- 2 · UN CONTO INCASSATO SENZA DOCUMENTO BLOCCA LA CHIUSURA.
  -- ⚠️ Il valore del conto arriva dai COPERTI, non da una riga di comanda:
  -- due guardie del 16/08 vietano di togliere una riga da un conto chiuso e
  -- di cancellarne una gia' andata in cucina — giustamente, perche' il
  -- totale su cui si e' incassato non deve cambiare dopo. Passare da li'
  -- avrebbe costretto la verifica a SPEGNERE quelle guardie per ripulirsi, e
  -- una verifica che disattiva una protezione per fare pulizia e' il primo
  -- passo verso una che la lascia spenta.
  insert into orders (entity_id, table_label, status, closed_at, coperti, coperto_unit_price)
    values (v_ente, '__VERIFICA__ fisc', 'chiuso',
            (date '1995-06-02' + time '21:00') at time zone 'Europe/Rome', 2, 20)
    returning id into v_conto;

  select count(*) into v_n from conti_senza_documento(v_ente, null, date '1995-06-02');
  if v_n < 1 then
    raise exception 'Il conto di prova non risulta senza documento: il resto non proverebbe niente.';
  end if;

  v_ok := false;
  begin
    perform registra_conteggio_cassa(v_ente, 0, date '1995-06-02', '__VERIFICA__ bloccato');
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    v_ok := v_msg like '%senza documento fiscale%';
  end;
  if not v_ok then
    raise exception 'La chiusura della giornata si e'' completata in silenzio con dei conti da fiscalizzare (messaggio: %).',
      coalesce(v_msg, 'nessuno');
  end if;

  -- 3 · PRENDENDONE ATTO si chiude, e il numero RESTA SCRITTO.
  v_cont := registra_conteggio_cassa(v_ente, 0, date '1995-06-02', '__VERIFICA__ preso atto', true);
  if (select conti_da_fiscalizzare from conteggi_cassa where id = v_cont) < 1 then
    raise exception 'Il conteggio non ha registrato quanti conti restavano da fiscalizzare.';
  end if;

  -- 4 · LA SEGNALAZIONE DELLA SALA riporta indietro uno scontrino
  --     «uscito». E' il caso della pagina bianca: l'apparecchio ha detto
  --     fatto, e in mano non c'e' niente.
  update orders
     set documento_fiscale = 'scontrino', documento_numero = '1',
         documento_emesso_il = date '1995-06-02'
   where id = v_conto;

  select count(*) into v_n from conti_senza_documento(v_ente, null, date '1995-06-02');
  if v_n <> 0 then
    raise exception 'Il conto risulta ancora da fiscalizzare dopo essere stato scontrinato.';
  end if;

  v_esito := segnala_scontrino_non_uscito(v_conto, '__VERIFICA__ pagina bianca');

  select count(*) into v_n from conti_senza_documento(v_ente, null, date '1995-06-02');
  if v_n <> 1 then
    raise exception 'Dopo la segnalazione il conto non e'' tornato fra quelli da fiscalizzare (ne risultano %).', v_n;
  end if;
  if (select documento_numero from orders where id = v_conto) is not null then
    raise exception 'La segnalazione ha lasciato il numero del documento addosso al conto.';
  end if;
  if (v_esito->>'stato_prima') <> 'scontrino' then
    raise exception 'La segnalazione non dice da quale stato si tornava indietro: «%».', v_esito->>'stato_prima';
  end if;
  if not exists (select 1 from segnalazioni_fiscali
                  where order_id = v_conto and segnalato_da = v_tit) then
    raise exception 'La segnalazione non ha lasciato traccia di chi l''ha fatta.';
  end if;

  -- 5 · UNA FATTURA NON SI DISFA DALLA SALA, e il rifiuto dice cosa fare.
  update orders
     set documento_fiscale = 'fattura', documento_numero = 'FT-1',
         documento_emesso_il = date '1995-06-02'
   where id = v_conto;
  v_ok := false;
  begin
    perform segnala_scontrino_non_uscito(v_conto, null);
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    v_ok := v_msg like '%fattura%';
  end;
  if not v_ok then
    raise exception 'Una fattura e'' stata disfatta dalla sala.';
  end if;

  -- 6 · LO SCARTO FRA LE DUE GIORNATE SI DICHIARA.
  --     Il conto e' della serata del 2 giugno; lo scontrino esce il 4.
  --     ⚠️ L'incasso NON si sposta: resta nella serata del cliente, e lo
  --     scarto si legge accanto.
  update orders
     set documento_fiscale = 'scontrino', documento_numero = '2',
         documento_emesso_il = date '1995-06-04'
   where id = v_conto;

  select count(*) into v_n
    from conti_fiscalizzati_in_ritardo(v_ente, date '1995-06-01', date '1995-06-30');
  if v_n <> 1 then
    raise exception 'Lo scarto fra la serata e il giorno del documento non e'' dichiarato (righe: %).', v_n;
  end if;
  if (select giorni_dopo from conti_fiscalizzati_in_ritardo(v_ente, date '1995-06-01', date '1995-06-30')) <> 2 then
    raise exception 'Lo scarto dichiarato non e'' di due giorni.';
  end if;
  -- ⚠️ E la serata dichiarata e' quella del CLIENTE, non quella del
  -- documento: e' tutta qui la decisione di Alessio.
  if (select serata from conti_fiscalizzati_in_ritardo(v_ente, date '1995-06-01', date '1995-06-30'))
     <> date '1995-06-02' then
    raise exception 'L''incasso e'' stato spostato sulla giornata del documento.';
  end if;

  -- =========== PULIZIA ===========
  -- ⚠️ LE LAPIDI: `cash_movements` e `conteggi_cassa` sono fra le tabelle
  -- tracciate (`orders` no, misurato), quindi cancellare qui lascerebbe copie
  -- finte in un registro che NESSUNO puo' ripulire dall'app. E' successo il
  -- 19/08 e ci sono volute una migrazione e una prova nuove per rimediare.
  -- Si spengono i tre guardiani per la sola pulizia, e si CONTROLLA di
  -- averli riaccesi: lasciarne uno spento vorrebbe dire perdere per sempre
  -- la traccia delle cancellazioni vere.
  alter table cash_movements disable trigger trg_log_delete;
  alter table conteggi_cassa disable trigger trg_log_delete;

  delete from segnalazioni_fiscali where order_id = v_conto;
  delete from orders where id = v_conto;
  -- ⚠️ Solo i movimenti che porta la firma della verifica: cancellarli per
  -- data prenderebbe anche quello che ci fosse gia' su quelle giornate.
  delete from cash_movements where note like '%__VERIFICA__%';
  delete from conteggi_cassa where nota like '__VERIFICA__%';

  alter table cash_movements enable trigger trg_log_delete;
  alter table conteggi_cassa enable trigger trg_log_delete;

  -- ⚠️ RIACCESI DAVVERO, chiesto al catalogo e non alla memoria: un
  -- guardiano lasciato spento non da' nessun errore — smette e basta.
  if (select count(*) from pg_trigger t2
       join pg_class c2 on c2.oid = t2.tgrelid
      where t2.tgname = 'trg_log_delete'
        and c2.relname in ('cash_movements', 'conteggi_cassa')
        and t2.tgenabled = 'O') <> 2 then
    raise exception 'La verifica ha lasciato spento un guardiano delle cancellazioni.';
  end if;

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from orders where table_label like '__VERIFICA__%')
     or exists (select 1 from conteggi_cassa where nota like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'La chiusura della giornata non si completa in silenzio, la sala puo'' segnalare, e lo scarto si dichiara.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000004', 'l_elenco_che_si_fa_notare')
on conflict (version) do nothing;
