-- ============================================================================
-- 20260828000010 — il ramo che non faceva piu' niente
-- ============================================================================
--
-- DIFETTO MIO, di stamattina, trovato da chi ha riletto la funzione.
--
-- La `20260828000008` ha portato il ripiego del preavviso sul valore piu'
-- prudente, e l'ha scritto cosi':
--
--     greatest(
--       case when p_conservazione in ('frigo_0_4','frigo_4_8') then 2 else 14 end,
--       14)
--
-- Quel `case` non ha NESSUN effetto: produce 2 o 14, e `greatest(2,14)` e
-- `greatest(14,14)` fanno tutt'e due 14. Cioe' e' un ramo che DICE che il
-- frigo prende due giorni e non ne prende nessuno.
--
-- ⚠️ L'avevo scritto apposta, e la ragione era «cosi' il giorno che una
--    conservazione ne chiedesse trenta il calcolo li prenderebbe da solo».
--    Era un ragionamento su un futuro, pagato con una frase falsa nel
--    presente — ed e' la forma che questo progetto ha gia' pagato tre volte.
--    Il codice deve dire cosa fa OGGI.
--
-- 🔴 E LA FRASE FALSA ERA DOPPIA: `src/lib/calcoli/vocabolari.js` dichiarava
--    quel parametro dicendo «il frigo prende due giorni di preavviso,
--    dispensa e freezer quattordici». Vero fino a ieri, falso da stamattina,
--    e scritto in un file che serve a spiegare le eccezioni — cioe' proprio
--    dove chi legge si fida.
--
-- COSA SI FA, e perche' non si tiene il parametro «per un domani».
-- Il parametro esce. Un parametro che non cambia mai la risposta e' una
-- promessa che la conservazione conti, e la conservazione non conta piu':
-- e' la stessa cosa che il 14/08 si e' finito di togliere dalla capienza,
-- dove una colonna spenta veniva riaccesa da qualcuno convinto di riparare
-- qualcosa. Il giorno che il freezer meritera' trenta giorni, il parametro
-- si rimette — e quel giorno sara' una decisione, non un ramo dimenticato.
--
-- ⚠️ I PERMESSI NON SI RISCRIVONO A MEMORIA. Letti dal database prima di
--    toccare niente: `preavviso_giorni` e' eseguibile SOLO da `postgres`
--    (nessun `authenticated`), quindi qui sotto non c'e' nessun `grant` —
--    la funzione nuova nasce con gli stessi permessi predefiniti, e la
--    verifica controlla che non ne abbia acquistati.
-- ⚠️ E l'ordine e' obbligato: prima nasce la nuova, poi il chiamante passa
--    a lei, poi muore la vecchia. Invertendo, per un istante lo
--    scadenziario chiamerebbe una funzione che non c'e'.
-- ============================================================================

-- rete-guardie: preavviso_giorni — le due conservazioni escono APPOSTA: erano dentro un greatest che le annullava, cioe un ramo che diceva «il frigo prende due giorni» e non ne prendeva nessuno
create or replace function public.preavviso_giorni(p_esplicito integer)
returns integer
language sql
immutable
set search_path to 'public'
as $function$
  select case
    -- Chi lo sa comanda: anche due giorni, se li ha scritti lui.
    when p_esplicito is not null and p_esplicito >= 0 then p_esplicito
    -- Nessuno l'ha detto: si ripiega sul PIU' PRUDENTE (decisione di
    -- Alessio del 28/08). Non dipende da dove si conserva, ed e' il punto:
    -- un preavviso lungo su un prodotto fresco e' un fastidio, uno corto su
    -- un prodotto che dura mesi e' merce buttata, e i due errori non
    -- costano uguale.
    else 14
  end;
$function$;

comment on function public.preavviso_giorni(integer) is
  'Quanti giorni prima della scadenza segnalare una partita. Il numero '
  'scritto da Alessio vince sempre; senza, si ripiega su 14 — il piu'' '
  'prudente — per QUALUNQUE conservazione. La conservazione non entra piu'' '
  'nel calcolo: fino al 28/08/2026 c''era un ramo che diceva «il frigo prende '
  'due giorni» e non ne prendeva nessuno.';

CREATE OR REPLACE FUNCTION public.partite_in_scadenza()
 RETURNS TABLE(lotto_id uuid, ingrediente text, ingrediente_id uuid, quantita numeric, unita text, scadenza date, giorni_mancanti integer, preavviso integer, lotto_fornitore text, da_segnalare boolean, perche_muta text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as g),
  aperte as (
    select l.id, l.ingredient_id, l.quantity_remaining, l.expiry_date,
           l.received_at, l.supplier_batch_number,
           i.name, i.unit::text as unita,
           preavviso_giorni(i.giorni_preavviso_scadenza) as preavviso
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
     where l.quantity_remaining > 0
       and l.expiry_date is not null
       and l.chiusa_il is null
  )
  select a.id, a.name, a.ingredient_id, a.quantity_remaining, a.unita,
         a.expiry_date,
         (a.expiry_date - o.g)::integer,
         a.preavviso,
         a.supplier_batch_number,
         (a.expiry_date - o.g) <= a.preavviso and not exists (
           select 1 from aperte n
            where n.ingredient_id = a.ingredient_id
              and n.id <> a.id
              and n.received_at > a.received_at
         ),
         case
           when exists (
             select 1 from aperte n
              where n.ingredient_id = a.ingredient_id
                and n.id <> a.id
                and n.received_at > a.received_at
           ) then 'ne e'' entrata una partita piu'' recente, ancora in giacenza'
           when (a.expiry_date - o.g) > a.preavviso
             then 'mancano piu'' di ' || a.preavviso || ' giorni'
           else null
         end
    from aperte a cross join oggi o
   order by a.expiry_date, a.name;
$function$

;

-- Adesso che il chiamante e' passato alla nuova, la vecchia puo' morire.
drop function if exists public.preavviso_giorni(integer, storage_type);

do $verifica$
declare
  v_foto  jsonb;
  v_acl   text;
  v_n     integer;
  v_c     storage_type;
begin
  v_foto := foto_righe();

  -- 1. La vecchia forma non esiste piu': se restasse, due funzioni con lo
  --    stesso nome renderebbero ambigua ogni chiamata per nome.
  if to_regprocedure('public.preavviso_giorni(integer,storage_type)') is not null then
    raise exception 'La vecchia preavviso_giorni con la conservazione e'' ancora li''';
  end if;
  if to_regprocedure('public.preavviso_giorni(integer)') is null then
    raise exception 'La nuova preavviso_giorni non e'' stata creata';
  end if;

  -- 2. Chi lo sa comanda, anche corto.
  if preavviso_giorni(2) <> 2 then
    raise exception 'Un preavviso scritto a mano non viene rispettato: %', preavviso_giorni(2);
  end if;

  -- 3. Il ripiego e' 14, e non dipende piu' da niente.
  if preavviso_giorni(null) <> 14 then
    raise exception 'Il ripiego non e'' piu'' il piu'' prudente: %', preavviso_giorni(null);
  end if;

  -- 4. LA PROPRIETA' CHE SOSTITUISCE IL RAMO MORTO: nessun prodotto vero,
  --    per nessuna conservazione, riceve meno della base prudente. Prima
  --    questa proprieta' era «vera per costruzione» dentro un `greatest`
  --    che nascondeva un ramo senza effetto; adesso si controlla sui dati.
  select count(*) into v_n
    from ingredients
   where giorni_preavviso_scadenza is null
     and preavviso_giorni(giorni_preavviso_scadenza) < 14;
  if v_n <> 0 then
    raise exception 'Ci sono % prodotti che ripiegano sotto la base prudente', v_n;
  end if;

  -- 5. Lo scadenziario risponde. ⚠️ «La funzione e' stata riscritta» e «la
  --    funzione risponde» sono due cose diverse (17/08): qui si CHIAMA.
  select count(*) into v_n from partite_in_scadenza();
  if v_n is null then
    raise exception 'Lo scadenziario non risponde piu'' dopo la riscrittura';
  end if;

  -- 6. Nessun permesso acquistato per sbaglio: era eseguibile dal solo
  --    proprietario, e deve restare cosi'.
  select coalesce(array_to_string(proacl, ' '), '') into v_acl
    from pg_proc where proname = 'preavviso_giorni' and pronamespace = 'public'::regnamespace;
  if position('anon=X' in v_acl) > 0 or position('authenticated=X' in v_acl) > 0 then
    raise exception 'preavviso_giorni ha acquistato permessi che non aveva: %', v_acl;
  end if;

  -- 7. E la conservazione non e' piu' nominata dal corpo: se qualcuno
  --    rimettesse il ramo, questo controllo diventa rosso e lo costringe a
  --    dichiararlo qui invece di lasciarlo muto.
  if pg_get_functiondef(to_regprocedure('public.preavviso_giorni(integer)')) ilike '%frigo_0_4%' then
    raise exception 'Il ripiego e'' tornato a dipendere dalla conservazione senza dirlo';
  end if;

  perform pretendi_nessun_residuo(v_foto, 'il ramo che non faceva piu'' niente');

  raise notice 'Il ramo morto e'' uscito: il ripiego e'' 14 per qualunque conservazione, la vecchia forma non esiste piu'', lo scadenziario risponde e nessun permesso e'' cambiato.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000010', 'il_ramo_che_non_faceva_piu_niente')
on conflict (version) do nothing;
