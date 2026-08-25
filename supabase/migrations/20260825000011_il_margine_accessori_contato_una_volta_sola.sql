-- ============================================================================
-- IL MARGINE DEGLI ACCESSORI SI CONTA UNA VOLTA SOLA — 25/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, e tocca un numero su cui si prendono decisioni di soldi.
--    `pareggio_previsione` calcola «quanto margine lascia un euro di
--    ricavo» cosi':
--
--        select sum(r.margine_totale)    as mdc_sala,      -- ⚠️ il nome
--               sum(r.margine_accessori) as mdc_acc
--        ...
--        v_rapporto := (t.mdc_sala + t.mdc_acc) / t.ricavi;
--
--    Ma `margine_totale` **contiene gia'** `margine_accessori`: la
--    definizione e' `margine_contribuzione + margine_accessori -
--    commissioni_pos`, ed e' misurata su tutti e dodici i mesi della
--    previsione vera. Quindi il numeratore conta **due volte** il margine
--    delle linee accessorie.
--
--    ⚠️ **Il nome della variabile era la spia**: chi l'ha scritta credeva
--    che `margine_totale` fosse il margine della sola sala. Qui si
--    rinomina, perche' un nome che mente e' come un commento che mente.
--
-- ⚠️ MISURATO, non dedotto. Sulla «Previsione di partenza» vera, letta in
--    sola lettura dal connettore:
--      · margine_totale / ricavi_totali            = **70,8 %**  (giusto)
--      · (margine_totale + margine_accessori) / …  = **95,7 %**  (oggi)
--    E su una previsione plausibile ricostruita apposta sul progetto di
--    prova — sala e accessorie in rapporto 2,01 : 1, 7.008 coperti, mai
--    zero — il confronto e' ancora piu' netto perche' si puo' guardare da
--    tutt'e due i lati:
--      · quello che la funzione risponde                  = **96,3 %**
--      · quello che viene dai dati salvati                = **72,6 %**
--      · quello che verrebbe contando due volte gli acc.  = **96,3 %**  ←
--      · quello che verrebbe dividendo per la sola sala   = 108,7 %
--    Il numero della funzione **coincide al decimo** con l'ipotesi del
--    doppio conteggio, e non con quella del denominatore sbagliato.
--
-- 🔴 E IL VERSO IN CUI SBAGLIA E' QUELLO PERICOLOSO: il rapporto gonfiato
--    sta al denominatore del pareggio (`fissi / rapporto`), quindi il
--    pareggio risulta **piu' basso del vero** — dice che si va in pari con
--    meno ricavi di quanti ne servano davvero. Un numero ottimista su cui
--    si decide quanto si puo' spendere.
--
-- ✅ COSA NON CAMBIA, e va detto perche' e' la meta' che funzionava:
--    `coperti_sala_se_altre` usa `t.mdc_acc` **correttamente** — i fissi
--    meno quello che coprono gia' le accessorie, diviso il margine di un
--    coperto. Quando le accessorie coprono tutti i fissi la risposta e'
--    **zero coperti**, e non e' un difetto: e' quello che la frase che
--    l'accompagna dice da sempre.
--
-- ⚠️ E' UN DIFETTO SOLO, non una famiglia — guardate una per una le
--    quattro funzioni che nominano `margine_accessori`:
--    `confronto_col_foglio`, `proiezione_fine_anno` e `riepilogo_calcolato`
--    lo raccolgono e lo usano bene (`proiezione_fine_anno` fa
--    `ricavi_sala - food + margine_accessori - …`, che e' giusto).
-- ============================================================================

-- ⚠️ Corpo ripreso VIVO dal database (`pg_get_functiondef`). Cambiano il
--    nome di una variabile e una riga di calcolo.
create or replace function pareggio_previsione(p_scenario_id uuid)
returns table(
  pareggio_euro numeric,
  ricavi_previsti numeric,
  margine_su_ricavi numeric,
  coperti_sala_se_altre integer,
  frase text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  k          record;
  t          record;
  v_fissi    numeric;
  v_mdc_cop  numeric;
  v_rapporto numeric;
begin
  if not is_titolare() then
    raise exception 'La Proiezione è riservata al titolare.';
  end if;

  select * into k from costanti_scenario(p_scenario_id);

  -- ⚠️ IL NOME DICE COSA C'E' DENTRO. Si chiamava `mdc_sala`, e non era il
  -- margine della sala: `margine_totale` comprende gia' gli accessori meno
  -- le commissioni. Da quel nome e' nato il doppio conteggio.
  select coalesce(sum(r.ricavi_totali), 0)     as ricavi,
         coalesce(sum(r.margine_totale), 0)    as mdc_tutto,
         coalesce(sum(r.margine_accessori), 0) as mdc_acc
    into t
    from calcola_proiezione(p_scenario_id) r;

  -- ⚠️ I fissi dell'ANNO, non la somma dei dodici mesi arrotondati: gli
  -- arrotondamenti mensili sono una comodità di lettura, e farci sopra un
  -- pareggio farebbe dipendere il numero da come si scrivono i decimi.
  v_fissi   := k.pers_fisso * 12 + k.extra_anno + k.fissi_mese * 12;
  v_mdc_cop := k.scontrino - k.costo_coperto;

  -- Quanto margine lascia un euro di ricavo, col mix di questa previsione.
  -- 🔴 UNA VOLTA SOLA (25/08/2026): `mdc_tutto` gli accessori li ha gia'
  -- dentro, e risommarli faceva uscire un margine che sulla previsione
  -- vera saliva dal 70,8% al 95,7% — e sul progetto di prova sopra il
  -- 100%. Il pareggio ne usciva piu' basso del vero, cioe' ottimista.
  v_rapporto := case when t.ricavi > 0
                     then t.mdc_tutto / t.ricavi
                     else null end;

  return query
  select
    -- ⚠️ Niente pareggio se il conto non si può fare: uno zero qui si
    -- leggerebbe «pareggi subito», che è il contrario del vero.
    case when coalesce(v_rapporto, 0) > 0 then round(v_fissi / v_rapporto, 2) else null end,
    round(t.ricavi, 2),
    case when v_rapporto is null then null else round(v_rapporto * 100, 1) end,
    -- ✅ QUI `mdc_acc` CI VA, ed e' la meta' che funzionava: i fissi meno
    -- quello che le accessorie coprono gia', diviso il margine di un
    -- coperto. Zero coperti non e' un difetto — vuol dire che le altre
    -- linee coprono tutto, e la frase qui sotto lo dice.
    case when coalesce(v_mdc_cop, 0) > 0
         then ceil(greatest(v_fissi - t.mdc_acc, 0) / v_mdc_cop)::integer
         else null end,
    case
      when coalesce(v_rapporto, 0) <= 0 then
        'Questa previsione non ha ricavi: senza, non si può dire dove sta il pareggio.'
      when coalesce(v_mdc_cop, 0) <= 0 then
        'Un coperto non lascia margine: il pareggio in coperti di sala non si può calcolare.'
      else
        'I coperti di sala valgono solo se le altre linee vanno come previsto: sono quello che manca dopo il margine delle altre, non il pareggio.'
    end;
end $function$;

revoke all on function pareggio_previsione(uuid) from public, anon, authenticated;
grant execute on function pareggio_previsione(uuid) to authenticated;

-- ============================================================================
-- VERIFICA — una PROPRIETA', non un numero
-- ============================================================================
-- ⚠️ Non si controlla che il rapporto valga «70,8» o «72,6»: quello e' un
--    numero che dipende dai dati, e un guardiano che contiene un numero
--    letto dalla produzione e' un fossile (16/08). Si controlla che **il
--    numero che la funzione risponde coincida con quello che viene dai
--    risultati salvati**, che e' vero su qualunque previsione e resta vero
--    domani.
--
-- ⚠️ E si controlla nei DUE VERSI: che coincida col conto giusto, e che
--    NON coincida con quello del doppio conteggio — altrimenti su una
--    previsione senza accessorie i due sarebbero uguali e la prova
--    passerebbe senza misurare niente (la trappola del caso vuoto).
do $verifica$
declare
  v_tit      uuid;
  v_sc       uuid;
  v_giusto   numeric;
  v_doppio   numeric;
  v_risposto numeric;
  v_pareggio numeric;
  v_acc      numeric;
  v_n        integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ⚠️ SERVE UNA PREVISIONE CON DELLE ACCESSORIE CHE PESANO: su una senza,
  --    la riga corretta e quella sbagliata danno lo stesso numero e la
  --    verifica non discrimina. Se non ce n'e' nessuna si DICHIARA invece
  --    di passare in silenzio.
  select r.scenario_id into v_sc
    from scenario_risultati r
   group by r.scenario_id
  having sum(r.margine_accessori) > 0 and sum(r.ricavi_totali) > 0
   limit 1;

  if v_sc is null then
    raise notice 'Nessuna previsione con margine accessori: il rapporto non e'' stato provato sui dati (la correzione c''e'' lo stesso).';
  else
    select sum(margine_totale) / nullif(sum(ricavi_totali), 0) * 100,
           (sum(margine_totale) + sum(margine_accessori)) / nullif(sum(ricavi_totali), 0) * 100,
           sum(margine_accessori)
      into v_giusto, v_doppio, v_acc
      from scenario_risultati where scenario_id = v_sc;

    select p.margine_su_ricavi, p.pareggio_euro
      into v_risposto, v_pareggio
      from pareggio_previsione(v_sc) p;

    if round(v_risposto, 1) <> round(v_giusto, 1) then
      raise exception 'Il margine risposto (%) non e'' quello dei dati salvati (%)',
        round(v_risposto, 1), round(v_giusto, 1);
    end if;

    -- La prova al contrario: i due conti devono essere DIVERSI, o questa
    -- previsione non sta discriminando niente.
    if round(v_doppio, 1) = round(v_giusto, 1) then
      raise exception 'Su questa previsione il doppio conteggio darebbe lo stesso numero: la prova non discrimina';
    end if;

    if round(v_risposto, 1) = round(v_doppio, 1) then
      raise exception 'Il margine risposto e'' ancora quello del doppio conteggio (%)', round(v_doppio, 1);
    end if;

    -- E il pareggio non puo' essere piu' basso del vero: col rapporto
    -- corretto (piu' piccolo) serve PIU' ricavo per andare in pari.
    if v_pareggio is null or v_pareggio <= 0 then
      raise exception 'Il pareggio non e'' un numero utilizzabile: %', v_pareggio;
    end if;

    raise notice 'Margine risposto % — dai dati salvati % — col doppio conteggio sarebbe stato %. Pareggio: %.',
      round(v_risposto, 1), round(v_giusto, 1), round(v_doppio, 1), round(v_pareggio, 2);
  end if;

  -- E il calcolo non risomma piu' gli accessori.
  -- ⚠️ SI CERCA IL GESTO, NON LA PAROLA — e questa verifica ci e' cascata
  --    al primo colpo: cercava «mdc_sala» nel corpo e lo trovava **nel
  --    commento** che spiega perche' quel nome e' stato tolto. E' la stessa
  --    trappola del setaccio del 22/08: un'etichetta non e' un
  --    comportamento. Qui si cerca la RIGA che assegna il rapporto.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'pareggio_previsione'
     and pg_get_functiondef(p.oid) ~* 'v_rapporto\s*:=[^;]*\+[^;]*mdc_acc';
  if v_n <> 0 then
    raise exception 'Il rapporto risomma ancora il margine degli accessori';
  end if;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000011', 'il_margine_accessori_contato_una_volta_sola')
on conflict (version) do nothing;
