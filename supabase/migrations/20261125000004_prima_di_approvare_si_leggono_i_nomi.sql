-- 25/11/2026 — Revisione dell'11/11, punto 16: MEMO, prima di approvare, alcuni nomi veri non si vedono.
--
-- Cosa succedeva: per un movimento di cassa, un carico di merce o una giacenza, l'appunto mostra la frase scritta dall'AI
-- («Entrata da Rossi»), ma la causale, il fornitore, il prodotto e il conto che VERRANNO scritti sono identificativi che
-- chi firma non vede (la schermata li nasconde: sono impalcatura). Se l'AI ha sbagliato codice, si approva una cosa e ne
-- viene scritta un'altra. Importo e verso si vedevano; i nomi no.
-- Cura, nello stesso modo già usato per il piano (voce_nome, spesa_nome): quando MEMO risolve i dati, il DATABASE aggiunge
-- accanto a ogni identificativo il nome letto dalla sua tabella — causale_nome, fornitore_nome, prodotto_nome, conto_nome —
-- e la schermata li mostra. Il nome non decide niente: è solo ciò che si leggerà al posto dell'identificativo.
-- Se l'identificativo non c'è (o non è più valido), il nome vecchio sparisce: non resta un nome senza il suo codice.

create or replace function voce_nomi_leggibili(p_dati jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $funzione$
declare
  v_dati jsonb := coalesce(p_dati, '{}'::jsonb);
  v_id   uuid;
  v_nome text;
begin
  -- Un identificativo che non si legge come identificativo non porta nome (e il nome di prima si toglie).
  begin
    v_id := nullif(v_dati->>'causale_id', '')::uuid;
  exception when invalid_text_representation then v_id := null;
  end;
  select c.label into v_nome from cash_causali c where c.id = v_id;
  v_dati := case when v_nome is null then v_dati - 'causale_nome' else v_dati || jsonb_build_object('causale_nome', v_nome) end;

  v_nome := null;
  begin
    v_id := nullif(v_dati->>'supplier_id', '')::uuid;
  exception when invalid_text_representation then v_id := null;
  end;
  select s.name into v_nome from suppliers s where s.id = v_id;
  v_dati := case when v_nome is null then v_dati - 'fornitore_nome' else v_dati || jsonb_build_object('fornitore_nome', v_nome) end;

  v_nome := null;
  begin
    v_id := nullif(v_dati->>'ingredient_id', '')::uuid;
  exception when invalid_text_representation then v_id := null;
  end;
  select i.name into v_nome from ingredients i where i.id = v_id;
  v_dati := case when v_nome is null then v_dati - 'prodotto_nome' else v_dati || jsonb_build_object('prodotto_nome', v_nome) end;

  v_nome := null;
  begin
    v_id := nullif(v_dati->>'conto_id', '')::uuid;
  exception when invalid_text_representation then v_id := null;
  end;
  select b.nome into v_nome from conti_bancari b where b.id = v_id;
  v_dati := case when v_nome is null then v_dati - 'conto_nome' else v_dati || jsonb_build_object('conto_nome', v_nome) end;

  return v_dati;
end $funzione$;

comment on function voce_nomi_leggibili(jsonb) is
  'Accanto agli identificativi di un appunto di MEMO (causale, fornitore, prodotto, conto) scrive il nome letto dal database, così chi approva vede cosa verrà scritto. La chiama solo voce_risolvi_dati: chiusa a tutti.';
revoke all on function voce_nomi_leggibili(jsonb) from public, anon, authenticated;

-- Il passaggio finale di voce_risolvi_dati: si cambia il corpo VIVO in un punto solo (controllato: deve comparire una volta).
do $risolvi$
declare
  v_def    text;
  v_vecchio constant text := E'return jsonb_build_object(''dati'', v_dati, ''manca'', v_manca);\nend $function$';
  v_nuovo   constant text := E'return jsonb_build_object(''dati'', voce_nomi_leggibili(v_dati), ''manca'', v_manca);\nend $function$';
  v_n      integer;
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := replace(pg_get_functiondef('public.voce_risolvi_dati(text,jsonb)'::regprocedure), E'\r', '');
  if v_def like '%voce_nomi_leggibili(v_dati)%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'voce_risolvi_dati non ha una sola chiusura attesa (ne ha %): confronta il corpo vivo prima di applicare.', v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $risolvi$;
revoke all on function voce_risolvi_dati(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- VERIFICA (blocco annullato, zero residui)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit  uuid;
  v_c    record;
  v_forn record;
  v_ing  record;
  v_r    jsonb;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'VERIFICA: nessun titolare.'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id, label, kind into v_c from cash_causali where active limit 1;
  select id, name into v_forn from suppliers limit 1;
  select id, name into v_ing from ingredients limit 1;

  -- (1) un movimento di cassa con causale e fornitore: i nomi arrivano accanto agli identificativi.
  if v_c.id is not null then
    v_r := voce_risolvi_dati('movimento_cassa', jsonb_build_object(
      'verso', v_c.kind, 'importo', 10, 'causale_id', v_c.id, 'supplier_id', v_forn.id, 'mezzo', 'contanti'));
    if v_r->'dati'->>'causale_nome' is distinct from v_c.label then
      raise exception 'VERIFICA (1): la causale non porta il suo nome (%).', v_r->'dati';
    end if;
    if v_forn.id is not null and v_r->'dati'->>'fornitore_nome' is distinct from v_forn.name then
      raise exception 'VERIFICA (2): il fornitore non porta il suo nome (%).', v_r->'dati';
    end if;
  end if;

  -- (3) un carico di merce: il prodotto porta il suo nome.
  if v_ing.id is not null then
    v_r := voce_risolvi_dati('carico_merce', jsonb_build_object('ingredient_id', v_ing.id, 'quantita', 1));
    if v_r->'dati'->>'prodotto_nome' is distinct from v_ing.name then
      raise exception 'VERIFICA (3): il prodotto non porta il suo nome (%).', v_r->'dati';
    end if;
  end if;

  -- (4) un nome vecchio senza il suo identificativo sparisce (non resta un nome orfano).
  v_r := voce_nomi_leggibili(jsonb_build_object('causale_nome', 'ZZ vecchio', 'fornitore_nome', 'ZZ vecchio',
                                                'prodotto_nome', 'ZZ vecchio', 'conto_nome', 'ZZ vecchio'));
  if v_r ? 'causale_nome' or v_r ? 'fornitore_nome' or v_r ? 'prodotto_nome' or v_r ? 'conto_nome' then
    raise exception 'VERIFICA (4): un nome senza identificativo è rimasto (%).', v_r;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Fatto: prima di approvare, MEMO mostra il nome vero di causale, fornitore, prodotto e conto. Provato (nessuna scrittura).';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261125000004', 'prima_di_approvare_si_leggono_i_nomi')
on conflict (version) do nothing;
