-- =====================================================================
-- IL FOGLIO DEL PREVENTIVO — blocco 3 del mandato dei preventivi
-- 20/08/2026
-- =====================================================================
-- Mandato: docs/mandati/20260820_i_preventivi_per_gli_eventi.md
--
-- 🔴 UN TOCCO CIASCUNO, mai un tocco che manda tutto. Alessio: *«inviero'
-- solo quello che fa comodo al cliente»*. E la ragione tecnica e' la stessa:
-- il giorno che di un cliente si ha solo il telefono, un invio unico
-- spedirebbe una mail a un indirizzo inventato pur di partire.
--
-- ⚠️ E I TRE GESTI NON SONO UGUALI FRA LORO, quindi non sono tre pulsanti
-- dello stesso tipo:
--   · il **foglio** si produce e basta — reversibile, non esce di qui;
--   · la **mail** parte davvero — **irreversibile**;
--   · **WhatsApp** apre un messaggio che manda Alessio con le sue mani.
--
-- 🔴 IL FOGLIO CONTIENE SOLO LA VISTA CLIENTE. Nessun costo, nessuna
-- percentuale, nessuna parola «food cost» — e qui pesa piu' che sulla
-- schermata, perche' **il foglio viaggia**: finisce nella posta del cliente,
-- e magari lo gira a qualcun altro. Per questo il contenuto lo compone il
-- DATABASE, in un posto solo: tre schermate che se lo costruiscono per conto
-- proprio sono tre occasioni di lasciarci dentro un numero di troppo.
--
-- 🔴 E IL FOGLIO DICE FINO A QUANDO VALE. Un preventivo e' una promessa di
-- prezzo fatta su un costo di oggi, per una cena fra due mesi: senza una
-- scadenza scritta sopra, **quel foglio resta valido per sempre** in mano a
-- chi l'ha ricevuto.
-- ⚠️ QUANTI GIORNI VALE NON L'HA ANCORA DETTO NESSUNO, quindi la colonna
-- nasce VUOTA e **il foglio si rifiuta di essere prodotto** finche' non c'e'
-- una data. E' la stessa forma dell'esportazione della prima nota che si
-- rifiuta quando la lettura e' tagliata (19/08): *su un foglio che si
-- consegna a qualcuno non esiste una terza strada fra completo e dichiarato
-- incompleto.* Inventare una durata sarebbe decidere al posto di Alessio una
-- cosa che ha conseguenze legali.
--
-- 🔴 E IL FOGLIO SI FOTOGRAFA. Quando si fara' una versione nuova collegata
-- alla vecchia, deve restare possibile sapere **cosa diceva il foglio che il
-- cliente ha in mano** — non ricostruirlo dai dati di oggi, che nel frattempo
-- sono cambiati. Ogni volta che il foglio si produce o si manda, il suo
-- contenuto finisce in `preventivo_fogli`.
-- =====================================================================

alter table preventivi
  add column if not exists valido_fino_al date;

comment on column preventivi.valido_fino_al is
  'Fino a quando vale il prezzo promesso (20/08/2026). ⚠️ Senza, il foglio NON si produce: un preventivo senza scadenza scritta resta valido per sempre in mano a chi l''ha ricevuto.';

alter table service_settings
  add column if not exists giorni_validita_preventivo integer;

alter table service_settings drop constraint if exists giorni_validita_positivi;
alter table service_settings add constraint giorni_validita_positivi
  check (giorni_validita_preventivo is null or giorni_validita_preventivo > 0);

comment on column service_settings.giorni_validita_preventivo is
  'Per quanti giorni vale un preventivo, come valore proposto (20/08/2026). ⚠️ NASCE VUOTA: quanti giorni non l''ha ancora detto nessuno, e una durata inventata da me deciderebbe per quanto tempo Alessio resta legato a un prezzo. Serve una sua riga.';


-- ---------------------------------------------------------------------
-- IL FOGLIO, composto in un posto solo
-- ---------------------------------------------------------------------
create or replace function foglio_preventivo(p_preventivo_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p      preventivi%rowtype;
  v_prezzo record;
  v_righe  jsonb;
  v_extra  jsonb;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then raise exception 'Questo preventivo non esiste.'; end if;

  -- 🔴 IL RIFIUTO, e dice cosa fare. Non e' prudenza: e' che un foglio senza
  -- scadenza, una volta uscito, non si puo' piu' richiamare.
  if v_p.valido_fino_al is null then
    raise exception 'Prima scrivi fino a quando vale questo preventivo: senza una scadenza, il foglio resta valido per sempre in mano a chi lo riceve.';
  end if;

  select * into v_prezzo from prezzo_preventivo(p_preventivo_id);
  if v_prezzo.prezzo_a_persona is null then
    raise exception 'Prima serve un prezzo a persona: un foglio senza prezzo non e'' un preventivo.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('nome', r.name) order by pr.posizione), '[]'::jsonb)
    into v_righe
    from preventivo_righe pr join recipes r on r.id = pr.recipe_id
   where pr.preventivo_id = p_preventivo_id and pr.natura = 'cibo';

  select coalesce(jsonb_agg(jsonb_build_object(
           'descrizione', pr.descrizione,
           'quantita', pr.quantita,
           'importo', round(pr.prezzo * pr.quantita, 2)
         ) order by pr.posizione), '[]'::jsonb)
    into v_extra
    from preventivo_righe pr
   where pr.preventivo_id = p_preventivo_id and pr.natura = 'extra';

  -- ⚠️ QUI DENTRO NON C'E' NESSUN COSTO, e non e' una dimenticanza: e' cio'
  -- che questa funzione esiste per garantire. `prezzo_preventivo` ne
  -- restituisce quattro — costo_cibo, costo_cibo_a_persona, extra_totale e
  -- l'avvertenza col food cost — e nessuno di quelli entra nel foglio.
  return jsonb_build_object(
    'cliente', v_p.cliente_nome,
    'data_evento', v_p.data_evento,
    'ora_evento', v_p.ora_evento,
    'persone', v_p.persone,
    'menu', v_righe,
    'extra', v_extra,
    'prezzo_a_persona', v_prezzo.prezzo_a_persona,
    'totale', round(v_prezzo.prezzo_a_persona * v_p.persone, 2),
    'valido_fino_al', v_p.valido_fino_al,
    'note', v_p.note
  );
end;
$$;

comment on function foglio_preventivo(uuid) is
  'Il contenuto del foglio che il cliente riceve — SOLO la vista cliente, nessun costo (20/08/2026). Composto qui e non nelle schermate: il foglio viaggia, e tre schermate che se lo costruiscono per conto proprio sono tre occasioni di lasciarci dentro un numero di troppo. ⚠️ Si RIFIUTA se manca la scadenza o il prezzo.';


-- ---------------------------------------------------------------------
-- LA FOTOGRAFIA DEL FOGLIO
-- ---------------------------------------------------------------------
create table if not exists preventivo_fogli (
  id            uuid primary key default gen_random_uuid(),
  preventivo_id uuid not null references preventivi(id) on delete cascade,
  prodotto_il   timestamptz not null default clock_timestamp(),
  canale        text not null,
  destinatario  text,
  contenuto     jsonb not null,
  constraint foglio_canale_ammesso check (canale in ('foglio', 'mail', 'whatsapp'))
);

comment on table preventivo_fogli is
  'Cosa diceva il foglio che il cliente ha in mano, fotografato ogni volta che si produce o si manda (20/08/2026). ⚠️ Serve quando si fa una versione nuova: ricostruirlo dai dati di oggi darebbe il preventivo di oggi, non quello che il cliente ha ricevuto.';

create index if not exists idx_preventivo_fogli on preventivo_fogli (preventivo_id, prodotto_il desc);

alter table preventivo_fogli enable row level security;

drop policy if exists preventivo_fogli_titolare on preventivo_fogli;
create policy preventivo_fogli_titolare on preventivo_fogli
  for select to authenticated using ((select is_titolare()));

create or replace function registra_foglio_preventivo(
  p_preventivo_id uuid,
  p_canale text,
  p_destinatario text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contenuto jsonb;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;

  v_contenuto := foglio_preventivo(p_preventivo_id);

  insert into preventivo_fogli (preventivo_id, canale, destinatario, contenuto)
  values (p_preventivo_id, p_canale, nullif(btrim(p_destinatario), ''), v_contenuto);

  return v_contenuto;
end;
$$;


-- ---------------------------------------------------------------------
-- LA MAIL — l'unico dei tre gesti che è irreversibile
-- ---------------------------------------------------------------------
-- ⚠️ Riusa `email-cliente`, che custodisce la chiave del servizio di invio e
-- vive dall'11/08: una seconda funzione online con una seconda copia della
-- chiave sarebbe un secondo posto da tenere allineato.
create or replace function invia_preventivo_per_email(p_preventivo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p         preventivi%rowtype;
  v_contenuto jsonb;
  v_firma     text;
  v_anon      text;
  v_base      text;
begin
  if not is_titolare() then
    raise exception 'I preventivi sono riservati al titolare.';
  end if;
  select * into v_p from preventivi where id = p_preventivo_id;
  if not found then raise exception 'Questo preventivo non esiste.'; end if;

  -- ⚠️ Il rifiuto viene PRIMA di tutto il resto: senza indirizzo non si manda
  -- niente, e non si scrive nemmeno una fotografia che direbbe il falso.
  if coalesce(btrim(v_p.cliente_email), '') = '' then
    raise exception 'Di questo cliente non hai l''email. Scrivila sul preventivo, oppure mandaglielo su WhatsApp.';
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  if v_firma is null or v_anon is null then
    raise exception 'Non posso mandare la mail: manca la parola d''ordine nel Vault.';
  end if;

  -- La fotografia si scrive PRIMA della chiamata, come per l'email di
  -- conferma: meglio una traccia di un invio che poi fallisce, che un invio
  -- riuscito di cui non resta niente.
  v_contenuto := registra_foglio_preventivo(p_preventivo_id, 'mail', v_p.cliente_email);

  perform net.http_post(
    url := v_base || '/email-cliente',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := jsonb_build_object(
      'tipo', 'preventivo',
      'preventivo', v_contenuto || jsonb_build_object('email', v_p.cliente_email)
    )
  );

  return v_contenuto;
end;
$$;

revoke all on function foglio_preventivo(uuid) from public, anon, authenticated;
grant execute on function foglio_preventivo(uuid) to authenticated;
revoke all on function registra_foglio_preventivo(uuid, text, text) from public, anon, authenticated;
grant execute on function registra_foglio_preventivo(uuid, text, text) to authenticated;
revoke all on function invia_preventivo_per_email(uuid) from public, anon, authenticated;
grant execute on function invia_preventivo_per_email(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- VERIFICA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_ing    uuid;
  v_piatto uuid;
  v_prev   uuid;
  v_f      jsonb;
  v_ok     boolean;
  v_msg    text;
  v_n      integer;
  v_lap_p  integer;
  v_lap_d  integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_lap_p from deleted_records;
  select id into v_ente from entities order by created_at limit 1;

  insert into ingredients (entity_id, name, category, unit, current_price, waste_percentage_default)
    values (v_ente, '__VERIFICA__ foglio alice', 'pesce', 'kg', 4, 0) returning id into v_ing;
  insert into recipes (name, category, portions_yield, recipe_type, pronta_per_carta)
    values ('__VERIFICA__ foglio piatto', 'antipasto', 4, 'piatto_finito', true) returning id into v_piatto;
  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
    values (v_piatto, v_ing, 2, 'kg');

  v_prev := salva_preventivo(null,
    jsonb_build_object('entity_id', v_ente, 'cliente_nome', '__VERIFICA__ foglio cliente',
                       'data_evento', '1995-11-10', 'persone', 10,
                       'food_cost_obiettivo_percento', 25),
    jsonb_build_array(
      jsonb_build_object('natura', 'cibo', 'recipe_id', v_piatto, 'porzioni_per_persona', 1),
      jsonb_build_object('natura', 'extra', 'descrizione', 'Cameriere in piu''',
                         'quantita', 1, 'prezzo', 120)
    ));

  -- 1 · SENZA SCADENZA IL FOGLIO SI RIFIUTA, e dice cosa fare.
  v_ok := false;
  begin
    perform foglio_preventivo(v_prev);
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    v_ok := v_msg like '%fino a quando vale%';
  end;
  if not v_ok then
    raise exception 'Il foglio e'' stato prodotto senza scadenza (messaggio: %).', coalesce(v_msg, 'nessuno');
  end if;

  -- 2 · CON LA SCADENZA SI PRODUCE, e la porta scritta.
  update preventivi set valido_fino_al = date '1995-10-01' where id = v_prev;
  v_f := foglio_preventivo(v_prev);
  if (v_f->>'valido_fino_al') <> '1995-10-01' then
    raise exception 'Il foglio non porta la scadenza.';
  end if;

  -- 3 · 🔴 NESSUN COSTO NEL FOGLIO. E' il controllo che vale piu' di tutti:
  --     quel foglio finisce nella posta del cliente.
  if v_f ? 'costo_cibo' or v_f ? 'costo_cibo_a_persona' or v_f ? 'extra_totale'
     or v_f ? 'food_cost_obiettivo_percento' or v_f ? 'avvertenza' then
    raise exception 'Il foglio contiene un costo: %', v_f;
  end if;
  if v_f::text ilike '%food cost%' then
    raise exception 'Il foglio contiene la parola «food cost».';
  end if;

  -- 4 · E il prezzo c'e', altrimenti il controllo di sopra passerebbe anche
  --     su un foglio vuoto.
  -- 10 persone x 1 porzione su un piatto da 4 = 2,5 dosi x 2 kg x 4 = 20,00
  -- di cibo; 20 / 0,25 = 80; + 120 = 200 / 10 = 20,00 a persona.
  if round((v_f->>'prezzo_a_persona')::numeric, 2) <> 20.00 then
    raise exception 'Il prezzo sul foglio e'' % invece di 20,00.', v_f->>'prezzo_a_persona';
  end if;
  if round((v_f->>'totale')::numeric, 2) <> 200.00 then
    raise exception 'Il totale sul foglio e'' % invece di 200,00.', v_f->>'totale';
  end if;

  -- 5 · IL FOGLIO SI FOTOGRAFA, e la fotografia non cambia se il preventivo
  --     cambia dopo. ⚠️ E' tutta qui la ragione della tabella.
  perform registra_foglio_preventivo(v_prev, 'foglio', null);
  update preventivi set prezzo_a_persona_scavalcato = 99 where id = v_prev;
  select (contenuto->>'prezzo_a_persona')::numeric into v_f
    from preventivo_fogli where preventivo_id = v_prev order by prodotto_il desc limit 1;
  if round(v_f::text::numeric, 2) <> 20.00 then
    raise exception 'La fotografia del foglio e'' cambiata col preventivo: %.', v_f;
  end if;
  update preventivi set prezzo_a_persona_scavalcato = null where id = v_prev;

  -- 6 · SENZA EMAIL NON SI MANDA NIENTE, e non resta nemmeno una fotografia
  --     che direbbe il falso.
  select count(*) into v_n from preventivo_fogli where preventivo_id = v_prev;
  v_ok := false;
  begin
    perform invia_preventivo_per_email(v_prev);
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    v_ok := v_msg like '%non hai l%email%';
  end;
  if not v_ok then
    raise exception 'Una mail e'' partita senza indirizzo (messaggio: %).', coalesce(v_msg, 'nessuno');
  end if;
  if (select count(*) from preventivo_fogli where preventivo_id = v_prev) <> v_n then
    raise exception 'Un invio rifiutato ha lasciato la fotografia di un foglio mai mandato.';
  end if;

  -- =========== PULIZIA ===========
  delete from preventivo_fogli where preventivo_id = v_prev;
  delete from preventivo_righe where preventivo_id = v_prev;
  delete from preventivi where id = v_prev;
  delete from recipe_ingredients
    where recipe_id in (select id from recipes where name like '__VERIFICA__ foglio%');
  delete from storico_costi_ricetta
    where recipe_id in (select id from recipes where name like '__VERIFICA__ foglio%');
  delete from recipes where name like '__VERIFICA__ foglio%';
  delete from ingredients where name like '__VERIFICA__ foglio%';

  select count(*) into v_lap_d from deleted_records;
  if v_lap_d <> v_lap_p then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', v_lap_d - v_lap_p;
  end if;
  if exists (select 1 from preventivi where cliente_nome like '__VERIFICA__%') then
    raise exception 'La verifica ha lasciato delle righe finte.';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Il foglio dice fino a quando vale, non contiene nessun costo, e si fotografa.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260820000007', 'il_foglio_del_preventivo')
on conflict (version) do nothing;
