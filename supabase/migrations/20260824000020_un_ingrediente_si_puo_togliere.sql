-- =====================================================================
-- UN INGREDIENTE SI PUO' TOGLIERE — E IL GESTIONALE DICE COME
-- 24/08/2026 — punto (a) della pila del collaudo
-- =====================================================================
-- 🔴 IL CASO, trovato da Alessio: nella scheda di un ingrediente c'e' solo
-- «Salva modifiche». Nessun modo di eliminarlo, nessuno di disattivarlo.
-- Nella scheda di un fornitore «Disattiva fornitore» esiste gia' — quindi
-- il concetto c'era, e agli ingredienti non era stato dato.
--
-- ⚠️ E LA COLONNA C'ERA GIA' ANCH'ESSA: `ingredients.active` esiste dal
-- primo giorno. **Tutto acceso, e muto** — la stessa forma della soglia di
-- magazzino del 13/08, che era in tabella e non si poteva scrivere da
-- nessuna schermata.
--
-- ---------------------------------------------------------------------
-- LE DUE STRADE, decise da Alessio
-- ---------------------------------------------------------------------
-- · **DISATTIVAZIONE per tutti**: sparisce dagli elenchi dove lo si cerca,
--   ma **resta agganciato** a ricette, carichi, lotti e food cost storici.
--   E' la strada normale, perche' un ingrediente usato una volta ha
--   lasciato tracce che devono continuare a tornare.
-- · **CANCELLAZIONE VERA solo per quelli mai usati da nessuno**: un
--   prodotto nato per sbaglio, o una prova.
-- · **E il gestionale dice in quale dei due casi sei**, invece di
--   lasciarlo indovinare. Un pulsante che a volte funziona e a volte no,
--   senza spiegare, e' peggio di un pulsante che non c'e'.
--
-- ⚠️ TREDICI TABELLE puntano a un ingrediente, e vanno guardate TUTTE:
-- controllarne dodici vuol dire che la tredicesima fa fallire la
-- cancellazione con un errore del database invece che con una frase.
-- L'elenco si costruisce **dal catalogo**, non a mano, cosi' una tabella
-- nuova entra da sola nel controllo — la stessa forma delle reti che
-- questo progetto usa per i permessi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Dove è usato questo ingrediente
-- ---------------------------------------------------------------------
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

  -- ⚠️ L'elenco viene dal CATALOGO: ogni tabella che ha una chiave
  -- esterna verso `ingredients` entra da sola. Scrivendolo a mano, la
  -- prossima tabella che nasce resterebbe fuori in silenzio — ed e' il
  -- caso peggiore, perche' la cancellazione fallirebbe con un errore
  -- tecnico invece che con una frase leggibile.
  for r in
    select c.conrelid::regclass::text as tabella, a.attname as colonna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'ingredients'::regclass
       and c.conrelid <> 'ingredients'::regclass
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
  'In quali tabelle questo ingrediente compare, e quante volte. Serve a dire ad Alessio se puo'' cancellarlo davvero o se puo'' solo metterlo da parte. ⚠️ L''elenco delle tabelle si costruisce dal catalogo: una tabella nuova che punti agli ingredienti entra da sola nel controllo.';

revoke all on function usi_dell_ingrediente(uuid) from public, anon;
grant execute on function usi_dell_ingrediente(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2 · Metterlo da parte, o toglierlo del tutto
-- ---------------------------------------------------------------------
create or replace function metti_da_parte_ingrediente(p_id uuid, p_attivo boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' togliere un ingrediente dagli elenchi.';
  end if;

  update ingredients set active = p_attivo where id = p_id
  returning name into v_nome;
  if v_nome is null then
    raise exception 'Questo ingrediente non esiste piu''.';
  end if;

  return jsonb_build_object('nome', v_nome, 'attivo', p_attivo);
end $$;

comment on function metti_da_parte_ingrediente(uuid, boolean) is
  'Toglie un ingrediente dagli elenchi dove lo si cerca, senza staccarlo da niente: ricette, carichi, lotti e food cost storici continuano a nominarlo. E'' la strada normale — quella che non perde niente.';

revoke all on function metti_da_parte_ingrediente(uuid, boolean) from public, anon;
grant execute on function metti_da_parte_ingrediente(uuid, boolean) to authenticated;

-- ⚠️ LA CANCELLAZIONE PASSA DAL CORRIDOIO anche se tocca una tabella
-- sola: il controllo sta nella funzione, ed e' la forma che rende
-- l'elenco delle cancellazioni controllabile (regola del 16/08, gia' in
-- uso per `elimina_nota_credito` e `delete_anticipazione`).
create or replace function elimina_ingrediente(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome  text;
  v_usi   text;
  v_righe integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' cancellare un ingrediente.';
  end if;

  select name into v_nome from ingredients where id = p_id;
  if v_nome is null then
    raise exception 'Questo ingrediente non esiste piu''.';
  end if;

  -- ⚠️ IL RIFIUTO NOMINA TUTTI I POSTI, non il primo che trova: dirne uno
  -- per volta fa scoprire il secondo dopo aver risolto il primo, e alla
  -- terza si smette di leggere (regola del 16/08).
  select string_agg(format('%s (%s)', nome_leggibile(dove), quante), ', ' order by dove)
    into v_usi
    from usi_dell_ingrediente(p_id);

  if v_usi is not null then
    raise exception
      '«%» non si puo'' cancellare: compare in %. Puoi metterlo da parte — sparisce dagli elenchi e resta agganciato a tutto quello che l''ha usato.',
      v_nome, v_usi
      using errcode = 'P0001';
  end if;

  delete from ingredients where id = p_id;
  get diagnostics v_righe = row_count;

  return jsonb_build_object('nome', v_nome, 'cancellati', v_righe);
end $$;

comment on function elimina_ingrediente(uuid) is
  'Cancella un ingrediente **solo se non e'' mai stato usato da nessuno**. Altrimenti rifiuta nominando tutti i posti dove compare, e indica la via d''uscita: metterlo da parte. ⚠️ Un ingrediente usato non si cancella nemmeno volendo — le sue tracce nei food cost storici e nei registri devono continuare a tornare.';

revoke all on function elimina_ingrediente(uuid) from public, anon;
grant execute on function elimina_ingrediente(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · I nomi delle tabelle, in italiano
-- ---------------------------------------------------------------------
-- ⚠️ Senza questo, il rifiuto direbbe «compare in recipe_ingredients» —
-- che per chi sta davanti alla schermata non e' un'informazione, e' una
-- sigla. E' la stessa ragione per cui i vincoli hanno il loro commento.
create or replace function nome_leggibile(p_tabella text)
returns text
language sql
immutable
as $$
  select case p_tabella
    when 'recipe_ingredients'     then 'ricette'
    when 'stock_lots'             then 'partite in magazzino'
    when 'stock_consumptions'     then 'scarichi di magazzino'
    when 'price_history'          then 'storico prezzi'
    when 'articoli_fornitore'     then 'diciture dei fornitori'
    when 'shopping_list_items'    then 'lista della spesa'
    when 'ordini_fornitore_righe' then 'ordini ai fornitori'
    when 'produzioni'             then 'produzioni'
    when 'anomalie_scarico'       then 'anomalie di scarico'
    when 'rettifiche_giacenza'    then 'rettifiche di giacenza'
    when 'crops'                  then 'colture dell''orto'
    when 'foraged_items'          then 'raccolta propria'
    when 'intercompany_cessions'  then 'cessioni fra le due societa'''
    else p_tabella
  end
$$;

comment on function nome_leggibile(text) is
  'Il nome in italiano di una tabella, per i messaggi che legge chi lavora. ⚠️ Se una tabella non e'' in elenco torna il suo nome tecnico: si vede, e si aggiunge — meglio una sigla in un messaggio che un messaggio che non compare.';

revoke all on function nome_leggibile(text) from public, anon;
grant execute on function nome_leggibile(text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_entita   uuid;
  v_libero   uuid;
  v_usato    uuid;
  v_ricetta  uuid;
  v_respinto boolean;
  v_esito    jsonb;
  v_quanti   integer;
  v_lapidi   integer;
  v_lapidi2  integer;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select id into v_entita from entities limit 1;
  if v_titolare is null or v_entita is null then
    raise exception 'Manca un titolare o un''entita'': impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) L'elenco delle tabelle si costruisce dal catalogo: devono essere
  --     tutte quelle che puntano agli ingredienti.
  select count(*) into v_quanti
    from pg_constraint c
   where c.contype = 'f' and c.confrelid = 'ingredients'::regclass
     and c.conrelid <> 'ingredients'::regclass;
  if v_quanti < 10 then
    raise exception 'Solo % tabelle puntano agli ingredienti: il catalogo non risponde.', v_quanti;
  end if;

  -- (b) Un ingrediente MAI USATO si cancella davvero.
  insert into ingredients (entity_id, name, unit, category)
  values (v_entita, 'verifica-libero-20260824', 'kg', 'altro')
  returning id into v_libero;

  if exists (select 1 from usi_dell_ingrediente(v_libero)) then
    raise exception 'Un ingrediente appena creato risulta gia'' usato.';
  end if;

  v_esito := elimina_ingrediente(v_libero);
  if (v_esito->>'cancellati')::int <> 1 then
    raise exception 'L''ingrediente libero non e'' stato cancellato: %.', v_esito;
  end if;

  -- (c) 🔴 UNO USATO VIENE RESPINTO, e il rifiuto NOMINA DOVE.
  insert into ingredients (entity_id, name, unit, category)
  values (v_entita, 'verifica-usato-20260824', 'kg', 'altro')
  returning id into v_usato;
  insert into recipes (name, category, recipe_type)
  values ('verifica-ricetta-20260824', 'antipasto', 'piatto_finito')
  returning id into v_ricetta;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  values (v_ricetta, v_usato, 1, 'kg');

  select count(*) into v_quanti from usi_dell_ingrediente(v_usato);
  if v_quanti <> 1 then
    raise exception 'Gli usi dell''ingrediente sono % invece di 1.', v_quanti;
  end if;

  v_respinto := false;
  begin
    perform elimina_ingrediente(v_usato);
  exception when sqlstate 'P0001' then
    v_respinto := true;
    -- ⚠️ Il messaggio dev'essere in ITALIANO e nominare il posto: un
    --     rifiuto che dice «recipe_ingredients» non e'' un rifiuto, e'' una
    --     sigla.
    if sqlerrm not like '%ricette%' then
      raise exception 'Il rifiuto non nomina le ricette: «%».', sqlerrm;
    end if;
    if sqlerrm not like '%metterlo da parte%' then
      raise exception 'Il rifiuto non indica la via d''uscita: «%».', sqlerrm;
    end if;
  end;
  if not v_respinto then
    raise exception 'Un ingrediente usato in una ricetta e'' stato cancellato.';
  end if;

  -- (d) ⚠️ E LA VIA D'USCITA FUNZIONA DAVVERO: metterlo da parte riesce,
  --     e non stacca niente.
  v_esito := metti_da_parte_ingrediente(v_usato, false);
  if (v_esito->>'attivo')::boolean then
    raise exception 'L''ingrediente non e'' stato messo da parte.';
  end if;
  if not exists (select 1 from recipe_ingredients where ingredient_id = v_usato) then
    raise exception 'Mettere da parte ha staccato l''ingrediente dalla ricetta.';
  end if;

  -- E si rimette in elenco.
  perform metti_da_parte_ingrediente(v_usato, true);
  if not (select active from ingredients where id = v_usato) then
    raise exception 'L''ingrediente non e'' tornato negli elenchi.';
  end if;

  -- (e) Si toglie quello che ha creato lei, per identificativo.
  delete from recipe_ingredients where recipe_id = v_ricetta;
  delete from recipes where id = v_ricetta;
  delete from ingredients where id = v_usato;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Un ingrediente mai usato si cancella, uno usato si mette da parte, e il rifiuto dice dove.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000020', 'un_ingrediente_si_puo_togliere') on conflict (version) do nothing;
