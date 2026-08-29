-- =====================================================================
-- IL FORNITORE IN REGIME DI ESONERO, E L'AUTOFATTURA CHE TOCCA A TE
-- 29/08/2026 — Blocco 4 del mandato del 29/08 (punto 4e)
-- =====================================================================
-- Serve coi contadini e con l'ortofrutta locale: chi e' in regime di
-- esonero (articolo 34 comma 6 del DPR 633/72) **non emette fattura**, e il
-- documento lo deve emettere chi compra. Senza un posto dove segnarselo, si
-- arriva a fine anno con venti autofatture mancanti — e nessuno se ne
-- accorge, perche' l'assenza di un documento non produce nessun segnale.
--
-- ⚠️ QUI NON SI EMETTE NIENTE, ed e' il perimetro dato dal mandato:
-- l'emissione passa da Fatture in Cloud, che Alessio non ha ancora
-- attivato. Serve solo che il gestionale **sappia** e **avvisi**.
--
-- ⚠️ E LE PERCENTUALI NON STANNO QUI. Quale aliquota di compensazione si
-- applichi, con che tempi si emetta e se le autofatture vadano mandate a
-- Laura sono il quesito `L6` in `docs/quesiti/QUESITI_CONSULENTI.md` —
-- aperto, allargato oggi con la terza domanda. Un numero fiscale scritto in
-- una colonna prima che il consulente risponda e' un numero inventato che
-- fra sei mesi nessuno ricorda di aver inventato.
--
-- ---------------------------------------------------------------------
-- COME NASCE LA CASELLA
-- ---------------------------------------------------------------------
-- 🔴 VUOTA, e non «no». Le risposte sono tre: e' in regime di esonero, non
-- lo e', **nessuno gliel'ha ancora chiesto** — ed e' lo stato vero di tutti
-- i fornitori esistenti. Un `false` predefinito direbbe «ho verificato che
-- non lo e'» per conto di Alessio, su fornitori che non ha ancora guardato:
-- e' la trappola del 14/08, dove un valore comodo su una colonna nuova
-- rispondeva al posto di chi non aveva risposto.
-- ⚠️ E il costo del vuoto e' piccolo e giusto: finche' nessuno risponde,
-- l'avviso non compare — il gestionale non finge di sapere.
alter table suppliers
  add column if not exists regime_esonero boolean;

comment on column suppliers.regime_esonero is
  'Questo fornitore e'' in regime di esonero (art. 34 c.6 DPR 633/72), cioe'' non emette fattura e l''autofattura la deve fare Alessio? VUOTO = nessuno gliel''ha ancora chiesto, ed e'' diverso da no: con «no» il gestionale afferma una cosa che non ha verificato.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto jsonb;
  v_tit uuid;
  v_id uuid;
  v_vuoti integer;
  v_tot integer;
  v_letto boolean;
  v_miei uuid[] := '{}';
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Verifica impossibile: nessun titolare.'; end if;

  -- (1) 🔴 NESSUN FORNITORE HA RICEVUTO UNA RISPOSTA CHE NON HA DATO.
  --     Se qualcuno risultasse «non in esonero» senza che Alessio l'abbia
  --     detto, il gestionale starebbe affermando una cosa non verificata —
  --     e su un fornitore agricolo quella e' esattamente l'affermazione che
  --     fa saltare l'autofattura.
  select count(*), count(*) filter (where regime_esonero is null) into v_tot, v_vuoti
    from suppliers;
  if v_tot > 0 and v_vuoti <> v_tot then
    raise exception '% fornitori su % hanno gia'' una risposta che nessuno ha dato.',
      v_tot - v_vuoti, v_tot;
  end if;

  -- (2) La casella si scrive e si rilegge, e regge tutti e tre gli stati.
  --     ⚠️ Il fornitore se lo crea la verifica: usare uno di Alessio
  --     vorrebbe dire cambiargli un dato suo per provare una colonna.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  insert into suppliers (entity_id, name, regime_esonero)
  select e.id, 'VERIFICA-29AGO esonero', true from entities e limit 1
  returning id into v_id;
  v_miei := v_miei || v_id;

  select regime_esonero into v_letto from suppliers where id = v_id;
  if v_letto is not true then
    raise exception 'La casella non conserva il si''.';
  end if;

  update suppliers set regime_esonero = false where id = v_id;
  select regime_esonero into v_letto from suppliers where id = v_id;
  if v_letto is not false then
    raise exception 'La casella non conserva il no.';
  end if;

  update suppliers set regime_esonero = null where id = v_id;
  select regime_esonero into v_letto from suppliers where id = v_id;
  if v_letto is not null then
    raise exception 'La casella non conserva il «non lo so», che e'' il terzo stato.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- PULIZIA: solo cio' che ha creato questa verifica, per identificativo.
  delete from suppliers where id = any(v_miei);
  delete from deleted_records where record_id = any(select x::text from unnest(v_miei) x);

  perform pretendi_nessun_residuo(v_foto, 'la verifica del regime di esonero');
  raise notice 'La casella del regime di esonero esiste e nasce vuota su tutti e % i fornitori: nessuno ha ricevuto una risposta che non ha dato.', v_tot;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000008', 'il_fornitore_in_regime_di_esonero') on conflict (version) do nothing;
