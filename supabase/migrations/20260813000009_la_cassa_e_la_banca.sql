-- =====================================================================
-- «Cassa, Banca e Prima Nota» — e finalmente c'è anche la banca
-- =====================================================================
-- Rilievo n. 1 del referto del 13/08/2026, il più grave dei sette.
--
-- Il modulo si chiama così nella schermata da sempre, ma dentro esisteva
-- **solo il contante**: un movimento non aveva modo di dire se era
-- passato dal cassetto o dal conto corrente, e il saldo — quello che il
-- gestionale chiama «contante atteso» — sommava tutto.
--
-- Cosa sarebbe successo il primo giorno vero: Alessio paga un fornitore
-- con un bonifico da 300 € e lo registra (deve: è prima nota). Il
-- gestionale toglie 300 € dal cassetto, dove non è uscito niente. A fine
-- serata la conta non torna, **e non torna per un motivo che non è un
-- errore di cassa** — cioè nel modo peggiore, perché manda a cercare un
-- ammanco che non esiste. Se invece non lo registra per non sballare il
-- conto, la prima nota è incompleta: cioè il registro che deve essere
-- completo. Qualunque cosa facesse, uno dei due numeri era falso.
--
-- ⚠️ SI FA ADESSO PROPRIO PERCHÉ IL CONTO CORRENTE NON È ANCORA APERTO.
-- La tabella dei movimenti è vuota: aggiungere la colonna costa una
-- migrazione. Farlo fra sei mesi vorrebbe dire decidere cosa scrivere su
-- trecento righe registrate senza quel dato — e la risposta onesta
-- sarebbe «non lo so», su righe che sembrano complete.
--
-- ⚠️ PERCHÉ `text` CON UN VINCOLO E NON UN ENUM: perché domani arriverà
-- il POS, e un incasso con carta non è contante né è già in banca. Con un
-- enum aggiungere un valore è una migrazione che non si può nemmeno usare
-- nello stesso file in cui la si scrive (trappola di `CLAUDE.md` §8);
-- così è una riga nel vincolo. Il caso «carta» NON viene inventato ora:
-- si aggiunge quando il POS esiste e si sa come si comporta.
--
-- Cosa questa migrazione NON fa, e va detto: non è una riconciliazione
-- bancaria. Non legge estratti conto, non spunta i movimenti, non sa
-- quante commissioni hai pagato. Serve a non far più dire al gestionale
-- una cosa falsa sul contante — il resto si progetta quando il conto
-- esiste davvero e si vede come arrivano i dati.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Da dove è passato questo movimento
-- ---------------------------------------------------------------------
alter table cash_movements
  add column if not exists mezzo text not null default 'cassa';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_movements_mezzo_valido') then
    alter table cash_movements add constraint cash_movements_mezzo_valido
      check (mezzo in ('cassa', 'banca'));
  end if;
end
$$;

comment on column cash_movements.mezzo is
  'Da dove e'' passato il denaro: «cassa» (il cassetto) o «banca» (il conto corrente). Il valore predefinito e'' cassa perche'' fino al 13/08/2026 il modulo trattava tutto come contante: le righe scritte prima erano contanti per costruzione.';

create index if not exists idx_cash_movements_mezzo on cash_movements (entity_id, mezzo);

-- ---------------------------------------------------------------------
-- 2. Due saldi, non uno
-- ---------------------------------------------------------------------
-- ⚠️ `create or replace view` accetta solo colonne AGGIUNTE in fondo
-- (42P16). Le quattro esistenti restano dove sono e con lo stesso
-- significato — con una precisazione che prima era implicita e sbagliata:
-- `balance` adesso e' **il solo contante**, che e' cio' che quel numero
-- ha sempre dichiarato di essere.
create or replace view v_cash_balance as
select e.id as entity_id,
       e.name as entity_name,
       coalesce(sum(case when m.mezzo = 'cassa' and m.direction = 'entrata' then m.amount
                         when m.mezzo = 'cassa' then -m.amount else 0 end), 0)::numeric(14,2) as balance,
       coalesce(sum(case when m.mezzo = 'cassa' and m.is_owner_injection then m.amount
                         else 0 end), 0)::numeric(14,2) as owner_float,
       coalesce(sum(case when m.mezzo = 'cassa' and m.direction = 'entrata'
                          and not m.is_owner_injection then m.amount else 0 end), 0)::numeric(14,2) as declared_takings,
       coalesce(sum(case when m.mezzo = 'cassa' and m.direction = 'uscita' then m.amount
                         else 0 end), 0)::numeric(14,2) as total_out,
       -- Le colonne nuove, in fondo.
       coalesce(sum(case when m.mezzo = 'banca' and m.direction = 'entrata' then m.amount
                         when m.mezzo = 'banca' then -m.amount else 0 end), 0)::numeric(14,2) as saldo_banca,
       coalesce(sum(case when m.mezzo = 'banca' and m.direction = 'entrata' then m.amount
                         else 0 end), 0)::numeric(14,2) as entrate_banca,
       coalesce(sum(case when m.mezzo = 'banca' and m.direction = 'uscita' then m.amount
                         else 0 end), 0)::numeric(14,2) as uscite_banca
  from entities e
  left join cash_movements m on m.entity_id = e.id
 group by e.id, e.name;

comment on view v_cash_balance is
  'Due saldi separati: `balance` e'' il CONTANTE atteso nel cassetto (e finalmente e'' solo quello), `saldo_banca` e'' il conto corrente. Sommarli non ha senso finche'' non si sa a che serve il totale.';

-- ---------------------------------------------------------------------
-- 3. Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente  uuid;
  v_saldo record;
  n       integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  -- Si parte da quello che c'e' gia', per non dipendere da un database vuoto.
  select * into v_saldo from v_cash_balance where entity_id = v_ente;

  -- 1. Un'uscita in BANCA non tocca il contante.
  insert into cash_movements (entity_id, direction, amount, mezzo, business_purpose)
  values (v_ente, 'uscita', 300, 'banca', 'PROVA BANCA bonifico fornitore');

  declare
    v_dopo record;
  begin
    select * into v_dopo from v_cash_balance where entity_id = v_ente;
    if v_dopo.balance is distinct from v_saldo.balance then
      raise exception 'Un bonifico ha cambiato il contante atteso (da % a %): e'' il difetto che questa migrazione chiude.',
        v_saldo.balance, v_dopo.balance;
    end if;
    if v_dopo.saldo_banca is distinct from v_saldo.saldo_banca - 300 then
      raise exception 'Il saldo di banca non e'' calato di 300 (da % a %).',
        v_saldo.saldo_banca, v_dopo.saldo_banca;
    end if;
  end;

  -- 2. Un'entrata in CASSA non tocca la banca.
  insert into cash_movements (entity_id, direction, amount, mezzo, business_purpose)
  values (v_ente, 'entrata', 50, 'cassa', 'PROVA BANCA incasso contante');

  declare
    v_dopo record;
  begin
    select * into v_dopo from v_cash_balance where entity_id = v_ente;
    if v_dopo.balance is distinct from v_saldo.balance + 50 then
      raise exception 'Il contante non e'' salito di 50.';
    end if;
    if v_dopo.saldo_banca is distinct from v_saldo.saldo_banca - 300 then
      raise exception 'Un incasso in contante ha toccato il saldo di banca.';
    end if;
  end;

  -- 3. Un mezzo inventato non entra.
  begin
    insert into cash_movements (entity_id, direction, amount, mezzo, business_purpose)
    values (v_ente, 'uscita', 1, 'paypal', 'PROVA BANCA mezzo inesistente');
    raise exception 'Un mezzo di pagamento inventato e'' stato accettato.';
  exception when check_violation then
    null;  -- e' il rifiuto che ci si aspetta
  end;

  -- 4. Chi c'era prima resta contante: e' quello che era, per costruzione.
  select count(*) into n from cash_movements where mezzo is null;
  if n <> 0 then
    raise exception 'Ci sono % movimenti senza mezzo di pagamento.', n;
  end if;

  -- 5. Pulizia (regola del 12/08).
  delete from cash_movements where business_purpose like 'PROVA BANCA%';
  select count(*) into n from cash_movements where business_purpose like 'PROVA BANCA%';
  if n <> 0 then raise exception 'La prova ha lasciato % movimenti.', n; end if;

  select * into v_saldo from v_cash_balance where entity_id = v_ente;
  raise notice 'Cassa e banca separate: contante %, banca %.', v_saldo.balance, v_saldo.saldo_banca;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000009', 'la_cassa_e_la_banca')
on conflict (version) do nothing;

select entity_name, balance as contante, saldo_banca
  from v_cash_balance order by entity_name;
