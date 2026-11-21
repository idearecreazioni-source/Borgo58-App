-- =====================================================================
-- LA SCHEDA DI BORGO 58 — 20/11/2026.
-- =====================================================================
-- Prima di applicare: confrontare con il database vivo prima di applicare.
-- La migrazione non esegue scritture su un database da questa copia locale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LE VOCI E IL LORO STORICO
-- ---------------------------------------------------------------------
create table if not exists scheda_voci (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity,
  sezione text not null,
  chiave text not null,
  testo text not null,
  fonte text not null default 'da_verificare',
  fonte_dettaglio text,
  documento_id uuid references documents(id) on delete set null,
  valida_dal date,
  verificata_il date,
  rivedere_entro date,
  attiva boolean not null default true,
  ordine integer not null default 0,
  creata_il timestamptz not null default now(),
  aggiornata_il timestamptz not null default now(),
  constraint scheda_voci_numero_unico unique (numero),
  constraint scheda_voce_sezione_nota check (sezione in (
    'titolare', 'societa', 'locale', 'concept', 'fornitori', 'consulenti',
    'decisioni', 'come_rispondere'
  )),
  constraint scheda_voce_chiave_presente check (btrim(chiave) <> ''),
  constraint scheda_voce_testo_presente check (btrim(testo) <> ''),
  constraint scheda_voce_testo_corto check (char_length(testo) <= 300),
  constraint scheda_voce_fonte_nota check (fonte in (
    'documentato', 'confermato', 'riferito', 'da_verificare'
  ))
);

comment on table scheda_voci is
  'La Scheda di Borgo 58: le informazioni brevi che MEMO può usare, scelte dal titolare (S1, 20/11/2026).';
comment on constraint scheda_voci_numero_unico on scheda_voci is
  'Ogni voce ha un numero stabile: è il riferimento [S12] che MEMO può citare.';
comment on constraint scheda_voce_sezione_nota on scheda_voci is
  'La sezione della Scheda deve essere una di quelle approvate: niente famiglia, salute, debiti o prestiti.';
comment on constraint scheda_voce_chiave_presente on scheda_voci is
  'Una voce della Scheda ha una chiave stabile: per esempio «fornitore:ortofrutta-prova».';
comment on constraint scheda_voce_testo_presente on scheda_voci is
  'Una voce della Scheda ha bisogno del suo testo: non lasciare una riga vuota.';
comment on constraint scheda_voce_testo_corto on scheda_voci is
  'Il testo di una voce della Scheda può avere al massimo 300 caratteri.';
comment on constraint scheda_voce_fonte_nota on scheda_voci is
  'La fonte della Scheda è «documentato», «confermato», «riferito» oppure «da verificare».';

create unique index if not exists scheda_voci_chiave_attiva_unica
  on scheda_voci (chiave) where attiva;
comment on index scheda_voci_chiave_attiva_unica is
  'Due voci attive non possono raccontare la stessa cosa.';

create table if not exists scheda_storico (
  id uuid primary key default gen_random_uuid(),
  voce_id uuid not null references scheda_voci(id) on delete restrict,
  testo_prima text,
  testo_dopo text,
  fonte_prima text,
  fonte_dopo text,
  attiva_prima boolean,
  attiva_dopo boolean,
  chiave_prima text,
  chiave_dopo text,
  sezione_prima text,
  sezione_dopo text,
  chi text not null,
  quando timestamptz not null default now()
);
comment on table scheda_storico is
  'La traccia automatica delle voci della Scheda: soltanto il trigger la scrive e non si corregge.';

-- ---------------------------------------------------------------------
-- 2. I PORTIERI: data, storico e privacy
-- ---------------------------------------------------------------------
create or replace function scheda_aggiorna_data()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  new.aggiornata_il = now();
  return new;
end;
$funzione$;

-- PostgreSQL non offre il lookbehind PCRE. \m e \M sono confini non
-- consumanti equivalenti per cifre: esaminano anche due carte vicine senza
-- fondere P. IVA e telefoni in un falso numero di carta.
create or replace function scheda_numero_carta_valido(p_testo text)
returns boolean language plpgsql immutable set search_path = public as $funzione$
declare
  v_corrispondenza text[];
  v_numero text;
  -- I confini evitano di estrarre una carta da P. IVA, telefoni o importi.
  -- Sono ammessi solo separatori tra i gruppi del numero.
  v_carta_pattern text := '\m([0-9]{13,19}|[0-9]{4}[ ./-][0-9]{4}[ ./-][0-9]{4}[ ./-][0-9]{3,4}([ ./-][0-9]{3})?|[0-9]{4}[ ./-][0-9]{6}[ ./-][0-9]{5})\M';
  v_i integer;
  v_posizione integer;
  v_cifra integer;
  v_somma integer;
begin
  for v_corrispondenza in
    select regexp_matches(
      coalesce(p_testo, ''),
      v_carta_pattern, 'g'
    )
  loop
    v_numero := regexp_replace(v_corrispondenza[1], '[^0-9]', '', 'g');
    if char_length(v_numero) not between 13 and 19 then continue; end if;
    v_somma := 0;
    v_posizione := 0;
    for v_i in reverse char_length(v_numero)..1 loop
      v_posizione := v_posizione + 1;
      v_cifra := substr(v_numero, v_i, 1)::integer;
      if v_posizione % 2 = 0 then
        v_cifra := v_cifra * 2;
        if v_cifra > 9 then v_cifra := v_cifra - 9; end if;
      end if;
      v_somma := v_somma + v_cifra;
    end loop;
    if v_somma % 10 = 0 then return true; end if;
  end loop;
  return false;
end;
$funzione$;

create or replace function scheda_testo_personale(p_testo text)
returns boolean language plpgsql immutable set search_path = public as $funzione$
declare
  -- PostgreSQL \m e \M delimitano rispettivamente inizio e fine di parola.
  -- I separatori sono ammessi soltanto dentro un identificativo: il testo non
  -- viene mai fuso, cosi parole e numeri normali restano separati.
  v_iban_pattern text := '\m[A-Za-z]{2}[0-9]{2}([ .-]?[A-Za-z0-9]{4}){2,7}([ .-]?[A-Za-z0-9]{1,3})?\M';
  v_cf_pattern text := '\m[A-Za-z]([ .-]?[A-Za-z]){5}([ .-]?[0-9LMNPQRSTUV]){2}[ .-]?[ABCDEHLMPRST]([ .-]?[0-9LMNPQRSTUV]){2}[ .-]?[A-Za-z]([ .-]?[0-9LMNPQRSTUV]){3}[ .-]?[A-Za-z]\M';
begin
  -- IBAN internazionale; CF anche omocodico nelle sole posizioni numeriche.
  if coalesce(p_testo, '') ~ v_iban_pattern
     or coalesce(p_testo, '') ~* v_cf_pattern
     or scheda_numero_carta_valido(p_testo) then
    return true;
  end if;
  return false;
end;
$funzione$;

-- Deve poter chiamare l'helper privato anche nell'UPDATE ON DELETE SET NULL.
create or replace function scheda_controlla_privacy()
returns trigger language plpgsql security definer set search_path = public as $funzione$
declare v_campo text;
begin
  -- L'ON DELETE SET NULL di documents cambia solo documento_id: non e' una modifica della Scheda.
  if tg_op = 'UPDATE'
     and old.chiave is not distinct from new.chiave
     and old.testo is not distinct from new.testo
     and old.fonte_dettaglio is not distinct from new.fonte_dettaglio
     and old.sezione is not distinct from new.sezione
     and old.attiva is not distinct from new.attiva then
    return new;
  end if;
  if not is_titolare() then
    raise exception 'Solo il titolare può modificare la Scheda' using errcode = 'insufficient_privilege';
  end if;
  foreach v_campo in array array[new.chiave, new.testo, new.fonte_dettaglio] loop
    if scheda_testo_personale(v_campo) then
      raise exception 'La Scheda non accetta IBAN, codici fiscali di persona o numeri di carta. Se è un numero d''ordine, scrivilo con una parola davanti attaccata o spezzalo.';
    end if;
  end loop;
  return new;
end;
$funzione$;

create or replace function scheda_parole_delicate(p_testo text)
returns text[] language sql immutable set search_path = public as $funzione$
  with parole(parola, posizione, espressione) as (
    values
      ('debito', 1, '(^|[^[:alpha:]])debit[oi]([^[:alpha:]]|$)'),
      ('prestito', 2, '(^|[^[:alpha:]])prestit[oi]([^[:alpha:]]|$)'),
      ('causa', 3, '(^|[^[:alpha:]])caus[ae][^[:alpha:]]+(legal[ei]|civil[ei]|penal[ei]|contro|intentat[aeio]|in[[:space:]]+(corso|tribunale))|(^|[^[:alpha:]])(legal[ei]|civil[ei]|penal[ei]|tribunale)[^[:alpha:]]+caus[ae]([^[:alpha:]]|$)'),
      ('avvocato', 4, '(^|[^[:alpha:]])avvocat[oi]([^[:alpha:]]|$)'),
      ('malattia', 5, '(^|[^[:alpha:]])malatti[ae]([^[:alpha:]]|$)'),
      ('salute', 6, '(^|[^[:alpha:]])salute([^[:alpha:]]|$)'),
      ('pignoramento', 7, '(^|[^[:alpha:]])pignorament[oi]([^[:alpha:]]|$)'),
      ('ipoteca', 8, '(^|[^[:alpha:]])ipotec[ae]([^[:alpha:]]|$)')
  )
  select coalesce(array_agg(parola order by posizione), array[]::text[])
    from parole where lower(coalesce(p_testo, '')) ~ espressione
$funzione$;

create or replace function scheda_storico_scrivi()
returns trigger language plpgsql security definer set search_path = public as $funzione$
begin
  if tg_op = 'UPDATE'
     and old.testo is not distinct from new.testo
     and old.fonte is not distinct from new.fonte
     and old.attiva is not distinct from new.attiva
     and old.chiave is not distinct from new.chiave
     and old.sezione is not distinct from new.sezione then
    return new;
  end if;
  insert into scheda_storico (
    voce_id, testo_prima, testo_dopo, fonte_prima, fonte_dopo,
    attiva_prima, attiva_dopo, chiave_prima, chiave_dopo,
    sezione_prima, sezione_dopo, chi
  ) values (
    new.id,
    case when tg_op = 'UPDATE' then old.testo end, new.testo,
    case when tg_op = 'UPDATE' then old.fonte end, new.fonte,
    case when tg_op = 'UPDATE' then old.attiva end, new.attiva,
    case when tg_op = 'UPDATE' then old.chiave end, new.chiave,
    case when tg_op = 'UPDATE' then old.sezione end, new.sezione,
    coalesce(auth.uid()::text, 'sistema')
  );
  return new;
end;
$funzione$;

create or replace function scheda_storico_solo_trigger()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  if pg_trigger_depth() < 2 then
    raise exception 'Lo storico della Scheda lo scrive soltanto la voce che cambia.';
  end if;
  return new;
end;
$funzione$;

create or replace function scheda_storico_immutabile()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  raise exception 'Lo storico della Scheda non si modifica e non si cancella.';
end;
$funzione$;

create or replace function scheda_voce_non_cancellabile()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  raise exception 'Spegni la voce invece di cancellarla.';
end;
$funzione$;

create or replace function scheda_voce_campi_immutabili()
returns trigger language plpgsql security invoker set search_path = public as $funzione$
begin
  if new.id is distinct from old.id
     or new.numero is distinct from old.numero
     or new.creata_il is distinct from old.creata_il then
    raise exception 'Identificativo, numero e data di creazione della voce non si modificano.';
  end if;
  return new;
end;
$funzione$;

drop trigger if exists scheda_voci_aggiornata on scheda_voci;
create trigger scheda_voci_aggiornata before update on scheda_voci for each row execute function scheda_aggiorna_data();
drop trigger if exists scheda_voci_campi_immutabili on scheda_voci;
create trigger scheda_voci_campi_immutabili before update on scheda_voci for each row execute function scheda_voce_campi_immutabili();
drop trigger if exists scheda_voci_privacy on scheda_voci;
create trigger scheda_voci_privacy before insert or update on scheda_voci for each row execute function scheda_controlla_privacy();
drop trigger if exists scheda_storico_solo_trigger on scheda_storico;
create trigger scheda_storico_solo_trigger before insert on scheda_storico for each row execute function scheda_storico_solo_trigger();
drop trigger if exists scheda_storico_bloccato on scheda_storico;
create trigger scheda_storico_bloccato before update or delete on scheda_storico for each row execute function scheda_storico_immutabile();
drop trigger if exists scheda_voci_storico on scheda_voci;
create trigger scheda_voci_storico after insert or update on scheda_voci for each row execute function scheda_storico_scrivi();
drop trigger if exists scheda_voci_non_cancellabili on scheda_voci;
create trigger scheda_voci_non_cancellabili before delete on scheda_voci for each row execute function scheda_voce_non_cancellabile();

-- ---------------------------------------------------------------------
-- 3. IL TESTO STABILE PER MEMO E IL FRENO DELLA SCHEDA
-- ---------------------------------------------------------------------
create or replace function scheda_riga_per_memo(
  p_numero integer, p_sezione text, p_fonte text, p_valida_dal date,
  p_verificata_il date, p_testo text
) returns text language sql stable set search_path = public as $funzione$
  select format(
    '[S%s] (%s · %s%s) %s', p_numero, p_sezione,
    case p_fonte when 'documentato' then 'documentato'
      when 'confermato' then 'confermato dal titolare'
      when 'riferito' then 'riferito, non verificato' else 'da verificare' end,
    case when coalesce(p_valida_dal, p_verificata_il) is null then ''
      else ' · ' || to_char(coalesce(p_valida_dal, p_verificata_il), 'DD/MM/YYYY') end,
    p_testo
  )
$funzione$;

create or replace function scheda_compone_testo(
  p_escludi uuid default null, p_includi scheda_voci default null
) returns text language sql stable security definer set search_path = public as $funzione$
  with sezioni(posizione, sezione, titolo) as (
    values (1, 'titolare', 'Titolare'), (2, 'societa', 'Società'),
      (3, 'locale', 'Locale'), (4, 'concept', 'Concept'),
      (5, 'fornitori', 'Fornitori'), (6, 'consulenti', 'Consulenti'),
      (7, 'decisioni', 'Decisioni'), (8, 'come_rispondere', 'Come rispondere')
  ), voci as (
    select id, numero, sezione, fonte, valida_dal, verificata_il, testo, ordine
      from scheda_voci where attiva and (p_escludi is null or id is distinct from p_escludi)
    union all
    select (p_includi).id, (p_includi).numero, (p_includi).sezione,
      (p_includi).fonte, (p_includi).valida_dal, (p_includi).verificata_il,
      (p_includi).testo, (p_includi).ordine
      where (p_includi).id is not null and (p_includi).attiva
  ), blocchi as (
    select s.posizione, s.titolo || E'\n' || string_agg(
      scheda_riga_per_memo(v.numero, v.sezione, v.fonte, v.valida_dal, v.verificata_il, v.testo),
      E'\n' order by v.ordine, v.numero
    ) as testo
    from sezioni s join voci v on v.sezione = s.sezione
    group by s.posizione, s.titolo
  )
  select coalesce(string_agg(testo, E'\n\n' order by posizione), '') from blocchi
$funzione$;

create or replace function scheda_controlla_limiti()
returns trigger language plpgsql security definer set search_path = public as $funzione$
declare v_voci integer; v_testo text; v_eccedenza integer;
begin
  -- L'ON DELETE SET NULL di documents cambia solo documento_id: non e' una modifica della Scheda.
  if tg_op = 'UPDATE'
     and old.chiave is not distinct from new.chiave
     and old.testo is not distinct from new.testo
     and old.fonte is not distinct from new.fonte
     and old.fonte_dettaglio is not distinct from new.fonte_dettaglio
     and old.valida_dal is not distinct from new.valida_dal
     and old.verificata_il is not distinct from new.verificata_il
     and old.sezione is not distinct from new.sezione
     and old.attiva is not distinct from new.attiva then
    return new;
  end if;
  if not is_titolare() then
    raise exception 'Solo il titolare può modificare la Scheda' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('scheda_voci'));
  if not new.attiva then return new; end if;
  select count(*) into v_voci from scheda_voci
    where attiva and (tg_op <> 'UPDATE' or id is distinct from new.id);
  v_voci := v_voci + 1;
  v_testo := scheda_compone_testo(case when tg_op = 'UPDATE' then new.id end, new);
  if v_voci > 60 then
    raise exception 'La Scheda ha già 60 voci attive: spegni una voce prima di aggiungerne o riattivarne un''altra.';
  end if;
  if char_length(v_testo) > 10000 then
    v_eccedenza := char_length(v_testo) - 10000;
    raise exception 'Il testo composto per MEMO supera il limite di 10.000 caratteri di % caratteri.', v_eccedenza;
  end if;
  return new;
end;
$funzione$;

drop trigger if exists scheda_voci_limiti on scheda_voci;
create trigger scheda_voci_limiti before insert or update on scheda_voci for each row execute function scheda_controlla_limiti();

create or replace function scheda_per_memo()
returns jsonb language plpgsql stable security definer set search_path = public as $funzione$
declare v_voci integer; v_aggiornata timestamptz; v_testo text;
begin
  if not is_titolare() then raise exception 'Solo il titolare può leggere la Scheda per MEMO.'; end if;
  select count(*) filter (where attiva), max(aggiornata_il) into v_voci, v_aggiornata from scheda_voci;
  v_testo := scheda_compone_testo();
  return jsonb_build_object(
    'versione', coalesce(to_char(v_aggiornata at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'vuota') || ':' || v_voci,
    'caratteri', char_length(v_testo), 'voci', v_voci, 'testo', v_testo
  );
end;
$funzione$;

-- ---------------------------------------------------------------------
-- 4. SOLO IL TITOLARE
-- ---------------------------------------------------------------------
alter table scheda_voci enable row level security;
alter table scheda_storico enable row level security;
drop policy if exists scheda_voci_titolare on scheda_voci;
create policy scheda_voci_titolare on scheda_voci for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
drop policy if exists scheda_storico_titolare_legge on scheda_storico;
create policy scheda_storico_titolare_legge on scheda_storico for select to authenticated using ((select is_titolare()));

revoke all on table scheda_voci, scheda_storico from public, anon;
revoke all on table scheda_voci, scheda_storico from authenticated;
grant select, insert, update on table scheda_voci to authenticated;
grant select on table scheda_storico to authenticated;
revoke all on sequence scheda_voci_numero_seq from public, anon;
revoke all on sequence scheda_voci_numero_seq from authenticated;
grant usage on sequence scheda_voci_numero_seq to authenticated;

revoke all on function scheda_aggiorna_data(), scheda_numero_carta_valido(text),
  scheda_testo_personale(text), scheda_controlla_privacy(), scheda_storico_scrivi(),
  scheda_storico_solo_trigger(), scheda_storico_immutabile(),
  scheda_voce_non_cancellabile(), scheda_voce_campi_immutabili(),
  scheda_riga_per_memo(integer, text, text, date, date, text),
  scheda_compone_testo(uuid, scheda_voci), scheda_controlla_limiti()
  from public, anon, authenticated;
revoke all on function scheda_parole_delicate(text), scheda_per_memo() from public, anon, authenticated;
grant execute on function scheda_parole_delicate(text), scheda_per_memo() to authenticated;

-- ---------------------------------------------------------------------
-- 5. VERIFICA INTERNA, ANNULLATA: nessun dato di prova resta.
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto jsonb := foto_righe(); v_titolare uuid; v_staff uuid; v_voce uuid;
  v_titolare_voce uuid; v_limite_fonte uuid; v_primo_numero integer; v_n integer; v_toccate integer;
  v_rifiuto boolean; v_limite_fonte_pronto boolean := false; v_lunghezza_fonte integer := 0; v_memo_una jsonb; v_memo_due jsonb; v_testo text;
  v_numero_prossimo bigint; v_righe_calcolate integer := 0; v_record scheda_voci;
  v_seq_last bigint; v_seq_called boolean;
begin
  if exists (select 1 from scheda_voci) then
    raise notice 'VERIFICA: scheda_voci contiene già righe; la verifica monouso viene saltata.';
    return;
  end if;
  -- Le sequenze non partecipano al rollback del sotto-blocco: si ripristinano dopo.
  select last_value, is_called into v_seq_last, v_seq_called from scheda_voci_numero_seq;
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.'; end if;
  if has_table_privilege('anon', 'scheda_voci', 'select')
     or has_table_privilege('anon', 'scheda_storico', 'select')
     or not has_table_privilege('authenticated', 'scheda_voci', 'insert')
     or not has_table_privilege('authenticated', 'scheda_voci', 'update')
     or has_table_privilege('authenticated', 'scheda_voci', 'delete')
     or has_table_privilege('authenticated', 'scheda_voci', 'truncate')
     or has_table_privilege('authenticated', 'scheda_storico', 'insert')
     or has_table_privilege('authenticated', 'scheda_storico', 'update')
     or has_table_privilege('authenticated', 'scheda_storico', 'delete')
     or has_table_privilege('authenticated', 'scheda_storico', 'truncate')
     or has_sequence_privilege('authenticated', 'scheda_voci_numero_seq', 'update') <> false
     or has_function_privilege('anon', 'scheda_per_memo()', 'execute')
     or not has_function_privilege('authenticated', 'scheda_per_memo()', 'execute') then
    raise exception 'VERIFICA: anon o authenticated hanno permessi della Scheda diversi da quelli dichiarati.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into scheda_voci (sezione, chiave, testo, fonte, fonte_dettaglio, valida_dal)
    values ('fornitori', 'fornitore:prova-zz', 'Fornitore Prova ZZ: consegna inventata.', 'confermato', 'Partita IVA finta 12345678901; codice destinatario finto ABC12DE.', date '2026-11-03')
    returning id, numero into v_voce, v_primo_numero;
    if v_primo_numero <> 1 then raise exception 'VERIFICA (0): la prima voce non riceve il numero [S1].'; end if;
    insert into scheda_voci (sezione, chiave, testo, fonte, ordine)
    values ('titolare', 'titolare:prova-zz', 'Voce titolare inventata.', 'documentato', 7)
    returning id into v_titolare_voce;
    -- Simula l'UPDATE ON DELETE SET NULL di documents: i due portieri escono prima di is_titolare().
    update scheda_voci set documento_id = null where id = v_voce;
    get diagnostics v_toccate = row_count;
    if v_toccate <> 1 then raise exception 'VERIFICA (0b): l''aggiornamento del solo documento_id ha toccato % righe.', v_toccate; end if;

    -- Dati personali finti rifiutati in ogni campo; gli identificativi d'impresa restano ammessi.
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:iban-compatto-zz', 'IBAN finto IT60X0542811101000000123456');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1a): un IBAN finto compatto è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:iban-spazi-zz', 'IBAN finto IT60 X054 2811 1010 0000 0012 3456');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1b): un IBAN finto con spazi è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:iban-trattini-zz', 'IBAN finto IT60-X054-2811-1010-0000-0012-3456');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1c): un IBAN finto con trattini è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:iban-punti-zz', 'IBAN finto IT60.X054.2811.1010.0000.0012.3456');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1d): un IBAN finto con punti è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:cf-zz', 'Codice finto RSS-MRA-85T-10A-562S');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1e): un codice fiscale finto con trattini è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:carta-spazi-zz', 'Carta finta 4000 0000 0000 0002');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1f): un numero di carta finto con spazi è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'privacy:carta-trattini-zz', 'Carta finta 4000-0000-0000-0002');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1g): un numero di carta finto con trattini è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'IT60-X054-2811-1010-0000-0012-3456', 'Dato personale nella chiave.');
    exception when raise_exception then v_rifiuto := sqlerrm like '%non accetta IBAN%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (1h): un dato personale nella chiave è passato.'; end if;
    insert into scheda_voci (sezione, chiave, testo, fonte_dettaglio)
    values ('locale', 'fornitore:ortofrutta-2026-consegne-settimanali', 'P.IVA 12345678901 Rossi Srl. Consegna il martedì alle 10 con furgone refrigerato. Via Roma 12 Bologna centro storico. Tel 333 1234567. Preventivo del 03/11/2026: importo 1.250,00 euro.', 'Riferimento finto consentito.');
    if scheda_parole_delicate('Debiti e prestiti inventati; due avvocati seguono cause legali e malattie.')
       <> array['debito', 'prestito', 'causa', 'avvocato', 'malattia']
       or scheda_parole_delicate('Il ritardo è a causa di una consegna inventata.') @> array['causa'] then
      raise exception 'VERIFICA (1i): il vocabolario delle parole delicate non distingue i contesti.';
    end if;
    update scheda_voci set attiva = false where chiave = 'fornitore:ortofrutta-2026-consegne-settimanali';

    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'testo:lungo-zz', repeat('x', 301));
    exception when check_violation then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (2): un testo oltre 300 caratteri è passato.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('famiglia', 'sezione:fuori-zz', 'Sezione inventata.');
    exception when check_violation then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (3): una sezione fuori elenco è passata.'; end if;

    update scheda_voci set testo = 'Fornitore Prova ZZ: consegna inventata, aggiornata.' where id = v_voce;
    get diagnostics v_toccate = row_count;
    if v_toccate <> 1 then raise exception 'VERIFICA (4c): l''aggiornamento della voce ha toccato % righe.', v_toccate; end if;
    select count(*) into v_n from scheda_storico where voce_id = v_voce;
    if v_n <> 2 then raise exception 'VERIFICA (4b): lo storico ha % righe per una creazione e un aggiornamento.', v_n; end if;
    if exists (select 1 from scheda_storico where voce_id = v_voce and chi <> v_titolare::text) then
      raise exception 'VERIFICA (4b): lo storico non usa auth.uid() né il ripiego sistema.';
    end if;
    -- Il proprietario è un ruolo con privilegi: anche lui non inserisce righe manuali.
    reset role;
    v_rifiuto := false;
    begin insert into scheda_storico (voce_id, testo_dopo, fonte_dopo, chi) values (v_voce, 'Storico inventato.', 'riferito', 'nessuno');
    exception when raise_exception then v_rifiuto := sqlerrm like '%soltanto la voce%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (4d): il controllo dello storico non ferma un ruolo con privilegi.'; end if;
    set local role authenticated;
    -- 4e conta l'effetto, non aspetta un errore: nessuna riga manuale è comparsa.
    select count(*) into v_n from scheda_storico where voce_id = v_voce;
    if v_n <> 2 then raise exception 'VERIFICA (4e): lo storico ha ricevuto % righe invece di due.', v_n; end if;

    v_rifiuto := false;
    begin delete from scheda_voci where id = v_voce;
    exception when insufficient_privilege or raise_exception then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (5): una voce della Scheda si lascia cancellare.'; end if;

    -- Venti righe da 300; le righe ulteriori sono calcolate sul testo composto reale.
    insert into scheda_voci (sezione, chiave, testo, ordine)
    select 'decisioni', 'limite:testo-zz-' || n, repeat('ab ', 100), n from generate_series(1, 20) n;
    -- authenticated ha solo usage sulla sequenza e non esegue scheda_compone_testo().
    -- I claim JWT restano impostati, quindi i trigger riconoscono ancora il titolare.
    reset role;
    loop
      select last_value + 1 into v_numero_prossimo from scheda_voci_numero_seq;
      select (row(gen_random_uuid(), v_numero_prossimo::integer, 'decisioni', 'limite:calcolo-zz', repeat('ab ', 100), 'da_verificare', null, null, null, null, null, true, 99, now(), now())::scheda_voci) into v_record;
      exit when char_length(scheda_compone_testo(null, v_record)) > 10000;
      v_righe_calcolate := v_righe_calcolate + 1;
      insert into scheda_voci (sezione, chiave, testo, ordine) values ('decisioni', 'limite:testo-calcolato-zz-' || v_righe_calcolate, repeat('ab ', 100), 100 + v_righe_calcolate);
    end loop;
    set local role authenticated;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo, ordine) values ('decisioni', 'limite:testo-oltre-zz', repeat('ab ', 100), 999);
    exception when raise_exception then v_rifiuto := sqlerrm like '%testo composto per MEMO%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (6a): il testo composto oltre diecimila caratteri è passato.'; end if;
    -- La fonte entra nel testo per MEMO: un suo solo aggiornamento deve rifare il controllo.
    -- Come sopra: sequenza e scheda_compone_testo() richiedono il ruolo con privilegi.
    reset role;
    select last_value + 1 into v_numero_prossimo from scheda_voci_numero_seq;
    for v_n in 1..300 loop
      select (row(gen_random_uuid(), v_numero_prossimo::integer, 'decisioni', 'limite:fonte-zz', repeat('x', v_n), 'da_verificare', null, null, null, null, null, true, 998, now(), now())::scheda_voci) into v_record;
      if char_length(scheda_compone_testo(null, v_record)) <= 10000 then
        select (row(gen_random_uuid(), v_numero_prossimo::integer, 'decisioni', 'limite:fonte-zz', repeat('x', v_n), 'riferito', null, null, null, null, null, true, 998, now(), now())::scheda_voci) into v_record;
        if char_length(scheda_compone_testo(null, v_record)) > 10000 then
          v_limite_fonte_pronto := true;
          v_lunghezza_fonte := v_n;
          exit;
        end if;
      end if;
    end loop;
    set local role authenticated;
    if not v_limite_fonte_pronto then raise exception 'VERIFICA (6b): non riesce a preparare il limite della fonte.'; end if;
    insert into scheda_voci (sezione, chiave, testo, fonte, ordine)
    values ('decisioni', 'limite:fonte-zz', repeat('x', v_lunghezza_fonte), 'da_verificare', 998)
    returning id into v_limite_fonte;
    v_rifiuto := false;
    begin update scheda_voci set fonte = 'riferito' where id = v_limite_fonte;
    exception when raise_exception then v_rifiuto := sqlerrm like '%testo composto per MEMO%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (6b): la Scheda è piena ma l''aggiornamento della sola fonte è passato.'; end if;
    update scheda_voci set attiva = false where id = v_limite_fonte;
    update scheda_voci set attiva = false where chiave like 'limite:testo%-zz%';

    -- Due voci iniziali più 58 brevi fanno 60; una spenta non si riattiva al limite.
    insert into scheda_voci (sezione, chiave, testo, ordine)
    select 'decisioni', 'limite:voce-zz-' || n, 'Voce breve inventata ' || n || '.', n from generate_series(1, 58) n;
    insert into scheda_voci (sezione, chiave, testo, attiva) values ('decisioni', 'limite:spenta-zz', 'Voce spenta inventata.', false);
    v_rifiuto := false;
    begin update scheda_voci set attiva = true where chiave = 'limite:spenta-zz';
    exception when raise_exception then v_rifiuto := sqlerrm like '%60 voci attive%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (6b): una voce spenta si riattiva oltre il limite.'; end if;

    select scheda_per_memo() into v_memo_una;
    select scheda_per_memo() into v_memo_due;
    if v_memo_una <> v_memo_due then raise exception 'VERIFICA (7a): scheda_per_memo cambia senza modifiche.'; end if;
    if (v_memo_una->>'voci')::integer <> 60 or (v_memo_una->>'caratteri')::integer <> char_length(v_memo_una->>'testo') then
      raise exception 'VERIFICA (7b): il conto delle voci o dei caratteri di MEMO non torna.';
    end if;
    v_testo := v_memo_una->>'testo';
    if position('Titolare' in v_testo) >= position('Fornitori' in v_testo)
       or v_testo not like '%[S' || v_primo_numero::text || '] (fornitori · confermato dal titolare · 03/11/2026) F%'
       or v_testo not like '%[S' || (select numero::text from scheda_voci where id = v_titolare_voce) || '] (titolare · documentato) Voce titolare inventata.%' then
      raise exception 'VERIFICA (7c): ordine o formato delle righe di scheda_per_memo non tornano.';
    end if;

    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from scheda_voci;
    if v_n <> 0 then raise exception 'VERIFICA (8a): lo staff vede % voci della Scheda.', v_n; end if;
    select count(*) into v_n from scheda_storico;
    if v_n <> 0 then raise exception 'VERIFICA (8b): lo staff vede lo storico della Scheda.'; end if;
    v_rifiuto := false;
    begin insert into scheda_voci (sezione, chiave, testo) values ('locale', 'staff:zz', 'Scrittura inventata dello staff.');
    exception when insufficient_privilege then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (8c): lo staff scrive nella Scheda.'; end if;
    v_rifiuto := false;
    begin perform scheda_per_memo();
    exception when raise_exception then v_rifiuto := sqlerrm like '%Solo il titolare%'; end;
    if not v_rifiuto then raise exception 'VERIFICA (8d): lo staff legge scheda_per_memo().'; end if;

    reset role;
    perform set_config('request.jwt.claims', null, true);
    set local role anon;
    v_rifiuto := false;
    begin perform count(*) from scheda_voci;
    exception when insufficient_privilege then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (9): anon legge scheda_voci.'; end if;
    v_rifiuto := false;
    begin perform scheda_per_memo();
    exception when insufficient_privilege then v_rifiuto := true; end;
    if not v_rifiuto then raise exception 'VERIFICA (10): anon esegue scheda_per_memo().'; end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform setval('scheda_voci_numero_seq', v_seq_last, v_seq_called);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della Scheda di Borgo 58');
  raise notice 'Fatto: la Scheda è solo del titolare, rifiuta dati personali, conserva lo storico, conta il testo composto per MEMO e ha freni separati a 60 voci e 10.000 caratteri. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261120000002', 'la_scheda_di_borgo58')
on conflict (version) do nothing;
