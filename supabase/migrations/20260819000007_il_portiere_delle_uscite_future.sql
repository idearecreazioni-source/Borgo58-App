-- =====================================================================
-- IL PORTIERE CHE MANCAVA, E LA RETE CHE LO SORVEGLIA
-- 19/08/2026
-- =====================================================================
-- 🔴 IL DIFETTO, misurato in produzione e non dedotto: `uscite_future` e'
-- `security definer` — quindi gira SENZA la RLS — e non controlla chi la
-- chiama. Legge `cash_movements` e restituisce quanto deve uscire, quanto
-- e' gia' uscito oggi e quando cade la prima scadenza. Con l'accesso della
-- sala (uno solo, condiviso) chiunque poteva chiederglielo.
--
-- ⚠️ E si sa che e' una DIMENTICANZA e non una scelta perche' le funzioni
-- che le stanno accanto — `saldo_tesoreria`, `previsione_cassa`,
-- `movimenti_attesi`, `quadratura_pagamenti`, `scarichi_senza_ricavo` — il
-- portiere ce l'hanno tutte, con la stessa forma e quasi le stesse parole.
-- Viene dal 17/08 (`20260817000001`), ed e' la stessa famiglia dei due
-- difetti chiusi il 13/08 con `20260813000012`.
--
-- ⚠️ NON COMPORTA NESSUN CODICE IN PIU' DA DIGITARE: e' lo stesso controllo
-- delle altre, sull'account con cui si e' gia' entrati. La schermata della
-- Cassa e' gia' riservata al titolare (`RequireTitolare` in App.jsx) — ma
-- il permesso vive nel database, non nella schermata, e una schermata
-- chiusa non e' una porta chiusa.
--
-- ⚠️ IL CORPO E' RIPRESO DAL DATABASE (`pg_get_functiondef`, regola del
-- 18/08), non dal file che l'ha creata: cambia soltanto il linguaggio (da
-- `sql` a `plpgsql`, che serve per poter rifiutare) e si aggiunge la
-- guardia. Il calcolo e' identico, riga per riga.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Il portiere
-- ---------------------------------------------------------------------
drop function if exists uscite_future(uuid, date);

create or replace function uscite_future(p_entity_id uuid, p_fino_al date default null)
returns table (
  quante          integer,
  totale          numeric,
  prima_scadenza  date,
  entrate_oggi    integer,
  totale_oggi     numeric,
  quante_oltre    integer,
  totale_oltre    numeric,
  prima_oltre     date
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not is_titolare() then
    raise exception 'Le uscite future sono riservate al titolare.';
  end if;

  return query
  with oggi as (select oggi_a_roma() as d)
  select
    count(*) filter (where m.movement_date > o.d)::integer,
    coalesce(sum(m.amount) filter (where m.movement_date > o.d), 0),
    min(m.movement_date) filter (where m.movement_date > o.d),
    count(*) filter (where m.movement_date = o.d and m.supplier_invoice_id is not null)::integer,
    coalesce(sum(m.amount) filter (where m.movement_date = o.d and m.supplier_invoice_id is not null), 0),
    -- ⚠️ Senza orizzonte questi tre restano a zero, e non e' un caso
    -- particolare da ricordare: chi non passa `p_fino_al` non ha un
    -- orizzonte, quindi per lui non esiste un «oltre».
    count(*) filter (where p_fino_al is not null and m.movement_date > p_fino_al)::integer,
    coalesce(sum(m.amount) filter (where p_fino_al is not null and m.movement_date > p_fino_al), 0),
    min(m.movement_date) filter (where p_fino_al is not null and m.movement_date > p_fino_al)
  from cash_movements m
  cross join oggi o
  where m.entity_id = p_entity_id
    and m.direction = 'uscita';
end;
$function$;

comment on function uscite_future(uuid, date) is
  'Le uscite gia'' scritte e non ancora avvenute. Riservata al titolare dal 19/08/2026: nasceva senza portiere, e girando security definer lasciava leggere gli importi in uscita a chi entra con l''accesso della sala.';

revoke all on function uscite_future(uuid, date) from public, anon, authenticated;
grant execute on function uscite_future(uuid, date) to authenticated;


-- ---------------------------------------------------------------------
-- 2 · La rete: chi scavalca la RLS senza chiedere chi sei
-- ---------------------------------------------------------------------
-- ⚠️ PERCHE' UNA RETE E NON UN CONTROLLO A MANO. Quell'elenco e' un numero
-- dichiarato in CLAUDE.md dal 13/08 — «13 security definer senza
-- guardiano» — ed e' cresciuto a 15 senza che nessuno lo dicesse. Un numero
-- scritto a mano in un documento e' un'affermazione che nessuna verifica
-- controlla (regola del 18/08): qui diventa una funzione che se lo
-- costruisce dal catalogo a ogni esecuzione, e una prova che diventa rossa
-- da sola quando ne compare una nuova. Stessa forma di
-- `funzioni_aperte_ad_anon()` (13/08) e di `funzioni_con_data_utc()` (19/08).
--
-- ⚠️ TOGLIE I COMMENTI PRIMA DI GUARDARE, e qui il verso conta: nella rete
-- delle date i commenti producevano falsi ALLARMI, qui produrrebbero falsi
-- SILENZI — una funzione che nomina `is_titolare()` solo in un commento
-- sparirebbe dall'elenco pur non controllando niente. Misurato il 19/08
-- prima di scriverlo: oggi non ce n'e' nessuna, ed e' il caso che si vuole
-- non poter mai avere.
--
-- ⚠️ E CERCA IL GESTO, NON LA PAROLA — «se non sei il titolare, rifiuta» —
-- che e' la forma gia' scelta il 16/08 per `funzioni_col_portiere()`. La
-- prima stesura di oggi cercava la parola `is_titolare()`, e sarebbe stata
-- cieca su chiunque la nominasse dentro una stringa: lo stesso falso
-- silenzio dei commenti, da un'altra porta. Cercando il gesto, l'elenco e'
-- salito di due — `close_order_as_discount_gift` e `log_deleted_record` —
-- che non sono comparse adesso: c'erano gia' e non si vedevano.
--
-- ⚠️ IL LIMITE, dichiarato: guarda se il rifiuto c'e' scritto, non se viene
-- eseguito. Una funzione che avesse quel rifiuto dentro un ramo mai
-- percorso passerebbe. E' la stessa voce di coda del controllo che guarda
-- la forma invece del comportamento — la rete chiude il caso silenzioso
-- (nessun rifiuto affatto), non quello rumoroso.
-- ⚠️ E LA RETE HA IL PORTIERE, come `funzioni_aperte_ad_anon` dal 13/08:
-- descrive la forma del database, che non e' roba da sala. Non e' una
-- formalita' — senza, comparirebbe nel proprio elenco, e ci comparirebbe
-- per la ragione sbagliata: si escluderebbe da sola perche' contiene la
-- parola `is_titolare()` dentro una stringa, non perche' chiede chi sei.
-- Col portiere vero le due cose coincidono.
create or replace function funzioni_senza_portiere()
returns table (nome text, tocca_denaro boolean)
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
  with d as (
    select p.oid, p.proname::text as nome,
           regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g') as corpo
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
  )
  select d.nome, (d.corpo ~* '(unit_cost|costo|price|prezzo|amount|importo)')
    from d
   where not (d.corpo ~ 'not\s+\(?\s*(select\s+)?is_titolare\s*\(\s*\)'
           or d.corpo ~ 'auth\.uid\s*\(\s*\)\s+is\s+null')
   order by d.nome;
end;
$function$;


-- ---------------------------------------------------------------------
-- 3 · La rete gemella, e il buco che aveva dentro
-- ---------------------------------------------------------------------
-- 🔴 `funzioni_col_portiere()` (16/08) e' l'elenco opposto: chi il portiere
-- ce l'ha. Serve alla prova che impedisce a una migrazione di chiamare una
-- di quelle funzioni senza impostare i claims — cioe' il difetto che il
-- 16/08 fermo' due volte una consegna in produzione.
--
-- 🔴 E CERCAVA UNA FORMA SOLA: `not is_titolare()`. Ma `promuovi_disposizione`
-- scrive `if not (select is_titolare())`, con le parentesi — quindi non
-- compariva nell'elenco, e una migrazione che la chiamasse non sarebbe stata
-- fermata da nessuno. Un guardiano che non vede una delle due scritture
-- della stessa cosa e' un guardiano che passa in silenzio.
--
-- ⚠️ E il portiere lo prende anche lei, come le altre diagnostiche.
CREATE OR REPLACE FUNCTION public.funzioni_col_portiere()
 RETURNS TABLE(nome text, portiere text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  select p.proname::text,
         case
           when pg_get_functiondef(p.oid) like '%is_titolare()%'
            and pg_get_functiondef(p.oid) like '%auth.uid()%' then 'is_titolare() e auth.uid()'
           when pg_get_functiondef(p.oid) like '%is_titolare()%' then 'is_titolare()'
           else 'auth.uid()'
         end
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where p.prokind = 'f'
     and p.prorettype <> 'trigger'::regtype
     -- ⚠️ Il portiere si riconosce dalla FORMA, non dalla parola: questa
     -- funzione stessa nomina «is_titolare()» dentro un confronto, e con
     -- una ricerca per parola finirebbe nel proprio elenco. Si cerca il
     -- gesto — «se non sei il titolare, rifiuta» — non il nome.
     -- ⚠️ E il gesto si scrive in DUE modi: `not is_titolare()` e
     -- `not (select is_titolare())`. Riconoscerne uno solo lasciava fuori
     -- `promuovi_disposizione` (19/08).
     and (pg_get_functiondef(p.oid) ~ 'not\s+\(?\s*(select\s+)?is_titolare\s*\(\s*\)'
       or pg_get_functiondef(p.oid) ~ 'auth\.uid\s*\(\s*\)\s+is\s+null')
   order by 1;
end;
$function$;

revoke all on function funzioni_col_portiere() from public, anon, authenticated;
grant execute on function funzioni_col_portiere() to authenticated;


-- ⚠️ STESSA CURA PER `funzioni_multi_tabella`, trovata da questa rete
-- appena e' stata accesa: e' l'altra diagnostica che racconta com'e' fatto
-- il database (quali funzioni scrivono su piu' tabelle), e non aveva
-- nessun controllo. Il corpo e' quello vivo, cambia solo il linguaggio.
CREATE OR REPLACE FUNCTION public.funzioni_multi_tabella()
 RETURNS TABLE(nome text, tabelle integer, quali text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_titolare() then
    raise exception 'La forma del database e'' riservata al titolare.';
  end if;

  return query
  with scritture as (
    select p.proname::text as nome, m[2] as tabella
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public',
    lateral regexp_matches(
      pg_get_functiondef(p.oid),
      '(insert into|update|delete from)\s+(?:public\.)?([a-z_0-9]+)', 'gi') m
    where p.provolatile = 'v'
      and exists (
        select 1 from pg_class c
        join pg_namespace nn on nn.oid = c.relnamespace
        where nn.nspname = 'public' and c.relkind in ('r', 'p') and c.relname = m[2]
      )
  )
  select s.nome, count(distinct s.tabella)::integer, string_agg(distinct s.tabella, ', ')
    from scritture s
   group by s.nome
  having count(distinct s.tabella) > 1
   order by s.nome;
end;
$function$;

revoke all on function funzioni_multi_tabella() from public, anon, authenticated;
grant execute on function funzioni_multi_tabella() to authenticated;

comment on function funzioni_senza_portiere() is
  'Le funzioni che scavalcano la RLS (security definer) e che lo staff puo'' eseguire senza che nessuno chieda chi sia. L''elenco si costruisce dal catalogo a ogni esecuzione: quello congelato sta nella prova, non qui.';

revoke all on function funzioni_senza_portiere() from public, anon, authenticated;
grant execute on function funzioni_senza_portiere() to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_staff  uuid;
  v_ente   uuid;
  v_n      integer;
  v_ok     boolean;
begin
  select user_id into v_tit   from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role <> 'titolare' limit 1;
  if v_tit is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per verificare il portiere.';
  end if;
  select id into v_ente from entities order by created_at limit 1;

  -- 1 · La migrazione gira come proprietaria, dove `is_titolare()` e' FALSO
  --     (regola nota dal 04/08): quindi la funzione deve rifiutare gia' qui.
  v_ok := false;
  begin
    perform * from uscite_future(v_ente);
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'uscite_future ha risposto a chi non e'' il titolare.';
  end if;

  -- 2 · ...e deve rifiutare anche allo STAFF, che e' il caso vero: non
  --     «non c'e' nessun utente», ma «c'e' un utente che non e' lui».
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    perform * from uscite_future(v_ente);
  exception when others then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'uscite_future ha risposto allo staff.';
  end if;

  -- 3 · Al titolare risponde, e risponde una riga: un portiere che chiude
  --     la porta a tutti non e' un portiere, e' un muro.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_n from uscite_future(v_ente);
  if v_n <> 1 then
    raise exception 'uscite_future non risponde piu'' al titolare (righe: %).', v_n;
  end if;

  -- 4 · E non compare piu' nell'elenco di chi scavalca la RLS senza
  --     chiedere chi sei. L'elenco intero e' congelato nella prova
  --     (tests/app/permessi.test.js), non qui: un numero dentro una
  --     migrazione e' un fossile, e la prova gira tutti i giorni.
  if exists (select 1 from funzioni_senza_portiere() where nome = 'uscite_future') then
    raise exception 'uscite_future e'' ancora nell''elenco delle funzioni senza portiere.';
  end if;

  -- 5 · La rete deve vedere ANCHE chi nomina la guardia solo in un
  --     commento. Si prova costruendone una apposta e togliendola: se la
  --     rete guardasse il testo grezzo, questa non comparirebbe.
  execute 'create or replace function _prova_portiere_finto() returns integer '
       || 'language sql security definer set search_path = public as '
       || '$x$ -- qui ci sarebbe da chiamare is_titolare(), ma non lo si fa'
       || chr(10) || ' select 1; $x$';
  execute 'grant execute on function _prova_portiere_finto() to authenticated';
  if not exists (select 1 from funzioni_senza_portiere() where nome = '_prova_portiere_finto') then
    raise exception 'La rete non vede una guardia scritta solo in un commento.';
  end if;
  execute 'drop function _prova_portiere_finto()';
  if exists (select 1 from funzioni_senza_portiere() where nome = '_prova_portiere_finto') then
    raise exception 'La verifica ha lasciato dietro di se'' la funzione finta.';
  end if;

  -- 6 · LE DUE SCRITTURE DELLO STESSO GESTO. `promuovi_disposizione` rifiuta
  --     con `not (select is_titolare())`, e fino a oggi nessuna delle due
  --     reti la vedeva: la prima l'avrebbe accusata di non avere il
  --     portiere, la seconda non l'avrebbe protetta dalle sanatorie.
  if not exists (select 1 from funzioni_col_portiere() where nome = 'promuovi_disposizione') then
    raise exception 'La rete non riconosce «not (select is_titolare())» come portiere.';
  end if;
  if exists (select 1 from funzioni_senza_portiere() where nome = 'promuovi_disposizione') then
    raise exception 'promuovi_disposizione risulta senza portiere, e il portiere ce l''ha.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il portiere delle uscite future c''e'', e la rete che lo sorveglia si costruisce da sola.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260819000007', 'il_portiere_delle_uscite_future')
on conflict (version) do nothing;
