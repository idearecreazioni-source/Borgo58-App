-- ============================================================================
-- CHI HA TOCCATO IL TETTO DELLA SPESA — 26/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, misurato sul gestionale vero. `impostazioni_ai` ha quattro
--    colonne — `id`, `tetto_mensile_euro`, `sbloccato_il`, `aggiornato_il` —
--    e **nessuna dice chi**. Il tetto di spesa dell'assistente e lo sblocco
--    che lo scavalca sono le due decisioni piu' delicate del modulo AI:
--    l'una decide quanto si puo' spendere in un mese, l'altra permette di
--    spendere oltre. Fino a oggi si sapeva **quando** erano cambiate e mai
--    **per mano di chi**.
--
--    ⚠️ E LO SBLOCCO E' PIU' DELICATO DEL TETTO, non il contrario: alzare il
--       tetto e' una decisione che si rilegge nel numero, sbloccare e' un
--       gesto che sparisce dentro un mese e non lascia niente da rileggere.
--
-- ----------------------------------------------------------------------------
-- 🔴 IL VALORE DI ADESSO NON VIENE ATTRIBUITO A NESSUNO, ED E' IL PUNTO
-- ----------------------------------------------------------------------------
-- In produzione il tetto vale 10,00 ed e' stato scritto il **26/08/2026 alle
-- 14:23:22 UTC** — da una migrazione, mentre Alessio era lontano dal
-- gestionale. Non l'ha deciso lui in quel momento, e scriverci sopra il suo
-- nome perche' e' il nome plausibile sarebbe **esattamente il difetto che
-- questa migrazione esiste per togliere**: una riga che dichiara un autore
-- che non ha fatto quel gesto e' peggio di una riga senza autore, perche'
-- la prima la si crede.
--
-- Quindi: `tetto_da` e `tetto_il` nascono **VUOTI** sulla riga che c'e'
-- gia'. Vuoto vuol dire «non c'e' nessun accesso a cui attribuirlo», e per
-- il valore di oggi la risposta e' quella vera — l'ha scritto una
-- migrazione, non una persona. Dal primo gesto vero in poi la colonna dira'
-- chi.
--
-- ----------------------------------------------------------------------------
-- E PERCHE' `tetto_il` E NON `aggiornato_il`
-- ----------------------------------------------------------------------------
-- `aggiornato_il` risponde a «l'ultima volta che questa riga e' cambiata»,
-- e la riga cambia per DUE gesti diversi. Il giorno che uno sblocco tocca
-- la riga senza toccare il tetto, `aggiornato_il` si sposta e il tetto
-- sembrerebbe cambiato quando non lo e'. E' la stessa forma di `usi` che
-- contava le aperture chiamandole dettature — e non se ne apre un secondo
-- caso: ogni gesto ha il suo istante e il suo autore, `aggiornato_il` resta
-- quello che e' sempre stato.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Niente di deciso da Alessio. Si aggiunge una traccia che non c'era.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Le colonne — vuote per chi c'era gia'
-- ----------------------------------------------------------------------------
alter table impostazioni_ai add column if not exists tetto_da     uuid references auth.users(id) on delete set null;
alter table impostazioni_ai add column if not exists tetto_il     timestamptz;
alter table impostazioni_ai add column if not exists sbloccato_da uuid references auth.users(id) on delete set null;

comment on column impostazioni_ai.tetto_da is
  'Quale accesso ha scritto il tetto di spesa. VUOTO = non c''e'' nessun accesso a cui attribuirlo: e'' il caso del valore messo da una migrazione il 26/08/2026, che nessuna persona ha deciso in quel momento. ⚠️ Non si riempie mai a posteriori col nome plausibile.';
comment on column impostazioni_ai.tetto_il is
  'Quando il tetto e'' stato scritto. E'' un istante suo e non `aggiornato_il`, perche'' quella riga cambia anche per lo sblocco: con una colonna sola, uno sblocco farebbe sembrare toccato anche il tetto.';
comment on column impostazioni_ai.sbloccato_da is
  'Quale accesso ha sbloccato la spesa oltre il tetto. VUOTO con `sbloccato_il` pieno vuol dire che lo sblocco e'' anteriore a questa colonna; VUOTO con `sbloccato_il` vuoto vuol dire che non ha sbloccato nessuno.';
comment on column impostazioni_ai.aggiornato_il is
  'L''ultima volta che questa riga e'' cambiata, per qualunque motivo. ⚠️ Non dice QUALE gesto: per quello ci sono `tetto_il` e `sbloccato_il`.';

-- ----------------------------------------------------------------------------
-- 2. Il tetto — corpo ripreso dal DATABASE VIVO
-- ----------------------------------------------------------------------------
create or replace function imposta_tetto_ai(p_euro numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare v_chi uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' cambiare il tetto di spesa.';
  end if;

  -- ⚠️ Chi ha fatto il gesto si CHIEDE, non si deduce: `auth.uid()` e'
  --    l'accesso di questa richiesta. Se un giorno arrivasse da una strada
  --    senza accesso, resterebbe vuoto — che e' la risposta vera.
  v_chi := auth.uid();

  -- ⚠️ Togliere il tetto e metterlo a zero sono due gesti diversi, e uno
  --    dei due non esiste: si passa un valore vuoto per toglierlo, e il
  --    vincolo rifiuta lo zero.
  update impostazioni_ai
     set tetto_mensile_euro = p_euro,
         tetto_da           = v_chi,
         tetto_il           = now(),
         aggiornato_il      = now()
   where id;

  return jsonb_build_object('tetto', p_euro, 'chi', v_chi);
end $funzione$;

-- ----------------------------------------------------------------------------
-- 3. Lo sblocco — corpo ripreso dal DATABASE VIVO
-- ----------------------------------------------------------------------------
create or replace function sblocca_spesa_ai()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_oggi date;
  v_chi  uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' sbloccare la spesa.';
  end if;

  v_chi := auth.uid();

  -- ⚠️ LA DATA E' QUELLA ITALIANA, come il mese che il tetto conta. Se le
  --    due si chiedessero a orologi diversi, uno sblocco dato all'una di
  --    notte dell'ultimo del mese varrebbe per il mese gia' finito.
  v_oggi := (now() at time zone 'Europe/Rome')::date;
  update impostazioni_ai
     set sbloccato_il  = v_oggi,
         sbloccato_da  = v_chi,
         aggiornato_il = now()
   where id;

  return jsonb_build_object('sbloccato_il', v_oggi, 'chi', v_chi);
end $funzione$;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ QUI NON SI CREA NIENTE DA CANCELLARE: `impostazioni_ai` e' una riga
--    sola e vera. Quindi la si salva INTERA prima e la si riscrive INTERA
--    dopo — mai ricordarsi a mano quali colonne si erano toccate, che e'
--    il modo in cui il 14/08 due tavoli sono rimasti spostati in mezzo ai
--    divani con la verifica che dichiarava zero residui.
do $verifica$
declare
  v_tit    uuid;
  v_prima  impostazioni_ai%rowtype;
  v_dopo   impostazioni_ai%rowtype;
  v_torna  impostazioni_ai%rowtype;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;

  select * into v_prima from impostazioni_ai where id;
  if not found then
    raise exception 'Non c''e'' nessuna riga di impostazioni_ai: questa verifica non puo'' girare.';
  end if;

  -- ------------------------------------------------------------------
  -- (A) IL VALORE DI ADESSO NON HA UN AUTORE, E NON DEVE AVERLO.
  --     🔴 E' il controllo che vale di piu' di tutta la migrazione: se
  --     qualcuno un giorno «sistemasse» la riga scrivendoci il nome di
  --     Alessio, questo diventerebbe rosso.
  -- ------------------------------------------------------------------
  if v_prima.tetto_da is not null then
    raise exception 'Il tetto gia'' esistente risulta attribuito a %, e non doveva esserlo: nessuno l''ha deciso in quel momento.',
      v_prima.tetto_da;
  end if;
  if v_prima.tetto_il is not null then
    raise exception 'Il tetto gia'' esistente porta un istante di scrittura (%), e non doveva: non lo sappiamo.',
      v_prima.tetto_il;
  end if;
  raise notice 'il tetto di adesso vale % e resta senza autore, com''e'' giusto',
    coalesce(v_prima.tetto_mensile_euro::text, '(nessun tetto)');

  -- ------------------------------------------------------------------
  -- (B) UN GESTO VERO LASCIA IL SUO NOME. Tetto e sblocco, uno per uno.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  perform imposta_tetto_ai(coalesce(v_prima.tetto_mensile_euro, 10));
  select * into v_dopo from impostazioni_ai where id;
  if v_dopo.tetto_da is distinct from v_tit then
    raise exception 'Dopo aver cambiato il tetto, «chi» vale % invece di %', v_dopo.tetto_da, v_tit;
  end if;
  if v_dopo.tetto_il is null then
    raise exception 'Dopo aver cambiato il tetto, l''istante e'' rimasto vuoto.';
  end if;
  raise notice 'tetto: chi passa da (vuoto) a %, quando da (vuoto) a %', v_dopo.tetto_da, v_dopo.tetto_il;

  perform sblocca_spesa_ai();
  select * into v_dopo from impostazioni_ai where id;
  if v_dopo.sbloccato_da is distinct from v_tit then
    raise exception 'Dopo lo sblocco, «chi» vale % invece di %', v_dopo.sbloccato_da, v_tit;
  end if;
  if v_dopo.sbloccato_il is null then
    raise exception 'Dopo lo sblocco, la data e'' rimasta vuota.';
  end if;
  raise notice 'sblocco: chi %, quando %', v_dopo.sbloccato_da, v_dopo.sbloccato_il;

  -- ------------------------------------------------------------------
  -- (C) LO SBLOCCO NON DEVE SPOSTARE L'ISTANTE DEL TETTO.
  --     E' la ragione per cui `tetto_il` esiste separata.
  -- ------------------------------------------------------------------
  if v_dopo.tetto_il is distinct from (select tetto_il from impostazioni_ai where id) then
    raise exception 'Lo sblocco ha spostato l''istante del tetto.';
  end if;

  -- ------------------------------------------------------------------
  -- SI RIMETTE LA RIGA COM'ERA — intera, colonna per colonna.
  -- ------------------------------------------------------------------
  update impostazioni_ai
     set tetto_mensile_euro = v_prima.tetto_mensile_euro,
         sbloccato_il       = v_prima.sbloccato_il,
         aggiornato_il      = v_prima.aggiornato_il,
         tetto_da           = v_prima.tetto_da,
         tetto_il           = v_prima.tetto_il,
         sbloccato_da       = v_prima.sbloccato_da
   where id;

  select * into v_torna from impostazioni_ai where id;
  if v_torna is distinct from v_prima then
    raise exception 'La riga non e'' tornata com''era: prima %, adesso %', v_prima, v_torna;
  end if;
  raise notice 'impostazioni_ai rimessa identica: tetto %, sbloccato %, chi (vuoto)',
    coalesce(v_torna.tetto_mensile_euro::text, '(nessuno)'),
    coalesce(v_torna.sbloccato_il::text, '(mai)');
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000009', 'chi_ha_toccato_il_tetto_della_spesa') on conflict (version) do nothing;
