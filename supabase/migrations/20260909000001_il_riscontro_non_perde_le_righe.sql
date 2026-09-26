-- ============================================================================
-- IL RISCONTRO SUBITO DOPO AVER PARLATO NON PERDE PIU' LE RIGHE
-- ============================================================================
-- 🔴 IL FATTO, MISURATO SUL GESTIONALE DI PROVA L'08/09/2026 con le
--    dettature vere fatte da Alessio col telefono. Ha detto «segna come
--    fatto il rinnovo della firma digitale» e ha letto a schermo **«Non ho
--    capito niente di quello che hai detto»**. L'assistente invece aveva
--    capito benissimo: la riga c'era in `azioni_dettate`, col tipo giusto,
--    il titolo giusto e il suo motivo.
--
--    righe in tabella ..................... 1
--    righe che la schermata riceveva ...... 0
--
-- 🔴 LA CAUSA E' UNA CONGIUNZIONE INTERNA. `azioni_della_dettatura` — che e'
--    la porta da cui la schermata chiede «cosa hai appena capito» — legava
--    ogni riga al catalogo con `join tipi_azione_vocale`. Una destinazione
--    che nel catalogo non c'e' **non fa fallire la query: fa sparire la
--    riga**, e chi legge non riceve nessun errore. E' esattamente la
--    famiglia gia' scritta in CLAUDE.md §8 — *una risposta piu' corta che ha
--    l'aria di essere intera* — in un posto nuovo.
--
-- 🔴 E IL DIFETTO ERA GIA' STATO CURATO A META', il 06/09. La `…000001` di
--    quel giorno ha tolto la chiave esterna su `azioni_dettate.tipo`
--    (apposta: SPEC-0013 vuole che una destinazione che il gestionale non sa
--    eseguire resti scritta) e ha rifatto `azioni_dettate_in_attesa` con la
--    congiunzione ESTERNA e `destinazione_vocale(...)`. **Non e' tornata su
--    `azioni_della_dettatura`**, che dal 27/08 non veniva piu' toccata.
--    Da allora i due elenchi dicono cose diverse della stessa riga: uno la
--    mostra, l'altro la fa sparire.
--
-- ⚠️ QUANTO E' LARGO, misurato e non dedotto: sul progetto di prova ci sono
--    **sei** destinazioni fuori catalogo con almeno una riga scritta —
--    `agenda_da_segnare_fatto`, `agenda_da_spostare`, `soldi_di_chi`,
--    `anticipazione_da_registrare`, `lista_non_detta`,
--    `lista_nominata_spesa_spicciola` — e **tutte e sei** sparivano dal
--    riscontro immediato. Non e' un difetto dell'Agenda: e' del riscontro,
--    e tocca anche il lavoro sulle liste (06/09) e sulla tasca (07/09).
--
-- ⚠️ QUESTA MIGRAZIONE NON RENDE APPROVABILE NIENTE. Se una cosa si possa
--    approvare lo dice `appunti_vocali.eseguibile`, che il database ricava
--    dal catalogo per un'altra strada; misurato sulle due dettature vere di
--    Alessio, quei due appunti sono gia' `eseguibile = false` e restano
--    tali. Qui cambia soltanto **se la riga arriva a chi guarda**.
--
-- ⚠️ SCRITTA DAL CORPO VIVO DEL PROGETTO DI PROVA (`npm run funzione:viva
--    -- azioni_della_dettatura --prova`), non dal file che l'ha creata: fra
--    i due ci sono tutte le migrazioni che l'hanno toccata (regola del
--    18/08). Rispetto a quel corpo cambiano **tre cose e basta**: la
--    congiunzione diventa esterna, il titolo passa da `t.titolo` a
--    `destinazione_vocale(...)`, la natura prende `coalesce(..., 'libera')`.
--
-- ⚠️ `create or replace` E NON `drop`: la forma del risultato non cambia di
--    una colonna, e dopo un `drop` i permessi tornerebbero aperti al mondo
--    (lezione del 13/08). Non toccando la firma, i `grant` restano quelli.
-- ============================================================================

create or replace function azioni_della_dettatura(p_id uuid)
returns table (
  id uuid, progressivo integer, tipo text, titolo text, natura text, dati jsonb,
  sicuro boolean, frase text, motivo text, stato text, errore text,
  quando timestamptz, domanda text, scelte jsonb, percorso text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.progressivo, a.tipo,
         -- ⚠️ LA STESSA FONTE DELL'ELENCO GEMELLO, e non una seconda regola
         --    scritta qui: `destinazione_vocale` sa gia' che, quando il
         --    catalogo tace, il nome da mostrare e' quello dichiarato
         --    dall'azione. Copiare quella logica in un secondo posto vorrebbe
         --    dire che il giorno che cambia, i due elenchi ricominciano a
         --    dire cose diverse — che e' il difetto che questa migrazione
         --    chiude.
         (select d.titolo from destinazione_vocale(a.tipo, a.destinazione_libera) d),
         -- ⚠️ «libera» e' la natura di cio' che il catalogo non conosce, ed
         --    e' la stessa parola che usa l'elenco delle cose in attesa.
         coalesce(t.natura, 'libera'),
         a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, a.creato_il,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati),
         azione_percorso(a.tipo)
    from azioni_dettate a
    left join tipi_azione_vocale t on t.tipo = a.tipo
   where a.dettatura_id = p_id
   order by a.progressivo;
end $$;

comment on function azioni_della_dettatura(uuid) is
  'Quello che il gestionale ha capito da UNA dettatura, per il riscontro che compare subito dopo aver parlato. La congiunzione col catalogo e'' ESTERNA: una destinazione che il gestionale non sa ancora eseguire deve comparire lo stesso, o chi ha parlato legge «non ho capito niente» di una cosa capita benissimo (08/09/2026).';

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ TUTTO DENTRO UNA SOTTO-TRANSAZIONE ANNULLATA, come le due verifiche del
--    07/09: cosi' non resta niente da cancellare e non si dipende dal fatto
--    che la pulizia sia scritta bene. Il guardiano dei residui gira lo
--    stesso, perche' una sotto-transazione annullata non e' una prova che
--    non sia rimasto niente **fuori** da lei.
--
-- 🔴 E LA PROVA DEVE DISCRIMINARE IN DUE VERSI, non in uno. Una cura che
--    mostrasse la destinazione dichiarata per TUTTE le righe passerebbe il
--    controllo (a) e romperebbe il nome delle dodici destinazioni normali:
--    per questo nella stessa dettatura c'e' anche un `promemoria`, che deve
--    continuare a chiamarsi «Annota in Agenda» e a portare la natura del
--    catalogo.
do $verifica$
declare
  v_tit    uuid;
  v_foto   jsonb;
  v_det    uuid;
  v_tipo   text := 'prova_fuori_catalogo_' || replace(gen_random_uuid()::text, '-', '');
  v_n      integer;
  v_titolo text;
  v_natura text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Serve un titolare per provare questa migrazione.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  v_foto := foto_righe();

  begin

  insert into dettature (testo, provenienza, esito, creato_da)
  values ('VERIFICA 20260909000001 — il riscontro non perde le righe', 'app', 'capita', v_tit)
  returning id into v_det;

  -- (a) una destinazione che il catalogo NON conosce
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase,
                              motivo, stato, destinazione_libera)
  values (v_det, 1, v_tipo, '{}'::jsonb, true, 'VERIFICA riga fuori catalogo',
          'il gestionale non lo sa ancora fare', 'in_attesa', 'Da fare a mano');

  -- (b) una che il catalogo conosce — la meta' che discrimina
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase,
                              motivo, stato)
  values (v_det, 2, 'promemoria', '{"titolo":"VERIFICA"}'::jsonb, true,
          'VERIFICA promemoria', 'la guardi tu', 'in_attesa');

  -- 🔴 IL CONTROLLO CHE IL DIFETTO FACEVA FALLIRE: le righe scritte e le
  --    righe che la schermata riceve devono essere le stesse. Col `join`
  --    interno qui si leggeva 1 invece di 2.
  select count(*) into v_n from azioni_della_dettatura(v_det);
  if v_n <> 2 then
    raise exception 'Il riscontro perde le righe: scritte 2, ricevute %. Una destinazione fuori catalogo sparisce ancora.', v_n;
  end if;

  -- (a) la riga fuori catalogo si chiama come si e' dichiarata, e la sua
  --     natura e' «libera»
  select titolo, natura into v_titolo, v_natura
    from azioni_della_dettatura(v_det) where progressivo = 1;
  if v_titolo is distinct from 'Da fare a mano' then
    raise exception 'La riga fuori catalogo non porta il nome che si e'' dichiarata: %', coalesce(v_titolo, '(vuoto)');
  end if;
  if v_natura is distinct from 'libera' then
    raise exception 'La natura di una riga fuori catalogo dovrebbe essere «libera», e'' %', coalesce(v_natura, '(vuoto)');
  end if;

  -- (b) e quella conosciuta continua a leggere il CATALOGO, non se stessa
  select titolo, natura into v_titolo, v_natura
    from azioni_della_dettatura(v_det) where progressivo = 2;
  if v_titolo is distinct from 'Annota in Agenda' then
    raise exception 'Il promemoria ha smesso di prendere il nome dal catalogo: %', coalesce(v_titolo, '(vuoto)');
  end if;
  if v_natura is distinct from 'misura' then
    raise exception 'Il promemoria ha perso la natura del catalogo: %', coalesce(v_natura, '(vuoto)');
  end if;

  -- ⚠️ E l'elenco gemello continua a comportarsi come prima: se questa
  --    migrazione lo avesse toccato per sbaglio, si vedrebbe qui.
  select count(*) into v_n
    from azioni_dettate_in_attesa() where dettatura_id = v_det;
  if v_n <> 2 then
    raise exception 'L''elenco delle cose in attesa e'' cambiato: dovrebbe restituire 2, restituisce %.', v_n;
  end if;

  raise exception 'ANNULLA-VERIFICA';
  exception when others then
    if sqlerrm <> 'ANNULLA-VERIFICA' then
      raise;
    end if;
  end;

  perform pretendi_nessun_residuo(v_foto, 'la verifica del riscontro che non perde le righe');

  raise notice 'Verifica passata: il riscontro immediato restituisce anche le destinazioni che il gestionale non sa eseguire.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260909000001', 'il_riscontro_non_perde_le_righe') on conflict (version) do nothing;
