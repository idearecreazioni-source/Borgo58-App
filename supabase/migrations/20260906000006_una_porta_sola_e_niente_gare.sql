-- =====================================================================
-- SPEC-0013 — una porta sola per scrivere, e niente gare sul gruppo
-- =====================================================================
-- 🔴 DUE DIFETTI TROVATI DALLA REVISIONE DEL DIFF, tutt'e due veri e tutt'e
--    due miei. Nessuna prova li aveva presi, e il perche' e' istruttivo: la
--    prima li avrebbe visti solo con due dettature **nello stesso istante**,
--    la seconda solo chiamando una porta che **nessuna schermata usa piu'**.
--
-- (1) LA PORTA VECCHIA ERA RIMASTA APERTA. `esegui_azione_dettata` esegue
--     **una riga sola** e non tocca l'appunto: era il gesto di prima, e il
--     gestionale non la chiama piu' da nessuna parte — ma restava concessa a
--     chi ha un token, e nell'elenco del corridoio. Su un appunto della lista
--     con tre articoli avrebbe scritto il primo e lasciato gli altri due
--     dentro un appunto che nessuno saprebbe piu' essere a meta'.
--     ⚠️ *L'unita' che si approva e' l'appunto* smette di essere vera nel
--     momento in cui esiste una seconda porta che approva una riga.
--
-- (2) DUE DETTATURE INSIEME SULLA STESSA LISTA SI ROMPEVANO A VICENDA.
--     `appunto_per` guardava se un appunto aperto c'era e, non trovandolo,
--     ne inseriva uno: due dettature ravvicinate potevano non trovare niente
--     tutt'e due, e la seconda moriva contro l'indice unico. ⚠️ **E l'indice
--     faceva il suo mestiere**: impediva i due appunti mezzi pieni. Il
--     difetto era che il fallimento arrivava addosso a chi stava dettando,
--     invece di far agganciare la riga all'appunto che aveva vinto. *Una
--     dettatura persa e' la cosa che gli farebbe smettere di usare la voce.*

-- ---------------------------------------------------------------------
-- 1 · La gara si toglie chiedendola al database
-- ---------------------------------------------------------------------
create or replace function appunto_per(p_tipo text, p_libera text, p_dati jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_d   record;
  v_key text;
  v_id  uuid;
begin
  select * into v_d from destinazione_vocale(p_tipo, p_libera);
  v_key := chiave_gruppo_vocale(p_tipo, v_d.additivo, p_dati);

  -- Le destinazioni che non si raggruppano non hanno niente da cercare:
  -- ognuna il suo appunto, sempre.
  if v_key is null then
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
    values (p_tipo, v_d.titolo, v_d.eseguibile, null)
    returning id into v_id;
    return v_id;
  end if;

  -- ⚠️ SI PROVA A INSERIRE E SI LASCIA DECIDERE ALL'INDICE, invece di
  --    guardare prima e inserire dopo: fra il guardare e l'inserire ci sta
  --    un'altra dettatura, e li' stava la gara. `on conflict` nomina la
  --    stessa condizione dell'indice parziale, altrimenti Postgres non sa
  --    quale indice guardare.
  insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
  values (p_tipo, v_d.titolo, v_d.eseguibile, v_key)
  on conflict (chiave_gruppo) where (stato = 'aperto' and chiave_gruppo is not null)
  do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  -- Ha vinto un'altra dettatura: ci si aggancia al suo appunto, che e'
  -- esattamente quello che doveva succedere.
  select id into v_id from appunti_vocali
   where chiave_gruppo = v_key and stato = 'aperto'
   limit 1;

  if v_id is null then
    -- ⚠️ Non puo' capitare — o l'inserimento riesce, o esiste quello che
    --    l'ha respinto — e proprio per questo si dice invece di tacere: se
    --    capitasse, tacere qui vorrebbe dire una riga senza appunto.
    raise exception 'Non sono riuscito a trovare l''appunto della lista «%».', v_key;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 2 · La porta per singola riga si chiude
-- ---------------------------------------------------------------------
-- ⚠️ SI REVOCA, NON SI CANCELLA, e la differenza e' misurata: `azione_a_mano`
--    e la schermata di ripresa leggono ancora quelle righe, e il corpo di
--    `esegui_azione_dettata` resta la descrizione di come si esegue un
--    elemento. Quello che non deve piu' esistere e' che la chiami **un
--    utente**: da oggi si passa da `approva_appunto`, che le esegue tutte
--    insieme o nessuna.
revoke execute on function esegui_azione_dettata(uuid) from authenticated;
revoke execute on function annulla_azione_dettata(uuid) from authenticated;

comment on function esegui_azione_dettata(uuid) is
  'Esegue UNA riga dettata. Dal 06/09/2026 (SPEC-0013) non e'' piu'' concessa a nessun utente: l''unita'' che si approva e'' l''appunto, e questa scriverebbe una riga sola lasciando le altre dentro un appunto a meta''. Resta perche'' descrive come si esegue un elemento.';

-- ---------------------------------------------------------------------
-- 3 · «L'ho finita io a mano» chiude anche l'appunto, quando e' l'ultima
-- ---------------------------------------------------------------------
-- 🔴 SENZA QUESTO, un appunto restava aperto e VUOTO: le sue righe tutte
--    finite a mano, e lui ancora nell'elenco delle cose da approvare, per
--    sempre. Un elenco che mostra una cosa che non ha piu' niente dentro e'
--    la stessa forma dell'avviso che non si spegne.
create or replace function chiudi_azione_a_mano(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_a azioni_dettate%rowtype; v_restano integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' chiudere quello che ha dettato.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa detta non c''e'' piu''.';
  end if;

  if v_a.stato = 'eseguita' then
    raise exception 'Questa l''aveva gia'' fatta il gestionale: non serve rifarla a mano.';
  end if;
  if v_a.stato = 'fatta_a_mano' then
    raise exception 'Questa l''avevi gia'' finita a mano.';
  end if;
  if v_a.stato = 'annullata' then
    raise exception 'Questa l''avevi annullata. Se la vuoi, ridettala.';
  end if;

  update azioni_dettate
     set stato       = 'fatta_a_mano',
         eseguita_il = now(),
         errore      = null,
         motivo      = 'L''hai finita tu a mano.'
   where id = p_id;

  select count(*) into v_restano from azioni_dettate
   where appunto_id = v_a.appunto_id and stato in ('in_attesa', 'fallita');

  if v_restano = 0 then
    update appunti_vocali
       set stato = 'approvato', chiuso_il = now(), chiuso_da = auth.uid()
     where id = v_a.appunto_id and stato = 'aperto';
  end if;

  return jsonb_build_object('frase', v_a.frase, 'restano', v_restano);
end $function$;

do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_id     uuid;
  v_app    uuid;
  v_id2    uuid;
  v_ris    jsonb;
  v_lapidi bigint;
  v_lapidi2 bigint;
  v_chiave text;
begin
  select count(*) into v_lapidi from deleted_records;

  -- (1) Nessun utente puo' piu' eseguire una riga da sola.
  if has_function_privilege('authenticated', 'public.esegui_azione_dettata(uuid)', 'execute') then
    raise exception 'VERIFICA: la porta per singola riga e'' ancora aperta.';
  end if;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- (2) Due righe della stessa lista finiscono nello stesso appunto anche
  --     chiamando `appunto_per` due volte di fila — ed e' la strada che la
  --     gara percorreva. ⚠️ La chiave e' di QUESTA verifica, non il gruppo
  --     globale della lista: con quello, un appunto gia' aperto di Alessio
  --     avrebbe fatto passare la prova senza provare niente.
  v_chiave := 'verifica_gruppo_' || gen_random_uuid()::text;
  update tipi_azione_vocale set additivo = true where tipo = 'nota_non_capita';

  insert into dettature (testo, provenienza, esito)
  values ('prova migrazione: gara sul gruppo', 'app', 'capita') returning id into v_det;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'nota_non_capita', jsonb_build_object('lista', v_chiave, 'sentito', 'a'),
          true, 'prima', 'prova', 'in_attesa')
  returning id, appunto_id into v_id, v_app;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 2, 'nota_non_capita', jsonb_build_object('lista', v_chiave, 'sentito', 'b'),
          true, 'seconda', 'prova', 'in_attesa')
  returning id into v_id2;

  if (select appunto_id from azioni_dettate where id = v_id2) is distinct from v_app then
    raise exception 'VERIFICA: la seconda riga della stessa lista non si e'' agganciata.';
  end if;

  -- (3) Finendo a mano l'ultima riga, l'appunto si chiude invece di restare
  --     aperto e vuoto.
  perform chiudi_azione_a_mano(v_id);
  if (select stato from appunti_vocali where id = v_app) is distinct from 'aperto' then
    raise exception 'VERIFICA: l''appunto si e'' chiuso con una riga ancora dentro.';
  end if;

  v_ris := chiudi_azione_a_mano(v_id2);
  if (v_ris->>'restano')::integer <> 0 then
    raise exception 'VERIFICA: il conteggio di cio'' che resta non torna.';
  end if;
  if (select stato from appunti_vocali where id = v_app) is distinct from 'approvato' then
    raise exception 'VERIFICA: l''appunto e'' rimasto aperto e vuoto.';
  end if;

  -- --- pulizia -------------------------------------------------------
  update tipi_azione_vocale set additivo = false where tipo = 'nota_non_capita';
  delete from azioni_dettate where id in (v_id, v_id2);
  delete from appunti_vocali where id = v_app;
  delete from dettature where id = v_det;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro.', v_lapidi2 - v_lapidi;
  end if;

  -- E il catalogo e' tornato com'era: additivo solo la lista della spesa.
  if (select count(*) from tipi_azione_vocale where additivo) <> 1 then
    raise exception 'VERIFICA: il catalogo non e'' tornato com''era.';
  end if;

  raise notice 'VERIFICA superata: una porta sola per scrivere, il gruppo regge, e l''appunto non resta vuoto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000006', 'una porta sola e niente gare') on conflict (version) do nothing;
