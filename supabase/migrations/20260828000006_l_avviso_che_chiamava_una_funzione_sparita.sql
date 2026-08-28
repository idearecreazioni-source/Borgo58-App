-- ============================================================================
-- L'AVVISO CHE CHIAMAVA UNA FUNZIONE CHE NON C'E' PIU' — 28/08/2026
-- ============================================================================
--
-- 🔴 DIFETTO MIO, TROVATO DALLE PROVE E NON DA UNA RILETTURA. Togliendo la
--    durata dei prodotti comprati ho lasciato cadere `partite_ferme()` — come
--    Alessio ha deciso, e dichiarando perche' non si poteva lasciare a
--    rispondere vuoto. Ma `avvisi_del_gestionale()` LA CHIAMAVA, e da quel
--    momento la schermata iniziale rispondeva
--
--      42883  function partite_ferme() does not exist
--
--    cioe' **tutti** gli avvisi del gestionale sparivano insieme a uno solo:
--    scadenze, non conformita' HACCP, tutto. A prenderlo e' stata
--    `tests/app/avvisi-dashboard.test.js`, che e' diventata rossa da sola.
--
-- ----------------------------------------------------------------------------
-- 🔴 IL CENSIMENTO SBAGLIAVA ASSE, e questa e' la lezione
-- ----------------------------------------------------------------------------
--    Per togliere la durata ho cercato in due modi, e tutti e due sul DATO:
--      · le funzioni che nominano la colonna `shelf_life_days` → nove;
--      · le funzioni che nominano il campo `'durata'`          → altre tre.
--
--    Ne mancava un terzo, e non riguarda il dato: **chi chiama le funzioni che
--    sto togliendo**. Una funzione che sparisce non lascia il suo nome nei
--    corpi che la usano sotto forma di dato — ce lo lascia sotto forma di
--    CHIAMATA, e Postgres non se ne accorge finche' nessuno esegue (e' la
--    lezione del 27/08 sull'enum, dal lato opposto).
--
-- ⚠️ QUINDI, TOGLIENDO UNA FUNZIONE, IL SETACCIO SI FA SUL SUO NOME nei corpi
--    di tutte le altre. Fatto adesso: le funzioni che nominavano
--    `partite_ferme` erano DUE — lei stessa e questa. Nessun'altra.
--
-- ----------------------------------------------------------------------------
-- E L'AVVISO NON SI SOSTITUISCE CON UNO PIU' DEBOLE
-- ----------------------------------------------------------------------------
--    Si sarebbe potuto rimpiazzare con «i prodotti fermi da piu' di N giorni»,
--    scegliendo un N. Non si fa: quel numero non lo ha deciso nessuno, e un
--    avviso che scatta su una soglia inventata e' peggio di un avviso che non
--    c'e' — insegna a ignorare il riquadro. Chi vuole vedere da quanto e'
--    ferma una partita apre la schermata, dove l'elenco e' ordinato dal piu'
--    fermo.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA PER IL LOCALE
-- ----------------------------------------------------------------------------
--    Gli avvisi della schermata iniziale tornano a rispondere. Uno di loro —
--    «Prodotti fermi da troppo» — non c'e' piu', ed e' la conseguenza voluta
--    della decisione sulla durata.
-- ============================================================================

-- rete-guardie: avvisi_del_gestionale — esce l'avviso «Prodotti fermi da troppo»: chiamava `partite_ferme()`, che non esiste piu' da quando la durata dei prodotti comprati e' stata tolta. Lasciarlo avrebbe fatto sparire TUTTI gli avvisi, non solo il suo.

CREATE OR REPLACE FUNCTION public.avvisi_del_gestionale()
 RETURNS TABLE(chiave text, titolo text, dettaglio text, quanti integer, dove text, gravita text, rimandato_a date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_oggi date := oggi_a_roma();
begin
  if not is_titolare() then
    raise exception 'Gli avvisi del gestionale sono riservati al titolare.';
  end if;

  return query
  with fonti as (
    -- (a) LE SCADENZE — la stessa regola del messaggio delle 10:00, e la
    -- stessa funzione: se la riscrivessimo qui, un giorno schermata e
    -- telefono direbbero due cose diverse (successo coi rincari il 12/08).
    select 'scadenze'::text as k,
           'Prodotti scaduti o in scadenza'::text as t,
           (select count(*)::integer from partite_in_scadenza() where da_segnalare) as q,
           '/magazzino/scadenze'::text as d,
           'alta'::text as g,
           (select string_agg(x.ingrediente, ', ')
              from (select p.ingrediente
                      from partite_in_scadenza() p
                     where p.da_segnalare
                     order by p.giorni_mancanti, p.ingrediente
                     limit 3) x) as esempi


    union all
    -- (c) LE NON CONFORMITA' HACCP APERTE. ⚠️ Qui la gravita' e' sempre
    -- alta e non dipende da quante sono: una sola non conformita' aperta
    -- e' un problema di sicurezza alimentare, e il registro si esibisce.
    select 'non_conformita',
           'Non conformità aperte in HACCP',
           (select count(*)::integer from haccp_non_conformities where not resolved),
           '/haccp/non-conformita',
           'alta',
           (select string_agg(x.description, ', ')
              from (select nc.description from haccp_non_conformities nc
                     where not nc.resolved order by nc.detected_at limit 3) x)

    union all
    -- (d) GLI INCASSI SENZA SCONTRINO. ⚠️ Si somma su TUTTE le entita'
    -- invece di indovinare quale sia il ristorante: il giorno che
    -- l'azienda agricola incassera' qualcosa, questo avviso la vede da
    -- solo. `conti_da_fiscalizzare` vuole l'entita', quindi la si chiama
    -- una volta per ognuna.
    select 'da_fiscalizzare',
           'Incassi senza documento fiscale',
           (select coalesce(sum(c.quanti), 0)::integer
              from (select (select count(*) from conti_da_fiscalizzare(e.id)) as quanti
                      from entities e) c),
           '/cassa/scontrinato',
           'alta',
           null

    union all
    -- (e) I PAGAMENTI CHE NON QUADRANO — soldi, quindi entra anche
    -- quando e' zero per costruzione: oggi lo e', e va bene cosi'.
    select 'quadratura',
           'Pagamenti che non quadrano',
           (select count(*)::integer from quadratura_pagamenti()),
           '/cassa/prima-nota',
           'alta',
           (select string_agg(x.descrizione, ', ')
              from (select qp.descrizione from quadratura_pagamenti() qp limit 3) x)

  )
  select f.k,
         f.t,
         case
           when f.esempi is null then null
           else f.esempi || case when f.q > 3 then ' e altri ' || (f.q - 3) else '' end
         end,
         f.q,
         f.d,
         f.g,
         r.fino_al
    from fonti f
    left join avvisi_rimandati r on r.chiave = f.k and r.fino_al > v_oggi
   where f.q > 0
   order by case f.g when 'alta' then 0 else 1 end, f.t;
end $function$;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA in due modi diversi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   bigint;
  v_lapidi2  bigint;
  v_n        integer;
  v_nomi     text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- (a) 🔴 IL CONTROLLO CHE MANCAVA: nessuna funzione chiama piu' qualcosa
  --     che non esiste. Si guarda il nome di cio' che e' stato tolto dentro
  --     i corpi di tutte le altre — l'asse che il censimento aveva saltato.
  select count(*), coalesce(string_agg(p.proname, ', '), '')
    into v_n, v_nomi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%partite_ferme%';
  if v_n <> 0 then
    raise exception 'Chiamano ancora partite_ferme(): %', v_nomi;
  end if;

  -- (b) E GLI AVVISI RISPONDONO. ⚠️ Non basta che la funzione si CREI: si
  --     crea benissimo anche chiamando qualcosa che non c'e', perche'
  --     Postgres non risolve le chiamate finche' non le esegue (17/08).
  --     Quindi si esegue.
  perform * from avvisi_del_gestionale();

  -- (c) E LE ALTRE QUATTRO FONTI CI SONO ANCORA. ⚠️ Serve oltre a (b), e
  --     NON si puo' farlo contando le righe che tornano: la funzione mostra
  --     solo gli avvisi con un conteggio maggiore di zero, quindi su un
  --     database tranquillo ne tornerebbero poche anche col corpo intero —
  --     sarebbe un controllo verde per il motivo sbagliato.
  --     Si guarda quindi il CORPO: se la sostituzione avesse mangiato un
  --     `union all` di troppo, una di queste chiavi sparirebbe e la funzione
  --     girerebbe lo stesso, senza nessun errore.
  foreach v_nomi in array array['scadenze', 'non_conformita', 'da_fiscalizzare', 'quadratura'] loop
    if (select pg_get_functiondef(pr.oid)
          from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
         where ns.nspname = 'public' and pr.proname = 'avvisi_del_gestionale')
       not like '%''' || v_nomi || '''%' then
      raise exception 'La fonte «%» e'' sparita dagli avvisi: la sostituzione ha portato via piu'' del blocco dei fermi.', v_nomi;
    end if;
  end loop;

  -- (d) E L'AVVISO DEI FERMI NON C'E' PIU'.
  select count(*) into v_n from avvisi_del_gestionale() a where a.chiave = 'partite_ferme';
  if v_n <> 0 then
    raise exception 'L''avviso dei prodotti fermi e'' ancora fra gli avvisi.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Gli avvisi rispondono di nuovo, senza il blocco dei prodotti fermi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000006', 'l_avviso_che_chiamava_una_funzione_sparita') on conflict (version) do nothing;
