-- =====================================================================
-- L'ANTICIPO EREDITA SENZA CHIEDERE LA DIREZIONE (13/11/2026)
-- =====================================================================
--
-- 🔴 IL DIFETTO, trovato da Alessio la notte del 13/11 (00:49): un anticipo
--    di 235 € collegato alla fattura 1992/2026 di Fabio Lorito, da «Ho
--    pagato io» in /cassa/personale, veniva rifiutato con
--        record "new" has no field "direction"
--    con la spunta «investimento» e senza. Da allora (07/11) NESSUN
--    anticipo collegato a una fattura passava.
--
-- LA CAUSA, in 20261107000003_le_fatture_dell_investimento.sql:241, dentro
-- `piano_pagamento_eredita_spunta()` — il trigger «before insert» che fa
-- passare la spunta dalla fattura al pagamento, condiviso da
-- `cash_movements` e `anticipazioni_socio`:
--
--     if tg_table_name = 'cash_movements' and new.direction is distinct from 'uscita' then
--
-- ⚠️ L'`and` NON PROTEGGE: PL/pgSQL prepara l'espressione intera prima di
--    valutarla, e per prepararla deve conoscere il tipo di `new.direction`.
--    Su `anticipazioni_socio` quella colonna non esiste (lì c'è `importo`,
--    non `amount`/`direction`), e l'errore scatta prima che il primo pezzo
--    dica «non è cash_movements».
-- ⚠️ E LA SPUNTA NON SALVAVA: il primo `if` esce subito solo se la riga
--    nasce già segnata, ma `createAnticipazione` (src/lib/api/anticipazioni.js)
--    scrive SEMPRE la nota senza spunta e la segna dopo con
--    `segna_investimento` (parte 6 del piano, 07/11). Quindi la riga
--    arrivava al trigger senza spunta anche quando Alessio l'aveva messa.
--
-- LA CORREZIONE: la domanda sulla direzione si fa DENTRO un `if` che
-- gira solo per `cash_movements` — la stessa forma che
-- `piano_pagamento_eredita_collegamenti()` usa già per `new.amount` /
-- `new.importo`, e che funziona perché PL/pgSQL prepara un'istruzione solo
-- quando la esegue. Corpo ripreso da 20261107000003 (l'ultima che definisce
-- questa funzione), con quel solo cambio: nessuna regola persa.
--
-- PERCORSO CONTROLLATO, tutti i trigger di `anticipazioni_socio` all'insert:
--   · piano_pagamento_eredita_spunta (before)       → QUESTO, corretto;
--   · trg_guardia_anticipo_su_fattura (before)       → solo supplier_invoice_id;
--   · trg_guardia_investimento_anticipazione (before)→ solo campi propri;
--   · piano_pagamento_eredita_collegamenti (after)   → rami separati, sano;
--   · piano_voce_obbligatoria_nuova (after, differito) → rami separati, sano;
--   · trg_log_delete / scenari congelati            → generici, senza campi.
--   Nessun'altra funzione legge `new.direction` fuori da un trigger di
--   `cash_movements` (la sola altra, la tasca, è attaccata solo lì).
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

create or replace function piano_pagamento_eredita_spunta()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.supplier_invoice_id is null or coalesce(new.e_investimento, false) then
    return new;
  end if;
  -- ⚠️ DUE `if` E NON UN `and` (13/11/2026): `new.direction` esiste solo
  --    in cash_movements, e PL/pgSQL prepara l'espressione intera prima di
  --    valutarla. Con l'`and` ogni anticipo su fattura moriva qui.
  if tg_table_name = 'cash_movements' then
    if new.direction is distinct from 'uscita' then
      return new;
    end if;
  end if;
  -- Una nota della tasca non si segna (guardia_investimento_anticipazione).
  if tg_table_name = 'anticipazioni_socio' then
    if e_una_tasca(new.entity_id) then
      return new;
    end if;
  end if;
  if exists (
    select 1 from supplier_invoices i
     where i.id = new.supplier_invoice_id and i.e_investimento
       and exists (select 1 from piano_collegamenti c where c.supplier_invoice_id = i.id)
  ) then
    new.e_investimento := true;
  end if;
  return new;
end;
$fn$;

comment on function piano_pagamento_eredita_spunta() is
  'Il pagamento (uscita di prima nota o anticipo del titolare) di una fattura segnata e collegata al piano eredita la spunta «investimento» (07/11/2026). Dal 13/11/2026 la direzione si chiede solo ai movimenti di cassa: sugli anticipi quella colonna non esiste, e l''espressione unica rifiutava ogni anticipo su fattura.';

revoke all on function piano_pagamento_eredita_spunta() from public, anon, authenticated;

-- I trigger restano quelli di 20261107000003: si ricreano uguali, così la
-- migrazione vale anche su un database dove fossero spariti.
drop trigger if exists piano_pagamento_eredita_spunta on cash_movements;
create trigger piano_pagamento_eredita_spunta
  before insert on cash_movements
  for each row execute function piano_pagamento_eredita_spunta();
drop trigger if exists piano_pagamento_eredita_spunta on anticipazioni_socio;
create trigger piano_pagamento_eredita_spunta
  before insert on anticipazioni_socio
  for each row execute function piano_pagamento_eredita_spunta();

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
-- Riproduce i casi di Alessio con `registra_anticipazione`, la stessa
-- funzione che chiama «Ho pagato io»:
--   (1) fattura SENZA spunta, anticipo senza spunta     → accettato;
--   (2) fattura segnata con la voce «affitto»           → l'anticipo eredita
--       spunta e voce;
--   (3) fattura senza spunta, anticipo segnato dopo con la voce «affitto»
--       (il percorso di createAnticipazione)            → accettato e segnato;
--   (4) il ramo della cassa non è cambiato: un'uscita che paga una fattura
--       segnata eredita ancora.
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_srls     uuid;
  v_tag      uuid;
  v_forn     uuid;
  v_affitto  uuid;
  v_fat1     uuid;
  v_fat2     uuid;
  v_fat3     uuid;
  v_fat4     uuid;
  v_ant      uuid;
  v_mov      uuid;
  v_n        integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    insert into tag_anticipazioni (etichetta) values ('ZZ verifica anticipo su fattura') returning id into v_tag;
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore anticipo') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-A1', current_date, 235.00) returning id into v_fat1;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-A2', current_date, 235.00) returning id into v_fat2;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-A3', current_date, 235.00) returning id into v_fat3;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-A4', current_date, 120.00) returning id into v_fat4;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato)
    values ('C', 996, 'ZZ affitto della verifica', 5000) returning id into v_affitto;

    -- (1) Fattura senza spunta, anticipo senza spunta: prima moriva su
    --     «record new has no field direction».
    v_ant := registra_anticipazione(v_srls, 235.00, current_date, v_tag, 'contanti', v_fat1, null, false, null);
    set constraints all immediate;
    set constraints all deferred;
    if v_ant is null
       or (select e_investimento from anticipazioni_socio where id = v_ant)
       or not exists (select 1 from supplier_invoices where id = v_fat1 and status = 'pagata' and payment_method = 'anticipo')
       or exists (select 1 from cash_movements where supplier_invoice_id = v_fat1) then
      raise exception 'VERIFICA (1): l''anticipo su una fattura senza spunta non ha pagato la fattura «pagata (anticipo)», oppure ha mosso la cassa o preso una spunta.';
    end if;

    -- (2) Fattura segnata con la voce: l'anticipo eredita spunta e voce.
    perform segna_investimento('fattura', v_fat2, v_affitto);
    v_ant := registra_anticipazione(v_srls, 235.00, current_date, v_tag, 'conto_personale', v_fat2, null, false, null);
    set constraints all immediate;
    set constraints all deferred;
    if not (select e_investimento from anticipazioni_socio where id = v_ant)
       or not exists (select 1 from piano_collegamenti
                       where anticipazione_id = v_ant and voce_id = v_affitto and importo_attribuito = 235)
       or not exists (select 1 from supplier_invoices where id = v_fat2 and status = 'pagata' and payment_method = 'anticipo') then
      raise exception 'VERIFICA (2): l''anticipo della fattura segnata non ha ereditato spunta e voce, o la fattura non è «pagata (anticipo)».';
    end if;

    -- (3) Il percorso di «Ho pagato io» con la spunta: la nota nasce senza,
    --     poi segna_investimento mette spunta e voce.
    v_ant := registra_anticipazione(v_srls, 235.00, current_date, v_tag, 'contanti', v_fat3, null, false, null);
    perform segna_investimento('anticipazione', v_ant, v_affitto);
    set constraints all immediate;
    set constraints all deferred;
    if not (select e_investimento from anticipazioni_socio where id = v_ant)
       or not exists (select 1 from piano_collegamenti where anticipazione_id = v_ant and voce_id = v_affitto)
       or not exists (select 1 from supplier_invoices where id = v_fat3 and status = 'pagata' and payment_method = 'anticipo') then
      raise exception 'VERIFICA (3): l''anticipo segnato dopo non ha la spunta e la voce, o la fattura non è «pagata (anticipo)».';
    end if;

    -- (4) Il ramo della cassa: un'uscita che paga una fattura segnata eredita ancora.
    perform segna_investimento('fattura', v_fat4, v_affitto);
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 120.00, current_date, 'cassa', 'ZZ verifica anticipo - uscita', v_fat4)
    returning id into v_mov;
    set constraints all immediate;
    set constraints all deferred;
    if not (select e_investimento from cash_movements where id = v_mov)
       or not exists (select 1 from piano_collegamenti where cash_movement_id = v_mov and voce_id = v_affitto) then
      raise exception 'VERIFICA (4): l''uscita che paga una fattura segnata non eredita più la spunta.';
    end if;

    -- (5) La forma sbagliata non è tornata.
    select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'piano_pagamento_eredita_spunta'
       and p.prosrc ~* 'cash_movements''\s+and\s+new\.direction';
    if v_n <> 0 then
      raise exception 'VERIFICA (5): piano_pagamento_eredita_spunta chiede ancora la direzione dentro un «and».';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di «l''anticipo eredita senza direzione»');

  raise notice 'Fatto: un anticipo collegato a una fattura passa, con e senza spunta; da una fattura segnata eredita spunta e voce; la cassa eredita come prima. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000001', 'l_anticipo_eredita_senza_direzione')
on conflict (version) do nothing;
