-- =====================================================================
-- SPEC-0013 — il lucchetto c'era già, e adesso si vede
-- =====================================================================
-- 🔴 QUESTA MIGRAZIONE CORREGGE UN'AFFERMAZIONE DELLA `…008`, non il suo
--    codice. La `…008` dice, nel proprio cappello, che chiude «il difetto
--    peggiore di tutto il blocco»: una cosa detta che finisce sotto un
--    appunto appena chiuso e sparisce dalla coda. **Quel difetto non si è
--    riprodotto**, e la `…008` è stata scritta prima di provare a
--    riprodurlo. Il file non si riscrive — racconta cosa è successo quel
--    giorno — quindi la correzione sta qui.
--
-- ⚠️ LA MISURA, fatta con due sessioni Postgres che si sovrappongono
--    davvero: una detta una riga nuova sul gruppo e tiene aperta la
--    transazione due secondi, l'altra mezzo secondo dopo butta quello
--    stesso appunto con `scarta_appunto`. Esito, **identico nei due versi**:
--      · con il `for update` della `…008`   → 0 righe orfane
--      · senza, con la versione della `…007` → 0 righe orfane
--
-- ⚠️ IL PERCHÉ È LA COSA UTILE DA CONSERVARE, e non era ovvio: la chiave
--    esterna `azioni_dettate.appunto_id` fa già il lavoro. Inserendo una
--    riga figlia, Postgres prende sulla riga madre un lucchetto leggero
--    (`for key share`) che **entra in conflitto** con il `for update` che
--    `scarta_appunto` e `approva_appunto` prendono per primi. La chiusura
--    quindi aspetta comunque che la dettatura abbia finito, e poi trova
--    anche la riga nuova. *La protezione c'era, e nessuno l'aveva scritta.*
--
-- ⚠️ COSA SI TIENE, E PERCHÉ. Il `for update` della `…008` resta, e non per
--    prudenza generica: senza, la garanzia poggia su un **effetto laterale
--    del vincolo di chiave esterna** — vero, ma implicito, e che nessun
--    commento nominava. Il giorno che qualcuno togliesse quella chiave
--    esterna, o la rendesse differita, la protezione sparirebbe **in
--    silenzio**. Scritta a mano, invece, dipende da una riga che si legge.
--    Costa un lucchetto su una riga per la durata di una dettatura.
--
-- ⚠️ E LA LEZIONE, che vale oltre questo caso: una revisione può nominare un
--    difetto vero *in astratto* e non riproducibile *in questo schema*. La
--    differenza non si decide leggendo — si decide provando a farlo
--    succedere. Qui è costato dieci minuti e ha cambiato la risposta.

-- Il corpo è quello della `…008`: si riscrive perché il progetto di prova
-- deve tornare allineato dopo le prove di rottura, e perché il commento
-- della funzione — che è ciò che un domani si legge dal database — smetta
-- di attribuire al lucchetto un merito che non ha.
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

  if v_key is null then
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
    values (p_tipo, v_d.titolo, v_d.eseguibile, null)
    returning id into v_id;
    return v_id;
  end if;

  -- Tre giri, non uno e non infiniti: l'inserimento riesce, oppure l'indice
  -- lo respinge e ci si aggancia al vincitore, oppure il vincitore nel
  -- frattempo si e' chiuso e al giro dopo c'e' posto.
  for v_giro in 1..3 loop
    insert into appunti_vocali (destinazione, titolo, eseguibile, chiave_gruppo)
    values (p_tipo, v_d.titolo, v_d.eseguibile, v_key)
    on conflict (chiave_gruppo) where (stato = 'aperto' and chiave_gruppo is not null)
    do nothing
    returning id into v_id;

    if v_id is not null then
      return v_id;
    end if;

    -- ⚠️ `for update` — NON e' cio' che impedisce a una riga di finire sotto
    --    un appunto chiuso: quello lo impedisce gia' la chiave esterna, che
    --    sulla riga madre prende un lucchetto in conflitto con quello della
    --    chiusura (misurato). Serve a non dipendere da un effetto laterale
    --    implicito, e a far rivalutare la condizione dopo aver preso il
    --    lucchetto: se la chiusura e' arrivata prima, qui non torna niente e
    --    il giro dopo apre un appunto nuovo.
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
  'Trova l''appunto aperto di quel gruppo o ne apre uno, riprovando fino a tre volte se il vincitore si chiude nel frattempo. Tiene fermo l''appunto trovato: non perche'' senza si perderebbe una riga — la chiave esterna gia'' mette in fila dettatura e chiusura, misurato — ma perche'' quella garanzia non dipenda da un effetto laterale che nessun commento nomina.';

do $verifica$
declare v_ok boolean;
begin
  -- La chiave esterna su cui poggia la protezione implicita esiste ancora.
  -- ⚠️ Se un domani sparisse, resterebbe solo il `for update` — ed e'
  --    esattamente il motivo per cui il `for update` c'e'.
  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.azioni_dettate'::regclass
       and conname  = 'azioni_dettate_appunto_id_fkey'
       and confrelid = 'public.appunti_vocali'::regclass
  ) into v_ok;
  if not v_ok then
    raise exception 'VERIFICA: la chiave esterna verso l''appunto non c''e'' piu''.';
  end if;

  -- E il lucchetto e' scritto nel corpo vivo, non solo in questo file.
  select pg_get_functiondef(p.oid) like '%for update%'
    into v_ok
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'appunto_per';
  if not v_ok then
    raise exception 'VERIFICA: appunto_per non tiene fermo l''appunto che trova.';
  end if;

  raise notice 'VERIFICA superata: la chiave esterna c''e'', e il lucchetto e'' scritto invece che implicito.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260906000009', 'il lucchetto c era gia e ora si vede') on conflict (version) do nothing;
