-- =====================================================================
-- Borgo 58 · Le prove automatiche non suonano il telefono
-- =====================================================================
-- 19/09/2026.
--
-- 🔴 IL DIFETTO, MISURATO. Da quando Borgo58-Prova ha il bot Telegram (per
--    i test a mano, stesso bot e stesso canale della produzione), ogni giro
--    di `npm run test:app` — a ogni proposta e a ogni unione in `slave` —
--    manda messaggi veri. Il 19/09 fra le 18:12 e le 18:26 UTC, durante i
--    controlli di una proposta, il registro delle risposte di Prova ha tre
--    invii accettati da Telegram. Uno è l'allarme che `tests/app/allarmi.test.js`
--    provoca apposta (un identificativo malformato su
--    `close_order_as_discount_gift`), e nel gestionale non ne resta traccia
--    perché la prova lo cancella finendo.
--
-- ⚠️ LA CURA NON È SPEGNERE IL BOT: servirebbe per i test a mano. È un
--    SILENZIO A TEMPO, che le prove aprono all'inizio e chiudono alla fine.
--
-- 🔴 UN SILENZIO PER GIRO, NON UN INTERRUTTORE. Due giri di prove possono
--    sovrapporsi (due proposte insieme): con un interruttore unico, il primo
--    che finisce riaccenderebbe il telefono sotto il secondo. Ogni giro apre
--    una riga sua e chiude solo quella; si tace finché ne resta una aperta.
--
-- 🔴 E OGNI SILENZIO SCADE DA SÉ. Un giro che muore a metà non chiude la sua
--    riga: senza scadenza, Prova resterebbe muta per sempre e il primo test a
--    mano sembrerebbe un guasto. Il tetto è 90 minuti.
--
-- ⚠️ CHE COSA SI TACE, E CHE COSA NO — la decisione sta nella funzione
--    online (`notify-telegram-reservation/silenzio.ts`), non qui:
--      · allarmi e prenotazioni dal form: si tacciono. Nascono da un fatto
--        che avviene una volta, e l'allarme resta comunque scritto in
--        `allarmi` — si toglie solo lo squillo.
--      · promemoria dell'Agenda: NON si tacciono. Li crea una persona, e
--        rispondere «muto» li farebbe risultare mancati. Le prove non ne
--        creano di scaduti (lo controlla `promemoria-che-avvisa.test.js`).
--
-- ⚠️ SOLO SU PROVA. Aprire un silenzio fuori da Borgo58-Prova è RIFIUTATO
--    qui, e la funzione online non guarda nemmeno la tabella fuori da Prova:
--    due barriere, così in produzione questa migrazione non cambia niente.
-- =====================================================================

create table if not exists silenzi_notifiche (
  id         uuid primary key default gen_random_uuid(),
  aperto_il  timestamptz not null default now(),
  scade_il   timestamptz not null,
  motivo     text not null,
  aperto_da  uuid,
  constraint silenzi_notifiche_scadenza_check
    check (scade_il > aperto_il and scade_il <= aperto_il + interval '90 minutes'),
  constraint silenzi_notifiche_motivo_check
    check (length(btrim(motivo)) > 0)
);

comment on table silenzi_notifiche is
  'Un silenzio a tempo sulle notifiche Telegram di Borgo58-Prova, aperto da un giro di prove automatiche e chiuso alla fine. Si tace finché ne resta uno non scaduto. Non ha effetto fuori da Prova.';
comment on constraint silenzi_notifiche_scadenza_check on silenzi_notifiche is
  'Un silenzio scade dopo il suo inizio e dura al massimo 90 minuti: uno senza scadenza lascerebbe Prova muta per sempre.';
comment on constraint silenzi_notifiche_motivo_check on silenzi_notifiche is
  'Un silenzio dice sempre perché è stato aperto.';

alter table silenzi_notifiche enable row level security;
drop policy if exists silenzi_notifiche_titolare on silenzi_notifiche;
create policy silenzi_notifiche_titolare on silenzi_notifiche
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- Questo database è Borgo58-Prova? Lo dice l'indirizzo delle sue funzioni,
-- che sta nel Vault (vedi `url_delle_funzioni`, 20260917000001).
-- ---------------------------------------------------------------------
create or replace function siamo_su_prova()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_url text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'url_funzioni';
  return coalesce(v_url, '') like 'https://bnwqgpuyzmzujxfbtyvs.supabase.co/%';
end
$funzione$;

comment on function siamo_su_prova() is
  'Vero solo se l''indirizzo delle funzioni di questo database è quello di Borgo58-Prova. Senza indirizzo è falso: non si tira a indovinare.';
revoke all on function siamo_su_prova() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Apri e chiudi: solo il titolare (le prove entrano come titolare di prova)
-- ---------------------------------------------------------------------
create or replace function apri_silenzio_notifiche(p_minuti integer, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_id uuid;
begin
  if not (select is_titolare()) then
    raise exception 'Solo il titolare può zittire le notifiche.' using errcode = '42501';
  end if;
  if not siamo_su_prova() then
    raise exception 'Le notifiche si zittiscono solo su Borgo58-Prova: qui non è permesso.';
  end if;
  if p_minuti is null or p_minuti < 1 or p_minuti > 90 then
    raise exception 'Un silenzio dura da 1 a 90 minuti.';
  end if;

  insert into silenzi_notifiche (scade_il, motivo, aperto_da)
  values (now() + make_interval(mins => p_minuti), p_motivo, auth.uid())
  returning id into v_id;

  -- I silenzi scaduti non servono più a niente: si tolgono qui, così la
  -- tabella non cresce e non serve un lavoro pianificato in più.
  delete from silenzi_notifiche where scade_il < now() - interval '1 day';

  return v_id;
end
$funzione$;

create or replace function chiudi_silenzio_notifiche(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
begin
  if not (select is_titolare()) then
    raise exception 'Solo il titolare può riaccendere le notifiche.' using errcode = '42501';
  end if;
  -- ⚠️ Chiude SOLO il proprio silenzio: un giro che finisce non deve
  --    riaccendere il telefono sotto un altro giro ancora in corso.
  delete from silenzi_notifiche where id = p_id;
end
$funzione$;

-- La domanda che fa la funzione online, con la chiave di servizio.
create or replace function notifiche_zittite()
returns boolean
language sql
stable
security definer
set search_path = public
as $funzione$
  select siamo_su_prova()
     and exists (select 1 from silenzi_notifiche where scade_il > now());
$funzione$;

comment on function apri_silenzio_notifiche(integer, text) is
  'Apre un silenzio a tempo sulle notifiche Telegram di Prova e ne restituisce l''identificativo. Solo titolare, solo su Borgo58-Prova, da 1 a 90 minuti.';
comment on function chiudi_silenzio_notifiche(uuid) is
  'Chiude il silenzio indicato, e solo quello.';
comment on function notifiche_zittite() is
  'C''è un silenzio aperto e non scaduto, su Borgo58-Prova? La chiama notify-telegram-reservation prima di mandare un allarme o una prenotazione.';

revoke all on function apri_silenzio_notifiche(integer, text) from public, anon, authenticated;
revoke all on function chiudi_silenzio_notifiche(uuid) from public, anon, authenticated;
revoke all on function notifiche_zittite() from public, anon, authenticated;
grant execute on function apri_silenzio_notifiche(integer, text) to authenticated;
grant execute on function chiudi_silenzio_notifiche(uuid) to authenticated;
grant execute on function notifiche_zittite() to service_role;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto   jsonb := foto_righe();
  v_tit    uuid;
  v_staff  uuid;
  v_prova  boolean := siamo_su_prova();
  v_id     uuid;
  v_id2    uuid;
  v_preso  boolean;
begin
  if has_function_privilege('anon', 'public.apri_silenzio_notifiche(integer,text)'::regprocedure, 'execute')
     or has_function_privilege('anon', 'public.notifiche_zittite()'::regprocedure, 'execute')
     or has_function_privilege('authenticated', 'public.notifiche_zittite()'::regprocedure, 'execute') then
    raise exception 'VERIFICA: una funzione del silenzio è aperta a chi non deve.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- 1. Lo staff è respinto.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  v_preso := false;
  begin
    perform apri_silenzio_notifiche(10, 'verifica 20260919000001');
  exception when others then
    v_preso := true;
  end;
  if not v_preso then
    raise exception 'VERIFICA: lo staff ha zittito le notifiche.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  if not v_prova then
    -- 2a. Fuori da Prova si rifiuta, e non si zittisce niente.
    v_preso := false;
    begin
      perform apri_silenzio_notifiche(10, 'verifica 20260919000001');
    exception when others then
      v_preso := true;
    end;
    if not v_preso or notifiche_zittite() then
      raise exception 'VERIFICA: fuori da Prova il silenzio non deve aprirsi.';
    end if;
  else
    -- 2b. Su Prova: fuori limiti rifiutato; due giri sovrapposti; chiudere
    --     il primo non riaccende sotto il secondo.
    v_preso := false;
    begin
      perform apri_silenzio_notifiche(91, 'verifica 20260919000001');
    exception when others then
      v_preso := true;
    end;
    if not v_preso then
      raise exception 'VERIFICA: un silenzio di 91 minuti è stato accettato.';
    end if;

    v_id  := apri_silenzio_notifiche(10, 'verifica 20260919000001 · primo giro');
    v_id2 := apri_silenzio_notifiche(10, 'verifica 20260919000001 · secondo giro');
    if not notifiche_zittite() then
      raise exception 'VERIFICA: con due silenzi aperti le notifiche non risultano zittite.';
    end if;
    perform chiudi_silenzio_notifiche(v_id);
    if not notifiche_zittite() then
      raise exception 'VERIFICA: chiudere il primo giro ha riacceso sotto il secondo.';
    end if;
    perform chiudi_silenzio_notifiche(v_id2);
    -- ⚠️ Un giro vero può essere in corso proprio adesso: si controlla solo
    --    che i miei due non ci siano più, non che la tabella sia vuota.
    if exists (select 1 from silenzi_notifiche where id in (v_id, v_id2)) then
      raise exception 'VERIFICA: un silenzio chiuso è rimasto aperto.';
    end if;
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della 20260919000001');

  raise notice 'Verifica passata (su Prova: %).', v_prova;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260919000001', 'le_prove_automatiche_non_suonano') on conflict (version) do nothing;
