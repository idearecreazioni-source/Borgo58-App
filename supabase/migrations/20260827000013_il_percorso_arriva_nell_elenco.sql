-- ============================================================================
-- IL PERCORSO ARRIVA NELL'ELENCO — 27/08/2026
-- ============================================================================
--
-- La `20260827000012` ha costruito la via d'uscita a mano, ma il collegamento
-- va messo **su ogni riga in sospeso**, e quelle righe arrivano dai due
-- elenchi (`azioni_dettate_in_attesa`, `azioni_della_dettatura`) che non
-- dicono dove si va.
--
-- ⚠️ LA SCHERMATA NON SE LO CALCOLA. Sembrerebbe più semplice — è una
--    mappa da undici voci — ed è precisamente la seconda definizione che il
--    blocco esiste per non avere: il giorno che un tipo nuovo nasce, il
--    database lo saprebbe e il browser no, e il collegamento porterebbe da
--    nessuna parte senza che nessuna verifica se ne accorga.
--
-- ⚠️ E NON SI CHIEDE RIGA PER RIGA con `azione_a_mano()`: un elenco di dieci
--    cose in sospeso farebbe dieci giri di rete per disegnare dieci
--    pulsanti. Il percorso è un `case` immutabile, costa niente in una
--    query che sta già girando.
--
-- ⚠️ Le due funzioni sono **riscritte dal corpo vivo del PROGETTO DI PROVA**
--    e non da quello di produzione: la `…007` in produzione non è ancora
--    applicata, quindi lì il corpo vivo è indietro di due colonne
--    (`domanda`, `scelte`). *«Il corpo vivo» non è una cosa sola: è quello
--    del database che si sta guardando*, e qui quello giusto è il database
--    allineato al repository.
-- ============================================================================

-- ⚠️ Cambia la forma del risultato, quindi serve il `drop`: `create or
--    replace` su una funzione che restituisce una tabella diversa risponde
--    «cannot change return type of existing function».
--    E dopo un `drop` i permessi tornano APERTI AL MONDO (lezione del
--    13/08): vanno riscritti a mano, sotto.
drop function if exists azioni_dettate_in_attesa();

create function azioni_dettate_in_attesa()
returns table (
  id uuid, dettatura_id uuid, tipo text, titolo text, natura text, dati jsonb,
  sicuro boolean, frase text, motivo text, stato text, errore text,
  testo_detto text, quando timestamptz, giorni integer,
  domanda text, scelte jsonb, percorso text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.dettatura_id, a.tipo, t.titolo, t.natura, a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, d.testo, a.creato_il,
         (((now() at time zone 'Europe/Rome')::date) - ((a.creato_il at time zone 'Europe/Rome')::date))::integer,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati),
         azione_percorso(a.tipo)
    from azioni_dettate a
    join tipi_azione_vocale t on t.tipo = a.tipo
    join dettature d on d.id = a.dettatura_id
   where a.stato in ('in_attesa', 'fallita')
   order by a.creato_il, a.progressivo;
end $$;

revoke all on function azioni_dettate_in_attesa() from public, anon, authenticated;
grant execute on function azioni_dettate_in_attesa() to authenticated;

drop function if exists azioni_della_dettatura(uuid);

create function azioni_della_dettatura(p_id uuid)
returns table (
  id uuid, progressivo integer, tipo text, titolo text, natura text, dati jsonb,
  sicuro boolean, frase text, motivo text, stato text, errore text,
  quando timestamptz, domanda text, scelte jsonb, percorso text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.progressivo, a.tipo, t.titolo, t.natura, a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, a.creato_il,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati),
         azione_percorso(a.tipo)
    from azioni_dettate a
    join tipi_azione_vocale t on t.tipo = a.tipo
   where a.dettatura_id = p_id
   order by a.progressivo;
end $$;

revoke all on function azioni_della_dettatura(uuid) from public, anon, authenticated;
grant execute on function azioni_della_dettatura(uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit    uuid;
  v_det    uuid;
  v_az     uuid;
  v_miei   uuid[] := '{}';
  v_lapidi bigint;
  v_dopo   bigint;
  v_perc   text;
  v_n      integer;
  v_ok     boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: non c''e'' nessun titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  select count(*) into v_lapidi from deleted_records;

  insert into dettature (testo, provenienza, esito)
  values ('trenta euro al fornitore, e ho buttato due chili di pomodori', 'app', 'capita')
  returning id into v_det;
  v_miei := v_miei || v_det;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'movimento_cassa',
          jsonb_build_object('verso', 'uscita', 'importo', '30', 'mezzo', 'cassa'),
          true, 'Uscita di 30,00 euro dalla cassa', 'Questa la guardi sempre tu.', 'in_attesa')
  returning id into v_az;

  -- ------------------------------------------------------------------
  -- 1. Il percorso arriva nei DUE elenchi, e dice la stessa cosa
  -- ------------------------------------------------------------------
  select z.percorso into v_perc from azioni_dettate_in_attesa() z where z.id = v_az;
  if v_perc <> '/cassa/prima-nota' then
    raise exception 'L''elenco delle cose in sospeso porta a «%» invece che alla prima nota.', coalesce(v_perc, '(vuoto)');
  end if;

  select z.percorso into v_perc from azioni_della_dettatura(v_det) z where z.id = v_az;
  if v_perc <> '/cassa/prima-nota' then
    raise exception 'Il riscontro subito dopo aver parlato porta a «%».', coalesce(v_perc, '(vuoto)');
  end if;

  -- ⚠️ E deve dire la STESSA COSA di `azione_a_mano()`, che è quello che
  --    poi la schermata userà per riempirsi. Due strade che portano lo
  --    stesso dato e possono divergere sono il difetto che questo blocco
  --    esiste per non avere.
  if (azione_a_mano(v_az)->>'percorso') <> v_perc then
    raise exception 'I due elenchi e la porta a mano non dicono lo stesso percorso.';
  end if;

  -- ------------------------------------------------------------------
  -- 2. Una nota non capita non porta da nessuna parte, in tutti e due
  -- ------------------------------------------------------------------
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 2, 'nota_non_capita', jsonb_build_object('sentito', 'boh'),
          false, 'Da riguardare: una cosa detta a voce', 'Non ho capito.', 'in_attesa')
  returning id into v_az;

  select count(*) into v_n from azioni_dettate_in_attesa() z
   where z.id = v_az and z.percorso is null;
  if v_n <> 1 then
    raise exception 'Una nota non capita ha un percorso: ma non si sa cosa volesse.';
  end if;

  -- ------------------------------------------------------------------
  -- 3. Il portiere RIFIUTA, non risponde vuoto
  -- ------------------------------------------------------------------
  -- ⚠️ È la lezione del 27/08 su `caparre_trattenute()`: un filtro nella
  --    `where` risponde «non c'è niente», che si legge come una rassicurazione.
  perform set_config('request.jwt.claims', '', true);
  v_ok := false;
  begin
    perform count(*) from azioni_dettate_in_attesa();
  exception when others then v_ok := true;
  end;
  if not v_ok then
    raise exception 'L''elenco delle cose dettate ha risposto a chi non è il titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ------------------------------------------------------------------
  -- 4. Pulizia — solo quello che questa verifica ha creato
  -- ------------------------------------------------------------------
  delete from azioni_dettate where dettatura_id = any(v_miei);
  delete from dettature where id = any(v_miei);

  select count(*) into v_dopo from deleted_records;
  if v_dopo <> v_lapidi then
    raise exception 'La verifica ha lasciato % tracce nel registro delle cancellazioni.', v_dopo - v_lapidi;
  end if;

  raise notice 'Il percorso arriva in tutti e due gli elenchi e combacia con la porta a mano; la nota non capita non porta da nessuna parte; il portiere rifiuta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000013', 'il_percorso_arriva_nell_elenco') on conflict (version) do nothing;
