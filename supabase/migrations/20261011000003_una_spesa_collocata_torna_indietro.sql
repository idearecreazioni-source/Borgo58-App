-- UNA SPESA COLLOCATA TORNA INDIETRO (11/10/2026, C12 — trovato provando)
--
-- 🔴 IL VICOLO CIECO, trovato al primo collaudo con le mani sul progetto di
--    prova. Una spesa collocata non si poteva piu' toccare:
--      · l'appunto rifiuta ogni modifica e ogni cancellazione («una volta
--        sola», il guardiano della 20261011000002);
--      · il movimento, l'anticipo o il documento che ha generato non si
--        cancellano, perche' l'appunto li tiene con `on delete restrict`.
--    Quindi chi sbaglia destinazione — una spesa sua messa in prima nota
--    invece che nella tasca — non ha nessun gesto per rimediare. Ed e' la
--    regola del 16/08: *ogni rifiuto vuole la sua via di ritorno, un rifiuto
--    senza gesto d'uscita e' un vicolo cieco*. Nella 20261011000002 il
--    rifiuto c'era e la via d'uscita no.
--
-- LA CURA, con la regola del documento che ha generato un effetto (16/08):
--   o si respinge con un messaggio che dice cosa fare prima, oppure si
--   storna anche l'effetto NELLA STESSA TRANSAZIONE. Qui si storna:
--   `annulla_collocazione_spesa` toglie il movimento, l'anticipo o il
--   documento e riporta l'appunto fra quelli da collocare. Si RESPINGE in
--   un caso solo: un anticipo gia' rimborsato, dove e' uscito denaro vero
--   — «ho sbagliato a collocarlo» e «ho sbagliato a rimborsarlo» sono due
--   decisioni diverse.
--
-- ⚠️ E UN APPUNTO CHE NON E' MAI DIVENTATO CONTABILITA' SI PUO' TOGLIERE
--    (`elimina_spesa_da_collocare`): uno da collocare o uno ignorato. E'
--    anche il modo di ripulire le prove, che e' come il difetto e' emerso.
--    Una collocata NO: prima si annulla, e il gesto resta in due passi
--    apposta — chi toglie deve vedere che sta togliendo un movimento vero.
--
-- ⚠️ IL GUARDIANO SI APRE DI UN SOLO PASSO, e lo si dice: ammette il
--    ritorno a «da collocare» solo nella forma esatta — stato, destinazione,
--    data e tutti e tre i legami vuoti insieme. Il resto dell'appunto resta
--    fermo. Non e' una scappatoia: dal browser `spese_da_collocare` si legge
--    e basta (nessun `insert`/`update`/`delete` concesso), quindi l'unica
--    strada che arriva al ritorno e' la funzione qui sotto, che toglie
--    l'effetto nella stessa transazione.

-- ---------------------------------------------------------------------
-- 1. IL GUARDIANO — dal corpo della 20261011000002, piu' il ritorno
-- ---------------------------------------------------------------------
create or replace function guardia_spese_da_collocare()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    if old.stato = 'collocata' then
      raise exception 'Questa spesa e'' gia'' collocata: non si cancella, perche'' ha generato un dato vero. Prima annulla la collocazione, da Cassa → Da collocare.';
    end if;
    return old;
  end if;

  if old.stato <> 'da_collocare' then
    -- 🔴 IL RITORNO, e solo nella sua forma esatta (vedi in testa).
    if new.stato = 'da_collocare'
       and new.collocata_in is null and new.collocata_il is null
       and new.movimento_id is null and new.anticipazione_id is null and new.documento_id is null
       and (new.importo, new.data, new.descrizione, new.controparte, new.foto_path)
           is not distinct from
           (old.importo, old.data, old.descrizione, old.controparte, old.foto_path) then
      return new;
    end if;

    -- ⚠️ L'unica cosa che cambia dopo la collocazione e' la foto che se ne
    --    va: tutto il resto e' fermo.
    if (new.stato, new.collocata_in, new.collocata_il, new.movimento_id,
        new.anticipazione_id, new.documento_id, new.importo, new.data,
        new.descrizione, new.controparte)
       is distinct from
       (old.stato, old.collocata_in, old.collocata_il, old.movimento_id,
        old.anticipazione_id, old.documento_id, old.importo, old.data,
        old.descrizione, old.controparte)
       or (new.foto_path is not null and new.foto_path is distinct from old.foto_path) then
      raise exception 'Questa spesa e'' gia'' stata % il %: una spesa si colloca una volta sola. Se hai sbagliato destinazione, annulla la collocazione e rifalla.',
        case old.stato when 'ignorata' then 'ignorata' else 'collocata' end,
        to_char(old.collocata_il at time zone 'Europe/Rome', 'DD/MM/YYYY');
    end if;
  end if;
  return new;
end $fn$;

revoke all on function guardia_spese_da_collocare() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. I TRE LEGAMI DICONO IN ITALIANO PERCHE' FERMANO
-- ---------------------------------------------------------------------
-- 🔴 «Rimuovi» in Prima nota su un movimento nato da una spesa veniva
--    respinto con «violates foreign key constraint …»: il rifiuto era
--    giusto e la frase illeggibile. La traduzione dei rifiuti
--    (`src/lib/calcoli/vincoli.js`) chiede la frase al commento del vincolo,
--    quindi la frase si scrive qui. I nomi si cercano dal catalogo e non si
--    scrivono a mano: sono quelli che Postgres ha dato da se'.
do $legami$
declare
  r record;
begin
  for r in
    select c.conname, a.attname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.conrelid = 'spese_da_collocare'::regclass
       and c.contype = 'f'
       and a.attname in ('movimento_id', 'anticipazione_id', 'documento_id')
  loop
    execute format('comment on constraint %I on spese_da_collocare is %L', r.conname,
      case r.attname
        when 'movimento_id' then
          'Questo movimento e'' nato da una spesa «Da collocare»: non si toglie da qui. Vai in Cassa → Da collocare, cerca la spesa fra le collocate di recente e premi «Annulla la collocazione»: il movimento se ne va e la spesa torna da collocare.'
        when 'anticipazione_id' then
          'Questo anticipo e'' nato da una spesa «Da collocare»: non si toglie da qui. Vai in Cassa → Da collocare e premi «Annulla la collocazione» su quella spesa.'
        else
          'Questo documento e'' nato da una spesa «Da collocare»: non si toglie da qui. Vai in Cassa → Da collocare e premi «Annulla la collocazione» su quella spesa: il documento se ne va e la foto torna all''appunto.'
      end);
  end loop;
end $legami$;

-- ---------------------------------------------------------------------
-- 3. ANNULLARE LA COLLOCAZIONE — tutto o niente
-- ---------------------------------------------------------------------
create or replace function annulla_collocazione_spesa(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_s     spese_da_collocare%rowtype;
  v_frase text;
begin
  if not is_titolare() then
    raise exception 'Annullare la collocazione di una spesa e'' riservato al titolare.';
  end if;

  select * into v_s from spese_da_collocare where id = p_id for update;
  if not found then
    raise exception 'Questa spesa da collocare non c''e'' piu''.';
  end if;
  if v_s.stato = 'da_collocare' then
    raise exception 'Questa spesa non e'' ancora collocata: non c''e'' niente da annullare.';
  end if;

  -- 🔴 L'UNICO RIFIUTO: un anticipo gia' rimborsato. E' uscito denaro vero.
  if v_s.anticipazione_id is not null
     and exists (select 1 from anticipazioni_socio
                  where id = v_s.anticipazione_id and pareggiata_il is not null) then
    raise exception 'Questo anticipo ti e'' gia'' stato rimborsato: prima annulla il rimborso (Cassa → Ho messo di tasca mia), poi annulla la collocazione.';
  end if;

  -- ⚠️ LA FRASE SI COMPONE PRIMA DI TOGLIERE, come per le note di credito:
  --    dopo, quello che c'era se n'e' andato e non si sa piu' dire cosa.
  v_frase := case
    when v_s.stato = 'ignorata' then 'Non era andata da nessuna parte: torna da collocare.'
    when v_s.collocata_in = 'prima_nota' then 'Tolto il movimento dalla prima nota: la spesa torna da collocare.'
    when v_s.collocata_in = 'tasca' then 'Tolto il movimento dalla tua tasca: la spesa torna da collocare.'
    when v_s.collocata_in = 'anticipo' then 'Tolto l''anticipo: la spesa torna da collocare.'
    when v_s.collocata_in = 'archivio' then 'Tolto il documento dall''Archivio: la foto torna alla spesa, che torna da collocare.'
  end;

  -- Prima si scollega (il legame e' `restrict`), poi si toglie l'effetto.
  -- Tutto nella stessa transazione: se il secondo passo fallisce, il primo
  -- torna indietro con lui e l'appunto resta collocato com'era.
  update spese_da_collocare
     set stato = 'da_collocare', collocata_in = null, collocata_il = null,
         movimento_id = null, anticipazione_id = null, documento_id = null
   where id = p_id;

  if v_s.movimento_id is not null then
    delete from cash_movements where id = v_s.movimento_id;
  end if;
  if v_s.anticipazione_id is not null then
    delete from anticipazioni_socio where id = v_s.anticipazione_id;
  end if;
  -- ⚠️ In Archivio la foto era il file del documento: si toglie la RIGA del
  --    documento, non il file, che torna all'appunto (`foto_path` non e'
  --    mai stato svuotato per l'archivio).
  if v_s.documento_id is not null then
    delete from documents where id = v_s.documento_id;
  end if;

  return jsonb_build_object('frase', v_frase, 'aveva_foto', v_s.foto_path is not null);
end $fn$;

comment on function annulla_collocazione_spesa(uuid) is
  'Riporta una spesa collocata (o ignorata) fra quelle da collocare, togliendo nella stessa transazione il movimento, l''anticipo o il documento che aveva generato. Rifiuta solo un anticipo gia'' rimborsato. Restituisce la frase che dice cosa e'' stato tolto, composta prima di toglierlo.';

revoke all on function annulla_collocazione_spesa(uuid) from public, anon, authenticated;
grant execute on function annulla_collocazione_spesa(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. TOGLIERE UN APPUNTO CHE NON E' MAI DIVENTATO CONTABILITA'
-- ---------------------------------------------------------------------
-- ⚠️ La tabella e' fuori dal registro delle cancellazioni (perimetro
--    deciso nella 20261011000002): un appunto non e' un dato contabile.
-- ⚠️ La foto la toglie poi il browser dal deposito: questa funzione dice
--    quale. Se quel secondo passo fallisce, il file resta orfano e lo trova
--    `npm run deposito:orfani` — l'ordine inverso lascerebbe una riga che
--    nomina un file che non c'e'.
create or replace function elimina_spesa_da_collocare(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_s spese_da_collocare%rowtype;
begin
  if not is_titolare() then
    raise exception 'Togliere una spesa da collocare e'' riservato al titolare.';
  end if;
  select * into v_s from spese_da_collocare where id = p_id for update;
  if not found then
    raise exception 'Questa spesa da collocare non c''e'' piu''.';
  end if;
  -- Il guardiano rifiuta comunque: qui lo si dice prima, con la via d'uscita.
  if v_s.stato = 'collocata' then
    raise exception 'Questa spesa e'' collocata: ha generato un dato vero. Prima annulla la collocazione, poi potrai toglierla.';
  end if;
  delete from spese_da_collocare where id = p_id;
  return jsonb_build_object('foto_da_togliere', v_s.foto_path);
end $fn$;

comment on function elimina_spesa_da_collocare(uuid) is
  'Toglie un appunto da collocare o ignorato (mai uno collocato) e restituisce il percorso della sua foto, che il browser toglie dal deposito.';

revoke all on function elimina_spesa_da_collocare(uuid) from public, anon, authenticated;
grant execute on function elimina_spesa_da_collocare(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. VERIFICA — si prova e si annulla
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_a        uuid;
  v_b        uuid;
  v_r        jsonb;
  v_mov      uuid;
  v_ant      uuid;
  v_doc      uuid;
  v_tag      uuid;
  v_respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;
  if has_function_privilege('anon', 'annulla_collocazione_spesa(uuid)', 'execute')
     or has_function_privilege('anon', 'elimina_spesa_da_collocare(uuid)', 'execute') then
    raise exception 'VERIFICA: una porta nuova delle spese da collocare e'' aperta ad anon.';
  end if;

  begin  -- <<< la sotto-transazione che verra' annullata
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

    -- 1. Prima nota → annulla: il movimento se ne va, la spesa torna.
    v_a := annota_spesa_da_collocare(jsonb_build_object(
      'importo', 21, 'descrizione', 'ZZ verifica ritorno - prima nota'));
    v_mov := (colloca_spesa(v_a, 'prima_nota', jsonb_build_object('mezzo', 'cassa'))->>'movimento_id')::uuid;
    v_r := annulla_collocazione_spesa(v_a);
    if exists (select 1 from cash_movements where id = v_mov)
       or (select stato from spese_da_collocare where id = v_a) is distinct from 'da_collocare'
       or (select importo from spese_da_collocare where id = v_a) is distinct from 21.00
       or v_r->>'frase' not like '%prima nota%' then
      raise exception 'VERIFICA: annullare la prima nota doveva togliere il movimento e riportare la spesa (%).', v_r;
    end if;

    -- 2. E si ricolloca altrove: e' il motivo per cui il ritorno esiste.
    v_mov := (colloca_spesa(v_a, 'tasca', '{}'::jsonb)->>'movimento_id')::uuid;
    if (select e.entity_type::text from cash_movements m join entities e on e.id = m.entity_id
         where m.id = v_mov) is distinct from 'tasca' then
      raise exception 'VERIFICA: dopo il ritorno la spesa non si e'' ricollocata nella tasca.';
    end if;
    perform annulla_collocazione_spesa(v_a);
    if exists (select 1 from cash_movements where id = v_mov) then
      raise exception 'VERIFICA: annullare la tasca non ha tolto il movimento.';
    end if;

    -- 3. Anticipo: si annulla; gia' rimborsato no.
    insert into tag_anticipazioni (etichetta) values ('ZZ verifica ritorno') returning id into v_tag;
    v_ant := (colloca_spesa(v_a, 'anticipo', jsonb_build_object('tag_id', v_tag))->>'anticipazione_id')::uuid;
    v_b := annota_spesa_da_collocare(jsonb_build_object('importo', 3, 'descrizione', 'ZZ verifica ritorno - appoggio'));
    v_mov := (colloca_spesa(v_b, 'prima_nota', '{}'::jsonb)->>'movimento_id')::uuid;
    update anticipazioni_socio set pareggiata_il = current_date, movimento_id = v_mov where id = v_ant;
    v_respinto := false;
    begin
      perform annulla_collocazione_spesa(v_a);
    exception when others then v_respinto := sqlerrm like '%gia'' stato rimborsato%';
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' annullato un anticipo gia'' rimborsato.'; end if;
    if not exists (select 1 from anticipazioni_socio where id = v_ant)
       or (select stato from spese_da_collocare where id = v_a) is distinct from 'collocata' then
      raise exception 'VERIFICA: il rifiuto sull''anticipo rimborsato ha lasciato le cose a meta''.';
    end if;
    update anticipazioni_socio set pareggiata_il = null, movimento_id = null where id = v_ant;
    perform annulla_collocazione_spesa(v_a);
    if exists (select 1 from anticipazioni_socio where id = v_ant) then
      raise exception 'VERIFICA: annullare l''anticipo non l''ha tolto.';
    end if;

    -- 4. Archivio: il documento se ne va, la foto resta all'appunto.
    v_b := annota_spesa_da_collocare(jsonb_build_object(
      'importo', 9, 'descrizione', 'ZZ verifica ritorno - archivio', 'foto_path', 'da-collocare/zz-ritorno.jpg'));
    v_doc := (colloca_spesa(v_b, 'archivio', jsonb_build_object('sezione', 'fatture_ricevute', 'data', '2026-10-11'))->>'documento_id')::uuid;
    perform annulla_collocazione_spesa(v_b);
    if exists (select 1 from documents where id = v_doc)
       or (select foto_path from spese_da_collocare where id = v_b) is distinct from 'da-collocare/zz-ritorno.jpg' then
      raise exception 'VERIFICA: annullare l''archivio doveva togliere il documento e lasciare la foto all''appunto.';
    end if;

    -- 5. Ignorata → torna.
    perform colloca_spesa(v_b, 'ignora', '{}'::jsonb);
    perform annulla_collocazione_spesa(v_b);
    if (select stato from spese_da_collocare where id = v_b) is distinct from 'da_collocare' then
      raise exception 'VERIFICA: una spesa ignorata non e'' tornata da collocare.';
    end if;

    -- 6. Il ritorno e' una forma sola: cambiare altro insieme e' respinto.
    perform colloca_spesa(v_b, 'ignora', '{}'::jsonb);
    v_respinto := false;
    begin
      update spese_da_collocare
         set stato = 'da_collocare', collocata_il = null, importo = 999
       where id = v_b;
    exception when others then v_respinto := sqlerrm like '%una volta sola%';
    end;
    if not v_respinto then raise exception 'VERIFICA: il ritorno ha lasciato cambiare anche l''importo.'; end if;

    -- 7. Togliere: un'ignorata si', una collocata no.
    v_r := elimina_spesa_da_collocare(v_b);
    if exists (select 1 from spese_da_collocare where id = v_b)
       or v_r->>'foto_da_togliere' is distinct from 'da-collocare/zz-ritorno.jpg' then
      raise exception 'VERIFICA: togliere un appunto ignorato doveva toglierlo e dire quale foto (%).', v_r;
    end if;
    perform colloca_spesa(v_a, 'prima_nota', '{}'::jsonb);
    v_respinto := false;
    begin
      perform elimina_spesa_da_collocare(v_a);
    exception when others then v_respinto := sqlerrm like '%Prima annulla la collocazione%';
    end;
    if not v_respinto then raise exception 'VERIFICA: si e'' tolto un appunto collocato.'; end if;

    -- 8. Il portiere.
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_respinto := false;
    begin
      perform annulla_collocazione_spesa(v_a);
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha annullato una collocazione.'; end if;
    v_respinto := false;
    begin
      perform elimina_spesa_da_collocare(v_a);
    exception when others then v_respinto := sqlerrm like '%riservato al titolare%';
    end;
    if not v_respinto then raise exception 'VERIFICA: lo staff ha tolto una spesa da collocare.'; end if;

    raise exception 'ZZ_ANNULLA';  -- <<< qui la sotto-transazione rientra
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica del ritorno delle spese da collocare');

  raise notice 'Fatto: prima nota, tasca, anticipo, archivio e ignorata tornano da collocare togliendo il loro effetto; l''anticipo rimborsato e'' respinto; si toglie solo un appunto mai collocato; lo staff e'' respinto. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261011000003', 'una_spesa_collocata_torna_indietro')
on conflict (version) do nothing;
