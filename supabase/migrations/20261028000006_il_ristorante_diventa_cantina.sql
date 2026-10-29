-- =====================================================================
-- IL RISTORANTE DIVENTA CANTINA — 28/10/2026. Alessio, guardando la scheda
-- dell'impegno: «possiamo tenere solo "casa" e "al ristorante" (che
-- chiamerei cantina)».
-- =====================================================================
--
-- 🔴 CAMBIA ANCHE IL VALORE, NON SOLO LA SCRITTA. Si poteva lasciare
--    `ristorante` dentro e scrivere «Cantina» fuori; ma il valore si vede:
--    è la parola che Alessio scrive nell'automazione dell'iPhone (campo
--    «luogo»), e la pagina «Quando arrivo…» gliela mostra. Una cantina che
--    nel telefono si chiama «ristorante» è una cosa da ricordare a memoria.
--    E oggi costa poco: l'automazione del ristorante non è ancora stata
--    creata, quindi nessun telefono manda già «ristorante».
--
-- ⚠️ LA VOCE CHE DICE ANCORA «RISTORANTE» VA IN CANTINA: «quando arrivo al
--    ristorante» è lo stesso posto, e far nascere l'impegno senza luogo
--    vorrebbe dire non ricordarlo mai.
--
-- ⚠️ I DUE CORPI SI TOCCANO SUL POSTO (`fai_azione_dettata` e
--    `luogo_promemoria`), con la stessa forma della 20261028000002: si
--    prende il corpo vivo e si sostituiscono pezzi esatti, che devono
--    comparire una volta sola. Se il corpo vivo è cambiato, la migrazione
--    si ferma e lo dice.

-- ---------------------------------------------------------------------
-- 1. Gli impegni che c'erano, poi il vincolo
-- ---------------------------------------------------------------------
alter table tasks drop constraint if exists luogo_chiuso;
update tasks set luogo = 'cantina' where luogo = 'ristorante';
alter table tasks add constraint luogo_chiuso
  check (luogo is null or luogo in ('casa', 'cantina'));
comment on constraint luogo_chiuso on tasks is
  'Un promemoria per luogo è legato a uno dei posti che Alessio ha scelto: casa o cantina. Vuoto vuol dire nessun luogo.';

-- ---------------------------------------------------------------------
-- 2. La voce: «cantina», e anche «ristorante», vanno in cantina
-- ---------------------------------------------------------------------
do $fai$
declare
  v_def   text := replace(pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure), E'\r', '');
  v_prima text := E'          when ''ristorante'' then ''ristorante''';
  v_dopo  text := E'          when ''cantina'' then ''cantina'''
               || E'\n          -- 28/10/2026: il ristorante si chiama cantina; chi dice'
               || E'\n          -- ancora «ristorante» intende lo stesso posto.'
               || E'\n          when ''ristorante'' then ''cantina''';
begin
  if v_def like '%when ''cantina'' then ''cantina''%' then
    return;  -- già applicata: idempotente
  end if;
  if (length(v_def) - length(replace(v_def, v_prima, ''))) / length(v_prima) <> 1 then
    raise exception 'fai_azione_dettata nel database non ha il ramo del luogo che questa migrazione si aspetta: guarda il corpo vivo prima di toccarla.';
  end if;
  execute replace(v_def, v_prima, v_dopo);
end $fai$;

revoke all on function fai_azione_dettata(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Il telefono: i luoghi sono casa e cantina
-- ---------------------------------------------------------------------
do $luogo$
declare
  v_def    text := replace(pg_get_functiondef('public.luogo_promemoria(text,text)'::regprocedure), E'\r', '');
  v_guardia_prima text := E'if v_luogo not in (''casa'', ''ristorante'') then';
  v_guardia_dopo  text := E'if v_luogo not in (''casa'', ''cantina'') then';
  v_frase_prima   text := E'i luoghi sono casa e ristorante.';
  v_frase_dopo    text := E'i luoghi sono casa e cantina.';
begin
  if v_def like '%(''casa'', ''cantina'')%' then
    return;  -- già applicata
  end if;
  if (length(v_def) - length(replace(v_def, v_guardia_prima, ''))) / length(v_guardia_prima) <> 1
     or (length(v_def) - length(replace(v_def, v_frase_prima, ''))) / length(v_frase_prima) <> 1 then
    raise exception 'luogo_promemoria nel database non è quella che questa migrazione si aspetta: guarda il corpo vivo prima di toccarla.';
  end if;
  execute replace(replace(v_def, v_guardia_prima, v_guardia_dopo), v_frase_prima, v_frase_dopo);
end $luogo$;

comment on function public.luogo_promemoria(text, text) is
  'Gli impegni aperti di un luogo (casa o cantina), per la notifica che l''iPhone mostra all''arrivo. Si entra con una chiave di chiavi_luogo; 30 letture all''ora per chiave.';
revoke all on function public.luogo_promemoria(text, text) from public, anon, authenticated;
grant execute on function public.luogo_promemoria(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_r        jsonb;
  v_k        jsonb;
  v_luogo    text;
  v_fermo    boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;
  if exists (select 1 from tasks where luogo = 'ristorante') then
    raise exception 'VERIFICA: è rimasto un impegno col luogo «ristorante».';
  end if;
  if not has_function_privilege('anon', 'luogo_promemoria(text, text)', 'execute')
     or has_function_privilege('anon', 'fai_azione_dettata(text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'fai_azione_dettata(text, jsonb)', 'execute') then
    raise exception 'VERIFICA: i permessi delle due funzioni del luogo non sono quelli di prima.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) «ristorante» non si scrive più: il vincolo lo rifiuta.
    v_fermo := false;
    begin
      insert into tasks (title, priority, status, category, visibile_staff, luogo)
      values ('PROVA vecchio nome', 'media', 'da_fare', 'altro', false, 'ristorante');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (1): un impegno col luogo «ristorante» è stato accettato.';
    end if;

    -- (2) La voce: «Cantina» e «ristorante» finiscono tutti e due in cantina.
    v_r := fai_azione_dettata('promemoria', jsonb_build_object('titolo', 'PROVA in cantina', 'luogo', 'Cantina'));
    select luogo into v_luogo from tasks where id = (v_r->>'task_id')::uuid;
    if v_luogo is distinct from 'cantina' then
      raise exception 'VERIFICA (2a): «Cantina» detto a voce ha dato il luogo «%».', v_luogo;
    end if;
    v_r := fai_azione_dettata('promemoria', jsonb_build_object('titolo', 'PROVA al ristorante', 'luogo', 'ristorante'));
    select luogo into v_luogo from tasks where id = (v_r->>'task_id')::uuid;
    if v_luogo is distinct from 'cantina' then
      raise exception 'VERIFICA (2b): «ristorante» detto a voce ha dato il luogo «%».', v_luogo;
    end if;

    -- (3) Il telefono: con «cantina» legge gli impegni della cantina, con
    --     «ristorante» no.
    v_k := crea_chiave_luogo('PROVA telefono');
    perform set_config('request.jwt.claims', null, true);
    v_r := luogo_promemoria(v_k->>'chiave', 'Cantina');
    if not (v_r->'impegni' @> '[{"titolo": "PROVA in cantina"}]'::jsonb) then
      raise exception 'VERIFICA (3a): in cantina il telefono ha letto %.', v_r;
    end if;
    v_fermo := false;
    begin
      perform luogo_promemoria(v_k->>'chiave', 'ristorante');
    exception when others then v_fermo := sqlerrm = 'Questo luogo non lo conosco: i luoghi sono casa e cantina.';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3b): «ristorante» è ancora un luogo che il telefono può chiedere.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della cantina');

  raise notice 'Fatto: i luoghi sono casa e cantina; «ristorante» non si scrive più, a voce va in cantina, e il telefono legge la cantina. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261028000006', 'il_ristorante_diventa_cantina')
on conflict (version) do nothing;
