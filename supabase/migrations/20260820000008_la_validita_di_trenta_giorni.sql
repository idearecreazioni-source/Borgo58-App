-- =====================================================================
-- LA VALIDITA' DI UN PREVENTIVO: TRENTA GIORNI
-- 20/08/2026
-- =====================================================================
-- Deciso da Alessio, come valore PROPOSTO e modificabile su ogni
-- preventivo. La colonna era nata vuota apposta il 20/08: una durata
-- inventata da me avrebbe deciso **per quanto tempo lui resta legato a un
-- prezzo mentre i suoi costi si muovono**.
--
-- ⚠️ E LA SCADENZA SI SCRIVE SUL FOGLIO, non solo si tiene dentro: serve a
-- poter rinegoziare senza discussioni con chi tiene in mano un preventivo di
-- tre mesi fa. Nel foglio c'era gia' (`foglio_preventivo` la mette, e la mail
-- e WhatsApp la stampano); 🔴 **mancava nella vista che si STAMPA**, cioe'
-- proprio sul foglio di carta — corretto nella schermata insieme a questa
-- migrazione.
--
-- ⚠️ Si scrive SOLO se la colonna e' ancora vuota: e' un valore di partenza,
-- e riapplicare la migrazione non deve riportare indietro una scelta di
-- Alessio (lezione del 15/08).
-- =====================================================================

update service_settings
   set giorni_validita_preventivo = 30
 where id = 1 and giorni_validita_preventivo is null;


-- ---------------------------------------------------------------------
-- LA SCADENZA SI PROPONE DA SE'
-- ---------------------------------------------------------------------
-- ⚠️ Solo su un preventivo NUOVO e solo se chi chiama non ne ha passata una:
-- proporla anche in correzione riporterebbe avanti una scadenza che Alessio
-- aveva accorciato a mano.
-- ⚠️ E si conta da `oggi_a_roma()`, mai da `current_date`: il database vive a
-- Greenwich, e fra mezzanotte e le due un preventivo nascerebbe con un giorno
-- di validita' in meno. E' la trappola dei 18 punti misurati il 18/08.
create or replace function salva_preventivo(
  p_preventivo_id uuid,
  p_testata jsonb,
  p_righe   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := p_preventivo_id;
  v_riga jsonb;
  v_i    integer := 0;
  v_gg   integer;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;

  if v_id is null then
    select giorni_validita_preventivo into v_gg from service_settings where id = 1;

    insert into preventivi (
      entity_id, versione_di, customer_id, cliente_nome, cliente_telefono,
      cliente_email, data_evento, ora_evento, persone, stato,
      food_cost_obiettivo_percento, prezzo_a_persona_scavalcato, note,
      valido_fino_al
    ) values (
      (p_testata->>'entity_id')::uuid,
      nullif(p_testata->>'versione_di','')::uuid,
      nullif(p_testata->>'customer_id','')::uuid,
      p_testata->>'cliente_nome',
      nullif(p_testata->>'cliente_telefono',''),
      nullif(p_testata->>'cliente_email',''),
      (p_testata->>'data_evento')::date,
      nullif(p_testata->>'ora_evento','')::time,
      (p_testata->>'persone')::integer,
      coalesce(nullif(p_testata->>'stato',''), 'bozza'),
      coalesce(nullif(p_testata->>'food_cost_obiettivo_percento','')::numeric,
               (select s.food_cost_obiettivo_percento from service_settings s where s.id = 1)),
      nullif(p_testata->>'prezzo_a_persona_scavalcato','')::numeric,
      nullif(p_testata->>'note',''),
      coalesce(
        nullif(p_testata->>'valido_fino_al','')::date,
        case when v_gg is not null then oggi_a_roma() + v_gg else null end
      )
    ) returning id into v_id;
  else
    update preventivi set
      customer_id      = nullif(p_testata->>'customer_id','')::uuid,
      cliente_nome     = p_testata->>'cliente_nome',
      cliente_telefono = nullif(p_testata->>'cliente_telefono',''),
      cliente_email    = nullif(p_testata->>'cliente_email',''),
      data_evento      = (p_testata->>'data_evento')::date,
      ora_evento       = nullif(p_testata->>'ora_evento','')::time,
      persone          = (p_testata->>'persone')::integer,
      stato            = coalesce(nullif(p_testata->>'stato',''), stato),
      prezzo_a_persona_scavalcato = nullif(p_testata->>'prezzo_a_persona_scavalcato','')::numeric,
      note             = nullif(p_testata->>'note',''),
      -- ⚠️ In correzione la scadenza si tocca solo se chi chiama la nomina:
      -- una chiave assente vuol dire «non l'ho toccata», non «cancellala».
      valido_fino_al   = case when p_testata ? 'valido_fino_al'
                              then nullif(p_testata->>'valido_fino_al','')::date
                              else valido_fino_al end
     where id = v_id;
    if not found then raise exception 'Questo preventivo non esiste piu''.'; end if;
    delete from preventivo_righe where preventivo_id = v_id;
  end if;

  for v_riga in select * from jsonb_array_elements(coalesce(p_righe, '[]'::jsonb)) loop
    insert into preventivo_righe
      (preventivo_id, natura, recipe_id, descrizione, porzioni_per_persona, quantita, prezzo, posizione)
    values (
      v_id,
      v_riga->>'natura',
      nullif(v_riga->>'recipe_id','')::uuid,
      nullif(v_riga->>'descrizione',''),
      coalesce(nullif(v_riga->>'porzioni_per_persona','')::numeric, 1),
      nullif(v_riga->>'quantita','')::numeric,
      nullif(v_riga->>'prezzo','')::numeric,
      v_i
    );
    v_i := v_i + 1;
  end loop;

  update preventivi
     set costo_cibo = costo_cibo_preventivo(v_id),
         costo_rilevato_il = now()
   where id = v_id;

  return v_id;
end;
$$;

revoke all on function salva_preventivo(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function salva_preventivo(uuid, jsonb, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_ente  uuid;
  v_prev  uuid;
  v_data  date;
  v_gg    integer;
  v_lap_p integer;
  v_lap_d integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  select giorni_validita_preventivo into v_gg from service_settings where id = 1;
  if v_gg <> 30 then
    raise exception 'La validita'' proposta e'' % invece di 30 giorni.', coalesce(v_gg::text, 'vuota');
  end if;

  -- 1 · UN PREVENTIVO NUOVO NASCE CON LA SUA SCADENZA.
  v_prev := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ validita',
                       'data_evento', '1995-12-01', 'persone', 4),
    '[]'::jsonb);
  select valido_fino_al into v_data from preventivi where id = v_prev;
  if v_data is distinct from (oggi_a_roma() + 30) then
    raise exception 'La scadenza proposta e'' % invece di %.', v_data, oggi_a_roma() + 30;
  end if;

  -- 2 · UNA SCADENZA SCRITTA A MANO VINCE sulla proposta.
  perform salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ validita mano',
                       'data_evento', '1995-12-01', 'persone', 4,
                       'valido_fino_al', '1995-11-05'),
    '[]'::jsonb);
  if (select valido_fino_al from preventivi where cliente_nome = '__VERIFICA__ validita mano')
     <> date '1995-11-05' then
    raise exception 'La scadenza scritta a mano e'' stata sovrascritta dalla proposta.';
  end if;

  -- 3 · 🔴 CORREGGENDO IL PREVENTIVO LA SCADENZA NON SI MUOVE. Senza questo
  --     controllo, ogni salvataggio avrebbe riportato avanti una scadenza che
  --     Alessio aveva accorciato a mano — e nessuno se ne sarebbe accorto.
  update preventivi set valido_fino_al = date '1995-10-10' where id = v_prev;
  perform salva_preventivo(v_prev,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ validita',
                       'data_evento', '1995-12-01', 'persone', 6),
    '[]'::jsonb);
  select valido_fino_al into v_data from preventivi where id = v_prev;
  if v_data <> date '1995-10-10' then
    raise exception 'Correggendo il preventivo la scadenza si e'' spostata a %.', v_data;
  end if;

  -- =========== PULIZIA ===========
  delete from preventivo_fogli
    where preventivo_id in (select id from preventivi where cliente_nome like '__VERIFICA__ validita%');
  delete from preventivo_righe
    where preventivo_id in (select id from preventivi where cliente_nome like '__VERIFICA__ validita%');
  delete from preventivi where cliente_nome like '__VERIFICA__ validita%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from preventivi where cliente_nome like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Un preventivo nasce valido trenta giorni, e correggendolo la scadenza non si muove.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000008', 'la_validita_di_trenta_giorni')
on conflict (version) do nothing;
