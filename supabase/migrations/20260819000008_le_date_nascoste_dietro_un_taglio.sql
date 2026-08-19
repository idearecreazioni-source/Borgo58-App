-- =====================================================================
-- LE DATE NASCOSTE DIETRO UN TAGLIO — e la rete che adesso le vede
-- 19/08/2026
-- =====================================================================
-- 🔴 IL DIFETTO, misurato e non dedotto. La consegna delle 05:00
-- (`20260819000006`) ha tolto `current_date` da tutte le funzioni, e la
-- rete `funzioni_con_data_utc()` sorveglia che non torni. Ma `current_date`
-- non e' l'unico modo di chiedere che giorno e' a Greenwich: **tagliare a
-- data un istante gia' memorizzato** (`created_at::date`) fa esattamente la
-- stessa cosa, perche' il database vive a Greenwich e fra mezzanotte e le
-- due dice ieri.
--
-- 🔴 E `scarichi_senza_ricavo` era rimasta CURATA A META', che e' un modo
-- nuovo di sbagliare: gli estremi del periodo arrivano da `oggi_a_roma()`
-- (ora italiana) e la riga si confronta con `sc.created_at::date`
-- (Greenwich). Prima era sbagliata ma coerente; cosi' uno spreco registrato
-- dopo mezzanotte il primo del mese **sparisce da tutti e due i mesi** —
-- non compare in quello vecchio perche' gli estremi sono nuovi, non compare
-- in quello nuovo perche' la sua data e' vecchia. Un numero che manca senza
-- che nessuna riga risulti fuori posto.
--
-- I tre punti rimasti, misurati sul progetto di prova dopo `…006`:
--   · `scarichi_senza_ricavo`  — `sc.created_at::date`   (costi)
--   · `quadratura_pagamenti`   — `v_inv.paid_at::date`, tre volte (soldi)
--   · `agenda_corsie`          — `t.created_at::date`    (anzianita')
-- Tre erano gia' state curate da `…006` (`conti_da_fiscalizzare`,
-- `quadratura_fiscale`, `pos_in_transito`): li' il taglio nudo era sparito
-- da solo, perche' quelle funzioni sono state riscritte.
--
-- ⚠️ NESSUNA DI QUESTE CAMBIA REGOLA: restano tutte e tre di **calendario**
-- (che giorno e', non che serata e'). Cambia il fuso con cui il calendario
-- viene letto. Il perimetro della serata resta quello deciso da Alessio il
-- 19/08 — il conto incassato dopo mezzanotte e il conteggio del cassetto —
-- e questa migrazione non lo allarga di un punto.
--
-- ⚠️ I CORPI SONO RIPRESI DAL DATABASE VIVO (`npm run funzione:viva`,
-- regola del 18/08), non dai file che le hanno create: fra i due ci stanno
-- tutte le migrazioni che le hanno toccate dopo.
--
-- ⚠️ `completa_task` NON e' in elenco, ed e' il falso positivo da non
-- prendere: il suo `end::date` taglia un `date + interval`, che non ha
-- fuso. La rete non lo segnala perche' guarda i tagli applicati a una
-- colonna con l'ora dentro, non tutti i tagli.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Gli scarichi senza ricavo — la meta' che era rimasta a Greenwich
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scarichi_senza_ricavo(p_entity_id uuid, p_dal date DEFAULT NULL::date, p_al date DEFAULT NULL::date)
 RETURNS TABLE(motivo text, quante integer, costo numeric, senza_costo integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'I costi sono riservati al titolare.';
  end if;

  return query
  select sc.reason,
         count(*)::integer,
         coalesce(sum(sc.costo), 0),
         -- ⚠️ Le righe senza costo si contano invece di essere sommate a
         -- zero: uno scarico registrato prima del 16/08 non ha il costo, e
         -- uno zero al posto suo direbbe «non e' costato niente».
         count(*) filter (where sc.costo is null)::integer
    from stock_consumptions sc
   where sc.order_id is null
     and sc.produzione_id is null
     -- ⚠️ IL GIORNO DELLO SCARICO SI LEGGE IN ORA ITALIANA, come i due
     -- estremi qui sopra. Con il taglio nudo gli estremi erano di Roma e la
     -- riga di Greenwich: uno spreco delle 00:30 del primo del mese non
     -- compariva ne' nel mese vecchio ne' in quello nuovo.
     and (sc.created_at at time zone 'Europe/Rome')::date between v_dal and v_al
     and exists (select 1 from ingredients i
                  where i.id = sc.ingredient_id and i.entity_id = p_entity_id)
   group by sc.reason
   order by coalesce(sum(sc.costo), 0) desc;
end;
$function$;


-- ---------------------------------------------------------------------
-- 2 · La quadratura dei pagamenti — tre tagli, e sono soldi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quadratura_pagamenti(p_dal date DEFAULT NULL::date, p_al date DEFAULT NULL::date)
 RETURNS TABLE(genere text, quando date, importo numeric, descrizione text, perche text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere la quadratura dei pagamenti';
  end if;

  return query
  -- ⚠️ `paid_at` e' un ISTANTE, non una data: tagliarlo senza fuso lo
  -- data a Greenwich. Una fattura pagata alle 00:30 risultava pagata il
  -- giorno prima — e questa e' la schermata in cui si va a cercare
  -- perche' i conti non tornano.
  select 'fattura_senza_movimento'::text,
         (v_inv.paid_at at time zone 'Europe/Rome')::date,
         v_inv.amount,
         'Fattura ' || coalesce(v_inv.invoice_number, '(senza numero)')
           || coalesce(' — ' || s.name, ''),
         'Risulta pagata, ma in prima nota non c''e'' nessuna uscita collegata.'
    from supplier_invoices v_inv
    left join suppliers s on s.id = v_inv.supplier_id
   where v_inv.status = 'pagata'
     and da_pagare(v_inv) > 0
     and not exists (select 1 from cash_movements m where m.supplier_invoice_id = v_inv.id)
     and (p_dal is null or (v_inv.paid_at at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (v_inv.paid_at at time zone 'Europe/Rome')::date <= p_al)

  union all

  select 'movimento_senza_fattura'::text,
         m.movement_date,
         m.amount,
         coalesce(nullif(m.business_purpose, ''), 'Uscita senza descrizione'),
         'Uscita con documento «fattura» che non risulta collegata a nessuna fattura registrata.'
    from cash_movements m
   where m.direction = 'uscita'
     and m.tipo_documento = 'fattura'
     and m.supplier_invoice_id is null
     and (p_dal is null or m.movement_date >= p_dal)
     and (p_al  is null or m.movement_date <= p_al)

  order by 2 desc nulls last;
end
$function$;


-- ---------------------------------------------------------------------
-- 3 · L'anzianita' in Agenda — «da quanti giorni e' in lista»
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agenda_corsie()
 RETURNS TABLE(id uuid, title text, description text, due_date date, due_time time without time zone, category text, origine_modulo text, preferito boolean, ricorrenza text, status text, visibile_staff boolean, corsia text, giorni_in_lista integer, giorni_alla_scadenza integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_oggi date := oggi_a_roma();
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  select t.id, t.title, t.description, t.due_date, t.due_time,
         t.category, t.origine_modulo, t.preferito, t.ricorrenza,
         t.status::text, t.visibile_staff,
         case
           when t.due_date is null              then 'quando_capita'
           when t.due_date < v_oggi             then 'in_ritardo'
           -- «Questa settimana» vuol dire da oggi a sette giorni, non
           -- fino a domenica: il lunedi' l'orizzonte non deve accorciarsi
           -- a un giorno solo.
           when t.due_date <= v_oggi + 7        then 'questa_settimana'
           else 'piu_avanti'
         end,
         -- ⚠️ Le due date del sottrarre devono stare nello STESSO fuso: con
         -- `v_oggi` di Roma e `created_at` di Greenwich, un impegno scritto
         -- dopo mezzanotte nasceva gia' vecchio di un giorno. In «quando
         -- capita» l'anzianita' e' l'unica cosa che si guarda.
         (v_oggi - (t.created_at at time zone 'Europe/Rome')::date)::integer,
         case when t.due_date is not null then (t.due_date - v_oggi)::integer end
    from tasks t
   where t.status <> 'completato'
     -- La RLS su `tasks` distingue gia' cosa vede lo staff; qui si gira
     -- come proprietario, quindi il filtro va rimesso a mano.
     and (is_titolare() or t.visibile_staff)
   order by
     case
       when t.due_date is null then 3
       when t.due_date < v_oggi then 0
       when t.due_date <= v_oggi + 7 then 1
       else 2
     end,
     t.preferito desc,
     t.due_date asc nulls last,
     t.due_time asc nulls last,
     t.created_at asc;
end;
$function$;


-- ---------------------------------------------------------------------
-- 4 · La rete, allargata a cio' che non sapeva vedere
-- ---------------------------------------------------------------------
-- ⚠️ PERCHE' VA ALLARGATA E NON AFFIANCATA. Una seconda rete accanto alla
-- prima darebbe due elenchi da guardare, e il giorno che se ne guarda uno
-- solo la porta aperta e' l'altra. La rete resta una, e adesso riconosce
-- tre modi di chiedere la data a Greenwich:
--   1. `current_date`
--   2. `now()::date`  — la stessa cosa scritta piu' lunga
--   3. `<colonna con l'ora dentro>::date` — il taglio nudo di questa consegna
--
-- ⚠️ L'ELENCO DELLE COLONNE SE LO COSTRUISCE DAL CATALOGO, non e' scritto a
-- mano: una tabella nuova con un `created_at` entra nella sorveglianza da
-- sola. E' la stessa forma di `vocabolari_chiusi()` (17/08) —
-- *gli elenchi si costruiscono dai cataloghi, mai a mano*.
--
-- ⚠️ E LA FORMA CURATA NON VIENE SEGNALATA, per costruzione: in
-- `(x.created_at at time zone 'Europe/Rome')::date` il taglio non tocca la
-- colonna — fra le due cose c'e' il fuso. La rete cerca il taglio
-- **attaccato** al nome della colonna, quindi vede solo quello nudo.
--
-- ⚠️ LA RETE NON PUO' GUARDARE SE STESSA, e va detto invece che scoperto:
-- contiene le parole che cerca. E' la stessa forma della sentinella dei
-- lavori — un testimone non testimonia della propria assenza (12/08).
--
-- Il tipo del risultato cambia (arriva `perche`), quindi va tolta e
-- rifatta: `create or replace` non puo' cambiare la forma del risultato.
drop function if exists funzioni_con_data_utc();

-- ⚠️ E ANCHE QUESTA HA IL PORTIERE, per la ragione trovata accendendo la
-- rete di `20260819000007`: le tre diagnostiche che raccontano com'e' fatto
-- il database — questa, `funzioni_senza_portiere` e `funzioni_multi_tabella`
-- — erano eseguibili da chiunque avesse fatto il login. Non e' roba da
-- sala, ed e' la stessa forma che `funzioni_aperte_ad_anon` ha dal 13/08.
create or replace function funzioni_con_data_utc()
returns table (nome text, perche text)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  with colonne as (
    select distinct c.column_name::text as col
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.data_type = 'timestamp with time zone'
  ),
  corpi as (
    select p.proname::text as nome,
           -- I commenti si tolgono prima di guardare: nel censimento del
           -- 19/08 uno dei diciotto punti era la parola «current_date»
           -- dentro un commento, e un guardiano che grida a vuoto viene
           -- spento.
           regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g') as corpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and p.proname <> 'funzioni_con_data_utc'
  )
  select x.nome, string_agg(distinct x.perche, ' · ') from (
    select c0.nome, 'usa current_date'::text as perche
      from corpi c0 where c0.corpo ilike '%current_date%'
    union all
    select c1.nome, 'usa now()::date senza fuso'
      from corpi c1 where c1.corpo ~* 'now\(\)\s*::\s*date'
    union all
    select c2.nome, 'taglia a data ' || co.col || ' senza fuso'
      from corpi c2 join colonne co
        on c2.corpo ~* ('(^|[^a-z_0-9])([a-z_0-9]+\.)?' || co.col || '\s*::\s*date')
  ) x
  group by x.nome
  order by x.nome;
end;
$function$;

comment on function funzioni_con_data_utc() is
  'Chi decide ancora una data sull''orario di Greenwich: current_date, now()::date, o il taglio nudo di una colonna con l''ora dentro. L''elenco si costruisce dal catalogo a ogni esecuzione.';

revoke all on function funzioni_con_data_utc() from public, anon;
grant execute on function funzioni_con_data_utc() to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_ingr   uuid;
  v_forn   uuid;
  v_inv    uuid;
  v_r      date;
  v_ist    timestamptz;
  v_n      integer;
  v_prima     integer;
  v_prima_utc integer;
  v_lap_p  integer;
  v_lap_d  integer;
  v_nomi   text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  select id into v_ente from entities order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select count(*) into v_lap_p from deleted_records;

  v_r := oggi_a_roma();
  -- L'ISTANTE CHE DISCRIMINA, e non e' un istante qualunque: le 00:30
  -- italiane di due giorni fa sono le 22:30 di Greenwich di TRE giorni fa.
  -- Letto col fuso giusto dista 2 giorni, letto a Greenwich ne dista 3.
  v_ist := ((v_r - 2)::timestamp + interval '30 minutes') at time zone 'Europe/Rome';
  if (v_ist at time zone 'Europe/Rome')::date = (v_ist at time zone 'UTC')::date then
    raise exception 'L''istante scelto non discrimina i due fusi: la verifica non proverebbe niente.';
  end if;

  -- =========== 1 · GLI SCARICHI ===========
  -- ⚠️ L'ingrediente se lo crea la prova (lezione del 16/08): riusarne uno
  -- vero significherebbe lasciargli addosso qualcosa.
  --
  -- ⚠️ E SI MISURA UNA DIFFERENZA, non un totale. `scarichi_senza_ricavo`
  -- raggruppa per motivo e non dice di quale ingrediente parla: contare le
  -- righe che tornano significherebbe contare anche quelle di altri. Sul
  -- progetto di prova ce ne sono davvero, e la prima stesura di questa
  -- verifica leggeva 2 invece di 1 — sarebbe stata rossa per un residuo
  -- altrui invece che per il difetto.
  insert into ingredients (entity_id, name, category, unit)
    values (v_ente, '__VERIFICA__ fuso', 'altro', 'kg')
    returning id into v_ingr;

  select coalesce(sum(s.quante), 0) into v_prima
    from scarichi_senza_ricavo(v_ente, (v_r - 2), (v_r - 2)) s;
  select coalesce(sum(s.quante), 0) into v_prima_utc
    from scarichi_senza_ricavo(v_ente, (v_r - 3), (v_r - 3)) s;

  insert into stock_consumptions (ingredient_id, quantity, reason, costo, created_at)
    values (v_ingr, 1, 'spreco', 3.00, v_ist);

  -- Nel giorno di ROMA lo scarico compare: una riga in piu' di prima.
  select coalesce(sum(s.quante), 0) into v_n
    from scarichi_senza_ricavo(v_ente, (v_r - 2), (v_r - 2)) s;
  if v_n - v_prima <> 1 then
    raise exception 'Lo scarico delle 00:30 non compare nel suo giorno italiano (differenza: %).', v_n - v_prima;
  end if;
  -- ...e nel giorno di GREENWICH non compare: zero in piu'. Senza questa
  -- seconda meta' la prova passerebbe anche con la funzione vecchia,
  -- perche' un intervallo largo prende tutti e due i giorni.
  select coalesce(sum(s.quante), 0) into v_n
    from scarichi_senza_ricavo(v_ente, (v_r - 3), (v_r - 3)) s;
  if v_n - v_prima_utc <> 0 then
    raise exception 'Lo scarico compare ancora nel giorno di Greenwich (differenza: %).', v_n - v_prima_utc;
  end if;

  -- =========== 2 · LA QUADRATURA DEI PAGAMENTI ===========
  insert into suppliers (entity_id, name) values (v_ente, '__VERIFICA__ fuso')
    returning id into v_forn;
  insert into supplier_invoices
      (entity_id, supplier_id, invoice_number, invoice_date, amount, status, paid_at)
    values (v_ente, v_forn, '__VERIFICA__ fuso', v_r - 3, 137.53, 'pagata', v_ist)
    returning id into v_inv;

  select count(*) into v_n from quadratura_pagamenti((v_r - 2), (v_r - 2)) q
   where q.genere = 'fattura_senza_movimento' and q.descrizione like '%__VERIFICA__ fuso%';
  if v_n <> 1 then
    raise exception 'La fattura pagata alle 00:30 non risulta pagata nel suo giorno italiano (righe: %).', v_n;
  end if;
  select count(*) into v_n from quadratura_pagamenti((v_r - 3), (v_r - 3)) q
   where q.genere = 'fattura_senza_movimento' and q.descrizione like '%__VERIFICA__ fuso%';
  if v_n <> 0 then
    raise exception 'La fattura risulta ancora pagata nel giorno di Greenwich (righe: %).', v_n;
  end if;

  -- =========== 3 · L'ANZIANITA' IN AGENDA ===========
  insert into tasks (title, status, visibile_staff, created_at)
    values ('__VERIFICA__ fuso', 'da_fare', false, v_ist);
  select a.giorni_in_lista into v_n from agenda_corsie() a where a.title = '__VERIFICA__ fuso';
  if v_n is distinct from 2 then
    raise exception 'L''anzianita'' dell''impegno e'' % giorni invece di 2: si sta ancora leggendo Greenwich.', v_n;
  end if;

  -- =========== 4 · LA RETE VEDE, E LA SI ROMPE PER SAPERLO ===========
  -- Prima: non deve restare nessuno.
  select count(*), string_agg(f.nome || ' (' || f.perche || ')', ', ')
    into v_n, v_nomi from funzioni_con_data_utc() f;
  if v_n <> 0 then
    raise exception 'Restano % funzioni che decidono la data a Greenwich: %.', v_n, v_nomi;
  end if;

  -- Poi: si rompe apposta, una forma per volta. Una rete che non si vede
  -- diventare rossa non e' provata (regola del 18/08).
  execute 'create or replace function _prova_data_1() returns date language sql as $x$ select current_date; $x$';
  execute 'create or replace function _prova_data_2() returns date language sql as $x$ select now()::date; $x$';
  execute 'create or replace function _prova_data_3() returns integer language sql as '
       || '$x$ select count(*)::integer from tasks t where t.created_at::date = date ''2020-01-01''; $x$';
  select count(*) into v_n from funzioni_con_data_utc() f
   where f.nome in ('_prova_data_1', '_prova_data_2', '_prova_data_3');
  if v_n <> 3 then
    raise exception 'La rete vede solo % delle 3 rotture: le altre passerebbero.', v_n;
  end if;
  -- E la forma CURATA non deve essere segnalata, altrimenti la rete grida
  -- su chi ha fatto la cosa giusta e la prima cosa che si fa e' spegnerla.
  execute 'create or replace function _prova_data_4() returns integer language sql as '
       || '$x$ select count(*)::integer from tasks t '
       || 'where (t.created_at at time zone ''Europe/Rome'')::date = date ''2020-01-01''; $x$';
  if exists (select 1 from funzioni_con_data_utc() f where f.nome = '_prova_data_4') then
    raise exception 'La rete segnala anche la forma curata: darebbe allarmi falsi permanenti.';
  end if;

  execute 'drop function _prova_data_1()';
  execute 'drop function _prova_data_2()';
  execute 'drop function _prova_data_3()';
  execute 'drop function _prova_data_4()';

  -- =========== PULIZIA, e il guardiano delle lapidi ===========
  delete from tasks where title = '__VERIFICA__ fuso';
  delete from stock_consumptions where ingredient_id = v_ingr;
  delete from ingredients where id = v_ingr;
  delete from supplier_invoices where id = v_inv;
  delete from suppliers where id = v_forn;
  delete from deleted_records where record::text like '%__VERIFICA__ fuso%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  select count(*) into v_n from funzioni_con_data_utc() f;
  if v_n <> 0 then
    raise exception 'La verifica ha lasciato % funzioni finte in giro.', v_n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Le date nascoste dietro un taglio sono chiuse, e la rete adesso le vede.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000008', 'le_date_nascoste_dietro_un_taglio')
on conflict (version) do nothing;
