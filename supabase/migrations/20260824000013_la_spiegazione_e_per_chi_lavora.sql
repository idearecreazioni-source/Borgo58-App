-- =====================================================================
-- LA SPIEGAZIONE DI UN VINCOLO E' PER CHI LAVORA, NON PER CHIUNQUE
-- 24/08/2026 — correzione della 20260824000012, aggiunta e non riscritta
-- =====================================================================
-- 🔴 TROVATO DALLE RETI DEL PROGETTO, non rileggendo. Le prove sui
-- permessi sono diventate rosse da sole:
--
--   solo 10 funzioni si possono eseguire con la sola chiave pubblica
--     → ne trova 11:  + spiega_vincolo
--   solo 19 funzioni scavalcano la RLS senza chiedere chi sei
--     → ne trova 20:  + spiega_vincolo
--
-- ⚠️ E NON E' CHE LA SCELTA FOSSE NASCOSTA: la migrazione precedente la
-- dichiara, «NIENTE PORTIERE, ed e' voluto». Ma **l'elenco di cio' che e'
-- aperto ad anon non deve crescere in silenzio** (regola del 13/08), e una
-- dichiarazione dentro un file non e' la stessa cosa di un numero
-- aggiornato in una prova che qualcuno legge. La rete ha fatto il suo
-- lavoro: mi ha costretto a *rispondere*, non a *dichiarare*.
--
-- ---------------------------------------------------------------------
-- RIESAMINATA, LA SCELTA E' SBAGLIATA IN DUE PUNTI
-- ---------------------------------------------------------------------
-- 1 · **`anon` non serve.** La traduzione di un rifiuto serve a chi
--     lavora nel gestionale, ed e' autenticato. Il form pubblico
--     `/prenota` non passa nemmeno di li': usa `supabasePubblico`, che
--     **non ha** il fetch che traduce — e soprattutto ha gia' le sue
--     frasi, scritte dentro `submit_public_reservation` e pensate per
--     l'ospite (regola del 10/08). Dargli anche questa e' aprire una
--     porta per un caso che non esiste.
-- 2 · **Un portiere ci vuole.** I commenti dei vincoli contengono ragioni
--     di merito — «il costo aziendale sopra il 300% del netto», «per
--     un'osteria da 34 coperti e' fuori scala». Non sono segreti, ma non
--     sono neanche roba da lasciare a chiunque abbia la chiave pubblica,
--     che sta nel sito.
--
-- ⚠️ IL PORTIERE E' `auth.uid() is not null`, non `is_titolare()`: la
-- traduzione serve **anche allo staff**, che scrive temperature, pulizie
-- e comande — cioe' proprio i posti dove i vincoli nuovi scattano. Un
-- portiere piu' stretto lascerebbe in inglese meta' dei rifiuti che
-- capitano in servizio.
--
-- ⚠️ E la 012 non si riscrive (regola del 23/08): quel file racconta cosa
-- e' stato deciso ieri, portiere mancante compreso.
-- =====================================================================

-- rete-guardie: spiega_vincolo — il corpo cambia APPOSTA, e in piu': la
-- versione della 012 non aveva nessun controllo, questa ne aggiunge uno.
drop function if exists spiega_vincolo(text);

create function spiega_vincolo(p_nome text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return (
    select obj_description(c.oid, 'pg_constraint')
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public'
       and c.conname = p_nome
     limit 1
  );
end $$;

comment on function spiega_vincolo(text) is
  'La spiegazione in italiano di un vincolo, presa dal suo commento. Serve a tradurre il rifiuto che il database restituisce: «violates check constraint "..."» non e'' una frase per chi sta lavorando. Riservata a chi e'' entrato nel gestionale — staff compreso, perche'' i vincoli scattano anche dove lavora lui.';

revoke all on function spiega_vincolo(text) from public, anon;
grant execute on function spiega_vincolo(text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — i due elenchi tornano come prima
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_anon     boolean;
  v_portiere boolean;
  v_titolare uuid;
begin
  -- ⚠️ `funzioni_senza_portiere()` ha ESSA STESSA un portiere, e una
  -- migrazione non ha un utente: ha un proprietario. E' la trappola del
  -- 16/08, gia' scritta nel §8 — qui si impostano i claims come fanno i
  -- blocchi di verifica, invece di aggirarla.
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  -- (a) Non piu' eseguibile con la sola chiave pubblica.
  v_anon := has_function_privilege('anon', 'spiega_vincolo(text)', 'execute');
  if v_anon then
    raise exception 'spiega_vincolo e'' ancora eseguibile da anon.';
  end if;

  -- (b) Ma lo staff e il titolare sì: è a loro che serve.
  if not has_function_privilege('authenticated', 'spiega_vincolo(text)', 'execute') then
    raise exception 'spiega_vincolo non e'' piu'' eseguibile da chi lavora: la traduzione sparirebbe.';
  end if;

  -- (c) E il portiere c'e' davvero. ⚠️ Si controlla il GESTO, non la
  --     parola: `funzioni_senza_portiere()` riconosce due scritture della
  --     stessa cosa, e cercarne una sola e' il difetto misurato il 19/08.
  select not exists (
    select 1 from funzioni_senza_portiere() where nome = 'spiega_vincolo'
  ) into v_portiere;
  if not v_portiere then
    raise exception 'spiega_vincolo risulta ancora senza portiere.';
  end if;

  raise notice 'La spiegazione dei vincoli e'' tornata dentro: niente anon, col suo portiere.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000013', 'la_spiegazione_e_per_chi_lavora') on conflict (version) do nothing;
