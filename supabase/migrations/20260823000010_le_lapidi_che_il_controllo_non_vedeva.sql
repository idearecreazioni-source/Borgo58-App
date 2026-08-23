-- =====================================================================
-- LE LAPIDI CHE IL CONTROLLO NON VEDEVA
-- 23/08/2026
-- =====================================================================
-- Blocco 7 del mandato del 23/08, le due cose in coda.
--
-- ---------------------------------------------------------------------
-- LA MISURA, fatta sul database VERO prima di scrivere
-- ---------------------------------------------------------------------
--   · lapidi in tutto:                                    **43**
--   · vissute meno di un minuto (nate e morte quasi
--     nello stesso istante):                              **24**
--   · che il controllo attuale riesce a vedere:            **2**
--
-- 🔴 Il controllo cerca la parola «verifica» dentro la riga. Ma le prove di
-- questo progetto marcano le proprie righe in **cinque modi diversi** —
-- `__PROVA TESORERIA__`, `PROVA BANCA`, `TEST-AUTO`, `ZZ …`, «verifica» — e
-- alcune **non marcano niente**: uno sconto, una ferie, una riga di comanda
-- non hanno un campo dove scrivere una nota.
--
-- ⚠️ Quindi un controllo che cerca UNA parola trova per costruzione solo le
-- prove che quella parola l'hanno scritta. *Un guardiano che riconosce una
-- sola delle scritture della stessa cosa passa in silenzio* — è la lezione
-- del 19/08 sulle funzioni senza portiere, in un posto nuovo.
--
-- ---------------------------------------------------------------------
-- LA CURA: TRE categorie, non una — e non due
-- ---------------------------------------------------------------------
--   · **verifica di una migrazione** — deve essere **zero su qualunque
--     database**: una migrazione che lascia una lapide rompe il guardiano
--     che ogni altra usa per difendersi.
--   · **marcatore di una prova automatica** — sul progetto di prova sono
--     NORMALI (li' le prove girano e ripuliscono cio' che creano); in
--     produzione no, e li' vanno guardate.
--   · **nata e morta nello stesso istante** — criterio strutturale invece
--     che una parola: prende anche le prove che non marcano niente.
--
-- 🔴 LA DISTINZIONE FRA LE PRIME DUE E' NATA DA UN ERRORE FATTO QUI: la
-- prima stesura le metteva insieme, e la prova automatica — che pretende
-- ZERO — e' diventata rossa con **338 lapidi** sul progetto di prova. Erano
-- tutte legittime: le lascia la suite stessa. *Un guardiano tarato su un
-- database dove quel fatto e' normale grida sempre, e quelli si imparano a
-- spegnere.*
--
-- ⚠️ E la terza categoria **non e' una prova, e' un indizio**: anche un
-- gesto vero puo' durare un istante — si scrive un movimento, ci si accorge
-- della causale sbagliata, lo si cancella. Chiamarla «di prova» sarebbe
-- inventare una certezza: il controllo la dichiara separata, e chi guarda
-- decide.
--
-- 🔴 QUESTA MIGRAZIONE NON CANCELLA NIENTE. `deleted_records` è un registro
-- esibibile e in sola lettura per tutti: toglierne righe è una cancellazione
-- di dati veri, e quella la decide Alessio. Qui si costruisce lo strumento
-- che gliele fa **vedere**, con l'elenco separato fra ciò che è sicuramente
-- nostro e ciò che va guardato.
-- =====================================================================

drop function if exists lapidi_di_prova();

create or replace function lapidi_di_prova()
returns table (
  id       bigint,
  tabella  text,
  firma    text,
  perche   text,
  vissuta_secondi integer
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Il registro delle cancellazioni e'' riservato al titolare.';
  end if;

  return query
  select d.id, d.table_name::text,
         left(coalesce(d.record->>'business_purpose', d.record->>'invoice_number',
                       d.record->>'note', d.record->>'description',
                       d.record->>'customer_name', d.record->>'full_name',
                       d.record->>'free_text_name', d.record::text), 60),
         case
           -- 🔴 LE VERIFICHE DENTRO LE MIGRAZIONI: queste devono essere
           -- ZERO SEMPRE, su qualunque database. Una migrazione che lascia
           -- una lapide rompe il guardiano che ogni altra migrazione usa
           -- per difendersi — «le lapidi prima e dopo devono essere le
           -- stesse».
           when d.record::text ilike '%verifica%' then 'verifica di una migrazione'
           -- Le prove automatiche dell'app. ⚠️ Sul progetto di prova sono
           -- NORMALI: li' girano, e cancellano cio' che hanno creato. In
           -- produzione no, e li' vanno guardate.
           when d.record::text ilike '%__PROVA%'
             or d.record::text ilike '%TEST-AUTO%'
             or d.record::text ilike '%PROVA BANCA%'
             or d.record::text ilike '%PROVA PAGA%'
             or d.record::text ilike '%PROVA-PAGA%'
           then 'marcatore di una prova automatica'
           -- ⚠️ Indizio, non prova: anche un gesto vero puo' durare un
           -- istante. Si dichiara, non si conclude.
           else 'nata e morta nello stesso istante — da guardare'
         end,
         extract(epoch from d.deleted_at
                 - coalesce((d.record->>'created_at')::timestamptz, d.deleted_at))::integer
    from deleted_records d
   where d.record::text ilike '%verifica%'
      or d.record::text ilike '%__PROVA%'
      or d.record::text ilike '%TEST-AUTO%'
      or d.record::text ilike '%PROVA BANCA%'
      or d.record::text ilike '%PROVA PAGA%'
      or d.record::text ilike '%PROVA-PAGA%'
      or ((d.record->>'created_at') is not null
          and d.deleted_at - (d.record->>'created_at')::timestamptz < interval '1 minute')
   order by d.deleted_at;
end;
$funzione$;

comment on function lapidi_di_prova() is
  'Le righe del registro delle cancellazioni che con ogni probabilita'' non sono gesti veri. Distingue due cose che non vanno confuse: quelle che portano un marcatore di prova (certe) e quelle nate e morte nello stesso istante (un indizio: anche un gesto vero puo'' durare un istante). Dal 23/08/2026 — prima cercava una sola parola, e su 24 righe sospette ne vedeva 2.';

revoke all on function lapidi_di_prova() from public, anon, authenticated;
grant execute on function lapidi_di_prova() to authenticated;


-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- ⚠️ Si costruiscono DUE lapidi apposta, di cui una **senza nessun
-- marcatore**: e' il caso che il controllo vecchio non vedeva, e su una
-- lapide marcata questo blocco passerebbe anche col codice di ieri (regola
-- del caso vuoto).
do $verifica$
declare
  v_tit      uuid;
  v_ente     uuid;
  v_mov      uuid;
  v_mov2     uuid;
  v_causale  uuid;
  v_lapidi   integer;
  v_lapidi_2 integer;
  v_n        integer;
  v_perche   text;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  select id into v_causale from cash_causali limit 1;
  if v_causale is null then raise exception 'Nessuna causale: impossibile verificare.'; end if;

  insert into cash_movements (entity_id, movement_date, direction, amount, causale_id, note, mezzo)
  values (v_ente, current_date, 'uscita', 1, v_causale, '__PROVA lapidi marcata__', 'cassa')
  returning id into v_mov;
  -- ⚠️ Senza nota: nessun marcatore, come le ferie e gli sconti veri.
  insert into cash_movements (entity_id, movement_date, direction, amount, causale_id, mezzo)
  values (v_ente, current_date, 'uscita', 1, v_causale, 'cassa')
  returning id into v_mov2;

  delete from cash_movements where id in (v_mov, v_mov2);

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. Quella marcata si riconosce, e si dice perche'.
  select perche into v_perche from lapidi_di_prova() l
   where l.firma like '%lapidi marcata%' limit 1;
  if v_perche is distinct from 'marcatore di una prova automatica' then
    raise exception 'La lapide marcata non viene riconosciuta (%).', v_perche;
  end if;

  -- 2. 🔴 E QUELLA SENZA MARCATORE ANCHE, che e' il punto di tutto: il
  --    controllo vecchio ne vedeva 2 su 24.
  select count(*) into v_n from lapidi_di_prova() l
   where l.perche like 'nata e morta%' and l.vissuta_secondi < 60;
  if v_n < 1 then
    raise exception 'Una lapide senza marcatore, nata e morta nello stesso istante, non viene vista.';
  end if;

  -- 3. E il controllo NON conclude: la dichiara sospetta, non «di prova».
  if exists (select 1 from lapidi_di_prova() l
              where l.perche like 'nata e morta%' and l.perche not like '%da guardare%') then
    raise exception 'Il controllo dichiara certa una riga di cui ha solo un indizio.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- pulizia: si tolgono le due lapidi costruite qui, e nient'altro.
  delete from deleted_records
   where table_name = 'cash_movements'
     and (record->>'id')::uuid in (v_mov, v_mov2);

  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: il controllo vede anche le lapidi senza marcatore, e non le chiama certe.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000010', 'le_lapidi_che_il_controllo_non_vedeva') on conflict (version) do nothing;
