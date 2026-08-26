-- ============================================================================
-- IL FRENO STA ANCHE SULLA PORTA CHE SCRIVE — 26/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, MISURATO SUL GESTIONALE VERO PRIMA DI TOCCARE NIENTE.
--    Le funzioni del modulo voce raggiungibili SENZA login (`anon`) sono
--    due — `voce_apri_sessione` e `registra_dettatura_da_chiave` — e il
--    freno delle 60 dettature in un'ora vive **soltanto nella prima**,
--    cioe' in quella che NON scrive.
--
--    Chi ha la chiave puo' quindi chiamare `registra_dettatura_da_chiave`
--    dritta, in ciclo, senza nessun limite, passando `p_azioni` costruite
--    a mano: cioe' far eseguire qualunque azione di natura `misura` senza
--    che nessun modello sia mai stato consultato, e **senza lasciare
--    traccia sulla chiave**, perche' `ultimo_uso` e `usi` li scrive solo
--    l'altra porta.
--
--    ⚠️ E NON SERVE PASSARE DALLA FUNZIONE ONLINE: la chiave anonima del
--       progetto e' pubblica per costruzione (sta nel sito), quindi
--       PostgREST accetta la chiamata da chiunque. La funzione online
--       `ascolta-voce` chiama le due porte in fila e si comporta bene; il
--       punto e' che **non e' l'unica strada che porta li'**.
--
-- ----------------------------------------------------------------------------
-- LE QUATTRO COSE CHE QUESTA MIGRAZIONE DECIDE
-- ----------------------------------------------------------------------------
--
-- 1. 🔴 IL CRITERIO DEL LIMITE VIVE IN UNA FUNZIONE SOLA
--    (`voce_limite_dettature`), sul modello di `azione_si_esegue_da_se`:
--    le due porte non lo riscrivono, lo **domandano**. Se la soglia
--    comparisse in due corpi, fra sei mesi ne cambieremmo una sola — ed e'
--    esattamente com'e' nata questa falla, con un controllo scritto in un
--    posto e la porta vera in un altro.
--
-- 2. LA SOGLIA RESTA 60 IN UN'ORA (decisione di Alessio del 26/08,
--    confermata oggi). Sta scritta **una volta**, come costante dentro
--    quella funzione, e la funzione la **restituisce** insieme alla
--    risposta: chi guarda il risultato vede il numero senza dover leggere
--    il codice. ⚠️ Non e' finita in una tabella di impostazioni apposta:
--    non e' una decisione di gestione del locale come gli orari o i
--    coperti — e' un freno anti-abuso, e un freno che si alza da una
--    schermata e' un freno in meno.
--
-- 3. ANCHE LA FRASE DEL RIFIUTO ESCE DA LI'. Due porte che rifiutano con
--    due frasi diverse sono due porte che si distinguono da fuori.
--
-- 4. 🔴 `usi` SMETTE DI MENTIRE, E NON SDOPPIANDO IL SUO SIGNIFICATO.
--    Il commento in tabella diceva «quante dettature sono entrate con
--    questa chiave», e contava invece le **aperture di sessione**: un
--    contatore che dichiara una cosa e ne conta un'altra. Da qui:
--      · `usi`       = quante volte la chiave e' stata usata, da qualunque
--                      porta. Il commento e' corretto per dire il vero.
--      · `scritture` = colonna NUOVA: quante dettature sono entrate davvero.
--    ⚠️ Non si e' cambiato il senso di `usi` lasciando lo stesso nome: e'
--       il debito che questo progetto sta gia' pagando con «percento», e
--       non se ne apre un secondo.
--
-- ----------------------------------------------------------------------------
-- COSA ABBIAMO ROVESCIATO
-- ----------------------------------------------------------------------------
-- Nulla di deciso da Alessio. Si rovescia una scelta implicita di ieri —
-- «il freno sta sulla porta d'ingresso» — che era vera finche' si dava per
-- scontato che si entrasse da li'. La ragione di allora (una sola porta da
-- sorvegliare) non vale piu' perche' **le porte aperte ad `anon` sono due**,
-- e la seconda e' quella che scrive.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Il criterio, in un posto solo
-- ----------------------------------------------------------------------------
create or replace function voce_limite_dettature(p_utente uuid)
returns table(superato boolean, quante integer, tetto integer, frase text)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
declare
  -- 🔴 LA SOGLIA. Un posto solo, e si cambia qui.
  v_tetto constant integer := 60;
  v_n     integer;
begin
  select count(*) into v_n
    from dettature d
   where d.creato_da = p_utente
     and d.provenienza = 'scorciatoia'
     and d.creato_il > now() - interval '1 hour';

  return query select
    v_n >= v_tetto,
    v_n,
    v_tetto,
    'Sono gia'' arrivate ' || v_tetto ||
    ' dettature nell''ultima ora da questa strada: mi fermo. Se non sei stato tu, togli la chiave dal gestionale.';
end $funzione$;

comment on function voce_limite_dettature(uuid) is
  'Risponde a una domanda sola: questa chiave ha gia'' superato il limite di dettature nell''ultima ora? La soglia vive qui dentro e da nessun''altra parte, e viene restituita insieme alla risposta. La chiamano ENTRAMBE le porte aperte ad anon — quella che apre la sessione e quella che scrive — perche'' un criterio scritto in due corpi e'' un criterio che prima o poi cambia solo in uno.';

-- ⚠️ Nessuno la chiama da fuori: la usano due funzioni `security definer`
--    di proprieta' di postgres. Le funzioni nascono eseguibili da chiunque
--    abbia la chiave pubblica, quindi va tolto esplicitamente.
revoke all on function voce_limite_dettature(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. La chiave conta due cose diverse, e non nella stessa colonna
-- ----------------------------------------------------------------------------
-- ⚠️ LA COLONNA NASCE VUOTA PER CHI C'ERA GIA', e non e' un dettaglio: un
--    `default 0` riempirebbe le chiavi esistenti con «non ha mai scritto
--    niente», che e' una **risposta data al posto di chi non ha risposto**
--    (regola del 14/08). Vuoto vuol dire «non lo so», zero vuol dire «non
--    ancora». Le chiavi nuove nascono a zero, che li' e' vero.
--    Misurato prima di scrivere: `chiavi_voce` ha ZERO righe in produzione
--    e zero sul progetto di prova, quindi oggi la distinzione non cambia
--    nessun dato — ma la forma resta quella giusta per domani.
alter table chiavi_voce add column if not exists scritture integer;
alter table chiavi_voce alter column scritture set default 0;

comment on column chiavi_voce.usi is
  'Quante volte la chiave e'' stata usata, da qualunque porta: aprire una sessione e scrivere una dettatura contano tutte e due. ⚠️ Fino al 26/08 questo commento diceva «quante dettature sono entrate» e contava invece le sole aperture: il numero delle dettature e'' in `scritture`.';
comment on column chiavi_voce.scritture is
  'Quante dettature sono entrate DAVVERO con questa chiave. E'' la domanda che conta quando il numero cresce mentre Alessio non parla. Vuoto = chiave nata prima che questa colonna esistesse, e di lei non si sa.';

-- ----------------------------------------------------------------------------
-- 3. La porta che apre la sessione — corpo ripreso dal DATABASE VIVO
-- ----------------------------------------------------------------------------
-- 🔴 Preso con `pg_get_functiondef` dalla produzione, non dal file che
--    l'ha creata: fra i due ci stanno tutte le migrazioni che l'hanno
--    toccata. Cambia in un punto solo — il criterio si domanda invece di
--    riscriverlo. `scritture` qui NON si tocca: una sessione aperta non e'
--    una dettatura scritta, ed e' tutto il senso della colonna nuova.
--
-- rete-guardie: voce_apri_sessione — la soglia, la frase del rifiuto e la
--    parola «scorciatoia» escono da qui APPOSTA: non spariscono, si
--    spostano dentro `voce_limite_dettature`, che e' l'unico posto dove
--    ora vivono e che questa funzione chiama. La rete ha ragione a
--    segnalarlo — sta guardando esattamente la cosa giusta — e la
--    controprova che non e' una perdita e' nella verifica in fondo: il
--    rifiuto alla sessantunesima si prova, con la frase vera.
create or replace function voce_apri_sessione(p_chiave text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_riga   chiavi_voce%rowtype;
  v_lim    record;
  v_spesa  record;
  v_cat    jsonb;
begin
  if nullif(btrim(coalesce(p_chiave, '')), '') is null then
    raise exception 'Manca la chiave.';
  end if;

  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    -- ⚠️ Non si dice se la chiave non esiste o se e' stata revocata: sono
    --    due informazioni utili solo a chi sta provando a indovinarla.
    raise exception 'Questa chiave non vale.';
  end if;

  select * into v_lim from voce_limite_dettature(v_riga.utente_id);
  if v_lim.superato then
    raise exception '%', v_lim.frase;
  end if;

  update chiavi_voce set ultimo_uso = now(), usi = usi + 1 where id = v_riga.id;

  -- 🔴 DA QUI IN POI SI E' LUI. La chiave e' l'autenticazione, e i claims
  --    valgono per questa transazione soltanto (`true` = local).
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare: i comandi vocali sono solo suoi.';
  end if;

  select * into v_spesa from spesa_ai_del_mese();
  v_cat := voce_catalogo();

  return jsonb_build_object(
    'utente',   v_riga.utente_id,
    'chiave',   v_riga.nome,
    'catalogo', v_cat,
    'spesa',    to_jsonb(v_spesa));
end $funzione$;

-- ----------------------------------------------------------------------------
-- 4. La porta che SCRIVE — corpo ripreso dal DATABASE VIVO
-- ----------------------------------------------------------------------------
create or replace function registra_dettatura_da_chiave(
  p_chiave         text,
  p_testo          text,
  p_azioni         jsonb   default '[]'::jsonb,
  p_esito          text    default 'capita',
  p_modello        text    default null,
  p_token_domanda  integer default 0,
  p_token_risposta integer default 0,
  p_messaggio      text    default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $funzione$
declare
  v_riga chiavi_voce%rowtype;
  v_lim  record;
begin
  select * into v_riga from chiavi_voce
   where impronta = encode(extensions.digest(p_chiave, 'sha256'), 'hex') and revocata_il is null;
  if not found then
    -- ⚠️ Stessa identica frase dell'altra porta: due rifiuti diversi
    --    direbbero a chi prova che una delle due chiavi esiste.
    raise exception 'Questa chiave non vale.';
  end if;

  -- 🔴 IL FRENO CHE MANCAVA. Prima di scrivere, non dopo.
  select * into v_lim from voce_limite_dettature(v_riga.utente_id);
  if v_lim.superato then
    raise exception '%', v_lim.frase;
  end if;

  -- 🔴 LA TRACCIA CHE MANCAVA. Una dettatura entrata senza lasciare segno
  --    sulla chiave e' una dettatura che nessuno puo' contare quando il
  --    numero cresce e Alessio non ha parlato.
  update chiavi_voce
     set ultimo_uso = now(),
         usi        = usi + 1,
         scritture  = coalesce(scritture, 0) + 1
   where id = v_riga.id;

  -- 🔴 Da qui in poi si e' lui, per questa transazione soltanto: e' cio'
  --    che permette alle funzioni sottostanti di fare i loro controlli sul
  --    ruolo vero invece che su un anonimo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_riga.utente_id, 'role', 'authenticated')::text, true);

  if not is_titolare() then
    raise exception 'La chiave appartiene a un accesso che non e'' il titolare.';
  end if;

  return scrivi_dettatura(v_riga.utente_id, p_testo, 'scorciatoia', p_azioni, p_esito,
                          p_modello, p_token_domanda, p_token_risposta, p_messaggio);
end $funzione$;

-- ============================================================================
-- VERIFICA
-- ============================================================================
-- ⚠️ GLI IDENTIFICATIVI DI CIO' CHE CREO STANNO IN UN **ARRAY**, mai in una
--    variabile riusata: e' la lezione di stamattina, costata una riga di
--    prova rimasta in mezzo ai dati veri del gestionale.
-- ⚠️ E il controllo finale NON guarda le lapidi: `dettature` e
--    `chiavi_voce` non sono tabelle tracciate, quindi li' una lapide non
--    comparirebbe mai — ne' prima ne' dopo. Si contano le RIGHE.
--
-- rete-portieri: 20260826000007 chiama registra_dettatura_da_chiave
--    ⚠️ Si scrive col NUMERO DI VERSIONE e su UNA riga sola: scritta col
--    nome intero del file, o spezzata su due righe, tace la dichiarazione
--    e non la rete. Scoperto facendola fallire due volte, non rileggendola.
--    La ragione: la rete e' diventata rossa da
--    sola ed e' andata a guardare la cosa giusta: quella funzione contiene
--    `not is_titolare()`, e una migrazione non ha un utente. Qui pero' il
--    portiere non e' all'ingresso: **la funzione si autentica da se'**, con
--    la chiave, e imposta i claims prima di arrivarci. Impostarli da fuori
--    non renderebbe la prova piu' sicura — la renderebbe piu' debole, perche'
--    proverebbe la funzione in una condizione in cui non si trova mai: da
--    fuori ci arriva un anonimo con una chiave in mano, e questa verifica
--    deve esercitare esattamente quel caso.
do $verifica$
declare
  v_tit      uuid;
  v_chiave   text := 'verifica-' || gen_random_uuid()::text;
  v_chiave2  text := 'verifica-revocata-' || gen_random_uuid()::text;
  v_id       uuid;
  v_id2      uuid;
  v_miei     uuid[] := '{}';
  v_mie_ch   uuid[] := '{}';
  v_lim      record;
  v_i        integer;
  v_d        uuid;
  v_ris      jsonb;
  v_pre_d    integer;
  v_post_d   integer;
  v_pre_c    integer;
  v_post_c   integer;
  v_usi_pre  integer;
  v_usi_post integer;
  v_ul_pre   timestamptz;
  v_ul_post  timestamptz;
  v_scr_post integer;
  v_msg1     text;
  v_msg2     text;
begin
  select count(*) into v_pre_d from dettature;
  select count(*) into v_pre_c from chiavi_voce;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;

  -- Roba nostra: due chiavi create qui, e i loro identificativi in elenco.
  insert into chiavi_voce (nome, impronta, utente_id)
  values ('VERIFICA freno', encode(extensions.digest(v_chiave, 'sha256'), 'hex'), v_tit)
  returning id into v_id;
  v_mie_ch := v_mie_ch || v_id;

  insert into chiavi_voce (nome, impronta, utente_id, revocata_il)
  values ('VERIFICA revocata', encode(extensions.digest(v_chiave2, 'sha256'), 'hex'), v_tit, now())
  returning id into v_id2;
  v_mie_ch := v_mie_ch || v_id2;

  -- ------------------------------------------------------------------
  -- (A) LA COLONNA NUOVA NASCE A ZERO PER CHI NASCE ADESSO.
  -- ------------------------------------------------------------------
  if (select scritture from chiavi_voce where id = v_id) is distinct from 0 then
    raise exception 'Una chiave nuova dovrebbe nascere con zero scritture, e ha %',
      (select scritture from chiavi_voce where id = v_id);
  end if;

  -- ------------------------------------------------------------------
  -- (B) UNA SCRITTURA VERA LASCIA IL SEGNO SULLA CHIAVE.
  --     🔴 E' il controllo che vale di piu': prima di questa migrazione
  --     `registra_dettatura_da_chiave` non toccava ne' `ultimo_uso` ne'
  --     `usi`, quindi mille dettature entrate lasciavano la chiave
  --     identica a com'era.
  -- ------------------------------------------------------------------
  select usi, ultimo_uso into v_usi_pre, v_ul_pre from chiavi_voce where id = v_id;

  v_ris := registra_dettatura_da_chiave(v_chiave, 'verifica del freno', '[]'::jsonb, 'capita');
  v_miei := v_miei || (v_ris->>'dettatura_id')::uuid;

  select usi, ultimo_uso, scritture into v_usi_post, v_ul_post, v_scr_post
    from chiavi_voce where id = v_id;

  if v_usi_post is distinct from v_usi_pre + 1 then
    raise exception 'Dopo una scrittura «usi» doveva passare da % a %, e vale %',
      v_usi_pre, v_usi_pre + 1, v_usi_post;
  end if;
  if v_ul_pre is not null or v_ul_post is null then
    raise exception 'Dopo una scrittura «ultimo uso» doveva passare da vuoto a un istante: prima %, dopo %',
      v_ul_pre, v_ul_post;
  end if;
  if v_scr_post is distinct from 1 then
    raise exception 'Dopo una scrittura «scritture» doveva valere 1, e vale %', v_scr_post;
  end if;
  raise notice 'chiave dopo una scrittura: usi % -> %, ultimo_uso % -> %, scritture %',
    v_usi_pre, v_usi_post, coalesce(v_ul_pre::text, '(vuoto)'), v_ul_post, v_scr_post;

  -- ------------------------------------------------------------------
  -- (C) IL FRENO SI CHIUDE ALLA SESSANTUNESIMA, E NON PRIMA.
  --     La riga di (B) e' gia' una delle sessanta: si aggiunge quello che
  --     manca, non un numero scritto a mano.
  -- ------------------------------------------------------------------
  select * into v_lim from voce_limite_dettature(v_tit);
  if v_lim.superato then
    raise exception 'Il freno risulta gia'' chiuso con % dettature nell''ultima ora: questa verifica non puo'' girare su questo stato.',
      v_lim.quante;
  end if;

  for v_i in 1 .. (v_lim.tetto - v_lim.quante - 1) loop
    insert into dettature (testo, provenienza, esito, creato_da)
    values ('verifica del freno ' || v_i, 'scorciatoia', 'capita', v_tit)
    returning id into v_d;
    v_miei := v_miei || v_d;
  end loop;

  select * into v_lim from voce_limite_dettature(v_tit);
  if v_lim.superato then
    raise exception 'A % dettature su % il freno non doveva ancora chiudersi.', v_lim.quante, v_lim.tetto;
  end if;

  insert into dettature (testo, provenienza, esito, creato_da)
  values ('verifica del freno, quella che chiude', 'scorciatoia', 'capita', v_tit)
  returning id into v_d;
  v_miei := v_miei || v_d;

  select * into v_lim from voce_limite_dettature(v_tit);
  if not v_lim.superato then
    raise exception 'A % dettature su % il freno doveva essere chiuso.', v_lim.quante, v_lim.tetto;
  end if;

  -- 🔴 E la porta che SCRIVE deve rifiutare, non solo la funzione che conta.
  begin
    v_ris := registra_dettatura_da_chiave(v_chiave, 'questa non deve entrare', '[]'::jsonb, 'capita');
    v_miei := v_miei || (v_ris->>'dettatura_id')::uuid;
    raise exception 'La porta che scrive ha accettato la dettatura numero % con il tetto a %.',
      v_lim.quante + 1, v_lim.tetto;
  exception when others then
    if sqlerrm not like 'Sono gia%' then raise; end if;
    raise notice 'la % e'' stata rifiutata: %', v_lim.quante + 1, sqlerrm;
  end;

  -- ⚠️ Controprova che il rifiuto non ha lasciato niente dietro di se':
  --    se avesse scritto la dettatura e poi fosse fallito, il conteggio
  --    sarebbe piu' alto di quello che questa verifica si e' segnata.
  if (select count(*) from dettature) <> v_pre_d + array_length(v_miei, 1) then
    raise exception 'Dopo il rifiuto ci sono % dettature invece delle % che mi aspetto.',
      (select count(*) from dettature), v_pre_d + array_length(v_miei, 1);
  end if;

  -- ------------------------------------------------------------------
  -- (D) I DUE RIFIUTI SI DEVONO SOMIGLIARE.
  --     Chiave revocata e chiave inesistente: da fuori non si distinguono.
  -- ------------------------------------------------------------------
  begin
    v_ris := registra_dettatura_da_chiave(v_chiave2, 'chiave revocata', '[]'::jsonb, 'capita');
    raise exception 'Una chiave revocata e'' stata accettata.';
  exception when others then
    if sqlerrm like 'Una chiave revocata%' then raise; end if;
    v_msg1 := sqlerrm;
  end;

  begin
    v_ris := registra_dettatura_da_chiave('chiave-che-non-esiste-' || gen_random_uuid()::text,
                                          'chiave inventata', '[]'::jsonb, 'capita');
    raise exception 'Una chiave inesistente e'' stata accettata.';
  exception when others then
    if sqlerrm like 'Una chiave inesistente%' then raise; end if;
    v_msg2 := sqlerrm;
  end;

  if v_msg1 is distinct from v_msg2 then
    raise exception 'I due rifiuti si distinguono: revocata dice «%», inesistente dice «%»', v_msg1, v_msg2;
  end if;
  raise notice 'revocata e inesistente dicono la stessa cosa: «%»', v_msg1;

  -- ------------------------------------------------------------------
  -- PULIZIA — solo per identificativo, e gli identificativi sono in elenco.
  -- ------------------------------------------------------------------
  delete from dettature   where id = any(v_miei);
  delete from chiavi_voce where id = any(v_mie_ch);

  select count(*) into v_post_d from dettature;
  select count(*) into v_post_c from chiavi_voce;
  if v_post_d <> v_pre_d then
    raise exception 'Residuo in dettature: erano %, sono %.', v_pre_d, v_post_d;
  end if;
  if v_post_c <> v_pre_c then
    raise exception 'Residuo in chiavi_voce: erano %, sono %.', v_pre_c, v_post_c;
  end if;

  raise notice 'freno: create % dettature e % chiavi, tolte tutte. dettature % -> %, chiavi % -> %',
    array_length(v_miei, 1), array_length(v_mie_ch, 1), v_pre_d, v_post_d, v_pre_c, v_post_c;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000007', 'il_freno_sta_anche_sulla_porta_che_scrive') on conflict (version) do nothing;
