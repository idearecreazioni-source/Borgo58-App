-- 25/11/2026 — Revisione dell'11/11, punto 21: una proposta della posta già rifiutata si può ancora eseguire da un altro apparecchio.
--
-- Cosa succedeva: rifiutare una proposta («Archivia questo documento», «Aggiungi al magazzino»…) cambia solo il suo stato in
-- «rifiutata». Ma `esegui_azione_posta` non guardava lo stato: se la stessa proposta era ancora aperta su un altro
-- apparecchio (un tablet con la pagina vecchia), il «Conferma» di quell'apparecchio la eseguiva lo stesso — un documento
-- archiviato, un carico in magazzino — dopo che Alessio aveva detto di no. (La proposta della fattura dalla PEC lo guardava
-- già: `registra_fattura_dalla_posta` accetta solo «proposta».)
-- Cura: `esegui_azione_posta` accetta solo lo stato «proposta». Una già «fatta» continua a rispondere «già fatta» (come
-- prima: il controllo c'è subito sopra); una «rifiutata» ora è rifiutata a sua volta, con un messaggio chiaro.
-- Si cambia il corpo VIVO della funzione in un punto solo (controllato: la riga deve comparire una volta sola).
-- ⚠️ Nessun file del repo contiene il corpo completo col controllo: per riscrivere la funzione si riparte da `npm run funzione:viva`, mai da una migrazione vecchia.

do $stato$
declare
  v_vecchio constant text := 'v_par := coalesce(p_parametri, v_azione.parametri);';
  v_nuovo   constant text := 'if v_azione.stato <> ''proposta'' then
    raise exception ''Questa proposta è già stata decisa (%): non si può eseguire.'', v_azione.stato;
  end if;

  v_par := coalesce(p_parametri, v_azione.parametri);';
  v_def     text;
  v_n       integer;
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := replace(pg_get_functiondef('public.esegui_azione_posta(uuid, jsonb)'::regprocedure), E'\r', '');
  if v_def like '%Questa proposta è già stata decisa (%): non si può eseguire.%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'esegui_azione_posta non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_vecchio, v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $stato$;

-- ---------------------------------------------------------------------
-- VERIFICA (blocco annullato, zero residui)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid;
  v_posta uuid;
  v_az uuid;
  v_az2 uuid;
  v_no boolean;
  v_stato text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;

  begin
    insert into posta_ricevuta (messaggio_id, casella, oggetto, testo, stato)
      values ('zz-verifica-rifiutata-20261125', 'zz@verifica', 'ZZ verifica', 'ZZ corpo', 'proposta')
      returning id into v_posta;
    insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri, stato)
      values (v_posta, 'nessuna', 'ZZ rifiutata', 'ZZ', '{}'::jsonb, 'rifiutata') returning id into v_az;
    insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri, stato)
      values (v_posta, 'nessuna', 'ZZ aperta', 'ZZ', '{}'::jsonb, 'proposta') returning id into v_az2;

    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    -- (1) una proposta RIFIUTATA non si esegue, e dice perché.
    v_no := false;
    begin
      perform esegui_azione_posta(v_az, null);
    exception when raise_exception then v_no := (sqlerrm like '%già stata decisa (rifiutata)%');
    end;
    if not v_no then raise exception 'VERIFICA (1): una proposta rifiutata si è potuta eseguire.'; end if;
    select stato::text into v_stato from posta_azioni where id = v_az;
    if v_stato <> 'rifiutata' then raise exception 'VERIFICA (1b): la proposta rifiutata ha cambiato stato (%).', v_stato; end if;

    -- (2) una proposta APERTA si esegue come sempre.
    perform esegui_azione_posta(v_az2, null);
    select stato::text into v_stato from posta_azioni where id = v_az2;
    if v_stato <> 'fatta' then raise exception 'VERIFICA (2): una proposta aperta non si è eseguita (%).', v_stato; end if;

    -- (3) una già FATTA risponde «già fatta», non un errore.
    if coalesce((esegui_azione_posta(v_az2, null)->>'gia_fatta')::boolean, false) is not true then
      raise exception 'VERIFICA (3): una proposta già fatta non risponde «già fatta».';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  if exists (select 1 from posta_ricevuta where messaggio_id = 'zz-verifica-rifiutata-20261125') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  raise notice 'Fatto: una proposta della posta già rifiutata non si può più eseguire da un altro apparecchio; una aperta si esegue, una già fatta risponde «già fatta». Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261125000002', 'una_proposta_rifiutata_non_si_esegue')
on conflict (version) do nothing;
