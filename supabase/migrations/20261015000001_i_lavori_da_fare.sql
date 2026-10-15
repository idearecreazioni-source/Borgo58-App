-- =====================================================================
-- I LAVORI DA FARE — 15/10/2026, chiesto da Alessio:
--   «vorrei aggiungere una sezione in agenda: "lavori da fare"».
-- =====================================================================
--
-- 🔴 NON E' UNA TABELLA NUOVA: E' UNA CATEGORIA IN PIU' DELL'AGENDA.
--    Un lavoro da fare (sistemare la porta, chiamare l'elettricista,
--    montare le mensole) e' un impegno come gli altri: si spunta, si
--    rimanda, puo' avere una data o no, puo' ripetersi. Una tabella a se'
--    vorrebbe dire una seconda spunta, un secondo «rimanda», una seconda
--    ricorrenza — cioe' due definizioni della stessa cosa che divergono.
--    ⚠️ E la categoria si copia GIA' da sola sull'impegno successivo di un
--    ricorrente (`completa_task` la porta con se'), quindi un lavoro che
--    torna ogni sei settimane resta un lavoro senza toccare niente altro.
--
-- ⚠️ Cosa cambia nel database, e solo questo:
--    1. `categoria_task()` riconosce il valore nuovo `lavori`;
--    2. il vincolo `categoria_chiusa` lo ammette.
--    Nessuna riga esistente cambia categoria: nessuno ha mai scritto un
--    lavoro, e indovinare quali dei 123 «altro» lo siano sarebbe una
--    classificazione plausibile e sbagliata.
--
-- ⚠️ I due corpi sono presi dal DATABASE VIVO (15/10/2026, produzione
--    allineata al repository: ultima migrazione 20261012000001), non
--    dalla migrazione che li ha creati. Permessi ripresi da `proacl`:
--    `categoria_task` non e' eseguibile da nessun client.

-- ---------------------------------------------------------------------
-- 1. La traduzione riconosce `lavori`
-- ---------------------------------------------------------------------
create or replace function public.categoria_task(p_testo text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_testo is null or btrim(p_testo) = '' then 'altro'
    when lower(p_testo) in ('fisco_scadenze', 'documenti', 'fornitori_pagamenti',
                            'personale', 'haccp_locale', 'lavori', 'altro') then lower(p_testo)
    -- Le quattro convenzioni trovate in produzione, piu' quelle scritte
    -- dai moduli. Ognuna e' una riga dichiarata, non un indovinello.
    when lower(p_testo) like 'adempimenti%'   then 'fisco_scadenze'
    when lower(p_testo) like 'fiscal%'        then 'fisco_scadenze'
    when lower(p_testo) like 'document%'      then 'documenti'
    when lower(p_testo) like 'personal%'      then 'personale'
    when lower(p_testo) like 'haccp%'         then 'haccp_locale'
    when lower(p_testo) like 'fornitor%'      then 'fornitori_pagamenti'
    -- ⚠️ «amministrativo» non si traduce da solo: sotto quella parola in
    --    produzione ci sono pagamenti di fatture E date di locazione. Chi
    --    non si sa dove mettere va in «altro», non nella casella piu'
    --    probabile: una classificazione plausibile e sbagliata si legge
    --    come vera.
    else 'altro'
  end;
$function$;

revoke all on function public.categoria_task(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Il vincolo lo ammette
-- ---------------------------------------------------------------------
alter table tasks drop constraint if exists categoria_chiusa;
alter table tasks add constraint categoria_chiusa
  check (category in ('fisco_scadenze', 'documenti', 'fornitori_pagamenti',
                      'personale', 'haccp_locale', 'lavori', 'altro'));

comment on constraint categoria_chiusa on tasks is
  'Un impegno appartiene a una delle categorie dell''Agenda: fisco e scadenze, documenti, fornitori e pagamenti, personale, HACCP e locale, lavori da fare, altro.';

-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_id       uuid;
  v_cat      text;
  v_corsia   text;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare per questa verifica.';
  end if;

  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- (1) Un lavoro si scrive e RESTA un lavoro: il trigger non lo
    --     traduce in «altro» (il caso che senza il punto 1 sarebbe
    --     successo in silenzio).
    insert into tasks (title, priority, status, category, visibile_staff)
    values ('PROVA LAVORO', 'media', 'da_fare', 'lavori', true)
    returning id into v_id;
    select category into v_cat from tasks where id = v_id;
    if v_cat is distinct from 'lavori' then
      raise exception 'VERIFICA (1): un lavoro e'' diventato «%».', v_cat;
    end if;

    -- (2) Scritto maiuscolo si normalizza, non si rifiuta.
    update tasks set category = 'Lavori' where id = v_id;
    select category into v_cat from tasks where id = v_id;
    if v_cat is distinct from 'lavori' then
      raise exception 'VERIFICA (2): «Lavori» e'' diventato «%».', v_cat;
    end if;

    -- (3) L'Agenda lo restituisce con la sua categoria: e' da li' che la
    --     schermata lo mette nella sezione «Lavori da fare».
    select category, corsia into v_cat, v_corsia from agenda_corsie() where id = v_id;
    if v_cat is distinct from 'lavori' or v_corsia is distinct from 'quando_capita' then
      raise exception 'VERIFICA (3): l''Agenda restituisce «%» / «%».', v_cat, v_corsia;
    end if;

    -- (4) Le altre categorie non sono cambiate: una sconosciuta va ancora
    --     in «altro».
    if categoria_task('amministrativo') is distinct from 'altro'
       or categoria_task('Adempimenti societari') is distinct from 'fisco_scadenze' then
      raise exception 'VERIFICA (4): la traduzione delle categorie vecchie e'' cambiata.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica dei lavori da fare');

  raise notice 'Fatto: «lavori» e'' una categoria dell''Agenda, si scrive, si normalizza e torna dall''elenco. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261015000001', 'i_lavori_da_fare')
on conflict (version) do nothing;
