-- =====================================================================
-- LA VOCE SI CHIUDE INSIEME AL DATO — 26/10/2026 (primo lotto)
-- =====================================================================
-- Una cosa detta a MEMO che non si può approvare si finisce a mano sulla
-- sua schermata. Fino a oggi la schermata salvava il dato e POI, con una
-- seconda chiamata, chiudeva l'azione dettata (`useDaVoce().chiudi()` →
-- `chiudi_azione_a_mano`). Due transazioni: se la seconda falliva, il dato
-- era scritto e l'azione restava «da fare», e la volta dopo la stessa
-- spesa entrava in prima nota una seconda volta. È la forma vietata dalla
-- regola B4 (docs/ARCHITETTURA.md §2, livello 2), trovata dalla verifica
-- architetturale del 25/10/2026.
--
-- Da qui, per la PRIMA NOTA e la SPESA SPICCIOLA (i soldi per primi):
-- quando la scrittura arriva dalla voce, passa da una funzione che chiude
-- l'azione e scrive il dato nella stessa transazione, chiamata dal
-- corridoio. Senza voce resta l'insert diretto di sempre.
--
-- ⚠️ CHIUDE PER PRIMA, SCRIVE DOPO. Per l'atomicità l'ordine non conta
--    (se la scrittura fallisce si annulla anche la chiusura); conta per i
--    lucchetti: `chiudi_azione_a_mano` blocca l'appunto e poi la riga, nello
--    stesso ordine di `approva_appunto`. Così due salvataggi insieme, o un
--    salvataggio e un «Approva», danno un rifiuto e mai un doppione.
--
-- ⚠️ SECURITY INVOKER, e non è una dimenticanza: la scrittura di dominio
--    deve passare dalla stessa RLS dell'insert diretto di oggi, senza un
--    secondo elenco di permessi. La chiusura ha il suo portiere
--    (`is_titolare()` dentro `chiudi_azione_a_mano`, security definer).
-- =====================================================================

do $prerequisiti$
begin
  -- ⚠️ Nome e argomenti separati: la rete `migrazioni-senza-portieri`
  --    legge «nome(» come una chiamata, e qui la funzione si nomina soltanto.
  if to_regprocedure('public.chiudi_azione_a_mano' || '(uuid)') is null then
    raise exception 'FERMO: manca la funzione chiudi_azione_a_mano, che arriva con la 20260906000007.';
  end if;
end $prerequisiti$;

-- ---------------------------------------------------------------------
-- 1 · Chiudere la cosa detta dalla schermata dove la si finisce
-- ---------------------------------------------------------------------
-- Un'azione «temperatura» non si chiude con un movimento di cassa: se la
-- schermata passasse l'id sbagliato, chiuderebbe una cosa che non ha fatto.
--
-- ⚠️ IL CONFRONTO È SUL PERCORSO, non su un elenco di tipi scritto qui: la
--    schermata dove si finisce una cosa detta la decide `azione_percorso()`
--    (dal 25/10 anche dalla tabella `tipi_azione_vocale`). Un tipo nuovo che
--    porta alla prima nota si chiude dalla prima nota senza toccare questa
--    funzione; con un elenco fisso sarebbe stato rifiutato, e non si sarebbe
--    potuto finire a mano (revisione ecc:code-reviewer del 26/10).
--
-- ⚠️ E SE LA CHIUSURA RIFIUTA, IL RIFIUTO DICE CHE IL DATO NON C'È: «l'avevi
--    già finita a mano» da solo lascia credere che il movimento sia entrato.
create or replace function chiudi_azione_dalla_schermata(p_id uuid, p_schermata text, p_esito text)
returns void
language plpgsql
security invoker -- legge azioni_dettate con la RLS di chi chiama; la chiusura ha il suo portiere
set search_path = public
as $$
declare
  v_tipo text;
begin
  select tipo into v_tipo from azioni_dettate where id = p_id;
  if v_tipo is null then
    raise exception 'Questa cosa detta non c''e'' piu'': %', p_esito;
  end if;
  if split_part(coalesce(azione_percorso(v_tipo), ''), '?', 1) is distinct from p_schermata then
    raise exception 'Questa cosa detta non si finisce da questa schermata: %', p_esito;
  end if;
  begin
    perform chiudi_azione_a_mano(p_id);
  exception when others then
    raise exception '% Quindi %', sqlerrm, p_esito;
  end;
end $$;

-- ---------------------------------------------------------------------
-- 2 · La prima nota
-- ---------------------------------------------------------------------
-- 🔴 LE COLONNE SONO QUELLE CHE LA SCHERMATA MANDA, e solo quelle: il
--    resto prende il valore predefinito della tabella, esattamente come
--    l'insert diretto. `jsonb_populate_record` da solo metterebbe a null
--    anche `id`, `created_at` e ogni altro predefinito. Un campo che la
--    tabella non ha viene rifiutato per nome, invece di sparire.
create or replace function registra_movimento_cassa(p_movimento jsonb, p_azione_dettata_id uuid default null)
returns uuid
language plpgsql
security invoker -- la RLS di cash_movements resta l'unica barriera, come per l'insert diretto
set search_path = public
as $$
declare
  v_sconosciuti text;
  v_colonne     text;
  v_id          uuid;
begin
  if p_movimento is null or jsonb_typeof(p_movimento) <> 'object' or p_movimento = '{}'::jsonb then
    raise exception 'Il movimento e'' vuoto.';
  end if;

  select string_agg(k, ', ' order by k) into v_sconosciuti
    from jsonb_object_keys(p_movimento) k
   where not exists (
     select 1 from pg_attribute a
      where a.attrelid = 'public.cash_movements'::regclass
        and a.attname = k and a.attnum > 0 and not a.attisdropped);
  if v_sconosciuti is not null then
    raise exception 'Il movimento ha dei campi che la prima nota non conosce: %', v_sconosciuti;
  end if;

  if p_azione_dettata_id is not null then
    perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/cassa/prima-nota', 'il movimento non e'' stato registrato.');
  end if;

  select string_agg(quote_ident(k), ', ') into v_colonne from jsonb_object_keys(p_movimento) k;
  execute format(
    'insert into cash_movements (%1$s) select %1$s from jsonb_populate_record(null::cash_movements, $1) returning id',
    v_colonne)
    into v_id
    using p_movimento;

  return v_id;
end $$;

comment on function registra_movimento_cassa(jsonb, uuid) is
  'Un movimento di prima nota e, se arriva da MEMO voce, la chiusura della cosa detta: una transazione. Senza voce la schermata scrive diretta (createCashMovement).';

-- ---------------------------------------------------------------------
-- 3 · La spesa spicciola
-- ---------------------------------------------------------------------
create or replace function aggiungi_spesa_spicciola(
  p_articolo text,
  p_categoria text default null,
  p_nota text default null,
  p_azione_dettata_id uuid default null)
returns uuid
language plpgsql
security invoker -- la RLS di spesa_spicciola resta l'unica barriera, come per l'insert diretto
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(coalesce(p_articolo, '')), '') is null then
    raise exception 'Scrivi cosa comprare.';
  end if;

  if p_azione_dettata_id is not null then
    perform chiudi_azione_dalla_schermata(p_azione_dettata_id, '/magazzino/spesa-spicciola', 'la spesa non e'' stata aggiunta.');
  end if;

  insert into spesa_spicciola (articolo, categoria, nota)
  values (btrim(p_articolo), nullif(btrim(coalesce(p_categoria, '')), ''), nullif(btrim(coalesce(p_nota, '')), ''))
  returning id into v_id;

  return v_id;
end $$;

comment on function aggiungi_spesa_spicciola(text, text, text, uuid) is
  'Una voce della spesa spicciola e, se arriva da MEMO voce, la chiusura della cosa detta: una transazione. Senza voce la schermata scrive diretta (aggiungiSpesaSpicciola).';

revoke all on function chiudi_azione_dalla_schermata(uuid, text, text) from public, anon;
revoke all on function registra_movimento_cassa(jsonb, uuid) from public, anon;
revoke all on function aggiungi_spesa_spicciola(text, text, text, uuid) from public, anon;
grant execute on function chiudi_azione_dalla_schermata(uuid, text, text) to authenticated;
grant execute on function registra_movimento_cassa(jsonb, uuid) to authenticated;
grant execute on function aggiungi_spesa_spicciola(text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4 · Verifica — tutto provato e annullato
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto    jsonb := foto_righe();
  v_tit     uuid;
  v_det     uuid;
  v_az      uuid;
  v_az2     uuid;
  v_app     uuid;
  v_mov     uuid;
  v_ent     uuid;
  v_n       integer;
  v_rifiuto boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  select id into v_ent from entities order by created_at limit 1;
  if v_ent is null then
    raise exception 'VERIFICA: non c''e'' nessuna entita'' su cui registrare un movimento.';
  end if;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    insert into dettature (testo, provenienza, esito)
    values ('prova migrazione: la voce si chiude col dato', 'app', 'capita') returning id into v_det;

    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det, 1, 'movimento_cassa', '{}'::jsonb, true, 'ZZ verifica cassa', 'prova', 'in_attesa')
    returning id, appunto_id into v_az, v_app;

    -- (1) Il giro completo: il movimento c'è, l'azione è finita a mano.
    v_mov := registra_movimento_cassa(
      jsonb_build_object('entity_id', v_ent, 'direction', 'uscita', 'amount', 1.23,
                         'movement_date', current_date, 'note', 'ZZ verifica voce'),
      v_az);
    if not exists (select 1 from cash_movements where id = v_mov and amount = 1.23) then
      raise exception 'VERIFICA: il movimento non e'' stato scritto.';
    end if;
    if (select stato from azioni_dettate where id = v_az) is distinct from 'fatta_a_mano' then
      raise exception 'VERIFICA: l''azione dettata non si e'' chiusa insieme al movimento.';
    end if;
    if (select created_at from cash_movements where id = v_mov) is null then
      raise exception 'VERIFICA: i valori predefiniti della tabella si sono persi.';
    end if;

    -- (2) 🔴 Il doppione che questa migrazione esiste per togliere: la
    --     stessa azione una seconda volta viene rifiutata e NON scrive.
    select count(*) into v_n from cash_movements where note = 'ZZ verifica voce';
    v_rifiuto := false;
    begin
      perform registra_movimento_cassa(
        jsonb_build_object('entity_id', v_ent, 'direction', 'uscita', 'amount', 1.23,
                           'movement_date', current_date, 'note', 'ZZ verifica voce'),
        v_az);
    exception when others then v_rifiuto := true;
    end;
    if not v_rifiuto then
      raise exception 'VERIFICA: la stessa cosa detta si e'' chiusa due volte.';
    end if;
    if (select count(*) from cash_movements where note = 'ZZ verifica voce') <> v_n then
      raise exception 'VERIFICA: il secondo tentativo ha scritto un movimento in piu''.';
    end if;

    -- (3) Il tipo sbagliato non chiude niente.
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
    values (v_det, 2, 'spesa_spicciola', '{}'::jsonb, true, 'ZZ verifica tipo', 'prova', 'in_attesa')
    returning id into v_az2;
    v_rifiuto := false;
    begin
      perform registra_movimento_cassa(
        jsonb_build_object('entity_id', v_ent, 'direction', 'uscita', 'amount', 2, 'movement_date', current_date),
        v_az2);
    exception when others then v_rifiuto := true;
    end;
    if not v_rifiuto or (select stato from azioni_dettate where id = v_az2) <> 'in_attesa' then
      raise exception 'VERIFICA: una spesa spicciola detta si e'' chiusa con un movimento di cassa.';
    end if;

    -- (4) Un campo che la tabella non ha viene rifiutato per nome.
    v_rifiuto := false;
    begin
      perform registra_movimento_cassa(jsonb_build_object('entity_id', v_ent, 'campo_inventato', 1), null);
    exception when others then
      v_rifiuto := sqlerrm like '%campo_inventato%';
    end;
    if not v_rifiuto then
      raise exception 'VERIFICA: un campo sconosciuto non e'' stato rifiutato per nome.';
    end if;

    -- (5) La spesa spicciola: scritta e chiusa insieme.
    perform aggiungi_spesa_spicciola('ZZ verifica voce', null, null, v_az2);
    if not exists (select 1 from spesa_spicciola where articolo = 'ZZ verifica voce') then
      raise exception 'VERIFICA: la spesa spicciola non e'' stata scritta.';
    end if;
    if (select stato from azioni_dettate where id = v_az2) is distinct from 'fatta_a_mano' then
      raise exception 'VERIFICA: la spesa spicciola detta non si e'' chiusa.';
    end if;
    if (select stato from appunti_vocali where id = v_app) is distinct from 'approvato' then
      raise exception 'VERIFICA: chiuse tutte le righe, l''appunto e'' rimasto aperto.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica della voce chiusa col dato');

  raise notice 'Fatto: prima nota e spesa spicciola dette a MEMO si scrivono e si chiudono in una transazione; la seconda volta viene rifiutata. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261026000002', 'la_voce_si_chiude_insieme_al_dato')
on conflict (version) do nothing;
