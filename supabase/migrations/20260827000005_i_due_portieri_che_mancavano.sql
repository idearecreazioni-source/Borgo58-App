-- ============================================================================
-- I DUE PORTIERI CHE MANCAVANO — 27/08/2026
-- ============================================================================
--
-- 🔴 TROVATI DALLA RETE, NON RILEGGENDO. `tests/app/permessi.test.js` conta le
--    funzioni che scavalcano la RLS senza chiedere chi sei, e stanotte e'
--    diventata rossa da sola: **23 attese, 25 trovate**. Le due nuove sono di
--    questa stessa notte — `caparre_trattenute` e `tipi_vocali_senza_ramo`.
--    E' esattamente il lavoro per cui quella prova esiste.
--
-- ⚠️ NON SI RISCRIVONO LE MIGRAZIONI CHE LE HANNO CREATE (`…002` e `…003`):
--    sono gia' applicate sul progetto di prova, e un file che racconta cosa e'
--    successo quel giorno non si corregge. Si aggiunge.
--
-- ----------------------------------------------------------------------------
-- 🔴 `caparre_trattenute` — UN FILTRO NON E' UN PORTIERE
-- ----------------------------------------------------------------------------
-- Aveva `(select is_titolare())` **dentro la clausola `where`**. Sembra la
-- stessa cosa e non lo e': chi non deve vedere quell'elenco riceveva **un
-- elenco vuoto** invece di un rifiuto — e un elenco vuoto e' una
-- rassicurazione falsa. E' la regola del 13/08, scritta allora per otto
-- funzioni e ricomparsa qui in una forma nuova: non «manca il controllo», ma
-- «il controllo c'e' e risponde nel modo sbagliato».
--
-- ⚠️ E c'era un secondo effetto, misurato: interrogata da `psql` — che gira
--    come `postgres` — rispondeva **zero righe** mentre la schermata mostrava
--    la caparra tenuta. Non era un difetto dei dati: era il filtro che
--    taceva. Con un rifiuto, la stessa interrogazione lo dice.
--
-- ----------------------------------------------------------------------------
-- `tipi_vocali_senza_ramo` — la rete della voce e' del titolare
-- ----------------------------------------------------------------------------
-- Non espone dati di nessuno (sono nomi di tipi di comando), ma l'elenco di
-- chi scavalca la RLS **non deve crescere in silenzio**: e' il motivo per cui
-- quella prova e' stata scritta il 13/08. E i comandi vocali sono del
-- titolare, quindi il portiere e' quello.
-- ============================================================================

create or replace function caparre_trattenute(p_dal date default null, p_al date default null)
returns table (
  movimento_id uuid,
  importo      numeric,
  serata       date,
  tenuta_il    date,
  mezzo        text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- 🔴 UN RIFIUTO, NON UN ELENCO VUOTO. Chi non deve vedere questi importi
  --    deve sapere di non poterli vedere: una risposta vuota si legge «non
  --    ce n'e' nessuna», che e' un'altra cosa e non e' vera.
  if not (select is_titolare()) then
    raise exception 'Le caparre sono un dato del titolare.';
  end if;

  return query
    select m.id, m.amount, m.caparra_evento_il, m.caparra_trattenuta_il, m.mezzo
      from cash_movements m
     where m.caparra_trattenuta_il is not null
       and (p_dal is null or m.caparra_trattenuta_il >= p_dal)
       and (p_al  is null or m.caparra_trattenuta_il <= p_al)
     order by m.caparra_trattenuta_il desc, m.amount desc;
end $$;

comment on function caparre_trattenute(date, date) is
  'Le caparre tenute perche'' il cliente non si e'' presentato, separate dagli incassi del servizio. ⚠️ Senza nomi e senza la ragione scritta a mano: sopravvivono alla pulizia della privacy e continuano a dire DI CHE SERATA erano. Chi non e'' il titolare riceve un RIFIUTO, non un elenco vuoto.';

revoke all on function caparre_trattenute(date, date) from public, anon, authenticated;
grant execute on function caparre_trattenute(date, date) to authenticated;

create or replace function tipi_vocali_senza_ramo()
returns table (tipo text, natura text, titolo text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select is_titolare()) then
    raise exception 'I comandi vocali sono del titolare.';
  end if;

  return query
    select t.tipo, t.natura, t.titolo
      from tipi_azione_vocale t
     where t.attivo
       and position('when ''' || t.tipo || '''' in
             pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure)) = 0
     order by t.tipo;
end $$;

comment on function tipi_vocali_senza_ramo() is
  'I tipi di comando vocale ACCESI che `fai_azione_dettata` non sa eseguire. Deve essere vuota: un tipo acceso senza esecuzione e'' una cosa che il gestionale propone e non fa, e non da'' nessun errore finche'' qualcuno non preme «Si'', fallo».';

revoke all on function tipi_vocali_senza_ramo() from public, anon, authenticated;
grant execute on function tipi_vocali_senza_ramo() to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto jsonb;
  v_tit  uuid;
  v_n    integer;
begin
  v_foto := foto_righe();
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;

  -- (1) SENZA IDENTITA' TUTTE E DUE RIFIUTANO. La migrazione gira come
  --     proprietaria e `is_titolare()` e' falso: e' il caso di chi non deve
  --     vedere, e deve ricevere un rifiuto — non una risposta vuota.
  begin
    perform * from caparre_trattenute();
    raise exception 'Le caparre tenute si leggono senza essere il titolare.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%titolare%' then raise; end if;
  end;

  begin
    perform * from tipi_vocali_senza_ramo();
    raise exception 'La rete dei comandi vocali si legge senza essere il titolare.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%titolare%' then raise; end if;
  end;

  -- (2) COL TITOLARE RISPONDONO, e la rete e' ancora vuota.
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);
  select count(*) into v_n from tipi_vocali_senza_ramo();
  if v_n <> 0 then
    raise exception 'Ci sono % tipi vocali accesi senza esecuzione.', v_n;
  end if;
  perform * from caparre_trattenute();

  -- (3) NESSUNA DELLE DUE E' PIU' FRA QUELLE SENZA PORTIERE.
  --     ⚠️ Si chiede al catalogo, non si crede al fatto di averle riscritte.
  if exists (select 1 from funzioni_senza_portiere()
              where nome in ('caparre_trattenute', 'tipi_vocali_senza_ramo')) then
    raise exception 'Una delle due risulta ancora senza portiere: %',
      (select string_agg(nome, ', ') from funzioni_senza_portiere()
        where nome in ('caparre_trattenute', 'tipi_vocali_senza_ramo'));
  end if;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei due portieri');
  raise notice 'verifica: i due portieri rifiutano chi non e'' il titolare e non compaiono piu'' fra le funzioni scoperte';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000005', 'i_due_portieri_che_mancavano')
on conflict (version) do nothing;
