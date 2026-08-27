-- ============================================================================
-- LE DUE PORTE DELL'USCITA A MANO — 27/08/2026
-- ============================================================================
--
-- 🔴 TROVATE DALLA RETE, NON RILEGGENDO. `tests/app/permessi.test.js` conta
--    le funzioni che scavalcano la RLS senza chiedere chi sei ed è diventata
--    rossa da sola: **23 attese, 25 trovate**, e le due in più erano nate
--    un'ora prima con la `20260827000012`.
--
--    È la stessa rete che il 27/08 aveva già preso `caparre_trattenute()`, e
--    la seconda volta in un giorno che trova qualcosa che nessuna rilettura
--    aveva visto.
--
-- ----------------------------------------------------------------------------
-- DUE CURE DIVERSE, PERCHÉ SONO DUE COSE DIVERSE
-- ----------------------------------------------------------------------------
--
-- 1. `azione_campi` — **SI CHIUDE LA PORTA**, non si mette un portiere.
--    Non la chiama nessuno dal browser: la usa `azione_a_mano`, che è
--    `security definer` e il portiere ce l'ha già. Una funzione che nessuno
--    deve poter chiamare da fuori non ha bisogno di chiedere chi sei —
--    ha bisogno che la porta non ci sia. È il criterio del 26/08
--    (`20260826000015`, «una porta chiusa invece di un portiere»).
--    ⚠️ E la porta non era teorica: dentro c'è una lettura di `suppliers`
--       per comporre «Fornitore: …», quindi chiunque avesse fatto il login
--       poteva chiedere il nome di un fornitore dandone l'identificativo.
--
-- 2. `tipi_vocali_senza_uscita` — **PRENDE IL PORTIERE**. È una diagnostica
--    che racconta com'è fatto il gestionale, e le diagnostiche in questo
--    progetto il portiere ce l'hanno preso il 19/08 insieme alla rete.
--
-- ⚠️ E RESTA UNA COSA DA GUARDARE, dichiarata invece che sistemata di
--    passaggio: **la gemella `tipi_vocali_senza_ramo()` il portiere non ce
--    l'ha**, ed è dichiarata nell'elenco congelato della prova. Due gemelle
--    con due trattamenti diversi sono la cosa che fra sei mesi qualcuno
--    «uniforma» senza sapere perché. Non la tocco qui — chi la chiama va
--    misurato, e questo blocco non ha quel perimetro — ma va guardata.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La porta chiusa
-- ----------------------------------------------------------------------------
revoke all on function azione_campi(text, jsonb) from public, anon, authenticated;

comment on function azione_campi(text, jsonb) is
  'Quello che il gestionale ha gia'' capito, tradotto nel vocabolario della SCHERMATA dove si va a finirlo a mano. ⚠️ NON E'' CONCESSA A NESSUNO: la chiama solo `azione_a_mano`, che ha il portiere. Legge `suppliers` per comporre la dicitura del fornitore, quindi aperta sarebbe una porta su chi ci fornisce.';

-- ----------------------------------------------------------------------------
-- 2. Il portiere
-- ----------------------------------------------------------------------------
create or replace function tipi_vocali_senza_uscita()
returns table (tipo text, natura text, titolo text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  select t.tipo, t.natura, t.titolo
    from tipi_azione_vocale t
   where t.attivo
     and t.tipo <> 'nota_non_capita'
     and azione_percorso(t.tipo) is null
   order by t.tipo;
end $$;

comment on function tipi_vocali_senza_uscita() is
  'I tipi di azione vocale accesi che non hanno una schermata dove finirli a mano. Dovrebbe essere sempre vuoto: una riga qui vuol dire che qualcuno ha acceso un tipo nuovo e chi lo detta si trova davanti a un vicolo cieco. `nota_non_capita` e'' fuori apposta — non ha una destinazione perche'' non si sa cosa volesse.';

revoke all on function tipi_vocali_senza_uscita() from public, anon, authenticated;
grant execute on function tipi_vocali_senza_uscita() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit   uuid;
  v_n     integer;
  v_ok    boolean;
  v_fuori text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: non c''e'' nessun titolare.';
  end if;

  -- ------------------------------------------------------------------
  -- 1. Col titolare le due funzioni rispondono ancora
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  select count(*) into v_n from tipi_vocali_senza_uscita();
  if v_n <> 0 then
    raise exception 'Ci sono % tipi senza via d''uscita a mano.', v_n;
  end if;

  -- ⚠️ E `azione_a_mano` deve continuare a funzionare pur avendo chiuso la
  --    porta di `azione_campi`: dentro una funzione `security definer` la
  --    chiamata avviene coi permessi della proprietaria, non del chiamante.
  --    Se questa riga fallisse, la porta chiusa avrebbe rotto la strada
  --    buona insieme a quella cattiva.
  if azione_campi('movimento_cassa',
        jsonb_build_object('verso', 'uscita', 'importo', '30'))->>'importo' <> '30' then
    raise exception 'La traduzione dei campi non risponde piu''.';
  end if;

  -- ------------------------------------------------------------------
  -- 2. Il portiere RIFIUTA, non risponde vuoto
  -- ------------------------------------------------------------------
  -- ⚠️ È la lezione del 27/08 su `caparre_trattenute()`: un filtro nella
  --    `where` risponde «non c'è niente», che si legge come rassicurazione.
  perform set_config('request.jwt.claims', '', true);
  v_ok := false;
  begin
    perform count(*) from tipi_vocali_senza_uscita();
  exception when others then v_ok := true;
  end;
  if not v_ok then
    raise exception 'La rete delle uscite risponde a chi non e'' il titolare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ------------------------------------------------------------------
  -- 3. Nessuna delle due scavalca piu' la RLS senza chiedere chi sei
  -- ------------------------------------------------------------------
  select string_agg(nome, ', ') into v_fuori
    from funzioni_senza_portiere()
   where nome in ('azione_campi', 'tipi_vocali_senza_uscita', 'azione_a_mano',
                  'azione_percorso', 'chiudi_azione_a_mano');
  if v_fuori is not null then
    raise exception 'Queste sono ancora aperte senza portiere: %', v_fuori;
  end if;

  raise notice 'La porta di azione_campi e'' chiusa e azione_a_mano funziona lo stesso; tipi_vocali_senza_uscita ha il portiere e rifiuta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000014', 'le_due_porte_dell_uscita_a_mano') on conflict (version) do nothing;
