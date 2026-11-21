-- =====================================================================
-- MEMO PROPONE GLI AGGIORNAMENTI DELLA SCHEDA — 21/11/2026 (pezzo B1).
-- =====================================================================
-- La Scheda di Borgo 58 (migrazione 20261120000002) la scrive e la corregge
-- solo il titolare. Questa migrazione aggiunge le PROPOSTE: suggerimenti a
-- COSTO ZERO, calcolati con regole fisse (nessun modello AI), che il titolare
-- accetta («Sì»), rifiuta («Non farlo») o corregge («Correggi»).
--
-- 🔴 NESSUNA SCRITTURA SULLA SCHEDA SENZA IL SÌ DEL TITOLARE. La tabella
--    delle proposte non la scrive nessuno dall'app: la riempie soltanto
--    `scheda_proposte_genera()` e la chiude soltanto `scheda_proposta_decidi()`.
--    Una proposta accettata passa dagli stessi portieri della pagina
--    (privacy, limiti, storico): un rifiuto del database lascia la proposta
--    «in attesa».
--
-- Le regole fisse (da `scheda_proposte_calcola()`):
--   · fornitore nuovo in anagrafica (ultimi 60 giorni, non occasionale);
--   · contratto nuovo in Archivio (sezione «contratti», ultimi 60 giorni);
--   · voci da riconfermare: fornitori e consulenti dopo 12 mesi, locale e
--     concept dopo 6, decisioni mai (e qualunque voce, tranne le decisioni,
--     la cui data «da rivedere» è passata);
--   · voci da spegnere: contratto collegato scaduto, fornitore spento.
-- Al massimo 5 proposte NUOVE al giorno (giorno di Roma). Una proposta non
-- decisa scade dopo 30 giorni; una rifiutata non si ripropone per 90 giorni,
-- una scaduta per 30.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA TABELLA DELLE PROPOSTE
-- ---------------------------------------------------------------------
create table if not exists scheda_proposte (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  origine text not null,
  origine_id uuid,
  chiave text not null,
  voce_id uuid references scheda_voci(id) on delete restrict,
  sezione text not null,
  testo_prima text,
  testo_dopo text,
  fonte_prima text,
  fonte_dopo text,
  documento_id uuid references documents(id) on delete set null,
  abbassa_fonte boolean not null default false,
  motivo text not null,
  stato text not null default 'in_attesa',
  creata_il timestamptz not null default now(),
  scade_il date not null,
  decisa_il timestamptz,
  decisa_da uuid,
  testo_accettato text,
  voce_creata_id uuid references scheda_voci(id) on delete restrict,
  constraint scheda_proposta_tipo_nota check (tipo in ('aggiungi', 'modifica', 'spegni', 'riconferma')),
  constraint scheda_proposta_origine_nota check (origine in ('fornitore', 'contratto', 'riconferma', 'scadenza_contratto', 'fornitore_spento')),
  constraint scheda_proposta_stato_nota check (stato in ('in_attesa', 'accettata', 'rifiutata', 'scaduta')),
  constraint scheda_proposta_fonte_nota check (
    (fonte_prima is null or fonte_prima in ('documentato', 'confermato', 'riferito', 'da_verificare'))
    and (fonte_dopo is null or fonte_dopo in ('documentato', 'confermato', 'riferito', 'da_verificare'))
  ),
  constraint scheda_proposta_sezione_nota check (sezione in (
    'titolare', 'societa', 'locale', 'concept', 'fornitori', 'consulenti', 'decisioni', 'come_rispondere'
  )),
  constraint scheda_proposta_chiave_presente check (btrim(chiave) <> ''),
  constraint scheda_proposta_testo_dopo_coerente check (
    (testo_dopo is null or char_length(testo_dopo) <= 300)
    and (tipo not in ('aggiungi', 'modifica') or (testo_dopo is not null and btrim(testo_dopo) <> ''))
  ),
  constraint scheda_proposta_voce_richiesta check (tipo = 'aggiungi' or voce_id is not null),
  constraint scheda_proposta_decisione_coerente check (
    stato not in ('accettata', 'rifiutata') or (decisa_il is not null and decisa_da is not null)
  ),
  constraint scheda_proposta_scadenza_sensata check (scade_il > (creata_il at time zone 'Europe/Rome')::date)
);

comment on table scheda_proposte is
  'Le proposte di MEMO per aggiornare la Scheda (B1, 21/11/2026): suggerimenti a costo zero che il titolare accetta, rifiuta o corregge. Non si cancellano: restano come traccia di cosa è stato deciso e servono al blocco dei 90 giorni.';
comment on constraint scheda_proposta_tipo_nota on scheda_proposte is
  'Il tipo di proposta è «aggiungi», «modifica», «spegni» oppure «riconferma».';
comment on constraint scheda_proposta_origine_nota on scheda_proposte is
  'Da dove nasce la proposta: un fornitore nuovo, un contratto nuovo, una voce da riconfermare, un contratto scaduto o un fornitore spento.';
comment on constraint scheda_proposta_stato_nota on scheda_proposte is
  'Una proposta è «in attesa», «accettata», «rifiutata» oppure «scaduta».';
comment on constraint scheda_proposta_fonte_nota on scheda_proposte is
  'La fonte di una proposta è una di quelle della Scheda: documentato, confermato, riferito o da verificare.';
comment on constraint scheda_proposta_sezione_nota on scheda_proposte is
  'La sezione di una proposta deve essere una di quelle della Scheda: niente famiglia, salute, debiti o prestiti.';
comment on constraint scheda_proposta_chiave_presente on scheda_proposte is
  'Una proposta ha la chiave stabile della voce a cui si riferisce.';
comment on constraint scheda_proposta_testo_dopo_coerente on scheda_proposte is
  'Una proposta di aggiungere o modificare porta il testo della voce, al massimo 300 caratteri.';
comment on constraint scheda_proposta_voce_richiesta on scheda_proposte is
  'Una proposta di modificare, spegnere o riconfermare indica la voce a cui si riferisce.';
comment on constraint scheda_proposta_decisione_coerente on scheda_proposte is
  'Una proposta accettata o rifiutata dice quando e da chi è stata decisa.';
comment on constraint scheda_proposta_scadenza_sensata on scheda_proposte is
  'Una proposta scade dopo il giorno in cui nasce, non prima.';

create unique index if not exists scheda_proposta_una_in_attesa
  on scheda_proposte (chiave) where stato = 'in_attesa';
comment on constraint scheda_proposte_voce_id_fkey on scheda_proposte is
  'Una proposta su una voce esistente indica quale: una voce che ha proposte non si può cancellare (le voci della Scheda non si cancellano comunque, si spengono).';
comment on constraint scheda_proposte_voce_creata_id_fkey on scheda_proposte is
  'La voce nata da una proposta accettata: non si può cancellare, perché la traccia di chi l''ha accettata resta leggibile.';
comment on constraint scheda_proposte_documento_id_fkey on scheda_proposte is
  'Il documento da cui nasce una proposta (un contratto in Archivio): se il documento viene tolto, la proposta resta e perde solo il collegamento.';
comment on index scheda_proposta_una_in_attesa is
  'Per la stessa voce può esserci una sola proposta in attesa: MEMO non ti fa la stessa domanda due volte.';
create index if not exists idx_scheda_proposte_stato on scheda_proposte (stato, creata_il);

create or replace function scheda_proposte_non_cancellabili()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  raise exception 'Le proposte della Scheda non si cancellano: restano come traccia di cosa è stato deciso.';
end;
$funzione$;

drop trigger if exists scheda_proposte_bloccate on scheda_proposte;
create trigger scheda_proposte_bloccate before delete on scheda_proposte
  for each row execute function scheda_proposte_non_cancellabili();

-- ---------------------------------------------------------------------
-- 2. PICCOLI AIUTI (interni, chiusi a tutti)
-- ---------------------------------------------------------------------
-- Quanto è «forte» una fonte: una proposta non deve mai abbassarla in silenzio.
create or replace function scheda_fonte_rango(p_fonte text)
returns integer language sql immutable set search_path = public as $funzione$
  select case p_fonte when 'documentato' then 4 when 'confermato' then 3 when 'riferito' then 2 else 1 end
$funzione$;

create or replace function scheda_fonte_parole(p_fonte text)
returns text language sql immutable set search_path = public as $funzione$
  select case p_fonte when 'documentato' then 'documentato' when 'confermato' then 'confermato dal titolare'
    when 'riferito' then 'riferito' else 'da verificare' end
$funzione$;

-- Il nome minuscolo, senza accenti né segni: serve a riconoscere un fornitore già scritto a mano.
create or replace function scheda_normalizza(p_testo text)
returns text language sql immutable set search_path = public as $funzione$
  select btrim(regexp_replace(
    translate(lower(coalesce(p_testo, '')), 'àáâäãèéêëìíîïòóôöõùúûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[^a-z0-9]+', ' ', 'g'))
$funzione$;

-- Taglia a 300 caratteri senza spezzare una parola.
create or replace function scheda_taglia_300(p_testo text)
returns text language sql immutable set search_path = public as $funzione$
  select case when char_length(coalesce(p_testo, '')) <= 300 then coalesce(p_testo, '')
    else rtrim(coalesce(nullif(regexp_replace(left(p_testo, 299), '\s+\S*$', ''), ''), left(p_testo, 299))) || '…' end
$funzione$;

create or replace function scheda_data_it(p_data date)
returns text language sql immutable set search_path = public as $funzione$
  select to_char(p_data, 'DD/MM/YYYY')
$funzione$;

-- ---------------------------------------------------------------------
-- 3. IL CALCOLO (interno): le regole fisse
-- ---------------------------------------------------------------------
-- Non controlla chi lo chiama: lo chiama soltanto `scheda_proposte_genera()`,
-- che controlla il titolare, e un lavoro notturno futuro. Revocato a tutti.
create or replace function scheda_proposte_calcola()
returns jsonb language plpgsql security definer set search_path = public as $funzione$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  -- Prima di questa data nessun fornitore o contratto è «nuovo»: senza,
  -- il primo giorno arriverebbe tutto il vecchio in blocco.
  v_dal date := date '2026-11-21';
  v_finestra date;
  v_quota integer;
  v_nuove integer := 0;
  v_saltate integer := 0;
  v_scadute integer := 0;
  v_in_attesa integer;
  v_inserite integer;
  v_abbassa boolean;
  c record;
begin
  v_finestra := greatest(v_dal, v_oggi - 60);

  -- Due schede aperte insieme non calcolano insieme: il tetto di 5 al giorno non si sfonda per un soffio.
  perform pg_advisory_xact_lock(hashtext('scheda_proposte'));

  update scheda_proposte set stato = 'scaduta' where stato = 'in_attesa' and scade_il < v_oggi;
  get diagnostics v_scadute = row_count;

  -- Il tetto è sulle proposte NUOVE del giorno: quelle in attesa da giorni non contano.
  select greatest(0, 5 - count(*)) into v_quota
    from scheda_proposte where (creata_il at time zone 'Europe/Rome')::date = v_oggi;

  for c in
    select y.* from (
      select distinct on (x.chiave) x.* from (
        -- 1. Contratti nuovi in Archivio
        select 1 as prio, 'aggiungi'::text as tipo, 'contratto'::text as origine, d.id as origine_id,
               d.sez || ':doc-' || left(d.id::text, 8) as chiave, null::uuid as voce_id, d.sez as sezione,
               null::text as testo_prima,
               scheda_taglia_300(
                 'Contratto: ' || btrim(d.title)
                 || case when nullif(btrim(d.counterparties), '') is not null then ' con ' || btrim(d.counterparties) else '' end
                 || case when d.document_date is not null then ', del ' || scheda_data_it(d.document_date) else '' end
                 || case when d.expiry_date is not null then ', scade il ' || scheda_data_it(d.expiry_date) else '' end
                 || '.') as testo_dopo,
               null::text as fonte_prima, 'documentato'::text as fonte_dopo, d.id as documento_id,
               'Nuovo contratto in Archivio, caricato il ' || scheda_data_it((d.created_at at time zone 'Europe/Rome')::date) || '.' as motivo,
               d.created_at as data_ordine
          from (
            select d0.*, case when coalesce(d0.title, '') || ' ' || coalesce(d0.counterparties, '') ~* 'affitt|locazion'
                              then 'locale' else 'societa' end as sez
              from documents d0
             where d0.doc_type = 'contratti'
               and (d0.created_at at time zone 'Europe/Rome')::date >= v_finestra
               and (d0.expiry_date is null or d0.expiry_date >= v_oggi)
               and btrim(coalesce(d0.title, '')) <> ''
               and not exists (select 1 from scheda_voci v where v.documento_id = d0.id)
          ) d
        union all
        -- 2. Fornitori nuovi in anagrafica (mai i contatti, la partita IVA o le note)
        select 2, 'aggiungi', 'fornitore', s.id,
               'fornitori:forn-' || left(s.id::text, 8), null::uuid, 'fornitori',
               null::text,
               scheda_taglia_300(
                 btrim(s.name)
                 || case when s.category is not null then ' (' || replace(s.category::text, '_', ' ') || ')' else '' end
                 || '.'
                 || case when nullif(btrim(s.delivery_days), '') is not null then ' Consegne: ' || btrim(s.delivery_days) || '.' else '' end
                 || case when nullif(btrim(s.payment_terms), '') is not null then ' Pagamento: ' || btrim(s.payment_terms) || '.' else '' end),
               null::text, 'riferito', null::uuid,
               'Nuovo fornitore in anagrafica dal ' || scheda_data_it((s.created_at at time zone 'Europe/Rome')::date) || '.',
               s.created_at
          from suppliers s
         where s.active and not s.is_occasional
           and btrim(coalesce(s.name, '')) <> ''
           and (s.created_at at time zone 'Europe/Rome')::date >= v_finestra
           -- Già scritto a mano (anche in una voce spenta: una voce spenta è una scelta, non si insiste).
           and not exists (
             select 1 from scheda_voci v
              where v.sezione in ('fornitori', 'consulenti')
                and char_length(scheda_normalizza(s.name)) >= 3
                and scheda_normalizza(v.testo) like '%' || scheda_normalizza(s.name) || '%')
        union all
        -- 3. Voci da spegnere: contratto collegato scaduto
        select 3, 'spegni', 'scadenza_contratto', d.id,
               v.chiave, v.id, v.sezione, v.testo, null::text, v.fonte, null::text, null::uuid,
               'Il contratto collegato è scaduto il ' || scheda_data_it(d.expiry_date) || '.',
               d.expiry_date::timestamptz
          from scheda_voci v join documents d on d.id = v.documento_id
         where v.attiva and d.expiry_date is not null and d.expiry_date < v_oggi
        union all
        -- 3b. Voci da spegnere: fornitore spento
        select 3, 'spegni', 'fornitore_spento', s.id,
               v.chiave, v.id, v.sezione, v.testo, null::text, v.fonte, null::text, null::uuid,
               'Il fornitore è stato spento in anagrafica.',
               s.updated_at
          from scheda_voci v join suppliers s on left(s.id::text, 8) = substr(v.chiave, 16, 8)
         where v.attiva and v.chiave like 'fornitori:forn-%' and not s.active
        union all
        -- 4. Voci da riconfermare (le decisioni mai)
        select 4, 'riconferma', 'riconferma', null::uuid,
               v.chiave, v.id, v.sezione, v.testo, v.testo, v.fonte,
               case when v.fonte in ('riferito', 'da_verificare') then 'confermato' else v.fonte end,
               null::uuid,
               case when v.rivedere_entro is not null and v.rivedere_entro < v_oggi
                    then 'La data «da rivedere» di questa voce è passata (' || scheda_data_it(v.rivedere_entro) || '): è ancora vera?'
                    else 'Non la riconfermi dal ' || scheda_data_it(coalesce(v.verificata_il, v.valida_dal, (v.creata_il at time zone 'Europe/Rome')::date)) || ': è ancora vera?' end,
               coalesce(v.verificata_il, v.valida_dal, (v.creata_il at time zone 'Europe/Rome')::date)::timestamptz
          from scheda_voci v
         where v.attiva and v.sezione <> 'decisioni'
           and (
             (v.sezione in ('fornitori', 'consulenti')
               and coalesce(v.verificata_il, v.valida_dal, (v.creata_il at time zone 'Europe/Rome')::date) <= v_oggi - interval '12 months')
             or (v.sezione in ('locale', 'concept')
               and coalesce(v.verificata_il, v.valida_dal, (v.creata_il at time zone 'Europe/Rome')::date) <= v_oggi - interval '6 months')
             or (v.rivedere_entro is not null and v.rivedere_entro < v_oggi)
           )
      ) x
      order by x.chiave, x.prio
    ) y
    where
      -- Una sola in attesa per voce, e il silenzio dopo un rifiuto (90 giorni) o una scadenza (30).
      not exists (
        select 1 from scheda_proposte p
         where p.chiave = y.chiave
           and (p.stato = 'in_attesa'
                or (p.stato = 'rifiutata' and p.decisa_il > now() - interval '90 days')
                or (p.stato = 'scaduta' and p.scade_il > v_oggi - 30)))
      and (y.tipo <> 'aggiungi' or not exists (select 1 from scheda_voci v where v.chiave = y.chiave))
    order by y.prio, y.data_ordine
  loop
    exit when v_quota <= 0;
    -- Quello che il database rifiuterebbe non si propone nemmeno; le parole delicate nemmeno.
    if c.tipo = 'aggiungi'
       and (scheda_testo_personale(c.testo_dopo) or scheda_testo_personale(c.chiave)
            or coalesce(array_length(scheda_parole_delicate(c.testo_dopo), 1), 0) > 0) then
      v_saltate := v_saltate + 1;
      continue;
    end if;
    v_abbassa := c.fonte_prima is not null and c.fonte_dopo is not null
                 and scheda_fonte_rango(c.fonte_dopo) < scheda_fonte_rango(c.fonte_prima);
    insert into scheda_proposte (
      tipo, origine, origine_id, chiave, voce_id, sezione, testo_prima, testo_dopo,
      fonte_prima, fonte_dopo, documento_id, abbassa_fonte, motivo, scade_il
    ) values (
      c.tipo, c.origine, c.origine_id, c.chiave, c.voce_id, c.sezione, c.testo_prima, c.testo_dopo,
      c.fonte_prima, c.fonte_dopo, c.documento_id, v_abbassa, c.motivo, v_oggi + 30
    ) on conflict (chiave) where stato = 'in_attesa' do nothing;
    get diagnostics v_inserite = row_count;
    if v_inserite > 0 then
      v_nuove := v_nuove + 1;
      v_quota := v_quota - 1;
    end if;
  end loop;

  select count(*) into v_in_attesa from scheda_proposte where stato = 'in_attesa';
  return jsonb_build_object('nuove', v_nuove, 'scadute', v_scadute, 'saltate_privacy', v_saltate, 'in_attesa', v_in_attesa);
end;
$funzione$;

comment on function scheda_proposte_calcola() is
  'Calcola le proposte nuove con le regole fisse (nessun modello AI). Interna: non controlla chi la chiama, per questo è chiusa a tutti e la apre solo scheda_proposte_genera().';

-- La porta del titolare: la pagina la chiama all'apertura.
create or replace function scheda_proposte_genera()
returns jsonb language plpgsql security definer set search_path = public as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può chiedere le proposte per la Scheda.' using errcode = 'insufficient_privilege';
  end if;
  return scheda_proposte_calcola();
end;
$funzione$;

comment on function scheda_proposte_genera() is
  'Genera le proposte nuove per la Scheda (solo il titolare) e dice quante sono nate, scadute, saltate per privacy e ancora in attesa.';

-- ---------------------------------------------------------------------
-- 4. LA DECISIONE: Sì, Non farlo, Correggi
-- ---------------------------------------------------------------------
create or replace function scheda_proposta_decidi(
  p_id uuid, p_esito text, p_testo text default null, p_conferma_fonte boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $funzione$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  p scheda_proposte;
  v scheda_voci;
  v_testo text;
  v_voce_id uuid;
  v_numero integer;
  v_valida_dal date;
  v_ordine integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può decidere le proposte per la Scheda.' using errcode = 'insufficient_privilege';
  end if;
  if p_esito is null or p_esito not in ('si', 'no', 'correggi') then
    raise exception 'Scegli Sì, Non farlo o Correggi.';
  end if;
  -- Lo stesso lucchetto dei limiti della Scheda: due decisioni insieme non si scavalcano.
  perform pg_advisory_xact_lock(hashtext('scheda_voci'));
  select * into p from scheda_proposte where id = p_id for update;
  if not found then
    raise exception 'Questa proposta non esiste più.';
  end if;
  if p.stato <> 'in_attesa' then
    return jsonb_build_object('esito', 'gia_decisa', 'stato', p.stato);
  end if;
  if p.scade_il < v_oggi then
    update scheda_proposte set stato = 'scaduta' where id = p.id;
    return jsonb_build_object('esito', 'scaduta');
  end if;

  if p_esito = 'no' then
    update scheda_proposte set stato = 'rifiutata', decisa_il = now(), decisa_da = auth.uid() where id = p.id;
    return jsonb_build_object('esito', 'rifiutata');
  end if;

  if p_esito = 'correggi' then
    if p.tipo not in ('aggiungi', 'modifica') then
      raise exception 'Questa proposta si può solo accettare o rifiutare.';
    end if;
    v_testo := btrim(coalesce(p_testo, ''));
    if v_testo = '' or char_length(v_testo) > 300 then
      raise exception 'Il testo corretto deve avere da 1 a 300 caratteri.';
    end if;
  else
    v_testo := p.testo_dopo;
  end if;

  if p.abbassa_fonte and not coalesce(p_conferma_fonte, false) then
    raise exception 'Questa proposta abbassa la fonte da «%» a «%»: conferma di averlo letto.',
      scheda_fonte_parole(p.fonte_prima), scheda_fonte_parole(p.fonte_dopo);
  end if;

  if p.tipo = 'aggiungi' then
    -- Qualcuno ha già scritto a mano una voce attiva con questa chiave dopo la proposta: non si raddoppia.
    if exists (select 1 from scheda_voci where chiave = p.chiave and attiva) then
      update scheda_proposte set stato = 'scaduta' where id = p.id;
      return jsonb_build_object('esito', 'obsoleta');
    end if;
    select document_date into v_valida_dal from documents where id = p.documento_id;
    select coalesce(max(ordine), 0) + 10 into v_ordine from scheda_voci where sezione = p.sezione;
    insert into scheda_voci (sezione, chiave, testo, fonte, fonte_dettaglio, documento_id, valida_dal, ordine)
    values (
      p.sezione, p.chiave, v_testo, p.fonte_dopo,
      'Proposta di MEMO accettata il ' || scheda_data_it(v_oggi) || '.', p.documento_id, v_valida_dal, v_ordine
    ) returning id, numero into v_voce_id, v_numero;
  else
    select * into v from scheda_voci where id = p.voce_id for update;
    -- La voce è cambiata dopo la proposta: non si sovrascrive una correzione fatta a mano.
    -- Si risponde col valore (non con un errore, che annullerebbe anche la nuova scadenza).
    if not found or not v.attiva or v.testo is distinct from p.testo_prima or v.fonte is distinct from p.fonte_prima then
      update scheda_proposte set stato = 'scaduta' where id = p.id;
      return jsonb_build_object('esito', 'obsoleta');
    end if;
    v_voce_id := v.id;
    v_numero := v.numero;
    if p.tipo = 'modifica' then
      update scheda_voci set testo = v_testo, fonte = coalesce(p.fonte_dopo, fonte) where id = v.id;
    elsif p.tipo = 'spegni' then
      update scheda_voci set attiva = false where id = v.id;
    else
      update scheda_voci
         set verificata_il = v_oggi,
             fonte = coalesce(p.fonte_dopo, fonte),
             rivedere_entro = case when rivedere_entro is not null and rivedere_entro < v_oggi then null else rivedere_entro end
       where id = v.id;
    end if;
  end if;

  update scheda_proposte
     set stato = 'accettata', decisa_il = now(), decisa_da = auth.uid(),
         testo_accettato = case when p_esito = 'correggi' then v_testo end,
         voce_creata_id = case when p.tipo = 'aggiungi' then v_voce_id end
   where id = p.id;
  return jsonb_build_object('esito', 'accettata', 'voce_id', v_voce_id, 'numero', v_numero);
end;
$funzione$;

comment on function scheda_proposta_decidi(uuid, text, text, boolean) is
  'Il Sì, il Non farlo o il Correggi del titolare su una proposta. Scrive sulla Scheda come il titolare, con gli stessi controlli della pagina: se il database rifiuta (privacy, 60 voci, 10.000 caratteri), la proposta resta in attesa.';

-- ---------------------------------------------------------------------
-- 5. SOLO IL TITOLARE
-- ---------------------------------------------------------------------
alter table scheda_proposte enable row level security;
drop policy if exists scheda_proposte_titolare_legge on scheda_proposte;
create policy scheda_proposte_titolare_legge on scheda_proposte for select to authenticated
  using ((select is_titolare()));

revoke all on table scheda_proposte from public, anon;
revoke all on table scheda_proposte from authenticated;
grant select on table scheda_proposte to authenticated;

revoke all on function scheda_proposte_non_cancellabili(), scheda_fonte_rango(text), scheda_fonte_parole(text),
  scheda_normalizza(text), scheda_taglia_300(text), scheda_data_it(date), scheda_proposte_calcola()
  from public, anon, authenticated;
revoke all on function scheda_proposte_genera(), scheda_proposta_decidi(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function scheda_proposte_genera(), scheda_proposta_decidi(uuid, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 6. VERIFICA INTERNA, ANNULLATA: nessun dato di prova resta.
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_titolare uuid; v_staff uuid; v_ent uuid;
  v_seq_last bigint; v_seq_called boolean;
  v_forn uuid; v_forn2 uuid; v_forn3 uuid; v_forn4 uuid; v_doc uuid; v_doc2 uuid;
  v_voce_ric uuid; v_voce_dec uuid; v_voce_sca uuid; v_voce_obs uuid;
  v_prop uuid; v_prop2 uuid; v_r jsonb; v_n integer; v_testo text; v_att integer;
  v_rifiuto boolean;
  v_chiave_forn text; v_chiave_doc text; v_chiave_forn2 text;
begin
  select last_value, is_called into v_seq_last, v_seq_called from scheda_voci_numero_seq;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ent from entities limit 1;
  if v_titolare is null or v_staff is null or v_ent is null then
    raise exception 'VERIFICA: servono un titolare, uno staff e un''entità.';
  end if;

  -- (1) Permessi dichiarati.
  if has_table_privilege('anon', 'scheda_proposte', 'select')
     or not has_table_privilege('authenticated', 'scheda_proposte', 'select')
     or has_table_privilege('authenticated', 'scheda_proposte', 'insert')
     or has_table_privilege('authenticated', 'scheda_proposte', 'update')
     or has_table_privilege('authenticated', 'scheda_proposte', 'delete')
     or has_table_privilege('authenticated', 'scheda_proposte', 'truncate')
     or has_function_privilege('anon', 'scheda_proposte_genera()', 'execute')
     or has_function_privilege('anon', 'scheda_proposta_decidi(uuid, text, text, boolean)', 'execute')
     or not has_function_privilege('authenticated', 'scheda_proposte_genera()', 'execute')
     or not has_function_privilege('authenticated', 'scheda_proposta_decidi(uuid, text, text, boolean)', 'execute')
     or has_function_privilege('authenticated', 'scheda_proposte_calcola()', 'execute')
     or has_function_privilege('anon', 'scheda_proposte_calcola()', 'execute') then
    raise exception 'VERIFICA (1): i permessi delle proposte sono diversi da quelli dichiarati.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- Fornitore e contratto nuovi: dati personali e note NON devono finire nel testo.
    insert into suppliers (entity_id, name, tax_code, contact_phone, contact_email, notes, delivery_days, payment_terms)
    values (v_ent, 'Zz Ortofrutta Prova Proposte', '12345678901', '3331234567', 'zz@esempio.test', 'Nota riservata zz', 'Lun e Gio', '30 giorni')
    returning id into v_forn;
    insert into documents (entity_id, title, doc_type, document_date, counterparties, expiry_date, note)
    values (v_ent, 'Zz Contratto di affitto prova', 'contratti', v_oggi, 'Zz Locatore Inventato', v_oggi + 365, 'Nota riservata zz')
    returning id into v_doc;
    v_chiave_forn := 'fornitori:forn-' || left(v_forn::text, 8);
    v_chiave_doc := 'locale:doc-' || left(v_doc::text, 8);

    set local role authenticated;

    -- (2) Lo staff non vede, non genera, non decide.
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_rifiuto := false;
    begin perform scheda_proposte_genera();
    exception when insufficient_privilege then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (2a): lo staff genera proposte.'; end if;
    v_rifiuto := false;
    begin perform scheda_proposta_decidi(gen_random_uuid(), 'no');
    exception when insufficient_privilege then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (2b): lo staff decide proposte.'; end if;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- (3) Il titolare genera: nascono il contratto (documentato) e il fornitore (riferito).
    v_r := scheda_proposte_genera();
    if (v_r->>'nuove')::integer < 2 then raise exception 'VERIFICA (3a): attese almeno 2 proposte nuove, risposta %.', v_r; end if;
    select id, testo_dopo into v_prop, v_testo from scheda_proposte
      where chiave = v_chiave_forn and tipo = 'aggiungi' and fonte_dopo = 'riferito' and stato = 'in_attesa';
    if v_prop is null then raise exception 'VERIFICA (3b): il fornitore nuovo non ha generato la proposta.'; end if;
    if v_testo like '%12345678901%' or v_testo like '%3331234567%' or v_testo like '%zz@esempio%' or v_testo like '%riservata%' then
      raise exception 'VERIFICA (3c): il testo proposto contiene contatti, partita IVA o note: %.', v_testo;
    end if;
    if v_testo not like 'Zz Ortofrutta Prova Proposte.%Consegne: Lun e Gio.%Pagamento: 30 giorni.%' then
      raise exception 'VERIFICA (3d): il testo del fornitore non è quello atteso: %.', v_testo;
    end if;
    select id, testo_dopo into v_prop2, v_testo from scheda_proposte
      where chiave = v_chiave_doc and tipo = 'aggiungi' and fonte_dopo = 'documentato' and documento_id = v_doc and sezione = 'locale';
    if v_prop2 is null then raise exception 'VERIFICA (3e): il contratto nuovo non ha generato la proposta.'; end if;
    if v_testo like '%riservata%' then raise exception 'VERIFICA (3f): la nota del documento è finita nel testo.'; end if;

    -- (4) Una seconda chiamata subito dopo non crea doppioni.
    v_r := scheda_proposte_genera();
    select count(*) into v_n from scheda_proposte where chiave in (v_chiave_forn, v_chiave_doc);
    if v_n <> 2 then raise exception 'VERIFICA (4): doppioni dopo la seconda chiamata (%).', v_n; end if;

    -- (5) Correggi: 301 caratteri rifiutati, 300 accettati; la voce nasce col testo corretto, come il titolare.
    v_rifiuto := false;
    begin perform scheda_proposta_decidi(v_prop2, 'correggi', repeat('x', 301));
    exception when raise_exception then v_rifiuto := sqlerrm like '%da 1 a 300%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (5a): un testo corretto di 301 caratteri è passato.'; end if;
    select stato into v_testo from scheda_proposte where id = v_prop2;
    if v_testo <> 'in_attesa' then raise exception 'VERIFICA (5b): un Correggi rifiutato ha chiuso la proposta.'; end if;
    v_r := scheda_proposta_decidi(v_prop2, 'correggi', 'Zz Contratto di affitto corretto a mano.');
    if v_r->>'esito' <> 'accettata' then raise exception 'VERIFICA (5c): il Correggi non è stato accettato (%).', v_r; end if;
    if not exists (select 1 from scheda_voci where chiave = v_chiave_doc and testo = 'Zz Contratto di affitto corretto a mano.'
                    and fonte = 'documentato' and documento_id = v_doc and attiva) then
      raise exception 'VERIFICA (5d): la voce del contratto non ha il testo corretto, la fonte e il documento.';
    end if;
    if not exists (select 1 from scheda_proposte where id = v_prop2 and stato = 'accettata'
                    and testo_accettato = 'Zz Contratto di affitto corretto a mano.' and decisa_da = v_titolare and voce_creata_id is not null) then
      raise exception 'VERIFICA (5e): la proposta accettata non registra chi, quando e il testo accettato.';
    end if;
    if not exists (select 1 from scheda_storico s join scheda_voci v on v.id = s.voce_id
                    where v.chiave = v_chiave_doc and s.chi = v_titolare::text) then
      raise exception 'VERIFICA (5f): lo storico non registra il titolare come autore del Sì.';
    end if;

    -- (6) Il Sì: la voce del fornitore nasce con fonte «riferito».
    v_r := scheda_proposta_decidi(v_prop, 'si');
    if v_r->>'esito' <> 'accettata' or not exists (select 1 from scheda_voci where chiave = v_chiave_forn and fonte = 'riferito' and attiva) then
      raise exception 'VERIFICA (6): il Sì sul fornitore non ha scritto la voce (%).', v_r;
    end if;
    v_r := scheda_proposta_decidi(v_prop, 'si');
    if v_r->>'esito' <> 'gia_decisa' then raise exception 'VERIFICA (6b): decidere due volte non è stato fermato (%).', v_r; end if;

    -- (7) Rifiutata: non torna per 90 giorni (prova a 89 e a 91).
    reset role;
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    set local role authenticated;
    insert into suppliers (entity_id, name) values (v_ent, 'Zz Frutta Secca Prova Proposte') returning id into v_forn2;
    v_chiave_forn2 := 'fornitori:forn-' || left(v_forn2::text, 8);
    perform scheda_proposte_genera();
    select id into v_prop from scheda_proposte where chiave = v_chiave_forn2 and stato = 'in_attesa';
    if v_prop is null then raise exception 'VERIFICA (7a): il secondo fornitore non ha generato la proposta.'; end if;
    v_r := scheda_proposta_decidi(v_prop, 'no');
    if v_r->>'esito' <> 'rifiutata' or exists (select 1 from scheda_voci where chiave = v_chiave_forn2) then
      raise exception 'VERIFICA (7b): il Non farlo ha scritto sulla Scheda o non ha rifiutato (%).', v_r;
    end if;
    perform scheda_proposte_genera();
    if exists (select 1 from scheda_proposte where chiave = v_chiave_forn2 and stato = 'in_attesa') then
      raise exception 'VERIFICA (7c): una proposta rifiutata oggi è tornata subito.';
    end if;
    reset role;
    update scheda_proposte set decisa_il = now() - interval '89 days' where id = v_prop;
    set local role authenticated;
    perform scheda_proposte_genera();
    if exists (select 1 from scheda_proposte where chiave = v_chiave_forn2 and stato = 'in_attesa') then
      raise exception 'VERIFICA (7d): una proposta rifiutata 89 giorni fa è tornata.';
    end if;
    reset role;
    update scheda_proposte set decisa_il = now() - interval '91 days' where id = v_prop;
    set local role authenticated;
    perform scheda_proposte_genera();
    if not exists (select 1 from scheda_proposte where chiave = v_chiave_forn2 and stato = 'in_attesa') then
      raise exception 'VERIFICA (7e): una proposta rifiutata 91 giorni fa non è tornata.';
    end if;

    -- (8) Una voce spenta con lo stesso nome non genera proposta; un IBAN finto nel nome viene saltato.
    reset role;
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    insert into scheda_voci (sezione, chiave, testo, attiva)
    values ('fornitori', 'fornitori:zz-spento-a-mano', 'Zz Verdure Spente Prova: consegna inventata.', false);
    insert into suppliers (entity_id, name) values (v_ent, 'Zz Verdure Spente Prova') returning id into v_forn3;
    insert into suppliers (entity_id, name) values (v_ent, 'Zz Fornitore IT60X0542811101000000123456') returning id into v_forn4;
    set local role authenticated;
    v_r := scheda_proposte_genera();
    if exists (select 1 from scheda_proposte where chiave = 'fornitori:forn-' || left(v_forn3::text, 8)) then
      raise exception 'VERIFICA (8a): un fornitore già scritto a mano (voce spenta) ha generato la proposta.';
    end if;
    if exists (select 1 from scheda_proposte where chiave = 'fornitori:forn-' || left(v_forn4::text, 8)) then
      raise exception 'VERIFICA (8b): un nome con un IBAN finto ha generato la proposta.';
    end if;
    if (v_r->>'saltate_privacy')::integer < 1 then raise exception 'VERIFICA (8c): l''IBAN finto non è stato contato tra i saltati (%).', v_r; end if;

    -- (9) Riconferma: la fonte non scende mai; le decisioni mai; il Sì scrive la data.
    reset role;
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    insert into scheda_voci (sezione, chiave, testo, fonte, verificata_il)
    values ('locale', 'locale:zz-da-riconfermare', 'Zz voce vecchia del locale.', 'riferito', v_oggi - 400)
    returning id into v_voce_ric;
    insert into scheda_voci (sezione, chiave, testo, fonte, verificata_il)
    values ('decisioni', 'decisioni:zz-mai-riconfermata', 'Zz decisione vecchia.', 'confermato', v_oggi - 400);
    insert into scheda_voci (sezione, chiave, testo, fonte, verificata_il)
    values ('locale', 'locale:zz-da-spegnere-ric', 'Zz voce vecchia da correggere dopo.', 'confermato', v_oggi - 400)
    returning id into v_voce_obs;
    set local role authenticated;
    perform scheda_proposte_genera();
    select id into v_prop from scheda_proposte where chiave = 'locale:zz-da-riconfermare' and tipo = 'riconferma' and stato = 'in_attesa'
      and fonte_dopo = 'confermato' and not abbassa_fonte and testo_prima = testo_dopo and voce_id = v_voce_ric;
    if v_prop is null then raise exception 'VERIFICA (9a): la voce vecchia non ha generato la riconferma.'; end if;
    if exists (select 1 from scheda_proposte where chiave = 'decisioni:zz-mai-riconfermata') then
      raise exception 'VERIFICA (9b): una decisione è stata proposta per la riconferma.';
    end if;
    v_r := scheda_proposta_decidi(v_prop, 'si');
    if v_r->>'esito' <> 'accettata' or not exists (select 1 from scheda_voci where id = v_voce_ric and verificata_il = v_oggi and fonte = 'confermato' and attiva) then
      raise exception 'VERIFICA (9c): il Sì sulla riconferma non ha scritto la data (%).', v_r;
    end if;

    -- (10) Voce cambiata dopo la proposta: «obsoleta», la proposta scade, la correzione a mano resta.
    select id into v_prop from scheda_proposte where chiave = 'locale:zz-da-spegnere-ric' and tipo = 'riconferma' and stato = 'in_attesa';
    if v_prop is null then raise exception 'VERIFICA (10a): la seconda voce vecchia non ha generato la riconferma.'; end if;
    update scheda_voci set testo = 'Zz voce corretta a mano dopo la proposta.' where id = v_voce_obs;
    v_r := scheda_proposta_decidi(v_prop, 'si');
    if v_r->>'esito' <> 'obsoleta' then raise exception 'VERIFICA (10b): la proposta non è risultata obsoleta (%).', v_r; end if;
    if not exists (select 1 from scheda_proposte where id = v_prop and stato = 'scaduta')
       or not exists (select 1 from scheda_voci where id = v_voce_obs and testo = 'Zz voce corretta a mano dopo la proposta.' and verificata_il = v_oggi - 400) then
      raise exception 'VERIFICA (10c): una correzione a mano è stata sovrascritta o la proposta non è scaduta.';
    end if;

    -- (11) Spegni: contratto scaduto → la voce si spegne, non si cancella.
    reset role;
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    insert into documents (entity_id, title, doc_type, document_date, expiry_date)
    values (v_ent, 'Zz Contratto scaduto prova', 'contratti', v_oggi - 300, v_oggi - 1)
    returning id into v_doc2;
    insert into scheda_voci (sezione, chiave, testo, fonte, documento_id)
    values ('societa', 'societa:zz-contratto-scaduto', 'Zz contratto scaduto inventato.', 'documentato', v_doc2)
    returning id into v_voce_sca;
    set local role authenticated;
    perform scheda_proposte_genera();
    select id into v_prop from scheda_proposte where voce_id = v_voce_sca and tipo = 'spegni' and stato = 'in_attesa';
    if v_prop is null then raise exception 'VERIFICA (11a): il contratto scaduto non ha generato la proposta di spegnere.'; end if;
    v_r := scheda_proposta_decidi(v_prop, 'si');
    if v_r->>'esito' <> 'accettata' or not exists (select 1 from scheda_voci where id = v_voce_sca and not attiva) then
      raise exception 'VERIFICA (11b): il Sì su «spegni» non ha spento la voce (%).', v_r;
    end if;

    -- (12) La proposta che abbassa la fonte non passa senza conferma.
    reset role;
    insert into scheda_voci (sezione, chiave, testo, fonte) values ('locale', 'locale:zz-fonte-scende', 'Zz voce con fonte alta.', 'confermato');
    insert into scheda_proposte (tipo, origine, chiave, voce_id, sezione, testo_prima, testo_dopo, fonte_prima, fonte_dopo, abbassa_fonte, motivo, scade_il)
    select 'modifica', 'riconferma', 'locale:zz-fonte-scende', id, 'locale', testo, 'Zz voce con fonte abbassata.', 'confermato', 'riferito', true,
           'Prova: la fonte scende.', v_oggi + 30
      from scheda_voci where chiave = 'locale:zz-fonte-scende'
    returning id into v_prop;
    set local role authenticated;
    v_rifiuto := false;
    begin perform scheda_proposta_decidi(v_prop, 'si');
    exception when raise_exception then v_rifiuto := sqlerrm like '%abbassa la fonte%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (12a): una proposta che abbassa la fonte è passata senza conferma.'; end if;
    v_r := scheda_proposta_decidi(v_prop, 'si', null, true);
    if v_r->>'esito' <> 'accettata' then raise exception 'VERIFICA (12b): con la conferma la proposta non è passata (%).', v_r; end if;

    -- (13) Le proposte non si cancellano.
    v_rifiuto := false;
    reset role;
    begin delete from scheda_proposte where id = v_prop;
    exception when raise_exception then v_rifiuto := sqlerrm like '%non si cancellano%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (13): una proposta si lascia cancellare.'; end if;

    -- (14) Tetto di 5 al giorno: sette fornitori nuovi, ne nascono al più 5 in tutto oggi (prova annullata a parte).
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    begin
      insert into suppliers (entity_id, name) select v_ent, 'Zz Fornitore Tetto ' || n || ' Prova' from generate_series(1, 7) n;
      set local role authenticated;
      perform scheda_proposte_genera();
      reset role;
      select count(*) into v_n from scheda_proposte where (creata_il at time zone 'Europe/Rome')::date = v_oggi;
      if v_n <> 5 then raise exception 'VERIFICA (14): il tetto di 5 proposte al giorno non tiene (%).', v_n; end if;
      raise exception 'ZZ_TETTO_OK';
    exception when others then
      reset role;
      if sqlerrm <> 'ZZ_TETTO_OK' then raise; end if;
    end;

    -- (14b) Una voce scritta a mano con la stessa chiave dopo la proposta: «obsoleta», senza raddoppiare.
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    insert into suppliers (entity_id, name) values (v_ent, 'Zz Fornitore Gia Scritto Dopo') returning id into v_forn4;
    set local role authenticated;
    perform scheda_proposte_genera();
    select id into v_prop2 from scheda_proposte where chiave = 'fornitori:forn-' || left(v_forn4::text, 8) and stato = 'in_attesa';
    if v_prop2 is null then raise exception 'VERIFICA (14b-a): il fornitore per la prova della voce doppia non ha generato la proposta.'; end if;
    reset role;
    insert into scheda_voci (sezione, chiave, testo) values ('fornitori', 'fornitori:forn-' || left(v_forn4::text, 8), 'Zz scritto a mano dopo la proposta.');
    set local role authenticated;
    v_r := scheda_proposta_decidi(v_prop2, 'si');
    if v_r->>'esito' <> 'obsoleta'
       or (select count(*) from scheda_voci where chiave = 'fornitori:forn-' || left(v_forn4::text, 8)) <> 1
       or not exists (select 1 from scheda_proposte where id = v_prop2 and stato = 'scaduta') then
      raise exception 'VERIFICA (14b-b): una voce scritta a mano dopo la proposta è stata raddoppiata (%).', v_r;
    end if;

    -- (15) Con la Scheda piena il Sì è rifiutato dal database e la proposta resta in attesa.
    reset role;
    update scheda_proposte set creata_il = creata_il - interval '3 days' where creata_il > now() - interval '1 day';
    insert into suppliers (entity_id, name) values (v_ent, 'Zz Fornitore Scheda Piena') returning id into v_forn;
    set local role authenticated;
    perform scheda_proposte_genera();
    select id into v_prop from scheda_proposte where chiave = 'fornitori:forn-' || left(v_forn::text, 8) and stato = 'in_attesa';
    if v_prop is null then raise exception 'VERIFICA (15a): il fornitore per la prova dei limiti non ha generato la proposta.'; end if;
    reset role;
    select count(*) into v_att from scheda_voci where attiva;
    if v_att < 60 then
      insert into scheda_voci (sezione, chiave, testo, ordine)
      select 'decisioni', 'limite:zz-' || n, 'Voce breve inventata ' || n || '.', n from generate_series(1, 60 - v_att) n;
    end if;
    set local role authenticated;
    v_rifiuto := false;
    begin perform scheda_proposta_decidi(v_prop, 'si');
    exception when raise_exception then v_rifiuto := sqlerrm like '%60 voci attive%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (15b): con 60 voci attive il Sì è passato.'; end if;
    if not exists (select 1 from scheda_proposte where id = v_prop and stato = 'in_attesa') then
      raise exception 'VERIFICA (15c): un Sì rifiutato dal database ha cambiato la proposta.';
    end if;

    reset role;
    perform set_config('request.jwt.claims', null, true);
    set local role anon;
    v_rifiuto := false;
    begin perform count(*) from scheda_proposte;
    exception when insufficient_privilege then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (16): anon legge le proposte.'; end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform setval('scheda_voci_numero_seq', v_seq_last, v_seq_called);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle proposte della Scheda');
  raise notice 'Fatto: MEMO propone fornitori e contratti nuovi, riconferme e spegnimenti; nessuna scrittura sulla Scheda senza il Sì del titolare; tetto di 5 al giorno, 90 giorni dopo un rifiuto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261121000002', 'memo_propone_gli_aggiornamenti_della_scheda')
on conflict (version) do nothing;
