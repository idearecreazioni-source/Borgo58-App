-- =====================================================================
-- LO STORICO PREZZI NON E' UN USO
-- 24/08/2026 — coda della 20260824000020, aggiunta e non riscritta
-- =====================================================================
-- 🔴 TROVATO DALLA PROVA SUI DATI VERI, non rileggendo: creare un
-- ingrediente **scrive subito una riga nello storico prezzi**. Quindi
-- `usi_dell_ingrediente()` ne trovava sempre almeno uno, e
-- `elimina_ingrediente()` rifiutava **qualunque** ingrediente — compreso
-- uno appena nato per sbaglio.
--
-- ⚠️ Cioe' la strada che Alessio aveva chiesto — «cancellazione vera solo
-- per quelli mai usati da nessuno» — non esisteva in pratica: c'era il
-- pulsante, e non funzionava mai. **Peggio di non averlo**, perche' la
-- schermata prometteva una cosa che il database rifiutava sempre.
--
-- ⚠️ E la verifica dentro la migrazione NON poteva prenderlo: li'
-- l'ingrediente si crea con un `insert` diretto, senza prezzo, quindi lo
-- storico resta vuoto. **Il difetto vive nel tratto fra la schermata e il
-- database** — che e' esattamente il tratto che solo una prova dal client
-- esercita (§8, 16/08).
--
-- ---------------------------------------------------------------------
-- LA REGOLA, e la dice lo SCHEMA invece di un elenco scritto a mano
-- ---------------------------------------------------------------------
-- Delle tredici tabelle che puntano a un ingrediente, due lo seguono
-- nella tomba (`on delete cascade`): `price_history` e
-- `articoli_fornitore`. Non sono usi — sono **appendici**: lo storico dei
-- suoi prezzi e i nomi con cui lo chiamano i fornitori esistono solo
-- perche' esiste lui, e senza di lui non dicono niente.
--
-- Le altre undici sono usi veri: una ricetta che lo contiene, una partita
-- in cella, uno scarico, una produzione, una riga di lista della spesa.
--
-- ⚠️ E LA DISTINZIONE NON SI SCRIVE A MANO: si legge da `confdeltype`.
-- Cosi' una tabella nuova entra da sola nella categoria giusta, e il
-- giorno che qualcuno cambia la regola di cancellazione di una di queste
-- il controllo lo segue senza che nessuno se ne ricordi.
--
-- ⚠️ IL CONTROLLO E' PIU' STRETTO DELLO SCHEMA, e la differenza e'
-- dichiarata: sei tabelle hanno `on delete set null` — anomalie di
-- scarico, colture, raccolta propria, cessioni, ordini, lista della spesa
-- — quindi il database **permetterebbe** di cancellare l'ingrediente
-- lasciando quelle righe senza. Qui si rifiuta lo stesso: un'anomalia di
-- scarico che non dice piu' quale prodotto e' una riga che non significa
-- niente. E' la stessa forma del difetto chiuso il 16/08, dove lo schema
-- scollegava invece di rifiutare — li' si corresse lo schema, qui no,
-- perche' cambiare sei regole di cancellazione e' una decisione a se' che
-- va dichiarata e non fatta di passaggio.
-- =====================================================================

create or replace function usi_dell_ingrediente(p_id uuid)
returns table(dove text, quante bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_n bigint;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  for r in
    select c.conrelid::regclass::text as tabella, a.attname as colonna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'ingredients'::regclass
       and c.conrelid <> 'ingredients'::regclass
       -- ⚠️ Fuori quelle che muoiono con lui: sono appendici, non usi.
       and c.confdeltype <> 'c'
     order by 1
  loop
    execute format('select count(*) from %s where %I = $1', r.tabella, r.colonna)
      into v_n using p_id;
    if v_n > 0 then
      dove := r.tabella;
      quante := v_n;
      return next;
    end if;
  end loop;
end $$;

comment on function usi_dell_ingrediente(uuid) is
  'In quali tabelle questo ingrediente e'' USATO, e quante volte. ⚠️ Non contano lo storico dei suoi prezzi e le diciture dei fornitori: quelle lo seguono nella tomba (`on delete cascade`) e non sono usi — sono appendici che esistono solo perche'' esiste lui. La distinzione si legge dallo SCHEMA, non da un elenco scritto a mano: una tabella nuova entra da sola nella categoria giusta.';

revoke all on function usi_dell_ingrediente(uuid) from public, anon;
grant execute on function usi_dell_ingrediente(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — e stavolta con un PREZZO, che e' il caso che mancava
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_entita   uuid;
  v_ing      uuid;
  v_quanti   integer;
  v_appendici integer;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_esito    jsonb;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_entita from entities limit 1;
  if v_titolare is null or v_entita is null then
    raise exception 'Manca un titolare o un''entita'': impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) Le appendici esistono davvero: se un giorno diventassero
  --     `restrict` questa riga lo direbbe, invece di far tornare il
  --     difetto in silenzio.
  select count(*) into v_appendici
    from pg_constraint c
   where c.contype = 'f' and c.confrelid = 'ingredients'::regclass
     and c.conrelid <> 'ingredients'::regclass and c.confdeltype = 'c';
  if v_appendici < 2 then
    raise exception 'Solo % tabelle seguono l''ingrediente nella tomba: erano 2.', v_appendici;
  end if;

  -- (b) 🔴 IL CASO CHE MANCAVA: un ingrediente CON UN PREZZO, quindi con
  --     una riga di storico. Prima risultava usato e non si cancellava.
  insert into ingredients (entity_id, name, unit, category, current_price)
  values (v_entita, 'verifica-con-prezzo-20260824', 'kg', 'altro', 3.50)
  returning id into v_ing;
  insert into price_history (ingredient_id, price, source)
  values (v_ing, 3.50, 'manuale');

  select count(*) into v_quanti from usi_dell_ingrediente(v_ing);
  if v_quanti <> 0 then
    raise exception 'Un ingrediente col solo storico prezzi risulta usato in % posti.', v_quanti;
  end if;

  v_esito := elimina_ingrediente(v_ing);
  if (v_esito->>'cancellati')::int <> 1 then
    raise exception 'L''ingrediente col solo storico prezzi non e'' stato cancellato: %.', v_esito;
  end if;

  -- ⚠️ E lo storico se n'e' andato con lui: se restasse, sarebbero righe
  --     che nominano un ingrediente che non c'e' piu'.
  if exists (select 1 from price_history where ingredient_id = v_ing) then
    raise exception 'Lo storico prezzi e'' rimasto senza il suo ingrediente.';
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Lo storico prezzi non e'' un uso: un ingrediente mai adoperato si cancella davvero.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000021', 'lo_storico_prezzi_non_e_un_uso') on conflict (version) do nothing;
