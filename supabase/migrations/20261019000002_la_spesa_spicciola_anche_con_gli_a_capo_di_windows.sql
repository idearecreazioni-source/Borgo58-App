-- =====================================================================
-- LA SPESA SPICCIOLA SI SCRIVE DA SE' — SECONDO TENTATIVO, 19/10/2026
-- =====================================================================
-- 🔴 PERCHE' ESISTE. La `20261019000001` fa questo stesso lavoro, e in
--    produzione si e' FERMATA sulla sua prima guardia — com'era giusto che
--    facesse, e senza applicare niente (una transazione sola). Diceva:
--    «scrivi_dettatura nel database non e' quella della 20260909000002
--    (impronta 53faf27163a43d14534354a4cdd566e9)».
--
-- ⚠️ IL CORPO ERA LO STESSO: CAMBIAVANO SOLO GLI «A CAPO». Misurato sul
--    gestionale vero in sola lettura il 19/10:
--      md5(prosrc)                              = 53faf271… (quello rifiutato)
--      md5(replace(prosrc, E'\r\n', E'\n'))     = 6d823efe… (quello atteso)
--    In produzione le migrazioni le applica il computer di Alessio, che
--    tiene i file con gli a capo di Windows (CRLF), e Postgres conserva il
--    corpo di una funzione byte per byte. Sul progetto di prova la stessa
--    migrazione era entrata da Linux (LF): stessa funzione, impronta diversa.
--    🔴 Un'impronta presa su un database solo dice com'e' scritto QUEL
--       database, non cosa fa la funzione.
--
-- ⚠️ PERCHE' UNA MIGRAZIONE NUOVA E NON LA 001 CORRETTA: la 001 e' gia'
--    applicata sul progetto di prova, e una migrazione applicata non si
--    riscrive (23/08). Questa ripete la 001 con la guardia che confronta il
--    corpo a capo normalizzati, e REGISTRA ANCHE LA 001 — stessa forma con
--    cui la `20260824000032` ha registrato la `20260824000030`.
--    In produzione si applica cosi':
--        npm run migra -- --salta 20261019000001 --conferma
--    Sul progetto di prova la 001 c'e' gia' e questa e' idempotente: la
--    funzione risulta gia' riscritta e la guardia la lascia passare.
-- =====================================================================

do $prima$
declare
  v_md5 text;
begin
  -- ⚠️ A CAPO NORMALIZZATI: e' l'unica differenza fra questa guardia e
  --    quella della 001, ed e' tutta la ragione di questo file.
  select md5(replace(p.prosrc, E'\r\n', E'\n')) into v_md5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'scrivi_dettatura';
  if v_md5 is distinct from '6d823efe99f2a54c154f7ad016c2fdf8'
     and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'scrivi_dettatura'
                        and p.prosrc like '%senza_approvazione%') then
    raise exception 'scrivi_dettatura nel database non e'' quella della 20260909000002 nemmeno a capo normalizzati (impronta %): e'' stata toccata dopo. Guarda il corpo vivo prima di sostituirlo.', v_md5;
  end if;
end $prima$;

-- ---------------------------------------------------------------------
-- 1. Il catalogo dice cosa si scrive da se'
-- ---------------------------------------------------------------------
-- ⚠️ `not null default false` e qui il predefinito NON risponde al posto di
--    nessuno: per ogni riga che esiste gia' «aspetta Alessio» e' la regola in
--    vigore dal 06/09, non un valore inventato.
alter table tipi_azione_vocale
  add column if not exists senza_approvazione boolean not null default false;

comment on column tipi_azione_vocale.senza_approvazione is
  'Le cose dette per questa destinazione si scrivono da sole, senza aspettare l''approvazione — ma solo se MEMO era sicuro e non manca niente; altrimenti restano un appunto da guardare. Vero solo dove sbagliare non costa niente: oggi la spesa spicciola (decisione di Alessio, 19/10/2026).';

alter table tipi_azione_vocale drop constraint if exists senza_approvazione_solo_se_eseguibile;
alter table tipi_azione_vocale
  add constraint senza_approvazione_solo_se_eseguibile
  check (not senza_approvazione or eseguibile);
comment on constraint senza_approvazione_solo_se_eseguibile on tipi_azione_vocale is
  'Una cosa che il gestionale non sa ancora fare non puo'' scriversi da sola: prima serve il gesto che la esegue.';

update tipi_azione_vocale
   set senza_approvazione = true,
       spiega = 'Una riga della spesa che fai di persona al supermercato. Non compra niente, non muove soldi e non tocca il magazzino: si scrive da sola, senza approvazione, e si toglie con un tocco.'
 where tipo = 'spesa_spicciola' and not senza_approvazione;

-- ---------------------------------------------------------------------
-- 2. Il gesto che la scrive
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scrivi_dettatura(p_utente uuid, p_testo text, p_provenienza text, p_azioni jsonb, p_esito text, p_modello text, p_token_domanda integer, p_token_risposta integer, p_messaggio text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prezzo    costo_modello_ai%rowtype;
  v_costo     numeric := 0;
  v_msg       text := p_messaggio;
  v_dettatura uuid;
  v_azione    jsonb;
  v_i         integer := 0;
  v_tipo      text;
  v_libera    text;
  v_sicuro    boolean;
  v_dati      jsonb;
  v_frase     text;
  v_motivo    text;
  v_alt       jsonb;
  v_risolto   jsonb;
  v_manca     text;
  v_d         record;
  v_appunti   integer := 0;
  -- La spesa spicciola si scrive da sé (19/10/2026)
  v_da_se     boolean;
  v_app       uuid;
  v_az        uuid;
  v_ris       jsonb;
  v_eseguite  integer := 0;
begin
  if p_modello is not null then
    select * into v_prezzo from costo_modello_ai where modello = p_modello;
    if found then
      v_costo := round(
        coalesce(p_token_domanda, 0)::numeric  / 1000000 * v_prezzo.euro_milione_in +
        coalesce(p_token_risposta, 0)::numeric / 1000000 * v_prezzo.euro_milione_out, 5);
    else
      -- Uno zero silenzioso in un conto di spesa si legge «gratis».
      v_msg := coalesce(v_msg || ' — ', '') ||
        'Il costo di questa dettatura non e'' stato conteggiato: il modello «' || p_modello ||
        '» non e'' nel listino. Va aggiunto, altrimenti la spesa del mese risulta piu'' bassa del vero.';
    end if;
  end if;

  insert into dettature (testo, provenienza, esito, modello,
                         token_domanda, token_risposta, costo_euro, messaggio, creato_da)
  values (p_testo, p_provenienza, p_esito, p_modello,
          coalesce(p_token_domanda, 0), coalesce(p_token_risposta, 0), v_costo, v_msg, p_utente)
  returning id into v_dettatura;

  for v_azione in select * from jsonb_array_elements(coalesce(p_azioni, '[]'::jsonb))
  loop
    v_i      := v_i + 1;
    v_tipo   := coalesce(nullif(btrim(coalesce(v_azione->>'tipo', '')), ''), 'nota_non_capita');
    v_libera := nullif(btrim(coalesce(v_azione->>'destinazione', '')), '');
    v_sicuro := coalesce((v_azione->>'sicuro')::boolean, false);
    v_dati   := coalesce(v_azione->'dati', '{}'::jsonb);
    v_frase  := nullif(btrim(coalesce(v_azione->>'frase', '')), '');
    v_motivo := nullif(btrim(coalesce(v_azione->>'motivo', '')), '');
    v_alt    := case when jsonb_typeof(v_azione->'alternative') = 'array'
                       and jsonb_array_length(v_azione->'alternative') > 0
                     then v_azione->'alternative' end;

    select * into v_d from destinazione_vocale(v_tipo, v_libera);

    -- ⚠️ SI RITRADUCE SOLO CIO' CHE IL GESTIONALE SA ESEGUIRE: su una
    --    destinazione che non esiste non c'e' nessun catalogo in cui cercare.
    if v_d.eseguibile then
      v_risolto := voce_risolvi_dati(v_tipo, v_dati);
      v_dati    := v_risolto->'dati';
      v_manca   := nullif(v_risolto->>'manca', '');
      if v_manca is not null then
        -- Quello che manca VINCE su qualunque sicurezza dichiarata.
        v_sicuro := false;
        v_motivo := coalesce(v_motivo, v_manca);
      end if;

      -- 🔴 E CIO' CHE SI SCOPRE GUARDANDO IL DATABASE PUO' CAMBIARE LA
      --    DESTINAZIONE, non solo i dati (09/09/2026). «Segna come fatto
      --    l'ordine delle verdure» è un comando eseguibile finché in Agenda
      --    quell'impegno c'è ed è uno solo; se non c'è, o se ce ne sono
      --    due, non è più lo stesso gesto — diventa una domanda.
      --    ⚠️ Senza questa riga l'appunto resterebbe APPROVABILE (lo dice
      --    il catalogo, non i dati) e chi preme «Approva» riceverebbe un
      --    rifiuto per una cosa che la schermata gli aveva offerto.
      --    ⚠️ Chi decide resta `voce_risolvi_dati`, che è l'unico posto che
      --    ha guardato: qui si esegue quello che ha detto.
      if nullif(v_risolto->>'tipo', '') is not null
         and v_risolto->>'tipo' is distinct from v_tipo then
        v_tipo   := v_risolto->>'tipo';
        v_libera := coalesce(nullif(v_risolto->>'destinazione', ''), v_libera);
        select * into v_d from destinazione_vocale(v_tipo, v_libera);
      end if;
    else
      -- 🔴 NON E' UN'INCERTEZZA DI MEMO: MEMO puo' aver capito benissimo, e'
      --    il gestionale che non ha il gesto. Detto in parole, perche' «non
      --    sicuro» da solo farebbe credere che il problema sia nell'ascolto.
      v_motivo := coalesce(v_motivo,
        'Ho capito cosa vuoi, ma il gestionale non ha ancora un modo per farlo: '
        || 'questo appunto resta qui come promemoria.');
    end if;

    if v_frase is null then
      v_frase := coalesce(v_d.titolo, 'Una cosa che non ho capito');
    end if;

    -- 🔴 IL PERCHE' C'E' SEMPRE. Anche su una riga sicura e eseguibile: da
    --    quando niente si salva da se', anche quella aspetta — e un elenco
    --    di cose in attesa senza il perche' e' un elenco di cose di cui non
    --    si sa che fare.
    if v_motivo is null then
      v_motivo := case
        when not v_sicuro then 'Non ero sicuro: guardala tu.'
        else 'Questa la guardi sempre tu prima che venga scritta.'
      end;
    end if;

    -- 🔴 QUALCOSA SI SCRIVE DA SE', ED E' UNA RIGA DEL CATALOGO (19/10/2026,
    --    decisione di Alessio): «gli appunti che vanno nella spesa spicciola
    --    non necessitano di approvazione». Non un nome scritto qui dentro: la
    --    colonna `senza_approvazione`, che oggi e' vera per una riga sola.
    -- ⚠️ TRE CONDIZIONI, e tutte e tre servono: il gestionale sa farla, MEMO
    --    era sicuro, e non manca niente. Se una sola cade, la riga torna a
    --    essere un appunto da guardare — e' la via di prima, non un errore.
    v_da_se := v_d.eseguibile and v_sicuro and v_manca is null
               and exists (select 1 from tipi_azione_vocale t
                            where t.tipo = v_tipo and t.attivo and t.senza_approvazione);

    if v_da_se then
      -- ⚠️ UN APPUNTO SUO, MAI QUELLO APERTO DELLA LISTA: la spesa spicciola
      --    e' additiva, e agganciarsi all'appunto aperto vorrebbe dire
      --    mettere una riga gia' scritta dentro un appunto ancora da
      --    approvare — che al «sì» la scriverebbe una seconda volta.
      insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
      values (v_tipo, v_d.titolo, true, null)
      returning id into v_app;

      insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,
                                  frase, motivo, stato, alternative, destinazione_libera,
                                  appunto_id)
      values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,
              v_frase, v_motivo, 'in_attesa', v_alt, v_libera, v_app)
      returning id into v_az;

      -- ⚠️ SE LA SCRITTURA NON RIESCE, LA COSA DETTA NON SI PERDE: il blocco
      --    annulla solo il tentativo, e la riga resta li' da guardare col
      --    perche' scritto. Una dettatura che fallisce in silenzio e' la cosa
      --    che farebbe smettere di usare la voce.
      begin
        v_ris := fai_azione_dettata(v_tipo, v_dati);
        update azioni_dettate
           set stato = 'eseguita', eseguita_il = now(), risultato = v_ris,
               errore = null, motivo = null
         where id = v_az;
        update appunti_vocali
           set stato = 'approvato', chiuso_il = now(), chiuso_da = p_utente
         where id = v_app;
        v_eseguite := v_eseguite + 1;
      exception when others then
        update azioni_dettate
           set motivo = 'Doveva scriversi da sola nella spesa spicciola, ma non ci sono riuscito ('
                        || sqlerrm || '): guardala tu.'
         where id = v_az;
      end;
    else
      -- 🔴 TUTTO IL RESTO E' SEMPRE `in_attesa`, e l'appunto lo mette il trigger.
      insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro,
                                  frase, motivo, stato, alternative, destinazione_libera)
      values (v_dettatura, v_i, v_tipo, v_dati, v_sicuro,
              v_frase, v_motivo, 'in_attesa', v_alt, v_libera);
    end if;
  end loop;

  select count(distinct a.appunto_id) into v_appunti
    from azioni_dettate a
   where a.dettatura_id = v_dettatura
     -- ⚠️ Gli appunti DA GUARDARE: quelli gia' scritti da se' sono chiusi.
     and a.stato <> 'eseguita';

  return jsonb_build_object(
    'dettatura_id', v_dettatura,
    'costo_euro',   v_costo,
    'nel_listino',  v_prezzo.modello is not null,
    'azioni',       v_i,
    'eseguite',     v_eseguite,
    'appunti',      coalesce(v_appunti, 0),
    'da_guardare',  v_i - v_eseguite);
end $function$;;

comment on function scrivi_dettatura(uuid, text, text, jsonb, text, text, integer, integer, text) is
  'Registra una dettatura e le cose capite. Tutto resta un appunto da approvare, tranne le destinazioni che il catalogo segna senza_approvazione (oggi la spesa spicciola): quelle, se MEMO era sicuro e non manca niente, si scrivono subito in un appunto loro, gia'' chiuso.';

-- ---------------------------------------------------------------------
-- 3. La verifica
-- ---------------------------------------------------------------------
-- ⚠️ Tutto dentro una sotto-transazione che si annulla da sola: niente
--    resta, e lo si controlla con `pretendi_nessun_residuo`.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_r        jsonb;
  v_det      uuid;
  v_a        azioni_dettate%rowtype;
  v_p        appunti_vocali%rowtype;
  v_n        integer;
  v_aperto   uuid;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare in user_roles.';
  end if;

  if (select count(*) from tipi_azione_vocale where senza_approvazione) <> 1
     or not (select senza_approvazione from tipi_azione_vocale where tipo = 'spesa_spicciola') then
    raise exception 'VERIFICA: senza approvazione doveva esserci la sola spesa spicciola.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    -- Un appunto aperto della spesa spicciola che c'era gia': la riga nuova
    -- NON deve finirci dentro (verrebbe scritta due volte all'approvazione).
    v_r := scrivi_dettatura(v_titolare, 'ZZ verifica — prima', 'app',
      jsonb_build_array(jsonb_build_object('tipo', 'spesa_spicciola', 'sicuro', false,
        'frase', 'ZZ verifica sale', 'dati', jsonb_build_object('nome_libero', 'ZZ verifica sale'))),
      'capita', null, 0, 0, null);
    select appunto_id into v_aperto from azioni_dettate
     where dettatura_id = (v_r->>'dettatura_id')::uuid;
    if (v_r->>'eseguite')::int <> 0 or (v_r->>'da_guardare')::int <> 1 then
      raise exception 'VERIFICA: una riga NON sicura si e'' scritta da sola (%).', v_r;
    end if;
    if exists (select 1 from spesa_spicciola where articolo = 'ZZ verifica sale') then
      raise exception 'VERIFICA: una riga non sicura e'' finita nella spesa spicciola.';
    end if;

    -- 1. Sicura: si scrive subito, in un appunto suo gia' chiuso.
    v_r := scrivi_dettatura(v_titolare, 'ZZ verifica — shampoo e farina', 'app',
      jsonb_build_array(
        jsonb_build_object('tipo', 'spesa_spicciola', 'sicuro', true,
          'frase', 'ZZ verifica shampoo',
          'dati', jsonb_build_object('nome_libero', 'ZZ verifica shampoo', 'categoria', 'pulizia')),
        jsonb_build_object('tipo', 'lista_spesa', 'sicuro', true,
          'frase', 'ZZ verifica farina',
          'dati', jsonb_build_object('nome_libero', 'ZZ verifica farina'))),
      'capita', null, 0, 0, null);
    v_det := (v_r->>'dettatura_id')::uuid;
    if (v_r->>'eseguite')::int <> 1 or (v_r->>'da_guardare')::int <> 1
       or (v_r->>'appunti')::int <> 1 then
      raise exception 'VERIFICA: i conti della dettatura non tornano (%).', v_r;
    end if;

    select * into v_a from azioni_dettate where dettatura_id = v_det and tipo = 'spesa_spicciola';
    if v_a.stato is distinct from 'eseguita' or v_a.eseguita_il is null or v_a.motivo is not null then
      raise exception 'VERIFICA: la spesa spicciola sicura non risulta scritta (%).', row_to_json(v_a);
    end if;
    if v_a.appunto_id is not distinct from v_aperto then
      raise exception 'VERIFICA: la riga scritta da sola e'' finita nell''appunto ancora aperto.';
    end if;
    select * into v_p from appunti_vocali where id = v_a.appunto_id;
    if v_p.stato is distinct from 'approvato' or v_p.chiuso_da is distinct from v_titolare then
      raise exception 'VERIFICA: l''appunto della riga scritta da sola non e'' chiuso (%).', row_to_json(v_p);
    end if;
    select count(*) into v_n from spesa_spicciola
     where articolo = 'ZZ verifica shampoo' and categoria = 'pulizia';
    if v_n <> 1 then
      raise exception 'VERIFICA: nella spesa spicciola c''e'' % volte lo shampoo invece di una.', v_n;
    end if;

    -- 2. Allo specchio: la lista della spesa ASPETTA come prima.
    select * into v_a from azioni_dettate where dettatura_id = v_det and tipo = 'lista_spesa';
    if v_a.stato is distinct from 'in_attesa' then
      raise exception 'VERIFICA: la lista della spesa non aspetta piu'' l''approvazione.';
    end if;
    if exists (select 1 from shopping_list_items where custom_name = 'ZZ verifica farina') then
      raise exception 'VERIFICA: la lista della spesa si e'' scritta da sola.';
    end if;

    -- 3. L'appunto vecchio resta aperto, con dentro la sua riga sola.
    if (select stato from appunti_vocali where id = v_aperto) is distinct from 'aperto'
       or (select count(*) from azioni_dettate where appunto_id = v_aperto) <> 1 then
      raise exception 'VERIFICA: l''appunto aperto della spesa spicciola e'' stato toccato.';
    end if;

    -- 4. Se la scrittura fallisce, la cosa detta resta da guardare.
    v_r := scrivi_dettatura(v_titolare, 'ZZ verifica — senza nome', 'app',
      jsonb_build_array(jsonb_build_object('tipo', 'spesa_spicciola', 'sicuro', true,
        'frase', 'ZZ verifica vuota', 'dati', '{}'::jsonb)),
      'capita', null, 0, 0, null);
    select * into v_a from azioni_dettate where dettatura_id = (v_r->>'dettatura_id')::uuid;
    if v_a.stato is distinct from 'in_attesa' or coalesce(v_a.motivo, '') not like '%guardala tu%'
       or (v_r->>'eseguite')::int <> 0 then
      raise exception 'VERIFICA: una scrittura fallita non e'' rimasta da guardare (%).', row_to_json(v_a);
    end if;
    if (select stato from appunti_vocali where id = v_a.appunto_id) is distinct from 'aperto' then
      raise exception 'VERIFICA: l''appunto di una scrittura fallita risulta chiuso.';
    end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica della spesa spicciola senza approvazione');

  raise notice 'Fatto: la spesa spicciola detta con sicurezza si scrive da sola in un appunto suo gia'' chiuso; quella incerta o incompleta resta da guardare; la lista della spesa aspetta come prima. Provato e annullato: zero residui.';
end $verifica$;


-- La 20261019000001 si registra qui: in produzione si salta, perche' la
-- sua guardia confronta il corpo con gli a capo di Linux (vedi sopra).
insert into applied_migrations (version, name)
values ('20261019000001', 'la_spesa_spicciola_si_scrive_da_se')
on conflict (version) do nothing;

insert into applied_migrations (version, name)
values ('20261019000002', 'la_spesa_spicciola_anche_con_gli_a_capo_di_windows')
on conflict (version) do nothing;
