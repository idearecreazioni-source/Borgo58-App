-- =====================================================================
-- LA FATTURA E I CONTI (13/11/2026) — pezzo 5a di 5
-- =====================================================================
--
-- Piano approvato da Alessio il 13/11 («sì, approvo»), dopo due sue
-- correzioni:
--   · «la fattura non deve essere promessa: si può emettere al momento»;
--   · «non posso stare lì a digitare Incassata controllando i bonifici: si
--     riconciliano in automatico quando carico l'estratto conto».
--
-- ⚠️ LA REGOLA CHE TIENE TUTTO: UN EURO SI CONTA UNA VOLTA.
--    · Fattura dal CONTO DI UN TAVOLO: l'incasso c'è già (order_payments,
--      alla chiusura) e il ricavo pure (misure_del_mese legge i conti).
--      La fattura NON aggiunge né soldi né ricavo: segna soltanto il conto
--      «fattura fatta», col suo numero, quando la fattura prende il numero.
--    · Fattura SENZA TAVOLO (evento, catering): l'incasso entra da qui.
--        - contanti (MP01) → cassa, carta (MP08) → banca: da soli, quando
--          la fattura parte;
--        - bonifico (MP05), assegno (MP02) → quando si carica l'estratto
--          conto: un'entrata con lo stesso importo al centesimo, UNA sola
--          fattura possibile, nessun'altra entrata uguale in attesa e IL
--          NUMERO DELLA FATTURA scritto nel bonifico → incassata da sola.
--          Il solo nome del cliente NON basta (decisione di Alessio
--          dell'11-12/11 sugli avvisi della banca: da solo solo quando è
--          certo, «importo esatto + riferimento univoco»; revisione del
--          13/11: un nome come «Pasticceria» o «Mario» è troppo comune).
--          Tutto il resto resta proposto fra i movimenti da abbinare: un
--          tocco.
--    (Il ricavo delle fatture senza tavolo nella Proiezione è il pezzo 5b.)
--
-- Cosa entra:
--   1. causale «Incasso fattura» (di sistema);
--   2. cash_movements.fattura_emessa_id: un incasso per fattura, che non si
--      cancella lasciando la fattura incassata (stessa regola dei fornitori);
--   3. una fattura per conto, e solo da un conto chiuso non ancora
--      scontrinato (guardia);
--   4. la fattura numerata segna il conto «fattura fatta» (trigger);
--   5. la fattura senza tavolo pagata in contanti o carta, quando parte,
--      scrive l'incasso (trigger, che non ferma mai la spedizione);
--   6. proposte_movimento_banca: anche le fatture ai clienti, per le entrate;
--   7. incassa_fattura_da_movimento_banca, incassa_da_soli_bonifici,
--      annulla_incasso_fattura (titolare, dal corridoio).
--
-- Idempotente. Si auto-registra. Verifica annullata, zero residui.

-- ---------------------------------------------------------------------
-- 1. LA CAUSALE
-- ---------------------------------------------------------------------
insert into cash_causali (label, kind, active, di_sistema)
select 'Incasso fattura', 'entrata', true, true
 where not exists (select 1 from cash_causali where label = 'Incasso fattura' and kind = 'entrata');

-- ---------------------------------------------------------------------
-- 2. L'INCASSO LEGATO ALLA FATTURA
-- ---------------------------------------------------------------------
alter table cash_movements add column if not exists fattura_emessa_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_movements_fattura_emessa_id_fkey') then
    alter table cash_movements add constraint cash_movements_fattura_emessa_id_fkey
      foreign key (fattura_emessa_id) references fatture_emesse(id) on delete restrict;
  end if;
end $$;
comment on constraint cash_movements_fattura_emessa_id_fkey on cash_movements is
  'Questo movimento è l''incasso di una fattura ai clienti: la fattura non si può togliere finché c''è il suo incasso.';

create unique index if not exists idx_cash_movements_un_incasso_per_fattura
  on cash_movements (fattura_emessa_id) where fattura_emessa_id is not null;
comment on index idx_cash_movements_un_incasso_per_fattura is
  'Una fattura ai clienti ha un solo incasso in prima nota (13/11/2026).';

-- Il divieto di cancellare un movimento che ha un documento: ripreso da
-- 20260816000005 con un caso in più, l'incasso di una fattura ai clienti.
create or replace function vieta_delete_movimento_con_documento()
returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
declare
  v_num text;
begin
  -- Il pagamento di una fattura.
  if old.supplier_invoice_id is not null then
    select coalesce(nullif(invoice_number, ''), 'senza numero')
      into v_num from supplier_invoices where id = old.supplier_invoice_id;
    raise exception
      'Questa uscita e'' il pagamento della fattura % : togliendola, la fattura resterebbe segnata pagata senza che sia uscito un euro. Per disfare, usa «Annulla il pagamento» sulla fattura.',
      coalesce(v_num, 'collegata');
  end if;

  -- L'incasso di una fattura ai clienti (13/11/2026).
  if old.fattura_emessa_id is not null then
    select numero || '/' || anno into v_num from fatture_emesse where id = old.fattura_emessa_id;
    raise exception
      'Questa entrata e'' l''incasso della fattura % : togliendola, la fattura resterebbe incassata senza che sia entrato un euro. Per disfare, usa «Annulla l''incasso» sulla fattura.',
      coalesce(v_num, 'collegata');
  end if;

  -- Il rimborso di una nota «di tasca mia». Il vincolo `check` gia' lo
  -- impediva, ma con un errore illeggibile: qui la frase dice cosa fare.
  if exists (select 1 from anticipazioni_socio where movimento_id = old.id) then
    raise exception
      'Questa uscita e'' il rimborso di una nota «ho messo di tasca mia»: togliendola, la nota resterebbe pareggiata senza che i soldi siano usciti. Per disfare, usa «Annulla il rimborso» sulla nota.';
  end if;

  return old;
end;
$trigger$;

-- Scrivere l'incasso: l'unico posto. Nessun portiere qui dentro: la
-- chiamano solo funzioni che ce l'hanno (o i trigger), e a nessuno è
-- concessa da fuori.
create or replace function scrivi_incasso_fattura(
  p_fattura uuid, p_mezzo text, p_data date, p_conto uuid, p_riferimento text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_f    fatture_emesse%rowtype;
  v_nome text;
  v_caus uuid;
  v_cm   uuid;
begin
  if p_mezzo is null or p_mezzo not in ('cassa', 'banca') then
    raise exception 'Un incasso entra in cassa o in banca.' using errcode = 'P0001';
  end if;
  select * into v_f from fatture_emesse where id = p_fattura for update;
  if not found then
    raise exception 'Questa fattura non esiste.' using errcode = 'P0002';
  end if;
  if v_f.numero is null or v_f.totale is null then
    raise exception 'Una bozza non si incassa: la fattura prende numero e totale quando parte.' using errcode = 'P0001';
  end if;
  if v_f.order_id is not null then
    raise exception 'La fattura % viene dal conto di un tavolo: l''incasso è già quello del conto, non si conta due volte.',
      v_f.numero || '/' || v_f.anno using errcode = 'P0001';
  end if;
  if exists (select 1 from cash_movements where fattura_emessa_id = p_fattura) then
    raise exception 'La fattura % risulta già incassata.', v_f.numero || '/' || v_f.anno using errcode = 'P0001';
  end if;
  select coalesce(nullif(denominazione, ''), btrim(coalesce(nome, '') || ' ' || coalesce(cognome, '')))
    into v_nome from clienti_fattura where id = v_f.cliente_id;
  select id into v_caus from cash_causali where label = 'Incasso fattura' and kind = 'entrata';

  insert into cash_movements (
    entity_id, direction, amount, movement_date, mezzo, conto_id, causale_id,
    tipo_documento, document_reference, riferimento_pagamento, business_purpose, fattura_emessa_id
  ) values (
    v_f.entity_id, 'entrata', v_f.totale, coalesce(p_data, v_f.data), p_mezzo,
    case when p_mezzo = 'banca' then p_conto end, v_caus,
    'fattura', v_f.numero || '/' || v_f.anno, nullif(btrim(p_riferimento), ''),
    'Incasso fattura ' || v_f.numero || '/' || v_f.anno || coalesce(' — ' || nullif(v_nome, ''), ''),
    p_fattura
  ) returning id into v_cm;
  return v_cm;
end;
$fn$;

comment on function scrivi_incasso_fattura(uuid, text, date, uuid, text) is
  'Scrive in prima nota l''incasso di una fattura ai clienti senza tavolo (13/11/2026): un''entrata col suo totale, causale «Incasso fattura», legata alla fattura. Una sola per fattura, mai per una fattura dal conto di un tavolo (l''incasso c''è già). Interna: la chiamano le funzioni del titolare e i trigger.';
revoke all on function scrivi_incasso_fattura(uuid, text, date, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. UNA FATTURA PER CONTO, E SOLO DA UN CONTO CHE LA ASPETTA
-- ---------------------------------------------------------------------
create unique index if not exists idx_fatture_emesse_una_per_conto
  on fatture_emesse (order_id) where order_id is not null;
comment on index idx_fatture_emesse_una_per_conto is
  'Il conto di un tavolo ha una fattura sola (13/11/2026).';

create or replace function fattura_dal_conto_guardia()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_o orders%rowtype;
begin
  if new.order_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.order_id is not distinct from old.order_id then
    return new;
  end if;
  select * into v_o from orders where id = new.order_id;
  if not found then
    raise exception 'Il conto del tavolo di questa fattura non esiste più.' using errcode = 'P0001';
  end if;
  if v_o.status::text <> 'chiuso' then
    raise exception 'Si fattura un conto chiuso e pagato: questo è %.', v_o.status::text using errcode = 'P0001';
  end if;
  if v_o.documento_fiscale = 'scontrino' then
    raise exception 'Questo conto ha già lo scontrino: una fattura sarebbe un secondo documento per gli stessi soldi.'
      using errcode = 'P0001';
  end if;
  if v_o.documento_fiscale = 'fattura' then
    raise exception 'Questo conto risulta già fatturato (%).', coalesce(v_o.documento_numero, 'senza numero')
      using errcode = 'P0001';
  end if;
  if exists (select 1 from fatture_emesse where order_id = new.order_id and id <> new.id) then
    raise exception 'Per questo conto c''è già una fattura (anche solo in bozza): aprila da «Le fatture».'
      using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

comment on function fattura_dal_conto_guardia() is
  'Una fattura ai clienti si lega solo a un conto chiuso, non scontrinato e non già fatturato (13/11/2026).';
revoke all on function fattura_dal_conto_guardia() from public, anon, authenticated;

drop trigger if exists fattura_dal_conto_guardia on fatture_emesse;
create trigger fattura_dal_conto_guardia
  before insert or update of order_id on fatture_emesse
  for each row execute function fattura_dal_conto_guardia();

-- ---------------------------------------------------------------------
-- 4. LA FATTURA NUMERATA SEGNA IL CONTO; 5. QUELLA PAGATA SUBITO INCASSA
-- ---------------------------------------------------------------------
create or replace function fattura_emessa_effetti()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  -- 4. Il conto del tavolo diventa «fattura fatta» quando la fattura prende
  --    il numero: nella stessa transazione, prima che parta. Se non si può
  --    segnare, non parte (meglio una fattura ferma che un conto storto).
  if new.order_id is not null and old.numero is null and new.numero is not null then
    -- ⚠️ Solo se il conto aspetta ancora un documento (revisione del 13/11):
    --    fra la bozza e l'invio qualcuno può aver stampato lo scontrino, e
    --    sovrascriverlo farebbe due documenti per gli stessi soldi. In quel
    --    caso la fattura NON prende il numero e NON parte.
    update orders
       set documento_fiscale = 'fattura',
           documento_numero = new.numero || '/' || new.anno,
           documento_emesso_il = new.data
     where id = new.order_id
       and (documento_fiscale is null or documento_fiscale = 'fattura_da_emettere');
    if not found then
      raise exception 'Il conto del tavolo di questa fattura ha già un documento (scontrino o fattura): la fattura non parte. Toglila dal conto o buttala.'
        using errcode = 'P0001';
    end if;
  end if;

  -- 5. Contanti e carta: il cliente ha pagato in quel momento. L'incasso si
  --    scrive quando la fattura PARTE (inviata). ⚠️ A questo punto la mail
  --    allo SdI è già partita: un errore qui NON deve fermare niente. Si
  --    avvisa e basta, e l'incasso si registra a mano dalla banca o dalla
  --    cassa.
  if new.order_id is null and new.stato = 'inviata' and old.stato is distinct from 'inviata'
     and new.modalita_pagamento in ('MP01', 'MP08')
     and not exists (select 1 from cash_movements where fattura_emessa_id = new.id) then
    begin
      perform scrivi_incasso_fattura(new.id,
        case new.modalita_pagamento when 'MP01' then 'cassa' else 'banca' end,
        new.data, null, null);
    exception when others then
      begin
        perform segnala_allarme(
          'fattura_incasso_non_scritto',
          'La fattura ' || new.numero || '/' || new.anno || ' è partita, ma il suo incasso non si è scritto in prima nota: '
            || sqlerrm || ' Registralo a mano.',
          jsonb_build_object('fattura_id', new.id));
      exception when others then
        null;  -- l'avviso è un di più: la fattura è partita comunque
      end;
    end;
  end if;
  return null;
end;
$fn$;

comment on function fattura_emessa_effetti() is
  'Quello che una fattura ai clienti fa ai conti (13/11/2026): numerata, segna il conto del tavolo «fattura fatta»; partita senza tavolo e pagata in contanti o carta, scrive il suo incasso (un errore avvisa, non ferma).';
revoke all on function fattura_emessa_effetti() from public, anon, authenticated;

drop trigger if exists fattura_emessa_effetti on fatture_emesse;
create trigger fattura_emessa_effetti
  after update of numero, stato on fatture_emesse
  for each row execute function fattura_emessa_effetti();

-- ---------------------------------------------------------------------
-- 6. LE PROPOSTE DELLA BANCA, ANCHE PER LE FATTURE AI CLIENTI
-- ---------------------------------------------------------------------
-- I punti di un'entrata per una fattura:
--   · 3 per il NUMERO della fattura scritto nel bonifico: «fattura 12»,
--     «FT. N. 12/2027», oppure «12/2027» con l'anno intero. ⚠️ Mai dentro
--     una data: «13/11/2026» non è la fattura 11 (revisione del 13/11);
--   · 1 per il nome del cliente, a parole intere e fuori dalle parole
--     comuni («Pasticceria», «Ristorante»…): solo per ordinare le proposte.
-- Da solo si incassa SOLO col numero (incassa_da_soli_bonifici).
create or replace function punti_incasso_fattura(p_fattura uuid, p_testo text)
returns integer
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_f     fatture_emesse%rowtype;
  v_nome  text;
  v_testo text := upper(coalesce(p_testo, ''));
  v_punti integer := 0;
begin
  select * into v_f from fatture_emesse where id = p_fattura;
  if not found or v_f.numero is null then
    return 0;
  end if;
  select upper(coalesce(nullif(denominazione, ''), coalesce(nome, '') || ' ' || coalesce(cognome, '')))
    into v_nome from clienti_fattura where id = v_f.cliente_id;
  if v_testo ~ ('(FATTURA|FATT\.?|FT\.?)\s*(N\.?|NR\.?|NUM\.?|NUMERO|N°|°)?\s*0*' || v_f.numero
                 || '(\s*/\s*(' || v_f.anno || '|' || right(v_f.anno::text, 2) || '))?(?![0-9/])')
     or v_testo ~ ('(^|[^0-9/])0*' || v_f.numero || '\s*/\s*' || v_f.anno || '(?![0-9/])') then
    v_punti := v_punti + 3;
  end if;
  if exists (select 1 from regexp_split_to_table(coalesce(v_nome, ''), '[^A-Z0-9À-Ü]+') w
              where length(w) >= 4
                and w not in ('SRLS', 'SOCIETA', 'DITTA', 'STUDIO', 'GROUP', 'ITALIA', 'ITALY', 'PASTICCERIA',
                              'RISTORANTE', 'TRATTORIA', 'PIZZERIA', 'HOTEL', 'ALBERGO', 'COOPERATIVA', 'AGRICOLA',
                              'AZIENDA', 'SERVIZI', 'IMPRESA', 'CENTRO', 'ASSOCIAZIONE', 'SOCIALE', 'COMMERCIALE',
                              'GROUP', 'HOLDING', 'EVENTI', 'CATERING', 'FAMIGLIA', 'BANCA', 'BONIFICO', 'FATTURA')
                and v_testo ~ ('(^|[^A-Z0-9À-Ü])' || w || '([^A-Z0-9À-Ü]|$)')) then
    v_punti := v_punti + 1;
  end if;
  return v_punti;
end;
$fn$;

comment on function punti_incasso_fattura(uuid, text) is
  'Quanto un testo della banca indica una fattura ai clienti (13/11/2026): 3 punti per il numero della fattura (mai dentro una data), 1 per il nome del cliente a parole intere. Interna.';
revoke all on function punti_incasso_fattura(uuid, text) from public, anon, authenticated;

-- Le fatture ai clienti che un'entrata della banca può incassare: numerate,
-- senza tavolo, non incassate, stesso importo al centesimo, stessa società.
create or replace function fatture_da_incassare_per(p_movimento uuid)
returns table (fattura_id uuid, titolo text, importo numeric, data date, punti integer)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_testo  text;
begin
  select * into v_m from movimenti_banca where id = p_movimento;
  if not found or v_m.importo <= 0 then
    return;
  end if;
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  v_testo := v_m.descrizione || ' ' || coalesce(v_m.dettagli, '');
  return query
  select fe.id,
         ('Fattura ' || fe.numero || '/' || fe.anno || ' — '
           || coalesce(nullif(c.denominazione, ''), btrim(coalesce(c.nome, '') || ' ' || coalesce(c.cognome, '')))
           || ' del ' || to_char(fe.data, 'DD/MM/YYYY'))::text,
         fe.totale, fe.data, punti_incasso_fattura(fe.id, v_testo)
    from fatture_emesse fe
    join clienti_fattura c on c.id = fe.cliente_id
   where fe.entity_id = v_entita
     and fe.numero is not null
     -- partite davvero: una «da inviare» o una scartata non si incassano da sole
     and fe.stato in ('inviata', 'consegnata', 'messa_a_disposizione')
     and fe.order_id is null
     and fe.totale = v_m.importo
     and not exists (select 1 from cash_movements cm where cm.fattura_emessa_id = fe.id);
end;
$fn$;
comment on function fatture_da_incassare_per(uuid) is
  'Le fatture ai clienti che un''entrata della banca può incassare, coi loro punti (13/11/2026). Interna.';
revoke all on function fatture_da_incassare_per(uuid) from public, anon, authenticated;

-- Ripresa da 20261024000001 con un genere in più: 'fattura_emessa'.
create or replace function proposte_movimento_banca(p_movimento uuid)
returns table (genere text, rif_id uuid, titolo text, importo numeric, data date, punti integer)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_testo  text;
begin
  if not is_titolare() then
    raise exception 'Le proposte di abbinamento sono riservate al titolare.';
  end if;
  select * into v_m from movimenti_banca where id = p_movimento;
  if v_m.id is null then
    raise exception 'Movimento della banca non trovato.';
  end if;
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  v_testo := upper(v_m.descrizione || ' ' || coalesce(v_m.dettagli, ''));

  return query
  select 'fattura'::text, si.id,
         ('Fattura ' || coalesce(si.invoice_number, 's.n.') || ' — ' || s.name
           || ' del ' || to_char(si.invoice_date, 'DD/MM/YYYY'))::text,
         da_pagare(si), si.invoice_date,
         ( case when exists (
               select 1 from regexp_split_to_table(upper(s.name), '[^A-Z0-9]+') w
                where length(w) >= 4 and w not in ('SRLS', 'SOCIETA', 'SNC', 'SPA')
                  and position(w in v_testo) > 0) then 2 else 0 end
         + case when si.invoice_number is not null
                 and length(regexp_replace(upper(si.invoice_number), '[^A-Z0-9]', '', 'g')) >= 3
                 and position(left(regexp_replace(upper(si.invoice_number), '[^A-Z0-9]', '', 'g'), 5)
                              in regexp_replace(v_testo, '[^A-Z0-9]', '', 'g')) > 0 then 2 else 0 end
         + case when v_m.iban_controparte is not null and position(v_m.iban_controparte in coalesce(si.note, '')) > 0 then 1 else 0 end
         )::integer
    from supplier_invoices si
    join suppliers s on s.id = si.supplier_id
   where v_m.importo < 0
     and si.entity_id = v_entita
     and si.status::text <> 'pagata'
     and da_pagare(si) = -v_m.importo
  union all
  -- Le fatture ai clienti (13/11/2026), per le entrate.
  select 'fattura_emessa'::text, d.fattura_id, d.titolo, d.importo, d.data, d.punti
    from fatture_da_incassare_per(p_movimento) d
  union all
  select 'movimento'::text, cm.id,
         (coalesce(nullif(cm.business_purpose, ''), cc.label, 'Movimento')
           || ' del ' || to_char(cm.movement_date, 'DD/MM/YYYY'))::text,
         cm.amount, cm.movement_date,
         (3 - abs(cm.movement_date - v_m.data_contabile) / 3)::integer
    from cash_movements cm
    left join cash_causali cc on cc.id = cm.causale_id
   where cm.entity_id = v_entita
     and cm.mezzo = 'banca'
     and (cm.conto_id is null or cm.conto_id = v_m.conto_id)
     and cm.direction::text = case when v_m.importo < 0 then 'uscita' else 'entrata' end
     and cm.amount = abs(v_m.importo)
     and abs(cm.movement_date - v_m.data_contabile) <= 7
     and not exists (select 1 from movimenti_banca mb where mb.cash_movement_id = cm.id)
   order by 6 desc, 5;
end $fn$;
comment on function proposte_movimento_banca(uuid) is
  'Per un movimento della banca, le fatture d''acquisto non pagate, le fatture ai clienti da incassare e i movimenti di prima nota con lo stesso importo al centesimo che potrebbero corrispondergli, i più probabili prima. Propone soltanto: abbinare lo decide Alessio (o, per un bonifico con una sola fattura e un indizio, incassa_da_soli_bonifici).';
revoke all on function proposte_movimento_banca(uuid) from public, anon, authenticated;
grant execute on function proposte_movimento_banca(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. I GESTI: INCASSARE DALLA BANCA, DA SOLI, E DISFARE
-- ---------------------------------------------------------------------
create or replace function incassa_fattura_da_movimento_banca(p_movimento uuid, p_fattura uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_m      movimenti_banca%rowtype;
  v_entita uuid;
  v_f      fatture_emesse%rowtype;
  v_cm     uuid;
begin
  -- Il portiere, scritto qui e non solo dentro l'aiuto comune.
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.' using errcode = '42501';
  end if;
  v_m := movimento_banca_da_abbinare(p_movimento);
  if v_m.importo <= 0 then
    raise exception 'Questo movimento e'' un''uscita: non incassa una fattura.' using errcode = 'P0001';
  end if;
  select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
  select * into v_f from fatture_emesse where id = p_fattura;
  if not found then
    raise exception 'Fattura non trovata.' using errcode = 'P0002';
  end if;
  if v_f.entity_id is distinct from v_entita then
    raise exception 'La fattura e il conto appartengono a due societa'' diverse.' using errcode = 'P0001';
  end if;
  if v_f.totale is distinct from v_m.importo then
    raise exception 'Il bonifico e'' di % e la fattura e'' di %: non si abbinano importi diversi.',
      euro(v_m.importo), euro(v_f.totale) using errcode = 'P0001';
  end if;
  v_cm := scrivi_incasso_fattura(p_fattura, 'banca', v_m.data_contabile, v_m.conto_id, v_m.riferimento_banca);
  update movimenti_banca set cash_movement_id = v_cm where id = v_m.id;
  return jsonb_build_object('cash_movement_id', v_cm);
end;
$fn$;
comment on function incassa_fattura_da_movimento_banca(uuid, uuid) is
  'Un''entrata della banca incassa una fattura ai clienti (13/11/2026): scrive l''incasso in prima nota, in banca, e lo abbina al movimento. Solo il titolare, dal corridoio.';
revoke all on function incassa_fattura_da_movimento_banca(uuid, uuid) from public, anon;
grant execute on function incassa_fattura_da_movimento_banca(uuid, uuid) to authenticated;

-- Dopo aver caricato l'estratto conto: ogni entrata da abbinare con UNA
-- sola fattura possibile e un indizio nel testo, e nessun movimento di
-- prima nota che potrebbe essere lei, si incassa da sola.
create or replace function incassa_da_soli_bonifici()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_m       record;
  v_cand    record;
  v_quante  integer;
  v_altri   integer;
  v_fatte   jsonb := '[]'::jsonb;
  v_saltate integer := 0;
  v_entita  uuid;
begin
  if not is_titolare() then
    raise exception 'Abbinare i movimenti della banca e'' riservato al titolare.' using errcode = '42501';
  end if;

  for v_m in
    select * from movimenti_banca
     where importo > 0 and cash_movement_id is null and ignorato_il is null
     order by data_contabile, id
  loop
    select count(*) into v_quante from fatture_da_incassare_per(v_m.id);
    if v_quante <> 1 then
      continue;
    end if;
    select * into v_cand from fatture_da_incassare_per(v_m.id) limit 1;
    -- Solo col NUMERO della fattura nel bonifico (3 punti): il nome da solo no.
    if v_cand.punti < 3 then
      continue;
    end if;
    -- Un'altra entrata uguale in attesa potrebbe essere lei: decide Alessio.
    if exists (select 1 from movimenti_banca o join conti_bancari c on c.id = o.conto_id
                where o.id <> v_m.id and o.importo = v_m.importo and o.cash_movement_id is null
                  and o.ignorato_il is null
                  and c.entity_id = (select entity_id from conti_bancari where id = v_m.conto_id)) then
      continue;
    end if;
    -- Un movimento di prima nota già scritto con lo stesso importo potrebbe
    -- essere lui: in quel caso decide Alessio.
    select entity_id into v_entita from conti_bancari where id = v_m.conto_id;
    select count(*) into v_altri from cash_movements cm
     where cm.entity_id = v_entita and cm.mezzo = 'banca' and cm.direction::text = 'entrata'
       and (cm.conto_id is null or cm.conto_id = v_m.conto_id)
       and cm.amount = v_m.importo and abs(cm.movement_date - v_m.data_contabile) <= 7
       and not exists (select 1 from movimenti_banca mb where mb.cash_movement_id = cm.id);
    if v_altri > 0 then
      continue;
    end if;
    -- Un guasto su un'entrata non disfa le altre già incassate.
    begin
      perform incassa_fattura_da_movimento_banca(v_m.id, v_cand.fattura_id);
      v_fatte := v_fatte || jsonb_build_object('fattura', v_cand.titolo, 'importo', v_cand.importo,
                                               'data', v_m.data_contabile);
    exception when others then
      v_saltate := v_saltate + 1;
    end;
  end loop;

  return jsonb_build_object('incassate', jsonb_array_length(v_fatte), 'elenco', v_fatte, 'saltate', v_saltate);
end;
$fn$;
comment on function incassa_da_soli_bonifici() is
  'Dopo il caricamento dell''estratto conto (13/11/2026): ogni entrata da abbinare con una sola fattura ai clienti possibile (stesso importo al centesimo), il NUMERO della fattura nel testo, nessun''altra entrata uguale in attesa e nessun movimento di prima nota che potrebbe essere lei, incassa la fattura da sola. Il resto resta proposto. Solo il titolare, dal corridoio.';
revoke all on function incassa_da_soli_bonifici() from public, anon;
grant execute on function incassa_da_soli_bonifici() to authenticated;

-- L'incasso a mano: per una fattura senza tavolo il cui incasso non si è
-- scritto da solo (annullato, o il trigger ha avvisato), o un bonifico che
-- non passerà dall'estratto conto. Cassa per i contanti, banca per il resto.
create or replace function incassa_fattura_a_mano(p_fattura uuid, p_data date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_mod text;
  v_cm  uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare segna incassata una fattura.' using errcode = '42501';
  end if;
  select modalita_pagamento into v_mod from fatture_emesse where id = p_fattura;
  if v_mod is null then
    raise exception 'Questa fattura non esiste.' using errcode = 'P0002';
  end if;
  v_cm := scrivi_incasso_fattura(p_fattura, case when v_mod = 'MP01' then 'cassa' else 'banca' end,
                                 coalesce(p_data, oggi_a_roma()), null, null);
  return jsonb_build_object('cash_movement_id', v_cm);
end;
$fn$;
comment on function incassa_fattura_a_mano(uuid, date) is
  'Segna incassata a mano una fattura ai clienti senza tavolo (13/11/2026): contanti in cassa, il resto in banca. Per quando l''incasso non si è scritto da solo. Solo il titolare, dal corridoio.';
revoke all on function incassa_fattura_a_mano(uuid, date) from public, anon;
grant execute on function incassa_fattura_a_mano(uuid, date) to authenticated;

create or replace function annulla_incasso_fattura(p_fattura uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_cm cash_movements%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare annulla un incasso.' using errcode = '42501';
  end if;
  select * into v_cm from cash_movements where fattura_emessa_id = p_fattura for update;
  if not found then
    raise exception 'Questa fattura non risulta incassata.' using errcode = 'P0001';
  end if;
  -- Scollegare PRIMA e cancellare DOPO: la regola dei documenti con effetto.
  update movimenti_banca set cash_movement_id = null where cash_movement_id = v_cm.id;
  update cash_movements set fattura_emessa_id = null where id = v_cm.id;
  delete from cash_movements where id = v_cm.id;
end;
$fn$;
comment on function annulla_incasso_fattura(uuid) is
  'Disfa l''incasso di una fattura ai clienti (13/11/2026): il movimento della banca torna da abbinare e l''entrata sparisce dalla prima nota. Solo il titolare, dal corridoio.';
revoke all on function annulla_incasso_fattura(uuid) from public, anon;
grant execute on function annulla_incasso_fattura(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
--   (1) la fattura dal conto di un tavolo: numerata, il conto è «fattura
--       fatta» col numero; partita, NESSUN incasso in più;
--   (2) un conto scontrinato non si fattura; un conto ha una fattura sola;
--   (3) senza tavolo, contanti: partita → incasso in cassa, uno solo;
--   (4) senza tavolo, bonifico: nessun incasso alla partenza; col solo
--       nome del cliente l'entrata resta PROPOSTA; col numero della fattura
--       la incassa DA SOLA; una data non vale come numero;
--   (5) due fatture con lo stesso importo: niente da solo, due proposte;
--   (6) annulla l'incasso: il movimento della banca torna da abbinare;
--   (7) l'incasso non si cancella da solo; lo staff non incassa;
--   (8) le frasi.
do $verifica$
declare
  v_foto      jsonb := foto_righe();
  v_titolare  uuid;
  v_staff     uuid;
  v_srls      uuid;
  v_conto     uuid;
  v_cli       uuid;
  v_ord       uuid;
  v_ord2      uuid;
  v_f         uuid;
  v_g         uuid;
  v_h         uuid;
  v_k         uuid;
  v_p         jsonb;
  v_mb        uuid;
  v_mb2       uuid;
  v_r         jsonb;
  v_ok        boolean;
  v_prima     integer;
  v_cassa     uuid;
  v_num       text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  select id into v_srls from entities where entity_type = 'srls' limit 1;
  if v_titolare is null or v_srls is null then
    raise exception 'VERIFICA: servono un titolare e Borgo 58.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    update entities set vat_number = '01343950869', legal_name = 'Borgo 58 S.r.l.s.',
           sede_indirizzo = 'Via Prova 58', sede_cap = '84043', sede_comune = 'Agropoli', sede_provincia = 'SA'
     where id = v_srls;
    -- Un conto in banca tutto suo, attivo e unico per la verifica; le
    -- entrate vere in attesa messe da parte (si annulla tutto alla fine).
    update conti_bancari set attivo = false where entity_id = v_srls;
    update movimenti_banca set ignorato_il = now(), ignorato_perche = 'ZZ verifica'
     where cash_movement_id is null and ignorato_il is null;
    insert into conti_bancari (entity_id, nome) values (v_srls, 'ZZ Conto della verifica') returning id into v_conto;

    -- Due conti di tavolo chiusi, «fattura da emettere» e «scontrino».
    insert into orders (entity_id, table_label, coperti, status, closed_at, documento_fiscale)
    values (v_srls, 'ZZ1', 2, 'chiuso', now(), 'fattura_da_emettere') returning id into v_ord;
    insert into orders (entity_id, table_label, coperti, status, closed_at, documento_fiscale, documento_numero, documento_emesso_il)
    values (v_srls, 'ZZ2', 2, 'chiuso', now(), 'scontrino', 'ZZ-1', oggi_a_roma()) returning id into v_ord2;

    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into clienti_fattura (denominazione, partita_iva, indirizzo, cap, comune, provincia)
    values ('ZZ Pasticceria Lombardi srl', '01234567897', 'Via Prova 7', '84043', 'Agropoli', 'SA')
    returning id into v_cli;
    select count(*) into v_prima from cash_movements;

    -- (1) dal conto del tavolo, pagata con la carta al tavolo
    insert into fatture_emesse (entity_id, cliente_id, data, order_id, modalita_pagamento)
    values (v_srls, v_cli, oggi_a_roma(), v_ord, 'MP08') returning id into v_f;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_f, 1, 'ZZ Cena', 2, 55.00);
    v_p := prepara_invio_fattura(v_f);
    if not exists (select 1 from orders where id = v_ord and documento_fiscale = 'fattura'
                     and documento_numero = (v_p->>'numero') || '/' || (v_p->>'anno')
                     and documento_emesso_il = oggi_a_roma()) then
      raise exception 'VERIFICA (1): la fattura numerata non ha segnato il conto del tavolo «fattura fatta».';
    end if;
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    if (select count(*) from cash_movements) <> v_prima then
      raise exception 'VERIFICA (1): una fattura dal conto di un tavolo ha scritto un incasso: sarebbe contato due volte.';
    end if;

    -- (2) scontrinato no; seconda fattura per lo stesso conto no
    v_ok := false;
    begin
      insert into fatture_emesse (entity_id, cliente_id, order_id) values (v_srls, v_cli, v_ord2);
    exception when others then
      v_ok := sqlerrm like 'Questo conto ha già lo scontrino%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (2): un conto scontrinato si è potuto fatturare.';
    end if;
    v_ok := false;
    begin
      insert into fatture_emesse (entity_id, cliente_id, order_id) values (v_srls, v_cli, v_ord);
    exception when others then
      v_ok := sqlerrm like 'Questo conto risulta già fatturato%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (2): un conto già fatturato ha preso una seconda fattura.';
    end if;

    -- (3) senza tavolo, contanti
    insert into fatture_emesse (entity_id, cliente_id, data, modalita_pagamento)
    values (v_srls, v_cli, oggi_a_roma(), 'MP01') returning id into v_g;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_g, 1, 'ZZ Buffet', 1, 80.00);
    v_p := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    if (select count(*) from cash_movements where fattura_emessa_id = v_g and mezzo = 'cassa'
          and direction::text = 'entrata' and amount = 80.00) <> 1 then
      raise exception 'VERIFICA (3): la fattura in contanti partita non ha scritto il suo incasso in cassa.';
    end if;

    v_cassa := v_g;
    -- (4) senza tavolo, bonifico: niente alla partenza, poi da solo
    insert into fatture_emesse (entity_id, cliente_id, data, modalita_pagamento)
    values (v_srls, v_cli, oggi_a_roma(), 'MP05') returning id into v_h;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_h, 1, 'ZZ Catering', 1, 321.45);
    v_p := prepara_invio_fattura(v_h);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    if exists (select 1 from cash_movements where fattura_emessa_id = v_h) then
      raise exception 'VERIFICA (4): una fattura con bonifico si è incassata da sola alla partenza.';
    end if;
    v_num := (v_p->>'numero') || '/' || (v_p->>'anno');
    reset role;  -- punti_incasso_fattura è interna: la si interroga da proprietario
    -- (4a) il solo nome del cliente (e una data che contiene il numero): proposta, NON da solo
    if punti_incasso_fattura(v_h, 'BONIFICO DEL 13/' || lpad(v_p->>'numero', 2, '0') || '/' || (v_p->>'anno')) <> 0
       or punti_incasso_fattura(v_h, 'ORDINANTE: PASTICCERIA LOMBARDI SRL') <> 1
       or punti_incasso_fattura(v_h, 'SALDO FATTURA N. ' || v_num) < 3
       or punti_incasso_fattura(v_h, 'FT ' || (v_p->>'numero')) < 3 then
      raise exception 'VERIFICA (4a): i punti non distinguono il numero della fattura da una data o dal solo nome.';
    end if;
    insert into movimenti_banca (conto_id, impronta, flusso, data_contabile, data_valuta, importo, descrizione)
    values (v_conto, 'ZZ-1', 'ZZ verifica', oggi_a_roma(), oggi_a_roma(), 321.45,
            'BONIFICO A VOSTRO FAVORE rif. banca: 1; Ordinante: PASTICCERIA LOMBARDI SRL; ulteriori descrizioni: SALDO')
    returning id into v_mb;
    set local role authenticated;
    v_r := incassa_da_soli_bonifici();
    if (v_r->>'incassate')::integer <> 0
       or (select count(*) from proposte_movimento_banca(v_mb) where genere = 'fattura_emessa') <> 1 then
      raise exception 'VERIFICA (4a): col solo nome del cliente si è incassato da solo, o non c''è la proposta: %', v_r;
    end if;
    -- (4b) col numero della fattura: da solo
    reset role;
    update movimenti_banca set descrizione = descrizione || ' FATTURA N. ' || v_num where id = v_mb;
    set local role authenticated;
    v_r := incassa_da_soli_bonifici();
    if (v_r->>'incassate')::integer <> 1
       or not exists (select 1 from movimenti_banca mb join cash_movements cm on cm.id = mb.cash_movement_id
                       where mb.id = v_mb and cm.fattura_emessa_id = v_h and cm.mezzo = 'banca'
                         and cm.conto_id = v_conto and cm.amount = 321.45) then
      raise exception 'VERIFICA (4b): il bonifico col numero della fattura non l''ha incassata da sola: %', v_r;
    end if;

    -- (5) due fatture con lo stesso importo: niente da solo, due proposte
    insert into fatture_emesse (entity_id, cliente_id, data, modalita_pagamento)
    values (v_srls, v_cli, oggi_a_roma(), 'MP05') returning id into v_k;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_k, 1, 'ZZ Sala', 1, 150.00);
    v_p := prepara_invio_fattura(v_k);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    insert into fatture_emesse (entity_id, cliente_id, data, modalita_pagamento)
    values (v_srls, v_cli, oggi_a_roma(), 'MP05') returning id into v_g;
    insert into fatture_emesse_righe (fattura_id, posizione, descrizione, quantita, prezzo_unitario)
    values (v_g, 1, 'ZZ Sala bis', 1, 150.00);
    v_p := prepara_invio_fattura(v_g);
    perform chiudi_invio_fattura((v_p->>'invio_id')::uuid, 'partito', '<ZZ/>', null);
    reset role;
    insert into movimenti_banca (conto_id, impronta, flusso, data_contabile, data_valuta, importo, descrizione)
    values (v_conto, 'ZZ-2', 'ZZ verifica', oggi_a_roma(), oggi_a_roma(), 150.00,
            'BONIFICO A VOSTRO FAVORE Ordinante: LOMBARDI FATTURA ' || (v_p->>'numero'))
    returning id into v_mb2;
    set local role authenticated;
    v_r := incassa_da_soli_bonifici();
    if (v_r->>'incassate')::integer <> 0
       or (select count(*) from proposte_movimento_banca(v_mb2) where genere = 'fattura_emessa') <> 2 then
      raise exception 'VERIFICA (5): con due fatture possibili si è incassato da solo, o le proposte non sono due: %', v_r;
    end if;

    -- (6) annulla l'incasso
    perform annulla_incasso_fattura(v_h);
    if exists (select 1 from cash_movements where fattura_emessa_id = v_h)
       or (select cash_movement_id from movimenti_banca where id = v_mb) is not null then
      raise exception 'VERIFICA (6): annullare l''incasso non ha liberato il movimento della banca.';
    end if;

    -- (7) l'incasso non si cancella a mano; lo staff non incassa
    reset role;
    v_ok := false;
    begin
      delete from cash_movements where fattura_emessa_id = v_cassa;
    exception when others then
      v_ok := sqlerrm like 'Questa entrata e'' l''incasso della fattura%';
    end;
    if not v_ok then
      raise exception 'VERIFICA (7): l''incasso di una fattura si è cancellato senza «Annulla l''incasso».';
    end if;
    if v_staff is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_ok := false;
      begin
        perform incassa_fattura_da_movimento_banca(v_mb, v_h);
      exception when insufficient_privilege then
        v_ok := true;
      end;
      if not v_ok then
        raise exception 'VERIFICA (7): lo staff ha incassato una fattura.';
      end if;
      reset role;
    end if;

    -- (8) le frasi
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if exists (select 1 from vincoli_senza_frase() v where v.conname = 'cash_movements_fattura_emessa_id_fkey') then
      raise exception 'VERIFICA (8): il vincolo nuovo è senza frase.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della fattura e i conti');

  raise notice 'Fatto: la fattura dal tavolo segna il conto e non aggiunge soldi; contanti e carta si incassano quando parte; il bonifico col nome del cliente si incassa da solo, due fatture uguali restano proposte; l''incasso si annulla e non si cancella a mano; lo staff non incassa. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261113000007', 'la_fattura_e_i_conti')
on conflict (version) do nothing;
