-- =====================================================================
-- IL VINCOLO DELLE UNITA' PARLA ITALIANO
-- 29/08/2026 — chiude un rilievo della rete, non un mio ripensamento
-- =====================================================================
-- La `20260829000024` ha creato `unita_misura` col suo vincolo sull ambito,
-- e gli ha scordato la frase in italiano. Il commento glielo avevo scritto
-- alla gemella — quello sulle categorie — e non a lei.
--
-- 🔴 A PRENDERLO NON SONO STATO IO RILEGGENDO: sono state le due prove nate
-- il 25/08 (`tests/app/vincoli-parlanti.test.js`), diventate rosse da sole
-- col nome esatto del vincolo. Senza quella frase, chi scrivesse un ambito
-- inventato dalla schermata leggerebbe «c e una regola che lo impedisce
-- (unita_misura_ambito_check)» — che dice CHE c e una regola, non QUALE.
--
-- ⚠️ E NON SI CORREGGE IL FILE DI IERI: la 024 e gia applicata sul progetto
-- di prova, e una migrazione applicata non si riscrive mai (regola di
-- Alessio del 23/08). Il file racconta cosa e successo quel giorno;
-- correggerlo lo renderebbe una bugia per chi ricostruira da zero fra un
-- anno. Si aggiunge, non si riscrive.

comment on constraint unita_misura_ambito_check on unita_misura is
  'Un''unita'' di misura vale per gli alimenti, per i materiali di consumo, o per tutti e due: non c''e'' un quarto caso.';

do $verifica$
declare
  v_tit   uuid;
  v_frase text;
  v_muti  integer;
begin
  -- ⚠️ `vincoli_senza_frase()` ha il PORTIERE: dentro una migrazione non
  --    c e nessun utente, quindi va chiamata impersonando il titolare.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Verifica impossibile: nessun titolare in user_roles.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- (1) LA FRASE C'E', ed e quella che legge chi sbaglia.
  select obj_description(con.oid, 'pg_constraint') into v_frase
    from pg_constraint con
   where con.conname = 'unita_misura_ambito_check';
  if v_frase is null or btrim(v_frase) = '' then
    raise exception 'Il vincolo sull''ambito delle unita'' e'' ancora muto.';
  end if;
  if position('alimenti' in v_frase) = 0 then
    raise exception 'La frase c''e'' ma non nomina i due mondi: «%»', v_frase;
  end if;

  -- (2) E NON NE RESTANO ALTRI NATI STANOTTE. E' il controllo che serve
  --     davvero: sistemare quello che la prova ha nominato e lasciare i
  --     fratelli muti sarebbe curare il sintomo.
  select count(*) into v_muti
    from vincoli_senza_frase() v
   where v.tabella in ('unita_misura', 'categorie_ingrediente');
  if v_muti <> 0 then
    raise exception 'Restano % vincoli muti sui due cataloghi: %', v_muti,
      (select string_agg(v.vincolo, ', ') from vincoli_senza_frase() v
        where v.tabella in ('unita_misura', 'categorie_ingrediente'));
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice 'Il vincolo sull''ambito delle unita'' risponde in italiano, e sui due cataloghi non ne restano di muti.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000025', 'il_vincolo_delle_unita_parla_italiano') on conflict (version) do nothing;
