-- 23/11/2026 — Revisione generale di work, punto 6: annullare un lotto d'import non puliva la Scheda.
--
-- Cosa succedeva: l'annullamento toglie i documenti del lotto, ma
--   · le proposte «aggiungi alla Scheda» e «spegni» nate da quei documenti restavano in attesa e si potevano accettare
--     (con titolo e controparte di un documento che non c'è più);
--   · le voci della Scheda già nate da quei documenti restavano, col titolo e la controparte nel testo, e MEMO le leggeva.
-- Cosa fa adesso:
--   1. l'annullamento CHIUDE le proposte in attesa del lotto (nella stessa transazione, prima di togliere i documenti);
--   2. una funzione nuova, `import_lotto_voci_scheda`, ELENCA le voci attive della Scheda nate da quei documenti: la pagina
--      le mostra DOPO l'annullamento, così Alessio le guarda e spegne quelle che non servono. NON si spengono da sole:
--      una voce può essere stata corretta o arricchita a mano, e spegnerla è una decisione del titolare.
-- Oggi su work nessun lotto è annullato e nessuna voce è collegata a un documento: nessun effetto per ora.

-- ---------------------------------------------------------------------
-- 1. Le voci della Scheda nate dai documenti di un lotto (sola lettura)
-- ---------------------------------------------------------------------
create or replace function import_lotto_voci_scheda(p_lotto uuid)
returns table (numero integer, sezione text, testo text)
language plpgsql stable security definer set search_path = public as $funzione$
begin
  if not is_titolare() then raise exception 'Solo il titolare puo'' vedere le voci della Scheda di un lotto.'; end if;
  return query
  select v.numero, v.sezione, v.testo
    from scheda_voci v
   where v.attiva
     and v.documento_id in (select d.id from documents d where d.lotto_import_id = p_lotto)
   order by v.numero;
end $funzione$;

comment on function import_lotto_voci_scheda(uuid) is
  'Le voci ATTIVE della Scheda nate da un documento di questo lotto d''import (scheda_voci.documento_id). Si chiede PRIMA di annullare il lotto: dopo, i documenti non ci sono piu'' e il collegamento si perde. Solo il titolare.';

revoke all on function import_lotto_voci_scheda(uuid) from public, anon;
grant execute on function import_lotto_voci_scheda(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. L'annullamento chiude le proposte del lotto (corpo VIVO, una riga)
-- ---------------------------------------------------------------------
do $annulla$
declare
  v_vecchio constant text := 'for v_doc in select id, task_id from documents where lotto_import_id = p_lotto order by created_at, id for update loop';
  v_nuovo   constant text := 'update scheda_proposte set stato = ''scaduta'', decisa_il = now()
     where stato = ''in_attesa''
       and (documento_id in (select d.id from documents d where d.lotto_import_id = p_lotto)
            or (origine in (''contratto'', ''scadenza_contratto'')
                and origine_id in (select d.id from documents d where d.lotto_import_id = p_lotto)));
    for v_doc in select id, task_id from documents where lotto_import_id = p_lotto order by created_at, id for update loop';
  v_def     text;
  v_n       integer;
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := replace(pg_get_functiondef('public.import_lotto_annulla(uuid)'::regprocedure), E'\r', '');
  if v_def like '%update scheda_proposte set stato%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'import_lotto_annulla non ha una sola riga «%» (ne ha %): confronta il corpo vivo prima di applicare.', v_vecchio, v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $annulla$;

-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit uuid;
  v_staff uuid;
  v_lotto uuid;
  v_doc uuid;
  v_voce uuid;
  v_prop uuid;
  v_n integer;
  v_stato text;
  v_seq_ultimo bigint;
  v_seq_usato boolean;
  v_no boolean;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;
  select last_value, is_called into v_seq_ultimo, v_seq_usato from scheda_voci_numero_seq;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into lotti_import (nota) values ('ZZ lotto di verifica') returning id into v_lotto;
    insert into documents (title, doc_type, document_date, lotto_import_id)
      values ('ZZ Contratto di verifica', 'contratti', date '2026-10-01', v_lotto) returning id into v_doc;
    insert into scheda_voci (sezione, chiave, testo, fonte, documento_id)
      values ('societa', 'societa:zz-lotto-prova', 'Voce ZZ nata da un documento inventato.', 'documentato', v_doc) returning id into v_voce;
    reset role;
    -- Una proposta in attesa su quel documento (scritta come proprietario: la tabella non si scrive dalla pagina).
    insert into scheda_proposte (tipo, origine, origine_id, chiave, sezione, testo_dopo, fonte_dopo, documento_id, motivo, scade_il)
      values ('aggiungi', 'contratto', v_doc, 'societa:zz-proposta-lotto', 'societa', 'Proposta ZZ inventata.', 'documentato', v_doc, 'Verifica.', current_date + 20)
      returning id into v_prop;
    set local role authenticated;

    -- (1) l'elenco delle voci del lotto la trova.
    select count(*) into v_n from import_lotto_voci_scheda(v_lotto);
    if v_n <> 1 then raise exception 'VERIFICA (1): l''elenco delle voci del lotto trova % voci (ne serve 1).', v_n; end if;

    -- (2) annullare il lotto chiude la proposta e lascia la voce (la spegne Alessio).
    perform import_lotto_annulla(v_lotto);
    reset role;
    select stato into v_stato from scheda_proposte where id = v_prop;
    if v_stato is distinct from 'scaduta' then raise exception 'VERIFICA (2a): la proposta del lotto non si è chiusa (%).', v_stato; end if;
    if not exists (select 1 from scheda_voci where id = v_voce and attiva) then
      raise exception 'VERIFICA (2b): la voce della Scheda non doveva spegnersi da sola.';
    end if;
    if exists (select 1 from documents where id = v_doc) then raise exception 'VERIFICA (2c): il documento del lotto c''è ancora.'; end if;

    -- (3) staff e chi non è entrato non vedono l'elenco.
    if v_staff is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_no := false;
      begin perform * from import_lotto_voci_scheda(v_lotto); exception when raise_exception then v_no := true; end;
      if not v_no then raise exception 'VERIFICA (3a): lo staff ha letto l''elenco delle voci di un lotto.'; end if;
      reset role;
    end if;
    set local role anon;
    v_no := false;
    begin perform * from import_lotto_voci_scheda(v_lotto); exception when insufficient_privilege then v_no := true; end;
    if not v_no then raise exception 'VERIFICA (3b): anon ha letto l''elenco delle voci di un lotto.'; end if;
    reset role;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    reset role;
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;
  perform set_config('request.jwt.claims', null, true);
  perform setval('scheda_voci_numero_seq', v_seq_ultimo, v_seq_usato);
  if exists (select 1 from lotti_import where nota = 'ZZ lotto di verifica')
     or exists (select 1 from scheda_voci where chiave = 'societa:zz-lotto-prova')
     or exists (select 1 from scheda_proposte where chiave = 'societa:zz-proposta-lotto')
     or exists (select 1 from documents where title = 'ZZ Contratto di verifica') then
    raise exception 'VERIFICA (4): resta un residuo della verifica.';
  end if;
  if has_function_privilege('anon', 'import_lotto_voci_scheda(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'import_lotto_voci_scheda(uuid)', 'execute') then
    raise exception 'VERIFICA (5): permessi dell''elenco delle voci diversi da quelli dichiarati.';
  end if;

  raise notice 'Fatto: annullare un lotto d''import chiude le proposte della Scheda nate dai suoi documenti e una funzione elenca le voci da guardare. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261123000004', 'annullo_del_lotto_pulisce_la_scheda')
on conflict (version) do nothing;
