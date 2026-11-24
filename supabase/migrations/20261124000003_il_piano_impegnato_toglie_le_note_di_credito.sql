-- 24/11/2026 — Revisione dell'11/11, punto 18: nel piano dell'investimento l'«impegnato» non toglie le note di credito.
--
-- Cosa succedeva: una fattura da 1.000 € collegata a una voce del piano, con 200 € di nota di credito già scalata, si paga
-- 800 €. Ma finché non si pagava, il piano mostrava 1.000 € «impegnati»: la voce sembrava costare 200 € più del vero.
-- Cura: per le fatture ancora da pagare l'importo impegnato (la quota attribuita alla voce) si riduce nella stessa
-- proporzione di quanto la fattura costa davvero: quota × da_pagare / importo della fattura (`da_pagare` è la funzione che
-- toglie le note scalate, l'unico posto dove quella sottrazione esiste). Senza note di credito il rapporto è 1 e non cambia
-- niente; con una fattura pagata per intero il calcolo non c'entra (conta il pagamento, nello «speso»).
-- La STESSA regola vale per le rate «aperte» del piano (`piano_rate_aperte`, la previsione di cassa): il suo calcolo delle
-- coperture dichiara di essere «la stessa regola dell'impegnato», e deve restarlo (se no la rata risulterebbe coperta per
-- 1.000 mentre la voce mostra 800 impegnati). Il risultato si arrotonda al centesimo.
-- Si cambia il corpo VIVO delle due funzioni in un punto solo ciascuna (controllato: la riga deve comparire una volta sola).

do $impegnato$
declare
  v_vecchio constant text := 'greatest(c.importo_attribuito - coalesce((';
  v_nuovo   constant text := 'greatest(round(c.importo_attribuito * (da_pagare(i) / nullif(i.amount, 0)), 2) - coalesce((';
  v_funzione text;
  v_def     text;
  v_n       integer;
begin
  perform set_config('request.jwt.claims', null, true);
  foreach v_funzione in array array['public.piano_speso_per_voce()', 'public.piano_rate_aperte()'] loop
    v_def := replace(pg_get_functiondef(v_funzione::regprocedure), E'\r', '');
    if v_def like '%' || v_nuovo || '%' then continue; end if;
    v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
    if v_n <> 1 then
      raise exception '% non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_funzione, v_vecchio, v_n;
    end if;
    execute replace(v_def, v_vecchio, v_nuovo);
  end loop;
end $impegnato$;

-- ---------------------------------------------------------------------
-- VERIFICA (blocco annullato, zero residui)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid;
  v_ent uuid;
  v_forn uuid;
  v_fat uuid;
  v_nota uuid;
  v_voce uuid;
  v_imp numeric;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  if v_tit is null or v_ent is null then raise exception 'VERIFICA: mancano titolare o società.'; end if;

  begin
    insert into suppliers (entity_id, name) values (v_ent, 'ZZ Fornitore di prova piano') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, due_date, amount, e_investimento)
      values (v_ent, v_forn, 'ZZ-PIANO-1', date '2026-10-01', date '2026-10-31', 1000, true) returning id into v_fat;
    insert into piano_voci (gruppo, descrizione, importo_ivato) values ('A', 'ZZ voce di prova del piano', 1000) returning id into v_voce;
    insert into piano_collegamenti (voce_id, supplier_invoice_id, importo_attribuito) values (v_voce, v_fat, 1000);

    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- (1) senza note di credito l'impegnato è tutta la quota: 1.000.
    select impegnato into v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_imp is distinct from 1000::numeric then raise exception 'VERIFICA (1): senza note di credito l''impegnato doveva essere 1000 (% )', v_imp; end if;

    -- (2) con 200 € di nota di credito scalata l'impegnato scende a 800.
    insert into note_credito (entity_id, supplier_id, fattura_id, numero, data, importo)
      values (v_ent, v_forn, v_fat, 'ZZ-NC-1', date '2026-10-15', 200) returning id into v_nota;
    insert into note_credito_utilizzi (nota_id, fattura_id, importo) values (v_nota, v_fat, 200);
    select impegnato into v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_imp is distinct from 800::numeric then raise exception 'VERIFICA (2): con 200 di nota di credito l''impegnato doveva essere 800 (%).', v_imp; end if;

    -- (3) una quota parziale scende nella stessa proporzione: 500 su 1.000 con 200 di nota → 400.
    update piano_collegamenti set importo_attribuito = 500 where voce_id = v_voce;
    select impegnato into v_imp from piano_speso_per_voce() where voce_id = v_voce;
    if v_imp is distinct from 400::numeric then raise exception 'VERIFICA (3): una quota di 500 con 200 di nota doveva dare 400 (%).', v_imp; end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  if exists (select 1 from piano_voci where descrizione = 'ZZ voce di prova del piano')
     or exists (select 1 from supplier_invoices where invoice_number = 'ZZ-PIANO-1')
     or exists (select 1 from note_credito where numero = 'ZZ-NC-1') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  if pg_get_functiondef('public.piano_speso_per_voce()'::regprocedure) not like '%da_pagare(i)%'
     or pg_get_functiondef('public.piano_rate_aperte()'::regprocedure) not like '%da_pagare(i)%' then
    raise exception 'VERIFICA (5): il corpo vivo del piano o delle rate non usa da_pagare.';
  end if;

  raise notice 'Fatto: nel piano dell''investimento l''impegnato di una fattura da pagare toglie le note di credito già scalate (1.000 con 200 di nota → 800; quota parziale in proporzione). Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261124000003', 'il_piano_impegnato_toglie_le_note_di_credito')
on conflict (version) do nothing;
