-- =====================================================================
-- LE SOTTOVOCI DEL PIANO DELL'INVESTIMENTO
-- 12/11/2026 — modello approvato da Alessio l'11/11
-- (https://claude.ai/artifact/ARhaRmdURjj5SnnPm3KiVD)
-- =====================================================================
--
-- Ogni voce del piano (TUTTE) si può aprire in sottovoci: «Attrezzature
-- cucina» → Abbattitore, Forno, Lavastoviglie… Ogni sottovoce ha la sua
-- cifra, il suo stato, le sue rate e le sue spese collegate.
--
-- 🔴 UNA SOTTOVOCE È UNA VOCE, con `madre_id` riempito. Così rate,
--    collegamenti, speso, previsione e MEMO, che lavorano tutti per
--    `voce_id`, valgono per le sottovoci senza essere riscritti.
--
-- 🔴 LA MADRE NON SI SCRIVE A MANO: quando una voce ha sottovoci,
--    · la sua cifra è la somma delle sottovoci vive;
--    · il suo stato è «confermato» solo se lo sono tutte, «stimato» se
--      almeno una è stimata, altrimenti «preventivato»;
--    · non ha rate né spese collegate sue: stanno sulle sottovoci.
--    Lo fa il database, così la pagina, MEMO e il foglio dicono la stessa
--    cosa. Cambiare a mano cifra o stato di una madre si rifiuta, con la
--    ragione (anche quando lo chiede MEMO).
--
-- ⚠️ UN LIVELLO SOLO: una sottovoce non ha sottovoci.
-- ⚠️ La prima sottovoce non si aggiunge a una voce che ha già rate o
--    spese collegate: andrebbero perse di vista. Si spostano prima.
--    (Il piano di Alessio si ricarica da capo, quindi non serve spostarle
--    da sole.)
-- ⚠️ Archiviare la madre archivia le sottovoci; riprenderla le riprende.
--    Con tutte le sottovoci archiviate la madre vale zero, e torna alla
--    somma quando le riprendi.
-- ⚠️ Se si cancella l'ultima sottovoce, la voce torna normale e tiene la
--    cifra che aveva: la si cambia a mano, come ogni voce.
-- ⚠️ MEMO: chiedere di cambiare cifra o stato di una madre si rifiuta al
--    sì, con la frase qui sotto (revisione ecc:database-reviewer, 12/11).
--
-- Idempotente, con verifica finale annullata (zero residui).
-- =====================================================================

alter table piano_voci add column if not exists madre_id uuid;

do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'piano_voce_madre_esiste') then
    alter table piano_voci
      add constraint piano_voce_madre_esiste foreign key (madre_id) references piano_voci(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'piano_voce_non_madre_di_se') then
    alter table piano_voci
      add constraint piano_voce_non_madre_di_se check (madre_id is null or madre_id <> id);
  end if;
end $fk$;

comment on column piano_voci.madre_id is
  'Se riempito, questa voce è una sottovoce di quella indicata (12/11/2026). La madre ha cifra e stato calcolati dalle sottovoci, e niente rate o spese sue.';
comment on constraint piano_voce_madre_esiste on piano_voci is
  'Questa voce ha delle sottovoci: archiviala, oppure cancella prima le sottovoci.';
comment on constraint piano_voce_non_madre_di_se on piano_voci is
  'Una voce non può essere sottovoce di sé stessa.';

create index if not exists idx_piano_voci_madre on piano_voci(madre_id) where madre_id is not null;

-- ---------------------------------------------------------------------------
-- 1. Il portiere della voce: un livello solo, gruppo della madre, madre
--    calcolata e non scritta a mano.
-- ---------------------------------------------------------------------------
create or replace function piano_sottovoce_controlla()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_madre    piano_voci%rowtype;
  v_figlie   integer;
  v_somma    numeric;
  v_stati    text[];
begin
  -- (a) È una sottovoce.
  if new.madre_id is not null then
    select * into v_madre from piano_voci where id = new.madre_id for update;
    if not found then
      raise exception 'La voce madre non c''è più.';
    end if;
    if v_madre.madre_id is not null then
      raise exception '«%» è già una sottovoce: una sottovoce non può avere sottovoci.', v_madre.descrizione;
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from piano_voci f where f.madre_id = new.id) then
      raise exception '«%» ha delle sottovoci: non può diventare a sua volta una sottovoce.', new.descrizione;
    end if;
    -- La prima sottovoce di una voce che ha già rate o spese: si rifiuta.
    if (tg_op = 'INSERT' or old.madre_id is distinct from new.madre_id)
       and not exists (select 1 from piano_voci f where f.madre_id = v_madre.id and f.id <> new.id)
       and (exists (select 1 from piano_rate r where r.voce_id = v_madre.id)
            or exists (select 1 from piano_collegamenti c where c.voce_id = v_madre.id)) then
      raise exception '«%» ha già delle rate o delle spese collegate: toglile (o spostale) prima di dividerla in sottovoci.', v_madre.descrizione;
    end if;
    new.gruppo := v_madre.gruppo;
    return new;
  end if;

  -- (b) È una voce con sottovoci: cifra e stato vengono da lì.
  if tg_op = 'UPDATE' then
    select count(*), coalesce(sum(importo_ivato), 0), array_agg(distinct stato)
      into v_figlie, v_somma, v_stati
      from piano_voci f
     where f.madre_id = new.id and f.archiviata_il is null;
    if exists (select 1 from piano_voci f where f.madre_id = new.id) then
      if current_setting('piano.ricalcolo', true) is distinct from 'si' then
        if new.importo_ivato is distinct from old.importo_ivato then
          raise exception 'La cifra di «%» è la somma delle sue sottovoci: cambia le sottovoci, non la voce.', new.descrizione;
        end if;
        if new.stato is distinct from old.stato then
          raise exception 'Lo stato di «%» viene dalle sue sottovoci: è confermato quando lo sono tutte.', new.descrizione;
        end if;
      end if;
      new.importo_ivato := v_somma;
      new.stato := case
        when v_figlie = 0 then new.stato
        when v_stati = array['confermato'] then 'confermato'
        when 'stimato' = any(v_stati) then 'stimato'
        else 'preventivato'
      end;
    end if;
  end if;
  return new;
end $fn$;

comment on function piano_sottovoce_controlla() is
  'Le sottovoci del piano (12/11/2026): un livello solo, il gruppo è quello della madre, e la madre ha cifra e stato calcolati dalle sottovoci.';

drop trigger if exists piano_sottovoce_controlla on piano_voci;
create trigger piano_sottovoce_controlla
  before insert or update on piano_voci
  for each row execute function piano_sottovoce_controlla();

-- ---------------------------------------------------------------------------
-- 2. Quando una sottovoce cambia, la madre si ricalcola; quando la madre si
--    archivia o si riprende, le sottovoci la seguono.
-- ---------------------------------------------------------------------------
create or replace function piano_madre_ricalcola()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_madri uuid[];
begin
  if tg_op = 'UPDATE' and new.madre_id is null
     and new.archiviata_il is distinct from old.archiviata_il
     and exists (select 1 from piano_voci f where f.madre_id = new.id) then
    -- La madre archiviata (o ripresa) porta con sé le sottovoci che stavano
    -- con lei; quelle archiviate per conto loro restano dove sono.
    update piano_voci
       set archiviata_il = new.archiviata_il
     where madre_id = new.id
       and archiviata_il is not distinct from old.archiviata_il;
    return null;
  end if;

  v_madri := array_remove(array[
    case when tg_op <> 'INSERT' then old.madre_id end,
    case when tg_op <> 'DELETE' then new.madre_id end], null);
  if cardinality(v_madri) > 0 then
    perform set_config('piano.ricalcolo', 'si', true);
    update piano_voci set updated_at = now() where id = any(v_madri);
    perform set_config('piano.ricalcolo', '', true);
  end if;
  return null;
end $fn$;

comment on function piano_madre_ricalcola() is
  'Ricalcola la voce madre quando una sua sottovoce cambia, e porta le sottovoci con la madre quando la si archivia o la si riprende (12/11/2026).';

drop trigger if exists piano_madre_ricalcola on piano_voci;
create trigger piano_madre_ricalcola
  after insert or update or delete on piano_voci
  for each row execute function piano_madre_ricalcola();

-- ---------------------------------------------------------------------------
-- 3. Niente rate né spese collegate su una voce che ha sottovoci.
-- ---------------------------------------------------------------------------
create or replace function piano_niente_sulla_madre()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_nome text;
begin
  select v.descrizione into v_nome
    from piano_voci v
   where v.id = new.voce_id
     and exists (select 1 from piano_voci f where f.madre_id = v.id);
  if found then
    if tg_table_name = 'piano_rate' then
      raise exception '«%» è divisa in sottovoci: metti la rata sulla sottovoce giusta.', v_nome;
    end if;
    raise exception '«%» è divisa in sottovoci: collega la spesa alla sottovoce giusta.', v_nome;
  end if;
  return new;
end $fn$;

comment on function piano_niente_sulla_madre() is
  'Una voce divisa in sottovoci non ha rate né spese sue: stanno sulle sottovoci (12/11/2026).';

drop trigger if exists piano_rata_non_sulla_madre on piano_rate;
create trigger piano_rata_non_sulla_madre
  before insert or update of voce_id on piano_rate
  for each row execute function piano_niente_sulla_madre();

drop trigger if exists piano_collegamento_non_sulla_madre on piano_collegamenti;
create trigger piano_collegamento_non_sulla_madre
  before insert or update of voce_id on piano_collegamenti
  for each row execute function piano_niente_sulla_madre();

revoke all on function piano_sottovoce_controlla() from public, anon, authenticated;
revoke all on function piano_madre_ricalcola() from public, anon, authenticated;
revoke all on function piano_niente_sulla_madre() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICA — dentro una sotto-transazione che si annulla
-- ---------------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_madre    uuid;
  v_forno    uuid;
  v_abbatt   uuid;
  v_altra    uuid;
  v_v        piano_voci%rowtype;
  v_rifiuto  boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'VERIFICA: serve un titolare.';
  end if;

  begin  -- <<< la sotto-transazione che verrà annullata
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    set local role authenticated;

    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato, stato)
    values ('A', 997, 'ZZ cucina della verifica', 15000, 'stimato') returning id into v_madre;

    -- (1) Due sottovoci: la madre fa la somma, prende il gruppo, e lo stato.
    insert into piano_voci (gruppo, descrizione, importo_ivato, stato, madre_id)
    values ('D', 'ZZ forno', 1000, 'confermato', v_madre) returning id into v_forno;
    insert into piano_voci (gruppo, descrizione, importo_ivato, stato, madre_id)
    values ('A', 'ZZ abbattitore', 850, 'preventivato', v_madre) returning id into v_abbatt;
    select * into v_v from piano_voci where id = v_madre;
    if v_v.importo_ivato <> 1850 or v_v.stato <> 'preventivato' then
      raise exception 'VERIFICA (1): la madre dice % e «%», invece di 1850 e «preventivato».', v_v.importo_ivato, v_v.stato;
    end if;
    if (select gruppo from piano_voci where id = v_forno) <> 'A' then
      raise exception 'VERIFICA (1): la sottovoce non ha preso il gruppo della madre.';
    end if;

    -- (2) Tutte confermate → la madre è confermata; una cambia cifra → la somma segue.
    update piano_voci set stato = 'confermato', importo_ivato = 900 where id = v_abbatt;
    select * into v_v from piano_voci where id = v_madre;
    if v_v.importo_ivato <> 1900 or v_v.stato <> 'confermato' then
      raise exception 'VERIFICA (2): dopo la modifica la madre dice % e «%».', v_v.importo_ivato, v_v.stato;
    end if;

    -- (3) La cifra o lo stato della madre a mano si rifiutano.
    v_rifiuto := false;
    begin
      update piano_voci set importo_ivato = 20000 where id = v_madre;
    exception when raise_exception then v_rifiuto := sqlerrm like '%somma delle sue sottovoci%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (3): la cifra della madre si è cambiata a mano.'; end if;

    -- (4) Niente rate né spese sulla madre.
    v_rifiuto := false;
    begin
      insert into piano_rate (voce_id, mese_rel, importo) values (v_madre, 0, 100);
    exception when raise_exception then v_rifiuto := sqlerrm like '%metti la rata sulla sottovoce%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (4): una rata è entrata sulla madre.'; end if;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_forno, 0, 1000);

    -- (5) Un livello solo.
    v_rifiuto := false;
    begin
      insert into piano_voci (gruppo, descrizione, importo_ivato, madre_id) values ('A', 'ZZ nipote', 10, v_forno);
    exception when raise_exception then v_rifiuto := sqlerrm like '%non può avere sottovoci%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (5): è entrata una sottovoce di una sottovoce.'; end if;

    -- (6) La prima sottovoce di una voce con rate si rifiuta.
    insert into piano_voci (gruppo, ordine, descrizione, importo_ivato) values ('B', 997, 'ZZ voce con rata', 500) returning id into v_altra;
    insert into piano_rate (voce_id, mese_rel, importo) values (v_altra, 0, 500);
    v_rifiuto := false;
    begin
      insert into piano_voci (gruppo, descrizione, importo_ivato, madre_id) values ('B', 'ZZ figlia', 10, v_altra);
    exception when raise_exception then v_rifiuto := sqlerrm like '%prima di dividerla%';
    end;
    if not v_rifiuto then raise exception 'VERIFICA (6): una voce con rate si è divisa in sottovoci.'; end if;

    -- (7) Archiviare la madre archivia le sottovoci; riprenderla le riprende.
    update piano_voci set archiviata_il = now() where id = v_madre;
    if exists (select 1 from piano_voci where madre_id = v_madre and archiviata_il is null) then
      raise exception 'VERIFICA (7): archiviata la madre, una sottovoce è rimasta viva.';
    end if;
    update piano_voci set archiviata_il = null where id = v_madre;
    select * into v_v from piano_voci where id = v_madre;
    if exists (select 1 from piano_voci where madre_id = v_madre and archiviata_il is not null) or v_v.importo_ivato <> 1900 then
      raise exception 'VERIFICA (7): ripresa la madre, le sottovoci o la somma non sono tornate (%).', v_v.importo_ivato;
    end if;

    -- (8) Una sottovoce archiviata da sola esce dalla somma.
    update piano_voci set archiviata_il = now() where id = v_abbatt;
    if (select importo_ivato from piano_voci where id = v_madre) <> 1000 then
      raise exception 'VERIFICA (8): la sottovoce archiviata è rimasta nella somma.';
    end if;

    reset role;
    perform set_config('request.jwt.claims', null, true);
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle sottovoci del piano');

  raise notice 'Fatto: le voci del piano si dividono in sottovoci; la madre fa la somma e prende lo stato dalle sottovoci, senza rate né spese sue. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000002', 'le_sottovoci_del_piano')
on conflict (version) do nothing;
