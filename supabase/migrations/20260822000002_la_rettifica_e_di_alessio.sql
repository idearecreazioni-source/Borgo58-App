-- LA RETTIFICA DELLO SCONTRINO È DI ALESSIO — 22/08/2026, blocco 2 del
-- mandato del registratore telematico.
--
-- 🔴 QUESTO È UN ROVESCIAMENTO, e va letto sapendolo (n. 30 in
-- docs/decisioni_rovesciate.md).
--
-- **Cosa era stato deciso, e quando.** Il 20/08, blocco 1 dello stesso
-- mandato, ed era scritto in due posti: nel mandato — *«deve poterlo fare un
-- utente dello staff, non il solo titolare: se la prova gira col titolare,
-- non sta provando il gesto vero»* — e nel commento della schermata di sala:
-- *«LA PUÒ FARE CHIUNQUE SIA IN SALA, non solo il titolare (decisione di
-- Alessio): chi ha il cliente davanti è chi se ne accorge.»*
--
-- **La ragione di allora.** Vera, e **resta vera**: la pagina bianca la vede
-- soltanto chi ha il foglio in mano, cioè il cameriere. Nessun protocollo la
-- riporta.
--
-- **Cosa si decide adesso.** La rettifica la fa **il titolare**. Parole di
-- Alessio: *«il gesto sia di Alessio, non dello staff: è un dato fiscale»*.
--
-- **Perché la ragione di allora non vale più — ⚠️ e in buona parte vale
-- ancora.** Cade la conclusione, non la premessa: chi *si accorge* del
-- foglio bianco resta il cameriere, e questo non cambia. Cambia chi *tocca
-- il dato*, perché il 22/08 la fiscalizzazione è diventata **automatica**:
-- da oggi il gestionale scrive il documento da sé alla chiusura del conto,
-- e la rettifica smette di essere un gesto di sala fra tanti — diventa
-- l'unico punto in cui una persona **disfa a mano un dato fiscale già
-- registrato**. Quel gesto ha un peso diverso da quando la fiscalizzazione
-- era tutta manuale e uno «scontrino» sul conto era solo un'annotazione.
--
-- ⚠️ **E IL PREZZO SI PAGA, dichiarato**: il cameriere che vede la pagina
-- bianca adesso **deve dirlo ad Alessio**, e finché non glielo dice il conto
-- risulta a posto. Se Alessio non è in sala in quel momento, la finestra
-- resta aperta. Il rimedio non è tecnico: è che quel conto resta
-- ritrovabile in Cassa → Incassato e scontrinato per tutto il periodo, e
-- l'elenco non si svuota da solo.

-- ---------------------------------------------------------------------
-- La funzione, con il portiere in più. Il resto del corpo è invariato.
-- ---------------------------------------------------------------------
create or replace function segnala_scontrino_non_uscito(
  p_order_id uuid,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conto  orders;
  v_prima  text;
begin
  if auth.uid() is null then
    raise exception 'Serve un accesso per segnalare uno scontrino.';
  end if;

  -- 🔴 IL PORTIERE, ed è la sola riga nuova (22/08). Il messaggio dice cosa
  -- fare, non solo che è vietato: un rifiuto senza via d'uscita è un vicolo
  -- cieco, e chi lo legge ha in mano uno scontrino che non è uscito.
  if not is_titolare() then
    raise exception 'La rettifica di uno scontrino la fa Alessio: e'' un dato fiscale. Diglielo — il conto resta ritrovabile in Cassa, Incassato e scontrinato.';
  end if;

  select * into v_conto from orders where id = p_order_id;
  if not found then
    raise exception 'Questo conto non esiste piu''.';
  end if;
  if v_conto.status not in ('chiuso', 'omaggiato') then
    raise exception 'Si segnala solo un conto gia'' chiuso: questo e'' ancora %.', v_conto.status;
  end if;

  -- ⚠️ Una fattura non si disfa da qui, e il rifiuto dice cosa fare: ha un
  -- numero, e un numero emesso non si toglie con un tocco.
  if v_conto.documento_fiscale = 'fattura' then
    raise exception 'Su questo conto risulta una fattura numero %: una fattura non si disfa cosi''. Si corregge da Cassa.',
      coalesce(v_conto.documento_numero, 'senza numero');
  end if;

  v_prima := coalesce(v_conto.documento_fiscale, 'da dire');

  update orders
     set documento_fiscale = null,
         documento_numero = null,
         documento_emesso_il = null
   where id = p_order_id;

  -- ⚠️ La traccia era già completa e non si tocca: CHI (segnalato_da),
  -- QUANDO (segnalato_il, dal predefinito) e QUALE documento era stato
  -- assegnato (stato_prima). È quello che il mandato chiede, e c'era già.
  insert into segnalazioni_fiscali (order_id, segnalato_da, nota, stato_prima)
  values (p_order_id, auth.uid(), nullif(btrim(p_nota), ''), v_prima);

  return jsonb_build_object(
    'order_id', p_order_id,
    'stato_prima', v_prima,
    'messaggio',
      case when v_prima = 'scontrino'
           then 'Rettificato: il conto torna fra quelli da fiscalizzare.'
           else 'Segnalato: il conto era gia'' fra quelli da fiscalizzare, e adesso c''e'' scritto perche''.'
      end
  );
end;
$$;

revoke all on function segnala_scontrino_non_uscito(uuid, text) from public, anon, authenticated;
grant execute on function segnala_scontrino_non_uscito(uuid, text) to authenticated;

comment on function segnala_scontrino_non_uscito is
  'La rettifica di uno scontrino: riservata al titolare dal 22/08/2026, perche'' da quel giorno la fiscalizzazione e'' automatica e questo e'' l''unico punto in cui una persona disfa a mano un dato fiscale registrato.';

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $$
declare
  v_corpo text;
  v_conto uuid;
  v_ente  uuid;
  v_prima integer;
  v_dopo  integer;
  v_staff uuid;
  v_tit   uuid;
begin
  -- 1. Il portiere c'è DAVVERO nel corpo vivo della funzione, non solo nel
  --    file: si può correggere un file e lasciare il database com'era.
  select pg_get_functiondef(p.oid) into v_corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'segnala_scontrino_non_uscito';
  if v_corpo is null then
    raise exception 'La funzione della rettifica non esiste.';
  end if;
  if v_corpo not like '%is_titolare()%' then
    raise exception 'Il portiere non e'' finito nel corpo vivo della funzione.';
  end if;

  -- 2. ⚠️ E il rifiuto si prova DAVVERO, IMPERSONANDO UNO STAFF, su un conto
  --    vero: una verifica che guardi solo il testo non distingue un portiere
  --    che c'e' da uno che non gira mai.
  --
  --    🔴 E il primo tentativo l'ho scritto sbagliato, vale la pena dirlo:
  --    contavo sul fatto che dentro una migrazione `is_titolare()` sia
  --    falso, e mi sono dimenticato che li' `auth.uid()` e' **null** —
  --    quindi scattava il controllo PRECEDENTE («serve un accesso») e la
  --    verifica passava senza aver mai messo alla prova il portiere nuovo.
  --    *Un rifiuto ottenuto per la ragione sbagliata somiglia in tutto a
  --    quello giusto.*
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_staff is null then
    raise exception 'Nessuno staff in user_roles: impossibile verificare il rifiuto.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  select id into v_ente from entities limit 1;
  insert into orders (entity_id, table_label, status, closed_at, coperti, coperto_unit_price)
  values (v_ente, 'VERIFICA rettifica', 'chiuso', now(), 2, 5)
  returning id into v_conto;

  select count(*) into v_prima from segnalazioni_fiscali;

  begin
    perform segnala_scontrino_non_uscito(v_conto, 'prova della migrazione');
    raise exception 'La rettifica NON e'' stata rifiutata: il portiere non funziona.';
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like '%Alessio%' then
        raise exception 'Rifiutata, ma con un messaggio inatteso: %', sqlerrm;
      end if;
  end;

  -- 3. E il rifiuto non ha lasciato niente dietro di sé.
  select count(*) into v_dopo from segnalazioni_fiscali;
  if v_dopo <> v_prima then
    raise exception 'Il rifiuto ha scritto una segnalazione: prima %, dopo %.', v_prima, v_dopo;
  end if;

  -- 4. 🔴 LA CONTROPROVA CHE DISCRIMINA: col TITOLARE la rettifica deve
  --    RIUSCIRE. Senza, un portiere che rifiuta tutti passerebbe la
  --    verifica esattamente come uno giusto.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: impossibile fare la controprova.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  update orders set documento_fiscale = 'scontrino', documento_numero = 'VER-1',
                    documento_emesso_il = current_date
   where id = v_conto;
  perform segnala_scontrino_non_uscito(v_conto, 'controprova col titolare');

  if exists (select 1 from orders where id = v_conto and documento_fiscale is not null) then
    raise exception 'Il titolare ha rettificato, ma il documento e'' rimasto addosso al conto.';
  end if;
  if not exists (select 1 from segnalazioni_fiscali where order_id = v_conto and stato_prima = 'scontrino') then
    raise exception 'La rettifica del titolare non ha lasciato traccia.';
  end if;

  delete from segnalazioni_fiscali where order_id = v_conto;
  delete from orders where id = v_conto;
  perform set_config('request.jwt.claims', null, true);
  raise notice 'Verifica passata: lo staff e'' rifiutato senza lasciare tracce, il titolare rettifica e la traccia c''e''.';
end $$;

insert into applied_migrations (version, name)
values ('20260822000002', 'la_rettifica_e_di_alessio') on conflict (version) do nothing;
