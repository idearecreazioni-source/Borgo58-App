-- L'ARRIVO DICE SU QUALE RIGA VA, E LÌ SI CAMBIA
-- =====================================================================
-- Coda del blocco 1 del mandato «la lista non scrive mai un'uscita»,
-- dopo la risposta di Alessio del 19/08 alla domanda «due righe dello
-- stesso prodotto: quale riceve l'arrivo?».
--
-- 🔴 HA SCARTATO TUTTE E DUE LE STRADE CHE GLI AVEVO PROPOSTO (la più
-- vecchia in silenzio / chiedere ogni volta) e ha scelto la terza, che è
-- **la stessa forma già decisa il 17/08 per il mezzo di pagamento**:
--
--     si fa da sé, ma si vede, e lì si cambia.
--
-- ⚠️ LA RAGIONE, e vale come criterio oltre questo caso: andare sulla più
-- vecchia **in silenzio** è un predefinito che può sbagliare senza che
-- nessuno se ne accorga — 20 kg di pomodoro per sabato e 10 dal fornitore
-- nuovo, l'arrivo finisce sulla riga sbagliata e la lista mente in due
-- punti. Chiedere ogni volta aggiunge un gesto a un'operazione che ne ha
-- già tre. *Un predefinito che si vede è una comodità; uno che riempie un
-- campo che nessuno guarda è la famiglia dei 33 posti silenziosi.*
--
-- ⚠️ E SI VEDE NEL MOMENTO IN CUI L'ARRIVO SI CONFERMA, non dopo in un
-- elenco di movimenti: *dopo non è più una correzione, è una riparazione.*

-- ---------------------------------------------------------------------
-- 1 · Quali righe della lista aspettano questo prodotto
-- ---------------------------------------------------------------------
-- ⚠️ `security definer` per NECESSITÀ, non per comodità: la lista della
-- spesa è titolare-only, e chi registra una consegna a mano può essere lo
-- staff. Senza, un cuoco vedrebbe **zero righe** e crederebbe che non ci
-- sia niente da scegliere — una schermata che tace invece di rifiutare.
-- Escono solo le colonne che lo staff già vede nella vista `_display`:
-- niente importi, niente fornitori.
create or replace function righe_lista_aperte(p_ingredient_id uuid)
returns table (
  id                 uuid,
  in_lista_dal       timestamptz,
  quantita_richiesta numeric,
  quantita_arrivata  numeric,
  unita              text,
  predefinita        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select sli.id,
         sli.created_at,
         sli.quantity_needed,
         sli.quantita_arrivata,
         coalesce(sli.unit, i.unit)::text,
         -- La prima della fila: è quella che riceve l'arrivo se nessuno
         -- dice il contrario.
         sli.created_at = min(sli.created_at) over ()
  from shopping_list_items sli
  left join ingredients i on i.id = sli.ingredient_id
  where sli.ingredient_id = p_ingredient_id
    and sli.status in ('da_comprare', 'ordinata')
  order by sli.created_at;
$$;

revoke all on function righe_lista_aperte(uuid) from public, anon;
grant execute on function righe_lista_aperte(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · L'arrivo può essere indirizzato
-- ---------------------------------------------------------------------
-- ⚠️ SI CANCELLA E SI RICREA, non si aggiunge un parametro: in Postgres un
-- parametro in più fa una funzione **nuova**, e due sovrapposte rendono
-- ambigua ogni chiamata per nome (42725, a tempo di esecuzione — cioè
-- quando arriva la merce vera). Trappola già pagata il 12/08.
drop function if exists registra_arrivo_in_lista(uuid, numeric);

create or replace function registra_arrivo_in_lista(
  p_ingredient_id uuid,
  p_quantita      numeric,
  p_riga_lista    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga shopping_list_items;
  v_tot  numeric;
begin
  if p_ingredient_id is null or p_quantita is null or p_quantita <= 0 then
    return null;
  end if;

  if p_riga_lista is not null then
    select * into v_riga from shopping_list_items where id = p_riga_lista;
    -- ⚠️ UNA SCELTA SBAGLIATA SI RIFIUTA, non si corregge in silenzio
    -- tornando alla più vecchia: ripiegare vorrebbe dire scrivere
    -- l'arrivo da un'altra parte **dicendo di aver fatto quel che si
    -- chiedeva**, ed è il modo silenzioso di far mentire la lista.
    if v_riga.id is null then
      raise exception 'La riga della lista scelta non esiste';
    end if;
    if v_riga.ingredient_id is distinct from p_ingredient_id then
      raise exception 'La riga della lista scelta è di un altro prodotto';
    end if;
    if v_riga.status not in ('da_comprare', 'ordinata') then
      raise exception 'La riga della lista scelta è già chiusa';
    end if;
  else
    select * into v_riga
      from shopping_list_items
     where ingredient_id = p_ingredient_id
       and status in ('da_comprare', 'ordinata')
     order by created_at
     limit 1;
    if v_riga.id is null then
      return null;
    end if;
  end if;

  v_tot := coalesce(v_riga.quantita_arrivata, 0) + p_quantita;

  update shopping_list_items
     set quantita_arrivata = v_tot,
         -- L'arrivo completo chiude la riga. ⚠️ Nessun importo e nessun
         -- mezzo di pagamento: il costo di questa merce sta nel documento
         -- che l'ha portata, e la lista non scrive mai un'uscita.
         status = case
                    when v_riga.quantity_needed is not null
                     and v_tot >= v_riga.quantity_needed then 'acquistato'
                    else status
                  end,
         purchased_at = case
                          when v_riga.quantity_needed is not null
                           and v_tot >= v_riga.quantity_needed then now()
                          else purchased_at
                        end
   where id = v_riga.id;

  return v_riga.id;
end;
$$;

revoke all on function registra_arrivo_in_lista(uuid, numeric, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3 · Il carico porta con sé la scelta
-- ---------------------------------------------------------------------
-- Stessa ragione del `drop` qui sopra: un parametro in più è una funzione
-- nuova. ⚠️ E dopo un `drop` i permessi tornano aperti al mondo (trappola
-- del 13/08): si richiudono a mano, e la verifica lo controlla.
drop function if exists register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text);

create or replace function register_stock_delivery(
  p_ingredient_id         uuid,
  p_quantity              numeric,
  p_supplier_id           uuid    default null,
  p_expiry_date           date    default null,
  p_note                  text    default null,
  p_unit_cost             numeric default null,
  p_supplier_batch_number text    default null,
  p_riga_lista            uuid    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La quantità deve essere maggiore di zero';
  end if;
  -- Invariato: lo staff registra una consegna, ma non ne scrive il costo.
  -- Non è un controllo di schermata che si possa aggirare.
  if p_unit_cost is not null and not is_titolare() then
    raise exception 'Solo il titolare può registrare il costo di un carico';
  end if;

  insert into stock_lots (
    ingredient_id, supplier_id, quantity_received, quantity_remaining,
    unit_cost, expiry_date, note, supplier_batch_number
  )
  values (
    p_ingredient_id, p_supplier_id, p_quantity, p_quantity,
    p_unit_cost, p_expiry_date, p_note, nullif(p_supplier_batch_number, '')
  )
  returning id into v_id;

  -- La lista della spesa smette di chiedere ciò che è appena entrato.
  perform registra_arrivo_in_lista(p_ingredient_id, p_quantity, p_riga_lista);

  return v_id;
end;
$$;

revoke all on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text, uuid)
  from public, anon;
grant execute on function register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- 4 · Il carico da fattura passa la scelta riga per riga
-- ---------------------------------------------------------------------
-- ⚠️ RIPRESA DAL DATABASE, NON DAL FILE CHE L'AVEVA CREATA (regola del
-- 18/08): il corpo qui sotto è quello vivo del 19/08, letto con
-- `pg_get_functiondef`, con una sola riga cambiata — il passaggio di
-- `p_riga_lista`. Ricopiarla dalla migrazione che la creò annullerebbe in
-- silenzio tutte le migrazioni che l'hanno toccata dopo.
CREATE OR REPLACE FUNCTION public.esegui_azione_posta(p_azione_id uuid, p_parametri jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_azione   posta_azioni%rowtype;
  v_par      jsonb;
  v_allegato posta_allegati%rowtype;
  v_posta    posta_ricevuta%rowtype;
  v_doc      uuid;
  v_task     uuid;
  v_riga     jsonb;
  v_elenco   text := '';
  n_aperte   integer;
  v_forn     uuid;
  v_ingr     uuid;
  v_qta      numeric;
  v_lotti    integer := 0;
  v_haccp    integer := 0;
  v_saltate  integer := 0;
  v_creati   integer := 0;
  v_nota     text;
  v_esito    jsonb;
  v_nuovo    jsonb;
  v_ente     uuid;
  v_fatt     numeric;
  v_prezzo   numeric;
  v_chiave   text;
  v_art      uuid;
  v_var      record;
  v_trovato  record;
  v_rincari  jsonb := '[]'::jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' decidere sulla posta';
  end if;

  select * into v_azione from posta_azioni where id = p_azione_id for update;
  if not found then
    raise exception 'Questa proposta non esiste piu''';
  end if;

  if v_azione.stato = 'fatta' then
    return jsonb_build_object('gia_fatta', true,
      'documento_id', v_azione.documento_id, 'task_id', v_azione.task_id);
  end if;

  v_par := coalesce(p_parametri, v_azione.parametri);
  select * into v_posta from posta_ricevuta where id = v_azione.posta_id;

  if v_azione.tipo in ('archivia_documento', 'archivia_testo') then
    if v_azione.tipo = 'archivia_documento' then
      select * into v_allegato from posta_allegati
       where id = nullif(v_par->>'allegato_id', '')::uuid;
    end if;

    v_doc := create_document(
      p_title          => coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
      p_doc_type       => nullif(v_par->>'tipo', ''),
      p_document_date  => nullif(v_par->>'data', '')::date,
      p_counterparties => nullif(v_par->>'controparte', ''),
      p_amount         => nullif(v_par->>'importo', '')::numeric,
      p_expiry_date    => nullif(v_par->>'scadenza', '')::date,
      p_note           => nullif(v_par->>'note', ''),
      p_storage_path   => v_allegato.storage_path,
      p_file_name      => v_allegato.file_name
    );

    update documents
       set testo = coalesce(nullif(v_par->>'contenuto', ''), v_posta.testo)
     where id = v_doc;

  elsif v_azione.tipo = 'promemoria' then
    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(v_par->>'note', ''), nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'promemoria_multipli' then
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'scadenze', '[]'::jsonb))
    loop
      if nullif(v_riga->>'data', '') is not null then
        insert into tasks (title, description, due_date, category, origine_modulo)
        values (coalesce(nullif(v_riga->>'titolo', ''), v_azione.titolo),
                nullif(v_riga->>'note', ''), (v_riga->>'data')::date,
                'amministrativo', 'posta')
        returning id into v_task;
      end if;
    end loop;

  elsif v_azione.tipo = 'carico_magazzino' then
    v_forn := nullif(v_par->>'fornitore_id', '')::uuid;
    v_nota := nullif(v_par->>'documento', '');

    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'righe', '[]'::jsonb))
    loop
      v_chiave := chiave_articolo(v_riga->>'descrizione');

      if coalesce((v_riga->>'ignora')::boolean, false) then
        if v_chiave is not null then
          insert into articoli_fornitore (supplier_id, descrizione, chiave, ingredient_id, ignora)
          values (v_forn, v_riga->>'descrizione', v_chiave, null, true)
          on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave)
          do update set ingredient_id = null, ignora = true, aggiornato_il = now();
        end if;
        v_saltate := v_saltate + 1;
        continue;
      end if;

      v_ingr := nullif(v_riga->>'ingrediente_id', '')::uuid;
      v_qta  := nullif(v_riga->>'quantita', '')::numeric;
      v_nuovo := v_riga->'nuovo_ingrediente';

      if v_ingr is null
         and v_nuovo is not null
         and nullif(v_nuovo->>'nome', '') is not null
         and not coalesce((v_riga->>'salta')::boolean, false) then
        select entity_id into v_ente from suppliers where id = v_forn;
        if v_ente is null then
          select id into v_ente from entities order by created_at limit 1;
        end if;
        if v_ente is null then
          raise exception 'Non esiste nessuna entita'' a cui intestare l''ingrediente nuovo';
        end if;

        -- ⚠️ Non `insert` diretto: se un ingrediente con quel nome c'e'
        -- gia', ci si aggancia. La schermata dovrebbe averlo gia' evitato,
        -- ma un difetto che produce dati sbagliati che SEMBRANO giusti
        -- merita due difese.
        select * into v_trovato from trova_o_crea_ingrediente(
          v_ente,
          v_nuovo->>'nome',
          coalesce(nullif(v_nuovo->>'unita', '')::unit_type, 'kg'),
          coalesce(nullif(v_nuovo->>'categoria', '')::ingredient_category, 'altro'),
          coalesce((v_nuovo->>'alimentare')::boolean, true)
        );
        v_ingr := v_trovato.id;
        if not v_trovato.era_gia_li then
          v_creati := v_creati + 1;
        end if;
      end if;

      if coalesce((v_riga->>'salta')::boolean, false)
         or v_ingr is null or v_qta is null or v_qta <= 0 then
        v_saltate := v_saltate + 1;
        continue;
      end if;

      v_fatt := coalesce(nullif(v_riga->>'fattore', '')::numeric, 1);
      if v_fatt is null or v_fatt <= 0 then v_fatt := 1; end if;
      v_prezzo := nullif(v_riga->>'costo_unitario', '')::numeric;
      if v_prezzo is not null then v_prezzo := v_prezzo / v_fatt; end if;

      v_art := null;
      if coalesce((v_riga->>'ricorda')::boolean, true) and v_chiave is not null then
        insert into articoli_fornitore (
          supplier_id, descrizione, chiave, ingredient_id, unita_fattura, fattore, ignora
        )
        values (
          v_forn, v_riga->>'descrizione', v_chiave, v_ingr,
          nullif(v_riga->>'unita_fattura', ''), v_fatt, false
        )
        on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), chiave)
        do update set ingredient_id = excluded.ingredient_id,
                      unita_fattura = excluded.unita_fattura,
                      fattore       = excluded.fattore,
                      ignora        = false,
                      aggiornato_il = now()
        returning id into v_art;
      end if;

      if v_prezzo is not null and v_art is not null then
        select * into v_var from variazione_prezzo(v_art, v_prezzo);
        if found and v_var.da_segnalare then
          v_rincari := v_rincari || jsonb_build_array(jsonb_build_object(
            'ingrediente',       (select name from ingredients where id = v_ingr),
            'versione',          v_riga->>'descrizione',
            'prima',             v_var.prezzo_precedente,
            'adesso',            round(v_prezzo, 4),
            'variazione',        v_var.variazione,
            'primo',             v_var.prezzo_primo,
            'variazione_totale', v_var.variazione_totale));
        end if;
      end if;

      perform register_stock_delivery(
        p_ingredient_id         => v_ingr,
        p_quantity              => v_qta * v_fatt,
        p_supplier_id           => v_forn,
        p_expiry_date           => nullif(v_riga->>'scadenza', '')::date,
        p_note                  => v_nota,
        p_unit_cost             => v_prezzo,
        p_supplier_batch_number => nullif(v_riga->>'lotto', ''),
        -- ⚠️ SU QUALE RIGA DELLA LISTA DELLA SPESA va questo arrivo. Vuoto
        -- = la piu' vecchia aperta, che e' il predefinito; la schermata
        -- lo dice e lo fa cambiare PRIMA di confermare (Alessio, 19/08).
        p_riga_lista            => nullif(v_riga->>'riga_lista', '')::uuid
      );
      v_lotti := v_lotti + 1;

      if v_prezzo is not null then
        perform update_ingredient_price(v_ingr, v_prezzo, 'fattura', v_nota, v_forn, v_art);
      end if;

      if (v_par->>'registra_haccp')::boolean is true then
        insert into haccp_goods_receiving (
          supplier_id, product_description, temperature_c,
          packaging_ok, conformity, note
        )
        values (
          v_forn,
          coalesce(nullif(v_riga->>'descrizione', ''),
                   (select name from ingredients where id = v_ingr)),
          nullif(v_par->>'temperatura', '')::numeric,
          coalesce((v_par->>'imballo_integro')::boolean, true),
          coalesce((v_par->>'conformita')::boolean, true),
          nullif(concat_ws(' — ', v_nota, nullif(v_riga->>'lotto', '')), '')
        );
        v_haccp := v_haccp + 1;
      end if;
    end loop;

    if v_lotti = 0 then
      raise exception 'Nessuna riga da caricare: scegli almeno un ingrediente e una quantità';
    end if;

    for v_riga in select * from jsonb_array_elements(v_rincari)
    loop
      perform segnala_allarme(
        tipo_allarme_rincaro((v_riga->>'ingrediente'),
                             (v_riga->>'versione'),
                             (v_riga->>'adesso')::numeric),
        messaggio_rincaro(v_riga, v_nota),
        v_riga,
        'rincaro'
      );
    end loop;

    v_esito := jsonb_build_object('lotti', v_lotti, 'haccp', v_haccp,
                                  'saltate', v_saltate, 'creati', v_creati,
                                  'rincari', v_rincari);

  elsif v_azione.tipo = 'da_fare_a_mano' then
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'passi', '[]'::jsonb))
    loop
      v_elenco := v_elenco || '· ' || coalesce(v_riga #>> '{}', '') || E'\n';
    end loop;

    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(coalesce(nullif(v_elenco, ''), nullif(v_par->>'note', '')), ''),
            nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'nessuna' then
    null;
  end if;

  update posta_azioni
     set stato = 'fatta', decisa_il = now(),
         parametri = v_par, documento_id = v_doc, task_id = v_task
   where id = p_azione_id;

  select count(*) into n_aperte
    from posta_azioni where posta_id = v_azione.posta_id and stato = 'proposta';
  if n_aperte = 0 then
    update posta_ricevuta
       set stato = case
             when exists (select 1 from posta_azioni
                           where posta_id = v_azione.posta_id
                             and stato = 'fatta' and tipo <> 'nessuna')
             then 'archiviata'::stato_posta else 'scartata'::stato_posta end,
           documento_id = coalesce(documento_id, v_doc)
     where id = v_azione.posta_id;
  end if;

  return coalesce(v_esito, '{}'::jsonb)
         || jsonb_build_object('documento_id', v_doc, 'task_id', v_task);
end
$function$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente    uuid;
  v_ingr    uuid;
  v_vecchia uuid;
  v_nuova   uuid;
  v_altro   uuid;
  v_riga_altro uuid;
  v_lapidi  integer;
  v_quante  integer;
  respinto  boolean;
begin
  -- ⚠️ IL BLOCCO IMPERSONA IL TITOLARE PRIMA DI CHIAMARE LE FUNZIONI
  -- DELL'APP: una migrazione non ha un utente, ha un proprietario, quindi
  -- `auth.uid()` e' nullo e un portiere rifiuterebbe (difetto del 16/08,
  -- sorvegliato da tests/app/migrazioni-senza-portieri.test.js).
  -- `register_stock_delivery` ha un portiere sul COSTO: qui non gliene si
  -- passa nessuno, ma provarla come la chiama l'app e' l'unico modo perche'
  -- questa verifica dica qualcosa del mondo vero.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  insert into ingredients (entity_id, name, unit, category)
  values (v_ente, 'VERIFICA scelta riga', 'kg', 'altro')
  returning id into v_ingr;
  insert into ingredients (entity_id, name, unit, category)
  values (v_ente, 'VERIFICA scelta riga altro', 'kg', 'altro')
  returning id into v_altro;

  -- Due righe dello stesso prodotto, con date diverse: e' il caso che
  -- Alessio ha nominato — 20 kg per sabato e 10 dal fornitore nuovo.
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source, created_at)
  values (v_ingr, 20, 'kg', 'manuale', now() - interval '3 days')
  returning id into v_vecchia;
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source, created_at)
  values (v_ingr, 10, 'kg', 'manuale', now() - interval '1 day')
  returning id into v_nuova;

  -- --- L'elenco che la schermata mostra ---
  select count(*) into v_quante from righe_lista_aperte(v_ingr);
  if v_quante <> 2 then
    raise exception 'L''elenco delle righe aperte ne conta % invece di 2.', v_quante;
  end if;
  if (select id from righe_lista_aperte(v_ingr) where predefinita) <> v_vecchia then
    raise exception 'La riga predefinita non e'' la piu'' vecchia.';
  end if;

  -- --- Senza scelta: va sulla piu' vecchia ---
  perform register_stock_delivery(p_ingredient_id => v_ingr, p_quantity => 5, p_note => 'VERIFICA');
  if (select quantita_arrivata from shopping_list_items where id = v_vecchia) is distinct from 5 then
    raise exception 'Senza scelta, l''arrivo non e'' andato sulla riga piu'' vecchia.';
  end if;
  if (select quantita_arrivata from shopping_list_items where id = v_nuova) is not null then
    raise exception 'Senza scelta, l''arrivo ha toccato anche l''altra riga.';
  end if;

  -- --- Con la scelta: va DOVE DICE LUI ---
  -- ⚠️ E' la meta' della decisione che, senza questa prova, non sarebbe
  -- provata da niente: togliendo la possibilita' di correggere, tutto il
  -- resto resterebbe verde.
  perform register_stock_delivery(
    p_ingredient_id => v_ingr, p_quantity => 4, p_note => 'VERIFICA', p_riga_lista => v_nuova
  );
  if (select quantita_arrivata from shopping_list_items where id = v_nuova) is distinct from 4 then
    raise exception 'Con la scelta, l''arrivo non e'' andato sulla riga scelta.';
  end if;
  if (select quantita_arrivata from shopping_list_items where id = v_vecchia) <> 5 then
    raise exception 'Con la scelta, l''arrivo ha toccato anche la riga predefinita.';
  end if;

  -- --- Una scelta di UN ALTRO PRODOTTO si RIFIUTA, non ripiega in silenzio ---
  insert into shopping_list_items (ingredient_id, quantity_needed, unit, source)
  values (v_altro, 3, 'kg', 'manuale')
  returning id into v_riga_altro;
  respinto := false;
  begin
    perform register_stock_delivery(
      p_ingredient_id => v_ingr, p_quantity => 1, p_riga_lista => v_riga_altro
    );
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un arrivo si e'' lasciato scrivere su una riga di UN ALTRO prodotto.';
  end if;
  if (select quantita_arrivata from shopping_list_items where id = v_riga_altro) is not null then
    raise exception 'Il rifiuto ha lasciato dietro di se'' un arrivo scritto.';
  end if;

  -- --- E una riga gia' chiusa non si riapre da un arrivo indirizzato ---
  respinto := false;
  update shopping_list_items set status = 'acquistato' where id = v_nuova;
  begin
    perform register_stock_delivery(
      p_ingredient_id => v_ingr, p_quantity => 1, p_riga_lista => v_nuova
    );
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un arrivo si e'' lasciato scrivere su una riga gia'' chiusa.';
  end if;

  -- --- I permessi dopo i due drop ---
  if has_function_privilege('anon', 'register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text, uuid)', 'execute') then
    raise exception 'register_stock_delivery e'' rimasta eseguibile da anon.';
  end if;
  if not has_function_privilege('authenticated', 'register_stock_delivery(uuid, numeric, uuid, date, text, numeric, text, uuid)', 'execute') then
    raise exception 'register_stock_delivery non e'' piu'' eseguibile dal gestionale.';
  end if;
  if has_function_privilege('anon', 'righe_lista_aperte(uuid)', 'execute') then
    raise exception 'righe_lista_aperte e'' eseguibile da anon.';
  end if;

  -- ⚠️ E non ne devono restare DUE: una funzione sovrapposta rende ambigua
  -- ogni chiamata per nome, e l'errore arriva quando entra la merce vera.
  select count(*) into v_quante from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'register_stock_delivery';
  if v_quante <> 1 then
    raise exception 'Ci sono % versioni di register_stock_delivery.', v_quante;
  end if;
  select count(*) into v_quante from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'registra_arrivo_in_lista';
  if v_quante <> 1 then
    raise exception 'Ci sono % versioni di registra_arrivo_in_lista.', v_quante;
  end if;

  -- --- E il carico da fattura passa davvero la scelta ---
  -- ⚠️ Si legge il CORPO della funzione: si puo' correggere l'aiuto e
  -- lasciare il chiamante com'era, e la migrazione passerebbe verde con
  -- il difetto vivo (lezione del 13/08).
  -- ⚠️ Si chiede per NOME e non come `nome(argomenti)::regprocedure`: la
  -- rete che sorveglia i portieri nelle migrazioni riconosce le chiamate
  -- dal testo, e un nome seguito da una parentesi dentro una stringa le
  -- sembra una chiamata. Un guardiano che grida a vuoto viene spento.
  if (select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'esegui_azione_posta')
     not like '%p_riga_lista%' then
    raise exception 'Il carico da fattura non passa la riga della lista scelta.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- --- Pulizia del perimetro ---
  delete from shopping_list_items where ingredient_id in (v_ingr, v_altro);
  delete from stock_lots where ingredient_id in (v_ingr, v_altro);
  delete from ingredients where id in (v_ingr, v_altro);

  if (select count(*) from deleted_records) <> v_lapidi then
    raise exception 'Le lapidi sono passate da % a %.', v_lapidi, (select count(*) from deleted_records);
  end if;

  raise notice 'Scelta della riga: elenco con la predefinita, senza scelta va alla piu'' vecchia, con la scelta va dove dice lui, riga di un altro prodotto e riga chiusa respinte, una sola versione di ogni funzione.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000002', 'l_arrivo_dice_su_quale_riga_va')
on conflict (version) do nothing;
