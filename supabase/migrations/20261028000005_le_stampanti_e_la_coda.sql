-- =====================================================================
-- LE STAMPANTI E LA CODA — 28/10/2026, chiesto da Alessio dopo il
-- fornitore: «dobbiamo creare l'infrastruttura per collegare l'hardware
-- tramite IP e poi fisseremo una data per il collaudo».
-- =====================================================================
--
-- 🔴 PERCHE' UNA CODA E NON UNA CHIAMATA. Il gestionale e' un sito, e un
--    sito non puo' parlare con un apparecchio della rete del locale
--    (ARCHITETTURA §3b). Ci parla un programma sul mini-PC del ristorante,
--    «il ponte»: il gestionale scrive qui il lavoro, il ponte lo prende, lo
--    manda alla stampante e scrive com'e' andata (ARCHITETTURA §4.2). Se la
--    stampante e' spenta il lavoro resta qui col suo stato, visibile.
--
-- 🔴 IN QUESTO PASSO SOLO PROVE E LETTURE DI STATO, NIENTE SCONTRINI.
--    `lavori_stampa.tipo` ammette 'prova' e 'stato' e nient'altro: e' il
--    database stesso a rifiutare un lavoro fiscale finche' una migrazione
--    successiva non lo aggiunge. Uno scontrino del registratore e' un
--    incasso vero, che va all'Agenzia delle Entrate: non si apre per
--    sbaglio (mandato del registratore telematico, 20/08).
--
-- 🔴 «INCERTO» NON SI RIPROVA DA SOLO. Se il ponte ha mandato il lavoro e
--    la risposta non e' arrivata, non si sa se e' uscito: riprovare da
--    solo vorrebbe dire, il giorno degli scontrini, un documento fiscale
--    doppio. Lo decide una persona (`annulla_lavoro_stampa`).
--
-- ⚠️ STESSA FORMA DELLA CHIAVE DEL LUOGO (20261028000003): il ponte non ha
--    l'accesso di Alessio, ha una chiave sua che si vede una volta sola,
--    di cui il database tiene l'impronta, e che si revoca dal gestionale.
--    Le tre funzioni del ponte sono aperte ad `anon` per forza — il ponte
--    non fa il login — e il portiere e' la chiave, che deve appartenere al
--    titolare.
--
-- ⚠️ SOLO INDIRIZZI DELLA RETE DEL LOCALE. Il ponte chiama gli indirizzi
--    che legge da qui: se qui potesse finire un indirizzo di internet, il
--    ponte diventerebbe una porta verso fuori. Il vincolo lo impedisce nel
--    database, e il ponte lo ricontrolla da se'.

-- ---------------------------------------------------------------------
-- 1. Gli apparecchi del locale
-- ---------------------------------------------------------------------
create table if not exists dispositivi (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  tipo                text not null,
  protocollo          text not null,
  indirizzo           inet not null,
  porta               integer not null,
  reparto             order_destination,
  attivo              boolean not null default true,
  ultimo_contatto_il  timestamptz,
  ultimo_stato        text not null default 'sconosciuto',
  ultimo_stato_testo  text,
  creato_il           timestamptz not null default now()
);

comment on table dispositivi is
  'Le stampanti e il registratore telematico del locale, con il loro indirizzo nella rete del ristorante. Li usa il ponte sul mini-PC: il gestionale da solo non può raggiungerli.';
comment on column dispositivi.nome is
  'Il nome con cui riconosci l''apparecchio, per esempio «Stampante cucina» o «Registratore».';
comment on column dispositivi.tipo is
  'Che cos''è: il registratore telematico (registratore_fiscale) o una stampante delle comande (stampante_comande).';
comment on column dispositivi.protocollo is
  'La lingua in cui il ponte gli parla: fpmate_http per il registratore Epson, escpos_tcp o epos_xml_http per una stampante Epson, simulatore per l''apparecchio finto delle prove.';
comment on column dispositivi.indirizzo is
  'L''indirizzo IP dell''apparecchio nella rete del locale, per esempio 192.168.1.50. Lo dice il fornitore, o si legge sul foglio che l''apparecchio stampa all''accensione.';
comment on column dispositivi.porta is
  'La porta su cui l''apparecchio ascolta: 9100 per una stampante ESC/POS, 80 per il registratore. Il fornitore la conferma.';
comment on column dispositivi.reparto is
  'Per una stampante delle comande: il reparto di cui stampa i biglietti (cucina o bar). Vuoto per il registratore.';
comment on column dispositivi.ultimo_stato is
  'Com''era l''apparecchio l''ultima volta che il ponte gli ha parlato: pronto, carta finita, coperchio aperto, non risponde, errore, oppure sconosciuto se non gli ha ancora parlato.';

alter table dispositivi drop constraint if exists dispositivo_tipo_noto;
alter table dispositivi add constraint dispositivo_tipo_noto
  check (tipo in ('registratore_fiscale', 'stampante_comande'));
comment on constraint dispositivo_tipo_noto on dispositivi is
  'Un apparecchio è il registratore telematico oppure una stampante delle comande.';

alter table dispositivi drop constraint if exists dispositivo_protocollo_del_tipo;
alter table dispositivi add constraint dispositivo_protocollo_del_tipo
  check ((tipo = 'registratore_fiscale' and protocollo in ('fpmate_http', 'simulatore'))
      or (tipo = 'stampante_comande' and protocollo in ('escpos_tcp', 'epos_xml_http', 'simulatore')));
comment on constraint dispositivo_protocollo_del_tipo on dispositivi is
  'Il registratore parla FPMate (o è il simulatore); una stampante delle comande parla ESC/POS o ePOS (o è il simulatore).';

-- 🔴 La regola che tiene il ponte dentro il locale.
alter table dispositivi drop constraint if exists dispositivo_nella_rete_del_locale;
--    ⚠️ Il simulatore vive sul mini-PC stesso, quindi solo 127.0.0.1: un
--    «simulatore» su un altro indirizzo sarebbe un modo di far chiamare al
--    ponte una porta qualunque della rete (revisione di sicurezza, 28/10).
--    ⚠️ E niente .0 e .255: sono la rete e il suo «a tutti», non un
--    apparecchio.
alter table dispositivi add constraint dispositivo_nella_rete_del_locale
  check (family(indirizzo) = 4 and masklen(indirizzo) = 32
     and case when protocollo = 'simulatore' then indirizzo = inet '127.0.0.1'
              else (indirizzo << inet '10.0.0.0/8'
                 or indirizzo << inet '172.16.0.0/12'
                 or indirizzo << inet '192.168.0.0/16')
               and host(indirizzo) !~ '\.(0|255)$'
         end);
comment on constraint dispositivo_nella_rete_del_locale on dispositivi is
  'L''indirizzo deve essere un apparecchio della rete del locale (comincia con 192.168, 10 o 172.16–31, e non finisce con .0 o .255), scritto senza barre. Un indirizzo di internet non è ammesso: il ponte non deve poter chiamare fuori. L''apparecchio finto sta solo su 127.0.0.1.';

alter table dispositivi drop constraint if exists dispositivo_porta_del_protocollo;
alter table dispositivi add constraint dispositivo_porta_del_protocollo
  check ((protocollo = 'escpos_tcp' and porta = 9100)
      or (protocollo in ('fpmate_http', 'epos_xml_http') and porta in (80, 443, 8008, 8043))
      or (protocollo = 'simulatore' and porta between 18000 and 19999));
comment on constraint dispositivo_porta_del_protocollo on dispositivi is
  'La porta non è quella di questo tipo di apparecchio: 9100 per una stampante ESC/POS, 80, 443, 8008 o 8043 per il registratore e per ePOS, fra 18000 e 19999 per l''apparecchio finto.';

alter table dispositivi drop constraint if exists dispositivo_reparto_della_stampante;
alter table dispositivi add constraint dispositivo_reparto_della_stampante
  check ((tipo = 'stampante_comande') = (reparto is not null));
comment on constraint dispositivo_reparto_della_stampante on dispositivi is
  'Una stampante delle comande deve dire di quale reparto stampa (cucina o bar); il registratore non ha reparto.';

alter table dispositivi drop constraint if exists dispositivo_stato_noto;
alter table dispositivi add constraint dispositivo_stato_noto
  check (ultimo_stato in ('pronto', 'carta_finita', 'coperchio_aperto', 'non_risponde', 'errore', 'sconosciuto'));
comment on constraint dispositivo_stato_noto on dispositivi is
  'Lo stato di un apparecchio è uno di quelli che il ponte sa riconoscere.';

alter table dispositivi drop constraint if exists dispositivo_nome_presente;
alter table dispositivi add constraint dispositivo_nome_presente
  check (btrim(nome) <> '' and length(nome) <= 60 and nome !~ '[[:cntrl:]<>&]');
comment on constraint dispositivo_nome_presente on dispositivi is
  'Dai un nome all''apparecchio (al massimo 60 lettere, senza i segni < > &): serve a riconoscerlo nella coda, e finisce stampato sul foglio di prova.';

-- ⚠️ Indici unici e non vincoli: due apparecchi attivi con lo stesso
--    compito sono un errore di scrittura, non una scelta. La schermata lo
--    dice prima con parole sue; questi sono la rete.
create unique index if not exists dispositivi_un_registratore_attivo
  on dispositivi ((true)) where attivo and tipo = 'registratore_fiscale';
create unique index if not exists dispositivi_una_stampante_per_reparto
  on dispositivi (reparto) where attivo and tipo = 'stampante_comande';
create unique index if not exists dispositivi_un_indirizzo_attivo
  on dispositivi (indirizzo, porta) where attivo;
create unique index if not exists dispositivi_nome_unico
  on dispositivi (lower(btrim(nome)));

alter table dispositivi enable row level security;
drop policy if exists dispositivi_titolare on dispositivi;
create policy dispositivi_titolare on dispositivi
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ Lo stato lo scrive solo il ponte: il titolare decide cosa c'e' e
--    dove sta, non come sta.
revoke all on table dispositivi from anon;
revoke insert, update on table dispositivi from authenticated;
grant insert (nome, tipo, protocollo, indirizzo, porta, reparto, attivo) on dispositivi to authenticated;
grant update (nome, tipo, protocollo, indirizzo, porta, reparto, attivo) on dispositivi to authenticated;

-- ---------------------------------------------------------------------
-- 2. La chiave del ponte
-- ---------------------------------------------------------------------
create table if not exists chiavi_ponte (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  impronta       text not null unique,
  utente_id      uuid not null references auth.users(id) on delete cascade,
  creata_il      timestamptz not null default now(),
  revocata_il    timestamptz,
  ultimo_battito timestamptz,
  versione       text,
  host           text,
  usi            bigint not null default 0,
  finestra_da    timestamptz,
  finestra_usi   integer not null default 0
);

comment on table chiavi_ponte is
  'Le chiavi con cui il programma ponte del mini-PC entra nel gestionale. La chiave in chiaro NON è conservata: c''è solo la sua impronta, e si vede una volta sola quando nasce. Il ponte può solo leggere gli apparecchi, prendere i lavori di stampa e scriverne l''esito.';
comment on column chiavi_ponte.impronta is
  'L''impronta della chiave (sha256). Da un''impronta non si risale alla chiave.';
comment on column chiavi_ponte.ultimo_battito is
  'L''ultima volta che il ponte ha detto «ci sono». Ogni 30 secondi quando è acceso: se è vecchio più di 90 secondi, il ponte è spento o senza rete.';
comment on column chiavi_ponte.finestra_da is
  'Inizio del minuto in cui si contano le chiamate per il freno (300 al minuto).';

comment on constraint chiavi_ponte_impronta_key on chiavi_ponte is
  'Due chiavi non possono avere la stessa impronta: se succedesse, una chiave aprirebbe anche l''altra.';

alter table chiavi_ponte enable row level security;
drop policy if exists chiavi_ponte_titolare on chiavi_ponte;
create policy chiavi_ponte_titolare on chiavi_ponte
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));
revoke all on table chiavi_ponte from anon;

create or replace function public.crea_chiave_ponte(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave text;
  v_id     uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può creare la chiave del ponte.';
  end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then
    raise exception 'Dai un nome a questa chiave, per esempio «Mini-PC ristorante».';
  end if;

  -- `extensions.` per esteso: pgcrypto vive li' (stessa trappola di
  -- `crea_chiave_luogo`).
  v_chiave := replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-');

  insert into chiavi_ponte (nome, impronta, utente_id)
  values (btrim(p_nome), encode(extensions.digest(v_chiave, 'sha256'), 'hex'), auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nome', btrim(p_nome), 'chiave', v_chiave);
end $function$;

create or replace function public.revoca_chiave_ponte(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_nome text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può revocare la chiave del ponte.';
  end if;
  update chiavi_ponte set revocata_il = now()
   where id = p_id and revocata_il is null
   returning nome into v_nome;
  if v_nome is null then
    raise exception 'Questa chiave non c''è, oppure era già stata tolta.';
  end if;
  return jsonb_build_object('nome', v_nome);
end $function$;

-- ⚠️ «Acceso» lo calcola il database con il suo orologio: quello del
--    telefono o del computer di chi guarda puo'' essere avanti o indietro.
create or replace function public.chiavi_ponte_elenco()
returns table(id uuid, nome text, creata_il timestamptz, ultimo_battito timestamptz,
              versione text, host text, acceso boolean, revocata_il timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Le chiavi del ponte sono riservate al titolare.';
  end if;
  return query
  select c.id, c.nome, c.creata_il, c.ultimo_battito, c.versione, c.host,
         coalesce(c.revocata_il is null and c.ultimo_battito > now() - interval '90 seconds', false),
         c.revocata_il
    from chiavi_ponte c order by c.revocata_il nulls first, c.creata_il desc;
end $function$;

revoke all on function public.crea_chiave_ponte(text) from public, anon, authenticated;
revoke all on function public.revoca_chiave_ponte(uuid) from public, anon, authenticated;
revoke all on function public.chiavi_ponte_elenco() from public, anon, authenticated;
grant execute on function public.crea_chiave_ponte(text) to authenticated;
grant execute on function public.revoca_chiave_ponte(uuid) to authenticated;
grant execute on function public.chiavi_ponte_elenco() to authenticated;

-- ---------------------------------------------------------------------
-- 3. La coda dei lavori di stampa
-- ---------------------------------------------------------------------
create table if not exists lavori_stampa (
  id              uuid primary key default gen_random_uuid(),
  dispositivo_id  uuid not null references dispositivi(id) on delete cascade,
  tipo            text not null,
  stato           text not null default 'in_coda',
  contenuto       jsonb not null default '{}'::jsonb,
  tentativi       integer not null default 0,
  preso_il        timestamptz,
  preso_da        uuid references chiavi_ponte(id) on delete set null,
  finito_il       timestamptz,
  esito           jsonb,
  errore_codice   text,
  errore_testo    text,
  creato_da       uuid default auth.uid(),
  creato_il       timestamptz not null default now()
);

comment on table lavori_stampa is
  'La coda di stampa (ARCHITETTURA §4.2): il gestionale scrive qui cosa stampare, il ponte sul mini-PC lo prende e scrive com''è andata. Oggi solo prove di stampa e letture di stato: niente scontrini.';
comment on column lavori_stampa.tipo is
  'prova = un foglio di prova non fiscale; stato = chiedere all''apparecchio come sta, senza stampare. Gli scontrini non sono ammessi in questo passo.';
comment on column lavori_stampa.stato is
  'in_coda → in_corso (l''ha preso il ponte) → stampato, fallito o incerto. Incerto vuol dire: mandato, ma la risposta non è arrivata — forse è uscito, forse no. Non si riprova da solo.';
comment on column lavori_stampa.contenuto is
  'Cosa stampare, in righe di testo. Mai comandi per la stampante: li compone il ponte, cosi'' da qui non si può mandare un comando che l''apparecchio esegue.';
comment on column lavori_stampa.esito is
  'Quello che l''apparecchio ha risposto, come lo ha letto il ponte (per esempio lo stato della carta).';

alter table lavori_stampa drop constraint if exists lavoro_tipo_di_questo_passo;
alter table lavori_stampa add constraint lavoro_tipo_di_questo_passo
  check (tipo in ('prova', 'stato'));
comment on constraint lavoro_tipo_di_questo_passo on lavori_stampa is
  'Per ora la coda accetta solo prove di stampa e letture di stato: gli scontrini e le comande arriveranno con un passo dedicato.';

alter table lavori_stampa drop constraint if exists lavoro_stato_noto;
alter table lavori_stampa add constraint lavoro_stato_noto
  check (stato in ('in_coda', 'in_corso', 'stampato', 'fallito', 'incerto', 'annullato'));
comment on constraint lavoro_stato_noto on lavori_stampa is
  'Un lavoro di stampa è in coda, in corso, stampato, fallito, incerto o annullato.';

alter table lavori_stampa drop constraint if exists lavoro_finito_ha_la_sua_ora;
alter table lavori_stampa add constraint lavoro_finito_ha_la_sua_ora
  check ((stato in ('stampato', 'fallito', 'incerto', 'annullato')) = (finito_il is not null)
     and (stato <> 'in_corso' or preso_il is not null));
comment on constraint lavoro_finito_ha_la_sua_ora on lavori_stampa is
  'Un lavoro finito dice quando è finito, e uno in corso dice quando il ponte l''ha preso.';

alter table lavori_stampa drop constraint if exists lavoro_errore_noto;
alter table lavori_stampa add constraint lavoro_errore_noto
  check (errore_codice is null or errore_codice in
    ('carta_finita', 'coperchio_aperto', 'non_risponde', 'risposta_a_meta', 'rifiutato', 'interrotto', 'sconosciuto'));
comment on constraint lavoro_errore_noto on lavori_stampa is
  'Il motivo di un errore è uno di quelli che il ponte sa riconoscere.';

alter table lavori_stampa drop constraint if exists lavoro_esito_misurato;
alter table lavori_stampa add constraint lavoro_esito_misurato
  check ((esito is null or pg_column_size(esito) <= 4000)
     and (errore_testo is null or length(errore_testo) <= 500)
     and pg_column_size(contenuto) <= 8000);
comment on constraint lavoro_esito_misurato on lavori_stampa is
  'Il contenuto e la risposta di un lavoro di stampa hanno una misura massima: un foglio di prova non è un libro.';

-- 🔴 Un lavoro aperto per apparecchio, in questo passo: premere due volte
--    «Prova» non accoda due fogli. Quando arriveranno le comande questo
--    indice andra' rivisto: piu' biglietti possono aspettare insieme.
create unique index if not exists lavori_stampa_uno_aperto_per_apparecchio
  on lavori_stampa (dispositivo_id) where stato in ('in_coda', 'in_corso');
create index if not exists lavori_stampa_da_prendere
  on lavori_stampa (creato_il) where stato = 'in_coda';
create index if not exists lavori_stampa_per_apparecchio
  on lavori_stampa (dispositivo_id, creato_il desc);
create index if not exists lavori_stampa_preso_da
  on lavori_stampa (preso_da) where preso_da is not null;
create index if not exists lavori_stampa_finiti
  on lavori_stampa (finito_il) where finito_il is not null;

-- 🔴 UN LAVORO PRESO E MAI CHIUSO (il ponte si è spento a metà) NON TORNA
--    IN CODA: dopo cinque minuti diventa incerto, e lo guarda una persona.
--    Cinque e non due: una stampante che riprova da sola può metterci più
--    di un minuto, e il ponte non va scavalcato mentre lavora (revisione
--    del database, 28/10). Se poi l'esito arriva lo stesso, lo corregge
--    (`ponte_esito_lavoro`).
-- ⚠️ Gira dentro le funzioni che guardano la coda — presa del ponte, prova
--    chiesta, annullo — così un ponte spento non tiene bloccato
--    l'apparecchio. Non è `security definer` e nessuno la chiama da fuori.
create or replace function public.scadi_lavori_abbandonati()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  update lavori_stampa
     set stato = 'incerto', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Il ponte ha preso questo lavoro e non ha più risposto: forse è uscito, forse no. Guarda la stampante e decidi tu.'
   where stato = 'in_corso' and preso_il < now() - interval '5 minutes';
end $function$;

revoke all on function public.scadi_lavori_abbandonati() from public, anon, authenticated;

alter table lavori_stampa enable row level security;
drop policy if exists lavori_stampa_titolare_legge on lavori_stampa;
create policy lavori_stampa_titolare_legge on lavori_stampa
  for select to authenticated
  using ((select is_titolare()));

-- ⚠️ Nessuno scrive la coda a mano: si entra solo dalle funzioni qui sotto.
revoke all on table lavori_stampa from anon;
revoke insert, update, delete on table lavori_stampa from authenticated;

-- Chiedere una prova, o lo stato, a un apparecchio (solo il titolare).
create or replace function public.chiedi_lavoro_dispositivo(p_dispositivo_id uuid, p_tipo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_disp dispositivi%rowtype;
  v_id   uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può provare gli apparecchi.';
  end if;
  if p_tipo not in ('prova', 'stato') then
    raise exception 'Si può chiedere una prova di stampa o lo stato dell''apparecchio, nient''altro.';
  end if;

  perform scadi_lavori_abbandonati();

  select * into v_disp from dispositivi where id = p_dispositivo_id;
  if not found then
    raise exception 'Questo apparecchio non c''è più: ricarica la pagina.';
  end if;
  if not v_disp.attivo then
    raise exception '«%» è spento nel gestionale: accendilo prima di provarlo.', v_disp.nome;
  end if;
  if exists (select 1 from lavori_stampa
              where dispositivo_id = p_dispositivo_id and stato in ('in_coda', 'in_corso')) then
    raise exception 'Per «%» c''è già una prova che aspetta il ponte: aspetta che finisca, oppure annullala.', v_disp.nome;
  end if;

  -- ⚠️ Due tocchi nello stesso istante passano entrambi il controllo qui
  --    sopra: il secondo lo ferma l'indice, e qui gli si dà la stessa frase.
  begin
    insert into lavori_stampa (dispositivo_id, tipo, contenuto)
    values (p_dispositivo_id, p_tipo,
            jsonb_build_object(
              'titolo', case when p_tipo = 'prova' then 'PROVA DI STAMPA' else 'STATO' end,
              'righe', jsonb_build_array(
                'Borgo 58',
                v_disp.nome,
                'Documento non fiscale',
                to_char(now() at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'))))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Per «%» c''è già una prova che aspetta il ponte: aspetta che finisca, oppure annullala.', v_disp.nome;
  end;
  return v_id;
end $function$;

-- Togliere un lavoro che aspetta, o chiudere uno incerto dopo aver
-- guardato la stampante (solo il titolare).
create or replace function public.annulla_lavoro_stampa(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può annullare un lavoro di stampa.';
  end if;
  perform scadi_lavori_abbandonati();
  update lavori_stampa
     set stato = 'annullato', finito_il = now()
   where id = p_id and stato in ('in_coda', 'incerto');
  if not found then
    raise exception 'Questo lavoro non si può più annullare: o è già finito, o il ponte lo sta stampando adesso.';
  end if;
end $function$;

revoke all on function public.chiedi_lavoro_dispositivo(uuid, text) from public, anon, authenticated;
revoke all on function public.annulla_lavoro_stampa(uuid) from public, anon, authenticated;
grant execute on function public.chiedi_lavoro_dispositivo(uuid, text) to authenticated;
grant execute on function public.annulla_lavoro_stampa(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Le tre porte del ponte
-- ---------------------------------------------------------------------
-- ⚠️ L'INGRESSO E' UNO SOLO, per tutte e tre: riconosce la chiave, conta le
--    chiamate e si mette nei panni del titolare a cui la chiave appartiene.
--    Non e' `security definer` e nessuno la puo' chiamare da fuori: gira
--    dentro le tre porte, che sono gia' del proprietario.
-- ⚠️ IL FRENO (Contratto §4): 300 chiamate al minuto per chiave. Il ponte
--    ne fa una trentina — una ogni due secondi per guardare la coda, un
--    battito ogni trenta — quindi trecento vogliono dire che la chiave la
--    sta usando qualcun altro, o che il ponte e' impazzito.
--    ⚠️ Scoperto e dichiarato come per la chiave del luogo: nessun freno
--    sui tentativi FALLITI di indovinare una chiave (24 byte casuali).
create or replace function public.ponte_entra(p_chiave text)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_riga chiavi_ponte%rowtype;
begin
  if nullif(btrim(coalesce(p_chiave, '')), '') is null then
    raise exception 'Manca la chiave del ponte.';
  end if;

  select * into v_riga from chiavi_ponte
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null
   for update;
  if not found then
    raise exception 'Questa chiave del ponte non vale.';
  end if;

  if v_riga.finestra_da is null or v_riga.finestra_da < now() - interval '1 minute' then
    update chiavi_ponte set finestra_da = now(), finestra_usi = 1, usi = usi + 1 where id = v_riga.id;
  elsif v_riga.finestra_usi >= 300 then
    raise exception 'Troppe chiamate del ponte nell''ultimo minuto: rallento.';
  else
    update chiavi_ponte set finestra_usi = finestra_usi + 1, usi = usi + 1 where id = v_riga.id;
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);
  return v_riga.id;
end $function$;

revoke all on function public.ponte_entra(text) from public, anon, authenticated;

-- «Ci sono»: il ponte lo dice ogni 30 secondi, e riceve gli apparecchi
-- attivi. Gli indirizzi si scrivono nel gestionale, mai sul mini-PC.
create or replace function public.ponte_battito(p_chiave text, p_versione text, p_host text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_elenco jsonb;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;

  update chiavi_ponte
     set ultimo_battito = now(),
         versione = left(p_versione, 40),
         host = left(p_host, 80)
   where id = v_chiave;

  -- La coda si tiene corta da se': i fogli usciti per un mese, quelli
  -- andati storti per tre (servono a capire un guasto che ritorna).
  delete from lavori_stampa
   where (stato in ('stampato', 'annullato') and finito_il < now() - interval '30 days')
      or (stato in ('fallito', 'incerto') and finito_il < now() - interval '90 days');

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'nome', d.nome, 'tipo', d.tipo, 'protocollo', d.protocollo,
           'indirizzo', host(d.indirizzo), 'porta', d.porta, 'reparto', d.reparto)
           order by d.nome), '[]'::jsonb)
    into v_elenco
    from dispositivi d where d.attivo;

  return jsonb_build_object('ora', now(), 'dispositivi', v_elenco);
end $function$;

-- Prendere i lavori in coda. `skip locked`: se un giorno i ponti fossero
-- due, lo stesso foglio non lo prenderebbero entrambi.
create or replace function public.ponte_prendi_lavori(p_chiave text, p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_presi  jsonb;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;

  -- rete-guardie: ponte_prendi_lavori — i lavori abbandonati diventano incerti in scadi_lavori_abbandonati(), chiamata qui, non più scritti dentro (revisione del database, 28/10)
  perform scadi_lavori_abbandonati();

  with presi as (
    select l.id from lavori_stampa l
      join dispositivi d on d.id = l.dispositivo_id and d.attivo
     where l.stato = 'in_coda'
     order by l.creato_il
     limit greatest(1, least(coalesce(p_limite, 5), 10))
     for update of l skip locked
  ), aggiornati as (
    update lavori_stampa l
       set stato = 'in_corso', preso_il = now(), preso_da = v_chiave, tentativi = l.tentativi + 1
      from presi where l.id = presi.id
    returning l.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'tipo', a.tipo, 'contenuto', a.contenuto,
           'dispositivo', jsonb_build_object(
             'id', d.id, 'nome', d.nome, 'tipo', d.tipo, 'protocollo', d.protocollo,
             'indirizzo', host(d.indirizzo), 'porta', d.porta))
           order by a.creato_il), '[]'::jsonb)
    into v_presi
    from aggiornati a join dispositivi d on d.id = a.dispositivo_id;

  return v_presi;
end $function$;

-- Com'e' andata. Lo stato dell'apparecchio si aggiorna insieme.
create or replace function public.ponte_esito_lavoro(
  p_chiave text, p_id uuid, p_stato text, p_errore_codice text,
  p_errore_testo text, p_stato_dispositivo text, p_esito jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_disp   uuid;
  -- ⚠️ Quello che arriva dal ponte si normalizza invece di rifiutarlo: un
  --    valore inatteso farebbe fallire tutta la chiamata, il lavoro
  --    resterebbe in corso e dopo cinque minuti diventerebbe incerto — un
  --    foglio uscito bene raccontato come un dubbio (revisione del
  --    database, 28/10).
  v_stato_disp text := case when p_stato_dispositivo in ('pronto', 'carta_finita', 'coperchio_aperto', 'non_risponde', 'errore')
                            then p_stato_dispositivo else 'sconosciuto' end;
  v_codice     text := case when p_errore_codice in ('carta_finita', 'coperchio_aperto', 'non_risponde', 'risposta_a_meta', 'rifiutato', 'interrotto')
                            then p_errore_codice else 'sconosciuto' end;
  v_testo      text := case when p_stato = 'stampato' then null else left(p_errore_testo, 500) end;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;
  if p_stato not in ('stampato', 'fallito', 'incerto') then
    raise exception 'L''esito di un lavoro è stampato, fallito o incerto.';
  end if;

  -- ⚠️ Anche un lavoro già fatto «incerto» perché il ponte ci ha messo
  --    troppo si può chiudere, se è lo stesso ponte a portarne l'esito:
  --    la risposta vera vale più del dubbio.
  update lavori_stampa
     set stato = p_stato, finito_il = now(),
         errore_codice = case when p_stato = 'stampato' then null else v_codice end,
         errore_testo = v_testo,
         esito = case when pg_column_size(p_esito) <= 4000 then p_esito end
   where id = p_id and preso_da = v_chiave
     and (stato = 'in_corso' or (stato = 'incerto' and errore_codice = 'interrotto'))
   returning dispositivo_id into v_disp;
  if v_disp is null then
    raise exception 'Questo lavoro non è in corso per questo ponte: forse è già stato chiuso.';
  end if;

  update dispositivi
     set ultimo_stato = v_stato_disp,
         ultimo_stato_testo = v_testo,
         -- «Non risponde» non e'' un contatto: l'ultima volta che ha
         -- parlato resta quella di prima.
         ultimo_contatto_il = case when v_stato_disp = 'non_risponde' then ultimo_contatto_il else now() end
   where id = v_disp;
end $function$;

comment on function public.ponte_battito(text, text, text) is
  'Il ponte del mini-PC dice «ci sono» e riceve gli apparecchi attivi con i loro indirizzi. Si entra con una chiave di chiavi_ponte; 300 chiamate al minuto per chiave.';
comment on function public.ponte_prendi_lavori(text, integer) is
  'Il ponte prende fino a 10 lavori in coda. Un lavoro preso e non chiuso da due minuti diventa incerto, e non torna in coda.';
comment on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) is
  'Il ponte scrive com''è andato un lavoro (stampato, fallito, incerto) e come sta l''apparecchio.';

revoke all on function public.ponte_battito(text, text, text) from public, anon, authenticated;
revoke all on function public.ponte_prendi_lavori(text, integer) from public, anon, authenticated;
revoke all on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ponte_battito(text, text, text) to anon, authenticated;
grant execute on function public.ponte_prendi_lavori(text, integer) to anon, authenticated;
grant execute on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_k        jsonb;
  v_disp     uuid;
  v_lavoro   uuid;
  v_r        jsonb;
  v_fermo    boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  -- Le porte: il ponte entra da anon con la chiave, il resto no.
  if not has_function_privilege('anon', 'ponte_battito(text, text, text)', 'execute')
     or not has_function_privilege('anon', 'ponte_prendi_lavori(text, integer)', 'execute')
     or not has_function_privilege('anon', 'ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb)', 'execute')
     or has_function_privilege('anon', 'ponte_entra(text)', 'execute')
     or has_function_privilege('authenticated', 'ponte_entra(text)', 'execute')
     or has_function_privilege('anon', 'crea_chiave_ponte(text)', 'execute')
     or has_function_privilege('anon', 'chiedi_lavoro_dispositivo(uuid, text)', 'execute')
     or has_table_privilege('anon', 'dispositivi', 'select')
     or has_table_privilege('anon', 'lavori_stampa', 'select')
     or has_table_privilege('authenticated', 'lavori_stampa', 'insert')
     or has_table_privilege('authenticated', 'lavori_stampa', 'update')
     or has_column_privilege('authenticated', 'dispositivi', 'ultimo_stato', 'update') then
    raise exception 'VERIFICA: i permessi delle stampanti e della coda non sono quelli dichiarati.';
  end if;

  begin
    -- (1) Lo staff non vede e non scrive gli apparecchi.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ staff', 'stampante_comande', 'escpos_tcp', '192.168.1.240', 9100, 'cucina');
    exception when others then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (1): lo staff ha scritto un apparecchio.';
    end if;
    reset role;

    -- (2) Il titolare scrive un apparecchio della rete del locale…
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
    values ('ZZ stampante di prova', 'stampante_comande', 'simulatore', '127.0.0.1', 19100, 'cucina')
    returning id into v_disp;

    -- (3) …ma non uno di internet, ne' una porta qualunque, ne' una
    --     stampante senza reparto.
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ fuori', 'stampante_comande', 'escpos_tcp', '8.8.8.8', 9100, 'bar');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3a): un indirizzo di internet è stato accettato.';
    end if;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ porta', 'stampante_comande', 'escpos_tcp', '192.168.1.241', 22, 'bar');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3b): una porta che non è di una stampante è stata accettata.';
    end if;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ locale finto', 'stampante_comande', 'escpos_tcp', '127.0.0.1', 9100, 'bar');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3c): un apparecchio vero su 127.0.0.1 è stato accettato.';
    end if;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta)
      values ('ZZ senza reparto', 'stampante_comande', 'escpos_tcp', '192.168.1.242', 9100);
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3d): una stampante senza reparto è stata accettata.';
    end if;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ finto fuori posto', 'stampante_comande', 'simulatore', '192.168.1.5', 18432, 'bar');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3e): un apparecchio finto fuori dal mini-PC è stato accettato.';
    end if;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ a tutti', 'stampante_comande', 'escpos_tcp', '192.168.1.255', 9100, 'bar');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3f): l''indirizzo «a tutti» della rete è stato accettato.';
    end if;
    v_fermo := false;
    begin
      insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
      values ('ZZ <comando>', 'stampante_comande', 'escpos_tcp', '192.168.1.243', 9100, 'bar');
    exception when check_violation then v_fermo := true;
    end;
    if not v_fermo then
      raise exception 'VERIFICA (3g): un nome con i segni dei comandi è stato accettato.';
    end if;

    -- (4) La prova si accoda una volta sola.
    v_lavoro := chiedi_lavoro_dispositivo(v_disp, 'prova');
    v_fermo := false;
    begin
      perform chiedi_lavoro_dispositivo(v_disp, 'prova');
    exception when others then v_fermo := sqlerrm like 'Per «%» c''è già una prova%';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (4): la seconda prova sullo stesso apparecchio si è accodata.';
    end if;

    -- (5) Il ponte: con la chiave vede l'apparecchio, prende il lavoro,
    --     scrive l'esito.
    v_k := crea_chiave_ponte('ZZ mini-PC');
    if exists (select 1 from chiavi_ponte where impronta = v_k->>'chiave') then
      raise exception 'VERIFICA (5a): la chiave del ponte è conservata in chiaro.';
    end if;
    perform set_config('request.jwt.claims', null, true);

    v_r := ponte_battito(v_k->>'chiave', 'verifica', 'ZZ');
    if not (v_r->'dispositivi' @> jsonb_build_array(jsonb_build_object('id', v_disp, 'indirizzo', '127.0.0.1'))) then
      raise exception 'VERIFICA (5b): il battito non ha restituito l''apparecchio: %.', v_r;
    end if;

    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or (v_r->0->>'id')::uuid <> v_lavoro
       or (select stato from lavori_stampa where id = v_lavoro) <> 'in_corso' then
      raise exception 'VERIFICA (5c): il ponte non ha preso la prova: %.', v_r;
    end if;
    if jsonb_array_length(ponte_prendi_lavori(v_k->>'chiave', 5)) <> 0 then
      raise exception 'VERIFICA (5d): lo stesso lavoro è stato preso due volte.';
    end if;

    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'stampato', null, null, 'pronto', '{"carta":"ok"}');
    if (select stato from lavori_stampa where id = v_lavoro) <> 'stampato'
       or (select ultimo_stato from dispositivi where id = v_disp) <> 'pronto' then
      raise exception 'VERIFICA (5e): l''esito del ponte non è stato scritto.';
    end if;

    -- (6) Un lavoro preso e abbandonato diventa incerto, non torna in coda.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_lavoro := chiedi_lavoro_dispositivo(v_disp, 'stato');
    update lavori_stampa set stato = 'in_corso', preso_il = now() - interval '10 minutes',
                             preso_da = (v_k->>'id')::uuid
     where id = v_lavoro;
    perform set_config('request.jwt.claims', null, true);
    perform ponte_prendi_lavori(v_k->>'chiave', 5);
    if (select stato from lavori_stampa where id = v_lavoro) <> 'incerto' then
      raise exception 'VERIFICA (6a): un lavoro abbandonato non è diventato incerto.';
    end if;

    -- (6b) …ma se l'esito arriva lo stesso, dallo stesso ponte, vale lui;
    --      e un valore che il ponte non dovrebbe mandare non lo fa fallire.
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro, 'fallito', 'qualcosa_di_nuovo',
                               'Carta storta', 'offline', '{}');
    if (select stato || '/' || errore_codice from lavori_stampa where id = v_lavoro) <> 'fallito/sconosciuto'
       or (select ultimo_stato from dispositivi where id = v_disp) <> 'sconosciuto' then
      raise exception 'VERIFICA (6b): l''esito arrivato in ritardo non ha corretto il lavoro incerto.';
    end if;

    -- (7) Chiave sbagliata e chiave revocata non entrano.
    v_fermo := false;
    begin
      perform ponte_battito('non-e-una-chiave', 'x', 'x');
    exception when others then v_fermo := sqlerrm = 'Questa chiave del ponte non vale.';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (7a): una chiave sbagliata è entrata.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    perform revoca_chiave_ponte((v_k->>'id')::uuid);
    perform set_config('request.jwt.claims', null, true);
    v_fermo := false;
    begin
      perform ponte_prendi_lavori(v_k->>'chiave', 5);
    exception when others then v_fermo := sqlerrm = 'Questa chiave del ponte non vale.';
    end;
    if not v_fermo then
      raise exception 'VERIFICA (7b): una chiave revocata entra ancora.';
    end if;

    -- (8) Ogni vincolo nuovo ha la sua frase in italiano.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if exists (select 1 from vincoli_senza_frase() v
                where v.tabella in ('dispositivi', 'chiavi_ponte', 'lavori_stampa')) then
      raise exception 'VERIFICA (8): un vincolo delle stampanti non ha la sua frase in italiano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle stampanti e della coda');

  raise notice 'Fatto: gli apparecchi li scrive solo il titolare e solo nella rete del locale; la prova si accoda una volta sola; il ponte con la sua chiave vede l''apparecchio, prende il lavoro una volta e ne scrive l''esito; un lavoro abbandonato diventa incerto; chiave sbagliata e revocata non entrano. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261028000005', 'le_stampanti_e_la_coda')
on conflict (version) do nothing;
