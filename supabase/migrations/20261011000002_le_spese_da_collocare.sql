-- =====================================================================
-- LE SPESE «DA COLLOCARE» — 11/10/2026 (C12)
-- =====================================================================
-- Chiesto da Alessio nella relazione dell'11/10 («Spese da collocare»),
-- deciso da lui lo stesso giorno:
--   · il nome dell'area e' «Da collocare»;
--   · le destinazioni sono cinque: Prima nota, la mia tasca, anticipo da
--     rimborsare, Archivio documenti, oppure ignora;
--   · la foto di una ricevuta si TIENE finche' la spesa non e' collocata:
--     se va in Archivio resta (diventa il file del documento), altrimenti
--     si toglie;
--   · e TUTTE le spese dette a MEMO o fotografate passano di qui — non solo
--     quelle incomplete («2 tutte»).
--
-- 🔴 UN APPUNTO DI QUESTO ELENCO NON E' CONTABILITA'. Non scrive in prima
--    nota, non tocca la tasca, non e' un costo, non e' un anticipo, non
--    entra nella proiezione fiscale. E' una traccia consultabile di cio' che
--    MEMO ha capito, con l'originale accanto (il dettato o la foto).
--
-- 🔴 LA COLLOCAZIONE AVVIENE UNA VOLTA SOLA, ed e' una proprieta' del
--    database, non un pulsante spento: `colloca_spesa` scrive il dato
--    definitivo E segna l'appunto nella stessa transazione (corridoio, B4);
--    un trigger rifiuta di ricollocare un appunto gia' collocato o ignorato;
--    e i tre legami verso il dato definitivo sono UNICI, quindi lo stesso
--    movimento non puo' essere «la collocazione» di due appunti.
--
-- ⚠️ LA VOCE CONTINUA A CHIEDERE CONFERMA (SPEC-0013: niente si scrive da
--    se'). La differenza e' cosa si conferma: prima «scrivi questa uscita in
--    prima nota», adesso «mettila fra le spese da collocare». La scelta
--    contabile si sposta dal momento in cui si parla al momento in cui si e'
--    davanti al computer — che e' cio' che la relazione chiede.
--
-- ⚠️ I RAMI VECCHI NON SI TOLGONO: `movimento_cassa` e `spesa_tasca`
--    restano in `fai_azione_dettata`, perche' gli appunti vocali gia' in
--    attesa con quei tipi devono potersi ancora approvare. E' la funzione
--    online che smette di produrne per le uscite.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. L'ELENCO
-- ---------------------------------------------------------------------
create table if not exists spese_da_collocare (
  id                 uuid primary key default gen_random_uuid(),
  provenienza        text not null,
  -- Cio' che MEMO ha capito. Tutto facoltativo: una frase a meta' deve
  -- lasciare una traccia, non essere rifiutata.
  importo            numeric(14,2),
  data               date,
  controparte        text,
  descrizione        text,
  natura_proposta    text,
  causale_id         uuid references cash_causali(id) on delete set null,
  mezzo_proposto     text,
  documento_proposto text,
  -- L'originale, per poter risalire prima di decidere.
  testo_originale    text,
  incertezza         text,
  foto_path          text,
  foto_nome          text,
  -- La collocazione.
  stato              text not null default 'da_collocare',
  collocata_in       text,
  collocata_il       timestamptz,
  movimento_id       uuid references cash_movements(id) on delete restrict,
  anticipazione_id   uuid references anticipazioni_socio(id) on delete restrict,
  documento_id       uuid references documents(id) on delete restrict,
  creata_il          timestamptz not null default now(),
  creata_da          uuid references auth.users(id) on delete set null default auth.uid()
);

comment on table spese_da_collocare is
  'Le spese dette a MEMO o fotografate, prima di diventare contabilita'' (11/10/2026, C12). Un appunto qui NON e'' un movimento, non e'' un costo, non e'' un anticipo: e'' cio'' che MEMO ha capito, con l''originale accanto. Si colloca una volta sola, con colloca_spesa(), in prima nota, nella tasca, fra gli anticipi o in Archivio — oppure si ignora.';
comment on column spese_da_collocare.natura_proposta is
  'Dove MEMO pensa che vada, letto dalle parole («di tasca mia», «poi mi rimborso»). E'' una proposta: la scelta la fa Alessio collocando. Vuoto vuol dire che non ha detto niente che permetta di indovinarlo.';
comment on column spese_da_collocare.incertezza is
  'Che cosa MEMO non ha capito o non sa, in parole. Vuoto quando si e'' dichiarato sicuro.';
comment on column spese_da_collocare.foto_path is
  'Il file della foto nel deposito «documents», sotto da-collocare/. Si tiene finche'' l''appunto non e'' collocato: in Archivio diventa il file del documento, altrimenti si toglie e questa colonna si svuota.';

alter table spese_da_collocare drop constraint if exists spesa_provenienza_nota;
alter table spese_da_collocare add constraint spesa_provenienza_nota
  check (provenienza in ('voce', 'foto'));
comment on constraint spesa_provenienza_nota on spese_da_collocare is
  'Una spesa da collocare arriva da MEMO voce o da MEMO foto: scrivi «voce» oppure «foto».';

alter table spese_da_collocare drop constraint if exists spesa_stato_noto;
alter table spese_da_collocare add constraint spesa_stato_noto
  check (stato in ('da_collocare', 'collocata', 'ignorata'));
comment on constraint spesa_stato_noto on spese_da_collocare is
  'Una spesa e'' da collocare, collocata oppure ignorata: non ci sono altri stati.';

alter table spese_da_collocare drop constraint if exists spesa_natura_nota;
alter table spese_da_collocare add constraint spesa_natura_nota
  check (natura_proposta is null or natura_proposta in ('prima_nota', 'tasca', 'anticipo', 'archivio'));
comment on constraint spesa_natura_nota on spese_da_collocare is
  'La destinazione proposta e'' una di quattro: prima nota, la tua tasca, anticipo da rimborsare, archivio. Oppure vuota, se MEMO non lo sa.';

alter table spese_da_collocare drop constraint if exists spesa_collocata_in_nota;
alter table spese_da_collocare add constraint spesa_collocata_in_nota
  check (collocata_in is null or collocata_in in ('prima_nota', 'tasca', 'anticipo', 'archivio'));
comment on constraint spesa_collocata_in_nota on spese_da_collocare is
  'Una spesa si colloca in prima nota, nella tua tasca, fra gli anticipi o in archivio: non altrove.';

alter table spese_da_collocare drop constraint if exists spesa_mezzo_noto;
alter table spese_da_collocare add constraint spesa_mezzo_noto
  check (mezzo_proposto is null or mezzo_proposto in ('cassa', 'banca'));
comment on constraint spesa_mezzo_noto on spese_da_collocare is
  'I soldi sono usciti dalla cassa o dalla banca: scrivi uno dei due, oppure lascialo vuoto.';

alter table spese_da_collocare drop constraint if exists spesa_documento_noto;
alter table spese_da_collocare add constraint spesa_documento_noto
  check (documento_proposto is null or documento_proposto in ('fattura', 'scontrino', 'non_documentato'));
comment on constraint spesa_documento_noto on spese_da_collocare is
  'Il documento della spesa e'' una fattura, uno scontrino, oppure non c''e'': non altri.';

alter table spese_da_collocare drop constraint if exists spesa_importo_positivo;
alter table spese_da_collocare add constraint spesa_importo_positivo
  check (importo is null or importo > 0);
comment on constraint spesa_importo_positivo on spese_da_collocare is
  'Una spesa costa piu'' di zero euro. Se non sai quanto, lascia vuoto: vuoto vuol dire «non lo so», zero vorrebbe dire «gratis».';

-- 🔴 UNA TRACCIA DEV'ESSERE CONSULTABILE: almeno una cosa da guardare.
alter table spese_da_collocare drop constraint if exists spesa_ha_qualcosa;
alter table spese_da_collocare add constraint spesa_ha_qualcosa
  check (importo is not null
         or nullif(btrim(coalesce(descrizione, '')), '') is not null
         or nullif(btrim(coalesce(testo_originale, '')), '') is not null
         or foto_path is not null);
comment on constraint spesa_ha_qualcosa on spese_da_collocare is
  'Una spesa da collocare deve avere almeno qualcosa da guardare: l''importo, una descrizione, il dettato o la foto. Un appunto vuoto non si potrebbe mai collocare.';

-- 🔴 IL LEGAME COL DATO DEFINITIVO E' COERENTE CON LO STATO, sempre.
alter table spese_da_collocare drop constraint if exists spesa_collocazione_coerente;
alter table spese_da_collocare add constraint spesa_collocazione_coerente
  check (
    case stato
      when 'da_collocare' then collocata_in is null and collocata_il is null
                               and movimento_id is null and anticipazione_id is null and documento_id is null
      when 'ignorata'     then collocata_in is null and collocata_il is not null
                               and movimento_id is null and anticipazione_id is null and documento_id is null
      else collocata_il is not null and (
             (collocata_in in ('prima_nota', 'tasca') and movimento_id is not null
                and anticipazione_id is null and documento_id is null)
          or (collocata_in = 'anticipo' and anticipazione_id is not null
                and movimento_id is null and documento_id is null)
          or (collocata_in = 'archivio' and documento_id is not null
                and movimento_id is null and anticipazione_id is null))
    end);
comment on constraint spesa_collocazione_coerente on spese_da_collocare is
  'Una spesa collocata punta a una sola cosa, quella della sua destinazione; una da collocare o ignorata non punta a niente.';

-- Lo stesso dato definitivo non e' la collocazione di due appunti.
create unique index if not exists uniq_spesa_movimento     on spese_da_collocare(movimento_id)     where movimento_id is not null;
create unique index if not exists uniq_spesa_anticipazione on spese_da_collocare(anticipazione_id) where anticipazione_id is not null;
create unique index if not exists uniq_spesa_documento     on spese_da_collocare(documento_id)     where documento_id is not null;
create index if not exists idx_spese_da_collocare_aperte on spese_da_collocare(creata_il) where stato = 'da_collocare';

-- I tre legami in `restrict`: togliere il movimento o il documento nato da
-- una spesa lascerebbe l'appunto a dichiarare una collocazione che non
-- esiste piu' (la regola del 16/08, allo specchio). Il rifiuto dice perche'.
do $commenti$
declare v_n text;
begin
  for v_n in
    select conname from pg_constraint
     where conrelid = 'spese_da_collocare'::regclass and contype = 'f'
       and confrelid in ('cash_movements'::regclass, 'anticipazioni_socio'::regclass, 'documents'::regclass)
  loop
    execute format('comment on constraint %I on spese_da_collocare is %L', v_n,
      'Questa riga e'' nata da una spesa «Da collocare», che la nomina come sua collocazione: toglierla lascerebbe quell''appunto a dichiarare una cosa che non esiste piu''. Per ora non si toglie.');
  end loop;
end $commenti$;

alter table spese_da_collocare enable row level security;
drop policy if exists spese_da_collocare_titolare on spese_da_collocare;
create policy spese_da_collocare_titolare on spese_da_collocare
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ DAL BROWSER SI LEGGE E BASTA: si scrive solo dalle funzioni, che
--    sanno cosa vuol dire collocare. Un `update` diretto potrebbe segnare
--    «collocata» una spesa senza aver scritto niente altrove.
revoke all on spese_da_collocare from public, anon, authenticated;
grant select on spese_da_collocare to authenticated;

insert into perimetro_registro (tabella, dentro, ragione) values
  ('spese_da_collocare', false,
   'Un appunto prima della contabilita'': non si cancella dall''app (si ignora, e resta), e quando e'' collocato il dato vero vive nella sua tabella, che ha la sua traccia. Fuori dall''11/10/2026.')
on conflict (tabella) do nothing;

-- ---------------------------------------------------------------------
-- 2. UNA VOLTA SOLA — il guardiano
-- ---------------------------------------------------------------------
create or replace function guardia_spese_da_collocare()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    if old.stato = 'collocata' then
      raise exception 'Questa spesa e'' gia'' collocata: non si cancella, perche'' ha generato un dato vero.';
    end if;
    return old;
  end if;

  if old.stato <> 'da_collocare' then
    -- ⚠️ L'unica cosa che cambia dopo la collocazione e' la foto che se ne
    --    va: tutto il resto e' fermo.
    if (new.stato, new.collocata_in, new.collocata_il, new.movimento_id,
        new.anticipazione_id, new.documento_id, new.importo, new.data,
        new.descrizione, new.controparte)
       is distinct from
       (old.stato, old.collocata_in, old.collocata_il, old.movimento_id,
        old.anticipazione_id, old.documento_id, old.importo, old.data,
        old.descrizione, old.controparte)
       or (new.foto_path is not null and new.foto_path is distinct from old.foto_path) then
      raise exception 'Questa spesa e'' gia'' stata % il %: una spesa si colloca una volta sola.',
        case old.stato when 'ignorata' then 'ignorata' else 'collocata' end,
        to_char(old.collocata_il at time zone 'Europe/Rome', 'DD/MM/YYYY');
    end if;
  end if;
  return new;
end $fn$;

revoke all on function guardia_spese_da_collocare() from public, anon, authenticated;

drop trigger if exists trg_guardia_spese_da_collocare on spese_da_collocare;
create trigger trg_guardia_spese_da_collocare
  before update or delete on spese_da_collocare
  for each row execute function guardia_spese_da_collocare();

-- ---------------------------------------------------------------------
-- 3. SCRIVERE UN APPUNTO — un posto solo per le due porte
-- ---------------------------------------------------------------------
-- ⚠️ Non concessa a nessuno: la chiamano `fai_azione_dettata` (voce) e
--    `annota_spesa_da_collocare` (foto, col suo portiere).
-- ⚠️ Cio' che non si capisce non si inventa e non fa fallire: un importo
--    illeggibile resta vuoto e lo si dice nell'incertezza.
create or replace function scrivi_spesa_da_collocare(p_provenienza text, p_campi jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_c        jsonb := coalesce(p_campi, '{}'::jsonb);
  v_importo  numeric;
  v_data     date;
  v_testo    text;
  v_natura   text := nullif(btrim(coalesce(v_c->>'natura_proposta', '')), '');
  v_mezzo    text := nullif(btrim(coalesce(v_c->>'mezzo', '')), '');
  v_doc      text := nullif(btrim(coalesce(v_c->>'documento', '')), '');
  v_dubbi    text[] := '{}';
  v_id       uuid;
begin
  v_testo := nullif(btrim(coalesce(v_c->>'importo', '')), '');
  if v_testo is not null then
    if v_testo ~ '^[0-9]+([.,][0-9]+)?$' and replace(v_testo, ',', '.')::numeric > 0 then
      v_importo := round(replace(v_testo, ',', '.')::numeric, 2);
    else
      v_dubbi := v_dubbi || ('l''importo «' || v_testo || '» non si legge come una cifra');
    end if;
  end if;

  v_testo := nullif(btrim(coalesce(v_c->>'data', '')), '');
  if v_testo is not null then
    begin
      v_data := v_testo::date;
    exception when others then
      v_dubbi := v_dubbi || ('la data «' || v_testo || '» non si legge');
    end;
  end if;

  if v_natura is not null and v_natura not in ('prima_nota', 'tasca', 'anticipo', 'archivio') then
    v_natura := null;
  end if;
  if v_mezzo is not null and v_mezzo not in ('cassa', 'banca') then v_mezzo := null; end if;
  if v_doc is not null and v_doc not in ('fattura', 'scontrino', 'non_documentato') then v_doc := null; end if;

  insert into spese_da_collocare (
    provenienza, importo, data, controparte, descrizione, natura_proposta,
    causale_id, mezzo_proposto, documento_proposto, testo_originale,
    incertezza, foto_path, foto_nome)
  values (
    p_provenienza, v_importo, v_data,
    nullif(btrim(coalesce(v_c->>'controparte', '')), ''),
    nullif(btrim(coalesce(v_c->>'descrizione', '')), ''),
    v_natura,
    (select c.id from cash_causali c
      where c.id = case when coalesce(v_c->>'causale_id', '') ~ '^[0-9a-f-]{36}$'
                        then (v_c->>'causale_id')::uuid end),
    v_mezzo, v_doc,
    nullif(btrim(coalesce(v_c->>'testo_originale', '')), ''),
    nullif(concat_ws('; ', nullif(btrim(coalesce(v_c->>'incertezza', '')), ''),
                     nullif(array_to_string(v_dubbi, '; '), '')), ''),
    nullif(btrim(coalesce(v_c->>'foto_path', '')), ''),
    nullif(btrim(coalesce(v_c->>'foto_nome', '')), ''))
  returning id into v_id;
  return v_id;
end $fn$;

revoke all on function scrivi_spesa_da_collocare(text, jsonb) from public, anon, authenticated;

-- La porta della foto: una tabella sola, quindi niente corridoio.
create or replace function annota_spesa_da_collocare(p_campi jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not is_titolare() then
    raise exception 'Mettere una spesa fra quelle da collocare e'' riservato al titolare.';
  end if;
  return scrivi_spesa_da_collocare('foto', p_campi);
end $fn$;

revoke all on function annota_spesa_da_collocare(jsonb) from public, anon, authenticated;
grant execute on function annota_spesa_da_collocare(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. COLLOCARE — il dato definitivo e il segno, nella stessa transazione
-- ---------------------------------------------------------------------
-- `p_dove`: prima_nota | tasca | anticipo | archivio | ignora.
-- `p_campi` corregge cio' che MEMO aveva capito (importo, data,
-- descrizione, controparte) e porta cio' che serve alla destinazione
-- (causale_id, mezzo, conto_id, documento; tag_id, fondi; sezione, titolo).
create or replace function colloca_spesa(p_id uuid, p_dove text, p_campi jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_s        spese_da_collocare%rowtype;
  v_c        jsonb := coalesce(p_campi, '{}'::jsonb);
  v_importo  numeric;
  v_data     date;
  v_descr    text;
  v_contro   text;
  v_ent      uuid;
  v_mov      uuid;
  v_ant      uuid;
  v_doc      uuid;
  v_testo    text;
begin
  if not is_titolare() then
    raise exception 'Collocare una spesa e'' riservato al titolare.';
  end if;

  select * into v_s from spese_da_collocare where id = p_id for update;
  if not found then
    raise exception 'Questa spesa da collocare non c''e'' piu''.';
  end if;
  if v_s.stato <> 'da_collocare' then
    raise exception 'Questa spesa e'' gia'' stata % il %: una spesa si colloca una volta sola.',
      case v_s.stato when 'ignorata' then 'ignorata' else 'collocata' end,
      to_char(v_s.collocata_il at time zone 'Europe/Rome', 'DD/MM/YYYY');
  end if;

  -- Cio' che Alessio corregge vince su cio' che MEMO aveva capito.
  v_testo := nullif(btrim(coalesce(v_c->>'importo', '')), '');
  v_importo := case when v_testo is null then v_s.importo
                    else round(replace(v_testo, ',', '.')::numeric, 2) end;
  v_data := coalesce(nullif(v_c->>'data', '')::date, v_s.data);
  v_descr := coalesce(nullif(btrim(coalesce(v_c->>'descrizione', '')), ''), v_s.descrizione);
  v_contro := coalesce(nullif(btrim(coalesce(v_c->>'controparte', '')), ''), v_s.controparte);

  case p_dove
    when 'ignora' then
      update spese_da_collocare
         set stato = 'ignorata', collocata_il = now()
       where id = p_id;
      return jsonb_build_object('dove', 'ignora', 'foto_da_togliere', v_s.foto_path);

    when 'prima_nota', 'tasca' then
      if v_importo is null or v_importo <= 0 then
        raise exception 'Manca quanto hai speso: scrivi l''importo e riprova.';
      end if;
      select id into v_ent from entities
       where entity_type = case p_dove when 'tasca' then 'tasca' else 'srls' end
       limit 1;
      if v_ent is null then
        raise exception 'In questo gestionale non c''e'' il soggetto per questa destinazione: la spesa resta da collocare.';
      end if;
      -- 🔴 LA DATA E' LA SERATA quando non e' scritta: una spesa collocata
      --    all'una di notte appartiene alla sera prima.
      insert into cash_movements (
        entity_id, direction, amount, movement_date, causale_id, mezzo,
        conto_id, tipo_documento, business_purpose, note)
      values (
        v_ent,
        'uscita'::cash_direction,
        v_importo,
        coalesce(v_data, serata_di_servizio(now())),
        case when p_dove = 'prima_nota'
             then coalesce(nullif(v_c->>'causale_id', '')::uuid, v_s.causale_id) end,
        case when p_dove = 'tasca' then 'cassa'
             else coalesce(nullif(v_c->>'mezzo', ''), v_s.mezzo_proposto, 'cassa') end,
        case when p_dove = 'prima_nota' then nullif(v_c->>'conto_id', '')::uuid end,
        case when p_dove = 'tasca' then 'non_documentato'::cash_document_type
             else coalesce(nullif(v_c->>'documento', ''), v_s.documento_proposto, 'non_documentato')::cash_document_type end,
        nullif(concat_ws(' · ', v_contro, v_descr), ''),
        'Da una spesa da collocare (' || case v_s.provenienza when 'voce' then 'detta a MEMO' else 'fotografata' end || ')')
      returning id into v_mov;
      update spese_da_collocare
         set stato = 'collocata', collocata_in = p_dove, collocata_il = now(),
             importo = v_importo, data = coalesce(v_data, serata_di_servizio(now())),
             descrizione = v_descr, controparte = v_contro, movimento_id = v_mov
       where id = p_id;
      return jsonb_build_object('dove', p_dove, 'movimento_id', v_mov,
                                'foto_da_togliere', v_s.foto_path);

    when 'anticipo' then
      if v_importo is null or v_importo <= 0 then
        raise exception 'Manca quanto hai speso: scrivi l''importo e riprova.';
      end if;
      if nullif(v_c->>'tag_id', '') is null then
        raise exception 'Scegli il motivo dell''anticipo: senza, i totali per motivo non tornano.';
      end if;
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      insert into anticipazioni_socio (
        entity_id, importo, pagata_il, tag_id, fondi, documento_riferimento, nota)
      values (
        v_ent, v_importo, coalesce(v_data, serata_di_servizio(now())),
        (v_c->>'tag_id')::uuid,
        coalesce(nullif(v_c->>'fondi', ''), 'contanti'),
        nullif(btrim(coalesce(v_c->>'documento_riferimento', '')), ''),
        nullif(concat_ws(' · ', v_contro, v_descr), ''))
      returning id into v_ant;
      update spese_da_collocare
         set stato = 'collocata', collocata_in = 'anticipo', collocata_il = now(),
             importo = v_importo, data = coalesce(v_data, serata_di_servizio(now())),
             descrizione = v_descr, controparte = v_contro, anticipazione_id = v_ant
       where id = p_id;
      return jsonb_build_object('dove', 'anticipo', 'anticipazione_id', v_ant,
                                'foto_da_togliere', v_s.foto_path);

    when 'archivio' then
      if nullif(v_c->>'sezione', '') is null then
        raise exception 'Scegli in quale sezione dell''Archivio va.';
      end if;
      if v_data is null then
        raise exception 'Manca la data: in Archivio un documento senza data non ha un posto nel tempo. Scrivila e riprova.';
      end if;
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      -- 🔴 LA FOTO RESTA: diventa il file del documento. Non si toglie.
      v_doc := create_document(
        coalesce(nullif(btrim(coalesce(v_c->>'titolo', '')), ''),
                 nullif(concat_ws(' · ', v_contro, v_descr), ''),
                 'Spesa del ' || to_char(v_data, 'DD/MM/YYYY')),
        v_ent,
        v_c->>'sezione',
        v_data,
        v_contro,
        v_importo,
        null,
        'Da una spesa da collocare (' || case v_s.provenienza when 'voce' then 'detta a MEMO' else 'fotografata' end || ')',
        v_s.foto_path,
        v_s.foto_nome);
      update spese_da_collocare
         set stato = 'collocata', collocata_in = 'archivio', collocata_il = now(),
             importo = v_importo, data = v_data,
             descrizione = v_descr, controparte = v_contro, documento_id = v_doc
       where id = p_id;
      return jsonb_build_object('dove', 'archivio', 'documento_id', v_doc,
                                'foto_da_togliere', null);

    else
      raise exception 'Non so dove mettere questa spesa («%»): le strade sono prima nota, la tua tasca, anticipo, archivio, oppure ignorala.', p_dove;
  end case;
end $fn$;

revoke all on function colloca_spesa(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function colloca_spesa(uuid, text, jsonb) to authenticated;

-- La foto se ne va DOPO la collocazione: prima si toglie il file dal
-- deposito (lo fa il browser), poi si svuota la colonna. Nell'ordine
-- inverso, un file rimasto non lo nominerebbe piu' nessuno.
create or replace function togli_foto_spesa(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_stato text;
begin
  if not is_titolare() then
    raise exception 'Togliere la foto di una spesa e'' riservato al titolare.';
  end if;
  select stato into v_stato from spese_da_collocare where id = p_id;
  if v_stato is null then
    raise exception 'Questa spesa da collocare non c''e'' piu''.';
  end if;
  if v_stato = 'da_collocare' then
    raise exception 'La foto si tiene finche'' la spesa non e'' collocata: e'' l''originale su cui decidi.';
  end if;
  if exists (select 1 from spese_da_collocare where id = p_id and collocata_in = 'archivio') then
    raise exception 'Questa foto e'' il file del documento in Archivio: si toglie da li'', non da qui.';
  end if;
  update spese_da_collocare set foto_path = null, foto_nome = null where id = p_id;
end $fn$;

revoke all on function togli_foto_spesa(uuid) from public, anon, authenticated;
grant execute on function togli_foto_spesa(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. LA VOCE IMPARA LA SPESA DA COLLOCARE
-- ---------------------------------------------------------------------
-- ⚠️ `additivo` = FALSE: due spese sono due appunti.
-- ⚠️ `natura` = creazione: passa dagli occhi di Alessio come ogni cosa che
--    tocca i soldi (anche se qui non li tocca ancora).
insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile)
values (
  'spesa_da_collocare',
  'creazione',
  'Spesa da collocare',
  'Una spesa detta a MEMO: finisce nell''elenco «Da collocare», non in contabilita''. Da li'' scegli tu se va in prima nota, nella tua tasca, fra gli anticipi o in Archivio.',
  true,
  false,
  true)
on conflict (tipo) do update
   set natura     = excluded.natura,
       titolo     = excluded.titolo,
       spiega     = excluded.spiega,
       attivo     = excluded.attivo,
       additivo   = excluded.additivo,
       eseguibile = excluded.eseguibile;

-- 🔴 IL CORPO VIENE DALL'ULTIMA MIGRAZIONE CHE LO TOCCA
--    (20260911000002), e non dal database vivo: da questo contenitore il
--    database non si raggiunge. Le reti che lo tengono onesto sono due:
--    · qui sotto, PRIMA di sostituirlo, si pretende che il corpo vivo abbia
--      esattamente i sedici rami di quella migrazione — un ramo in piu' o in
--      meno vuol dire che qualcuno l'ha toccato dopo, e ci si ferma;
--    · e `npm run prova:migra` confronta le impronte col corpo vivo (rete
--      delle guardie) prima di applicare.
do $prima$
declare
  v_def   text;
  v_rami  text[];
  v_attesi text[] := array['agenda_da_segnare_fatto', 'agenda_da_spostare', 'carico_merce',
    'giacenza', 'lista_spesa', 'merce_buttata', 'movimento_cassa', 'nota_non_capita',
    'preparazione_da_fare', 'prodotto_nuovo', 'promemoria', 'pulizia', 'ricetta',
    'spesa_spicciola', 'spesa_tasca', 'temperatura'];
begin
  v_def := pg_get_functiondef('fai_azione_dettata(text, jsonb)'::regprocedure);
  select array_agg(distinct r[1] order by r[1]) into v_rami
    from regexp_matches(v_def, E'\\n    when ''([a-z_]+)'' then', 'g') as m(r);
  v_rami := array_remove(v_rami, 'spesa_da_collocare');
  if v_rami is distinct from v_attesi then
    raise exception 'fai_azione_dettata nel database ha i rami % e questa migrazione si aspettava %: e'' stata toccata dopo il 11/09. Guarda il corpo vivo prima di sostituirlo.', v_rami, v_attesi;
  end if;
end $prima$;

CREATE OR REPLACE FUNCTION public.fai_azione_dettata(p_tipo text, p_dati jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id     uuid;
  v_ent    uuid;
  v_lotto  uuid;
  v_pezzi  text;
  v_task   tasks%rowtype;
  v_prima  date;
  v_nuova  date;
  -- Il promemoria che avvisa (10/09/2026)
  v_av_data date;
  v_av_ora  time;
  v_avviso  timestamptz;
  -- L'ora dell'impegno (11/09/2026)
  v_ora_imp text;
begin
  case p_tipo

    when 'giacenza' then
      return allinea_giacenza(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quanto_ce')::numeric,
        coalesce(nullif(p_dati->>'note', ''), 'Contato a voce'));

    when 'temperatura' then
      -- 🔴 Il frigo non si indovina MAI: quel registro va all'ASP.
      --    Il vincolo sulla riga lo impedisce gia', e qui si rifiuta con
      --    una frase leggibile invece che con un errore di vincolo.
      if nullif(p_dati->>'equipment_id', '') is null then
        raise exception 'Non hai detto quale frigo: una temperatura senza il suo frigo non si scrive nel registro.';
      end if;
      return registra_temperatura(
        (p_dati->>'equipment_id')::uuid,
        (p_dati->>'gradi')::numeric,
        nullif(p_dati->>'note', ''),
        null);

    when 'promemoria' then
      -- ⚠️ CHI SCRIVE NON SI FIDA DI CHI CHIAMA — 10/09/2026.
      --    Questi due rifiuti NON sono la rete che protegge l'app: dalla
      --    porta vera ci si arriva passando da `approva_appunto`, che
      --    rigira `voce_risolvi_dati` al momento della firma e si ferma
      --    prima, sul suo «manca». **Misurato rompendo**: spegnendo i due
      --    rifiuti qui sotto, tutte e 552 le prove contro il progetto di
      --    prova restano verdi.
      --    ⚠️ Si tengono lo stesso, e la ragione e' la stessa per cui in
      --    questo progetto gli invarianti stanno nel database e non nelle
      --    schermate: qui si SCRIVE, e chi scrive non deve dipendere dal
      --    fatto che qualcun altro abbia guardato. Il giorno che
      --    `fai_azione_dettata` verra' chiamata da un'altra porta, la riga
      --    c'e' gia'.
      v_av_data := nullif(btrim(coalesce(p_dati->>'avviso_data', '')), '')::date;
      v_av_ora  := nullif(btrim(coalesce(p_dati->>'avviso_ora',  '')), '')::time;

      -- ⚠️ Mezzo avviso non e' un avviso, e qui si rifiuta invece di
      --    scriverne meta': un giorno senza ora non dice quando, e un'ora
      --    senza giorno non dice quale.
      if (v_av_data is null) <> (v_av_ora is null) then
        raise exception 'Per avvisarti mi servono tutt''e due: il giorno e l''ora. Ridimmelo, oppure ridillo senza notifica.';
      end if;

      if v_av_data is not null then
        -- 🔴 ITALIANO, non Greenwich: «alle 15» sono le 15 di qui.
        v_avviso := (v_av_data + v_av_ora) at time zone 'Europe/Rome';
        if v_avviso <= now() then
          raise exception 'L''avviso del % alle % è già passato: non ho scritto niente. Ridimmi quando vuoi che ti avvisi.',
            to_char(v_av_data, 'DD/MM/YYYY'), to_char(v_av_ora, 'HH24:MI');
        end if;
      end if;

      -- ⚠️ L'ORA DELL'IMPEGNO (11/09/2026): chi scrive non si fida di chi
      --    chiama, come per l'avviso. Un'ora che non ha la forma di un'ora
      --    si rifiuta qui, prima di scrivere, invece di finire in un campo.
      v_ora_imp := nullif(btrim(coalesce(p_dati->>'ora', '')), '');
      -- ⚠️ Ore 00-23, minuti 00-59: «24:00» si rifiuta (revisione, 11/09).
      if v_ora_imp is not null and v_ora_imp !~ '^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' then
        raise exception 'L''ora «%» non la so leggere: non ho scritto niente.', v_ora_imp;
      end if;

      insert into tasks (title, description, due_date, priority, status, category,
                         origine_modulo, remind_at, due_time)
      values (
        left(coalesce(nullif(p_dati->>'titolo', ''), 'Promemoria dettato'), 200),
        nullif(p_dati->>'descrizione', ''),
        nullif(p_dati->>'data', '')::date,
        coalesce(nullif(p_dati->>'priorita', ''), 'media')::task_priority,
        'da_fare'::task_status,
        coalesce(nullif(p_dati->>'categoria', ''), 'altro'),
        'voce',
        v_avviso,
        v_ora_imp::time)
      returning id into v_id;
      -- ⚠️ L'avviso torna nella risposta: chi ha approvato deve poter
      --    leggere che cosa e' stato scritto davvero, non fidarsi di quello
      --    che l'appunto prometteva.
      return jsonb_build_object('task_id', v_id, 'avviso', v_avviso, 'ora', v_ora_imp);

    when 'pulizia' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non ho capito quale pulizia: dimmi il nome di una di quelle previste nel piano.';
      end if;
      insert into haccp_cleaning_logs (task_id, note)
      values ((p_dati->>'task_id')::uuid, nullif(p_dati->>'note', ''))
      returning id into v_id;
      return jsonb_build_object('log_id', v_id);

    when 'preparazione_da_fare' then
      -- 🔴 SI ESEGUE DA SE', SENZA CONFERMA PARLATA — decisione di Alessio
      --    del 29/08: *se sbaglia si cancella una riga*. E' la stessa
      --    ragione per cui la lista della spesa non chiede conferma: qui
      --    non si muove nessun numero, non esce nessun soldo, e la riga si
      --    toglie con un tocco dalla schermata delle Produzioni.
      -- ⚠️ Aggiungerla due volte NON e' un errore e non solleva niente:
      --    `aggiungi_da_fare` risponde «c'era gia'» con la frase, e chi ha
      --    dettato la sente invece di ricevere un rifiuto per un gesto
      --    normale.
      return aggiungi_da_fare(
        (p_dati->>'recipe_id')::uuid,
        nullif(p_dati->>'note', ''));

    when 'lista_spesa' then
      -- ⚠️ Il nome libero e' ammesso apposta: «prendi la carta forno» non
      --    e' un prodotto del ricettario e non deve diventarlo. Aggiungere
      --    una riga alla lista non crea niente in magazzino.
      return jsonb_build_object('item', add_shopping_list_item(
        -- 🔴 SEMPRE NULL, ed e' la decisione del 27/08: la lista della
        --    spesa non accoppia mai col magazzino. Quello che si dice
        --    finisce in lista come si e' detto, e l'abbinamento si fa
        --    dopo, con la foto del documento quando la merce arriva.
        null,
        nullif(p_dati->>'nome_libero', ''),
        null,
        nullif(p_dati->>'quantita', '')::numeric,
        nullif(p_dati->>'unita', '')::unit_type,
        nullif(p_dati->>'note', '')));

    when 'spesa_spicciola' then
      -- 🔴 LA SECONDA LISTA, e non tocca niente di quello che fa la prima.
      --    La spesa spicciola è il foglietto del supermercato: non nasce
      --    dalle soglie, non finisce in un ordine, non muove giacenze e non
      --    scrive nessun costo (23/08/2026). Qui si scrive una riga e basta.
      -- ⚠️ Stesso patto della lista della spesa: NIENTE CATALOGO. Quello
      --    che è stato detto entra come è stato detto — un collegamento a
      --    `ingredients` sarebbe la prima crepa da cui torna il magazzino.
      insert into spesa_spicciola (articolo, categoria, nota)
      values (
        nullif(btrim(p_dati->>'nome_libero'), ''),
        nullif(btrim(p_dati->>'categoria'), ''),
        nullif(btrim(p_dati->>'note'), ''))
      returning id into v_id;
      return jsonb_build_object('spesa_spicciola_id', v_id);

    when 'merce_buttata' then
      -- 🔴 `record_stock_consumption` NON RESTITUISCE NIENTE (void), e
      --    quindi si chiama con `perform` e la risposta la si costruisce
      --    qui. Scrivendo `return` si otteneva «invalid input syntax for
      --    type json» — un errore che parla di JSON per una funzione che
      --    di JSON non ne ha mai visto.
      perform record_stock_consumption(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        'spreco',
        coalesce(nullif(p_dati->>'note', ''), 'Buttata, detto a voce'));
      return jsonb_build_object(
        'ingredient_id', p_dati->>'ingredient_id',
        'quantita',      p_dati->>'quantita',
        'motivo',        'spreco');

    when 'nota_non_capita' then
      -- 🔴 LA MAGLIA LARGA: non ho capito, e NON INVENTO. Resta scritto
      --    quello che ho sentito, e Alessio lo vede in Dashboard.
      insert into tasks (title, description, priority, status, category, origine_modulo)
      values (
        'Da riguardare: una cosa detta a voce',
        p_dati->>'sentito',
        'media'::task_priority,
        'da_fare'::task_status,
        'altro',
        'voce')
      returning id into v_id;
      return jsonb_build_object('task_id', v_id);

    -- =====================================================================
    -- I QUATTRO CHE MANCAVANO — natura `creazione`, tutti dietro l'occhio
    -- =====================================================================

    when 'movimento_cassa' then
      -- 🔴 LA DATA E' LA SERATA. Un'uscita dettata all'una di notte
      --    appartiene alla sera prima, e `current_date` a quell'ora
      --    risponderebbe col giorno di Greenwich.
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      insert into cash_movements (
        entity_id, direction, amount, movement_date, causale_id, mezzo,
        conto_id, tipo_documento, business_purpose, note)
      values (
        v_ent,
        (p_dati->>'verso')::cash_direction,
        (p_dati->>'importo')::numeric,
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        nullif(p_dati->>'causale_id', '')::uuid,
        coalesce(nullif(p_dati->>'mezzo', ''), 'cassa'),
        nullif(p_dati->>'conto_id', '')::uuid,
        coalesce(nullif(p_dati->>'documento', ''), 'non_documentato')::cash_document_type,
        -- ⚠️ Su `cash_movements` non c'e' nessuna colonna «fornitore»: il
        --    nome riconosciuto si scrive qui, in chiaro, invece di
        --    inventare un legame che lo schema non prevede.
        nullif(concat_ws(' · ',
          (select 'Fornitore: ' || s.name from suppliers s
            where s.id = nullif(p_dati->>'supplier_id', '')::uuid),
          nullif(p_dati->>'descrizione', '')), ''),
        coalesce(nullif(p_dati->>'note', ''), 'Registrato a voce'))
      returning id into v_id;
      return jsonb_build_object(
        'movimento_id',  v_id,
        'senza_causale', nullif(p_dati->>'causale_id', '') is null);

    when 'spesa_tasca' then
      -- 🔴 LA TASCA E' UN SOGGETTO A SE', accanto a Borgo 58 e all'orto
      --    (decisione del 30/08): il contante che Alessio spende di suo per
      --    il progetto, senza documento. Qui si sceglie **quel** soggetto,
      --    e non quello dell'osteria come fa `movimento_cassa`.
      select id into v_ent from entities where entity_type = 'tasca' limit 1;

      -- ⚠️ SE LA TASCA NON C'E' SI RIFIUTA, non si ripiega sull'osteria:
      --    una spesa personale registrata su Borgo 58 non da' nessun errore
      --    e sporca i conti del locale. Meglio un rifiuto leggibile.
      if v_ent is null then
        raise exception 'In questo gestionale non c''e'' nessun soggetto «tasca»: la spesa personale non si puo'' registrare da nessuna parte, e sulla cassa dell''osteria non ci va.';
      end if;

      -- ⚠️ IL VERSO E' SCRITTO QUI E NON ARRIVA DA FUORI: dalla tasca escono
      --    soldi e basta. Il divieto vero e' un trigger del database
      --    (`guardia_movimenti_tasca`, migrazione 20260830000012), che
      --    rifiuta le entrate e mette da se' l'unica regola di deducibilita'
      --    ammessa. Qui non si ricopia quella regola: si sceglie il soggetto
      --    e si lascia decidere al guardiano che c'e' gia'.
      insert into cash_movements (
        entity_id, direction, amount, movement_date, mezzo,
        tipo_documento, business_purpose, note)
      values (
        v_ent,
        'uscita'::cash_direction,
        (p_dati->>'importo')::numeric,
        coalesce(nullif(p_dati->>'data', '')::date, serata_di_servizio(now())),
        'cassa',
        'non_documentato'::cash_document_type,
        -- 🔴 QUI VA IL «PER CHE COSA», ed e' il campo che SPEC-0005 chiama
        --    «Descrizione della spesa»: sulla tasca non c'e' nessuna verifica
        --    fiscale da superare, quel riquadro serve a dire che cosa hai
        --    pagato.
        nullif(btrim(p_dati->>'descrizione'), ''),
        coalesce(nullif(p_dati->>'note', ''), 'Spesa dalla tasca, detta a voce'))
      returning id into v_id;
      return jsonb_build_object('movimento_id', v_id, 'soggetto', 'tasca');

    when 'carico_merce' then
      if nullif(p_dati->>'ingredient_id', '') is null then
        raise exception 'Non ho capito quale prodotto e'' arrivato.';
      end if;
      v_lotto := register_stock_delivery(
        (p_dati->>'ingredient_id')::uuid,
        (p_dati->>'quantita')::numeric,
        nullif(p_dati->>'supplier_id', '')::uuid,
        nullif(p_dati->>'scadenza', '')::date,
        coalesce(nullif(p_dati->>'note', ''), 'Arrivato, detto a voce'),
        nullif(p_dati->>'costo_unitario', '')::numeric,
        nullif(p_dati->>'lotto', ''),
        null);
      return jsonb_build_object(
        'lotto_id',      v_lotto,
        'senza_scadenza', nullif(p_dati->>'scadenza', '') is null);

    when 'prodotto_nuovo' then
      -- 🔴 IL DOPPIONE SI RIFIUTA. Due prodotti con lo stesso nome sono due
      --    giacenze che si dividono la stessa merce e non si riuniscono
      --    piu': e' il difetto che il carico da fattura ha gia' imparato a
      --    evitare.
      if exists (select 1 from ingredients i
                  where lower(btrim(i.name)) = lower(btrim(p_dati->>'nome'))) then
        raise exception '«%» c''e'' gia'' fra i prodotti: non ne faccio un secondo. Se volevi caricarlo, dimmi che e'' arrivato.',
          btrim(p_dati->>'nome');
      end if;
      select id into v_ent from entities where entity_type = 'srls' limit 1;
      -- ⚠️ Il prezzo nasce a ZERO, che qui e' il predefinito dello schema e
      --    non una mia risposta: la scheda si compila dopo, e il primo
      --    carico con un costo lo aggiorna.
      -- ⚠️ `create_ingredient` restituisce la RIGA INTERA in jsonb, non
      --    l'identificativo: assegnandola a un uuid l'errore che si ottiene
      --    parla di «invalid input syntax for type uuid» e mostra tutta la
      --    riga — sembra un dato storto, ed e' solo il tipo di ritorno.
      v_id := (create_ingredient(
        v_ent,
        btrim(p_dati->>'nome'),
        -- ⚠️ Il catalogo al posto del cast all'enum (27/08/2026).
        coalesce(valore_del_vocabolario('ingredients', 'category',
                                        nullif(p_dati->>'categoria', '')), 'altro'),
        (p_dati->>'unita')::unit_type,
        0)->>'id')::uuid;
      return jsonb_build_object('ingredient_id', v_id, 'senza_scheda', true);

    when 'ricetta' then
      if exists (select 1 from recipes r
                  where lower(btrim(r.name)) = lower(btrim(p_dati->>'nome'))) then
        raise exception 'Una ricetta che si chiama «%» c''e'' gia''. Se la vuoi cambiare, aprila dal Ricettario.',
          btrim(p_dati->>'nome');
      end if;
      -- ⚠️ SOLO LO SCHELETRO, e il testo dettato per intero nelle note: gli
      --    ingredienti si mettono a mano. Una quantita' di riga sbagliata
      --    sposta il food cost in silenzio, ed e' precisamente l'errore che
      --    il criterio «la creazione passa dai tuoi occhi» esiste per
      --    evitare.
      v_pezzi := nullif(btrim(coalesce(p_dati->>'sentito', '')), '');
      insert into recipes (name, category, portions_yield, notes)
      values (
        btrim(p_dati->>'nome'),
        (p_dati->>'categoria')::recipe_category,
        greatest(coalesce(nullif(p_dati->>'porzioni', '')::integer, 1), 1),
        case when v_pezzi is null then null else 'Dettata a voce: ' || v_pezzi end)
      returning id into v_id;
      return jsonb_build_object('recipe_id', v_id, 'senza_ingredienti', true);

    -- =====================================================================
    -- L'AGENDA, FASE 2 — chiudere e spostare un impegno che esiste già
    -- =====================================================================
    -- 🔴 QUI SI ARRIVA SOLO DOPO CHE ALESSIO HA APPROVATO L'APPUNTO. La
    --    frase detta non scrive niente: fra la voce e queste righe c'è
    --    sempre un «sì» premuto guardando il titolo dell'impegno.
    --
    -- 🔴 E FRA LA PROPOSTA E IL «SI'» PUO' ESSERE CAMBIATO TUTTO. L'appunto
    --    non scade mai, quindi possono passare giorni: l'impegno può essere
    --    stato chiuso da qualcun altro, tolto, o spostato a un'altra data.
    --    In tutti e tre i casi ci si FERMA senza toccare niente e si dice
    --    perché — sovrascrivere sarebbe eseguire una firma data su un fatto
    --    che non è più vero.

    when 'agenda_da_segnare_fatto' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non so quale impegno segnare come fatto: aprilo in Agenda e toccalo lì.';
      end if;
      select * into v_task from tasks t where t.id = (p_dati->>'task_id')::uuid;
      if v_task.id is null then
        raise exception 'Quell''impegno non c''è più in Agenda: è stato tolto dopo che te l''avevo proposto. Non ho toccato niente.';
      end if;
      if v_task.status = 'completato' then
        raise exception 'L''impegno «%» risulta già fatto: qualcuno l''ha chiuso dopo che te l''avevo proposto. Non ho toccato niente.', v_task.title;
      end if;
      -- 🔴 E IL NOME DEV'ESSERE ANCORA QUELLO CHE L'APPUNTO MOSTRAVA: se
      --    qualcuno ha rinominato la riga, quello che si sta per chiudere
      --    non è più la cosa che si è letta prima di firmare.
      if v_task.title is distinct from nullif(p_dati->>'titolo', '') then
        raise exception 'Quell''impegno adesso si chiama «%», non «%» come diceva l''appunto: è stato rinominato dopo. Non ho toccato niente.',
          v_task.title, coalesce(nullif(p_dati->>'titolo', ''), '(senza nome)');
      end if;
      -- ⚠️ SI RIUSA `completa_task`, che è il gesto dell'Agenda: chiude
      --    l'impegno **e fa nascere il ricorrente successivo**. Scrivere qui
      --    un `update` sarebbe la seconda definizione di «segnare fatto», e
      --    la prima volta che qualcuno chiude a voce un adempimento annuale
      --    quello sparirebbe invece di ripresentarsi l'anno dopo.
      return jsonb_build_object(
        'task_id',         v_task.id,
        'titolo',          v_task.title,
        'ricorrente_nato', completa_task(v_task.id));

    when 'agenda_da_spostare' then
      if nullif(p_dati->>'task_id', '') is null then
        raise exception 'Non so quale impegno spostare: aprilo in Agenda e cambiagli la data lì.';
      end if;
      v_nuova := nullif(p_dati->>'data_nuova', '')::date;
      if v_nuova is null then
        raise exception 'Non so a quando spostarlo: senza il giorno nuovo non tocco la scadenza.';
      end if;
      select * into v_task from tasks t where t.id = (p_dati->>'task_id')::uuid;
      if v_task.id is null then
        raise exception 'Quell''impegno non c''è più in Agenda: è stato tolto dopo che te l''avevo proposto. Non ho toccato niente.';
      end if;
      if v_task.status = 'completato' then
        raise exception 'L''impegno «%» risulta già fatto: spostarlo adesso lo rimetterebbe in mezzo alle cose da fare. Non ho toccato niente.', v_task.title;
      end if;
      if v_task.title is distinct from nullif(p_dati->>'titolo', '') then
        raise exception 'Quell''impegno adesso si chiama «%», non «%» come diceva l''appunto: è stato rinominato dopo. Non ho toccato niente.',
          v_task.title, coalesce(nullif(p_dati->>'titolo', ''), '(senza nome)');
      end if;
      -- 🔴 E SI CONTROLLA CHE LA DATA DI PARTENZA SIA ANCORA QUELLA CHE
      --    L'APPUNTO MOSTRAVA. «Approva» è una firma su una frase precisa —
      --    «dal 5 al 11» — e se nel frattempo qualcuno l'ha portato al 20,
      --    scrivere l'11 sarebbe eseguire una decisione che nessuno ha
      --    preso. Ci si ferma e si dicono tutti e tre i giorni.
      v_prima := nullif(p_dati->>'data_precedente', '')::date;
      if v_task.due_date is distinct from v_prima then
        raise exception 'L''impegno «%» adesso è %, non % come diceva l''appunto: qualcuno l''ha spostato dopo. Non l''ho portato al %.',
          v_task.title,
          coalesce(to_char(v_task.due_date, 'DD/MM/YYYY'), 'senza data'),
          coalesce(to_char(v_prima, 'DD/MM/YYYY'), 'senza data'),
          to_char(v_nuova, 'DD/MM/YYYY');
      end if;

      -- ⚠️ UNA TABELLA SOLA e nessuna conseguenza altrove: qui il Contratto
      --    non chiede il corridoio, ed è lo stesso `update` che fa il
      --    pulsante «rimanda» dell'Agenda (`spostaTask`).
      update tasks set due_date = v_nuova where id = v_task.id;
      return jsonb_build_object(
        'task_id',         v_task.id,
        'titolo',          v_task.title,
        'data_precedente', v_task.due_date,
        'data_nuova',      v_nuova);

    when 'spesa_da_collocare' then
      -- 🔴 NON E' CONTABILITA' (11/10/2026, C12): si scrive un appunto
      --    nell'elenco «Da collocare», e niente altro. Da li' Alessio sceglie
      --    la destinazione — prima nota, tasca, anticipo, archivio — una
      --    volta sola.
      -- ⚠️ Il fornitore arriva come NUMERO del catalogo (il modello non
      --    scrive nomi): qui diventa il nome, perche' l'appunto lo mostra.
      v_pezzi := null;
      if coalesce(p_dati->>'fornitore', '') ~ '^[0-9]+$' then
        select s.name into v_pezzi from suppliers s
         where s.id = voce_fornitore_numero((p_dati->>'fornitore')::integer);
      end if;
      v_id := scrivi_spesa_da_collocare('voce',
        (p_dati - 'fornitore' - 'causale')
        || jsonb_strip_nulls(jsonb_build_object(
             'controparte', coalesce(nullif(btrim(coalesce(p_dati->>'controparte', '')), ''), v_pezzi),
             'causale_id', case when coalesce(p_dati->>'causale', '') ~ '^[0-9]+$'
                                then voce_causale_numero((p_dati->>'causale')::integer) end)));
      return jsonb_build_object('spesa_da_collocare_id', v_id);

    else
      raise exception 'Questa cosa il gestionale non la sa ancora fare a voce (%). Si fa a mano come sempre.', p_tipo;
  end case;
end $function$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_a        uuid;
  v_b        uuid;
  v_s        spese_da_collocare%rowtype;
  v_r        jsonb;
  v_tag      uuid;
  v_mov0     integer;
  v_respinto boolean;
  v_msg      text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  if has_function_privilege('anon', 'annota_spesa_da_collocare(jsonb)', 'execute')
     or has_function_privilege('anon', 'colloca_spesa(uuid, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'togli_foto_spesa(uuid)', 'execute')
     or has_function_privilege('authenticated', 'scrivi_spesa_da_collocare(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'fai_azione_dettata(text, jsonb)', 'execute') then
    raise exception 'VERIFICA: una porta delle spese da collocare e'' aperta a chi non deve.';
  end if;
  if has_table_privilege('authenticated', 'spese_da_collocare', 'insert')
     or has_table_privilege('authenticated', 'spese_da_collocare', 'update')
     or has_table_privilege('authenticated', 'spese_da_collocare', 'delete') then
    raise exception 'VERIFICA: dal browser si scrive dritto nelle spese da collocare.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. La voce scrive un appunto e NESSUN movimento.
    select count(*) into v_mov0 from cash_movements;
    v_r := fai_azione_dettata('spesa_da_collocare', jsonb_build_object(
      'importo', 30, 'descrizione', 'ZZ verifica - il pane', 'natura_proposta', 'tasca',
      'testo_originale', 'ho pagato trenta euro di tasca mia per il pane'));
    select * into v_s from spese_da_collocare where id = (v_r->>'spesa_da_collocare_id')::uuid;
    if v_s.provenienza is distinct from 'voce' or v_s.importo is distinct from 30.00
       or v_s.natura_proposta is distinct from 'tasca' or v_s.stato is distinct from 'da_collocare' then
      raise exception 'VERIFICA: l''appunto dettato non e'' quello atteso (%).', row_to_json(v_s);
    end if;
    if (select count(*) from cash_movements) <> v_mov0 then
      raise exception 'VERIFICA: una spesa da collocare ha scritto in prima nota.';
    end if;
    if exists (select 1 from tipi_vocali_senza_ramo() t where t.tipo = 'spesa_da_collocare') then
      raise exception 'VERIFICA: la spesa da collocare e'' nel catalogo della voce senza un ramo che la esegua.';
    end if;

    -- 2. Ciò che non si legge resta vuoto e DETTO, non fa fallire.
    v_a := annota_spesa_da_collocare(jsonb_build_object(
      'importo', 'tanti', 'descrizione', 'ZZ verifica - cartolibreria',
      'foto_path', 'da-collocare/zz-verifica.jpg', 'foto_nome', 'scontrino.jpg',
      'natura_proposta', 'inventata'));
    select * into v_s from spese_da_collocare where id = v_a;
    if v_s.importo is not null or coalesce(v_s.incertezza, '') not like '%tanti%'
       or v_s.natura_proposta is not null or v_s.provenienza is distinct from 'foto' then
      raise exception 'VERIFICA: un importo illeggibile doveva restare vuoto e dichiarato (%).', row_to_json(v_s);
    end if;

    -- 3. Un appunto vuoto non entra.
    v_respinto := false;
    begin
      perform annota_spesa_da_collocare('{}'::jsonb);
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA: e'' entrato un appunto senza niente da guardare.'; end if;

    -- 4. In prima nota: manca l'importo → rifiuto leggibile; poi entra.
    v_respinto := false;
    begin
      perform colloca_spesa(v_a, 'prima_nota', '{}'::jsonb);
    exception when others then v_respinto := sqlerrm like '%Manca quanto hai speso%';
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' collocata in prima nota una spesa senza importo.'; end if;

    v_r := colloca_spesa(v_a, 'prima_nota', jsonb_build_object('importo', '18,40', 'mezzo', 'cassa'));
    select * into v_s from spese_da_collocare where id = v_a;
    if v_s.stato <> 'collocata' or v_s.collocata_in <> 'prima_nota'
       or v_s.movimento_id is distinct from (v_r->>'movimento_id')::uuid
       or (select amount from cash_movements where id = v_s.movimento_id) is distinct from 18.40
       or (select direction::text from cash_movements where id = v_s.movimento_id) is distinct from 'uscita'
       or v_r->>'foto_da_togliere' is distinct from 'da-collocare/zz-verifica.jpg' then
      raise exception 'VERIFICA: la collocazione in prima nota non e'' quella attesa (% / %).', row_to_json(v_s), v_r;
    end if;

    -- 5. UNA VOLTA SOLA: dalla funzione e dritto in tabella.
    v_respinto := false;
    begin
      perform colloca_spesa(v_a, 'tasca', '{}'::jsonb);
    exception when others then v_respinto := sqlerrm like '%una volta sola%';
    end;
    if not v_respinto then raise exception 'VERIFICA: una spesa collocata si e'' collocata una seconda volta.'; end if;
    v_respinto := false;
    begin
      update spese_da_collocare set importo = 99 where id = v_a;
    exception when others then v_respinto := sqlerrm like '%una volta sola%';
    end;
    if not v_respinto then raise exception 'VERIFICA: una spesa collocata si e'' cambiata dopo.'; end if;

    -- 6. Il movimento nato da una spesa non sparisce lasciando l'appunto a mentire.
    v_respinto := false;
    begin
      delete from cash_movements where id = v_s.movimento_id;
    exception when foreign_key_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' cancellato il movimento lasciando l''appunto collocato.'; end if;

    -- 7. La foto: si tiene finche' non e' collocata, poi se ne va.
    v_b := annota_spesa_da_collocare(jsonb_build_object(
      'importo', 7, 'descrizione', 'ZZ verifica - temu', 'foto_path', 'da-collocare/zz-b.jpg'));
    v_respinto := false;
    begin
      perform togli_foto_spesa(v_b);
    exception when others then v_respinto := sqlerrm like '%si tiene finche%';
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' tolta la foto di una spesa ancora da collocare.'; end if;
    perform togli_foto_spesa(v_a);
    if (select foto_path from spese_da_collocare where id = v_a) is not null then
      raise exception 'VERIFICA: la foto di una spesa collocata non si e'' tolta.';
    end if;

    -- 8. In archivio la foto RESTA: diventa il file del documento.
    v_respinto := false;
    begin
      perform colloca_spesa(v_b, 'archivio', jsonb_build_object('sezione', 'fatture_ricevute'));
    exception when others then v_respinto := sqlerrm like '%Manca la data%';
    end;
    if not v_respinto then raise exception 'VERIFICA: e'' entrato in Archivio un documento senza data.'; end if;
    v_r := colloca_spesa(v_b, 'archivio', jsonb_build_object('sezione', 'fatture_ricevute', 'data', '2026-10-11'));
    if (select storage_path from documents where id = (v_r->>'documento_id')::uuid)
         is distinct from 'da-collocare/zz-b.jpg'
       or v_r->>'foto_da_togliere' is not null then
      raise exception 'VERIFICA: in Archivio la foto doveva diventare il file del documento (%).', v_r;
    end if;
    v_respinto := false;
    begin
      perform togli_foto_spesa(v_b);
    exception when others then v_respinto := sqlerrm like '%file del documento%';
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' tolta la foto che e'' il file di un documento.'; end if;

    -- 9. Nella tasca: il soggetto e' la tasca, non l'osteria.
    v_a := annota_spesa_da_collocare(jsonb_build_object('importo', 12, 'descrizione', 'ZZ verifica - detersivo'));
    v_r := colloca_spesa(v_a, 'tasca', '{}'::jsonb);
    if (select e.entity_type::text from cash_movements m join entities e on e.id = m.entity_id
         where m.id = (v_r->>'movimento_id')::uuid) is distinct from 'tasca' then
      raise exception 'VERIFICA: una spesa collocata nella tasca e'' finita su un altro soggetto.';
    end if;

    -- 10. Anticipo: senza motivo no, con il motivo si'.
    v_a := annota_spesa_da_collocare(jsonb_build_object('importo', 40, 'descrizione', 'ZZ verifica - ferramenta'));
    v_respinto := false;
    begin
      perform colloca_spesa(v_a, 'anticipo', '{}'::jsonb);
    exception when others then v_respinto := sqlerrm like '%motivo dell''anticipo%';
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' registrato un anticipo senza motivo.'; end if;
    insert into tag_anticipazioni (etichetta) values ('ZZ verifica - da collocare') returning id into v_tag;
    v_r := colloca_spesa(v_a, 'anticipo', jsonb_build_object('tag_id', v_tag));
    if (select importo from anticipazioni_socio where id = (v_r->>'anticipazione_id')::uuid) is distinct from 40.00 then
      raise exception 'VERIFICA: l''anticipo collocato non e'' quello atteso.';
    end if;

    -- 11. Ignorata: non scrive niente, e non si colloca piu'.
    v_a := annota_spesa_da_collocare(jsonb_build_object('descrizione', 'ZZ verifica - doppione'));
    select count(*) into v_mov0 from cash_movements;
    perform colloca_spesa(v_a, 'ignora', '{}'::jsonb);
    if (select stato from spese_da_collocare where id = v_a) <> 'ignorata'
       or (select count(*) from cash_movements) <> v_mov0 then
      raise exception 'VERIFICA: ignorare una spesa doveva lasciarla ignorata e non scrivere niente.';
    end if;
    v_respinto := false;
    begin
      perform colloca_spesa(v_a, 'prima_nota', jsonb_build_object('importo', 5));
    exception when others then v_respinto := sqlerrm like '%una volta sola%';
    end;
    if not v_respinto then raise exception 'VERIFICA: una spesa ignorata si e'' collocata lo stesso.'; end if;

    -- 12. Il portiere: lo staff riceve un rifiuto.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform annota_spesa_da_collocare(jsonb_build_object('importo', 1));
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha messo una spesa da collocare.'; end if;
    v_respinto := false;
    begin
      perform colloca_spesa(v_b, 'ignora', '{}'::jsonb);
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha collocato una spesa.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle spese da collocare');

  raise notice 'Fatto: la voce e la foto scrivono un appunto e nessun movimento; prima nota, tasca, anticipo e archivio si collocano una volta sola, la foto resta solo in Archivio, lo staff e'' respinto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261011000002', 'le_spese_da_collocare')
on conflict (version) do nothing;
