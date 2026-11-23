-- 23/11/2026 — Revisione generale di work, punto 8: la privacy della Scheda è più debole di quanto dice il piano.
--
-- Tre buchi, tutti nel database (la schermata non basta: la scrive chiunque abbia il token del titolare):
--   1. le «parole delicate» (debito, prestito, causa, avvocato, malattia, salute, pignoramento, ipoteca) le guardava solo
--      il calcolo delle proposte: una voce scritta a mano su un prestito entrava. Ora le rifiuta il portiere della Scheda.
--   2. il testo corretto con «Correggi» saltava il controllo di telefoni ed e-mail (che il calcolo applica solo ai testi
--      proposti da MEMO). Ora `scheda_proposta_decidi` lo applica anche al testo corretto; le parole delicate e IBAN,
--      codici fiscali e carte li ferma già il portiere quando la voce si scrive.
--   3. un IBAN scritto «IT 60 …» (spazio fra le lettere e le cifre di controllo) passava. Ora no, per i paesi che si
--      usano (non per tutte le sigle di due lettere: «da 12 anni 2026» è italiano, non un IBAN).
-- Oggi su work le 35 voci della Scheda sono già dentro: il portiere controlla solo i testi NUOVI o CAMBIATI (un
-- aggiornamento che non tocca il testo esce prima, come già fa).

-- ---------------------------------------------------------------------
-- 1 e 3. Il portiere della Scheda
-- ---------------------------------------------------------------------
create or replace function scheda_testo_personale(p_testo text)
returns boolean language plpgsql immutable set search_path = public as $funzione$
declare
  -- PostgreSQL \m e \M delimitano rispettivamente inizio e fine di parola.
  -- I separatori sono ammessi soltanto dentro un identificativo: il testo non
  -- viene mai fuso, cosi parole e numeri normali restano separati.
  v_iban_pattern text := '\m[A-Za-z]{2}[0-9]{2}([ .-]?[A-Za-z0-9]{4}){2,7}([ .-]?[A-Za-z0-9]{1,3})?\M';
  -- «IT 60 X054 …»: con uno spazio dopo la sigla del paese. Solo i paesi che si usano davvero: una sigla qualunque
  -- di due lettere («da 12 anni 2026») sarebbe un IBAN finto.
  v_iban_spaziato text := '\m(IT|SM|VA|FR|DE|ES|GB|CH|NL|BE|AT|PT|LU|IE|MT|CY|GR|SK)[ .-][0-9]{2}([ .-]?[A-Za-z0-9]{4}){2,7}([ .-]?[A-Za-z0-9]{1,3})?\M';
  v_cf_pattern text := '\m[A-Za-z]([ .-]?[A-Za-z]){5}([ .-]?[0-9LMNPQRSTUV]){2}[ .-]?[ABCDEHLMPRST]([ .-]?[0-9LMNPQRSTUV]){2}[ .-]?[A-Za-z]([ .-]?[0-9LMNPQRSTUV]){3}[ .-]?[A-Za-z]\M';
begin
  -- IBAN internazionale; CF anche omocodico nelle sole posizioni numeriche.
  if coalesce(p_testo, '') ~ v_iban_pattern
     or coalesce(p_testo, '') ~* v_iban_spaziato
     or coalesce(p_testo, '') ~* v_cf_pattern
     or scheda_numero_carta_valido(p_testo) then
    return true;
  end if;
  return false;
end;
$funzione$;

revoke all on function scheda_testo_personale(text) from public, anon, authenticated;

-- Le parole delicate entrano nel portiere (stesso corpo della versione viva, più il controllo).
create or replace function scheda_controlla_privacy()
returns trigger language plpgsql security definer set search_path = public as $funzione$
declare v_campo text; v_parole text[];
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
  -- Argomenti delicati: la Scheda finisce nelle istruzioni di MEMO a ogni domanda.
  v_parole := scheda_parole_delicate(new.testo) || scheda_parole_delicate(new.fonte_dettaglio);
  if coalesce(array_length(v_parole, 1), 0) > 0 then
    raise exception 'La Scheda non accetta argomenti delicati (trovato: %). Per un finanziamento o un contratto scrivi il nome della cosa («mutuo», «finanziamento Credem»); per il resto tienilo fuori dalla Scheda.',
      array_to_string(array(select distinct x from unnest(v_parole) x), ', ');
  end if;
  return new;
end;
$funzione$;

revoke all on function scheda_controlla_privacy() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. «Correggi»: il testo corretto non ha telefoni né e-mail
-- ---------------------------------------------------------------------
-- Il corpo VIVO di `scheda_proposta_decidi` si cambia in un punto solo (controllato: deve comparire una volta).
do $correggi$
declare
  v_vecchio constant text := 'v_testo := btrim(coalesce(p_testo, ''''));';
  v_nuovo   constant text := 'v_testo := btrim(coalesce(p_testo, ''''));
    if scheda_contatti_nel_testo(v_testo) then
      raise exception ''Il testo corretto non può contenere telefoni o indirizzi e-mail: la Scheda non li accetta.'';
    end if;';
  v_def     text;
  v_n       integer;
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := replace(pg_get_functiondef('public.scheda_proposta_decidi(uuid, text, text, boolean)'::regprocedure), E'\r', '');
  if v_def like '%scheda_contatti_nel_testo(v_testo)%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'scheda_proposta_decidi non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_vecchio, v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $correggi$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid;
  v_no boolean;
  v_seq_ultimo bigint;
  v_seq_usato boolean;
begin
  -- (1) IBAN: la forma di prima, la forma con lo spazio dopo la sigla, e un testo italiano che NON lo è.
  if not scheda_testo_personale('IBAN IT60X0542811101000000123456') then raise exception 'VERIFICA (1a): IBAN compatto non riconosciuto.'; end if;
  if not scheda_testo_personale('IBAN IT 60 X054 2811 1010 0000 0123 456') then raise exception 'VERIFICA (1b): IBAN con lo spazio dopo la sigla non riconosciuto.'; end if;
  if not scheda_testo_personale('iban: it 60 X054 2811 1010 0000 0123 456') then raise exception 'VERIFICA (1c): IBAN in minuscolo con lo spazio non riconosciuto.'; end if;
  if scheda_testo_personale('Consegna da 12 anni 2026 2027 ogni mese: si 20 mesi 2026 2027') then
    raise exception 'VERIFICA (1d): un testo italiano è stato scambiato per un IBAN.';
  end if;

  -- (2) il portiere rifiuta una voce con parole delicate e accetta le altre, in un blocco annullato.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;
  -- I numeri [S#] delle voci non si sprecano nemmeno per una verifica: si rimette la sequenza dove era.
  select last_value, is_called into v_seq_ultimo, v_seq_usato from scheda_voci_numero_seq;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_no := false;
    begin
      insert into scheda_voci (sezione, chiave, testo, fonte) values ('decisioni', 'decisioni:zz-delicata', 'Voce ZZ inventata sul prestito di una persona.', 'riferito');
    exception when raise_exception then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (2a): il portiere ha accettato una voce con una parola delicata.'; end if;
    v_no := false;
    begin
      insert into scheda_voci (sezione, chiave, testo, fonte) values ('decisioni', 'decisioni:zz-iban', 'Voce ZZ inventata con IT 60 X054 2811 1010 0000 0123 456.', 'riferito');
    exception when raise_exception then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (2b): il portiere ha accettato un IBAN con lo spazio dopo la sigla.'; end if;
    insert into scheda_voci (sezione, chiave, testo, fonte) values ('decisioni', 'decisioni:zz-normale', 'Voce ZZ inventata, normale, sul finanziamento Credem.', 'riferito');
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);
  perform setval('scheda_voci_numero_seq', v_seq_ultimo, v_seq_usato);
  if exists (select 1 from scheda_voci where chiave like 'decisioni:zz-%') then
    raise exception 'VERIFICA (3): resta una voce di verifica.';
  end if;

  -- (3) «Correggi» controlla i contatti.
  if pg_get_functiondef('public.scheda_proposta_decidi(uuid, text, text, boolean)'::regprocedure) not like '%scheda_contatti_nel_testo(v_testo)%' then
    raise exception 'VERIFICA (4): «Correggi» non controlla telefoni ed e-mail.';
  end if;

  -- (4) nessun permesso nuovo.
  if has_function_privilege('anon', 'scheda_testo_personale(text)', 'execute')
     or has_function_privilege('authenticated', 'scheda_testo_personale(text)', 'execute')
     or has_function_privilege('anon', 'scheda_controlla_privacy()', 'execute')
     or has_function_privilege('authenticated', 'scheda_controlla_privacy()', 'execute') then
    raise exception 'VERIFICA (5): permessi sulle funzioni diversi da quelli dichiarati.';
  end if;

  raise notice 'Fatto: la Scheda rifiuta le parole delicate nel database, il testo corretto con «Correggi» non porta telefoni ed e-mail, e un IBAN con lo spazio dopo la sigla non passa. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261123000003', 'scheda_privacy_nel_database')
on conflict (version) do nothing;
