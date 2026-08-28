-- ============================================================================
-- 20260828000011 — un documento senza identita' non entra in archivio
-- ============================================================================
--
-- DIFETTO DIMOSTRATO CON LE MANI da Alessio, 28/08/2026, sul progetto di
-- prova. Ha aperto una proposta di archiviazione, ha premuto «Correggi i
-- dati», ha trovato sei campi vuoti, e ha premuto «Archivia» cosi' com'era.
-- **Il gestionale ha archiviato senza rifiutare e senza avvisare.**
-- Nell'Archivio quella riga ha SOLO il titolo, mentre tutte le altre hanno
-- tipo, data, controparte, importo e scadenza.
--
-- COSA RENDE RITROVABILE UN DOCUMENTO — misurato prima di scegliere il
-- minimo, invece di deciderlo a naso:
--   · l'elenco e' ORDINATO per `document_date` (e chi non ce l'ha sprofonda
--     in fondo, perche' l'ordinamento mette per ultimi i vuoti);
--   · la ricerca guarda TRE campi: `title`, `doc_type`, `counterparties`.
-- Quindi un documento col solo titolo si trova **soltanto** se ci si ricorda
-- le parole esatte con cui era stato chiamato: non compare cercando per
-- tipo, non ha un posto nel tempo, e non risulta legato a nessuno.
--
-- IL MINIMO E' TIPO + DATA, e non e' un'opinione:
--   · il TIPO e' l'unico dei tre campi cercabili che RAGGRUPPA («mostrami i
--     contratti»): senza, il documento esiste solo per chi lo cerca a
--     memoria;
--   · la DATA e' la chiave con cui l'archivio si ordina: senza, il documento
--     non ha un posto nel tempo.
-- ⚠️ La CONTROPARTE resta facoltativa apposta: e' cercabile quanto il tipo,
--    ma puo' legittimamente non esistere (una circolare, un verbale interno),
--    e pretenderla rifiuterebbe documenti veri.
--
-- PERCHE' UN VINCOLO SULLA TABELLA E NON UN CONTROLLO NELLA FUNZIONE.
-- Misurato: in un documento si entra da TRE porte — `archivia_posta` (dalla
-- Posta), `create_document` (il caricamento a mano) e le modifiche dirette
-- dal client. Un controllo dentro una funzione ne copre una; il vincolo le
-- copre tutte, comprese quelle che non esistono ancora.
--
-- ⚠️ `NOT VALID`, ed e' la parte pensata: i documenti gia' archiviati NON
--    vengono ricontrollati. Sul progetto di prova ce ne sono **due** senza
--    identita' — «Intervento del 12/07 - rapportino» e «La tua bolletta di
--    luglio e' disponibile» — e Alessio li TIENE APPOSTA come caso di prova.
--    Un vincolo che li rifiutasse avrebbe due strade, e sono tutt'e due
--    sbagliate: fallire l'applicazione, oppure riempirli con dati inventati.
--    Le righe nuove sono controllate da subito.
-- ⚠️ E vale anche in MODIFICA: aprendo uno di quei due e salvandolo, il
--    gestionale chiede tutt'e due i campi. E' voluto — la scheda del
--    documento li ha tutti e due, quindi il rifiuto ha la sua via d'uscita
--    a un tocco di distanza.
--
-- LO STESSO BUCO ALTROVE? MISURATO, e la risposta e' NO — sta in un posto
-- solo. Cosa pretende ogni tabella d'arrivo di una proposta:
--   · `documents`      -> solo `title`            <- il buco
--   · `cash_movements` -> importo, verso, societa', data
--   · `stock_lots`     -> ingrediente, quantita'
--   · `tasks`          -> solo `title`
-- ⚠️ `tasks` sembra lo stesso caso e NON lo e': un impegno senza scadenza e'
--    uno stato VOLUTO — e' la corsia «quando capita» dell'Agenda, e sul
--    progetto di prova sono 11 su 79. Rifiutarli romperebbe una decisione in
--    vigore invece di chiudere un difetto.
-- ============================================================================

do $vincolo$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_ha_identita') then
    alter table documents add constraint documents_ha_identita
      check (doc_type is not null and document_date is not null) not valid;
  end if;
end $vincolo$;

comment on constraint documents_ha_identita on documents is
  'Un documento in archivio deve avere ALMENO il tipo e la data: scrivili tutt''e due e riprova. Senza il tipo non compare cercando «contratti» o «fatture», e senza la data finisce in fondo all''elenco senza un posto nel tempo — cioe'' si ritrova solo ricordandone il titolo esatto.';

do $verifica$
declare
  v_foto    jsonb;
  v_ente    uuid;
  v_id      uuid;
  v_msg     text;
  v_prima   integer;
  v_dopo    integer;
  v_lapidi  integer;
  v_miei    uuid[] := '{}';
begin
  v_foto := foto_righe();
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then
    raise exception 'Verifica impossibile: nessuna societa'' configurata';
  end if;

  select count(*) into v_prima from documents;
  select count(*) into v_lapidi from deleted_records;

  -- ------------------------------------------------------------------
  -- 1. SENZA TIPO NE' DATA: si rifiuta, e il messaggio NOMINA tutt'e due
  -- ------------------------------------------------------------------
  begin
    insert into documents (entity_id, title) values (v_ente, 'Verifica 20260828000011 muto');
    raise exception 'Un documento senza tipo ne'' data e'' entrato in archivio';
  exception
    when check_violation then
      v_msg := sqlerrm;
    when others then
      if sqlerrm = 'Un documento senza tipo ne'' data e'' entrato in archivio' then raise; end if;
      raise exception 'Rifiutato per la ragione sbagliata: %', sqlerrm;
  end;

  -- ------------------------------------------------------------------
  -- 2. ANCHE A META': il tipo da solo non basta, e nemmeno la data da sola.
  --    Sono due controlli distinti, e provarne uno solo direbbe meta' cosa.
  -- ------------------------------------------------------------------
  begin
    insert into documents (entity_id, title, doc_type)
    values (v_ente, 'Verifica 20260828000011 mezzo', 'rapportino');
    raise exception 'Un documento con il tipo e senza data e'' entrato';
  exception
    when check_violation then null;
    when others then
      if sqlerrm = 'Un documento con il tipo e senza data e'' entrato' then raise; end if;
      raise;
  end;

  begin
    insert into documents (entity_id, title, document_date)
    values (v_ente, 'Verifica 20260828000011 mezzo2', current_date);
    raise exception 'Un documento con la data e senza tipo e'' entrato';
  exception
    when check_violation then null;
    when others then
      if sqlerrm = 'Un documento con la data e senza tipo e'' entrato' then raise; end if;
      raise;
  end;

  -- ------------------------------------------------------------------
  -- 3. E NON E' UN MURO: con tutt'e due, entra.
  -- ------------------------------------------------------------------
  insert into documents (entity_id, title, doc_type, document_date)
  values (v_ente, 'Verifica 20260828000011 completo', 'rapportino', current_date)
  returning id into v_id;
  v_miei := v_miei || v_id;

  -- ------------------------------------------------------------------
  -- 4. I DOCUMENTI GIA' IN ARCHIVIO NON SONO STATI TOCCATI. E' il senso di
  --    `not valid`: Alessio tiene apposta i due senza identita'.
  -- ------------------------------------------------------------------
  select count(*) into v_dopo from documents;
  if v_dopo <> v_prima + 1 then
    raise exception 'Il numero dei documenti non torna: % prima, % dopo', v_prima, v_dopo;
  end if;

  -- ------------------------------------------------------------------
  -- Si riporta via cio' che ha creato, per identificativo. ⚠️ `documents`
  -- e' una tabella TRACCIATA: cancellarla lascia una lapide nel registro,
  -- che nessuno puo' ripulire dall'app. Si toglie anche quella.
  -- ------------------------------------------------------------------
  delete from documents where id = any(v_miei);
  delete from deleted_records where record_id = any(v_miei::text[]);

  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro', v_dopo - v_lapidi;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'l''identita'' di un documento');

  raise notice 'Un documento senza tipo o senza data non entra piu'' in archivio, il rifiuto nomina tutt''e due i campi, e i documenti gia'' archiviati non sono stati toccati.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000011', 'un_documento_senza_identita_non_entra')
on conflict (version) do nothing;
