-- =====================================================================
-- L'INDIRIZZO DELLE FUNZIONI NEL VAULT
-- 29/09/2026
-- =====================================================================
-- 🔴 PERCHE' ESISTE. La `20260917000001` si rifiuta di partire se nel Vault
--    manca `url_funzioni` — ed e' giusto che lo faccia: senza, i promemoria
--    non saprebbero a quale progetto appartengono. In produzione quella voce
--    non c'e', e nessuna migrazione l'ha mai creata: su Prova era stata
--    messa a mano. Questa la crea IN UN FILE DEL REPOSITORY, che passa prima
--    da Prova, invece che con un comando scritto a mano nel Vault vero.
--
-- 🔴 L'ORDINE, e perche' il numero NON e' retrodatato. Porta la data in cui
--    e' stata scritta, quindi viene DOPO la `20260917000001`. Nel rilascio si
--    applica da sola, in un passaggio a parte, saltando esplicitamente le
--    sedici gia' in attesa; solo dopo si applicano le altre quindici (piano
--    `docs/consegne/20260928_piano_pre-produzione_16_migrazioni.md`).
--
-- ---------------------------------------------------------------------
-- COME SA A QUALE PROGETTO APPARTIENE, senza che nessuno glielo scriva
-- ---------------------------------------------------------------------
-- Un database Supabase non conosce il proprio identificativo di progetto.
-- La `chiave_anon` che sta gia' nel Vault e' un JWT, e il suo contenuto
-- porta il campo `ref`: e' da li' che si ricava l'indirizzo atteso,
-- `https://<ref>.supabase.co/functions/v1`.
--
-- ⚠️ E SI ACCETTANO SOLO I DUE PROGETTI DEL LOCALE — il gestionale vero e
--    Borgo58-Prova. Qualunque altro caso — chiave assente, doppia, non JWT,
--    illeggibile, senza `ref`, con un `ref` diverso — FERMA TUTTO prima di
--    scrivere.
--
-- ---------------------------------------------------------------------
-- LE QUATTRO SITUAZIONI, e cosa succede
-- ---------------------------------------------------------------------
--   · `url_funzioni` manca            → la crea col solo valore previsto;
--   · c'e' ed e' quella giusta        → non riscrive niente;
--     (spazi ai bordi e barra finale non contano)
--   · c'e' ma e' diversa, o doppia    → si ferma, NON corregge;
--   · la chiave non si legge          → si ferma, non scrive.
--
-- ⚠️ NESSUNA SOVRASCRITTURA POSSIBILE: il Vault si tocca solo con
--    `vault.create_secret`, e solo quando la voce non c'e'. Niente
--    `update_secret`, niente cancellazioni.
-- ⚠️ NESSUN VALORE NEI MESSAGGI: ne' la chiave, ne' l'indirizzo, ne' il
--    riferimento letto. Un rifiuto dice quale controllo non e' passato, non
--    cosa c'e' scritto nel Vault.
-- ⚠️ TUTTO O NIENTE: `npm run migra` e `npm run prova:migra` applicano il
--    file in un'unica transazione; un errore in qualunque punto lascia il
--    database com'era, e la versione non si registra.
-- =====================================================================

do $indirizzo$
declare
  v_chiave  text;
  v_parti   text[];
  v_payload text;
  v_json    jsonb;
  v_ref     text;
  v_atteso  text;
  v_valore  text;
  v_n       integer;
begin
  -- 1. La chiave pubblica di QUESTO progetto, una e una sola.
  select count(*) into v_n from vault.decrypted_secrets where name = 'chiave_anon';
  if v_n <> 1 then
    raise exception 'FERMO: nel Vault «chiave_anon» non c''e'' esattamente una volta, quindi non so a quale progetto appartiene questo database. Nessuna scrittura.';
  end if;
  select decrypted_secret into v_chiave from vault.decrypted_secrets where name = 'chiave_anon';

  -- 2. Il contenuto del JWT: tre parti separate da un punto, la seconda in
  --    base64 «da indirizzo» (senza riempimento, con - e _).
  v_parti := string_to_array(coalesce(v_chiave, ''), '.');
  if coalesce(array_length(v_parti, 1), 0) <> 3 or coalesce(v_parti[2], '') = '' then
    raise exception 'FERMO: «chiave_anon» non ha la forma di un JWT. Nessuna scrittura.';
  end if;
  v_payload := translate(v_parti[2], '-_', '+/');
  v_payload := v_payload || repeat('=', (4 - length(v_payload) % 4) % 4);
  begin
    v_json := convert_from(decode(v_payload, 'base64'), 'UTF8')::jsonb;
  exception when others then
    raise exception 'FERMO: il contenuto di «chiave_anon» non si legge. Nessuna scrittura.';
  end;
  if jsonb_typeof(v_json) is distinct from 'object' then
    raise exception 'FERMO: il contenuto di «chiave_anon» non e'' un oggetto. Nessuna scrittura.';
  end if;

  -- 3. Solo i due progetti del locale.
  v_ref := v_json ->> 'ref';
  if v_ref is null or v_ref not in ('oudjuqbqszisdtwzbxdo', 'bnwqgpuyzmzujxfbtyvs') then
    raise exception 'FERMO: «chiave_anon» non appartiene a nessuno dei due progetti del locale. Nessuna scrittura.';
  end if;

  -- 4. L'indirizzo atteso, costruito qui dentro.
  v_atteso := 'https://' || v_ref || '.supabase.co/functions/v1';

  -- 5. Quante voci `url_funzioni` ci sono gia'.
  select count(*) into v_n from vault.decrypted_secrets where name = 'url_funzioni';
  if v_n > 1 then
    raise exception 'FERMO: nel Vault «url_funzioni» compare piu'' di una volta. Non la correggo: va guardata a mano.';
  elsif v_n = 1 then
    select decrypted_secret into v_valore from vault.decrypted_secrets where name = 'url_funzioni';
    if rtrim(btrim(coalesce(v_valore, '')), '/') is distinct from v_atteso then
      raise exception 'FERMO: «url_funzioni» c''e'' ma non e'' l''indirizzo delle funzioni di questo progetto. Non la correggo: va guardata a mano.';
    end if;
    raise notice 'url_funzioni c''era gia'' ed e'' quella di questo progetto: nessuna scrittura.';
  else
    perform vault.create_secret(
      v_atteso,
      'url_funzioni',
      'Indirizzo delle funzioni online di QUESTO progetto. Scritto dalla migrazione 20260929000001, ricavato dalla chiave_anon.'
    );
    raise notice 'url_funzioni creata col solo valore previsto per questo progetto.';
  end if;

  -- 6. La riprova: una sola voce, ed e' quella giusta.
  select count(*) into v_n from vault.decrypted_secrets where name = 'url_funzioni';
  if v_n <> 1 then
    raise exception 'VERIFICA: «url_funzioni» non c''e'' esattamente una volta dopo il passo.';
  end if;
  select count(*) into v_n from vault.decrypted_secrets
   where name = 'url_funzioni' and rtrim(btrim(coalesce(decrypted_secret, '')), '/') = v_atteso;
  if v_n <> 1 then
    raise exception 'VERIFICA: «url_funzioni» non corrisponde all''indirizzo di questo progetto dopo il passo.';
  end if;
  raise notice 'Verifica passata: una sola url_funzioni, ed e'' quella di questo progetto.';
end $indirizzo$;

insert into applied_migrations (version, name)
values ('20260929000001', 'l_indirizzo_delle_funzioni_nel_vault') on conflict (version) do nothing;
