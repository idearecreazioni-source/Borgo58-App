-- =====================================================================
-- SPEC-0013 — due mani insieme sullo stesso appunto
-- =====================================================================
-- 🔴 DUE DIFETTI DI CONCORRENZA, trovati dalla revisione del diff. Nessuna
--    prova li aveva presi, e non e' un caso: si vedono **solo** quando due
--    cose succedono nello stesso istante, e tutte le verifiche di questo
--    progetto girano dentro una transazione sola, dove due istanti non
--    esistono. Le prove che li discriminano stanno percio' in
--    `tests/app/appunti-vocali.test.js`, che puo' davvero fare due chiamate
--    insieme.
--
-- (1) `appunto_per` POTEVA FAR FALLIRE UNA DETTATURA. La versione del
--     06/09 provava a inserire e, se l'indice la respingeva, rileggeva
--     l'appunto vincitore. Ma fra il rifiuto e la rilettura ci sta un
--     altro gesto: se in quell'istante Alessio approva o butta l'appunto
--     vincitore, la rilettura non trova piu' niente e la funzione solleva
--     un'eccezione — cioe' **la dettatura si perde**, che e' la cosa che
--     questo modulo esiste per non far succedere.
--     ⚠️ La cura e' RIPROVARE, con un tetto: se il vincitore si e' chiuso,
--     al giro dopo l'inserimento riesce e nasce un appunto nuovo, che e'
--     esattamente cio' che deve succedere. Il tetto c'e' perche' *un giro
--     senza tetto e' un giro che puo' non finire mai* — e in questo
--     progetto un'attesa che non finisce e' gia' costata tredici ore.
--
-- (2) DUE «L'HO FINITA IO A MANO» INSIEME LASCIAVANO UN APPUNTO VUOTO E
--     APERTO. Ognuna bloccava la propria riga, contava le altre, vedeva
--     quella dell'altra transazione ancora in attesa — perche' nel proprio
--     istantaneo lo era — e nessuna delle due chiudeva l'appunto. Restava
--     nell'elenco delle cose da approvare, senza niente dentro, per sempre.
--     ⚠️ E c'era di peggio: l'ordine dei lucchetti era **al contrario** di
--     `approva_appunto` e `scarta_appunto`, che prendono prima l'appunto e
--     poi le righe. Due gesti insieme potevano bloccarsi a vicenda, e a
--     scioglierli sarebbe stato Postgres abortendone uno.
--     ⚠️ La cura e' una sola per tutt'e due i guai: **si prende sempre
--     prima il lucchetto dell'appunto**. Da li' in poi le due mani sono in
--     fila, il conteggio e' vero, e nessuno puo' bloccare l'altro.
--
-- ⚠️ NOTA SULLA VERIFICA DELLA `…006`, dichiarata invece che corretta: quel
--    blocco rimetteva `tipi_azione_vocale.additivo` a `false` scritto a
--    mano, invece di salvare e rimettere il valore di prima. Sul valore
--    vero non cambia niente — la `…001` impone `additivo = false` a tutto
--    cio' che non e' la lista della spesa, e la `…006` si ferma se alla
--    fine le additive non sono esattamente una — ma la forma e' quella che
--    il 26/08 e' costata un residuo. Qui sotto non si tocca nessun
--    catalogo: la verifica si costruisce la propria destinazione.

-- ---------------------------------------------------------------------
-- 1 · Trovare l'appunto non puo' far perdere una dettatura
-- ---------------------------------------------------------------------
-- rete-guardie: appunto_per — il rifiuto cambia parole: adesso puo' anche APRIRE un appunto, e dice di riprovare invece di lasciare chi legge senza gesto
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
  v_giro integer;
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

  -- ⚠️ TRE GIRI, NON UNO SOLO E NON INFINITI. Ogni giro puo' finire in tre
  --    modi: l'inserimento riesce (nessuno ci stava lavorando), oppure
  --    l'indice lo respinge e l'appunto vincitore c'e' (ci si aggancia),
  --    oppure l'indice lo respinge e il vincitore nel frattempo e' stato
  --    chiuso — e allora si riprova, perche' adesso c'e' posto.
  --    Tre e' molto piu' di quanto serva: perche' non bastassero,
  --    servirebbero tre chiusure esattamente in quegli istanti.
  for v_giro in 1..3 loop
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
    values (p_tipo, v_d.titolo, v_d.eseguibile, v_key)
    on conflict (chiave_gruppo) where (stato = 'aperto' and chiave_gruppo is not null)
    do nothing
    returning id into v_id;

    if v_id is not null then
      return v_id;
    end if;

    select id into v_id from appunti_vocali
     where chiave_gruppo = v_key and stato = 'aperto'
     limit 1;

    if v_id is not null then
      return v_id;
    end if;
  end loop;

  -- ⚠️ Si dice invece di tacere: se capitasse davvero, una riga senza
  --    appunto sarebbe peggio di un errore che si legge.
  raise exception 'Non sono riuscito a trovare o aprire l''appunto della lista «%»: riprova.', v_key;
end $$;

comment on function appunto_per(text, text, jsonb) is
  'Trova l''appunto aperto di quel gruppo o ne apre uno. Riprova fino a tre volte perche'' fra il rifiuto dell''indice e la rilettura l''appunto vincitore puo'' essere stato chiuso: senza il giro, quella dettatura andrebbe persa.';

-- ---------------------------------------------------------------------
-- 2 · Il lucchetto si prende sempre prima sull'appunto
-- ---------------------------------------------------------------------
create or replace function chiudi_azione_a_mano(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_app     uuid;
  v_a       azioni_dettate%rowtype;
  v_restano integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' chiudere quello che ha dettato.';
  end if;

  -- 🔴 PRIMA L'APPUNTO, POI LA RIGA, e in quest'ordine SEMPRE — lo stesso di
  --    `approva_appunto` e `scarta_appunto`. Due gesti che prendono i
  --    lucchetti in ordine opposto si bloccano a vicenda, e a scioglierli e'
  --    Postgres abortendone uno: chi lo subisce vede il gestionale rifiutare
  --    una cosa che non ha niente di sbagliato.
  select appunto_id into v_app from azioni_dettate where id = p_id;
  if v_app is null then
    raise exception 'Questa cosa detta non c''e'' piu''.';
  end if;
  perform 1 from appunti_vocali where id = v_app for update;

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

  -- ⚠️ Il conteggio vale perche' l'appunto e' bloccato: nessun'altra mano
  --    puo' star chiudendo una riga in questo istante. Senza il lucchetto,
  --    due chiusure insieme si vedevano a vicenda «ancora in attesa» e
  --    l'appunto restava aperto e vuoto.
  select count(*) into v_restano from azioni_dettate
   where appunto_id = v_app and stato in ('in_attesa', 'fallita');

  if v_restano = 0 then
    update appunti_vocali
       set stato = 'approvato', chiuso_il = now(), chiuso_da = auth.uid()
     where id = v_app and stato = 'aperto';
  end if;

  return jsonb_build_object('frase', v_a.frase, 'restano', v_restano);
end $function$;

do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_id     uuid;
  v_id2    uuid;
  v_app    uuid;
  v_app2   uuid;
  v_key    text;
  v_ris    jsonb;
  v_lapidi bigint;
  v_lapidi2 bigint;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'VERIFICA: non c''e'' nessun titolare con cui provare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ⚠️ NESSUN CATALOGO VIENE TOCCATO: la verifica si costruisce la propria
  --    destinazione additiva invece di rendere additivo per un attimo un
  --    tipo vero e poi rimetterlo «a false» scritto a mano. E' il rilievo
  --    fatto sulla `…006`, e qui e' chiuso alla radice: cio' che si crea si
  --    cancella, cio' che c'era non si tocca.
  insert into tipi_azione_vocale (tipo, natura, titolo, spiega, attivo, additivo, eseguibile)
  values ('zzz_verifica_gruppo', 'misura', 'Verifica del raggruppamento', null, true, true, false);

  insert into dettature (testo, provenienza, esito)
  values ('prova migrazione: due mani', 'app', 'capita') returning id into v_det;

  -- (1) Due righe dello stesso gruppo si agganciano allo stesso appunto.
  v_key := gen_random_uuid()::text;
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'zzz_verifica_gruppo', jsonb_build_object('lista', v_key), true, 'prima', 'prova', 'in_attesa')
  returning id, appunto_id into v_id, v_app;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 2, 'zzz_verifica_gruppo', jsonb_build_object('lista', v_key), true, 'seconda', 'prova', 'in_attesa')
  returning id into v_id2;

  if (select appunto_id from azioni_dettate where id = v_id2) is distinct from v_app then
    raise exception 'VERIFICA: la seconda riga dello stesso gruppo non si e'' agganciata.';
  end if;

  -- (2) 🔴 IL RAMO CHE LA `…006` NON AVEVA: chiuso l'appunto vincitore, una
  --     riga nuova dello stesso gruppo ne apre uno NUOVO invece di fallire.
  --     E' la meta' del difetto che si poteva riprodurre stando fermi.
  update appunti_vocali set stato = 'approvato', chiuso_il = now() where id = v_app;

  select appunto_per('zzz_verifica_gruppo', null, jsonb_build_object('lista', v_key)) into v_app2;
  if v_app2 is null then
    raise exception 'VERIFICA: col vincitore chiuso non e'' nato nessun appunto.';
  end if;
  if v_app2 = v_app then
    raise exception 'VERIFICA: si e'' agganciata a un appunto gia'' chiuso.';
  end if;
  if (select stato from appunti_vocali where id = v_app2) is distinct from 'aperto' then
    raise exception 'VERIFICA: l''appunto nuovo non e'' aperto.';
  end if;

  -- (3) L'ordine dei lucchetti: si constata l'EFFETTO — chiudere a mano
  --     l'ultima riga chiude l'appunto — perche' l'ordine in se' si vede
  --     solo con due sessioni, e quella prova sta fra le prove sull'app.
  --
  -- ⚠️ L'APPUNTO NUOVO SI TOGLIE PRIMA DI RIAPRIRE QUELLO VECCHIO, e non
  --    e' pulizia anticipata: l'indice unico ammette **un solo** appunto
  --    aperto per gruppo, quindi riaprire il vecchio con l'altro ancora
  --    aperto viene respinto — ed e' l'indice che fa il suo mestiere.
  --    Il primo giro di questa verifica ci e' inciampato davvero.
  delete from appunti_vocali where id = v_app2;
  update appunti_vocali set stato = 'aperto', chiuso_il = null where id = v_app;
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

  -- --- pulizia: solo cio' che ha creato questa verifica ---------------
  delete from azioni_dettate where id in (v_id, v_id2);
  delete from appunti_vocali where id = v_app;
  delete from dettature where id = v_det;
  delete from tipi_azione_vocale where tipo = 'zzz_verifica_gruppo';

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'VERIFICA: la pulizia ha lasciato % tracce nel registro.', v_lapidi2 - v_lapidi;
  end if;
  if (select count(*) from tipi_azione_vocale where additivo) <> 1 then
    raise exception 'VERIFICA: il catalogo non e'' quello di prima.';
  end if;

  raise notice 'VERIFICA superata: col vincitore chiuso nasce un appunto nuovo, e l''ultima riga chiusa a mano chiude l''appunto.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000007', 'due mani insieme sullo stesso appunto') on conflict (version) do nothing;
