-- ============================================================================
-- LA RIGA SOTTO IL TETTO DICE CHI — 26/08/2026
-- ============================================================================
--
-- La `20260826000009` ha fatto registrare al gestionale chi tocca il tetto
-- di spesa dell'assistente e chi lo sblocca. Lo **scriveva** e non lo
-- **mostrava**, ed e' mezza cosa: per chi usa il gestionale, un dato scritto
-- che nessuno puo' vedere e' indistinguibile da un dato non scritto.
-- Decisione di Alessio del 26/08.
--
-- ----------------------------------------------------------------------------
-- 🔴 IL VALORE DI ADESSO CONTINUA A NON AVERE UN AUTORE, E LA RIGA LO DICE
-- ----------------------------------------------------------------------------
-- Il tetto in produzione l'ha scritto una migrazione, non una persona. La
-- frase che compare non e' un vuoto imbarazzato ne' un nome plausibile:
--
--     «Questo tetto c'era gia'' quando il gestionale ha cominciato a
--      registrare chi lo tocca: non l'ha messo nessuno.»
--
-- ⚠️ Un campo vuoto onesto vale piu' di un nome inventato — e detto in
--    parole vale piu' di un campo vuoto, perche' chi guarda una casella
--    vuota pensa a un guasto.
--
-- ----------------------------------------------------------------------------
-- IL «CHI» DICE SOLO QUELLO CHE IL GESTIONALE SA
-- ----------------------------------------------------------------------------
-- Si entra per RUOLO e non per persona, e `user_roles` si legge solo per la
-- propria riga: quindi a schermo si puo' dire **«l'hai messo tu»** oppure
-- **«da un altro accesso»**, e nient'altro. E' la stessa forma decisa il
-- 18/08 per la correzione dei coperti, e si riusa invece di inventarne una
-- seconda. In tabella l'identificativo vero resta: il giorno che ci saranno
-- accessi per persona, la storia diventa attribuibile all'indietro.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente. Si mostra una cosa che il gestionale gia' scriveva.
-- ============================================================================

create or replace function chi_ha_messo_il_tetto()
returns table(tetto_frase text, sblocco_frase text)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  v_r  impostazioni_ai%rowtype;
  v_io uuid := auth.uid();
begin
  if not is_titolare() then
    raise exception 'Il tetto di spesa dell''assistente e'' riservato al titolare.';
  end if;

  select * into v_r from impostazioni_ai where id;
  if not found then
    return query select null::text, null::text;
    return;
  end if;

  tetto_frase := case
    when v_r.tetto_mensile_euro is null then
      'Nessun tetto: le letture non si fermano mai da sole.'
    when v_r.tetto_da is null then
      -- 🔴 La frase del valore senza autore. Dice la cosa vera, invece di
      --    lasciare un vuoto che si legge come un guasto.
      'Questo tetto c''era gia'' quando il gestionale ha cominciato a registrare chi lo tocca: non l''ha messo nessuno.'
    when v_r.tetto_da = v_io then
      'L''hai messo tu' || coalesce(' il ' || to_char(v_r.tetto_il at time zone 'Europe/Rome', 'DD/MM/YYYY') ||
        ' alle ' || to_char(v_r.tetto_il at time zone 'Europe/Rome', 'HH24:MI'), '')
    else
      'Messo da un altro accesso' || coalesce(' il ' || to_char(v_r.tetto_il at time zone 'Europe/Rome', 'DD/MM/YYYY') ||
        ' alle ' || to_char(v_r.tetto_il at time zone 'Europe/Rome', 'HH24:MI'), '')
  end;

  sblocco_frase := case
    when v_r.sbloccato_il is null then null
    when v_r.sbloccato_da is null then
      'Sbloccato il ' || to_char(v_r.sbloccato_il, 'DD/MM/YYYY') || ', ma non risulta da chi.'
    when v_r.sbloccato_da = v_io then
      'L''hai sbloccato tu il ' || to_char(v_r.sbloccato_il, 'DD/MM/YYYY') || '.'
    else
      'Sbloccato da un altro accesso il ' || to_char(v_r.sbloccato_il, 'DD/MM/YYYY') || '.'
  end;

  return next;
end $funzione$;

comment on function chi_ha_messo_il_tetto() is
  'Chi ha messo il tetto di spesa dell''assistente e chi lo ha sbloccato, gia'' in parole. ⚠️ Il «chi» dice solo quello che il gestionale sa: si entra per ruolo e non per persona, quindi «l''hai messo tu» oppure «da un altro accesso» — la stessa forma decisa il 18/08 per la correzione dei coperti. Il tetto senza autore lo DICE, invece di lasciare un vuoto che chi guarda scambia per un guasto.';

revoke all on function chi_ha_messo_il_tetto() from public, anon, authenticated;
grant execute on function chi_ha_messo_il_tetto() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ `impostazioni_ai` e' una riga sola e vera: si salva INTERA e si
--    riscrive intera. Non si cancella niente.
do $verifica$
declare
  v_tit   uuid;
  v_prima impostazioni_ai%rowtype;
  v_torna impostazioni_ai%rowtype;
  v_f     record;
  v_altro uuid;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  select * into v_prima from impostazioni_ai where id;
  if not found then
    raise exception 'Non c''e'' nessuna riga di impostazioni_ai: questa verifica non puo'' girare.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------------
  -- (A) IL TETTO SENZA AUTORE LO DICE, e non tira in ballo nessuno.
  --     🔴 Il controllo che vale di piu': se un domani qualcuno
  --     «sistemasse» la riga scrivendoci un nome, questo diventa rosso.
  -- ------------------------------------------------------------------
  if v_prima.tetto_da is not null then
    raise exception 'Il tetto gia'' esistente risulta attribuito a %: nessuno l''ha deciso in quel momento.', v_prima.tetto_da;
  end if;
  select * into v_f from chi_ha_messo_il_tetto();
  if v_f.tetto_frase not like '%non l''ha messo nessuno%' then
    raise exception 'Il tetto senza autore dice «%», e doveva dire che non l''ha messo nessuno.', v_f.tetto_frase;
  end if;
  if v_f.sblocco_frase is not null then
    raise exception 'Non c''e'' nessuno sblocco e la frase dice «%».', v_f.sblocco_frase;
  end if;
  raise notice 'senza autore: «%»', v_f.tetto_frase;

  -- ------------------------------------------------------------------
  -- (B) DOPO UN GESTO VERO, DICE CHE SEI STATO TU.
  -- ------------------------------------------------------------------
  perform imposta_tetto_ai(coalesce(v_prima.tetto_mensile_euro, 10));
  select * into v_f from chi_ha_messo_il_tetto();
  if v_f.tetto_frase not like 'L''hai messo tu il %' then
    raise exception 'Dopo averlo messo, la frase dice «%».', v_f.tetto_frase;
  end if;
  raise notice 'dopo il gesto: «%»', v_f.tetto_frase;

  perform sblocca_spesa_ai();
  select * into v_f from chi_ha_messo_il_tetto();
  if v_f.sblocco_frase not like 'L''hai sbloccato tu il %' then
    raise exception 'Dopo lo sblocco, la frase dice «%».', v_f.sblocco_frase;
  end if;
  raise notice 'dopo lo sblocco: «%»', v_f.sblocco_frase;

  -- ------------------------------------------------------------------
  -- (C) DA UN ALTRO ACCESSO SI DICE COSI', E NON SI FA NOME.
  --     ⚠️ Serve un accesso VERO e diverso dal mio: un identificativo
  --     inventato viene respinto dalla chiave esterna verso `auth.users`,
  --     e su questo la prima stesura si e' fermata. Un altro dei quattro
  --     accessi del gestionale e' anche il caso realistico — domani, con
  --     gli accessi per persona, sara' esattamente cosi'.
  -- ------------------------------------------------------------------
  select user_id into v_altro from user_roles where user_id <> v_tit limit 1;
  if v_altro is null then
    raise exception 'C''e'' un accesso solo: il caso «da un altro accesso» non si puo'' provare.';
  end if;
  update impostazioni_ai set tetto_da = v_altro, sbloccato_da = v_altro where id;
  select * into v_f from chi_ha_messo_il_tetto();
  if v_f.tetto_frase not like 'Messo da un altro accesso%' then
    raise exception 'Il tetto di un altro accesso dice «%».', v_f.tetto_frase;
  end if;
  if v_f.sblocco_frase not like 'Sbloccato da un altro accesso%' then
    raise exception 'Lo sblocco di un altro accesso dice «%».', v_f.sblocco_frase;
  end if;
  raise notice 'da un altro accesso: «%» / «%»', v_f.tetto_frase, v_f.sblocco_frase;

  -- ------------------------------------------------------------------
  -- SI RIMETTE LA RIGA COM'ERA — intera.
  -- ------------------------------------------------------------------
  update impostazioni_ai
     set tetto_mensile_euro = v_prima.tetto_mensile_euro,
         sbloccato_il       = v_prima.sbloccato_il,
         aggiornato_il      = v_prima.aggiornato_il,
         tetto_da           = v_prima.tetto_da,
         tetto_il           = v_prima.tetto_il,
         sbloccato_da       = v_prima.sbloccato_da
   where id;

  select * into v_torna from impostazioni_ai where id;
  if v_torna is distinct from v_prima then
    raise exception 'La riga non e'' tornata com''era: prima %, adesso %', v_prima, v_torna;
  end if;

  select * into v_f from chi_ha_messo_il_tetto();
  raise notice 'rimessa com''era, e torna a dire: «%»', v_f.tetto_frase;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000013', 'la_riga_sotto_il_tetto_dice_chi') on conflict (version) do nothing;
