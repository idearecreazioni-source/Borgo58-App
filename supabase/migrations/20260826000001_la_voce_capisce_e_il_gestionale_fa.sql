-- ============================================================================
-- I COMANDI VOCALI — la voce capisce, e il gestionale fa — 26/08/2026
-- ============================================================================
--
-- Alessio parla una volta sola — «pomodori due casse, olio tre bottiglie,
-- tonno cinque scatole» — e il gestionale ne ricava un ELENCO DI AZIONI.
-- Quelle di cui e' sicuro le fa; le altre restano li' e le conferma lui.
--
-- ⚠️ RIUSA IL MOTORE DELLE FOTO, non ne costruisce un secondo: stesso
--    tetto di spesa (`impostazioni_ai`), stesso listino (`costo_modello_ai`),
--    stessa forma del registro. La spesa del mese e' UNA, e questa
--    migrazione la allarga per contare anche le dettature — un tetto che
--    guarda meta' della spesa non e' un tetto.
--
-- ----------------------------------------------------------------------------
-- LE CINQUE COSE CHE QUESTA MIGRAZIONE DECIDE
-- ----------------------------------------------------------------------------
--
-- 1. 🔴 IL CRITERIO SALVA-DA-SE' E' UN PRINCIPIO, NON UN ELENCO DI RAMI.
--    Vive in `tipi_azione_vocale.natura` — `misura` oppure `creazione` — e
--    la regola che decide sta in UNA funzione (`azione_si_esegue_da_se`).
--    Aggiungere un'azione nuova vuol dire aggiungere una RIGA e dichiarare
--    di che natura e'; non toccare nessun ramo di programma.
--    · `misura`    = un fatto GIA' AVVENUTO che Alessio registra. Se sbaglia,
--                    si corregge rifacendo lo stesso gesto, e nel frattempo
--                    non ha sporcato niente.
--    · `creazione` = fa NASCERE una cosa nuova, o tocca i soldi. Li' l'errore
--                    non si vede rifacendo il gesto: si vede fra tre mesi, in
--                    un food cost storto o in un saldo che non torna.
--
-- 2. 🔴 NIENTE SCADE DA SOLO. Un'azione che Alessio non conferma resta
--    `in_attesa` per sempre, e `azioni_dettate_in_attesa()` dice da quanti
--    giorni sta li'. Buttare via una dettatura fatta in cella e' la cosa
--    che gli farebbe smettere di usare la voce.
--
-- 3. 🔴 LA TEMPERATURA SENZA IL FRIGO NON SI SCRIVE, E LO IMPEDISCE IL
--    DATABASE. Quel registro va all'ASP: indovinare quale frigo intendesse
--    vorrebbe dire mettere una misura vera sotto il nome sbagliato — e
--    nessun errore la segnalerebbe. Il vincolo e' sulla riga, non nella
--    schermata, perche' la riga arriva da tre strade (l'app, la Scorciatoia
--    del watch, e domani chissa').
--
-- 4. 🔴 MAGLIA LARGA: se non capisce, NON INVENTA — lascia una nota con
--    quello che ha sentito. E' il tipo `nota_non_capita`, che e' una
--    `misura` (annota una frase, non crea niente) e compare in Dashboard.
--
-- 5. 🔴 IL PUNTO CHE RICEVE DA FUORI E' PROTETTO DA UNA CHIAVE DAL PRIMO
--    GIORNO. Aggiungerla dopo vorrebbe dire rifare la Scorciatoia sul
--    telefono e sul watch. La chiave non e' conservata: si conserva la sua
--    IMPRONTA, e la chiave in chiaro si vede una volta sola quando nasce.
--    ⚠️ E la funzione che la accetta e' aperta al ruolo anonimo — per
--    forza: una Scorciatoia non ha un accesso al gestionale. Quindi ha il
--    suo freno anti-abuso, come vuole il Contratto §4 per tutto cio' che
--    e' esposto ad `anon`, e l'elenco delle funzioni aperte cresce di DUE,
--    dichiarato qui e nella prova che lo sorveglia.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il catalogo delle azioni — e la loro natura
-- ----------------------------------------------------------------------------
create table if not exists tipi_azione_vocale (
  tipo     text primary key,
  natura   text not null,
  titolo   text not null,
  spiega   text,
  attivo   boolean not null default true
);

comment on table tipi_azione_vocale is
  'Cosa la voce sa fare, e di che natura e'' ciascuna cosa. E'' un DATO e non un elenco di casi dentro un programma: aggiungere un''azione vuol dire aggiungere una riga e dichiararne la natura. La natura e'' quello che decide se il gestionale la esegue da se'' o la mette davanti agli occhi di Alessio.';
comment on column tipi_azione_vocale.natura is
  '`misura` = un fatto gia'' avvenuto che si registra, e che sbagliato si corregge rifacendo il gesto. `creazione` = fa nascere qualcosa di nuovo o tocca i soldi, e li'' l''errore non si vede rifacendo il gesto: si vede fra tre mesi.';

alter table tipi_azione_vocale drop constraint if exists natura_nota;
alter table tipi_azione_vocale
  add constraint natura_nota check (natura in ('misura', 'creazione'));
comment on constraint natura_nota on tipi_azione_vocale is
  'Le nature sono due: registrare una misura gia'' presa, oppure creare qualcosa di nuovo. Una terza non esiste, e se un giorno servira'' va aggiunta qui insieme alla regola che decide, non in una schermata.';

alter table tipi_azione_vocale enable row level security;
drop policy if exists tipi_azione_vocale_lettura on tipi_azione_vocale;
create policy tipi_azione_vocale_lettura on tipi_azione_vocale
  for select to authenticated using (true);
drop policy if exists tipi_azione_vocale_titolare on tipi_azione_vocale;
create policy tipi_azione_vocale_titolare on tipi_azione_vocale
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

insert into tipi_azione_vocale (tipo, natura, titolo, spiega) values
  ('giacenza',        'misura',    'Allinea la giacenza',      'Quanto ce n''e'' davvero di un prodotto. E'' un conteggio fatto con gli occhi: se sbaglia, ricontando si corregge.'),
  ('temperatura',     'misura',    'Registra una temperatura', 'Il numero letto sul termometro di un frigo o dell''abbattitore. Va scritto solo se e'' stato detto ANCHE quale frigo.'),
  ('promemoria',      'misura',    'Annota in Agenda',         'Una cosa da ricordare. Sbagliata si cancella, e non ha toccato nessun altro numero del gestionale.'),
  ('pulizia',         'misura',    'Segna una pulizia fatta',  'Una pulizia gia'' fatta che si registra. Il gesto e'' avvenuto: qui si annota.'),
  ('lista_spesa',     'misura',    'Aggiungi alla spesa',      'Una riga della lista della spesa. Non compra niente e non muove soldi: si toglie con un tocco.'),
  ('merce_buttata',   'misura',    'Segna merce buttata',      'Roba andata a male. E'' un fatto gia'' successo, e la quantita'' si corregge riallineando la giacenza.'),
  ('nota_non_capita', 'misura',    'Nota da riguardare',       'Non ho capito cosa fare: lascio scritto quello che ho sentito, senza inventare. Compare in Dashboard.'),
  ('ricetta',         'creazione', 'Ricetta',                  'Dettare o modificare una ricetta. Non si salva da se'' MAI: una ricetta storta sposta il food cost di ogni piatto che la usa.'),
  ('prodotto_nuovo',  'creazione', 'Prodotto nuovo',           'Creare un prodotto in magazzino. Un doppione nato a voce resta li'' per sempre e sdoppia le giacenze.'),
  ('carico_merce',    'creazione', 'Carico merce',             'Registrare merce arrivata. Fa nascere partite con costi e scadenze: passa sempre dall''occhio.'),
  ('movimento_cassa', 'creazione', 'Movimento di cassa',       'Qualunque cosa tocchi i soldi. Non si salva mai da se'', per nessun motivo e per nessun grado di sicurezza.')
on conflict (tipo) do nothing;

-- ----------------------------------------------------------------------------
-- 2. IL PRINCIPIO, in un posto solo
-- ----------------------------------------------------------------------------
-- ⚠️ Sta qui e non in tre schermate. La stessa domanda se la fanno la
--    funzione online, il browser e chiunque scriva un'azione dritta in
--    tabella: se ognuno rispondesse per conto suo, prima o poi uno dei tre
--    salverebbe da se' una creazione.
create or replace function azione_si_esegue_da_se(p_tipo text, p_sicuro boolean)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $funzione$
  select coalesce(p_sicuro, false)
     and exists (
       select 1 from tipi_azione_vocale t
        where t.tipo = p_tipo and t.attivo and t.natura = 'misura');
$funzione$;

comment on function azione_si_esegue_da_se(text, boolean) is
  'Il criterio, scritto una volta sola: si salva da se'' cio'' che e'' una MISURA gia'' presa da Alessio E di cui l''assistente si e'' dichiarato sicuro. Tutto il resto passa dai suoi occhi. Un tipo spento non si esegue mai da se'', qualunque sia la sua natura.';

revoke all on function azione_si_esegue_da_se(text, boolean) from public, anon, authenticated;
grant execute on function azione_si_esegue_da_se(text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Le dettature
-- ----------------------------------------------------------------------------
-- ⚠️ NON CONSERVA L'AUDIO, e nemmeno per un istante: quello che arriva qui
--    e' gia' TESTO. La trascrizione avviene sul dispositivo — il browser in
--    cucina, l'iPhone al polso — e l'audio non lascia mai quel dispositivo.
--    Stessa forma della foto: non si cancella cio' che non e' mai stato
--    scritto.
create table if not exists dettature (
  id             uuid primary key default gen_random_uuid(),
  testo          text not null,
  provenienza    text not null,
  esito          text not null,
  modello        text,
  token_domanda  integer not null default 0,
  token_risposta integer not null default 0,
  costo_euro     numeric(10,5) not null default 0,
  messaggio      text,
  creato_il      timestamptz not null default now(),
  creato_da      uuid references auth.users(id) on delete set null
);

comment on table dettature is
  'Ogni volta che Alessio ha parlato: cosa e'' stato trascritto, da dove arrivava, quanto e'' costato capirlo. L''AUDIO NON E'' QUI e non e'' da nessun''altra parte: la trascrizione avviene sul dispositivo, e quello che viaggia e'' gia'' testo.';
comment on column dettature.provenienza is
  'Da dove e'' arrivata: `app` se il microfono era quello del gestionale aperto, `scorciatoia` se e'' arrivata da fuori con una chiave (l''Apple Watch). Serve a sapere quale delle due strade viene usata davvero.';
comment on column dettature.esito is
  '`capita` quando ne e'' uscita almeno un''azione, `non_capita` quando non ne e'' uscita nessuna e resta solo la nota, `tetto` se la spesa del mese ha fermato la lettura, `errore` per tutto il resto.';

alter table dettature drop constraint if exists dettatura_provenienza_nota;
alter table dettature
  add constraint dettatura_provenienza_nota check (provenienza in ('app', 'scorciatoia'));
comment on constraint dettatura_provenienza_nota on dettature is
  'Le strade da cui una dettatura puo'' arrivare sono due: il microfono dell''app aperta, oppure una Scorciatoia che entra con una chiave. Una terza non esiste, e inventarne una vorrebbe dire che qualcuno sta scrivendo qui senza passare da nessuna delle due porte.';

alter table dettature drop constraint if exists dettatura_esito_noto;
alter table dettature
  add constraint dettatura_esito_noto check (esito in ('capita', 'non_capita', 'tetto', 'errore'));
comment on constraint dettatura_esito_noto on dettature is
  'Come puo'' finire una dettatura. Se ne serve uno nuovo si aggiunge qui, cosi'' il conto della spesa e la schermata restano d''accordo.';

alter table dettature drop constraint if exists dettatura_costo_sensato;
alter table dettature
  add constraint dettatura_costo_sensato
  check (costo_euro >= 0 and costo_euro <= 5 and token_domanda >= 0 and token_risposta >= 0);
comment on constraint dettatura_costo_sensato on dettature is
  'Una dettatura non puo'' costare piu'' di cinque euro: una filza di prodotti non ci arriva nemmeno lontanamente, e un numero cosi'' vorrebbe dire un prezzo scritto nell''unita'' sbagliata. Meglio fermarsi che registrare una spesa falsa.';

alter table dettature drop constraint if exists dettatura_testo_non_vuoto;
alter table dettature
  add constraint dettatura_testo_non_vuoto check (length(btrim(testo)) > 0);
comment on constraint dettatura_testo_non_vuoto on dettature is
  'Una dettatura senza testo non e'' una dettatura: e'' un giro a vuoto registrato come se qualcosa fosse stato detto.';

create index if not exists idx_dettature_data on dettature (creato_il desc);

alter table dettature enable row level security;
drop policy if exists dettature_titolare on dettature;
create policy dettature_titolare on dettature
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ----------------------------------------------------------------------------
-- 4. Le azioni ricavate da una dettatura
-- ----------------------------------------------------------------------------
create table if not exists azioni_dettate (
  id           uuid primary key default gen_random_uuid(),
  dettatura_id uuid not null references dettature(id) on delete cascade,
  progressivo  integer not null,
  tipo         text not null references tipi_azione_vocale(tipo),
  dati         jsonb not null default '{}'::jsonb,
  sicuro       boolean not null,
  frase        text not null,
  motivo       text,
  stato        text not null,
  eseguita_il  timestamptz,
  risultato    jsonb,
  errore       text,
  creato_il    timestamptz not null default now()
);

comment on table azioni_dettate is
  'Quello che il gestionale ha capito da una dettatura, un''azione per riga e nell''ordine in cui sono state dette. Le sicure di natura «misura» nascono gia'' eseguite; tutte le altre restano in attesa finche'' Alessio non le guarda, e NON scadono mai.';
comment on column azioni_dettate.dati is
  'I parametri dell''azione, gia'' risolti dove si e'' potuto: l''identificativo del prodotto invece del nome sentito, quello del frigo invece di «la cella». Quando un identificativo manca, l''azione non e'' sicura e il motivo lo dice.';
comment on column azioni_dettate.frase is
  'Come si legge a schermo, in italiano: «Passata di pomodoro Mutti: ce ne sono 4 kg». E'' quello che Alessio guarda per dire si'' o no, quindi si scrive per lui e non per chi programma.';
comment on column azioni_dettate.motivo is
  'Perche'' questa azione aspetta invece di essere gia'' fatta. Vuoto su un''azione eseguita. Non e'' una cortesia: senza, un elenco di cose in attesa e'' un elenco di cose di cui non si sa che fare.';
comment on column azioni_dettate.stato is
  '`eseguita` (il gestionale l''ha fatta), `in_attesa` (aspetta Alessio, e aspetta per sempre), `annullata` (Alessio ha detto di no), `fallita` (si e'' provato e il database ha rifiutato, e il motivo e'' scritto accanto).';

alter table azioni_dettate drop constraint if exists azione_stato_noto;
alter table azioni_dettate
  add constraint azione_stato_noto check (stato in ('eseguita', 'in_attesa', 'annullata', 'fallita'));
comment on constraint azione_stato_noto on azioni_dettate is
  'Gli stati di un''azione dettata sono quattro. Se ne serve uno nuovo si aggiunge qui insieme a chi lo legge, altrimenti la schermata e il database si raccontano due storie diverse.';

alter table azioni_dettate drop constraint if exists azione_eseguita_ha_la_sua_ora;
alter table azioni_dettate
  add constraint azione_eseguita_ha_la_sua_ora
  check ((stato = 'eseguita') = (eseguita_il is not null));
comment on constraint azione_eseguita_ha_la_sua_ora on azioni_dettate is
  'Un''azione eseguita ha l''ora in cui e'' stata fatta, e una non eseguita non ce l''ha. Le due cose devono dire lo stesso: un''ora su un''azione in attesa farebbe credere che sia gia'' successa.';

alter table azioni_dettate drop constraint if exists azione_frase_non_vuota;
alter table azioni_dettate
  add constraint azione_frase_non_vuota check (length(btrim(frase)) > 0);
comment on constraint azione_frase_non_vuota on azioni_dettate is
  'Un''azione senza una frase leggibile e'' un''azione che Alessio non puo'' ne'' confermare ne'' rifiutare: si troverebbe davanti un riquadro vuoto da approvare.';

-- 🔴 LA TEMPERATURA SENZA IL FRIGO NON ESISTE, e lo dice il DATABASE.
--    Quel registro va all'ASP: una misura vera scritta sotto il nome
--    sbagliato non produce nessun errore e resta li' per anni.
alter table azioni_dettate drop constraint if exists temperatura_dice_quale_frigo;
alter table azioni_dettate
  add constraint temperatura_dice_quale_frigo
  check (
    tipo <> 'temperatura'
    or stato <> 'eseguita'
    or (dati ? 'equipment_id' and nullif(dati->>'equipment_id', '') is not null)
  );
comment on constraint temperatura_dice_quale_frigo on azioni_dettate is
  'Una temperatura si registra solo se e'' stato detto ANCHE quale frigo o abbattitore. Mai indovinare quale intendesse: quel registro va all''ASP, e una misura vera messa sotto il nome sbagliato non da'' nessun errore. Senza il frigo l''azione puo'' esistere, ma resta in attesa e lo chiede.';

create unique index if not exists uniq_azione_dettata_progressivo
  on azioni_dettate (dettatura_id, progressivo);
create index if not exists idx_azioni_dettate_attesa
  on azioni_dettate (stato, creato_il) where stato = 'in_attesa';

alter table azioni_dettate enable row level security;
drop policy if exists azioni_dettate_titolare on azioni_dettate;
create policy azioni_dettate_titolare on azioni_dettate
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ----------------------------------------------------------------------------
-- 5. Le chiavi con cui si entra da fuori
-- ----------------------------------------------------------------------------
-- 🔴 LA CHIAVE IN CHIARO NON E' QUI. Si conserva la sua impronta, e la
--    chiave si vede una volta sola: nel momento in cui nasce, per copiarla
--    dentro la Scorciatoia. Se si perde se ne fa un'altra e si revoca la
--    vecchia, che e' anche cio' che si fa se il telefono viene smarrito.
create table if not exists chiavi_voce (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  impronta    text not null unique,
  utente_id   uuid not null references auth.users(id) on delete cascade,
  creata_il   timestamptz not null default now(),
  revocata_il timestamptz,
  ultimo_uso  timestamptz,
  usi         integer not null default 0
);

comment on table chiavi_voce is
  'Le chiavi con cui una Scorciatoia dell''iPhone o dell''Apple Watch puo'' mandare una dettatura al gestionale. La chiave in chiaro NON e'' conservata: c''e'' solo la sua impronta, e la chiave si vede una volta sola quando nasce.';
comment on column chiavi_voce.impronta is
  'L''impronta della chiave (sha256). Da un''impronta non si risale alla chiave: chi legge questa tabella non puo'' entrare da nessuna parte.';
comment on column chiavi_voce.usi is
  'Quante dettature sono entrate con questa chiave. Serve a due domande: la Scorciatoia funziona davvero? e, se il numero cresce quando Alessio non parla, qualcun altro ce l''ha.';

create index if not exists idx_chiavi_voce_attive on chiavi_voce (impronta) where revocata_il is null;

alter table chiavi_voce enable row level security;
drop policy if exists chiavi_voce_titolare on chiavi_voce;
create policy chiavi_voce_titolare on chiavi_voce
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ----------------------------------------------------------------------------
-- 6. La spesa del mese conta ANCHE le dettature
-- ----------------------------------------------------------------------------
-- 🔴 Corpo ripreso dal DATABASE VIVO (non dal file che l'ha creata) e
--    cambiato in un punto solo: la somma. Un tetto che guardasse le sole
--    foto direbbe «sei sotto» mentre la voce spende, ed e' il modo in cui
--    un tetto smette di essere un tetto senza che nessuno lo tolga.
create or replace function spesa_ai_del_mese()
returns table(
  speso_euro    numeric,
  tetto_euro    numeric,
  percentuale   numeric,
  blocca        boolean,
  avvisa        boolean,
  sbloccato     boolean,
  letture       integer,
  frase         text
)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  v_primo   date;
  v_speso   numeric;
  v_n       integer;
  v_tetto   numeric;
  v_sblocco date;
  v_perc    numeric;
  v_sbl     boolean;
begin
  if not is_titolare() then
    raise exception 'La spesa dell''assistente e'' riservata al titolare.';
  end if;

  v_primo := date_trunc('month', (now() at time zone 'Europe/Rome'))::date;

  select coalesce(sum(x.costo), 0), count(*)
    into v_speso, v_n
    from (
      select l.costo_euro as costo, l.creato_il as quando from letture_foto l
      union all
      select d.costo_euro, d.creato_il from dettature d
    ) x
   where (x.quando at time zone 'Europe/Rome')::date >= v_primo;

  select i.tetto_mensile_euro, i.sbloccato_il into v_tetto, v_sblocco
    from impostazioni_ai i where i.id;

  -- Uno sblocco vale per il mese in cui e' stato dato, e non oltre.
  v_sbl := v_sblocco is not null and v_sblocco >= v_primo;

  if v_tetto is null then
    return query select
      round(v_speso, 5), null::numeric, null::numeric,
      false, false, v_sbl, v_n,
      'Non c''e'' nessun tetto di spesa: le letture non si fermano mai da sole. Il tetto si mette da qui.'::text;
    return;
  end if;

  v_perc := round(v_speso / v_tetto * 100, 1);

  return query select
    round(v_speso, 5),
    v_tetto,
    v_perc,
    -- 🔴 AL CENTO PER CENTO SI BLOCCA, a meno che Alessio non abbia detto
    -- di andare avanti. E bloccare non ferma il lavoro: la scheda si
    -- compila a mano come sempre, ed e' il motivo per cui questo blocco
    -- puo' permettersi di essere netto invece che gentile.
    (v_perc >= 100 and not v_sbl),
    (v_perc >= 80 and v_perc < 100),
    v_sbl,
    v_n,
    case
      when v_perc >= 100 and v_sbl then
        'La spesa del mese ha superato il tetto, ma e'' stata sbloccata: le letture continuano.'
      when v_perc >= 100 then
        'La spesa del mese ha raggiunto il tetto: le letture sono ferme. Le schede si compilano a mano come sempre, oppure si sblocca da qui.'
      when v_perc >= 80 then
        'La spesa del mese si sta avvicinando al tetto.'
      else
        'La spesa del mese e'' sotto il tetto.'
    end::text;
end $funzione$;

comment on function spesa_ai_del_mese() is
  'Quanto e'' costato l''assistente questo mese, FOTO E VOCE INSIEME, e se il tetto e'' stato raggiunto. Il mese e'' quello italiano e di calendario: il tetto e'' una spesa mensile, e chi la paga ragiona a mesi veri.';

revoke all on function spesa_ai_del_mese() from public, anon, authenticated;
grant execute on function spesa_ai_del_mese() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ Il perimetro e' fatto di roba che la verifica ha creato, e si cancella
--    per identificativo (regola del 23/08). Il tetto che c'era prima si
--    salva e si rimette com'era: e' una scelta di Alessio, non un dato di
--    questa migrazione.
do $verifica$
declare
  v_tit        uuid;
  v_dettatura  uuid;
  v_azione     uuid;
  v_tetto_pre  numeric;
  v_speso      numeric;
  v_speso_dopo numeric;
  v_n          integer;
  v_ok         boolean;
  v_lapidi_pre integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------------
  -- (A) IL PRINCIPIO discrimina, e discrimina nei due versi.
  --     ⚠️ Non basta che risponda «vero» sul caso buono: una funzione che
  --     rispondesse sempre vero passerebbe quel controllo. Servono i
  --     quattro incroci — misura/creazione per sicuro/non sicuro.
  -- ------------------------------------------------------------------
  if not azione_si_esegue_da_se('giacenza', true) then
    raise exception 'Una misura sicura dovrebbe salvarsi da se'', e non lo fa';
  end if;
  if azione_si_esegue_da_se('giacenza', false) then
    raise exception 'Una misura NON sicura si e'' salvata da se''';
  end if;
  if azione_si_esegue_da_se('movimento_cassa', true) then
    raise exception 'Una creazione si e'' salvata da se'' perche'' era sicura: e'' il caso che il criterio esiste per impedire';
  end if;
  if azione_si_esegue_da_se('movimento_cassa', false) then
    raise exception 'Una creazione non sicura si e'' salvata da se''';
  end if;
  if azione_si_esegue_da_se('non_esiste_questo_tipo', true) then
    raise exception 'Un tipo che non esiste si e'' salvato da se''';
  end if;

  -- Un tipo SPENTO non si esegue mai da se', qualunque sia la sua natura.
  update tipi_azione_vocale set attivo = false where tipo = 'pulizia';
  if azione_si_esegue_da_se('pulizia', true) then
    raise exception 'Un tipo spento si e'' salvato da se''';
  end if;
  update tipi_azione_vocale set attivo = true where tipo = 'pulizia';

  -- ------------------------------------------------------------------
  -- (B) Le undici azioni ci sono, e sono divise come dice il mandato.
  --     ⚠️ Si contano per NATURA e non in totale: un totale giusto puo'
  --     nascondere una creazione classificata come misura, che e'
  --     esattamente il difetto che romperebbe tutto.
  -- ------------------------------------------------------------------
  select count(*) into v_n from tipi_azione_vocale where natura = 'misura';
  if v_n <> 7 then
    raise exception 'Le azioni che si salvano da se'' sono % invece di 7', v_n;
  end if;
  select count(*) into v_n from tipi_azione_vocale where natura = 'creazione';
  if v_n <> 4 then
    raise exception 'Le azioni che passano dall''occhio sono % invece di 4', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- (C) Una temperatura ESEGUITA senza il frigo la respinge il database.
  --     🔴 E' la regola che protegge un registro che va all'ASP.
  -- ------------------------------------------------------------------
  insert into dettature (testo, provenienza, esito, creato_da)
  values ('verifica della migrazione', 'app', 'capita', v_tit)
  returning id into v_dettatura;

  v_ok := false;
  begin
    insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, stato, eseguita_il)
    values (v_dettatura, 1, 'temperatura', '{"gradi": 3}'::jsonb, true,
            'Temperatura 3 gradi', 'eseguita', now());
    raise exception 'ATTESO RIFIUTO: temperatura eseguita senza dire quale frigo';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then
    raise exception 'Una temperatura senza frigo e'' entrata nel registro HACCP';
  end if;

  -- La stessa temperatura IN ATTESA invece si scrive: non registra
  -- niente, e chiedere quale frigo e' proprio il suo mestiere.
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_dettatura, 1, 'temperatura', '{"gradi": 3}'::jsonb, false,
          'Temperatura 3 gradi', 'Non hai detto quale frigo', 'in_attesa')
  returning id into v_azione;

  -- ------------------------------------------------------------------
  -- (D) Un''azione eseguita ha la sua ora, e una in attesa non ce l''ha.
  -- ------------------------------------------------------------------
  v_ok := false;
  begin
    update azioni_dettate set stato = 'eseguita' where id = v_azione;
    raise exception 'ATTESO RIFIUTO: eseguita senza ora';
  exception
    when check_violation then v_ok := true;
    when others then
      if sqlerrm like 'ATTESO RIFIUTO%' then raise; end if;
      raise;
  end;
  if not v_ok then
    raise exception 'Un''azione risulta eseguita senza che si sappia quando';
  end if;

  -- ------------------------------------------------------------------
  -- (E) LA SPESA DEL MESE CONTA LE DETTATURE.
  --     🔴 Il controllo che vale piu' degli altri: se contasse le sole
  --     foto, il tetto direbbe «sei sotto» mentre la voce spende.
  --     ⚠️ Si misura una DIFFERENZA che si produce apposta, non uno stato.
  -- ------------------------------------------------------------------
  select i.tetto_mensile_euro into v_tetto_pre from impostazioni_ai i where i.id;
  select s.speso_euro into v_speso from spesa_ai_del_mese() s;

  update dettature set costo_euro = 0.12345, modello = 'claude-sonnet-5'
   where id = v_dettatura;

  select s.speso_euro into v_speso_dopo from spesa_ai_del_mese() s;
  if v_speso_dopo - v_speso <> 0.12345 then
    raise exception 'La spesa del mese non ha contato la dettatura: da % a %', v_speso, v_speso_dopo;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo, e solo di roba nostra.
  -- ------------------------------------------------------------------
  delete from dettature where id = v_dettatura;
  select count(*) into v_n from azioni_dettate where dettatura_id = v_dettatura;
  if v_n <> 0 then
    raise exception 'Sono rimaste % azioni della verifica', v_n;
  end if;

  select s.speso_euro into v_speso_dopo from spesa_ai_del_mese() s;
  if v_speso_dopo <> v_speso then
    raise exception 'La verifica ha lasciato % euro di spesa dietro di se''', v_speso_dopo - v_speso;
  end if;

  if v_tetto_pre is distinct from (select i.tetto_mensile_euro from impostazioni_ai i where i.id) then
    raise exception 'La verifica ha cambiato il tetto di spesa di Alessio';
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'La voce ha il suo magazzino: 7 azioni si salvano da se'' e 4 passano dagli occhi di Alessio, una temperatura senza frigo la respinge il database, e la spesa del mese conta foto e voce insieme.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000001', 'la_voce_capisce_e_il_gestionale_fa')
on conflict (version) do nothing;
