-- =====================================================================
-- LA SEZIONE DEL MENU SEGUE IL PIATTO — coda della 20260824000025
-- 24/08/2026
-- =====================================================================
-- 🔴 DIFETTO MIO, TROVATO APRENDO LE COMANDE e non rileggendo: dopo aver
-- portato i piatti composti di finger nella categoria «finger food», in
-- sala continuavano a comparire sotto «Antipasto». La causa è che
-- `menu_items` porta una PROPRIA `category`, e la sanatoria della
-- 20260824000025 aveva cambiato solo quella della ricetta.
--
-- ⚠️ E QUELLA COPIA NON È UN DOPPIONE DA TOGLIERE, misurato prima di
-- decidere: `menu_items.category` dice **in quale sezione del menu
-- stampato compare quel piatto**, e può legittimamente differire dalla
-- categoria della ricetta — un antipasto servito come primo in un menu
-- degustazione è una cosa che si fa. Col discriminante del 17/08 le due
-- colonne NON dicono esattamente la stessa cosa, quindi restano due.
--
-- 🔴 MA LA MISURA DICE CHE QUI IL DISALLINEAMENTO L'HO CREATO IO: su
-- **36** voci di menu, quelle con la categoria diversa dalla ricetta sono
-- **4**, e sono esattamente le 4 che la sanatoria di stanotte ha spostato.
-- Prima di quella migrazione la copia seguiva sempre la ricetta. Non è
-- una scelta di Alessio che si sta scavalcando: è un effetto collaterale
-- che si chiude.
--
-- ⚠️ QUELLO CHE RESTA A LUI, ed è scritto perché non si perda: se su un
-- menu stampato vuole «Selezione dolce» stampata fra i **dolci** invece
-- che fra i finger food, la sposta dall'Editor Menu — la colonna esiste
-- apposta. Questa migrazione rimette la copia in pari con la ricetta, non
-- decide dove vanno stampati i suoi piatti.
--
-- ⚠️ E NON DIVENTA UNA REGOLA PERMANENTE: nessun trigger tiene le due
-- colonne incollate, perché incollarle vorrebbe dire togliere la
-- possibilità di stampare un piatto sotto un'altra sezione — cioè
-- distruggere il motivo per cui la seconda colonna esiste.
-- =====================================================================

do $sanatoria$
declare v_quante integer;
begin
  update menu_items mi
     set category = r.category
    from recipes r
   where r.id = mi.recipe_id
     and r.category = 'finger_food'
     and mi.category <> 'finger_food';
  get diagnostics v_quante = row_count;
  raise notice 'Voci di menu portate nella sezione «finger food»: %.', v_quante;
end $sanatoria$;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_lapidi   integer;
  v_lapidi2  integer;
  v_fuori    integer;
  v_altre    integer;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) Nessun piatto di finger food resta stampato in un'altra sezione.
  select count(*) into v_fuori
    from menu_items mi join recipes r on r.id = mi.recipe_id
   where r.category = 'finger_food' and mi.category <> 'finger_food';
  if v_fuori > 0 then
    raise exception '% voci di finger food sono ancora in un''altra sezione.', v_fuori;
  end if;

  -- (b) ⚠️ LA CONTROPROVA CHE DISCRIMINA, e qui è la parte che conta: la
  --     sanatoria NON deve aver toccato le voci di altre categorie. Senza
  --     questo controllo, un `update` scritto largo — senza il filtro sulla
  --     categoria della ricetta — allineerebbe TUTTE le 36 voci, e la (a)
  --     passerebbe lo stesso: sarebbe una schermata dove nessun piatto può
  --     più essere stampato fuori dalla sua categoria, e nessuno se ne
  --     accorgerebbe finché non prova a farlo.
  select count(*) into v_altre
    from menu_items mi join recipes r on r.id = mi.recipe_id
   where r.category <> 'finger_food' and mi.category <> r.category;
  raise notice 'Voci lasciate volutamente in una sezione diversa dalla ricetta: %.', v_altre;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Ogni piatto di finger food e'' stampato nella sua sezione.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000027', 'la_sezione_segue_il_piatto') on conflict (version) do nothing;
