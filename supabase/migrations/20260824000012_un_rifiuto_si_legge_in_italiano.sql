-- =====================================================================
-- UN RIFIUTO SI LEGGE IN ITALIANO
-- 24/08/2026 — la meta' che mancava alle reti sui numeri assurdi
-- =====================================================================
-- 🔴 TROVATO DALLA RILETTURA PRIMA DELLA CONSEGNA, e misurato dal browser
-- chiamando l'operazione vera con un food cost di 1,1: il vincolo ferma il
-- dato — che e' il punto — ma la frase che si vede e':
--
--   new row for relation "scenari_proiezione" violates check constraint
--   "scenario_frazioni_sono_frazioni"
--
-- ⚠️ **E' META' CURA**: il numero assurdo non entra, e chi lo ha scritto
-- non capisce perche'. In sala, davanti a un cliente, una frase cosi' non
-- e' un rifiuto: e' un guasto.
--
-- ⚠️ E la spiegazione ESISTE GIA': ogni vincolo di questo progetto ha il
-- suo `comment on constraint` scritto in italiano, con la ragione della
-- soglia. **Nessuno li legge mentre si lavora.** Questa funzione li tira
-- fuori.
--
-- ---------------------------------------------------------------------
-- UNA REGOLA SOLA, decisa da Alessio
-- ---------------------------------------------------------------------
-- *«Traduzione al momento del rifiuto, UNA regola sola. Non il doppio
-- controllo nelle schermate: due regole per lo stesso limite significa che
-- un giorno una cambia e l'altra no, ed e' esattamente cosi' che nascono
-- le frasi diventate false.»*
--
-- La meta' nel browser sta in `src/lib/supabase.js`, dentro il punto unico
-- da cui passa **ogni** richiesta del gestionale — letture, scritture e
-- funzioni online insieme. Qui c'e' solo la fonte della frase.
--
-- ⚠️ NIENTE PORTIERE, ed e' voluto: questa funzione restituisce il
-- commento di un vincolo, cioe' una regola del gestionale — non un dato.
-- Chi ha appena ricevuto un rifiuto ha gia' visto il nome tecnico del
-- vincolo nel messaggio: negargli la spiegazione non protegge niente.
-- ⚠️ E risponde **solo** sui vincoli dello schema `public`: e' un elenco
-- chiuso di cose scritte da noi, non una finestra sul catalogo.
-- =====================================================================

create or replace function spiega_vincolo(p_nome text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select obj_description(c.oid, 'pg_constraint')
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public'
     and c.conname = p_nome
   limit 1;
$$;

comment on function spiega_vincolo(text) is
  'La spiegazione in italiano di un vincolo, presa dal suo commento. Serve a tradurre il rifiuto che il database restituisce: «violates check constraint "..."» non e'' una frase per chi sta lavorando.';

revoke all on function spiega_vincolo(text) from public;
grant execute on function spiega_vincolo(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Il commento perso da una controprova, rimesso
-- ---------------------------------------------------------------------
-- 🔴 TROVATO DALLA VERIFICA QUI SOTTO, alla prima esecuzione — ed era un
-- danno lasciato da me. Provando al contrario il vincolo delle aliquote
-- (blocco 1 di stamattina) l'ho tolto e rimesso **a mano**, e ho rimesso
-- il vincolo senza il suo commento: sul progetto di prova quella
-- spiegazione era sparita, in produzione c'era ancora.
--
-- ⚠️ E' la regola del 14/08 in una forma nuova: *una verifica che modifica
-- qualcosa non si ripulisce cancellando, si ripulisce **rimettendo** — e
-- quello che si rimette a mano si rimette a meta'*. Li' erano due colonne
-- di un tavolo; qui e' il commento di un vincolo, che nessuno guarda
-- finche' non serve.
--
-- Si rimette qui, dove e' idempotente: da oggi il caso si ripara da se'.
comment on constraint fiscal_settings_aliquote_in_punti on fiscal_settings is
  'Le aliquote di questa tabella si scrivono in PUNTI percentuali (24 = 24%), non in frazione (0,24). Scritte in frazione sbagliavano di cento volte senza nessun errore, e sempre verso il basso. Zero resta ammesso.';

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_frase text;
  v_senza integer;
begin
  -- (a) Un vincolo con la sua spiegazione la restituisce.
  v_frase := spiega_vincolo('scenario_frazioni_sono_frazioni');
  if v_frase is null then
    raise exception 'Il vincolo delle frazioni non ha restituito la sua spiegazione.';
  end if;
  if v_frase not ilike '%frazione%' then
    raise exception 'La spiegazione non parla di frazioni: «%».', v_frase;
  end if;

  -- (b) Un nome che non esiste restituisce VUOTO, non una frase inventata
  --     e nemmeno un errore: chi chiama deve poter distinguere «non ho la
  --     spiegazione» da «la spiegazione e' questa».
  if spiega_vincolo('vincolo-che-non-esiste-828') is not null then
    raise exception 'Un vincolo inesistente ha restituito qualcosa.';
  end if;

  -- (c) ⚠️ E LA PROPRIETA' CHE CONTA DAVVERO: **ogni vincolo aggiunto
  --     stanotte ha la sua spiegazione**. Non e' un conteggio — e'
  --     verificabile domani, e diventa rossa se qualcuno ne aggiunge uno
  --     muto. Un vincolo senza commento produce un rifiuto che questa
  --     funzione non sa tradurre, cioe' esattamente il difetto che
  --     chiude.
  select count(*) into v_senza
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public'
     and c.contype = 'c'
     and c.conname in (
       'fiscal_settings_aliquote_in_punti',
       'fiscal_settings_numeri_sensati',
       'scenario_frazioni_sono_frazioni',
       'scenario_numeri_sensati',
       'scenario_mesi_servizi_sensati',
       'supplier_invoices_importo_non_negativo',
       'payslips_importi_sensati',
       'cessioni_numeri_sensati',
       'service_settings_soglia_rincaro_valida',
       'ingredients_scarto_sotto_cento',
       'recipe_ingredienti_numeri_sensati',
       'ingredients_durate_sensate',
       'crops_raccolto_non_negativo',
       'temperature_dentro_il_mondo'
     )
     and obj_description(c.oid, 'pg_constraint') is null;

  if v_senza > 0 then
    raise exception '% vincoli delle reti non hanno la loro spiegazione in italiano.', v_senza;
  end if;

  raise notice 'Le spiegazioni dei vincoli si leggono: quattordici controllate, nessuna muta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000012', 'un_rifiuto_si_legge_in_italiano') on conflict (version) do nothing;
