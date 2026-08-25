-- =====================================================================
-- I VINCOLI MUTI NON CRESCONO PIU'
-- 25/08/2026 — le quattordici frasi che mancavano, e il guardiano giusto
-- =====================================================================
-- 🔴 MISURATO PROVANDOLI DAVVERO DA UNA SCHERMATA, non leggendo il codice
-- (richiesta di Alessio nel collaudo). Tre risultati, e il secondo e' il
-- difetto:
--
--   1. ✅ LA TEMPERATURA A −100 ORA SCATTA. Era il caso che gli era
--      saltato fuori senza vincolo: `temperature_dentro_il_mondo` esiste
--      e rifiuta, con la sua frase in italiano — provato inserendo −100
--      su una lettura vera dal collegamento dell'app.
--
--   2. 🔴 NESSUNO RISPONDE IN INGLESE, ma **quattordici rifiuti su
--      cinquantuno danno un messaggio generico**. La rete di traduzione
--      copre tutti, quindi il ripiego arriva sempre — «il gestionale non
--      ha accettato questo valore: c'e' una regola che lo impedisce
--      (menu_items_prezzo_non_negativo)» — ma quella frase dice **che**
--      c'e' una regola, non **quale**. Misurato a schermo su
--      `menu_items_prezzo_non_negativo` e `ricevimento_temperatura_sensata`.
--
--   3. 🔴 E IL GUARDIANO CHE DOVEVA IMPEDIRLO E' UN ELENCO SCRITTO A MANO.
--      La verifica della `20260824000012` controlla **quattordici nomi
--      elencati uno per uno**: tutto cio' che e' nato dopo di lei non e'
--      coperto, e infatti quattordici vincoli nuovi sono muti. E' la
--      trappola gia' scritta in CLAUDE.md — *un guardiano deve esprimere
--      una PROPRIETA', non una quantita'* — nella sua forma piu' comune:
--      l'elenco che invecchia al primo lavoro successivo.
--
-- ⚠️ E LA SOGLIA E' DICHIARATA, perche' un controllo che grida sempre
-- viene spento: in tutto il database ci sono **212** vincoli `check` e
-- **170** senza frase. Pretenderle tutte adesso darebbe centosettanta
-- allarmi e nessuno guarderebbe piu' quell'elenco. Quindi si congela lo
-- stato di partenza e si sorveglia che **non cresca**: e' la stessa forma
-- della soglia dei riepiloghi (`PRIMA_CON_RIEPILOGO`) e dell'elenco
-- congelato delle funzioni senza portiere.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Le quattordici frasi che mancavano
-- ---------------------------------------------------------------------
-- ⚠️ OGNUNA DICE COSA IMPEDISCE E PERCHE', non ripete il nome del
-- vincolo: chi legge sta lavorando e ha appena ricevuto un rifiuto.

comment on constraint daily_menu_items_prezzo_non_negativo on daily_menu_items is
  'Il prezzo di una voce del menu del giorno non puo'' essere negativo. Vuoto e'' ammesso e vuol dire «non prezzato»: e'' diverso da zero, che vuol dire gratis.';

comment on constraint documents_importo_non_negativo on documents is
  'L''importo di un documento non puo'' essere negativo. Una nota di credito non si registra col segno meno: e'' un documento suo, e il gestionale la scala da se''.';

comment on constraint equipment_range_dentro_il_mondo on haccp_equipment is
  'Il range di un''attrezzatura sta fra −80 e 150 gradi. Limite largo apposta: ferma una virgola persa o un''unita'' sbagliata, non giudica se il range e'' giusto per quel frigo — quello lo decidi tu.';

comment on constraint ingredients_prezzo_non_negativo on ingredients is
  'Il prezzo di un ingrediente non puo'' essere negativo. Se un prodotto e'' arrivato in regalo il suo lotto costa zero, ma il prezzo dell''ingrediente non si tocca: altrimenti il food cost di ogni ricetta che lo usa risulterebbe piu'' basso del vero.';

comment on constraint menu_items_prezzo_non_negativo on menu_items is
  'Il prezzo di un piatto in carta non puo'' essere negativo. Vuoto vuol dire «non prezzato», che e'' diverso da zero.';

comment on constraint price_history_prezzo_non_negativo on price_history is
  'Un prezzo nello storico non puo'' essere negativo. Lo storico e'' quello su cui si misurano i rincari: un numero sotto zero falsa tutti i confronti successivi, non solo il proprio.';

comment on constraint produzioni_resa_positiva on produzioni is
  'La resa attesa di una produzione dev''essere maggiore di zero. Una resa a zero direbbe che da una dose non esce niente, e il costo del lotto prodotto sarebbe una divisione per zero.';

comment on constraint reservation_deposits_importo_positivo on reservation_deposits is
  'Una caparra dev''essere maggiore di zero. Una caparra da zero euro non e'' una caparra: e'' una prenotazione senza caparra, e si registra non mettendola.';

comment on constraint ricevimento_temperatura_sensata on haccp_goods_receiving is
  'La temperatura della merce al ricevimento sta fra −80 e 150 gradi. Limite largo apposta: ferma una virgola persa (185 invece di 18,5) o un''unita'' sbagliata, non giudica se la merce era conforme. Lo zero resta ammesso: 0 gradi e'' la temperatura del pesce fresco.';

comment on constraint scenario_extra_pressione_sensata on scenario_extra is
  'La pressione contributiva va scritta come frazione fra 0 e 3 — 0,32 vuol dire trentadue per cento. Sopra 3 e'' quasi sempre un numero scritto in punti invece che in frazione.';

comment on constraint shopping_quantita_positiva on shopping_list_items is
  'La quantita'' da comprare dev''essere maggiore di zero. Una riga da zero non chiede niente a nessuno: per togliere una riga dalla lista si barra, non si azzera.';

comment on constraint stock_consumptions_costo_non_negativo on stock_consumptions is
  'Il costo di uno scarico non puo'' essere negativo. E'' il numero da cui nasce il food cost reale: se scende sotto zero, ogni piatto che usa quell''ingrediente risulta piu'' economico del vero.';

comment on constraint stock_lots_chiusura_valida on stock_lots is
  'Una partita si chiude in tre modi soli: «finita», «buttata» o «reso_fornitore». «Buttata» scrive da se'' nel registro HACCP, le altre due no — per questo sono tre parole e non una nota libera.';

comment on constraint stock_lots_costo_non_negativo on stock_lots is
  'Il costo unitario di una partita non puo'' essere negativo. Zero e'' ammesso ed e'' il caso vero del prodotto avuto in regalo: quel lotto e'' costato zero davvero.';

-- ---------------------------------------------------------------------
-- 2 · Lo stato di partenza congelato
-- ---------------------------------------------------------------------
-- ⚠️ SI CONGELA CIO' CHE C'E' GIA', UNA VOLTA SOLA. La tabella si riempie
-- alla creazione e non si riempie mai piu': se si ripopolasse a ogni
-- applicazione, un vincolo muto nato domani entrerebbe da se' nello stato
-- di partenza — cioe' il guardiano assolverebbe da solo quello che deve
-- sorvegliare. E' la stessa ragione per cui la rete dei riepiloghi guarda
-- cio' che e' GIA' applicato.
create table if not exists vincoli_muti_noti (
  conname     text primary key,
  tabella     text not null,
  congelato_il timestamptz not null default now()
);

comment on table vincoli_muti_noti is
  'I vincoli che al 25/08/2026 non avevano una spiegazione in italiano. Non e'' un permesso: e'' la linea di partenza da cui si misura che il debito non cresce. Un vincolo nuovo senza frase NON entra qui — fa diventare rossa la prova.';

alter table vincoli_muti_noti enable row level security;

drop policy if exists vincoli_muti_noti_lettura on vincoli_muti_noti;
create policy vincoli_muti_noti_lettura on vincoli_muti_noti
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

-- ⚠️ `where not exists` sull'intera tabella e non `on conflict`: la
-- differenza e' tutta qui. Con `on conflict do nothing` una riapplicazione
-- aggiungerebbe i muti NUOVI lasciando stare i vecchi, e il debito
-- crescerebbe in silenzio. Cosi' invece, se la tabella ha gia' una riga,
-- non si tocca niente.
insert into vincoli_muti_noti (conname, tabella)
select c.conname, t.relname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
 where n.nspname = 'public'
   and c.contype = 'c'
   and obj_description(c.oid, 'pg_constraint') is null
   and not exists (select 1 from vincoli_muti_noti);

-- ---------------------------------------------------------------------
-- 3 · Il guardiano: una proprieta', non un elenco
-- ---------------------------------------------------------------------
create or replace function public.vincoli_senza_frase()
returns table (conname text, tabella text, definizione text)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'Riservato al titolare.';
  end if;
  return query
  select c.conname::text, t.relname::text, pg_get_constraintdef(c.oid)
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and c.contype = 'c'
     and obj_description(c.oid, 'pg_constraint') is null
     and c.conname not in (select v.conname from vincoli_muti_noti v)
   order by t.relname, c.conname;
end $function$;

comment on function public.vincoli_senza_frase() is
  'I vincoli nati DOPO il 25/08/2026 che non hanno una spiegazione in italiano. Quando ne compare uno, chi riceve quel rifiuto legge «c''e'' una regola che lo impedisce» senza sapere quale. Si chiude scrivendo un `comment on constraint` accanto alla regola.';

revoke all on function public.vincoli_senza_frase() from public, anon, authenticated;
grant execute on function public.vincoli_senza_frase() to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_muti      integer;
  v_noti      integer;
  v_nuovi     integer;
  v_frase     text;
  v_rifiutato boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) LE QUATTORDICI PARLANO. Si controlla che la frase esista **e che
  --     non sia vuota**: un commento di stringa vuota passerebbe il
  --     controllo dell'esistenza e lascerebbe il rifiuto muto uguale.
  select count(*) into v_muti
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
   where n.nspname = 'public'
     and c.conname in (
       'daily_menu_items_prezzo_non_negativo', 'documents_importo_non_negativo',
       'equipment_range_dentro_il_mondo', 'ingredients_prezzo_non_negativo',
       'menu_items_prezzo_non_negativo', 'price_history_prezzo_non_negativo',
       'produzioni_resa_positiva', 'reservation_deposits_importo_positivo',
       'ricevimento_temperatura_sensata', 'scenario_extra_pressione_sensata',
       'shopping_quantita_positiva', 'stock_consumptions_costo_non_negativo',
       'stock_lots_chiusura_valida', 'stock_lots_costo_non_negativo')
     and coalesce(trim(obj_description(c.oid, 'pg_constraint')), '') = '';
  if v_muti > 0 then
    raise exception '% delle quattordici non hanno ancora la loro frase.', v_muti;
  end if;

  -- (b) LA FRASE ARRIVA DALLA PORTA VERA, cioe' dalla funzione che la
  --     schermata interroga — non da `obj_description` chiamata qui.
  --     ⚠️ Guardare il commento e guardare cosa risponde `spiega_vincolo`
  --     sono due cose diverse, ed e' nello spazio fra loro che un difetto
  --     resterebbe invisibile.
  select spiega_vincolo('ricevimento_temperatura_sensata') into v_frase;
  if coalesce(v_frase, '') !~ 'temperatura' then
    raise exception 'La porta vera non restituisce la frase del ricevimento: «%»', coalesce(v_frase, '(vuota)');
  end if;

  -- (c) LO STATO DI PARTENZA E' CONGELATO E NON VUOTO.
  select count(*) into v_noti from vincoli_muti_noti;
  if v_noti = 0 then
    raise exception 'Lo stato di partenza dei vincoli muti e'' vuoto: il guardiano assolverebbe tutto.';
  end if;

  -- (d) OGGI NON C'E' NIENTE DI NUOVO. ⚠️ Uno zero qui vuol dire «nessun
  --     vincolo e'' nato muto dopo il congelamento», e lo si puo'
  --     affermare solo perche' il punto (e) dimostra che il conto sa
  --     anche NON fare zero.
  select count(*) into v_nuovi from vincoli_senza_frase();
  if v_nuovi > 0 then
    raise exception '% vincoli nati dopo il congelamento non hanno la frase italiana.', v_nuovi;
  end if;

  -- (e) 🔴 LA ROTTURA APPOSTA: un vincolo nuovo e muto DEVE comparire.
  --     Senza questa, uno zero al punto (d) sarebbe indistinguibile da un
  --     guardiano che non guarda niente.
  create table if not exists _prova_vincolo_muto (n numeric);
  alter table _prova_vincolo_muto drop constraint if exists prova_muto_25082026;
  alter table _prova_vincolo_muto add constraint prova_muto_25082026 check (n >= 0);
  select count(*) into v_nuovi from vincoli_senza_frase() r where r.conname = 'prova_muto_25082026';
  if v_nuovi <> 1 then
    raise exception 'Un vincolo nuovo e muto NON viene segnalato: il guardiano non guarda.';
  end if;

  -- (f) E CON LA FRASE DEVE TACERE: una rete che grida sempre si impara a
  --     spegnere.
  comment on constraint prova_muto_25082026 on _prova_vincolo_muto is 'Prova del 25/08/2026.';
  select count(*) into v_nuovi from vincoli_senza_frase() r where r.conname = 'prova_muto_25082026';
  if v_nuovi <> 0 then
    raise exception 'Il guardiano segnala anche un vincolo che la frase ce l''ha.';
  end if;

  drop table _prova_vincolo_muto;

  -- (g) IL PORTIERE, col ruolo vero.
  if exists (select 1 from user_roles where role <> 'titolare') then
    perform set_config('request.jwt.claims',
      json_build_object('sub', (select user_id from user_roles where role <> 'titolare' limit 1),
                        'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform * from vincoli_senza_frase();
    exception when others then
      v_rifiutato := true;
    end;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    if not v_rifiutato then
      raise exception 'Lo staff puo'' leggere l''elenco dei vincoli senza frase.';
    end if;
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Quattordici frasi scritte, % vincoli muti congelati, zero nati muti dopo.', v_noti;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260825000002', 'i_vincoli_muti_non_crescono_piu') on conflict (version) do nothing;
