-- =====================================================================
-- LE LETTURE DI MEMO ARRIVANO A 150 RIGHE — 16/11/2026
-- =====================================================================
--
-- Dalle prove di Alessio sul telefono (16/11): alla domanda «riepilogo del
-- piano per gruppo» MEMO vedeva 50 voci su 63 e, per pescare le altre 13,
-- rifaceva la lettura con parole a caso finché ha finito i passaggi. Il
-- taglio a 50 righe era una scelta prudente, ma con i dati di Borgo 58 (63
-- voci di piano, 59 movimenti di cassa, 48 impegni, 133 prodotti) fa più
-- danni che guai. Ora ogni lettura restituisce fino a 150 righe; conteggio e
-- totale continuano a valere per TUTTE le righe, non solo per quelle lette.
--
-- Le undici funzioni si riprendono dal corpo VIVO e cambia una sola cosa
-- (`limit 50` → `limit 150`), controllata: deve comparire una volta sola.
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

do $limite$
declare
  v_nome text;
  v_def  text;
  v_n    integer;
begin
  foreach v_nome in array array[
    'memo_leggi_piano', 'memo_leggi_cassa', 'memo_leggi_fatture_fornitori', 'memo_leggi_agenda',
    'memo_leggi_magazzino', 'memo_leggi_banca', 'memo_leggi_prenotazioni', 'memo_leggi_haccp',
    'memo_leggi_costo_piatti', 'memo_leggi_documenti', 'memo_leggi_fatture_clienti']
  loop
    v_def := replace(pg_get_functiondef(('public.' || v_nome || '(text)')::regprocedure), E'\r', '');
    if v_def like '%limit 150%' then continue; end if;
    v_n := (length(v_def) - length(replace(v_def, 'limit 50', ''))) / length('limit 50');
    if v_n <> 1 then
      raise exception '% non ha un solo «limit 50» (ne ha %): confronta il corpo vivo prima di applicare.', v_nome, v_n;
    end if;
    execute replace(v_def, 'limit 50', 'limit 150');
  end loop;
end $limite$;

revoke all on function memo_leggi_piano(text), memo_leggi_cassa(text), memo_leggi_fatture_fornitori(text), memo_leggi_agenda(text), memo_leggi_magazzino(text), memo_leggi_banca(text), memo_leggi_prenotazioni(text), memo_leggi_haccp(text), memo_leggi_costo_piatti(text), memo_leggi_documenti(text), memo_leggi_fatture_clienti(text) from public, anon, authenticated;
grant execute on function memo_leggi_piano(text), memo_leggi_cassa(text), memo_leggi_fatture_fornitori(text), memo_leggi_agenda(text), memo_leggi_magazzino(text), memo_leggi_banca(text), memo_leggi_prenotazioni(text), memo_leggi_haccp(text), memo_leggi_costo_piatti(text), memo_leggi_documenti(text), memo_leggi_fatture_clienti(text) to authenticated;

-- rete-portieri: 20261115000018 chiama memo_leggi_piano — la verifica impersona il titolare prima della lettura.

do $verifica$
declare
  v_foto jsonb := foto_righe();
  v_titolare uuid; v_nome text; v_n integer; v_cont integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then raise exception 'VERIFICA: serve un titolare.'; end if;
  foreach v_nome in array array[
    'memo_leggi_piano', 'memo_leggi_cassa', 'memo_leggi_fatture_fornitori', 'memo_leggi_agenda',
    'memo_leggi_magazzino', 'memo_leggi_banca', 'memo_leggi_prenotazioni', 'memo_leggi_haccp',
    'memo_leggi_costo_piatti', 'memo_leggi_documenti', 'memo_leggi_fatture_clienti']
  loop
    if pg_get_functiondef(('public.' || v_nome || '(text)')::regprocedure) not like '%limit 150%' then
      raise exception 'VERIFICA: % non arriva a 150 righe.', v_nome;
    end if;
  end loop;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    -- 160 voci: la lettura ne dà 150 e il conteggio dice la verità (160).
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, aliquota_iva, stato)
    select 'D', 6000 + g, 'ZZ voce cento cinquanta ' || g, 1, 22, 'stimato' from generate_series(1, 160) g;
    set local role authenticated;
    select count(*), max(l.conteggio) into v_n, v_cont from memo_leggi_piano('ZZ voce cento cinquanta') l;
    if v_n <> 150 or v_cont <> 160 then
      raise exception 'VERIFICA: con 160 voci la lettura da % righe e conteggio % (attesi 150 e 160).', v_n, v_cont;
    end if;
    reset role;
    raise exception 'ZZ_ANNULLA';
  exception when others then reset role; if sqlerrm <> 'ZZ_ANNULLA' then raise; end if; end;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle letture di MEMO a 150 righe');
  raise notice 'Fatto: le letture di MEMO arrivano a 150 righe e il conteggio resta quello di tutte. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261115000018', 'le_letture_di_memo_arrivano_a_150_righe') on conflict (version) do nothing;
