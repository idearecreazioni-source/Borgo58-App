-- ============================================================================
-- 20260828000012 — la Posta dice se MEMO sta leggendo
-- ============================================================================
--
-- MISURATO il 28/08/2026, partendo da tre schermate di Alessio: tre mail sul
-- progetto di prova, del 19, 20 e 21 agosto, dicevano tutte e tre «Non ancora
-- letta — la lettura parte da sola entro un quarto d'ora». Erano li' da NOVE
-- GIORNI, e il computer era rimasto acceso quasi sempre.
--
-- QUALE DELLE DUE, misurato e non dedotto:
--   · sul progetto di prova `cron.job` e' VUOTO — zero lavori pianificati;
--   · in produzione ce ne sono SEI, e battono da due minuti;
--   · ma l'ultimo battito della lettura sulla prova e' del 23/08 all'01:00.
-- Quindi non e' «non e' mai stato acceso» (che era la mia prima
-- conclusione, e la misura l'ha corretta): ha girato fino al 23/08 e poi si
-- e' fermato.
--
-- PERCHE' SI E' FERMATO, ed e' il telaio: `npm run prova:ricostruisci`
-- TOGLIE tutti i lavori pianificati prima di svuotare lo schema — ed e'
-- giusto, restare programmati su funzioni che stanno per sparire produce
-- errori a ripetizione. A rimetterli sono le sei migrazioni che li creano;
-- ma `prova:migra` applica solo le migrazioni MANCANTI, e quelle risultano
-- gia' applicate. Basta un giro che tolga i lavori senza riapplicare tutto,
-- e il progetto di prova resta senza niente che gira.
-- ⚠️ E NESSUNO LO GRIDA, perche' la sentinella che sorveglia i lavori E' essa
--    stessa uno dei lavori: un testimone non testimonia della propria
--    assenza. E' un limite gia' dichiarato dal 12/08, e oggi si e' visto
--    cosa costa.
--
-- COSA FA QUESTA MIGRAZIONE — non rimette i lavori (quello e' un gesto, non
-- una migrazione): fa in modo che LA SCHERMATA POSSA DIRE IL VERO.
--
-- 🔴 LA RISPOSTA C'ERA GIA', E NESSUNO POTEVA LEGGERLA. `lavori_in_silenzio()`
--    esiste dal 12/08, sa gia' che la lettura e' muta da 8374 minuti, e ha
--    gia' la frase giusta — «La posta in arrivo non viene piu' letta: fatture
--    e documenti restano fermi nella sala d'aspetto». Era eseguibile dal solo
--    proprietario del database. E' la terza volta oggi che il gestionale sa
--    una cosa e non ha modo di dirla: come `riprova_lettura_posta`, che
--    esisteva dal 12/08 senza nessun pulsante.
--
-- ⚠️ NON si duplica la regola: `lettore_posta_fermo()` DOMANDA a
--    `lavori_in_silenzio()`. Chi decide se un lavoro e' muto resta uno solo,
--    con la sua tolleranza scritta in `lavori_sorvegliati` (45 minuti per la
--    lettura) invece che in una schermata.
-- ============================================================================

create or replace function public.lettore_posta_fermo()
returns table(fermo boolean, minuti integer, cosa_smette text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and not is_titolare() then
    raise exception 'Solo il titolare puo'' sapere se MEMO sta leggendo la posta';
  end if;

  return query
    select true, s.minuti, s.cosa_smette
      from lavori_in_silenzio() s
     where s.nome_lavoro = 'lettura_posta';

  if not found then
    return query select false, 0, null::text;
  end if;
end
$function$;

revoke all on function public.lettore_posta_fermo() from public, anon, authenticated;
grant execute on function public.lettore_posta_fermo() to authenticated;

comment on function public.lettore_posta_fermo() is
  'Se MEMO sta leggendo la posta oppure no, e da quanto tace. Non decide '
  'niente da se'': lo CHIEDE a `lavori_in_silenzio()`, che e'' l''unico posto '
  'dove si stabilisce quando un lavoro pianificato e'' muto. Serve alla '
  'schermata della Posta per non promettere «la lettura parte da sola entro '
  'un quarto d''ora» quando nessuno sta leggendo niente.';

CREATE OR REPLACE FUNCTION public.chiedi_lettura_posta()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_firma text;
  v_anon  text;
  v_base  text;
  n       integer;
begin
  -- IL PORTIERE E' `auth.uid() is not null`, NON `is_titolare()`.
  -- Questa funzione ha DUE chiamanti con due identita' diverse: il lavoro
  -- pianificato, che gira come proprietario del database e per cui
  -- `is_titolare()` e' FALSO, e il titolare che preme «Leggila adesso».
  -- Un portiere scritto `if not is_titolare()` avrebbe spento la lettura
  -- automatica della posta in silenzio — e' la trappola misurata il
  -- 27/08/2026, dove la stessa cura sbagliata avrebbe rotto due funzioni.
  if auth.uid() is not null and not is_titolare() then
    raise exception 'Solo il titolare puo'' chiedere a MEMO di leggere la posta adesso';
  end if;

  select count(*) into n from posta_ricevuta where stato = 'da_leggere';
  if n = 0 then
    -- Niente da leggere: nessuna chiamata, nessun costo — ma il giro c'è
    -- stato, e va scritto. È la giornata normale: sorvegliare solo i giri
    -- che chiamano l'AI significherebbe un allarme ogni notte tranquilla.
    insert into stato_lavori (nome, ultimo_successo)
    values ('lettura_posta', now())
    on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;
    return false;
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  -- Qui il battito NON si scrive: c'era posta da leggere e non è stata
  -- letta. È un guasto, e la sentinella deve vederlo.
  if v_firma is null or v_anon is null then
    raise warning 'Posta non letta: parola d''ordine assente dal Vault.';
    return false;
  end if;

  perform net.http_post(
    url := v_base || '/posta-leggi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := '{}'::jsonb
  );

  insert into stato_lavori (nome, ultimo_successo)
  values ('lettura_posta', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return true;
end
$function$

;

-- Il titolare puo' chiedere la lettura adesso; il lavoro pianificato
-- continua a passare perche' il portiere guarda `auth.uid()`.
grant execute on function public.chiedi_lettura_posta() to authenticated;

do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_staff uuid;
  v_fermo boolean;
  v_min   integer;
  v_frase text;
  v_ok    boolean;
begin
  v_foto := foto_righe();
  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare configurato';
  end if;

  -- ------------------------------------------------------------------
  -- 1. Come PROPRIETARI (cioe' come il lavoro pianificato) si passa.
  --    ⚠️ E' il controllo che avrebbe preso la cura sbagliata: un portiere
  --    scritto `if not is_titolare()` avrebbe spento la lettura automatica.
  -- ------------------------------------------------------------------
  select f.fermo into v_fermo from lettore_posta_fermo() f;
  if v_fermo is null then
    raise exception 'lettore_posta_fermo non risponde a chi gira come il lavoro pianificato';
  end if;

  -- ------------------------------------------------------------------
  -- 2. Come TITOLARE si passa, e la risposta dice da quanto tace e cosa
  --    smette di funzionare — non un booleano nudo.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select f.fermo, f.minuti, f.cosa_smette into v_fermo, v_min, v_frase
    from lettore_posta_fermo() f;
  if v_fermo is null then
    raise exception 'Il titolare non riesce a sapere se MEMO sta leggendo';
  end if;
  if v_fermo and (v_min is null or v_frase is null) then
    raise exception 'Dice che e'' fermo senza dire da quanto ne'' cosa smette: % / %', v_min, v_frase;
  end if;
  perform set_config('request.jwt.claims', null, true);

  -- ------------------------------------------------------------------
  -- 3. Lo STAFF no: e' roba del titolare, e si RIFIUTA invece di
  --    rispondere un elenco vuoto — una schermata vuota e' una
  --    rassicurazione falsa.
  -- ------------------------------------------------------------------
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin
      perform * from lettore_posta_fermo();
      v_ok := true;
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', null, true);
    if v_ok then
      raise exception 'Lo staff riesce a sapere se MEMO sta leggendo la posta';
    end if;

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin
      perform chiedi_lettura_posta();
      v_ok := true;
    exception when others then null;
    end;
    perform set_config('request.jwt.claims', null, true);
    if v_ok then
      raise exception 'Lo staff riesce a far partire una lettura che si paga';
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- 4. I permessi: il titolare puo', l'anonimo no.
  -- ------------------------------------------------------------------
  if not has_function_privilege('authenticated', 'public.lettore_posta_fermo()', 'execute') then
    raise exception 'Il titolare non puo'' eseguire lettore_posta_fermo';
  end if;
  if has_function_privilege('anon', 'public.lettore_posta_fermo()', 'execute')
     or has_function_privilege('anon', 'public.chiedi_lettura_posta()', 'execute') then
    raise exception 'Un anonimo puo'' eseguirne una delle due';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la Posta che dice se MEMO sta leggendo');

  raise notice 'La schermata puo'' sapere se MEMO sta leggendo la posta e da quanto tace, il titolare puo'' chiedere una lettura adesso, e il lavoro pianificato continua a passare.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000012', 'la_posta_dice_se_memo_sta_leggendo')
on conflict (version) do nothing;
