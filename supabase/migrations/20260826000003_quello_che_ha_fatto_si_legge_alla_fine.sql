-- ============================================================================
-- I COMANDI VOCALI — il riscontro arriva alla fine — 26/08/2026
-- ============================================================================
--
-- Le due migrazioni accanto costruiscono il magazzino e i gesti. Questa fa
-- una cosa sola: permettere di LEGGERE com'e' finita una dettatura, e di
-- sapere quante cose stanno aspettando.
--
-- ⚠️ Nasce a se' e non dentro la `…0002` perche' quella e' gia' stata
--    applicata: una migrazione applicata non si riscrive mai, si aggiunge
--    accanto (regola di Alessio del 23/08). Vale anche qui, dove il file
--    non e' ancora uscito da questo computer.
--
-- 🔴 IL RISCONTRO ARRIVA ALLA FINE, MAI DOPO OGNI FRASE. Alessio detta con
--    le mani occupate e in cella non sente: dirgli qualcosa a meta' della
--    filza serve solo a fargli perdere il filo. Alla fine invece guarda
--    una volta sola, e vede due elenchi diversi a seconda di com'e' andata
--    — quello che il gestionale HA FATTO, e quello che gli sta CHIEDENDO.
-- ============================================================================

create or replace function azioni_della_dettatura(p_id uuid)
returns table(
  id          uuid,
  progressivo integer,
  tipo        text,
  titolo      text,
  natura      text,
  dati        jsonb,
  sicuro      boolean,
  frase       text,
  motivo      text,
  stato       text,
  errore      text,
  quando      timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.progressivo, a.tipo, t.titolo, t.natura, a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, a.creato_il
    from azioni_dettate a
    join tipi_azione_vocale t on t.tipo = a.tipo
   where a.dettatura_id = p_id
   order by a.progressivo;
end $funzione$;

comment on function azioni_della_dettatura(uuid) is
  'Com''e'' finita una dettatura, azione per azione e nell''ordine in cui sono state dette. E'' quello che la schermata mostra ALLA FINE: l''elenco di cio'' che ha fatto se era sicuro, le cose da confermare se non lo era.';

revoke all on function azioni_della_dettatura(uuid) from public, anon, authenticated;
grant execute on function azioni_della_dettatura(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Quante cose stanno aspettando — per la Dashboard
-- ----------------------------------------------------------------------------
-- ⚠️ E' un CONTEGGIO e non l'elenco: la Dashboard deve poter dire «ce ne
--    sono tre» senza tirarsi dietro tutti i dati di tre azioni. E porta
--    anche l'anzianita' della piu' vecchia, perche' «tre da ieri» e «tre da
--    due settimane» sono due situazioni diverse e la seconda va detta.
create or replace function voce_da_guardare()
returns table(quante integer, la_piu_vecchia integer)
language plpgsql
stable security definer
set search_path to 'public'
as $funzione$
begin
  if not is_titolare() then
    return query select 0, 0;
    return;
  end if;

  return query
  select count(*)::integer,
         coalesce(max(
           ((now() at time zone 'Europe/Rome')::date) - ((a.creato_il at time zone 'Europe/Rome')::date)
         ), 0)::integer
    from azioni_dettate a
   where a.stato in ('in_attesa', 'fallita');
end $funzione$;

comment on function voce_da_guardare() is
  'Quante cose dettate stanno ancora aspettando Alessio, e da quanti giorni aspetta la piu'' vecchia. E'' il «glielo si ricorda il giorno dopo» del mandato, fatto mostrando invece che cancellando: niente scade mai.';

-- ⚠️ Non alza un'eccezione allo staff ma risponde zero, ed e' voluto: e'
--    un contatore in cima a una schermata condivisa, e un rifiuto li'
--    farebbe comparire un errore rosso a chi non c'entra niente. Chi non
--    e' il titolare non vede nessuna delle cose contate.
revoke all on function voce_da_guardare() from public, anon, authenticated;
grant execute on function voce_da_guardare() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_tit    uuid;
  v_dett   uuid;
  v_n      integer;
  v_r      record;
  v_lapidi_pre integer;
  v_lapidi_post integer;
begin
  select count(*) into v_lapidi_pre from deleted_records;

  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Non c''e'' nessun titolare: questa verifica non puo'' girare.';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- Roba nostra: una dettatura con due azioni, una fatta e una che aspetta.
  insert into dettature (testo, provenienza, esito, creato_da)
  values ('VERIFICA-lettura di una dettatura', 'app', 'capita', v_tit)
  returning id into v_dett;

  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, stato, eseguita_il)
  values (v_dett, 1, 'promemoria', '{}'::jsonb, true, 'Promemoria: una cosa', 'eseguita', now());
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_dett, 2, 'movimento_cassa', '{}'::jsonb, true, 'Cassa: una cosa',
          'Questa la guardi sempre tu', 'in_attesa');

  -- ------------------------------------------------------------------
  -- (A) Le azioni si leggono NELL'ORDINE in cui sono state dette, e
  --     portano con se' la natura — che e' quello che la schermata usa
  --     per spiegare perche' una aspetta.
  -- ------------------------------------------------------------------
  select count(*) into v_n from azioni_della_dettatura(v_dett);
  if v_n <> 2 then
    raise exception 'Le azioni lette sono % invece di 2', v_n;
  end if;

  select * into v_r from azioni_della_dettatura(v_dett) where progressivo = 1;
  if v_r.stato <> 'eseguita' or v_r.natura <> 'misura' then
    raise exception 'La prima azione si legge storta: stato %, natura %', v_r.stato, v_r.natura;
  end if;
  select * into v_r from azioni_della_dettatura(v_dett) where progressivo = 2;
  if v_r.stato <> 'in_attesa' or v_r.natura <> 'creazione' then
    raise exception 'La seconda azione si legge storta: stato %, natura %', v_r.stato, v_r.natura;
  end if;

  -- ------------------------------------------------------------------
  -- (B) Il contatore della Dashboard vede la cosa che aspetta.
  --     ⚠️ Si misura una DIFFERENZA prodotta apposta, non uno stato:
  --     leggere «una» non direbbe se sta contando la nostra o una
  --     qualunque.
  -- ------------------------------------------------------------------
  select v.quante into v_n from voce_da_guardare() v;
  if v_n < 1 then
    raise exception 'Il contatore non vede la cosa che aspetta: %', v_n;
  end if;

  update azioni_dettate set stato = 'annullata' where dettatura_id = v_dett and progressivo = 2;
  select v.quante into v_n from voce_da_guardare() v;
  if v_n <> 0 then
    raise exception 'Una annullata continua a essere contata fra quelle che aspettano: %', v_n;
  end if;

  -- ------------------------------------------------------------------
  -- Pulizia — per identificativo.
  -- ------------------------------------------------------------------
  delete from dettature where id = v_dett;
  select count(*) into v_n from azioni_dettate where dettatura_id = v_dett;
  if v_n <> 0 then
    raise exception 'Sono rimaste % azioni della verifica', v_n;
  end if;

  select count(*) into v_lapidi_post from deleted_records;
  if v_lapidi_post <> v_lapidi_pre then
    raise exception 'La verifica ha lasciato % lapidi', v_lapidi_post - v_lapidi_pre;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Il riscontro si legge alla fine: le azioni tornano in ordine con la loro natura, e il contatore della Dashboard smette di contare quello che e'' stato annullato.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260826000003', 'quello_che_ha_fatto_si_legge_alla_fine')
on conflict (version) do nothing;
