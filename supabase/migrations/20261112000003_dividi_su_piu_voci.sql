-- =====================================================================
-- DIVIDI UNA SPESA SU PIÙ VOCI DEL PIANO
-- 12/11/2026 — modello approvato da Alessio l'11/11
-- (modello-piano-sottovoci.html, il modulo «Dividi su più voci»)
-- =====================================================================
--
-- Una spesa (una riga di prima nota, un anticipo o una fattura) va su più
-- voci o sottovoci del piano, ognuna con la sua cifra. Esempio: la fattura
-- San Cataldo di 7.200 € = 4.500 sul Forno + 2.700 su Sedie e tavoli.
--
-- 🔴 UN GESTO SOLO: dividi_spesa() mette la spunta «investimento» sulla
--    spesa e SOSTITUISCE tutti i suoi collegamenti con le parti scelte, in
--    una transazione. A metà resterebbe una spesa divisa per metà, che
--    sembra giusta e non lo è.
-- 🔴 SI DIVIDE TUTTA, AL CENTESIMO: la somma delle parti deve essere
--    l'importo della spesa. «Restano 300 €» o «300 € in più» si rifiutano
--    con la cifra. Una parte sola va bene: è «Metti su una voce» per tutto.
--
-- 🔴 ACCONTO E SALDO DI UNA FATTURA DIVISA SI DIVIDONO A MANO (scelta di
--    Alessio dell'11/11), non in proporzione da soli. Quando si paga una
--    fattura che sta su più voci, il pagamento eredita i collegamenti come
--    prima (in ordine, mai oltre il pagamento: così lo speso non sparisce),
--    ma li segna `da_dividere`: la pagina lo dice («Pagamento di una
--    fattura divisa: dividilo tu») finché Alessio non lo divide.
--    dividi_spesa() riscrive i collegamenti senza il segno.
--
-- ⚠️ PASSA DAL CORRIDOIO (Contratto B4): scrive la spunta sulla spesa E i
--    collegamenti, cioè due tabelle. Come segna_investimento() è security
--    invoker: valgono le regole di chi chiama (i collegamenti sono del solo
--    titolare, RLS della parte 1). Il controllo is_titolare() all'inizio
--    serve solo a dire il rifiuto con una frase, invece di un errore della
--    RLS a metà strada.
-- ⚠️ I CONTROLLI CHE C'ERANO RESTANO DOVE SONO: spesa segnata e non
--    dell'orto, rata della stessa voce, niente oltre l'importo
--    (piano_collegamento_controlla), niente spese sulla madre
--    (piano_niente_sulla_madre). Qui si aggiungono solo quelli della
--    divisione: somma giusta, voci diverse, cifre sopra zero, voci vive.
-- ⚠️ IL CASO STORTO SI CONTA PER ECCESSO, come già deciso nella parte 5
--    (20261107000002): se un pagamento di una fattura si divide su una
--    voce che la fattura non ha (o la fattura si ridivide su altre voci
--    dopo un acconto), l'impegnato della fattura non scende su quella
--    voce, e speso più impegnato contano di più. Meglio un «a rischio» in
--    più che uno sforamento nascosto. Non si rifiuta: bloccherebbe proprio
--    lo spostamento di una fattura e dei suoi pagamenti da una voce
--    all'altra (revisione ecc:database-reviewer del 12/11, seguito
--    annotato nella scheda di consegna).
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. IL SEGNO «DA DIVIDERE»
-- ---------------------------------------------------------------------
alter table piano_collegamenti add column if not exists da_dividere boolean not null default false;

comment on column piano_collegamenti.da_dividere is
  'Collegamento ereditato dal pagamento di una fattura divisa su più voci (12/11/2026): la cifra è messa in ordine, non scelta. Alessio lo divide a mano con «Dividi su più voci», e allora il segno sparisce.';

-- ---------------------------------------------------------------------
-- 2. IL PAGAMENTO DI UNA FATTURA DIVISA SI SEGNA «DA DIVIDERE»
-- ---------------------------------------------------------------------
-- Come in 20261107000003 (parte 6), con una cosa in più: se la fattura sta
-- su PIÙ DI UNA voce, la copia in ordine non è una scelta di Alessio, e si
-- dice. Con una voce sola non c'è niente da scegliere: resta com'era.
create or replace function piano_pagamento_eredita_collegamenti()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_resto   numeric;
  v_parte   numeric;
  v_divisa  boolean;
  r         record;
begin
  if new.supplier_invoice_id is null or not coalesce(new.e_investimento, false) then
    return null;
  end if;
  if tg_table_name = 'cash_movements' then
    if exists (select 1 from piano_collegamenti where cash_movement_id = new.id) then return null; end if;
    v_resto := new.amount;
  else
    if exists (select 1 from piano_collegamenti where anticipazione_id = new.id) then return null; end if;
    v_resto := new.importo;
  end if;

  -- ⚠️ La fattura si blocca prima di leggerne i collegamenti (revisione
  --    ecc:database-reviewer del 12/11): un dividi_spesa sulla fattura in
  --    corso finisce prima, e il pagamento eredita la divisione nuova, non
  --    quella vecchia.
  perform 1 from supplier_invoices where id = new.supplier_invoice_id for no key update;

  -- ⚠️ Si guarda la FATTURA, non quanto eredita questo pagamento: anche un
  --    acconto piccolo che cade su una voce sola è un pagamento di una
  --    fattura divisa, e Alessio ha scelto di dividerli tutti a mano.
  select count(*) > 1 into v_divisa
    from piano_collegamenti c
    join supplier_invoices i on i.id = c.supplier_invoice_id
   where c.supplier_invoice_id = new.supplier_invoice_id and i.e_investimento;

  for r in
    select c.voce_id, c.rata_id, c.importo_attribuito
      from piano_collegamenti c
      join supplier_invoices i on i.id = c.supplier_invoice_id
     where c.supplier_invoice_id = new.supplier_invoice_id and i.e_investimento
     -- ⚠️ Un ordine che non dipende dal caso (revisione del 07/11): prima
     --    il più vecchio, poi il più grande, poi l'id.
     order by c.created_at, c.importo_attribuito desc, c.id
  loop
    exit when v_resto <= 0;
    v_parte := least(r.importo_attribuito, v_resto);
    if tg_table_name = 'cash_movements' then
      insert into piano_collegamenti (voce_id, rata_id, cash_movement_id, importo_attribuito, da_dividere)
      values (r.voce_id, r.rata_id, new.id, v_parte, v_divisa);
    else
      insert into piano_collegamenti (voce_id, rata_id, anticipazione_id, importo_attribuito, da_dividere)
      values (r.voce_id, r.rata_id, new.id, v_parte, v_divisa);
    end if;
    v_resto := v_resto - v_parte;
  end loop;
  return null;
end;
$fn$;

comment on function piano_pagamento_eredita_collegamenti() is
  'Il pagamento di una fattura segnata eredita i suoi collegamenti, in ordine e mai oltre il pagamento (07/11/2026). Se la fattura è divisa su più voci, i collegamenti ereditati sono «da dividere» a mano (12/11/2026).';

revoke all on function piano_pagamento_eredita_collegamenti() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. DIVIDERE, IN UN GESTO SOLO
-- ---------------------------------------------------------------------
-- p_fonte: 'prima_nota' | 'anticipazione' | 'fattura'
-- p_parti: [{"voce_id": "…", "rata_id": "…" | null, "importo": 4500.00}, …]
create or replace function dividi_spesa(p_fonte text, p_id uuid, p_parti jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_importo  numeric;
  v_somma    numeric;
  v_n        integer;
  v_voci     integer;
  v_nome     text;
  v_cosa     text;
  v_segnata  boolean;
  v_uscita   boolean;
begin
  if not is_titolare() then
    raise exception 'Il piano dell''investimento è riservato al titolare.';
  end if;
  if p_fonte not in ('prima_nota', 'anticipazione', 'fattura') or p_fonte is null then
    raise exception 'Non so dividere «%»: le spese sono di prima nota, anticipi o fatture.', p_fonte;
  end if;
  v_cosa := case when p_fonte = 'fattura' then 'della fattura' else 'della spesa' end;
  if p_parti is null or jsonb_typeof(p_parti) <> 'array' or jsonb_array_length(p_parti) = 0 then
    raise exception 'Scegli almeno una voce, con la sua cifra.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_parti) e
     where jsonb_typeof(e) <> 'object'
        or nullif(e->>'voce_id', '') is null
        or jsonb_typeof(e->'importo') is distinct from 'number'
  ) then
    raise exception 'Ogni riga della divisione vuole la sua voce e la sua cifra.';
  end if;
  -- Un identificativo storpiato si dice in italiano, non con l'errore
  -- tecnico della conversione (revisione del 12/11).
  if exists (
    select 1 from jsonb_array_elements(p_parti) e
     where (e->>'voce_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or (nullif(e->>'rata_id', '') is not null
            and (e->>'rata_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise exception 'Una delle voci (o delle rate) scelte non si riconosce: rileggi la pagina e scegli di nuovo.';
  end if;

  -- ⚠️ Le parti si leggono da p_parti ogni volta (jsonb_to_recordset), non
  --    da una tabella temporanea: chi chiama è «authenticated», e non deve
  --    aver bisogno di crearne.
  if exists (select 1 from jsonb_to_recordset(p_parti) as p(importo numeric) where p.importo <= 0) then
    raise exception 'Ogni parte deve essere più di zero: togli la riga vuota, oppure scrivi la sua cifra.';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_parti) as p(importo numeric) where p.importo <> round(p.importo, 2)) then
    raise exception 'Le cifre si scrivono al centesimo (per esempio 1.500,50).';
  end if;
  select count(*), count(distinct p.voce_id), sum(p.importo) into v_n, v_voci, v_somma
    from jsonb_to_recordset(p_parti) as p(voce_id uuid, importo numeric);
  if v_voci <> v_n then
    raise exception 'Hai scelto la stessa voce due volte: metti le due cifre in una riga sola.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_parti) as p(voce_id uuid)
     where not exists (select 1 from piano_voci v where v.id = p.voce_id)
  ) then
    raise exception 'Una delle voci scelte non c''è più: rileggi la pagina e scegli di nuovo.';
  end if;
  select v.descrizione into v_nome
    from jsonb_to_recordset(p_parti) as p(voce_id uuid)
    join piano_voci v on v.id = p.voce_id
   where v.archiviata_il is not null
   limit 1;
  if found then
    raise exception '«%» è archiviata: riprendila prima, oppure scegli un''altra voce.', v_nome;
  end if;

  -- 🔴 LA RIGA DELLA SPESA SI BLOCCA PRIMA DI TUTTO: due divisioni insieme
  --    sulla stessa spesa si mettono in fila, non si mescolano. La spunta
  --    si scrive solo se manca: una riga già segnata non si tocca.
  if p_fonte = 'prima_nota' then
    select amount, e_investimento, direction = 'uscita' into v_importo, v_segnata, v_uscita
      from cash_movements where id = p_id for no key update;
    if v_importo is not null and not v_uscita then
      raise exception 'Questa riga di prima nota è un''entrata: nel piano dell''investimento vanno solo le spese.';
    end if;
    if v_importo is not null and not v_segnata then
      update cash_movements set e_investimento = true where id = p_id;
    end if;
  elsif p_fonte = 'anticipazione' then
    select importo, e_investimento into v_importo, v_segnata from anticipazioni_socio where id = p_id for no key update;
    if v_importo is not null and not v_segnata then
      update anticipazioni_socio set e_investimento = true where id = p_id;
    end if;
  else
    select amount, e_investimento into v_importo, v_segnata from supplier_invoices where id = p_id for no key update;
    if v_importo is not null and not v_segnata then
      update supplier_invoices set e_investimento = true where id = p_id;
    end if;
  end if;
  if v_importo is null then
    raise exception 'La spesa da dividere non c''è più, oppure non puoi cambiarla.';
  end if;

  if v_somma < v_importo then
    raise exception 'Restano da dividere % €: la somma delle parti deve fare tutto l''importo % (% €).',
      to_char(v_importo - v_somma, 'FM999G999G990D00'), v_cosa, to_char(v_importo, 'FM999G999G990D00');
  end if;
  if v_somma > v_importo then
    raise exception 'Hai diviso % € in più %: la somma delle parti deve fare % €.',
      to_char(v_somma - v_importo, 'FM999G999G990D00'), v_cosa, to_char(v_importo, 'FM999G999G990D00');
  end if;

  -- Tutti i collegamenti di prima se ne vanno (anche quelli «da dividere»),
  -- e arrivano le parti scelte. I portieri dei collegamenti controllano
  -- ogni riga: spesa segnata, non dell'orto, rata giusta, niente madri.
  if p_fonte = 'prima_nota' then
    delete from piano_collegamenti where cash_movement_id = p_id;
  elsif p_fonte = 'anticipazione' then
    delete from piano_collegamenti where anticipazione_id = p_id;
  else
    delete from piano_collegamenti where supplier_invoice_id = p_id;
  end if;

  insert into piano_collegamenti (voce_id, rata_id, cash_movement_id, anticipazione_id, supplier_invoice_id, importo_attribuito, da_dividere)
  select p.voce_id,
         p.rata_id,
         case when p_fonte = 'prima_nota' then p_id end,
         case when p_fonte = 'anticipazione' then p_id end,
         case when p_fonte = 'fattura' then p_id end,
         p.importo,
         false
    from jsonb_to_recordset(p_parti) as p(voce_id uuid, rata_id uuid, importo numeric);
end;
$fn$;

comment on function dividi_spesa(text, uuid, jsonb) is
  'Divide una spesa (prima nota, anticipo o fattura) su una o più voci del piano, ognuna con la sua cifra, in un gesto solo: mette la spunta «investimento» e sostituisce tutti i collegamenti. La somma deve essere l''importo della spesa al centesimo (12/11/2026).';

revoke all on function dividi_spesa(text, uuid, jsonb) from public, anon;
grant execute on function dividi_spesa(text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_srls     uuid;
  v_caus     uuid;
  v_forn     uuid;
  v_cucina   uuid;
  v_forno    uuid;
  v_sedie    uuid;
  v_banco    uuid;
  v_fat      uuid;
  v_fat1     uuid;
  v_mov      uuid;
  v_acconto  uuid;
  v_rata     uuid;
  v_entrata  uuid;
  v_staff    uuid;
  v_caus_in  uuid;
  v_n        integer;
  v_rifiuto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  select id into v_caus from cash_causali where kind = 'uscita' and active and not di_sistema order by created_at limit 1;
  select id into v_caus_in from cash_causali where kind = 'entrata' and active and not di_sistema order by created_at limit 1;
  if v_titolare is null or v_srls is null or v_caus is null or v_caus_in is null then
    raise exception 'VERIFICA: servono un titolare, Borgo 58 e una causale d''uscita e una d''entrata.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    insert into suppliers (entity_id, name) values (v_srls, 'ZZ fornitore dividi') returning id into v_forn;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-D1', current_date, 7200.00) returning id into v_fat;
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_srls, v_forn, 'ZZ-D2', current_date, 500.00) returning id into v_fat1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato) values ('A', 997, 'ZZ cucina del dividi', 0) returning id into v_cucina;
    insert into piano_voci (gruppo, descrizione, importo_ivato, madre_id) values ('A', 'ZZ forno del dividi', 5000, v_cucina) returning id into v_forno;
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato) values ('C', 997, 'ZZ sedie del dividi', 3000) returning id into v_sedie;
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato) values ('C', 998, 'ZZ banco del dividi', 1000) returning id into v_banco;

    -- (1) La divisione giusta: 4.500 sul forno (sottovoce) + 2.700 sulle sedie.
    perform dividi_spesa('fattura', v_fat, jsonb_build_array(
      jsonb_build_object('voce_id', v_forno, 'rata_id', null, 'importo', 4500.00),
      jsonb_build_object('voce_id', v_sedie, 'importo', 2700.00)));
    set constraints all immediate;
    set constraints all deferred;
    select count(*) into v_n from piano_collegamenti
     where supplier_invoice_id = v_fat and not da_dividere
       and ((voce_id = v_forno and importo_attribuito = 4500) or (voce_id = v_sedie and importo_attribuito = 2700));
    if v_n <> 2 or not (select e_investimento from supplier_invoices where id = v_fat) then
      raise exception 'VERIFICA (1): la fattura non è divisa 4.500 + 2.700, oppure non è segnata.';
    end if;

    -- (2) La somma sbagliata si rifiuta, per difetto e per eccesso.
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_forno, 'importo', 4500.00),
        jsonb_build_object('voce_id', v_sedie, 'importo', 2400.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like 'Restano da dividere 300%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (2): una divisione che lascia 300 € è passata.'; end if;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_forno, 'importo', 4500.00),
        jsonb_build_object('voce_id', v_sedie, 'importo', 3000.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like 'Hai diviso 300%in più della fattura%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (2b): una divisione con 300 € in più è passata.'; end if;

    -- (3) La voce madre si rifiuta (il portiere delle sottovoci), e anche la
    --     stessa voce due volte.
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_cucina, 'importo', 4500.00),
        jsonb_build_object('voce_id', v_sedie, 'importo', 2700.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like '%collega la spesa alla sottovoce giusta%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (3): una parte è finita sulla voce madre.'; end if;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_sedie, 'importo', 4500.00),
        jsonb_build_object('voce_id', v_sedie, 'importo', 2700.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like '%stessa voce due volte%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (3b): la stessa voce è passata due volte.'; end if;
    -- Dopo i rifiuti la divisione di prima è ancora lì, intera.
    select count(*) into v_n from piano_collegamenti where supplier_invoice_id = v_fat;
    if v_n <> 2 then raise exception 'VERIFICA (3c): un rifiuto ha lasciato % collegamenti invece di 2.', v_n; end if;

    -- (4) Il pagamento di una fattura divisa eredita i collegamenti, segnati
    --     «da dividere»; quello di una fattura su una voce sola no.
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 3000.00, current_date, 'cassa', 'ZZ verifica dividi - acconto', v_fat)
    returning id into v_acconto;
    set constraints all immediate;
    set constraints all deferred;
    -- In ordine: il collegamento più grande (4.500 sul forno) prende tutti i 3.000.
    select count(*) into v_n from piano_collegamenti where cash_movement_id = v_acconto;
    if v_n <> 1 or not exists (
      select 1 from piano_collegamenti
       where cash_movement_id = v_acconto and voce_id = v_forno and importo_attribuito = 3000 and da_dividere
    ) then
      raise exception 'VERIFICA (4): l''acconto della fattura divisa non ha ereditato 3.000 € sul forno, «da dividere» (% righe).', v_n;
    end if;
    perform segna_investimento('fattura', v_fat1, v_banco);
    insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, business_purpose, supplier_invoice_id)
    values (v_srls, 'uscita', 500.00, current_date, 'cassa', 'ZZ verifica dividi - fattura su una voce', v_fat1)
    returning id into v_mov;
    set constraints all immediate;
    set constraints all deferred;
    if exists (select 1 from piano_collegamenti where cash_movement_id = v_mov and da_dividere)
       or not exists (select 1 from piano_collegamenti where cash_movement_id = v_mov) then
      raise exception 'VERIFICA (4b): il pagamento di una fattura su una voce sola è «da dividere», o non ha ereditato.';
    end if;

    -- (5) Dividere l'acconto a mano toglie il segno: 1.875 + 1.125.
    perform dividi_spesa('prima_nota', v_acconto, jsonb_build_array(
      jsonb_build_object('voce_id', v_forno, 'importo', 1875.00),
      jsonb_build_object('voce_id', v_sedie, 'importo', 1125.00)));
    if exists (select 1 from piano_collegamenti where cash_movement_id = v_acconto and da_dividere) then
      raise exception 'VERIFICA (5): dopo la divisione l''acconto è ancora «da dividere».';
    end if;

    -- (6) Una nuova divisione sostituisce la vecchia, tutta: anche su una
    --     voce sola, e su voci diverse da prima.
    perform dividi_spesa('fattura', v_fat, jsonb_build_array(
      jsonb_build_object('voce_id', v_banco, 'importo', 7200.00)));
    select count(*) into v_n from piano_collegamenti where supplier_invoice_id = v_fat;
    if v_n <> 1 or not exists (select 1 from piano_collegamenti where supplier_invoice_id = v_fat and voce_id = v_banco and importo_attribuito = 7200) then
      raise exception 'VERIFICA (6): la nuova divisione non ha sostituito la vecchia (% collegamenti).', v_n;
    end if;

    -- (7) Una voce archiviata non si sceglie.
    update piano_voci set archiviata_il = now() where id = v_sedie;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_banco, 'importo', 7000.00),
        jsonb_build_object('voce_id', v_sedie, 'importo', 200.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like '%è archiviata%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (7): una parte è finita su una voce archiviata.'; end if;

    -- (8) Le righe storte si dicono in italiano: zero, tre decimali, voce
    --     che non c'è, identificativo storpiato, rata di un'altra voce.
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_banco, 'importo', 7200.00),
        jsonb_build_object('voce_id', v_forno, 'importo', 0)));
    exception when raise_exception then v_rifiuto := sqlerrm like 'Ogni parte deve essere più di zero%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8a): una parte a zero è passata.'; end if;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_banco, 'importo', 7199.995),
        jsonb_build_object('voce_id', v_forno, 'importo', 0.005)));
    exception when raise_exception then v_rifiuto := sqlerrm like 'Le cifre si scrivono al centesimo%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8b): una cifra con tre decimali è passata.'; end if;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', gen_random_uuid(), 'importo', 7200.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like 'Una delle voci scelte non c''è più%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8c): una voce che non c''è è passata.'; end if;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', 'non-un-id', 'importo', 7200.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like '%non si riconosce%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8d): un identificativo storpiato non si è detto in italiano.'; end if;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_forno, 0, 5000) returning id into v_rata;
    v_rifiuto := false;
    begin
      perform dividi_spesa('fattura', v_fat, jsonb_build_array(
        jsonb_build_object('voce_id', v_banco, 'rata_id', v_rata, 'importo', 7200.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like 'La rata scelta non è di questa voce%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (8e): la rata di un''altra voce è passata.'; end if;

    -- (9) Un'entrata di prima nota non si divide.
    insert into cash_movements (entity_id, direction, amount, movement_date, causale_id, mezzo, business_purpose)
    values (v_srls, 'entrata', 50.00, current_date, v_caus_in, 'cassa', 'ZZ verifica dividi - entrata')
    returning id into v_entrata;
    v_rifiuto := false;
    begin
      perform dividi_spesa('prima_nota', v_entrata, jsonb_build_array(
        jsonb_build_object('voce_id', v_banco, 'importo', 50.00)));
    exception when raise_exception then v_rifiuto := sqlerrm like '%è un''entrata%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (9): un''entrata è stata divisa sul piano.'; end if;

    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (10) Chi non è il titolare riceve un rifiuto con la ragione.
    if v_staff is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_rifiuto := false;
      begin
        perform dividi_spesa('fattura', v_fat, jsonb_build_array(
          jsonb_build_object('voce_id', v_banco, 'importo', 7200.00)));
      exception when raise_exception then v_rifiuto := sqlerrm like '%riservato al titolare%';
      end;
      reset role;
      perform set_config('request.jwt.claims', null, true);
      if not v_rifiuto then raise exception 'VERIFICA (10): uno staff ha diviso una spesa.'; end if;
    end if;

    if has_function_privilege('anon', 'dividi_spesa(text, uuid, jsonb)', 'execute') then
      raise exception 'VERIFICA (11): anon può dividere una spesa.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica di «dividi su più voci»');

  raise notice 'Fatto: una spesa si divide su più voci del piano, al centesimo e in un gesto solo; il pagamento di una fattura divisa si segna «da dividere», e si divide a mano. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000003', 'dividi_su_piu_voci')
on conflict (version) do nothing;
