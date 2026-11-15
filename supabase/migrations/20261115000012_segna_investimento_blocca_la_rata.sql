-- =====================================================================
-- COLLEGARE UNA SPESA A UNA RATA BLOCCA LA RATA — 15/11/2026
-- =====================================================================
--
-- La revisione della 20261114000010 (le rate si propongono) ha trovato che
-- `segna_investimento` non bloccava né la voce né la rata: un collegamento
-- fatto nello stesso istante in cui MEMO ricalcola le rate poteva finire su
-- una rata appena riscritta, proprio il caso che la regola «una rata anche
-- solo in parte coperta resta intatta» voleva evitare.
--
-- Ora, quando il collegamento è a una rata, si bloccano nell'ordine della
-- proposta di MEMO (`fai_piano_memo`: prima la voce, poi le sue rate), così
-- le due strade si mettono in fila e non si incrociano (niente stallo).
--
-- Il corpo si riprende da quello VIVO (uguale su Prova e su work) e cambia
-- una sola ancora, controllata: deve comparire una volta sola.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

do $blocca$
declare
  v_def text := replace(pg_get_functiondef('public.segna_investimento(text,uuid,uuid,uuid)'::regprocedure), E'\r', '');
  v_ancora text := E'  insert into piano_collegamenti (voce_id, rata_id, cash_movement_id, anticipazione_id, supplier_invoice_id, importo_attribuito)';
begin
  if v_def like '%from piano_rate where id = p_rata_id for update%' then return; end if;
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'segna_investimento non ha l''inserimento atteso: confronta il corpo vivo prima di applicare.';
  end if;
  execute replace(v_def, v_ancora,
    E'  -- Collegare a una rata: si mette in fila con chi la ricalcola (voce, poi rata).\n'
    || E'  if p_rata_id is not null then\n'
    || E'    perform 1 from piano_voci where id = p_voce_id for update;\n'
    || E'    perform 1 from piano_rate where id = p_rata_id for update;\n'
    || E'  end if;\n' || v_ancora);
end $blocca$;

do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid; v_srls uuid; v_voce uuid; v_rata uuid; v_forn uuid; v_fat uuid; v_n integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then raise exception 'VERIFICA: servono un titolare e Borgo 58.'; end if;
  if pg_get_functiondef('public.segna_investimento(text,uuid,uuid,uuid)'::regprocedure)
       not like '%from piano_rate where id = p_rata_id for update%' then
    raise exception 'VERIFICA: la rata non viene bloccata.';
  end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    values ('D', 993, 'ZZ voce blocco rata', 600, 22, 'stimato') returning id into v_voce;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_voce, 0, 300), (v_voce, 1, 300);
    select id into v_rata from piano_rate where voce_id = v_voce and mese_rel = 0;
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore blocco rata') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount)
    values (v_srls, v_forn, 'ZZ-BLOCCO-RATA', current_date, current_date, 300) returning id into v_fat;
    perform segna_investimento('fattura', v_fat, v_voce, v_rata);
    select count(*) into v_n from piano_collegamenti where voce_id = v_voce and rata_id = v_rata and supplier_invoice_id = v_fat;
    if v_n <> 1 then raise exception 'VERIFICA: il collegamento a una rata non è stato scritto (%).', v_n; end if;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del blocco della rata');
  raise notice 'Fatto: collegare una spesa a una rata blocca voce e rata, nell''ordine di MEMO. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000012', 'segna_investimento_blocca_la_rata') on conflict (version) do nothing;
