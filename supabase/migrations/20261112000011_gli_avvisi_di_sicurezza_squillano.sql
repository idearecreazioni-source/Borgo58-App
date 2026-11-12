-- =====================================================================
-- GLI AVVISI DI SICUREZZA SI ARCHIVIANO E SQUILLANO — 12/11/2026
-- =====================================================================
--
-- PR «P1» del piano «avvisi banca e posta» del 12/11, approvato da Alessio
-- con tutte le scelte consigliate (domande 1, 2 e 4).
--
-- Il 12/11 in «Da decidere» c'erano due «Codice Mr. Pin inserito errato»
-- di Credem e un «Hai disattivato la verifica in 2 passaggi» di Aruba.
-- La richiesta di Alessio: gli avvisi di sicurezza work li archivia da
-- solo E manda UNA riga su Telegram. **Mai archiviarli in silenzio.**
--
--   · `posta_filtri.esito`: una regola del filtro mette da parte la mail
--     in silenzio («silenzio», com'è stato finora) oppure la mette da
--     parte e avvisa («avvisa»).
--   · il controllo PRIMA DI SALVARE (`posta_filtra_in_arrivo`, rifatta qui
--     dal corpo della 20261112000008, niente tolto) scrive una nota
--     diversa per le regole che avvisano: «Avviso di sicurezza: …». La
--     Posta la riconosce e mette il bollino «Sicurezza».
--   · un trigger DOPO il salvataggio (`posta_avvisa_sicurezza`) manda la
--     riga su Telegram con `segnala_allarme`, categoria «sicurezza», un
--     tipo per ogni mail («posta_sicurezza:<id>»).
--     🔴 Trappola 1 del piano: un trigger BEFORE scatta anche sulla mail
--        doppia che `on conflict (messaggio_id) do nothing` poi scarta, e
--        Resend riconsegna le mail. Il trigger AFTER scatta solo sulle
--        righe entrate davvero: la riconsegna non suona due volte.
--   · IL TETTO (domanda 2): al massimo 5 righe nell'ultima ora. Dalla
--     sesta, la mail non suona da sola: si registra fra gli allarmi come
--     «trattenuta» (senza invio) e parte UNA riga «altri N avvisi di
--     sicurezza, guardali in Posta», frenata a una all'ora. Le trattenute
--     dopo quella riga le copre la riga stessa («per un'ora i prossimi li
--     trovi solo in Posta»), e il loro numero lo dice la prima riga
--     singola che parte quando la raffica è finita. Nessun avviso resta
--     senza una riga che lo nomini o lo conti.
--   · `aggiungi_filtro_posta` ha un terzo parametro, `p_esito`: è la terza
--     scelta «Archivia e avvisami su Telegram» del riquadro «Ignora».
--     ⚠️ La firma cambia: la vecchia (uuid, boolean) si toglie e la nuova
--        (uuid, boolean, text default 'silenzio') la sostituisce. Tenerle
--        tutte e due renderebbe ambigua la chiamata con due parametri.
--        Una pagina vecchia che chiama con due parametri per nome continua
--        a funzionare; la pagina nuova manda `p_esito` solo per «avvisa».
--   · le regole di partenza (domanda 1): Mr. Pin di Credem e verifica
--     disattivata di Aruba, tutte e due «avvisa». Le tre regole Credem
--     degli accessi dell'11/11 restano in silenzio.
--
-- ⚠️ LA PEC DELLO SDI E IL GESTORE PEC: nessuna regola li prende (vincolo
--    `posta_filtri_mai_la_pec` e `posta_regola_per`), e il trigger lo
--    ricontrolla lo stesso prima di suonare.
--
-- ⚠️ LA VERIFICA NON MANDA NIENTE SU TELEGRAM. Che l'accodamento di pg_net
--    si annulli con la transazione non l'ha misurato nessuno (vedi la
--    20260917000001). Dentro la verifica si accende
--    `borgo58.allarmi_solo_registrati` (solo per la transazione): la riga
--    si scrive in `allarmi` come la scriverebbe `segnala_allarme`, ma non
--    parte. Il resto del percorso è quello vero. L'interruttore conta SOLO
--    per chi applica le migrazioni (postgres): il sito e la chiave di
--    servizio entrano come «authenticator» e non possono zittire niente.
--    Se la migrazione girasse come un altro utente, la verifica si ferma.
--
-- ⚠️ UN INVIO CHE FALLISCE (Vault, pg_net) NON FA PERDERE LA MAIL: l'invio
--    sta in un blocco che lo prende e lo scrive come avvertimento; la mail
--    entra lo stesso, archiviata col suo bollino.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

-- ---------------------------------------------------------------------------
-- 1. LA REGOLA SA SE DEVE AVVISARE
-- ---------------------------------------------------------------------------
alter table posta_filtri
  add column if not exists esito text not null default 'silenzio';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posta_filtri_esito_check'
                   and conrelid = 'public.posta_filtri'::regclass) then
    alter table posta_filtri add constraint posta_filtri_esito_check
      check (esito in ('silenzio', 'avvisa'));
  end if;
end $$;

comment on column posta_filtri.esito is
  'Cosa fa la regola con la mail che prende (12/11/2026): silenzio = la mette da parte e basta; avvisa = la mette da parte e manda una riga su Telegram (gli avvisi di sicurezza).';
comment on constraint posta_filtri_esito_check on posta_filtri is
  'Una regola della Posta mette da parte la mail in silenzio oppure la mette da parte e avvisa su Telegram: nessun altro modo.';

-- ---------------------------------------------------------------------------
-- 2. IL NOME DI CHI MANDA, PER LA RIGA SU TELEGRAM
-- ---------------------------------------------------------------------------
create or replace function posta_nome_mittente(p_mittente text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  -- «Credem <businesson@credem.it>» → «Credem»; senza nome, l'indirizzo.
  select coalesce(
           nullif(btrim(btrim(substring(coalesce(p_mittente, '') from '^([^<]*)<')), ' "'''), ''),
           posta_indirizzo(p_mittente));
$$;
comment on function posta_nome_mittente(text) is
  'Il nome di chi manda una mail, come lo scrive la sua intestazione («Credem»), oppure l''indirizzo se il nome non c''è (12/11/2026). Per la riga su Telegram degli avvisi di sicurezza.';
revoke all on function posta_nome_mittente(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. IL CONTROLLO PRIMA DI SALVARE: LA NOTA DICE «AVVISO DI SICUREZZA»
-- ---------------------------------------------------------------------------
-- Il corpo è quello della 20261112000008 (il ramo della banca prima delle
-- regole), con una sola differenza: la nota della mail presa da una regola
-- che avvisa. La Posta la riconosce dall'inizio della nota, che resta
-- anche se la regola si toglie.
create or replace function posta_filtra_in_arrivo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_regola uuid;
  v_f      posta_filtri%rowtype;
begin
  if new.stato is distinct from 'da_leggere' then
    return new;
  end if;

  -- 12/11/2026: la casella degli avvisi della banca, PRIMA delle regole.
  -- Un avviso preso anche da una regola direbbe la regola sbagliata, e
  -- togliendo la regola tornerebbe a passare da MEMO.
  if posta_e_avviso_banca(new.casella, new.mittente, new.mittente_busta) then
    new.stato := 'scartata';
    new.lettura_note := 'Avviso della banca: va in Banca, non in MEMO. Senza spesa; la copia è fra gli avvisi della banca.';
    return new;
  end if;

  v_regola := posta_regola_per(new.mittente, new.oggetto);
  if v_regola is null then
    return new;
  end if;
  select * into v_f from posta_filtri where id = v_regola;
  new.stato := 'scartata';
  new.filtrata_da := v_regola;
  -- 12/11/2026: la regola che avvisa lo dice nella nota. La riga su
  -- Telegram la manda il trigger DOPO il salvataggio (trappola 1).
  if v_f.esito = 'avvisa' then
    -- ⚠️ Non «una riga sua»: oltre il tetto la conta la riga «altri N
    --    avvisi» (revisione ecc:database-reviewer, 12/11).
    new.lettura_note := 'Avviso di sicurezza: archiviato prima di MEMO, senza spesa, e segnalato su Telegram (con una riga sua, o contato nella riga «altri N avvisi di sicurezza»). Regola: '
      || posta_regola_in_italiano(v_f) || '.';
  else
    new.lettura_note := 'Filtrata prima di MEMO, senza spesa: ' || posta_regola_in_italiano(v_f) || '.';
  end if;
  return new;
end $$;
revoke all on function posta_filtra_in_arrivo() from public, anon, authenticated;
-- Il trigger BEFORE resta quello della 20261111000001: cambia solo la funzione.

-- ---------------------------------------------------------------------------
-- 4. LA RIGA SU TELEGRAM, E IL TETTO DI 5 ALL'ORA
-- ---------------------------------------------------------------------------
-- Chi manda davvero. Nella verifica di questa migrazione (e solo lì) la
-- riga si registra senza partire: vedi la testata.
create or replace function posta_suona_sicurezza(p_tipo text, p_messaggio text, p_dettagli jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- 🔴 Solo per chi applica le migrazioni (revisione ecc:database-reviewer,
  --    12/11): una sessione del sito o della chiave di servizio entra come
  --    «authenticator», e con lei l'interruttore non conta — nessuno può
  --    zittire gli avvisi impostandolo.
  if coalesce(current_setting('borgo58.allarmi_solo_registrati', true), '') = 'si'
     and session_user in ('postgres', 'supabase_admin') then
    insert into allarmi (tipo, messaggio, dettagli, notificato)
    values (p_tipo, p_messaggio, p_dettagli, false);
    return;
  end if;
  perform segnala_allarme(p_tipo, p_messaggio, p_dettagli, 'sicurezza');
end $$;
comment on function posta_suona_sicurezza(text, text, jsonb) is
  'Manda su Telegram una riga degli avvisi di sicurezza della Posta, con segnala_allarme e la categoria «sicurezza» (12/11/2026). Con borgo58.allarmi_solo_registrati = si (solo la verifica della migrazione) la registra in allarmi senza mandarla. La chiama solo il trigger della Posta.';
revoke all on function posta_suona_sicurezza(text, text, jsonb) from public, anon, authenticated, service_role;

-- «un altro avviso di sicurezza» / «altri 3 avvisi di sicurezza».
create or replace function posta_altri_avvisi(p_n integer)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case when p_n = 1 then 'un altro avviso di sicurezza'
              else 'altri ' || p_n || ' avvisi di sicurezza' end;
$$;
revoke all on function posta_altri_avvisi(integer) from public, anon, authenticated, service_role;

create or replace function posta_avvisa_sicurezza()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  -- Domanda 2 del piano: al massimo cinque righe singole nell'ultima ora.
  c_tetto     constant integer := 5;
  v_f         posta_filtri%rowtype;
  v_chi       text;
  v_oggetto   text;
  v_testo     text;
  v_dettagli  jsonb;
  v_singole   integer;
  v_trattenute integer;
begin
  -- 🔴 AFTER INSERT apposta (trappola 1): la consegna doppia scartata da
  --    `on conflict do nothing` non arriva fin qui.
  if new.filtrata_da is null or new.stato is distinct from 'scartata' then
    return null;
  end if;
  select * into v_f from posta_filtri where id = new.filtrata_da;
  if not found or v_f.esito is distinct from 'avvisa' then
    return null;
  end if;
  -- ⚠️ La PEC dello SdI e il gestore PEC non suonano mai (nessuna regola
  --    li prende già: qui è la seconda cintura).
  if coalesce(posta_protetta(posta_indirizzo(new.mittente)), false)
     or coalesce(posta_protetta(posta_indirizzo(new.mittente_busta)), false)
     or coalesce(lower(new.mittente), '') like '%fatturapa.it%'
     or coalesce(lower(new.mittente_busta), '') like '%fatturapa.it%'
     or coalesce(lower(new.mittente), '') like '%posta-certificata@%'
     or coalesce(lower(new.mittente_busta), '') like '%posta-certificata@%' then
    return null;
  end if;

  -- La riga: la nota della regola + l'oggetto tagliato a 80 caratteri.
  -- Una nota scritta dal tasto della Posta («Dalla Posta: «…»») non è un
  -- nome: al suo posto si mette chi l'ha mandata.
  v_chi := case
    when nullif(btrim(v_f.nota), '') is null or v_f.nota like 'Dalla Posta:%'
      then posta_nome_mittente(new.mittente)
    else btrim(v_f.nota)
  end;
  v_chi := left(coalesce(v_chi, v_f.mittente), 60);
  v_oggetto := nullif(btrim(regexp_replace(coalesce(new.oggetto, ''), '\s+', ' ', 'g')), '');
  v_oggetto := case
    when v_oggetto is null then 'mail senza oggetto'
    when char_length(v_oggetto) > 80 then rtrim(left(v_oggetto, 79)) || '…'
    else rtrim(v_oggetto, ' .')
  end;
  v_testo := v_chi || ': ' || v_oggetto || '. La mail è in Posta → Sistemate.';
  v_dettagli := jsonb_build_object('posta_id', new.id, 'filtro_id', v_f.id);

  -- Due avvisi che arrivano insieme non devono contare tutti e due «4».
  -- ⚠️ `starts_with` non usa l'indice (tipo, creato_il): `allarmi` è
  --    piccola (un guasto all'ora per tipo). Se crescesse, un indice parziale.
  perform pg_advisory_xact_lock(hashtext('borgo58'), hashtext('posta_avvisa_sicurezza'));

  select count(*) into v_singole
    from allarmi
   where starts_with(tipo, 'posta_sicurezza:')
     and creato_il > now() - interval '1 hour';

  if v_singole < c_tetto then
    -- Le trattenute dell'ultima raffica che nessuna riga ha ancora contato:
    -- le dice questa, così non restano mute.
    -- Solo quelle delle ultime 24 ore: più vecchie, «la raffica di prima»
    -- non vorrebbe più dire niente (sono comunque in Posta).
    select count(*) into v_trattenute
      from allarmi
     where starts_with(tipo, 'posta_sicurezza_trattenuta:') and not notificato
       and creato_il > now() - interval '24 hours';
    if v_trattenute > 0 then
      v_testo := v_testo || ' Durante la raffica di prima, ' || posta_altri_avvisi(v_trattenute)
        || ' senza riga qui: guarda in Posta → Sistemate.';
    end if;
    -- 🔴 Un invio che fallisce (Vault, pg_net) NON deve far fallire il
    --    salvataggio della mail: Resend riproverebbe, e la mail di
    --    sicurezza non entrerebbe mai (revisione ecc:database-reviewer, 12/11).
    begin
      perform posta_suona_sicurezza('posta_sicurezza:' || new.id, v_testo, v_dettagli);
      update allarmi set notificato = true
       where starts_with(tipo, 'posta_sicurezza_trattenuta:') and not notificato
         and creato_il > now() - interval '24 hours';
    exception when others then
      raise warning 'Avviso di sicurezza non mandato su Telegram (la mail è salvata): %', sqlerrm;
    end;
    return null;
  end if;

  -- Oltre il tetto: la mail si registra, senza invio, e la conta la riga
  -- della raffica — una sola all'ora (il freno di sempre, `allarme_frenato`).
  insert into allarmi (tipo, messaggio, dettagli, notificato)
  values ('posta_sicurezza_trattenuta:' || new.id, v_testo, v_dettagli, false);
  if allarme_frenato('posta_sicurezza_raffica') then
    -- La riga della raffica è già uscita nell'ultima ora e ha detto «per
    -- un'ora i prossimi li trovi solo in Posta»: questa la copre lei.
    return null;
  end if;
  select count(*) into v_trattenute
    from allarmi
   where starts_with(tipo, 'posta_sicurezza_trattenuta:') and not notificato
     and creato_il > now() - interval '24 hours';
  begin
    perform posta_suona_sicurezza(
      'posta_sicurezza_raffica',
      case when v_trattenute = 1 then 'Un altro avviso di sicurezza, guardalo in Posta → Sistemate.'
           else 'Altri ' || v_trattenute || ' avvisi di sicurezza, guardali in Posta → Sistemate.' end
        || ' Sono più di ' || c_tetto || ' in un''ora: per un''ora i prossimi li trovi solo lì.',
      jsonb_build_object('trattenute', v_trattenute, 'ultima_posta_id', new.id));
    update allarmi set notificato = true
     where starts_with(tipo, 'posta_sicurezza_trattenuta:') and not notificato
       and creato_il > now() - interval '24 hours';
  exception when others then
    -- Come sopra: la mail entra lo stesso; le trattenute restano da contare.
    raise warning 'Riga della raffica di sicurezza non mandata su Telegram (la mail è salvata): %', sqlerrm;
  end;
  return null;
end $$;
comment on function posta_avvisa_sicurezza() is
  'Trigger AFTER INSERT su posta_ricevuta (12/11/2026): la mail presa da una regola che avvisa manda una riga su Telegram (categoria «sicurezza», un tipo per mail). Al massimo 5 righe singole all''ora; oltre, una riga sola «altri N avvisi di sicurezza, guardali in Posta» all''ora, e il numero delle trattenute dopo quella lo dice la prima riga singola successiva. Le consegne doppie scartate non suonano.';
revoke all on function posta_avvisa_sicurezza() from public, anon, authenticated, service_role;

drop trigger if exists trg_posta_avvisa_sicurezza on posta_ricevuta;
create trigger trg_posta_avvisa_sicurezza after insert on posta_ricevuta
  for each row execute function posta_avvisa_sicurezza();

-- ---------------------------------------------------------------------------
-- 5. IL TASTO: LA TERZA SCELTA «ARCHIVIA E AVVISAMI SU TELEGRAM»
-- ---------------------------------------------------------------------------
-- Il corpo è quello della 20261111000001, con `p_esito` in più. Nessun
-- rifiuto, portiere o parola di prima è tolto.
drop function if exists aggiungi_filtro_posta(uuid, boolean);

create or replace function aggiungi_filtro_posta(
  p_posta_id       uuid,
  p_tutto_mittente boolean default false,
  p_esito          text default 'silenzio'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_m     posta_ricevuta%rowtype;
  v_ind   text;
  v_tipo  text;
  v_id    uuid;
  v_esito text;
  v_nota  text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare decide quali mail ignorare.';
  end if;
  if p_esito is null or p_esito not in ('silenzio', 'avvisa') then
    raise exception 'Una regola della Posta mette da parte in silenzio oppure avvisa su Telegram: «%» non è una delle due.', p_esito;
  end if;
  select * into v_m from posta_ricevuta where id = p_posta_id for update;
  if not found then
    raise exception 'Questa mail non c''è più.';
  end if;
  v_ind := posta_indirizzo(v_m.mittente);
  if v_ind is null or v_ind not like '%@%' then
    raise exception 'Non riesco a leggere l''indirizzo del mittente: questa mail non si può filtrare.';
  end if;
  if posta_protetta(v_ind) then
    raise exception 'Le mail dello SdI e della PEC non si filtrano: ci arrivano le fatture.';
  end if;
  -- Tutte le mail di un mittente che suonano su Telegram consumerebbero il
  -- tetto con le newsletter (revisione ecc:database-reviewer, 12/11).
  if p_esito = 'avvisa' and coalesce(p_tutto_mittente, false) then
    raise exception 'L''avviso su Telegram si mette su un tipo di mail, non su tutte le mail di un mittente.';
  end if;
  if coalesce(p_tutto_mittente, false) then
    v_tipo := null;
  else
    v_tipo := posta_tipo_oggetto(v_m.oggetto);
    if v_tipo is null or length(v_tipo) < 3 then
      raise exception 'Questa mail non ha un oggetto da riconoscere: si può ignorare solo tutto il mittente.';
    end if;
  end if;

  -- La nota: per una regola che avvisa è il nome di chi manda, perché è
  -- la prima parola della riga su Telegram («Credem: …»).
  v_nota := case when p_esito = 'avvisa'
                 then left(coalesce(posta_nome_mittente(v_m.mittente), v_ind), 60)
                 else 'Dalla Posta: «' || left(coalesce(v_m.oggetto, ''), 120) || '»' end;

  -- Il tasto fa sempre una regola «uguale»: l'oggetto intero ripulito, non
  -- una sua parte (revisione ECC dell'11/11). Due tocchi insieme non rompono
  -- l'indice: il secondo trova la regola del primo.
  insert into posta_filtri (mittente, oggetto_tipo, modo, nota, esito)
  values (v_ind, v_tipo, 'uguale', v_nota, p_esito)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from posta_filtri
     where mittente = v_ind and coalesce(oggetto_tipo, '') = coalesce(v_tipo, '');
    -- La regola c'era già. «Avvisa» la fa avvisare; «silenzio» non zittisce
    -- mai una regola che avvisa: per quello si toglie la regola, apposta.
    if p_esito = 'avvisa' then
      update posta_filtri set esito = 'avvisa', nota = v_nota
       where id = v_id and esito <> 'avvisa';
    end if;
  end if;
  select esito into v_esito from posta_filtri where id = v_id;

  -- Questa mail va subito con le filtrate (se era ancora aperta), con la
  -- nota che lo dice; le sue proposte ancora aperte si chiudono come «no».
  -- ⚠️ Questa non suona: è un aggiornamento, non una mail che arriva, e
  --    Alessio l'ha appena vista. Suoneranno le prossime.
  update posta_ricevuta r
     set stato = 'scartata', filtrata_da = v_id,
         lettura_note = case
           when v_esito = 'avvisa' then
             'Avviso di sicurezza: archiviato prima di MEMO, senza spesa; le prossime come questa arrivano anche su Telegram ('
             || (select posta_regola_in_italiano(f) from posta_filtri f where f.id = v_id) || ').'
           else 'Filtrata prima di MEMO, senza spesa: '
             || (select posta_regola_in_italiano(f) from posta_filtri f where f.id = v_id) || '.'
         end
   where r.id = p_posta_id and r.stato in ('da_leggere', 'proposta');
  update posta_azioni set stato = 'rifiutata', decisa_il = now()
   where posta_id = p_posta_id and stato = 'proposta';

  return jsonb_build_object('filtro_id', v_id, 'mittente', v_ind, 'oggetto_tipo', v_tipo, 'esito', v_esito);
end $$;

comment on function aggiungi_filtro_posta(uuid, boolean, text) is
  'Il tasto «Ignora le mail come questa» della Posta (11/11/2026): una regola mittente + tipo di oggetto, oppure tutto il mittente se scelto apposta; mai la PEC dello SdI. Con p_esito = avvisa (12/11/2026) la regola manda anche una riga su Telegram per ogni mail che prende («Archivia e avvisami su Telegram»); «silenzio» non zittisce una regola che avvisa già. Mette da parte anche questa mail, senza suonare. Due tabelle: dal corridoio.';
revoke all on function aggiungi_filtro_posta(uuid, boolean, text) from public, anon, authenticated;
grant execute on function aggiungi_filtro_posta(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. LE REGOLE DI PARTENZA (domanda 1: gli accessi Credem restano muti)
-- ---------------------------------------------------------------------------
-- 🔴 Se Alessio il 12/11 ha già premuto «Ignora» su una di queste mail, la
--    regola c'è e tace: qui diventa «avvisa». Mai archiviarli in silenzio.
-- ⚠️ Una volta sola: rilanciata dopo, la migrazione non ricrea una regola
--    che Alessio ha tolto apposta, e non tocca una regola che avvisa già
--    (revisione ecc:database-reviewer, 12/11).
insert into posta_filtri (mittente, oggetto_tipo, modo, nota, esito)
select v.mittente, v.oggetto_tipo, v.modo, v.nota, 'avvisa'
  from (values
    ('businesson@credem.it', 'codice mr. pin inserito errato', 'inizia', 'Credem'),
    ('noreply@fatturazioneelettronica.aruba.it', 'hai disattivato la verifica in # passaggi', 'contiene', 'Aruba')
  ) as v(mittente, oggetto_tipo, modo, nota)
 where not exists (select 1 from applied_migrations where version = '20261112000011')
on conflict (mittente, coalesce(oggetto_tipo, '')) do update
  set esito = 'avvisa', modo = excluded.modo, nota = excluded.nota
  where posta_filtri.esito is distinct from 'avvisa';

-- ---------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_id       uuid;
  v_id2      uuid;
  v_r        jsonb;
  v_stato    text;
  v_note     text;
  v_filtro   uuid;
  v_n        integer;
  v_msg      text;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff.';
  end if;

  -- Le porte.
  if has_function_privilege('authenticated', 'posta_avvisa_sicurezza()', 'execute')
     or has_function_privilege('authenticated', 'posta_suona_sicurezza(text, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'posta_nome_mittente(text)', 'execute')
     or has_function_privilege('authenticated', 'posta_altri_avvisi(integer)', 'execute')
     or has_function_privilege('service_role', 'posta_suona_sicurezza(text, text, jsonb)', 'execute')
     or has_function_privilege('service_role', 'posta_avvisa_sicurezza()', 'execute')
     or has_function_privilege('anon', 'aggiungi_filtro_posta(uuid, boolean, text)', 'execute')
     or not has_function_privilege('authenticated', 'aggiungi_filtro_posta(uuid, boolean, text)', 'execute') then
    raise exception 'VERIFICA: una porta degli avvisi di sicurezza è aperta a chi non deve, o chiusa al titolare.';
  end if;
  if to_regprocedure('aggiungi_filtro_posta(uuid, boolean)') is not null then
    raise exception 'VERIFICA: la firma vecchia di aggiungi_filtro_posta c''è ancora: la chiamata con due parametri sarebbe ambigua.';
  end if;
  -- 🔴 L'interruttore della verifica conta solo per chi applica le
  --    migrazioni: se qui non vale, le prove sotto manderebbero righe vere
  --    su Telegram. Meglio fermarsi.
  if session_user not in ('postgres', 'supabase_admin') then
    raise exception 'VERIFICA: la migrazione gira come «%»: la verifica manderebbe righe vere su Telegram. Applicala come postgres.', session_user;
  end if;
  if pg_get_functiondef('posta_avvisa_sicurezza()'::regprocedure) not like '%exception when others then%' then
    raise exception 'VERIFICA: un invio che fallisce farebbe perdere la mail di sicurezza.';
  end if;
  -- Senza l'interruttore della verifica la riga parte davvero.
  if pg_get_functiondef('posta_suona_sicurezza(text, text, jsonb)'::regprocedure) not like '%segnala_allarme(%''sicurezza'')%' then
    raise exception 'VERIFICA: posta_suona_sicurezza non chiama segnala_allarme con la categoria «sicurezza».';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_posta_avvisa_sicurezza'
                    and tgrelid = 'public.posta_ricevuta'::regclass
                    and (tgtype & 1) = 1           -- per riga
                    and (tgtype & 2) = 0           -- AFTER, non BEFORE
                    and (tgtype & 4) = 4) then     -- su INSERT
    raise exception 'VERIFICA: il trigger degli avvisi di sicurezza non è AFTER INSERT per riga (trappola 1).';
  end if;

  -- Le regole di partenza: le due nuove avvisano, gli accessi Credem no.
  if (select count(*) from posta_filtri
       where esito = 'avvisa'
         and ((mittente = 'businesson@credem.it' and oggetto_tipo = 'codice mr. pin inserito errato')
           or (mittente = 'noreply@fatturazioneelettronica.aruba.it' and oggetto_tipo = 'hai disattivato la verifica in # passaggi'))) <> 2 then
    raise exception 'VERIFICA: le due regole di sicurezza di partenza non ci sono, o non avvisano.';
  end if;
  if exists (select 1 from posta_filtri
              where mittente = 'businesson@credem.it' and esito = 'avvisa'
                and oggetto_tipo in ('notifica accesso business on', 'notifica accesso mobile banking', 'mybox: nuovi documenti disponibili')) then
    raise exception 'VERIFICA: una regola Credem degli accessi avvisa (domanda 1: restano in silenzio).';
  end if;
  if posta_nome_mittente('Credem <businesson@credem.it>') <> 'Credem'
     or posta_nome_mittente('"Aruba" <noreply@fatturazioneelettronica.aruba.it>') <> 'Aruba'
     or posta_nome_mittente('info@esempio.it') <> 'info@esempio.it' then
    raise exception 'VERIFICA: il nome del mittente non si legge.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    -- Niente parte davvero, e le righe di sicurezza già vive non contano
    -- nel tetto: si spostano indietro di due ore (si annulla con il resto).
    perform set_config('borgo58.allarmi_solo_registrati', 'si', true);
    -- Le mail di sicurezza vere che arrivano adesso aspettano la fine della
    -- verifica: i conti del tetto restano quelli delle prove.
    perform pg_advisory_xact_lock(hashtext('borgo58'), hashtext('posta_avvisa_sicurezza'));
    update allarmi set creato_il = creato_il - interval '2 hours', notificato = true
     where starts_with(tipo, 'posta_sicurezza');

    -- 1. Come la chiave di servizio (la strada vera di posta-in-arrivo): il
    --    Mr. Pin nasce scartato con la nota della sicurezza e fa UNA riga.
    set local role service_role;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-1', 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'Codice Mr. Pin inserito errato', 'da_leggere')
    on conflict (messaggio_id) do nothing
    returning id, stato, filtrata_da, lettura_note into v_id, v_stato, v_filtro, v_note;
    if v_stato is distinct from 'scartata' or v_filtro is null
       or coalesce(v_note, '') not like 'Avviso di sicurezza: archiviato prima di MEMO%' then
      raise exception 'VERIFICA (1): il Mr. Pin non è nato scartato con la nota della sicurezza (%, %).', v_stato, v_note;
    end if;
    -- 2. La stessa mail riconsegnata: scartata dal doppione, NON suona.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-1', 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'Codice Mr. Pin inserito errato', 'da_leggere')
    on conflict (messaggio_id) do nothing;
    reset role;

    select count(*), min(messaggio) into v_n, v_msg from allarmi where tipo = 'posta_sicurezza:' || v_id;
    if v_n <> 1 then
      raise exception 'VERIFICA (2): il Mr. Pin consegnato due volte ha fatto % righe invece di una.', v_n;
    end if;
    if v_msg <> 'Credem: Codice Mr. Pin inserito errato. La mail è in Posta → Sistemate.' then
      raise exception 'VERIFICA (1): la riga su Telegram non è quella attesa: %', v_msg;
    end if;
    if (select count(*) from allarmi where dettagli->>'posta_id' = v_id::text) <> 1 then
      raise exception 'VERIFICA (2): il doppione ha lasciato una traccia fra gli allarmi.';
    end if;

    -- 3. Aruba, «contiene»: l'oggetto vero ha il numero.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-3', 'info@zz-verifica.resend.app', 'Aruba <noreply@fatturazioneelettronica.aruba.it>', 'Hai disattivato la verifica in 2 passaggi', 'da_leggere')
    returning id into v_id;
    select messaggio into v_msg from allarmi where tipo = 'posta_sicurezza:' || v_id;
    if v_msg is distinct from 'Aruba: Hai disattivato la verifica in 2 passaggi. La mail è in Posta → Sistemate.' then
      raise exception 'VERIFICA (3): la verifica disattivata di Aruba non ha fatto la sua riga (%).', v_msg;
    end if;

    -- 4. Una regola in silenzio mette da parte e NON suona.
    insert into posta_filtri (mittente, oggetto_tipo, modo, nota)
    values ('news@zz-verifica.it', 'zz offerte della settimana #', 'uguale', 'ZZ verifica');
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-4', 'info@zz-verifica.resend.app', 'news@zz-verifica.it', 'ZZ offerte della settimana 46', 'da_leggere')
    returning id, stato, lettura_note into v_id, v_stato, v_note;
    if v_stato <> 'scartata' or coalesce(v_note, '') not like 'Filtrata prima di MEMO%' then
      raise exception 'VERIFICA (4): la regola in silenzio non ha messo da parte la mail (%).', v_note;
    end if;
    if exists (select 1 from allarmi where dettagli->>'posta_id' = v_id::text) then
      raise exception 'VERIFICA (4): una regola in silenzio ha suonato.';
    end if;

    -- 5. La PEC dello SdI con lo stesso oggetto: resta da leggere e non suona;
    --    e una regola che avvisa sullo SdI non si scrive.
    insert into posta_ricevuta (messaggio_id, casella, mittente, mittente_busta, oggetto, stato)
    values ('ZZ-SICUR-5', 'pec@zz-verifica.resend.app', 'sdi38@pec.fatturapa.it', 'posta-certificata@pec.aruba.it', 'Codice Mr. Pin inserito errato', 'da_leggere')
    returning id, stato into v_id, v_stato;
    if v_stato <> 'da_leggere' or exists (select 1 from allarmi where dettagli->>'posta_id' = v_id::text) then
      raise exception 'VERIFICA (5): la PEC dello SdI è stata messa da parte o ha suonato.';
    end if;
    v_respinto := false;
    begin
      insert into posta_filtri (mittente, oggetto_tipo, esito) values ('sdi38@pec.fatturapa.it', null, 'avvisa');
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (5): una regola che avvisa sulla PEC dello SdI è stata accettata.'; end if;
    v_respinto := false;
    begin
      insert into posta_filtri (mittente, oggetto_tipo, esito) values ('zz@zz-verifica.it', 'zz qualcosa di inventato', 'urla');
    exception when check_violation then v_respinto := true;
    end;
    if not v_respinto then raise exception 'VERIFICA (5): un esito che non esiste è stato accettato.'; end if;

    -- 6. IL TETTO. Due righe singole ci sono già (1 e 3): altre tre arrivano
    --    a cinque, la sesta fa la riga della raffica, la settima tace.
    for v_n in 1..3 loop
      insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
      values ('ZZ-SICUR-6-' || v_n, 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'Codice Mr. Pin inserito errato', 'da_leggere');
    end loop;
    if (select count(*) from allarmi where starts_with(tipo, 'posta_sicurezza:') and creato_il > now() - interval '1 hour') <> 5 then
      raise exception 'VERIFICA (6): le prime cinque righe singole non sono cinque.';
    end if;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-7', 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'Codice Mr. Pin inserito errato', 'da_leggere')
    returning id into v_id;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-8', 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'Codice Mr. Pin inserito errato', 'da_leggere')
    returning id into v_id2;
    if exists (select 1 from allarmi where tipo in ('posta_sicurezza:' || v_id, 'posta_sicurezza:' || v_id2)) then
      raise exception 'VERIFICA (6): oltre il tetto una mail ha fatto la sua riga singola.';
    end if;
    select count(*), min(messaggio) into v_n, v_msg from allarmi
     where tipo = 'posta_sicurezza_raffica' and creato_il > now() - interval '1 hour';
    if v_n <> 1 or v_msg not like 'Un altro avviso di sicurezza, guardalo in Posta → Sistemate. Sono più di 5 in un''ora%' then
      raise exception 'VERIFICA (6): la riga della raffica non è una sola, o non dice quanti (% righe: %).', v_n, v_msg;
    end if;
    -- La sesta l'ha contata la raffica; la settima aspetta, registrata.
    if not (select notificato from allarmi where tipo = 'posta_sicurezza_trattenuta:' || v_id)
       or (select notificato from allarmi where tipo = 'posta_sicurezza_trattenuta:' || v_id2) then
      raise exception 'VERIFICA (6): le trattenute non sono segnate come devono.';
    end if;

    -- 7. Passata l'ora: la prima mail torna a fare la sua riga, e dice
    --    quante ne erano rimaste senza riga.
    update allarmi set creato_il = creato_il - interval '61 minutes'
     where starts_with(tipo, 'posta_sicurezza');
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-9', 'info@zz-verifica.resend.app', 'Credem <businesson@credem.it>', 'Codice Mr. Pin inserito errato', 'da_leggere')
    returning id into v_id;
    select messaggio into v_msg from allarmi where tipo = 'posta_sicurezza:' || v_id;
    if v_msg is null or v_msg not like '%Durante la raffica di prima, un altro avviso di sicurezza senza riga qui%' then
      raise exception 'VERIFICA (7): dopo la raffica la prima riga non conta le trattenute (%).', v_msg;
    end if;
    if exists (select 1 from allarmi where starts_with(tipo, 'posta_sicurezza_trattenuta:') and not notificato) then
      raise exception 'VERIFICA (7): una trattenuta è rimasta senza nessuna riga che la conti.';
    end if;

    -- 8. Il tasto, come il titolare: «Archivia e avvisami su Telegram».
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-10', 'info@zz-verifica.resend.app', 'Allerta Esempio <allerta@zz-verifica.it>', 'Nuovo accesso al tuo conto 12345', 'proposta')
    returning id into v_id;
    v_r := aggiungi_filtro_posta(v_id, false, 'avvisa');
    if v_r->>'esito' <> 'avvisa' or v_r->>'oggetto_tipo' <> 'nuovo accesso al tuo conto #'
       or (select stato from posta_ricevuta where id = v_id) <> 'scartata'
       or (select lettura_note from posta_ricevuta where id = v_id) not like 'Avviso di sicurezza:%' then
      raise exception 'VERIFICA (8): «Archivia e avvisami» non ha fatto la regola attesa (%).', v_r;
    end if;
    -- La chiamata di prima, con due parametri per nome (una pagina vecchia):
    -- funziona, e non zittisce la regola che avvisa.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-11', 'info@zz-verifica.resend.app', 'allerta@zz-verifica.it', 'Nuovo accesso al tuo conto 999', 'proposta')
    returning id into v_id2;
    v_r := aggiungi_filtro_posta(p_posta_id => v_id2, p_tutto_mittente => false);
    if v_r->>'esito' <> 'avvisa' then
      raise exception 'VERIFICA (8): «silenzio» ha zittito una regola che avvisa (%).', v_r;
    end if;
    v_respinto := false;
    begin
      perform aggiungi_filtro_posta(v_id2, true, 'avvisa');
    exception when raise_exception then v_respinto := sqlerrm like '%non su tutte le mail di un mittente%';
    end;
    if not v_respinto then raise exception 'VERIFICA (8): il tasto ha fatto suonare tutte le mail di un mittente.'; end if;
    v_respinto := false;
    begin
      perform aggiungi_filtro_posta(v_id2, false, 'urla');
    exception when raise_exception then v_respinto := sqlerrm like '%non è una delle due%';
    end;
    if not v_respinto then raise exception 'VERIFICA (8): il tasto ha accettato un esito che non esiste.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);
    -- La mail sistemata dal tasto non suona (è un aggiornamento); la
    -- prossima dello stesso tipo sì, col nome del mittente davanti.
    if exists (select 1 from allarmi where dettagli->>'posta_id' in (v_id::text, v_id2::text)) then
      raise exception 'VERIFICA (8): la mail sistemata col tasto ha suonato.';
    end if;
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-12', 'info@zz-verifica.resend.app', 'Allerta Esempio <allerta@zz-verifica.it>', 'Nuovo accesso al tuo conto 67890', 'da_leggere')
    returning id into v_id;
    select messaggio into v_msg from allarmi where tipo = 'posta_sicurezza:' || v_id;
    if v_msg is distinct from 'Allerta Esempio: Nuovo accesso al tuo conto 67890. La mail è in Posta → Sistemate.' then
      raise exception 'VERIFICA (8): la mail dopo il tasto non ha fatto la riga attesa (%).', v_msg;
    end if;

    -- 9. Una regola in silenzio che c'era già diventa «avvisa» col tasto.
    insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato)
    values ('ZZ-SICUR-13', 'info@zz-verifica.resend.app', 'news@zz-verifica.it', 'ZZ offerte della settimana 47', 'proposta')
    returning id into v_id;
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := aggiungi_filtro_posta(v_id, false, 'avvisa');
    if v_r->>'esito' <> 'avvisa' then
      raise exception 'VERIFICA (9): la regola in silenzio non è diventata «avvisa» (%).', v_r;
    end if;
    -- E lo staff non può.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform aggiungi_filtro_posta(v_id, false, 'avvisa');
    exception when raise_exception then v_respinto := sqlerrm like '%titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA (9): lo staff ha aggiunto una regola che avvisa.'; end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform set_config('borgo58.allarmi_solo_registrati', '', true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica degli avvisi di sicurezza');

  raise notice 'Fatto: le regole della Posta possono avvisare su Telegram; Mr. Pin di Credem e verifica disattivata di Aruba si archiviano e mandano una riga, al massimo 5 all''ora e poi una riga «altri N avvisi»; la consegna doppia non suona; lo SdI resta fuori. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000011', 'gli_avvisi_di_sicurezza_squillano')
on conflict (version) do nothing;
