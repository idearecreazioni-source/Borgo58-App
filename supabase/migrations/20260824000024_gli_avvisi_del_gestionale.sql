-- =====================================================================
-- GLI AVVISI DEL GESTIONALE — il riquadro della prima schermata
-- 24/08/2026 — blocco 1(b) del mandato del collaudo
-- =====================================================================
-- Alessio: *«gli avvisi che oggi mi arrivano su Telegram alle 10:00
-- (scadenze, prodotti fermi, ecc.), raccolti in un riquadro»*, con tre
-- regole che decidono la forma prima ancora del contenuto:
--
--   1. Telegram e' solo UN'USCITA: aprire il messaggio la' non deve
--      togliere l'avviso da qui;
--   2. un avviso sparisce DA SOLO quando la cosa e' risolta;
--   3. unica eccezione, un «rimanda a domani».
--
-- 🔴 LA (2) DECIDE TUTTO: un avviso non e' una RIGA che qualcuno scrive e
-- qualcun altro spegne — e' una CONDIZIONE calcolata ogni volta che si
-- guarda. E' la stessa scelta del ritardo dei tavoli (18/08): una colonna
-- «in ritardo» sarebbe vera quando la si scrive e falsa dieci minuti
-- dopo. Qui vale allo stesso modo: buttato il prodotto scaduto, l'avviso
-- se ne va perche' la condizione non c'e' piu', non perche' qualcuno
-- l'abbia spento.
--
-- ⚠️ E LA (1) VIENE GRATIS da questa forma: Telegram legge le stesse
-- condizioni e non le tocca. Se l'avviso fosse una riga con uno stato,
-- prima o poi qualcuno l'avrebbe spenta da la'.
--
-- 🔴 LA MISURA HA CAMBIATO IL DISEGNO, e non di poco. Contate sul
-- progetto di prova (due mesi di vita finta a scala vera), le fonti
-- danno: **65** scadenze da segnalare, **131** prodotti con la scheda
-- incompleta, **55** ingredienti sotto soglia, 3 conti da fiscalizzare,
-- 6 numeri sospetti, 1 non conformita' aperta. Un riquadro che elencasse
-- i FATTI sarebbe una lista di 261 righe sulla prima schermata della
-- mattina, cioe' una cosa che non si legge.
--
-- ⚠️ Quindi il riquadro elenca gli AVVISI, non i fatti: **una riga per
-- famiglia**, con quanti casi ci sono e dove si va a risolverli — la
-- stessa forma del messaggio delle 10:00, che dice «65 in scadenza» e ne
-- nomina cinque. Il dettaglio sta nella schermata che quel dettaglio lo
-- sa mostrare.
--
-- ⚠️ E TRE FONTI RESTANO FUORI, dichiarate qui perche' la scelta non si
-- perda.
--
-- Le prime due sono **prodotti da compilare** (131) e **ingredienti sotto
-- soglia** (55). Non sono «cose che non vanno»: sono lavoro arretrato che
-- non finira' mai a zero, e un avviso che c'e' sempre e' un avviso che si
-- impara a non leggere — la stessa ragione per cui il badge dell'Agenda
-- conta solo ritardo e oggi. Hanno gia' la loro schermata, e ci si va
-- quando si decide di andarci.
--
-- 🔴 La terza e' **i numeri sospetti** (6), e la ragione e' diversa: sono
-- un avviso che meriterebbe di stare qui, ma `numeri_sospetti()` NON HA
-- UNA SCHERMATA — si legge solo da `npm run numeri`, cioe' da un
-- terminale. Un avviso che non ha dove mandare chi lo legge e' un vicolo
-- cieco, ed e' il difetto n. 8 del mandato di correzione. Entra il giorno
-- che quella schermata esiste, e nel frattempo la riga sta scritta qui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Il rimando — l'unica cosa che si scrive
-- ---------------------------------------------------------------------
-- ⚠️ Il rimando e' per FAMIGLIA, non per singolo fatto, perche' e' la
-- famiglia a comparire nel riquadro: si rimanda quello che si vede.
-- Il precedente e' `stock_lots.ricordamelo_il` (23/08), che rimanda una
-- partita dentro la schermata del magazzino — li' l'elenco e' di fatti,
-- qui e' di famiglie, e il rimando segue quello che c'e' davanti.
--
-- ⚠️ IL PREZZO, dichiarato: rimandando «scadenze» a domani, una scadenza
-- NUOVA che arriva stasera resta nascosta fino a domani. E' accettabile
-- perche' il rimando e' corto per costruzione (giorni, non settimane) —
-- ma va scritto, perche' e' l'unico modo in cui questo riquadro puo'
-- tacere su qualcosa di vero.
create table if not exists avvisi_rimandati (
  chiave        text primary key,
  fino_al       date        not null,
  rimandato_il  timestamptz not null default now(),
  rimandato_da  uuid        references auth.users(id) on delete set null
);

comment on table avvisi_rimandati is
  'Gli avvisi che il titolare ha deciso di non affrontare adesso, e fino a quando. Una riga per famiglia di avviso; smette di valere da sola quando la data e'' passata.';

alter table avvisi_rimandati drop constraint if exists rimando_non_eterno;
alter table avvisi_rimandati
  add constraint rimando_non_eterno
  check (fino_al <= rimandato_il::date + 90);

comment on constraint rimando_non_eterno on avvisi_rimandati is
  'Un avviso si rimanda al massimo di tre mesi: oltre non e'' un rimando, e'' uno spegnimento — e gli avvisi di questo riquadro non si spengono.';

alter table avvisi_rimandati enable row level security;

drop policy if exists avvisi_rimandati_titolare on avvisi_rimandati;
create policy avvisi_rimandati_titolare on avvisi_rimandati
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ---------------------------------------------------------------------
-- 2 · Gli avvisi, calcolati
-- ---------------------------------------------------------------------
-- 🔴 IL PORTIERE. `security definer` gira senza RLS (rilievo del
-- validatore del 13/08), e qui dentro passano incassi non fiscalizzati e
-- numeri di denaro: il controllo va rimesso dentro. E chi non deve
-- vedere riceve un RIFIUTO, non un elenco vuoto — un riquadro vuoto e'
-- una rassicurazione falsa.
create or replace function public.avvisi_del_gestionale()
returns table (
  chiave      text,
  titolo      text,
  dettaglio   text,
  quanti      integer,
  dove        text,
  gravita     text,
  rimandato_a date
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    -- (b) I PRODOTTI FERMI — domanda diversa dalla scadenza, nominata da
    -- Alessio: un barattolo aperto un mese fa con scadenza fra un anno lo
    -- vede solo questa.
    select 'partite_ferme',
           'Prodotti fermi da troppo',
           (select count(*)::integer from partite_ferme()),
           '/magazzino/fermi',
           'media',
           (select string_agg(x.prodotto, ', ')
              from (select f.prodotto from partite_ferme() f
                     order by f.ferma_da desc limit 3) x)

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

comment on function public.avvisi_del_gestionale() is
  'Le cose che non vanno, calcolate adesso e mai memorizzate: sparisce da sola quella che viene risolta. Una riga per famiglia col numero di casi e dove si risolve.';

revoke all on function public.avvisi_del_gestionale() from public, anon, authenticated;
grant execute on function public.avvisi_del_gestionale() to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Rimanda — l'unico gesto che scrive
-- ---------------------------------------------------------------------
create or replace function public.rimanda_avviso(p_chiave text, p_giorni integer default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_fino   date;
  v_esiste boolean;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può rimandare un avviso.';
  end if;
  if p_giorni is null or p_giorni < 1 then
    raise exception 'Di quanti giorni si rimanda? Serve almeno un giorno.';
  end if;

  -- ⚠️ Si rimanda solo un avviso che ESISTE ADESSO: rimandare una cosa
  -- che non c'e' scriverebbe una riga che non spegne niente e che nessuno
  -- potrebbe piu' trovare.
  select exists(select 1 from avvisi_del_gestionale() a where a.chiave = p_chiave)
    into v_esiste;
  if not v_esiste then
    raise exception 'Questo avviso non c''è più: non c''è niente da rimandare.';
  end if;

  -- ⚠️ In Italia: a mezzanotte e mezza «fra un giorno» ne conterebbe zero.
  v_fino := oggi_a_roma() + p_giorni;

  insert into avvisi_rimandati (chiave, fino_al, rimandato_il, rimandato_da)
  values (p_chiave, v_fino, now(), auth.uid())
  on conflict (chiave) do update
    set fino_al = excluded.fino_al,
        rimandato_il = now(),
        rimandato_da = auth.uid();

  return jsonb_build_object('chiave', p_chiave, 'fino_al', v_fino,
    'frase', format('Rimandato: torna il %s.', to_char(v_fino, 'DD/MM/YYYY')));
end $function$;

comment on function public.rimanda_avviso(text, integer) is
  'Toglie un avviso dal riquadro fino a una data. L''unico modo di far sparire un avviso senza risolvere la cosa — e dura poco per costruzione.';

revoke all on function public.rimanda_avviso(text, integer) from public, anon, authenticated;
grant execute on function public.rimanda_avviso(text, integer) to authenticated;

create or replace function public.riprendi_avviso(p_chiave text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può riprendere un avviso.';
  end if;
  delete from avvisi_rimandati where chiave = p_chiave;
end $function$;

comment on function public.riprendi_avviso(text) is
  'Annulla un rimando: l''avviso torna subito nel riquadro. Un gesto che si puo'' solo fare e mai disfare e'' un vicolo cieco.';

revoke all on function public.riprendi_avviso(text) from public, anon, authenticated;
grant execute on function public.riprendi_avviso(text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — nei DUE versi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_staff     uuid;
  v_quanti    integer;
  v_prima     integer;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_chiave    text;
  v_rifiutato boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) La funzione RISPONDE. ⚠️ Non basta che sia stata creata: Postgres
  -- accetta un corpo che chiama funzioni inesistenti e non se ne accorge
  -- finche' non lo esegue (lezione del 17/08). Quindi la si CHIAMA.
  select count(*) into v_prima from avvisi_del_gestionale();
  raise notice 'Avvisi aperti adesso: %.', v_prima;

  -- (b) Il rimando toglie l'avviso dal riquadro — ma solo se ce n'era uno.
  --     ⚠️ Il caso vuoto non proverebbe niente (regola del 17/08): se non
  --     c'e' nessun avviso, lo si DICHIARA invece di far finta.
  if v_prima = 0 then
    raise notice 'Nessun avviso aperto su questo database: il rimando non e'' stato esercitato qui.';
  else
    select a.chiave into v_chiave from avvisi_del_gestionale() a limit 1;

    perform rimanda_avviso(v_chiave, 3);
    select count(*) into v_quanti
      from avvisi_del_gestionale() a where a.chiave = v_chiave and a.rimandato_a is null;
    if v_quanti > 0 then
      raise exception 'Un avviso rimandato risulta ancora non rimandato.';
    end if;

    -- (c) LA CONTROPROVA CHE DISCRIMINA: riprendendolo, torna. Senza
    --     questa, un codice che cancella l'avviso per sempre passerebbe (b).
    perform riprendi_avviso(v_chiave);
    select count(*) into v_quanti
      from avvisi_del_gestionale() a where a.chiave = v_chiave and a.rimandato_a is null;
    if v_quanti <> 1 then
      raise exception 'Ripreso, l''avviso non e'' tornato nel riquadro.';
    end if;

    -- (d) Un avviso che non esiste non si rimanda.
    v_rifiutato := false;
    begin
      perform rimanda_avviso('questa_famiglia_non_esiste', 1);
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Si e'' potuto rimandare un avviso inesistente.';
    end if;
  end if;

  -- (e) IL PORTIERE, provato col ruolo vero e non sulla parola.
  select ur.user_id into v_staff from user_roles ur where ur.role <> 'titolare' limit 1;
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform count(*) from avvisi_del_gestionale();
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Lo staff puo'' leggere gli avvisi del gestionale.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  else
    raise notice 'Nessun utente non-titolare: il portiere non e'' stato esercitato.';
  end if;

  -- (f) Si ripulisce cio' che questa verifica ha creato, e SOLO quello.
  delete from avvisi_rimandati where chiave = 'questa_famiglia_non_esiste';

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Gli avvisi si calcolano, si rimandano e si riprendono.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000024', 'gli_avvisi_del_gestionale') on conflict (version) do nothing;
