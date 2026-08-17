-- La nota di credito: se arriva prima riduce il pagamento, se arriva dopo
-- diventa un credito. E i documenti collegati alla fattura.
--
-- N. 8 del secondo blocco del collaudo (17/08). DECISIONE DI ALESSIO —
-- **strada A**: la nota di credito riduce quanto si paga. Fattura 250 con
-- nota 40 → si paga 210, e il movimento in prima nota e' di 210. Ogni
-- schermata deve dire «fattura 250, nota −40, pagati 210», altrimenti
-- sembra che manchino 40 euro.
--
-- ⚠️ E se la nota arriva DOPO il pagamento diventa un credito da usare
-- sulla fattura successiva di quel fornitore. Sono due cose diverse a
-- seconda di QUANDO arriva, e il gestionale le deve fare entrambe.
--
-- ⚠️ TRE PUNTI DECISI COL VALIDATORE, e il terzo e' quello che questa
-- migrazione ha scoperto essere gia' rotto:
--   1. La nota di credito NON e' un allegato: ha numero, data e importo e
--      partecipa ai conti, quindi e' un documento a se' collegato alla
--      fattura. Il DDT invece e' meccanica — un documento dell'Archivio
--      che si aggancia, e basta (§11).
--   2. Il credito residuo va mostrato accanto al «da pagare» di quel
--      fornitore e proposto quando si paga la fattura dopo: altrimenti
--      resta dimenticato, e sono soldi di Alessio.
--   3. La nota riduce anche il COSTO, non solo l'uscita. Guardando li'
--      dentro e' saltato fuori che i costi erano gia' sbagliati per un
--      altro motivo: vedi §9.

-- =====================================================================
-- 1. Le due tabelle
-- =====================================================================
--
-- ⚠️ PERCHE' DUE E NON UNA, che e' la scelta di modello del blocco.
-- «Quale fattura CORREGGE questa nota» e «su quale fattura si SCALA» sono
-- due domande diverse, e la seconda ha piu' di una risposta possibile:
-- una nota di 100 su una fattura da 60 lascia 40 da usare altrove. Con
-- una colonna sola i 40 sparirebbero in silenzio — e perdere soldi in
-- silenzio e' la classe di difetto che questo progetto insegue da giorni.

create table if not exists note_credito (
  id           uuid primary key default gen_random_uuid(),
  entity_id    uuid not null references entities(id),
  supplier_id  uuid not null references suppliers(id),
  -- La fattura che la nota corregge. ⚠️ `restrict` e non `set null`: e'
  -- la lezione del 16/08 — cancellare la fattura non deve SCOLLEGARE una
  -- nota che dichiara di correggerla, deve essere respinto.
  -- Puo' essere vuoto: una nota di credito generica verso il fornitore
  -- (un abbuono di fine anno) non corregge nessun documento preciso.
  fattura_id   uuid references supplier_invoices(id) on delete restrict,
  numero       text,
  data         date not null,
  importo      numeric(14,2) not null check (importo > 0),
  note         text,
  regola_deducibilita_id uuid references regole_deducibilita(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table note_credito is
  'Le note di credito dei fornitori (17/08/2026, strada A decisa da Alessio). Se la fattura corretta non e'' ancora pagata la nota si scala su di lei e si paga la differenza; se e'' gia'' pagata resta come credito da usare sulla fattura dopo. Non e'' un allegato: ha numero, data e importo, e partecipa ai conti.';

comment on column note_credito.fattura_id is
  'La fattura che questa nota CORREGGE — il documento. Non e'' necessariamente quella su cui si scala: vedi note_credito_utilizzi.';

create table if not exists note_credito_utilizzi (
  id         uuid primary key default gen_random_uuid(),
  nota_id    uuid not null references note_credito(id) on delete cascade,
  fattura_id uuid not null references supplier_invoices(id) on delete restrict,
  importo    numeric(14,2) not null check (importo > 0),
  creato_il  timestamptz not null default now(),
  unique (nota_id, fattura_id)
);

comment on table note_credito_utilizzi is
  'Dove una nota di credito si scala davvero: quanto di quella nota abbassa il pagamento di quella fattura. Separata da note_credito.fattura_id perche'' una nota puo'' avanzare (nota da 100 su una fattura da 60) e l''avanzo deve restare spendibile invece di sparire.';

create index if not exists idx_note_credito_fornitore on note_credito(supplier_id);
create index if not exists idx_note_credito_fattura   on note_credito(fattura_id);
create index if not exists idx_utilizzi_fattura       on note_credito_utilizzi(fattura_id);

alter table note_credito           enable row level security;
alter table note_credito_utilizzi  enable row level security;

drop policy if exists note_credito_titolare_all on note_credito;
create policy note_credito_titolare_all on note_credito
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists note_credito_utilizzi_titolare_all on note_credito_utilizzi;
create policy note_credito_utilizzi_titolare_all on note_credito_utilizzi
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

drop trigger if exists set_updated_at on note_credito;
create trigger set_updated_at before update on note_credito
  for each row execute function set_updated_at();

-- La lapide, come per le fatture: una nota di credito e' un documento
-- fiscale, e cancellarla senza traccia toglie il modo di ricostruire
-- perche' un pagamento era piu' basso del documento che lo giustifica.
-- ⚠️ NON si mette sugli utilizzi, ed e' una scelta: annullare un pagamento
-- ne cancella, e sono la meccanica dell'applicazione — non un documento.
-- Una lapide per ogni annullamento riempirebbe il registro di righe
-- normali, che e' il modo in cui un registro smette di essere letto.
drop trigger if exists trg_log_delete on note_credito;
create trigger trg_log_delete before delete on note_credito
  for each row execute function log_deleted_record();

-- =====================================================================
-- 2. I numeri derivati — calcolati in UN posto solo
-- =====================================================================
--
-- Sono colonne CALCOLATE: PostgREST le espone come se fossero colonne
-- della tabella (`select=*,da_pagare`), quindi la schermata legge il
-- numero invece di rifarselo. ⚠️ E' la ragione per cui esistono: «250 meno
-- 40 fa 210» scritto anche in JavaScript sarebbe un secondo calcolo dello
-- stesso numero, che e' il difetto che il mandato di correzione ha appena
-- finito di chiudere in nove posti.
--
-- ⚠️ `security invoker` di proposito (come `documenti_per_domanda`, 12/08):
-- decide la RLS delle tabelle, non una seconda serratura da tenere
-- allineata. Le fatture sono titolare-only, e chi non le vede non arriva
-- qui.

create or replace function note_scalate(inv supplier_invoices)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(u.importo), 0)::numeric(14,2)
    from note_credito_utilizzi u
   where u.fattura_id = inv.id;
$$;

comment on function note_scalate(supplier_invoices) is
  'Quanto di questa fattura e'' coperto da note di credito. Colonna calcolata: si legge come una colonna qualunque della fattura.';

create or replace function da_pagare(inv supplier_invoices)
returns numeric
language sql
stable
set search_path = public
as $$
  select (inv.amount - note_scalate(inv))::numeric(14,2);
$$;

comment on function da_pagare(supplier_invoices) is
  'Quanto si paga davvero: l''importo della fattura meno le note di credito scalate. L''unico posto dove questa sottrazione esiste.';

create or replace function credito_residuo(n note_credito)
returns numeric
language sql
stable
set search_path = public
as $$
  select (n.importo - coalesce((select sum(u.importo)
                                  from note_credito_utilizzi u
                                 where u.nota_id = n.id), 0))::numeric(14,2);
$$;

comment on function credito_residuo(note_credito) is
  'Quanto di questa nota di credito non e'' ancora stato usato: il credito che resta con quel fornitore.';

revoke all on function note_scalate(supplier_invoices) from public, anon, authenticated;
revoke all on function da_pagare(supplier_invoices)    from public, anon, authenticated;
revoke all on function credito_residuo(note_credito)           from public, anon, authenticated;
grant execute on function note_scalate(supplier_invoices) to authenticated;
grant execute on function da_pagare(supplier_invoices)    to authenticated;
grant execute on function credito_residuo(note_credito)           to authenticated;

-- =====================================================================
-- 3. Gli invarianti — nel database, non nella schermata
-- =====================================================================
--
-- Tre cose non devono poter accadere, e nessuna delle tre e' esprimibile
-- come `check` su una riga sola:
--   · usare una nota per piu' di quanto vale;
--   · scalare su una fattura piu' di quanto la fattura vale (si
--     pagherebbe un numero negativo);
--   · cambiare cosa e' scalato su una fattura GIA' PAGATA — quel numero
--     e' uscito dalla cassa, e ritoccarlo lo scollegherebbe in silenzio
--     dal movimento che lo giustifica (stessa regola dell'importo, 16/08).

create or replace function verifica_utilizzo_credito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_riga    note_credito_utilizzi%rowtype;
  v_nota    note_credito%rowtype;
  v_inv     supplier_invoices%rowtype;
  v_usato   numeric;
  v_coperto numeric;
begin
  -- ⚠️ Non `coalesce(new, old)`: in un trigger di DELETE `new` non esiste,
  -- e in plpgsql non e' un valore nullo da coalescere — e' un riferimento
  -- che non si puo' leggere. Si sceglie prima quale riga si sta guardando.
  if tg_op = 'DELETE' then v_riga := old; else v_riga := new; end if;

  select * into v_nota from note_credito       where id = v_riga.nota_id;
  select * into v_inv  from supplier_invoices  where id = v_riga.fattura_id;
  if v_nota.id is null or v_inv.id is null then
    raise exception 'Nota di credito o fattura inesistente.';
  end if;

  -- Lo stato della fattura vale in TUTTI E TRE i versi (insert, update,
  -- delete): e' il caso che protegge i soldi gia' usciti.
  -- ⚠️ `annulla_pagamento_fattura` passa di qui e non ha scappatoie: rimette
  -- prima la fattura a «da pagare» e libera i crediti dopo. E' la stessa
  -- strada dei due storni del 16/08 — una scappatoia nel trigger sarebbe
  -- anche la strada per aggirarlo.
  if v_inv.status = 'pagata' then
    raise exception
      'La fattura % risulta gia'' pagata: le note di credito scalate non si possono piu'' cambiare, perche'' quel numero e'' gia'' uscito dalla cassa. Annulla prima il pagamento.',
      coalesce(v_inv.invoice_number, '(senza numero)');
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if v_nota.supplier_id <> v_inv.supplier_id then
    raise exception 'La nota di credito e'' di un altro fornitore rispetto alla fattura su cui la si vuole scalare.';
  end if;
  if v_nota.entity_id <> v_inv.entity_id then
    raise exception 'La nota di credito e'' di un''altra societa'' rispetto alla fattura.';
  end if;

  select coalesce(sum(u.importo), 0) into v_usato
    from note_credito_utilizzi u where u.nota_id = v_riga.nota_id;
  if v_usato > v_nota.importo then
    raise exception
      'La nota di credito vale % euro e se ne starebbero usando %: un credito non si spende due volte.',
      to_char(v_nota.importo, 'FM999999990.00'), to_char(v_usato, 'FM999999990.00');
  end if;

  select coalesce(sum(u.importo), 0) into v_coperto
    from note_credito_utilizzi u where u.fattura_id = v_riga.fattura_id;
  if v_coperto > v_inv.amount then
    raise exception
      'La fattura vale % euro e le note di credito scalate arriverebbero a %: non si paga un importo negativo.',
      to_char(v_inv.amount, 'FM999999990.00'), to_char(v_coperto, 'FM999999990.00');
  end if;

  return new;
end;
$$;

-- ⚠️ Anche una funzione trigger nasce eseguibile da chiunque abbia la
-- chiave pubblica (lezione del 15/08, §8). Nessun dato uscirebbe — fuori
-- da un trigger si rifiuta di girare — ma l'elenco degli anonimi non deve
-- crescere in silenzio, altrimenti smette di essere un controllo.
--
-- E infatti se ne è accorta da sola `tests/app/permessi.test.js`, che è
-- esattamente il lavoro per cui era stata scritta il 13/08: la prova è
-- diventata rossa nominando le due funzioni.
revoke all on function verifica_utilizzo_credito() from public, anon, authenticated;

drop trigger if exists trg_verifica_utilizzo on note_credito_utilizzi;
create trigger trg_verifica_utilizzo
  after insert or update or delete on note_credito_utilizzi
  for each row execute function verifica_utilizzo_credito();

-- L'invariante vale anche dall'altro capo: abbassare l'importo di una
-- nota gia' usata, o quello di una fattura gia' coperta, lo romperebbe
-- senza toccare la tabella degli utilizzi.
--
-- ⚠️ IL VINCOLO SALITO A MONTE (lezione del 16/08): il rifiuto arriva sul
-- gesto che lo causa — «stai abbassando questo numero» — e non dentro un
-- trigger lontano dal gesto. La schermata delle fatture lascia correggere
-- l'importo a mano: senza questo, correggere 250 in 30 su una fattura con
-- 40 di nota avrebbe prodotto un «da pagare» di −10.
create or replace function verifica_importo_ancora_capiente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usato numeric;
begin
  if tg_table_name = 'note_credito' then
    select coalesce(sum(u.importo), 0) into v_usato
      from note_credito_utilizzi u where u.nota_id = new.id;
    if new.importo < v_usato then
      raise exception
        'Questa nota di credito e'' gia'' scalata per % euro: non la si puo'' portare a %. Toglila prima dalle fatture su cui e'' stata usata.',
        to_char(v_usato, 'FM999999990.00'), to_char(new.importo, 'FM999999990.00');
    end if;
  else
    select coalesce(sum(u.importo), 0) into v_usato
      from note_credito_utilizzi u where u.fattura_id = new.id;
    if new.amount < v_usato then
      raise exception
        'Su questa fattura sono scalate note di credito per % euro: portandola a % si pagherebbe un importo negativo. Togli prima la nota di credito.',
        to_char(v_usato, 'FM999999990.00'), to_char(new.amount, 'FM999999990.00');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function verifica_importo_ancora_capiente() from public, anon, authenticated;

drop trigger if exists trg_nota_ancora_capiente on note_credito;
create trigger trg_nota_ancora_capiente
  after update of importo on note_credito
  for each row execute function verifica_importo_ancora_capiente();

drop trigger if exists trg_fattura_ancora_capiente on supplier_invoices;
create trigger trg_fattura_ancora_capiente
  after update of amount on supplier_invoices
  for each row execute function verifica_importo_ancora_capiente();

-- =====================================================================
-- 4. Registrare una nota di credito
-- =====================================================================
--
-- Due tabelle in una decisione sola (Contratto B4): la nota nasce e, se
-- la fattura che corregge e' ancora da pagare, si scala subito. E' il
-- caso normale — la nota arriva prima del pagamento — e chiedere un
-- secondo gesto per applicarla vorrebbe dire che prima o poi qualcuno
-- pagherebbe l'importo pieno con la nota registrata accanto.
create or replace function registra_nota_credito(
  p_entity_id   uuid,
  p_supplier_id uuid,
  p_data        date,
  p_importo     numeric,
  p_fattura_id  uuid default null,
  p_numero      text default null,
  p_note        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id       uuid;
  v_inv      supplier_invoices%rowtype;
  v_scalare  numeric;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare una nota di credito';
  end if;
  if p_data is null then
    raise exception 'Serve la data della nota di credito';
  end if;
  if p_importo is null or p_importo <= 0 then
    raise exception 'L''importo della nota di credito deve essere maggiore di zero';
  end if;

  if p_fattura_id is not null then
    select * into v_inv from supplier_invoices where id = p_fattura_id for update;
    if v_inv.id is null then
      raise exception 'Fattura non trovata';
    end if;
    if v_inv.supplier_id <> p_supplier_id or v_inv.entity_id <> p_entity_id then
      raise exception 'La fattura indicata e'' di un altro fornitore o di un''altra societa''.';
    end if;
  end if;

  insert into note_credito (entity_id, supplier_id, fattura_id, numero, data, importo, note)
  values (p_entity_id, p_supplier_id, p_fattura_id,
          nullif(btrim(coalesce(p_numero, '')), ''), p_data, p_importo,
          nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  -- ⚠️ Si scala SOLO se la fattura e' ancora da pagare. Se e' gia' pagata
  -- la nota resta credito: sono i due casi decisi da Alessio, e la
  -- differenza fra loro e' soltanto QUANDO e' arrivata.
  if v_inv.id is not null and v_inv.status = 'da_pagare' then
    -- ⚠️ E si scala al massimo quanto la fattura puo' assorbire: una nota
    -- da 100 su una fattura da 60 lascia 40 di credito, che restano
    -- spendibili invece di sparire.
    v_scalare := least(p_importo, da_pagare(v_inv));
    if v_scalare > 0 then
      insert into note_credito_utilizzi (nota_id, fattura_id, importo)
      values (v_id, p_fattura_id, v_scalare);
    end if;
  end if;

  return v_id;
end;
$funzione$;

comment on function registra_nota_credito(uuid, uuid, date, numeric, uuid, text, text) is
  'Registra una nota di credito e, se la fattura che corregge e'' ancora da pagare, la scala subito su di lei. Se la fattura e'' gia'' pagata la nota resta come credito verso quel fornitore.';

revoke all on function registra_nota_credito(uuid, uuid, date, numeric, uuid, text, text) from public, anon, authenticated;
grant execute on function registra_nota_credito(uuid, uuid, date, numeric, uuid, text, text) to authenticated;

-- La via di ritorno. ⚠️ Respinge se la nota e' scalata su una fattura gia'
-- pagata: quel pagamento e' stato piu' basso PROPRIO per via di questa
-- nota, e toglierla lascerebbe un'uscita che non torna col documento.
create or replace function elimina_nota_credito(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_bloccanti integer;
  v_quali     text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare una nota di credito';
  end if;

  select count(*), string_agg(coalesce(i.invoice_number, '(senza numero)'), ', ')
    into v_bloccanti, v_quali
    from note_credito_utilizzi u
    join supplier_invoices i on i.id = u.fattura_id
   where u.nota_id = p_id and i.status = 'pagata';

  if v_bloccanti > 0 then
    raise exception
      'Questa nota di credito e'' gia'' stata usata su % fattura/e pagata/e (%): quel pagamento e'' stato piu'' basso proprio per via sua, e togliendola resterebbe un''uscita che non torna col documento. Annulla prima il pagamento.',
      v_bloccanti, v_quali;
  end if;

  delete from note_credito where id = p_id;
end;
$funzione$;

revoke all on function elimina_nota_credito(uuid) from public, anon, authenticated;
grant execute on function elimina_nota_credito(uuid) to authenticated;

-- =====================================================================
-- 5. Pagare: la nota entra nel conto, e il credito si puo' usare
-- =====================================================================
--
-- ⚠️ QUANTO DI OGNI CREDITO SI USA E' CALCOLATO IN UN POSTO SOLO, e
-- questa e' la parte che non si vede ma decide. Due crediti da 30 su una
-- fattura da 40 non fanno 60: il secondo prende solo quello che il primo
-- ha lasciato. Se la schermata facesse la somma per mostrare l'anteprima,
-- direbbe «usciranno −20» e poi ne uscirebbero 0 — cioe' mentirebbe
-- proprio nel momento in cui uno guarda prima di confermare.
--
-- Quindi il taglio a cascata vive qui, `pagamento` e `anteprima` la
-- chiamano entrambi, e la schermata non fa nessun conto.
create or replace function crediti_da_applicare(p_invoice_id uuid, p_note uuid[])
returns table (nota_id uuid, numero text, importo numeric)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_inv   supplier_invoices%rowtype;
  v_resta numeric;
  r       record;
  v_usa   numeric;
begin
  if not is_titolare() then
    raise exception 'Le note di credito sono riservate al titolare.';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  v_resta := da_pagare(v_inv);

  if p_note is null then return; end if;

  -- L'ordine e' dichiarato e stabile: la nota piu' vecchia per prima, e a
  -- parita' di data l'identificativo. Senza un ordine, la stessa scelta
  -- darebbe risultati diversi da un giro all'altro.
  for r in
    select n.id, n.numero, credito_residuo(n) as disponibile
      from note_credito n
     where n.id = any(p_note)
       and n.entity_id = v_inv.entity_id
       and n.supplier_id = v_inv.supplier_id
     order by n.data, n.id
  loop
    v_usa := least(r.disponibile, v_resta);
    if v_usa > 0 then
      nota_id := r.id; numero := r.numero; importo := v_usa;
      return next;
      v_resta := v_resta - v_usa;
    end if;
  end loop;
end;
$funzione$;

revoke all on function crediti_da_applicare(uuid, uuid[]) from public, anon, authenticated;
grant execute on function crediti_da_applicare(uuid, uuid[]) to authenticated;

-- L'anteprima: gli stessi numeri che uscirebbero confermando, chiesti al
-- database invece che ricostruiti nella schermata.
create or replace function anteprima_pagamento(p_invoice_id uuid, p_note uuid[] default null)
returns table (lordo numeric, gia_scalato numeric, scalato_ora numeric, netto numeric)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_inv supplier_invoices%rowtype;
  v_ora numeric;
begin
  if not is_titolare() then
    raise exception 'Le note di credito sono riservate al titolare.';
  end if;
  select * into v_inv from supplier_invoices where id = p_invoice_id;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;

  select coalesce(sum(c.importo), 0) into v_ora from crediti_da_applicare(p_invoice_id, p_note) c;

  lordo       := v_inv.amount;
  gia_scalato := note_scalate(v_inv);
  scalato_ora := v_ora;
  netto       := da_pagare(v_inv) - v_ora;
  return next;
end;
$funzione$;

revoke all on function anteprima_pagamento(uuid, uuid[]) from public, anon, authenticated;
grant execute on function anteprima_pagamento(uuid, uuid[]) to authenticated;

-- ⚠️ Un parametro in piu' fa una funzione NUOVA: si cancella la firma
-- vecchia e si riscrive, altrimenti ogni chiamata per nome diventa
-- ambigua (42725, a tempo di esecuzione). Dopo il `drop` i permessi
-- tornano aperti al mondo: si richiudono a mano, e la verifica lo
-- controlla.
drop function if exists pay_supplier_invoice(uuid, text, date, text);

create or replace function pay_supplier_invoice(
  p_invoice_id     uuid,
  p_payment_method text,
  p_data_uscita    date default null,
  p_riferimento    text default null,
  p_note_da_usare  uuid[] default null
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
  v_netto     numeric;
  v_scalato   numeric;
  r           record;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un pagamento';
  end if;
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

  -- ⚠️ I CREDITI SI APPLICANO PRIMA di segnare pagata la fattura: il
  -- trigger del §3 rifiuta ogni movimento di credito su una fattura
  -- pagata, e ha ragione. L'ordine non e' un dettaglio, e' la regola.
  --
  -- ⚠️ E si applicano ESATTAMENTE come li ha mostrati l'anteprima: la
  -- stessa funzione, non lo stesso ragionamento riscritto qui.
  if p_note_da_usare is not null then
    -- Il blocco sulle note serve a impedire che due pagamenti in corso
    -- spendano lo stesso credito: `crediti_da_applicare` legge e basta.
    perform 1 from note_credito where id = any(p_note_da_usare) for update;

    for r in select * from crediti_da_applicare(p_invoice_id, p_note_da_usare) loop
      insert into note_credito_utilizzi (nota_id, fattura_id, importo)
      values (r.nota_id, p_invoice_id, r.importo)
      on conflict (nota_id, fattura_id)
        do update set importo = note_credito_utilizzi.importo + excluded.importo;
    end loop;

    select * into v_inv from supplier_invoices where id = p_invoice_id;
  end if;

  v_scalato := note_scalate(v_inv);
  v_netto   := da_pagare(v_inv);
  v_data    := coalesce(p_data_uscita, (now() at time zone 'Europe/Rome')::date);

  update supplier_invoices
     set status = 'pagata', paid_at = now(), payment_method = p_payment_method
   where id = p_invoice_id;

  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  v_mezzo := case when p_payment_method = 'contante' then 'cassa' else 'banca' end;
  select name into v_fornitore from suppliers where id = v_inv.supplier_id;

  -- ⚠️ SE IL NETTO E' ZERO NON SI SCRIVE NESSUN MOVIMENTO, e non e' una
  -- svista: una fattura coperta per intero da una nota di credito non fa
  -- uscire un euro da nessuna parte, e una riga da 0,00 in prima nota
  -- sarebbe un'uscita che non e' avvenuta. Il prezzo di questa scelta e'
  -- che `quadratura_pagamenti` avrebbe segnalato «pagata senza
  -- movimento» per sempre: e' corretta nel §7, nella stessa migrazione.
  if v_netto > 0 then
    insert into cash_movements (
      entity_id, direction, amount, movement_date, mezzo,
      tipo_documento, document_reference, riferimento_pagamento, business_purpose,
      supplier_invoice_id
    ) values (
      v_inv.entity_id, 'uscita', v_netto,
      v_data,
      v_mezzo,
      'fattura',
      coalesce(nullif(v_inv.document_reference, ''), v_inv.invoice_number),
      nullif(p_riferimento, ''),
      'Pagamento fattura ' || coalesce(v_inv.invoice_number, '')
        || coalesce(' — ' || v_fornitore, '')
        || case when v_scalato > 0
                then ' (' || to_char(v_inv.amount, 'FM999999990.00')
                     || ' meno ' || to_char(v_scalato, 'FM999999990.00')
                     || ' di nota di credito)'
                else '' end,
      p_invoice_id
    );
  end if;

  return p_invoice_id;
end;
$funzione$;

comment on function pay_supplier_invoice(uuid, text, date, text, uuid[]) is
  'Segna pagata una fattura, chiude il promemoria e scrive l''uscita in prima nota con la sua data vera e AL NETTO delle note di credito (17/08/2026). Se la nota copre tutta la fattura non esce niente, e nessun movimento viene scritto.';

revoke all on function pay_supplier_invoice(uuid, text, date, text, uuid[]) from public, anon, authenticated;
grant execute on function pay_supplier_invoice(uuid, text, date, text, uuid[]) to authenticated;

-- =====================================================================
-- 6. Annullare il pagamento: quali crediti tornano liberi
-- =====================================================================
--
-- ⚠️ LA REGOLA, e non e' ovvia: tornano liberi i crediti PRESI IN PRESTITO
-- da altre fatture; resta scalata la nota che corregge QUESTA fattura.
-- Il perche' e' che le due cose dicono fatti diversi: «questa fattura era
-- di 250 ma il fornitore me ne ha stornati 40» resta vero anche dopo aver
-- annullato il pagamento, mentre «ho usato qui il credito che avevo con
-- lui» era una scelta di quel pagamento, e annullandolo va disfatta —
-- altrimenti il credito resterebbe consumato su una fattura che risulta
-- di nuovo da pagare.
create or replace function annulla_pagamento_fattura(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv supplier_invoices%rowtype;
  v_mov uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' annullare un pagamento';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status <> 'pagata' then
    raise exception 'Questa fattura non risulta pagata: non c''e'' nessun pagamento da annullare.';
  end if;

  -- Prima si rimette a «da pagare», poi si tocca il resto: il trigger del
  -- §3 rifiuta ogni modifica dei crediti su una fattura pagata, e questo
  -- e' l'unico gesto che ha il diritto di disfarli.
  update supplier_invoices
     set status = 'da_pagare', paid_at = null, payment_method = null
   where id = p_invoice_id;

  if v_inv.task_id is not null then
    update tasks set status = 'da_fare' where id = v_inv.task_id;
  end if;

  delete from note_credito_utilizzi u
   where u.fattura_id = p_invoice_id
     and coalesce((select n.fattura_id from note_credito n where n.id = u.nota_id), '00000000-0000-0000-0000-000000000000'::uuid)
         is distinct from p_invoice_id;

  select id into v_mov from cash_movements where supplier_invoice_id = p_invoice_id;
  if v_mov is not null then
    update cash_movements set supplier_invoice_id = null where id = v_mov;
    delete from cash_movements where id = v_mov;
  end if;

  return p_invoice_id;
end;
$funzione$;

revoke all on function annulla_pagamento_fattura(uuid) from public, anon, authenticated;
grant execute on function annulla_pagamento_fattura(uuid) to authenticated;

-- =====================================================================
-- 7. Cancellare la fattura: il terzo effetto
-- =====================================================================
create or replace function delete_supplier_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv    supplier_invoices%rowtype;
  v_mov    cash_movements%rowtype;
  v_note   integer;
  v_credit integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare una fattura';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;

  select * into v_mov from cash_movements where supplier_invoice_id = p_invoice_id;
  if v_mov.id is not null then
    raise exception
      'Questa fattura risulta pagata: in prima nota c''e'' un''uscita di % euro del %. Cancellandola resterebbero soldi usciti senza il documento che li giustifica. Annulla prima il pagamento, poi la fattura si puo'' togliere.',
      to_char(v_mov.amount, 'FM999999990.00'),
      to_char(v_mov.movement_date, 'DD/MM/YYYY');
  end if;

  -- ⚠️ Una fattura coperta per intero da una nota di credito e' «pagata»
  -- e NON ha nessun movimento: senza questo controllo sarebbe l'unica
  -- fattura pagata cancellabile, ed e' proprio quella su cui il conto
  -- torna solo tenendo insieme i due documenti.
  if v_inv.status = 'pagata' then
    raise exception
      'Questa fattura risulta pagata (coperta per intero da note di credito, quindi senza uscita in prima nota). Annulla prima il pagamento.';
  end if;

  select count(*) into v_note from anticipazioni_socio where supplier_invoice_id = p_invoice_id;
  if v_note > 0 then
    raise exception
      'Questa fattura e'' collegata a % nota «ho messo di tasca mia»: senza la fattura quella nota diventerebbe da sola un costo, e la stessa spesa risulterebbe contata due volte. Togli prima il collegamento.',
      v_note;
  end if;

  -- L'EFFETTO 3 (17/08): le note di credito. Lo schema le tratterrebbe
  -- comunque (`restrict`), ma con un errore di chiave esterna che non
  -- dice a nessuno cosa fare. Il rifiuto leggibile sta qui, il guardiano
  -- vero resta nello schema.
  select count(*) into v_credit
    from note_credito n
   where n.fattura_id = p_invoice_id
      or exists (select 1 from note_credito_utilizzi u
                  where u.nota_id = n.id and u.fattura_id = p_invoice_id);
  if v_credit > 0 then
    raise exception
      'A questa fattura sono collegate % note di credito. Cancellandola resterebbero note che dichiarano di correggere un documento che non esiste piu''. Togli prima le note di credito.',
      v_credit;
  end if;

  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  delete from supplier_invoices where id = p_invoice_id;
end;
$funzione$;

revoke all on function delete_supplier_invoice(uuid) from public, anon, authenticated;
grant execute on function delete_supplier_invoice(uuid) to authenticated;

-- La quadratura non deve gridare su una fattura coperta per intero: e' il
-- prezzo dichiarato della scelta «netto zero, nessun movimento». Un
-- allarme permanente su un caso normale e' un allarme che si spegne.
create or replace function quadratura_pagamenti(p_dal date default null, p_al date default null)
returns table (genere text, quando date, importo numeric, descrizione text, perche text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere la quadratura dei pagamenti';
  end if;

  return query
  select 'fattura_senza_movimento'::text,
         v_inv.paid_at::date,
         v_inv.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata, ma in prima nota non c''e'' nessuna uscita collegata.'
    from supplier_invoices v_inv
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and da_pagare(v_inv) > 0
     and not exists (select 1 from cash_movements m where m.supplier_invoice_id = v_inv.id)
     and (p_dal is null or v_inv.paid_at::date >= p_dal)
     and (p_al  is null or v_inv.paid_at::date <= p_al)

  union all

  select 'movimento_senza_fattura'::text,
         m.movement_date,
         m.amount,
         coalesce(nullif(m.business_purpose, ''), 'Uscita senza descrizione'),
         'Uscita con documento «fattura» che non risulta collegata a nessuna fattura registrata.'
    from cash_movements m
   where m.direction = 'uscita'
     and m.tipo_documento = 'fattura'
     and m.supplier_invoice_id is null
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)

  order by 2 desc nulls last;
end
$funzione$;

revoke all on function quadratura_pagamenti(date, date) from public, anon, authenticated;
grant execute on function quadratura_pagamenti(date, date) to authenticated;

-- =====================================================================
-- 8. «Ce la faccio?» — si aspetta il netto, non il lordo
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

  select exists (select 1 from fiscal_settings f where f.entity_id = p_entity_id)
    into v_ha_fiscali;

  return query
  -- ⚠️ AL NETTO DELLE NOTE DI CREDITO: aspettarsi 250 quando ne usciranno
  -- 210 fa stare piu' stretti del necessario, e una previsione che sbaglia
  -- sempre nella stessa direzione si smette di guardare. La fattura
  -- coperta per intero non compare affatto — non uscira' niente.
  select 'fattura'::text, i.id,
         coalesce(i.due_date, i.invoice_date),
         ('Fattura ' || coalesce(s.name, 'fornitore') || coalesce(' n. ' || i.invoice_number, '')
           || case when note_scalate(i) > 0
                   then ' (al netto di ' || to_char(note_scalate(i), 'FM999999990.00') || ' di nota di credito)'
                   else '' end)::text,
         da_pagare(i),
         coalesce(i.payment_method, 'banca')::text
    from supplier_invoices i
    left join suppliers s on s.id = i.supplier_id
   where i.entity_id = p_entity_id
     and i.status = 'da_pagare'
     and da_pagare(i) > 0
     and coalesce(i.due_date, i.invoice_date) <= v_fino
  union all
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
-- 9. I COSTI — e il difetto che era gia' li' dentro
-- =====================================================================
--
-- 🔴 TROVATO GUARDANDO DOVE IL MANDATO DICEVA DI GUARDARE, e non c'entra
-- con le note di credito: **una fattura pagata era contata DUE VOLTE fra
-- i costi.** Le due funzioni sommano le uscite di prima nota *e* le
-- fatture fornitori; ma pagare una fattura SCRIVE un'uscita in prima nota
-- (regola del 13/08), quella uscita non ha causale, e nessun filtro la
-- escludeva. Fattura da 250 pagata → 500 di costi, e una deduzione piu'
-- alta del dovuto.
--
-- ⚠️ La guardia esisteva per le anticipazioni («con fattura e' gia'
-- contata li'») e non per il caso piu' comune di tutti. Nessuno se ne e'
-- accorto perche' in produzione non c'e' ancora nessuna fattura pagata:
-- e' un difetto che sarebbe comparso col primo pagamento vero.
--
-- ⚠️ E LA CURA NON E' SOLO ANTI-DOPPIONE: e' la COMPETENZA. Il costo sta
-- quando nasce (la data della fattura), l'uscita quando i soldi escono —
-- lo stesso principio degli stipendi (15/08) e degli assegni postdatati
-- (ieri). Una fattura di dicembre pagata a gennaio e' un costo di
-- dicembre, e contando il movimento sarebbe finita nell'anno dopo.
--
-- ⚠️ E LA NOTA DI CREDITO ENTRA COME COSTO NEGATIVO, con la sua data:
-- non si abbassa l'importo della fattura. Se si abbassasse, una nota
-- arrivata l'anno dopo cambierebbe i costi di un anno gia' chiuso.
create or replace function rettifiche_fiscali(p_entity_id uuid, p_anno integer)
returns table (
  costi_totali           numeric,
  costi_classificati     numeric,
  quota_deducibile       numeric,
  rettifica_in_aumento   numeric,
  non_classificato       numeric,
  righe_non_classificate integer,
  senza_documento        numeric,
  plafond                numeric,
  eccedenza_plafond      numeric,
  regole_non_confermate  integer,
  avvertenza             text
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_plafond numeric;
  v_ricavi  numeric;
  v_perc    numeric;
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  select annual_revenue_estimate, plafond_rappresentanza_percento
    into v_ricavi, v_perc
    from fiscal_settings where entity_id = p_entity_id;

  v_plafond := case when v_ricavi is not null and v_ricavi > 0
                    then round(v_ricavi * coalesce(v_perc, 0) / 100, 2) else null end;

  return query
  with righe as (
    select m.amount as importo,
           coalesce(m.regola_deducibilita_id, c.regola_deducibilita_id) as regola_id,
           (m.mezzo = 'cassa') as in_contante,
           (m.tipo_documento <> 'non_documentato') as documentato
      from cash_movements m
      left join cash_causali c on c.id = m.causale_id
     where m.entity_id = p_entity_id
       and m.direction = 'uscita'
       and extract(year from m.movement_date) = p_anno
       and coalesce(c.di_sistema, false) = false
       -- LA RIGA DEL §9: l'uscita che paga una fattura non e' un secondo
       -- costo, e' lo stesso costo che esce dal conto.
       and m.supplier_invoice_id is null
    union all
    select i.amount,
           coalesce(i.regola_deducibilita_id, s.regola_deducibilita_id),
           (i.payment_method = 'contante'),
           true
      from supplier_invoices i
      left join suppliers s on s.id = i.supplier_id
     where i.entity_id = p_entity_id
       and extract(year from i.invoice_date) = p_anno
    union all
    -- Le note di credito: costo negativo, con la regola che eredita dalla
    -- fattura corretta o dal fornitore.
    -- ⚠️ `in_contante` si eredita anch'esso: una regola che vieta il
    -- contante azzera la quota della fattura, e se la nota non ereditasse
    -- lo stesso trattamento sottrarrebbe da una quota che vale zero —
    -- lasciando un deducibile NEGATIVO.
    select - n.importo,
           coalesce(n.regola_deducibilita_id, f.regola_deducibilita_id, s2.regola_deducibilita_id),
           (f.payment_method = 'contante'),
           true
      from note_credito n
      left join supplier_invoices f on f.id = n.fattura_id
      left join suppliers s2 on s2.id = n.supplier_id
     where n.entity_id = p_entity_id
       and extract(year from n.data) = p_anno
    union all
    select a.importo,
           a.regola_deducibilita_id,
           (a.fondi = 'contanti'),
           (a.documento_riferimento is not null)
      from anticipazioni_socio a
     where a.entity_id = p_entity_id
       and extract(year from a.pagata_il) = p_anno
       and a.supplier_invoice_id is null
  ),
  valutate as (
    select r.importo, r.regola_id, q.quota, q.stato,
           coalesce(g.soggetta_a_plafond, false) as a_plafond
      from righe r
      cross join lateral quota_deducibile(r.importo, r.regola_id, r.in_contante, r.documentato) q
      left join regole_deducibilita g on g.id = r.regola_id
  ),
  plafonate as (
    select sum(quota) filter (where a_plafond)     as quota_plafond,
           sum(quota) filter (where not a_plafond) as quota_libera
      from valutate
  )
  select
    coalesce((select sum(importo) from valutate), 0),
    coalesce((select sum(importo) from valutate where stato <> 'da_classificare'), 0),
    coalesce((select quota_libera from plafonate), 0)
      + case when v_plafond is null then coalesce((select quota_plafond from plafonate), 0)
             else least(coalesce((select quota_plafond from plafonate), 0), v_plafond) end,
    coalesce((select sum(importo) from valutate where stato <> 'da_classificare'), 0)
      - (coalesce((select quota_libera from plafonate), 0)
         + case when v_plafond is null then coalesce((select quota_plafond from plafonate), 0)
                else least(coalesce((select quota_plafond from plafonate), 0), v_plafond) end),
    coalesce((select sum(importo) from valutate where stato = 'da_classificare'), 0),
    coalesce((select count(*) from valutate where stato = 'da_classificare'), 0)::integer,
    coalesce((select sum(importo) from valutate where stato = 'indeducibile'), 0),
    v_plafond,
    case when v_plafond is null then 0
         else greatest(coalesce((select quota_plafond from plafonate), 0) - v_plafond, 0) end,
    (select count(*)::integer from regole_deducibilita where attiva and verificata_il is null),
    (case
       when (select count(*) from valutate where stato = 'da_classificare') > 0 then
         'Attenzione: '
         || (select count(*) from valutate where stato = 'da_classificare')
         || ' voci di costo non sono ancora classificate e NON sono contate ne'' fra i deducibili ne'' fra gli indeducibili. '
         || 'L''imponibile vero sta fra quello calcolato qui e quello aumentato di tutto il non classificato.'
       else 'Tutte le voci di costo del periodo sono classificate.'
     end)
    || (case
          when (select count(*) from regole_deducibilita where attiva and verificata_il is null) > 0 then
            ' Alcune regole non sono ancora state confermate dalla commercialista (quesiti L4 e L9).'
          else '' end)
    || (case when v_plafond is null
             then ' Il plafond della rappresentanza non e'' applicato: manca la stima dei ricavi annui nel Simulatore.'
             else '' end)
    || ' Versamenti in banca, differenze di cassa e rimborsi al titolare non sono costi e non sono contati: '
    || 'quello che hai anticipato di tasca tua e'' contato una volta sola, sulla nota. '
    || 'La fattura conta una volta sola, alla sua data: l''uscita che la paga non e'' un secondo costo. '
    || 'Le note di credito sono sottratte alla loro data.';
end;
$funzione$;

revoke all on function rettifiche_fiscali(uuid, integer) from public, anon, authenticated;
grant execute on function rettifiche_fiscali(uuid, integer) to authenticated;

create or replace function costi_da_classificare(p_entity_id uuid, p_anno integer)
returns table (origine text, riga_id uuid, data date, etichetta text, importo numeric, motivo text)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'I numeri fiscali sono riservati al titolare.';
  end if;

  return query
  select 'prima_nota'::text, m.id, m.movement_date,
         coalesce(c.label, m.note, 'Uscita senza causale')::text,
         m.amount,
         case when m.tipo_documento = 'non_documentato'
              then 'Senza documento: indeducibile. Se il documento esiste, indicalo.'
              else 'Nessuna regola: ne'' sulla riga ne'' sulla causale.' end::text
    from cash_movements m
    left join cash_causali c on c.id = m.causale_id
   where m.entity_id = p_entity_id
     and m.direction = 'uscita'
     and extract(year from m.movement_date) = p_anno
     and coalesce(c.di_sistema, false) = false
     and m.supplier_invoice_id is null
     and (m.tipo_documento = 'non_documentato'
          or coalesce(m.regola_deducibilita_id, c.regola_deducibilita_id) is null)
  union all
  select 'fattura'::text, i.id, i.invoice_date,
         coalesce(s.name, 'Fornitore')::text || coalesce(' — ' || i.invoice_number, ''),
         i.amount,
         'Nessuna regola: ne'' sulla fattura ne'' sul fornitore.'::text
    from supplier_invoices i
    left join suppliers s on s.id = i.supplier_id
   where i.entity_id = p_entity_id
     and extract(year from i.invoice_date) = p_anno
     and coalesce(i.regola_deducibilita_id, s.regola_deducibilita_id) is null
  union all
  -- ⚠️ La nota compare con l'importo NEGATIVO, che e' quello che vale:
  -- scriverla positiva farebbe leggere «altri 40 euro da classificare»
  -- dove ce ne sono 40 in meno.
  select 'nota_credito'::text, n.id, n.data,
         ('Nota di credito ' || coalesce(n.numero, '(senza numero)')
           || coalesce(' — ' || s2.name, ''))::text,
         - n.importo,
         'Nessuna regola: ne'' sulla nota, ne'' sulla fattura corretta, ne'' sul fornitore.'::text
    from note_credito n
    left join supplier_invoices f on f.id = n.fattura_id
    left join suppliers s2 on s2.id = n.supplier_id
   where n.entity_id = p_entity_id
     and extract(year from n.data) = p_anno
     and coalesce(n.regola_deducibilita_id, f.regola_deducibilita_id, s2.regola_deducibilita_id) is null
  union all
  select 'anticipazione'::text, a.id, a.pagata_il,
         ('Hai messo di tasca tua — ' || t.etichetta)::text,
         a.importo,
         case when a.documento_riferimento is null
              then 'Senza documento: indeducibile. Se hai la ricevuta, indicala.'
              else 'Nessuna regola assegnata.' end::text
    from anticipazioni_socio a
    join tag_anticipazioni t on t.id = a.tag_id
   where a.entity_id = p_entity_id
     and extract(year from a.pagata_il) = p_anno
     and a.supplier_invoice_id is null
     and (a.documento_riferimento is null or a.regola_deducibilita_id is null)
  order by 3 desc;
end;
$funzione$;

revoke all on function costi_da_classificare(uuid, integer) from public, anon, authenticated;
grant execute on function costi_da_classificare(uuid, integer) to authenticated;

-- =====================================================================
-- 10. Il credito che resta: dove si vede, e cosa si propone
-- =====================================================================
create or replace function crediti_fornitore(p_entity_id uuid)
returns table (supplier_id uuid, fornitore text, residuo numeric, quante integer)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Le note di credito sono riservate al titolare.';
  end if;

  return query
  select s.id, s.name, sum(credito_residuo(n))::numeric(14,2), count(*)::integer
    from note_credito n
    join suppliers s on s.id = n.supplier_id
   where n.entity_id = p_entity_id
     and credito_residuo(n) > 0
   group by s.id, s.name
   order by 3 desc;
end;
$funzione$;

comment on function crediti_fornitore(uuid) is
  'Il credito ancora da usare, per fornitore. Si mostra accanto al «da pagare»: un credito che nessuno ricorda sono soldi persi.';

-- Cosa proporre quando si paga una fattura: le note di quel fornitore che
-- hanno ancora residuo, con QUANTO se ne potrebbe usare qui.
-- ⚠️ Il numero lo calcola il database e non lo digita nessuno: e' il
-- minore fra il residuo della nota e quel che resta da pagare.
create or replace function crediti_per_fattura(p_invoice_id uuid)
returns table (nota_id uuid, numero text, data date, importo numeric, residuo numeric, usabile numeric)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_inv supplier_invoices%rowtype;
begin
  if not is_titolare() then
    raise exception 'Le note di credito sono riservate al titolare.';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;

  return query
  select n.id, n.numero, n.data, n.importo, credito_residuo(n),
         least(credito_residuo(n), da_pagare(v_inv))
    from note_credito n
   where n.entity_id = v_inv.entity_id
     and n.supplier_id = v_inv.supplier_id
     and credito_residuo(n) > 0
     -- Quella che corregge questa fattura, se e' rimasta con del residuo,
     -- e' comunque proponibile: puo' essere avanzata da una fattura piu'
     -- piccola di lei.
   order by n.data;
end;
$funzione$;

revoke all on function crediti_fornitore(uuid) from public, anon, authenticated;
revoke all on function crediti_per_fattura(uuid) from public, anon, authenticated;
grant execute on function crediti_fornitore(uuid) to authenticated;
grant execute on function crediti_per_fattura(uuid) to authenticated;

-- =====================================================================
-- 11. I documenti collegati — la meccanica
-- =====================================================================
--
-- Il DDT, il contratto, la scheda tecnica: documenti che stanno gia'
-- nell'Archivio e che riguardano una fattura. Nessun conto ci passa
-- dentro, quindi e' un collegamento e basta.
--
-- ⚠️ `on delete set null` QUI e' giusto, e la distinzione va scritta
-- perche' il 16/08 lo stesso `set null` era il difetto: li' erano
-- l'uscita in prima nota e la nota «di tasca mia», cioe' righe che
-- CONTANO nei conti, e scollegarle cambiava i numeri in silenzio. Un DDT
-- non partecipa a nessun calcolo: se la fattura sparisce, il documento
-- resta nell'Archivio senza che nessun numero si muova.
alter table documents add column if not exists supplier_invoice_id uuid
  references supplier_invoices(id) on delete set null;

comment on column documents.supplier_invoice_id is
  'La fattura fornitore a cui questo documento e'' collegato (DDT, contratto, scheda). Solo un collegamento: nessun conto passa di qui — le note di credito, che invece contano, hanno una tabella loro.';

create index if not exists idx_documents_fattura on documents(supplier_invoice_id);

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_forn   uuid;
  v_inv    uuid;
  v_inv2   uuid;
  v_inv3   uuid;
  v_nota   uuid;
  v_nota2  uuid;
  v_doc    uuid;
  v_num    numeric;
  v_prima  numeric;
  v_dopo   numeric;
  n        integer;
  passata  boolean;
  v_anno   integer;
  v_data   date;
  v_msg    text;
  v_lapidi integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;
  -- ⚠️ Un anno tutto suo, e nel PASSATO: i costi si contano per anno, e
  -- mescolare le righe di prova con quelle vere renderebbe impossibile
  -- misurare la differenza che questa verifica produce. Nel passato e non
  -- nel futuro, per la lezione del 17/08 — il locale apre nel 2027, e una
  -- data futura oggi ha un significato (non e' ancora avvenuta).
  v_anno := 1991;
  v_data := make_date(v_anno, 6, 15);

  -- ⚠️ QUANTE LAPIDI CI SONO ADESSO, per pretendere alla fine che siano le
  -- stesse. Non «zero» e non un numero scritto a mano: la proprieta' e'
  -- che una verifica non allarga il registro delle cancellazioni (lezione
  -- del 16/08 — un guardiano dice come deve essere fatto il mondo, non
  -- com'era quando l'ho guardato).
  --
  -- Serve perche' e' proprio qui che questa verifica ha sbagliato al primo
  -- giro: `note_credito` e' sorvegliata, le note di prova venivano
  -- cancellate, e la pulizia le cercava per «__VERIFICA__» — che nel loro
  -- jsonb non c'era, perche' il marcatore stava nel nome del fornitore e
  -- non nella nota. Cinque lapidi per applicazione, invisibili.
  select count(*) into v_lapidi from deleted_records
   where table_name in ('note_credito', 'supplier_invoices', 'cash_movements');

  insert into suppliers (entity_id, name) values (v_ente, '__VERIFICA__ note credito')
    returning id into v_forn;

  -- ------------------------------------------------------------------
  -- CASO 1 — la nota arriva PRIMA: si paga la differenza.
  -- ------------------------------------------------------------------
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ 250', v_data, 250.00, 'da_pagare')
    returning id into v_inv;

  select da_pagare(i) into v_num from supplier_invoices i where i.id = v_inv;
  if v_num <> 250.00 then
    raise exception 'Senza note, da_pagare dovrebbe essere 250 ed e'' %.', v_num;
  end if;

  v_nota := registra_nota_credito(v_ente, v_forn, v_data, 40.00, v_inv, 'NC-1', '__VERIFICA__');

  select da_pagare(i) into v_num from supplier_invoices i where i.id = v_inv;
  if v_num <> 210.00 then
    raise exception 'Con la nota da 40 su una fattura da 250, da_pagare dovrebbe essere 210 ed e'' %.', v_num;
  end if;
  select credito_residuo(n2) into v_num from note_credito n2 where n2.id = v_nota;
  if v_num <> 0 then
    raise exception 'La nota applicata per intero dovrebbe avere residuo 0, ed e'' %.', v_num;
  end if;

  -- E il movimento e' di 210, non di 250.
  perform pay_supplier_invoice(v_inv, 'bonifico', v_data, 'BON-1');
  select amount into v_num from cash_movements where supplier_invoice_id = v_inv;
  if v_num <> 210.00 then
    raise exception 'L''uscita in prima nota doveva essere di 210 ed e'' di %.', v_num;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 2 — la nota arriva DOPO: diventa credito, e si usa sulla dopo.
  -- ------------------------------------------------------------------
  v_nota2 := registra_nota_credito(v_ente, v_forn, v_data, 30.00, v_inv, 'NC-2', '__VERIFICA__');
  select credito_residuo(n2) into v_num from note_credito n2 where n2.id = v_nota2;
  if v_num <> 30.00 then
    raise exception 'Una nota su una fattura gia'' pagata deve restare credito per intero (30), ed e'' %.', v_num;
  end if;
  -- Il movimento della fattura pagata NON si e' mosso: una nota arrivata
  -- dopo non riscrive un pagamento gia' avvenuto.
  select amount into v_num from cash_movements where supplier_invoice_id = v_inv;
  if v_num <> 210.00 then
    raise exception 'La nota arrivata dopo ha cambiato un pagamento gia'' avvenuto (% invece di 210).', v_num;
  end if;

  select sum(c.residuo) into v_num from crediti_fornitore(v_ente) c where c.supplier_id = v_forn;
  if v_num <> 30.00 then
    raise exception 'Il credito col fornitore doveva essere 30 ed e'' %.', v_num;
  end if;

  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ 100', v_data, 100.00, 'da_pagare')
    returning id into v_inv2;

  select p.usabile into v_num from crediti_per_fattura(v_inv2) p where p.nota_id = v_nota2;
  if v_num <> 30.00 then
    raise exception 'Su una fattura da 100 il credito da 30 e'' usabile per 30, e la proposta dice %.', v_num;
  end if;

  perform pay_supplier_invoice(v_inv2, 'bonifico', v_data, 'BON-2', array[v_nota2]);
  select amount into v_num from cash_movements where supplier_invoice_id = v_inv2;
  if v_num <> 70.00 then
    raise exception 'Usando il credito da 30 su una fattura da 100 dovevano uscire 70, e sono usciti %.', v_num;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 3 — annullare il pagamento libera il credito PRESO IN PRESTITO,
  --          e lascia scalata la nota che corregge quella fattura.
  -- ------------------------------------------------------------------
  perform annulla_pagamento_fattura(v_inv2);
  select credito_residuo(n2) into v_num from note_credito n2 where n2.id = v_nota2;
  if v_num <> 30.00 then
    raise exception 'Annullando il pagamento il credito prestato doveva tornare libero (30), ed e'' %.', v_num;
  end if;
  select da_pagare(i) into v_num from supplier_invoices i where i.id = v_inv2;
  if v_num <> 100.00 then
    raise exception 'La fattura riaperta doveva tornare a 100 da pagare, ed e'' %.', v_num;
  end if;

  perform annulla_pagamento_fattura(v_inv);
  select da_pagare(i) into v_num from supplier_invoices i where i.id = v_inv;
  if v_num <> 210.00 then
    raise exception 'La nota che CORREGGE la fattura doveva restare scalata (210 da pagare), e sono %.', v_num;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 4 — la nota piu' grande della fattura: l'avanzo non sparisce,
  --          e la fattura coperta per intero non fa uscire niente.
  -- ------------------------------------------------------------------
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ 60', v_data, 60.00, 'da_pagare')
    returning id into v_inv3;
  declare v_nota3 uuid;
  begin
    v_nota3 := registra_nota_credito(v_ente, v_forn, v_data, 100.00, v_inv3, 'NC-3', '__VERIFICA__');
    select da_pagare(i) into v_num from supplier_invoices i where i.id = v_inv3;
    if v_num <> 0 then
      raise exception 'La fattura da 60 con nota da 100 doveva restare a 0 da pagare, ed e'' %.', v_num;
    end if;
    select credito_residuo(n2) into v_num from note_credito n2 where n2.id = v_nota3;
    if v_num <> 40.00 then
      raise exception 'L''avanzo della nota doveva restare 40 di credito, ed e'' %.', v_num;
    end if;

    perform pay_supplier_invoice(v_inv3, 'bonifico', v_data, null);
    select count(*) into n from cash_movements where supplier_invoice_id = v_inv3;
    if n <> 0 then
      raise exception 'Una fattura coperta per intero non deve scrivere nessuna uscita, e ne ha scritte %.', n;
    end if;
    -- E la quadratura NON la segnala: sarebbe un allarme permanente su un
    -- caso normale, cioe' un allarme che si impara a ignorare.
    select count(*) into n from quadratura_pagamenti() q
     where q.genere = 'fattura_senza_movimento' and q.descrizione like '%__VERIFICA__ 60%';
    if n <> 0 then
      raise exception 'La quadratura segnala come anomala una fattura coperta per intero da una nota di credito.';
    end if;
    perform annulla_pagamento_fattura(v_inv3);
  end;

  -- ------------------------------------------------------------------
  -- CASO 4b — DUE crediti su una fattura piu' piccola della loro somma.
  --           E' il caso che una somma fatta in schermata sbaglierebbe:
  --           30 + 30 su 40 non fanno 60, il secondo prende solo quello
  --           che il primo ha lasciato. La prova misura che il taglio a
  --           cascata avvenga davvero, e che l'anteprima dica lo stesso
  --           numero del pagamento.
  -- ------------------------------------------------------------------
  declare
    v_inv4  uuid;
    v_na    uuid;
    v_nb    uuid;
    v_ante  numeric;
  begin
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
      values (v_ente, v_forn, '__VERIFICA__ 40', v_data, 40.00, 'da_pagare')
      returning id into v_inv4;
    v_na := registra_nota_credito(v_ente, v_forn, v_data, 30.00, null, 'NC-A', '__VERIFICA__');
    v_nb := registra_nota_credito(v_ente, v_forn, v_data + 1, 30.00, null, 'NC-B', '__VERIFICA__');

    select sum(c.importo) into v_num from crediti_da_applicare(v_inv4, array[v_na, v_nb]) c;
    if v_num <> 40.00 then
      raise exception
        'Due crediti da 30 su una fattura da 40 devono applicarsi per 40 in tutto, e fanno %.', v_num;
    end if;
    select a.netto into v_ante from anteprima_pagamento(v_inv4, array[v_na, v_nb]) a;
    if v_ante <> 0 then
      raise exception 'L''anteprima diceva che sarebbero usciti % euro invece di 0.', v_ante;
    end if;

    perform pay_supplier_invoice(v_inv4, 'bonifico', v_data, null, array[v_na, v_nb]);
    select count(*) into n from cash_movements where supplier_invoice_id = v_inv4;
    if n <> 0 then
      raise exception 'La fattura coperta da due crediti non doveva far uscire niente (movimenti: %).', n;
    end if;
    -- E il secondo credito conserva l'avanzo: 60 disponibili, 40 usati.
    select credito_residuo(n2) into v_num from note_credito n2 where n2.id = v_nb;
    if v_num <> 20.00 then
      raise exception 'Il secondo credito doveva conservare 20 di avanzo, e ne ha %.', v_num;
    end if;
    perform annulla_pagamento_fattura(v_inv4);
    -- Annullando, i due crediti prestati tornano interi.
    select credito_residuo(n2) into v_num from note_credito n2 where n2.id = v_na;
    if v_num <> 30.00 then
      raise exception 'Annullando il pagamento il primo credito doveva tornare intero, ed e'' %.', v_num;
    end if;
  end;

  -- ------------------------------------------------------------------
  -- CASO 5 — i rifiuti. Uno per uno, ognuno nel suo blocco annidato: un
  --          gestore d'eccezione unico inghiottirebbe anche gli assert.
  -- ------------------------------------------------------------------
  -- 5a. Non si spende un credito due volte.
  passata := false;
  begin
    insert into note_credito_utilizzi (nota_id, fattura_id, importo)
    values (v_nota2, v_inv2, 999.00);
    passata := true;
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%non si spende due volte%' then raise; end if;
  end;
  if passata then raise exception 'Ha lasciato usare una nota per piu'' di quanto vale.'; end if;

  -- 5b. Non si copre una fattura oltre il suo importo.
  passata := false;
  begin
    insert into note_credito_utilizzi (nota_id, fattura_id, importo)
    values (v_nota2, v_inv3, 30.00);
    passata := true;
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%importo negativo%' then raise; end if;
  end;
  if passata then raise exception 'Ha lasciato coprire una fattura oltre il suo importo.'; end if;

  -- 5c. Abbassare l'importo di una fattura sotto le note scalate.
  passata := false;
  begin
    update supplier_invoices set amount = 30.00 where id = v_inv;
    passata := true;
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%importo negativo%' then raise; end if;
  end;
  if passata then raise exception 'Ha lasciato abbassare la fattura sotto le note gia'' scalate.'; end if;

  -- 5d. Cancellare una fattura con una nota collegata.
  passata := false;
  begin
    perform delete_supplier_invoice(v_inv);
    passata := true;
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%note di credito%' then raise; end if;
  end;
  if passata then raise exception 'Ha cancellato una fattura con note di credito collegate.'; end if;

  -- 5e. Una nota si elimina finche' la fattura su cui e' scalata NON e'
  --     pagata: qui lo e', e infatti passa. Il rifiuto sull'altro caso
  --     sta al punto 6b — e ci sta li' perche' prima la fattura pagata
  --     non c'e': una prova messa nel punto sbagliato del racconto
  --     verifica un caso diverso da quello che dichiara.
  declare v_prova uuid;
  begin
    v_prova := registra_nota_credito(v_ente, v_forn, v_data, 5.00, null, 'NC-USA-E-GETTA', '__VERIFICA__');
    perform elimina_nota_credito(v_prova);
    select count(*) into n from note_credito where id = v_prova;
    if n <> 0 then raise exception 'Una nota non usata non si e'' lasciata eliminare.'; end if;
  end;

  -- ------------------------------------------------------------------
  -- CASO 6 — I COSTI. La prova che misura una DIFFERENZA.
  -- ------------------------------------------------------------------
  -- Si azzera il perimetro: tutto pagato o no, l'anno di prova contiene
  -- solo le righe di questa verifica.
  select r.costi_totali into v_prima from rettifiche_fiscali(v_ente, v_anno) r;
  -- Fatture: 250 + 100 + 60 + 40 = 450. Note: 40 + 30 + 100 + 30 + 30 = 230.
  if v_prima <> 220.00 then
    raise exception
      'I costi dell''anno di prova dovevano essere 220 (450 di fatture meno 230 di note) e sono %.', v_prima;
  end if;

  -- 🔴 LA PROVA DEL DOPPIO CONTEGGIO: pagare una fattura NON deve
  -- aggiungere un euro ai costi. Prima di questa migrazione ne aggiungeva
  -- 210, cioe' il costo compariva due volte.
  perform pay_supplier_invoice(v_inv, 'bonifico', v_data, 'BON-3');
  select r.costi_totali into v_dopo from rettifiche_fiscali(v_ente, v_anno) r;
  if v_dopo <> v_prima then
    raise exception
      'Pagare una fattura ha cambiato i costi dell''anno da % a %: il costo e'' contato due volte.',
      v_prima, v_dopo;
  end if;

  -- 6b. E ORA la fattura e' pagata: la nota che le e' scalata non si puo'
  --     piu' togliere, e il rifiuto NOMINA la via d'uscita. Un rifiuto
  --     senza gesto d'uscita e' il difetto n. 8 del mandato di correzione.
  passata := false;
  begin
    perform elimina_nota_credito(v_nota);
    passata := true;
  exception when sqlstate 'P0001' then
    v_msg := sqlerrm;
    if v_msg not like '%Annulla prima il pagamento%' then
      raise exception 'Il rifiuto non dice cosa fare per uscirne: «%»', v_msg;
    end if;
  end;
  if passata then raise exception 'Ha eliminato una nota scalata su una fattura pagata.'; end if;

  -- E la prova al contrario, che rende quella sopra discriminante: un
  -- movimento di prima nota NON legato a nessuna fattura deve invece
  -- entrare nei costi, altrimenti si sarebbe escluso troppo.
  insert into cash_movements (entity_id, direction, amount, movement_date, mezzo, tipo_documento, business_purpose)
  values (v_ente, 'uscita', 15.00, v_data, 'cassa', 'scontrino', '__VERIFICA__ spesa sciolta');
  select r.costi_totali into v_dopo from rettifiche_fiscali(v_ente, v_anno) r;
  if v_dopo <> v_prima + 15.00 then
    raise exception
      'Un''uscita senza fattura doveva alzare i costi di 15 (da % a %), e sono %.',
      v_prima, v_prima + 15.00, v_dopo;
  end if;

  -- La nota compare fra i costi da classificare, col segno giusto.
  select count(*) into n from costi_da_classificare(v_ente, v_anno) c
   where c.origine = 'nota_credito' and c.importo < 0;
  if n < 3 then
    raise exception 'Le note di credito non compaiono fra i costi da classificare col segno negativo (righe: %).', n;
  end if;

  -- ------------------------------------------------------------------
  -- CASO 7 — «Ce la faccio?» aspetta il netto.
  -- ------------------------------------------------------------------
  select m.importo into v_num from movimenti_attesi(v_ente, v_data + 400) m
   where m.origine = 'fattura' and m.riferimento = v_inv2;
  if v_num <> 100.00 then
    raise exception 'La fattura da 100 senza note scalate doveva essere attesa per 100, ed e'' %.', v_num;
  end if;
  select count(*) into n from movimenti_attesi(v_ente, v_data + 400) m
   where m.origine = 'fattura' and m.riferimento = v_inv3;
  if n <> 0 then
    raise exception 'Una fattura coperta per intero non deve comparire fra le uscite attese.';
  end if;

  -- ------------------------------------------------------------------
  -- CASO 8 — il documento collegato.
  -- ------------------------------------------------------------------
  insert into documents (entity_id, title, doc_type, document_date, supplier_invoice_id)
  values (v_ente, '__VERIFICA__ DDT 341', 'altro', v_data, v_inv2)
  returning id into v_doc;
  select count(*) into n from documents where supplier_invoice_id = v_inv2;
  if n <> 1 then raise exception 'Il documento non risulta collegato alla fattura.'; end if;

  -- ------------------------------------------------------------------
  -- CASO 9 — niente e' raggiungibile con la sola chiave pubblica.
  -- ------------------------------------------------------------------
  if has_function_privilege('anon', 'registra_nota_credito(uuid,uuid,date,numeric,uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'elimina_nota_credito(uuid)', 'execute')
     or has_function_privilege('anon', 'pay_supplier_invoice(uuid,text,date,text,uuid[])', 'execute')
     or has_function_privilege('anon', 'crediti_fornitore(uuid)', 'execute')
     or has_function_privilege('anon', 'crediti_per_fattura(uuid)', 'execute')
     or has_function_privilege('anon', 'crediti_da_applicare(uuid,uuid[])', 'execute')
     or has_function_privilege('anon', 'anteprima_pagamento(uuid,uuid[])', 'execute')
     or has_function_privilege('anon', 'da_pagare(supplier_invoices)', 'execute')
     or has_function_privilege('anon', 'credito_residuo(note_credito)', 'execute')
     or has_function_privilege('anon', 'note_scalate(supplier_invoices)', 'execute')
     -- Le due funzioni TRIGGER, che al primo giro me ne ero dimenticato.
     or has_function_privilege('anon', 'verifica_utilizzo_credito()', 'execute')
     or has_function_privilege('anon', 'verifica_importo_ancora_capiente()', 'execute') then
    raise exception 'Una delle funzioni nuove e'' rimasta eseguibile con la chiave pubblica.';
  end if;

  -- ------------------------------------------------------------------
  -- PULIZIA — si rimette il mondo come lo si e' trovato.
  -- ------------------------------------------------------------------
  delete from documents where id = v_doc;
  update supplier_invoices set status = 'da_pagare', paid_at = null, payment_method = null
   where supplier_id = v_forn;
  delete from note_credito_utilizzi
   where fattura_id in (select id from supplier_invoices where supplier_id = v_forn);
  update cash_movements set supplier_invoice_id = null
   where supplier_invoice_id in (select id from supplier_invoices where supplier_id = v_forn);
  delete from cash_movements
   where business_purpose like '%__VERIFICA__%' or document_reference like '\_\_VERIFICA\_\_%';
  delete from note_credito where supplier_id = v_forn;
  delete from tasks where id in
    (select task_id from supplier_invoices where supplier_id = v_forn and task_id is not null);
  delete from supplier_invoices where supplier_id = v_forn;
  delete from suppliers where id = v_forn;
  delete from deleted_records where record::text like '%__VERIFICA__%';
  -- E per proprieta', non per marcatore: tutto quello che apparteneva al
  -- fornitore di prova. Il marcatore si puo' dimenticare in una chiamata,
  -- l'appartenenza no.
  delete from deleted_records
   where table_name = 'note_credito' and record->>'supplier_id' = v_forn::text;

  select count(*) into n from suppliers where name like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % fornitori di prova.', n; end if;

  -- ⚠️ IL CONTROLLO CHE VALE PIU' DEGLI ALTRI: il registro delle
  -- cancellazioni deve essere tornato come era. Nessuno lo puo' ripulire
  -- dall'app, quindi una lapide finta ci resta per sempre — e una lapide
  -- finta e' indistinguibile da una vera, che e' il motivo per cui il
  -- registro esiste.
  select count(*) into n from deleted_records
   where table_name in ('note_credito', 'supplier_invoices', 'cash_movements');
  if n <> v_lapidi then
    raise exception
      'La verifica ha lasciato % lapidi nel registro delle cancellazioni (erano %, ora sono %).',
      n - v_lapidi, v_lapidi, n;
  end if;
  select count(*) into n from note_credito;
  select r.costi_totali into v_dopo from rettifiche_fiscali(v_ente, v_anno) r;
  if v_dopo <> 0 then
    raise exception 'L''anno di prova doveva tornare a zero costi, ed e'' rimasto a %.', v_dopo;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Note di credito: se arriva prima si paga la differenza, se arriva dopo resta credito. E una fattura pagata conta UNA volta fra i costi. Note di credito rimaste: %.', n;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260817000002', 'la_nota_di_credito')
on conflict (version) do nothing;

select
  (select count(*) from note_credito) as note_di_credito,
  (select count(*) from note_credito_utilizzi) as applicazioni,
  (select count(*) from documents where supplier_invoice_id is not null) as documenti_collegati,
  (select count(*) from supplier_invoices) as fatture;
