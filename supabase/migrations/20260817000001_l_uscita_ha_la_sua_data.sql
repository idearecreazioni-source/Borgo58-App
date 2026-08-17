-- L'uscita ha la sua data: gli assegni postdatati, e cosa conta un saldo.
--
-- 🔴 IL DIFETTO (collaudo del 17/08, n. 7 del secondo blocco). Pagando una
-- fattura con un assegno a 30 giorni, l'uscita in prima nota nasceva
-- **oggi**: la cassa scendeva un mese prima che i soldi uscissero. Alessio
-- conta di usarne una trentina prima dell'apertura, quindi non e' un caso
-- di scuola: sono trenta saldi sbagliati.
--
-- ⚠️ E NON BASTAVA SCRIVERE LA DATA FUTURA. `v_cash_balance` sommava TUTTI
-- i movimenti senza guardare la data: un'uscita datata al mese prossimo
-- avrebbe abbassato il saldo di oggi comunque, cioe' avrebbe riprodotto lo
-- stesso difetto dall'altro lato. La data non puo' diventare un dato a se'
-- senza decidere **cosa conta un saldo**.
--
-- LA DECISIONE (Alessio, 17/08): «un saldo risponde a *quanti soldi ho
-- adesso*, e un assegno che uscira' fra un mese non e' ancora uscito».
-- Quindi i saldi contano solo cio' che e' GIA' AVVENUTO, e l'uscita
-- futura vive in prima nota con la sua data vera.
--
-- E' lo stesso principio che il gestionale usa dal 15/08 per gli
-- stipendi: **il costo sta quando nasce, l'uscita quando i soldi escono.**
--
-- ⚠️ LA STRADA SCARTATA, agli atti: scrivere il movimento solo all'incasso
-- dell'assegno. Non tocca i saldi, ma per un mese la fattura risulterebbe
-- «pagata» senza nessuna uscita in prima nota — e quello romperebbe la
-- regola del 16/08 (pagare una fattura SCRIVE in prima nota), che e' anche
-- cio' che oggi impedisce di cancellare una fattura pagata. Si comprerebbe
-- un problema per risolverne un altro.
--
-- ⚠️ LE DUE CONDIZIONI POSTE DA ALESSIO, e la prima conta piu' della
-- funzione stessa:
--   1. «Ce la faccio?» deve LEGGERE i movimenti futuri. Appena si consegna
--      l'assegno la fattura risulta pagata e sparisce dalle uscite attese:
--      se la previsione non guardasse i movimenti futuri, quell'uscita
--      scomparirebbe del tutto — non piu' fra le attese, non ancora nel
--      saldo. Il gestionale direbbe di stare piu' larghi di quanto si sta,
--      che e' il peggiore dei due errori. E nel farlo, il controllo
--      speculare: **la stessa uscita non deve comparire due volte.**
--   2. Il saldo che cambia da solo alla mezzanotte va SPIEGATO, nei due
--      versi: quante uscite future non sono ancora nel saldo, e quali sono
--      entrate nel saldo oggi. Altrimenti la prima volta che succede
--      sembra un errore del gestionale.

-- =====================================================================
-- 1. L'identificativo del pagamento
-- =====================================================================
--
-- Il numero dell'assegno, il riferimento del bonifico. Senza, l'estratto
-- conto non si riconcilia: due uscite dello stesso importo allo stesso
-- fornitore sono indistinguibili.
--
-- ⚠️ Non si riusa `document_reference`, che e' il riferimento del
-- DOCUMENTO (la fattura). Sono due cose diverse e servono insieme: la
-- fattura 114 pagata con l'assegno 0004521.
alter table cash_movements add column if not exists riferimento_pagamento text;

comment on column cash_movements.riferimento_pagamento is
  'Numero dell''assegno, riferimento del bonifico: l''identificativo con cui questa uscita si ritrova sull''estratto conto. Distinto da document_reference, che identifica il DOCUMENTO pagato.';

-- =====================================================================
-- 1bis. L'assegno entra nel vocabolario — in TUTTI E DUE i posti
-- =====================================================================
--
-- ⚠️ TERZA VOLTA CHE QUESTA TRAPPOLA SI PRESENTA, e me ne sono accorto
-- applicando: il 16/08 il vocabolario degli scarichi era chiuso in due
-- posti (la funzione e un vincolo sulla tabella), e qui e' identico —
-- `pay_supplier_invoice` controlla l'elenco dei metodi, e
-- `supplier_invoices` ha il suo vincolo. Allargando solo la funzione, il
-- primo assegno sarebbe fallito con un errore incomprensibile del
-- database, e la verifica di questa migrazione si e' fermata proprio li'.
--
-- Quello sulla TABELLA e' il piu' importante dei due: vale anche per chi
-- scrive dal browser, che la funzione non la passa.
alter table supplier_invoices drop constraint if exists supplier_invoices_payment_method_check;
alter table supplier_invoices add constraint supplier_invoices_payment_method_check
  check (payment_method = any (array['contante', 'bonifico', 'carta', 'assegno']));

-- =====================================================================
-- 2. Il saldo conta solo cio' che e' avvenuto
-- =====================================================================
--
-- ⚠️ `create or replace view` pretende le stesse colonne negli stessi
-- posti: qui cambia solo la condizione, non l'elenco.
create or replace view v_cash_balance as
 select e.id as entity_id,
    e.name as entity_name,
    coalesce(sum(case
        when m.mezzo = 'cassa' and m.direction = 'entrata' then m.amount
        when m.mezzo = 'cassa' then - m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as balance,
    coalesce(sum(case
        when m.mezzo = 'cassa' and m.is_owner_injection then m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as owner_float,
    coalesce(sum(case
        when m.mezzo = 'cassa' and m.direction = 'entrata' and not m.is_owner_injection then m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as declared_takings,
    coalesce(sum(case
        when m.mezzo = 'cassa' and m.direction = 'uscita' then m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as total_out,
    coalesce(sum(case
        when m.mezzo = 'banca' and m.direction = 'entrata' then m.amount
        when m.mezzo = 'banca' then - m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as saldo_banca,
    coalesce(sum(case
        when m.mezzo = 'banca' and m.direction = 'entrata' then m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as entrate_banca,
    coalesce(sum(case
        when m.mezzo = 'banca' and m.direction = 'uscita' then m.amount
        else 0::numeric end), 0::numeric)::numeric(14,2) as uscite_banca
   from entities e
     -- ⚠️ LA RIGA CHE CAMBIA TUTTO: la condizione sta nel `join`, non in un
     -- `where`. Con un `where` le entita' senza nessun movimento passato
     -- sparirebbero dalla vista invece di comparire a zero — e un'entita'
     -- che scompare e' peggio di un saldo a zero, perche' non si vede.
     left join cash_movements m
            on m.entity_id = e.id
           and m.movement_date <= (now() at time zone 'Europe/Rome')::date
  group by e.id, e.name;

comment on view v_cash_balance is
  'I saldi di cassa e banca: contano SOLO i movimenti fino a oggi (17/08/2026, decisione di Alessio). Un saldo risponde a «quanti soldi ho adesso», e un''uscita datata al mese prossimo non e'' ancora uscita. Le uscite future si leggono da uscite_future().';

-- =====================================================================
-- 3. Le uscite future: quante sono, e quali entrano oggi
-- =====================================================================
--
-- Serve alla seconda condizione: il saldo che cambia da solo alla
-- mezzanotte va spiegato nei DUE versi.
create or replace function uscite_future(p_entity_id uuid)
returns table (
  quante          integer,
  totale          numeric,
  prima_scadenza  date,
  entrate_oggi    integer,
  totale_oggi     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as d)
  select
    count(*) filter (where m.movement_date > o.d)::integer,
    coalesce(sum(m.amount) filter (where m.movement_date > o.d), 0),
    min(m.movement_date) filter (where m.movement_date > o.d),
    -- ⚠️ Il rovescio: cio' che e' entrato nel saldo OGGI senza che nessuno
    -- abbia fatto niente. Senza questo numero, la prima volta che il saldo
    -- scende da solo sembra un errore del gestionale.
    count(*) filter (where m.movement_date = o.d and m.supplier_invoice_id is not null)::integer,
    coalesce(sum(m.amount) filter (where m.movement_date = o.d and m.supplier_invoice_id is not null), 0)
  from cash_movements m
  cross join oggi o
  where m.entity_id = p_entity_id
    and m.direction = 'uscita';
$$;

comment on function uscite_future(uuid) is
  'Le uscite di prima nota datate nel futuro (non ancora nei saldi) e quelle entrate nel saldo oggi. Serve a spiegare un saldo che cambia da solo alla mezzanotte: senza, la prima volta sembra un errore.';

revoke all on function uscite_future(uuid) from public, anon, authenticated;
grant execute on function uscite_future(uuid) to authenticated;

-- =====================================================================
-- 4. «Ce la faccio?» legge i movimenti futuri — la prima condizione
-- =====================================================================
create or replace function movimenti_attesi(p_entity_id uuid, p_fino_al date default null)
returns table (origine text, riferimento uuid, quando date, descrizione text, importo numeric, mezzo text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_fino date := coalesce(p_fino_al, v_oggi + 90);
  v_anno integer := extract(year from v_oggi)::integer;
  v_ha_fiscali boolean;
begin
  if not is_titolare() then
    raise exception 'Le scadenze sono riservate al titolare.';
  end if;

  -- Un pezzo che non si sa non deve portarsi via i pezzi che si sanno
  -- (15/08): senza parametri fiscali si perdono le imposte, non le fatture.
  select exists (select 1 from fiscal_settings f where f.entity_id = p_entity_id)
    into v_ha_fiscali;

  return query
  -- Le fatture non ancora pagate. ⚠️ Quando `pay_supplier_invoice` le
  -- segna pagate spariscono da sole — ed e' proprio per questo che serve
  -- il ramo delle uscite future qui sotto: altrimenti un'uscita consegnata
  -- e non ancora incassata non sarebbe da nessuna parte.
  select 'fattura'::text, i.id,
         coalesce(i.due_date, i.invoice_date),
         ('Fattura ' || coalesce(s.name, 'fornitore') || coalesce(' n. ' || i.invoice_number, ''))::text,
         i.amount,
         coalesce(i.payment_method, 'banca')::text
    from supplier_invoices i
    left join suppliers s on s.id = i.supplier_id
   where i.entity_id = p_entity_id
     and i.status = 'da_pagare'
     and coalesce(i.due_date, i.invoice_date) <= v_fino
  union all
  -- ⚠️ LE USCITE GIA' SCRITTE MA NON ANCORA AVVENUTE (17/08). Sono in
  -- prima nota con la loro data vera e NON sono nei saldi: se non
  -- comparissero qui sarebbero invisibili in tutti e due i posti, e la
  -- previsione direbbe di stare piu' larghi di quanto si sta.
  --
  -- ⚠️ NIENTE DOPPIO CONTEGGIO, e la ragione e' strutturale e non un
  -- filtro furbo: un'uscita con `supplier_invoice_id` esiste solo dopo che
  -- la fattura e' passata a «pagata», e il primo ramo prende solo le
  -- «da_pagare». I due insiemi non possono intersecarsi. La verifica lo
  -- controlla contando le righe, non fidandosi di questo ragionamento.
  select 'uscita_futura'::text, m.id, m.movement_date,
         ('Gia'' registrata: ' || coalesce(nullif(m.business_purpose, ''),
             coalesce(c.label, 'uscita'))
           || coalesce(' (' || m.riferimento_pagamento || ')', ''))::text,
         m.amount,
         (case when m.mezzo = 'cassa' then 'contante' else 'banca' end)::text
    from cash_movements m
    left join cash_causali c on c.id = m.causale_id
   where m.entity_id = p_entity_id
     and m.direction = 'uscita'
     and m.movement_date > v_oggi
     and m.movement_date <= v_fino
  union all
  select 'imposta'::text, null::uuid, c.scadenza, c.voce, c.importo, 'banca'::text
    from calendario_imposte(p_entity_id, v_anno, 0, null) c
   where v_ha_fiscali
     and c.scadenza between v_oggi and v_fino
     and c.importo > 0
  union all
  select 'scadenza'::text, p.id, p.scade_il, p.descrizione, p.importo, p.mezzo
    from scadenze_previste p
   where p.entity_id = p_entity_id
     and p.chiusa_il is null
     and p.scade_il <= v_fino
  order by 3;
end;
$funzione$;

revoke all on function movimenti_attesi(uuid, date) from public, anon, authenticated;
grant execute on function movimenti_attesi(uuid, date) to authenticated;

-- =====================================================================
-- 5. Pagare una fattura: con che data, e con quale identificativo
-- =====================================================================
--
-- ⚠️ Due parametri in piu' fanno una funzione NUOVA: in Postgres le due
-- resterebbero sovrapposte e ogni chiamata per nome diventerebbe ambigua
-- (42725, a tempo di esecuzione — lezione del 13/08). Si cancella e si
-- ricrea, e dopo il `drop` i permessi tornano aperti al mondo: si
-- richiudono a mano, e la verifica lo controlla.
-- ⚠️ Si cancella la firma VECCHIA (due parametri) e la nuova si scrive con
-- `create or replace`: con un `create` secco, riapplicare la migrazione si
-- fermerebbe su «la funzione esiste già» — e una migrazione che non si può
-- rieseguire viola il §5 punto 3. Trovato riapplicandola, non leggendola.
drop function if exists pay_supplier_invoice(uuid, text);

create or replace function pay_supplier_invoice(
  p_invoice_id     uuid,
  p_payment_method text,
  p_data_uscita    date default null,
  p_riferimento    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv       supplier_invoices%rowtype;
  v_fornitore text;
  v_mezzo     text;
  v_data      date;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un pagamento';
  end if;
  -- ⚠️ L'assegno entra qui: prima non era un mezzo di pagamento, e un
  -- pagamento vero che il gestionale non sa nominare finisce per essere
  -- registrato come qualcos'altro.
  if p_payment_method is null or p_payment_method not in ('contante', 'bonifico', 'carta', 'assegno') then
    raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(mancante)');
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status = 'pagata' then
    raise exception 'Questa fattura risulta gia'' pagata';
  end if;

  -- La data la dice lui; senza, e' oggi come prima.
  --
  -- ⚠️ QUI NON C'E' NESSUN RIFIUTO, ed e' una correzione a me stesso
  -- (rilievo di Alessio, 17/08). La prima versione rifiutava una data
  -- ANTERIORE alla fattura, ragionando che un'uscita prima del documento
  -- che la giustifica fosse un errore di digitazione. **E' un caso vero:**
  -- l'acconto o la caparra si pagano PRIMA che la fattura arrivi, e coi
  -- fornitori nuovi non e' nemmeno raro. Quel vincolo avrebbe bloccato un
  -- gesto legittimo.
  --
  -- E non si sostituisce con una soglia («non oltre N giorni prima»): un
  -- errore di digitazione e un acconto sono indistinguibili da qui, e una
  -- soglia inventata sarebbe una regola scritta da me sui suoi soldi. Il
  -- posto giusto per l'avvertenza e' la SCHERMATA, che puo' dire «esce
  -- prima della data della fattura: e' un acconto?» e lasciar decidere —
  -- informazione, non divieto.
  --
  -- Il database rifiuta dove c'e' un invariante. Qui non ce n'e' nessuno:
  -- una data prima e' un acconto, una data dopo e' un assegno postdatato.
  -- Sono entrambe cose vere.
  v_data := coalesce(p_data_uscita, (now() at time zone 'Europe/Rome')::date);

  update supplier_invoices
     set status = 'pagata', paid_at = now(), payment_method = p_payment_method
   where id = p_invoice_id;

  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  -- Il mezzo si deduce dal metodo. ⚠️ L'assegno esce dal CONTO, non dal
  -- cassetto: e' un ordine alla banca, e chi lo incassa lo porta in banca.
  v_mezzo := case when p_payment_method = 'contante' then 'cassa' else 'banca' end;

  select name into v_fornitore from suppliers where id = v_inv.supplier_id;

  insert into cash_movements (
    entity_id, direction, amount, movement_date, mezzo,
    tipo_documento, document_reference, riferimento_pagamento, business_purpose,
    supplier_invoice_id
  ) values (
    v_inv.entity_id, 'uscita', v_inv.amount,
    v_data,
    v_mezzo,
    'fattura',
    coalesce(nullif(v_inv.document_reference, ''), v_inv.invoice_number),
    nullif(p_riferimento, ''),
    'Pagamento fattura ' || coalesce(v_inv.invoice_number, '')
      || coalesce(' — ' || v_fornitore, ''),
    p_invoice_id
  );

  return p_invoice_id;
end;
$funzione$;

comment on function pay_supplier_invoice(uuid, text, date, text) is
  'Segna pagata una fattura, chiude il promemoria e scrive l''uscita in prima nota CON LA SUA DATA VERA (17/08/2026): un assegno a 30 giorni non deve abbassare la cassa oggi. Accetta l''identificativo del pagamento, senza il quale l''estratto conto non si riconcilia.';

revoke all on function pay_supplier_invoice(uuid, text, date, text) from public, anon, authenticated;
grant execute on function pay_supplier_invoice(uuid, text, date, text) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit      uuid;
  v_ente     uuid;
  v_forn     uuid;
  v_inv      uuid;
  v_saldo_p  numeric;
  v_saldo_d  numeric;
  n          integer;
  quante     integer;
  totale     numeric;
  oggi_n     integer;
  passata    boolean;
  v_domani   date;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;
  v_domani := (now() at time zone 'Europe/Rome')::date + 30;

  -- Un fornitore e una fattura solo di questa verifica.
  insert into suppliers (entity_id, name) values (v_ente, '__VERIFICA__ assegni')
    returning id into v_forn;
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ 1', (now() at time zone 'Europe/Rome')::date, 250.00, 'da_pagare')
    returning id into v_inv;

  select b.saldo_banca into v_saldo_p from v_cash_balance b where b.entity_id = v_ente;

  -- 1. Il pagamento con assegno a 30 giorni.
  perform pay_supplier_invoice(v_inv, 'assegno', v_domani, 'ASSEGNO 0004521');

  -- 2. L'uscita c'e' in prima nota, con la SUA data e il suo riferimento.
  select count(*) into n from cash_movements
   where supplier_invoice_id = v_inv and movement_date = v_domani
     and riferimento_pagamento = 'ASSEGNO 0004521' and mezzo = 'banca';
  if n <> 1 then
    raise exception 'L''uscita dell''assegno non e'' stata scritta con la sua data (righe: %).', n;
  end if;

  -- 3. E IL SALDO NON SI E' MOSSO: e' il cuore della migrazione.
  select b.saldo_banca into v_saldo_d from v_cash_balance b where b.entity_id = v_ente;
  if v_saldo_d <> v_saldo_p then
    raise exception
      'Il saldo banca e'' cambiato (% -> %): un''uscita futura non deve toccare i saldi.',
      v_saldo_p, v_saldo_d;
  end if;

  -- 3bis. E ORA IL VERSO OPPOSTO, che e' la meta' che conta davvero
  --       (rilievo di Alessio, 17/08).
  --
  -- ⚠️ «Il saldo non e' cambiato» da solo e' una prova DEBOLE: dimostra che
  -- la regola non rompe niente, non che funziona — e coinciderebbe anche
  -- se la vista ignorasse la data del tutto. La prova forte e' quella che
  -- produce LEI la differenza: **lo stesso movimento**, spostato da domani
  -- a ieri, deve entrare nel saldo di **esattamente** il suo importo.
  -- Due numeri che devono divergere di una cifra nota, non due che devono
  -- coincidere. E' la lezione delle mance applicata qui: si misura la
  -- differenza che si produce, non il totale del mondo.
  update cash_movements
     set movement_date = (now() at time zone 'Europe/Rome')::date - 1
   where supplier_invoice_id = v_inv;

  select b.saldo_banca into v_saldo_d from v_cash_balance b where b.entity_id = v_ente;
  if v_saldo_d <> v_saldo_p - 250.00 then
    raise exception
      'Spostando l''uscita a ieri il saldo banca doveva passare da % a %, ed e'' %.',
      v_saldo_p, v_saldo_p - 250.00, v_saldo_d;
  end if;

  -- E rimessa a domani, torna fuori dal saldo: la data comanda in tutti e
  -- due i versi, non solo in discesa.
  update cash_movements set movement_date = v_domani where supplier_invoice_id = v_inv;
  select b.saldo_banca into v_saldo_d from v_cash_balance b where b.entity_id = v_ente;
  if v_saldo_d <> v_saldo_p then
    raise exception 'Rimessa a domani, l''uscita e'' rimasta nel saldo (% invece di %).', v_saldo_d, v_saldo_p;
  end if;

  -- 4. Ma compare fra le uscite attese, UNA VOLTA SOLA. Il controllo
  --    speculare chiesto da Alessio: non deve nemmeno sparire, ne'
  --    comparire due volte.
  select count(*) into n from movimenti_attesi(v_ente, v_domani + 1) m
   where m.riferimento = (select id from cash_movements where supplier_invoice_id = v_inv);
  if n <> 1 then
    raise exception 'L''uscita futura compare % volte fra le attese invece di una.', n;
  end if;

  -- 5. E la fattura NON compare piu' come «da pagare»: sarebbe il doppio
  --    conteggio dell'altro verso.
  select count(*) into n from movimenti_attesi(v_ente, v_domani + 1) m
   where m.origine = 'fattura' and m.riferimento = v_inv;
  if n <> 0 then
    raise exception 'La fattura pagata compare ancora fra le uscite attese: doppio conteggio.';
  end if;

  -- 6. Il conteggio che spiega il saldo che cambia da solo.
  select f.quante, f.totale, f.entrate_oggi into quante, totale, oggi_n
    from uscite_future(v_ente) f;
  if quante < 1 or totale < 250 then
    raise exception 'uscite_future non vede l''uscita di domani (quante=%, totale=%).', quante, totale;
  end if;

  -- 7. L'ACCONTO PASSA: un'uscita anteriore alla fattura e' legittima, e
  --    questa prova sta qui per impedire che qualcuno la richiuda domani
  --    credendo di correggere un difetto. Il caso e' l'acconto pagato
  --    prima che la fattura arrivi.
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ 2', (now() at time zone 'Europe/Rome')::date, 10.00, 'da_pagare')
    returning id into v_inv;
  perform pay_supplier_invoice(v_inv, 'bonifico', (now() at time zone 'Europe/Rome')::date - 5, 'ACCONTO');
  select count(*) into n from cash_movements
   where supplier_invoice_id = v_inv
     and movement_date = (now() at time zone 'Europe/Rome')::date - 5;
  if n <> 1 then
    raise exception 'L''acconto pagato prima della fattura non e'' stato registrato (righe: %).', n;
  end if;

  -- 8. Un metodo inventato si rifiuta ancora.
  passata := false;
  begin
    perform pay_supplier_invoice(v_inv, 'contanti_in_nero', null, null);
    passata := true;
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like 'Metodo di pagamento non valido%' then raise; end if;
  end;
  if passata then raise exception 'Ha accettato un metodo di pagamento inventato.'; end if;

  -- 9. Le funzioni non sono raggiungibili da fuori.
  if has_function_privilege('anon', 'pay_supplier_invoice(uuid,text,date,text)', 'execute')
     or has_function_privilege('anon', 'uscite_future(uuid)', 'execute')
     or has_function_privilege('anon', 'movimenti_attesi(uuid,date)', 'execute') then
    raise exception 'Una delle funzioni e'' rimasta eseguibile con la chiave pubblica.';
  end if;

  -- 10. Pulizia: si rimette il mondo come lo si e' trovato.
  -- ⚠️ SI SCOLLEGA PRIMA E SI CANCELLA DOPO, ed e' il trigger del Blocco 1
  -- che lo impone: un movimento non si toglie finche' la fattura dichiara
  -- «pagata», altrimenti resterebbe una fattura pagata senza un euro
  -- uscito. Il trigger ha fermato questa verifica al primo colpo, e ha
  -- fatto bene — la strada e' la stessa dei due storni del 16/08, non una
  -- scappatoia nel trigger. Una scappatoia sarebbe anche la strada per
  -- aggirarlo.
  update cash_movements set supplier_invoice_id = null
   where supplier_invoice_id in (select id from supplier_invoices where supplier_id = v_forn);
  delete from cash_movements
   where document_reference like '\_\_VERIFICA\_\_%' or business_purpose like '%__VERIFICA__%';
  delete from tasks where id in
    (select task_id from supplier_invoices where supplier_id = v_forn and task_id is not null);
  delete from supplier_invoices where supplier_id = v_forn;
  delete from suppliers where id = v_forn;
  delete from deleted_records where record::text like '%__VERIFICA__ assegni%'
     or record::text like '%__VERIFICA__ 1%' or record::text like '%__VERIFICA__ 2%';

  select count(*) into n from suppliers where name like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % fornitori di prova.', n; end if;
  select b.saldo_banca into v_saldo_d from v_cash_balance b where b.entity_id = v_ente;
  if v_saldo_d <> v_saldo_p then
    raise exception 'La verifica ha lasciato il saldo banca a % invece di %.', v_saldo_d, v_saldo_p;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'L''uscita ha la sua data: i saldi contano solo cio'' che e'' avvenuto, e le uscite future si vedono in «Ce la faccio?» una volta sola.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260817000001', 'l_uscita_ha_la_sua_data')
on conflict (version) do nothing;

select
  (select count(*) from cash_movements where movement_date > (now() at time zone 'Europe/Rome')::date) as uscite_future_esistenti,
  (select count(*) from cash_movements) as movimenti_in_tutto;
