-- =====================================================================
-- SPEC-0013 — l'appunto si tiene fermo mentre ci si scrive dentro
-- =====================================================================
-- 🔴 IL DIFETTO PEGGIORE DI TUTTO IL BLOCCO, trovato dalla terza revisione
--    del diff: **una cosa detta poteva sparire dalla coda senza che nessuno
--    lo sapesse.**
--
--    Il giro: `appunto_per` trovava l'appunto aperto della lista e lo
--    restituiva **senza tenerlo fermo**; il trigger ci attaccava la riga
--    nuova. Se in quell'istante Alessio approvava o buttava quell'appunto,
--    la chiusura passava per prima e la riga si ritrovava **`in_attesa`
--    sotto un appunto `approvato`**. Da li' in poi non compariva piu' in
--    `appunti_da_approvare()`, che guarda i soli appunti aperti.
--
-- ⚠️ NON DAVA NESSUN ERRORE, ed e' quello che lo rende il piu' grave: la
--    dettatura rispondeva «fatto», la riga esisteva nel database, e non era
--    da nessuna parte. E' la forma che questo progetto insegue da settimane
--    — *una risposta piu' corta che ha l'aria di essere intera* — applicata
--    alla cosa che il modulo esiste per proteggere.
--
-- ⚠️ E NON ERA LA GARA CHIUSA IERI. Quella era fra due dettature che
--    aprivano lo stesso gruppo; questa e' fra **una dettatura e una
--    chiusura**. Stessa famiglia, due istanti diversi: chiudere il primo
--    non chiudeva il secondo.
--
-- LA CURA, e vale la pena scriverla perche' e' una riga sola: chi si
-- aggancia a un appunto **lo tiene fermo** (`for update`) fino a quando ha
-- finito di scriverci dentro. Da li' in poi l'ordine e' garantito nei due
-- versi:
--   · se arriva prima la dettatura, la chiusura aspetta e poi trova anche
--     la riga nuova — che e' cio' che deve succedere;
--   · se arriva prima la chiusura, la rilettura non trova piu' un appunto
--     aperto (il lucchetto rivaluta la condizione dopo averlo preso) e il
--     giro successivo ne apre uno nuovo.
--
-- ⚠️ E l'ordine dei lucchetti resta quello di tutti gli altri — **prima
--    l'appunto, poi le righe** — quindi non nasce nessun blocco incrociato
--    con `approva_appunto`, `scarta_appunto` e `chiudi_azione_a_mano`.

-- rete-guardie: appunto_per — nessuna riga si perde: il messaggio resta, cambia che l'appunto trovato viene tenuto fermo
create or replace function appunto_per(p_tipo text, p_libera text, p_dati jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_d    record;
  v_key  text;
  v_id   uuid;
  v_giro integer;
begin
  select * into v_d from destinazione_vocale(p_tipo, p_libera);
  v_key := chiave_gruppo_vocale(p_tipo, v_d.additivo, p_dati);

  -- Le destinazioni che non si raggruppano non hanno niente da cercare:
  -- ognuna il suo appunto, sempre. Nasce qui, quindi e' gia' solo nostro.
  if v_key is null then
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
    values (p_tipo, v_d.titolo, v_d.eseguibile, null)
    returning id into v_id;
    return v_id;
  end if;

  for v_giro in 1..3 loop
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
    values (p_tipo, v_d.titolo, v_d.eseguibile, v_key)
    on conflict (chiave_gruppo) where (stato = 'aperto' and chiave_gruppo is not null)
    do nothing
    returning id into v_id;

    if v_id is not null then
      return v_id;
    end if;

    -- 🔴 `for update` — LA RIGA CHE IMPEDISCE ALLA DETTATURA DI SPARIRE.
    --    Tiene fermo l'appunto fino alla fine di questa transazione, cioe'
    --    fino a quando la riga nuova e' dentro. Una chiusura che arrivi in
    --    quell'istante aspetta, e poi trova anche lei.
    -- ⚠️ E se la chiusura era arrivata PRIMA, il lucchetto rivaluta la
    --    condizione dopo averlo preso: l'appunto non risulta piu' aperto,
    --    qui non torna niente, e il giro dopo ne apre uno nuovo.
    select id into v_id from appunti_vocali
     where chiave_gruppo = v_key and stato = 'aperto'
     limit 1
     for update;

    if v_id is not null then
      return v_id;
    end if;
  end loop;

  raise exception 'Non sono riuscito a trovare o aprire l''appunto della lista «%»: riprova.', v_key;
end $$;

comment on function appunto_per(text, text, jsonb) is
  'Trova l''appunto aperto di quel gruppo o ne apre uno, e lo TIENE FERMO finche'' chi lo ha chiesto non ha finito di scriverci dentro. Senza il lucchetto una cosa detta poteva finire sotto un appunto appena chiuso e sparire dalla coda, senza nessun errore.';

do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_id     uuid;
  v_id2    uuid;
  v_app    uuid;
  v_app2   uuid;
  v_key    text;
  v_lapidi bigint;
  v_lapidi2 bigint;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- La verifica si costruisce la propria destinazione additiva: nessun
  -- catalogo vero viene toccato nemmeno per un istante.
  insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile)
  values ('zzz_verifica_lucchetto', 'misura', 'Verifica del lucchetto', null, true, true, false);

  insert into dettature (testo, provenienza, esito)
  values ('prova migrazione: lucchetto', 'app', 'capita') returning id into v_det;

  v_key := gen_random_uuid()::text;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'zzz_verifica_lucchetto', jsonb_build_object('lista', v_key), true, 'prima', 'prova', 'in_attesa')
  returning id, appunto_id into v_id, v_app;

  -- 🔴 IL CONTROLLO CHE VALE: chiuso l'appunto, una riga nuova dello stesso
  --    gruppo NON ci finisce dentro — ne apre uno suo. E' la meta' del
  --    difetto che si puo' riprodurre stando fermi; l'altra meta' — i due
  --    gesti che si sovrappongono davvero — si misura con due sessioni, e
  --    quella misura e' nel riepilogo, non qui.
  update appunti_vocali set stato = 'approvato', chiuso_il = now() where id = v_app;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 2, 'zzz_verifica_lucchetto', jsonb_build_object('lista', v_key), true, 'seconda', 'prova', 'in_attesa')
  returning id, appunto_id into v_id2, v_app2;

  if v_app2 = v_app then
    raise exception 'VERIFICA: una riga nuova e'' finita dentro un appunto gia'' chiuso.';
  end if;
  if (select stato from appunti_vocali where id = v_app2) is distinct from 'aperto' then
    raise exception 'VERIFICA: l''appunto nuovo non e'' aperto.';
  end if;

  -- ⚠️ E il fatto che conta per chi guarda: nessuna riga in attesa sotto un
  --    appunto chiuso. E' la proprieta' che il difetto rompeva.
  if exists (
    select 1 from azioni_dettate a join appunti_vocali p on p.id = a.appunto_id
     where a.stato in ('in_attesa', 'fallita') and p.stato <> 'aperto'
       and a.id in (v_id2)
  ) then
    raise exception 'VERIFICA: una riga da approvare sta sotto un appunto chiuso.';
  end if;

  -- --- pulizia -------------------------------------------------------
  delete from azioni_dettate where id in (v_id, v_id2);
  delete from appunti_vocali where id in (v_app, v_app2);
  delete from dettature where id = v_det;
  delete from tipi_azione_vocale where tipo = 'zzz_verifica_lucchetto';

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro.', v_lapidi2 - v_lapidi;
  end if;
  if (select count(*) from tipi_azione_vocale where additivo) <> 1 then
    raise exception 'VERIFICA: il catalogo non e'' quello di prima.';
  end if;

  raise notice 'VERIFICA superata: una riga nuova non finisce mai sotto un appunto chiuso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000008', 'l appunto si tiene mentre ci si scrive') on conflict (version) do nothing;
