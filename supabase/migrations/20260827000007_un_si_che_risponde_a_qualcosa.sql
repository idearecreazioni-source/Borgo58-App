-- ============================================================================
-- UN «SÌ» CHE RISPONDE A QUALCOSA — 27/08/2026
-- ============================================================================
--
-- 🔴 IL DIFETTO, visto a schermo da Alessio. Il gestionale scriveva:
--    *«ho trovato due prodotti che potrebbero essere questo: Sale e Sale
--    marino di Trapani, non so quale intendi»* — e sotto offriva un
--    pulsante che dice **«Sì, fallo»**.
--
--    Sì a cosa? Dove l'incertezza è su **QUALE**, un pulsante unico è la
--    risposta a una domanda che non è stata fatta. E premerlo rifà la
--    stessa cosa e fallisce di nuovo, perché quello che manca non è un
--    permesso: è un'informazione.
--
-- ----------------------------------------------------------------------------
-- LE TRE DOMANDE, E SONO TRE SCHERMATE DIVERSE
-- ----------------------------------------------------------------------------
-- Camminate tutte le strade per cui una riga resta in sospeso, le domande
-- che il gestionale sta facendo sono **tre**, non una:
--
--   · `se`     — è tutto chiaro e manca solo il permesso. È il caso delle
--                quattro cose di natura `creazione` (movimento di cassa,
--                carico merce, prodotto nuovo, ricetta): il gestionale ha
--                capito tutto e aspetta l'occhio di Alessio. **Qui «Sì,
--                fallo» è la risposta giusta.**
--   · `scegli` — il modello ha trovato più di un candidato e li ha
--                nominati. Qui non manca un permesso: manca **quale**. Si
--                toccano i candidati, e «Sì, fallo» non ha senso.
--   · `manca`  — manca un'informazione che il gestionale **non può
--                proporre**: quale frigo, quanti soldi, quale prodotto fra
--                tutti quelli che esistono. Nemmeno qui «Sì, fallo» ha
--                senso: si ridetta, o si va a mano.
--
-- ⚠️ LA DOMANDA LA DECIDE IL DATABASE, NON LA SCHERMATA, e riusa la
--    funzione che già sa cosa manca (`voce_risolvi_dati`). Scritta nel
--    browser sarebbe una seconda definizione di «cosa manca a questa
--    riga», e il giorno che le due divergono la schermata offrirebbe un
--    pulsante che il database rifiuta.
--
-- ----------------------------------------------------------------------------
-- I CANDIDATI ARRIVANO COME NUMERI, E QUI DIVENTANO NOMI
-- ----------------------------------------------------------------------------
-- Il modello, quando non sa scegliere, mette in `dati.candidati` i numeri
-- del catalogo che ha trovato. Il database li ritraduce in nomi veri —
-- **la stessa numerazione che li ha prodotti**, quindi non possono
-- divergere nemmeno se un prodotto viene rinominato nel frattempo.
--
-- ⚠️ Un candidato che non esiste più **sparisce dall'elenco** invece di
--    comparire come voce vuota: toccare una riga senza nome è un gesto che
--    nessuno sa cosa faccia. Se spariscono tutti, la domanda torna `manca`.
--
-- ----------------------------------------------------------------------------
-- E SCEGLIERE ESEGUE, in un gesto solo
-- ----------------------------------------------------------------------------
-- `scegli_per_azione_dettata` scrive la scelta nei dati **e** esegue. Due
-- gesti separati — «scegli» e poi «conferma» — sarebbero il difetto di
-- prima con un passaggio in più: chi ha appena detto *quale* ha già detto
-- anche *sì*.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. I candidati, da numeri a nomi
-- ----------------------------------------------------------------------------

create or replace function azione_scelte(p_tipo text, p_dati jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_n   integer;
  v_id  uuid;
  v_nome text;
begin
  if p_dati->'candidati' is null or jsonb_typeof(p_dati->'candidati') <> 'array' then
    return v_out;
  end if;

  for v_n in select value::text::integer from jsonb_array_elements(p_dati->'candidati')
  loop
    v_id := null;
    v_nome := null;

    if p_tipo in ('giacenza', 'merce_buttata', 'carico_merce') then
      v_id := voce_prodotto_numero(v_n);
      select i.name into v_nome from ingredients i where i.id = v_id;
    elsif p_tipo = 'temperatura' then
      v_id := voce_frigorifero_numero(v_n);
      select e.name into v_nome from haccp_equipment e where e.id = v_id;
    elsif p_tipo = 'pulizia' then
      v_id := voce_pulizia_numero(v_n);
      select c.name into v_nome from haccp_cleaning_tasks c where c.id = v_id;
    end if;

    -- ⚠️ Un candidato senza nome non entra: un pulsante vuoto è peggio di
    --    un pulsante che manca.
    if v_id is not null and nullif(btrim(coalesce(v_nome, '')), '') is not null then
      v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'nome', v_nome));
    end if;
  end loop;

  return v_out;
end $$;

comment on function azione_scelte(text, jsonb) is
  'I candidati che il modello ha nominato, ritradotti in nomi veri con la STESSA numerazione che li ha prodotti. Chi non esiste piu'' sparisce invece di comparire senza nome.';

revoke all on function azione_scelte(text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Che domanda sta facendo questa riga
-- ----------------------------------------------------------------------------

create or replace function azione_domanda(p_tipo text, p_dati jsonb, p_stato text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_manca text;
begin
  if p_stato not in ('in_attesa', 'fallita') then
    return null;   -- una riga chiusa non chiede piu' niente
  end if;

  -- 🔴 SI CHIEDE ALLA FUNZIONE CHE GIA' SA. Rifare qui il ragionamento su
  --    cosa manca vorrebbe dire due definizioni della stessa cosa.
  v_manca := nullif(voce_risolvi_dati(p_tipo, p_dati)->>'manca', '');

  if v_manca is null then
    return 'se';        -- tutto risolto: resta solo il permesso
  end if;
  if jsonb_array_length(azione_scelte(p_tipo, p_dati)) > 0 then
    return 'scegli';    -- manca QUALE, e i candidati ci sono
  end if;
  return 'manca';       -- manca qualcosa che nessuno puo' proporre
end $$;

comment on function azione_domanda(text, jsonb, text) is
  'Che domanda sta facendo una riga rimasta in sospeso: `se` (manca solo il permesso), `scegli` (manca QUALE, e i candidati ci sono), `manca` (manca un''informazione che il gestionale non puo'' proporre). Sono tre schermate diverse, non tre frasi diverse.';

revoke all on function azione_domanda(text, jsonb, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Le due porte da cui la schermata legge le righe
-- ----------------------------------------------------------------------------
-- ⚠️ Cambia la lista delle colonne, quindi si CANCELLA e si ricrea: un
--    `create or replace` con colonne diverse viene rifiutato. E dopo un
--    `drop` i permessi tornano aperti al mondo — si richiudono qui, e la
--    verifica lo controlla invece di ricordarselo.

drop function if exists azioni_dettate_in_attesa();

create function azioni_dettate_in_attesa()
returns table (
  id uuid, dettatura_id uuid, tipo text, titolo text, natura text, dati jsonb,
  sicuro boolean, frase text, motivo text, stato text, errore text,
  testo_detto text, quando timestamptz, giorni integer,
  domanda text, scelte jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.dettatura_id, a.tipo, t.titolo, t.natura, a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, d.testo, a.creato_il,
         (((now() at time zone 'Europe/Rome')::date) - ((a.creato_il at time zone 'Europe/Rome')::date))::integer,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati)
    from azioni_dettate a
    join tipi_azione_vocale t on t.tipo = a.tipo
    join dettature d on d.id = a.dettatura_id
   where a.stato in ('in_attesa', 'fallita')
   order by a.creato_il, a.progressivo;
end $$;

revoke all on function azioni_dettate_in_attesa() from public, anon, authenticated;
grant execute on function azioni_dettate_in_attesa() to authenticated;

drop function if exists azioni_della_dettatura(uuid);

create function azioni_della_dettatura(p_id uuid)
returns table (
  id uuid, progressivo integer, tipo text, titolo text, natura text, dati jsonb,
  sicuro boolean, frase text, motivo text, stato text, errore text,
  quando timestamptz, domanda text, scelte jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Le cose dettate sono riservate al titolare.';
  end if;

  return query
  select a.id, a.progressivo, a.tipo, t.titolo, t.natura, a.dati, a.sicuro,
         a.frase, a.motivo, a.stato, a.errore, a.creato_il,
         azione_domanda(a.tipo, a.dati, a.stato),
         azione_scelte(a.tipo, a.dati)
    from azioni_dettate a
    join tipi_azione_vocale t on t.tipo = a.tipo
   where a.dettatura_id = p_id
   order by a.progressivo;
end $$;

revoke all on function azioni_della_dettatura(uuid) from public, anon, authenticated;
grant execute on function azioni_della_dettatura(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Scegliere ESEGUE
-- ----------------------------------------------------------------------------

create or replace function scegli_per_azione_dettata(p_id uuid, p_scelta uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a     azioni_dettate%rowtype;
  v_campo text;
  v_dati  jsonb;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' scegliere.';
  end if;

  select * into v_a from azioni_dettate where id = p_id for update;
  if not found then
    raise exception 'Questa cosa da confermare non c''e'' piu''.';
  end if;
  if v_a.stato = 'eseguita' then
    raise exception 'Questa era gia'' stata fatta.';
  end if;

  -- ⚠️ Si accetta SOLO una delle scelte che il gestionale ha offerto. Senza
  --    questo controllo, la scelta arriverebbe dal browser e si potrebbe
  --    scrivere un identificativo qualunque — cioe' abbinare la temperatura
  --    di un frigo a un altro, dal di fuori.
  if not exists (
    select 1 from jsonb_array_elements(azione_scelte(v_a.tipo, v_a.dati)) s
     where (s.value->>'id')::uuid = p_scelta
  ) then
    raise exception 'Questa non e'' una delle cose che ti avevo proposto: ridimmi tu qual e''.';
  end if;

  v_campo := case
    when v_a.tipo in ('giacenza', 'merce_buttata', 'carico_merce') then 'ingredient_id'
    when v_a.tipo = 'temperatura' then 'equipment_id'
    when v_a.tipo = 'pulizia'     then 'task_id'
  end;
  if v_campo is null then
    raise exception 'Su questa cosa non c''e'' niente da scegliere.';
  end if;

  v_dati := (v_a.dati - 'candidati') || jsonb_build_object(v_campo, p_scelta);
  update azioni_dettate set dati = v_dati where id = p_id;

  -- 🔴 SCEGLIERE ESEGUE. Chi ha appena detto QUALE ha gia' detto anche SI':
  --    un secondo pulsante sarebbe il difetto di prima con un passaggio in
  --    piu'.
  return esegui_azione_dettata(p_id);
end $$;

comment on function scegli_per_azione_dettata(uuid, uuid) is
  'Sceglie fra i candidati che il gestionale ha proposto ED ESEGUE, in un gesto solo. Accetta solo una delle scelte offerte: una scelta qualunque arrivata dal browser sarebbe il modo di abbinare una misura alla cosa sbagliata dal di fuori.';

revoke all on function scegli_per_azione_dettata(uuid, uuid) from public, anon, authenticated;
grant execute on function scegli_per_azione_dettata(uuid, uuid) to authenticated;

-- ============================================================================
-- VERIFICA
-- ============================================================================
do $verifica$
declare
  v_foto  jsonb;
  v_tit   uuid;
  v_det   uuid;
  v_az    uuid;
  v_ent   uuid;
  v_i1    uuid;
  v_i2    uuid;
  v_n1    integer;
  v_n2    integer;
  v_dett  text[] := '{}';
  v_ingr  text[] := '{}';
  v_r     jsonb;
begin
  v_foto := foto_righe();
  select id into v_ent from entities where entity_type = 'srls' limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- 🔴 DUE PRODOTTI CREATI DA QUESTA VERIFICA, non due prodotti veri presi
  --    in prestito. Il punto (3) esegue un allineamento di giacenza, che
  --    SPOSTA un numero: fatto su un prodotto vero resterebbe spostato, e
  --    nessun conteggio di righe se ne accorgerebbe — e' la trappola del
  --    14/08 (rimettere, non cancellare) e quella del 16/08 (il lotto preso
  --    in prestito), tutte e due in una volta.
  v_i1 := (create_ingredient(v_ent, 'VERIFICA scelta A', 'verdura', 'kg', 0)->>'id')::uuid;
  v_i2 := (create_ingredient(v_ent, 'VERIFICA scelta B', 'verdura', 'kg', 0)->>'id')::uuid;
  v_ingr := v_ingr || v_i1::text || v_i2::text;

  select r.n into v_n1 from (
    select row_number() over (order by i.name) as n, i.id from ingredients i
  ) r where r.id = v_i1;
  select r.n into v_n2 from (
    select row_number() over (order by i.name) as n, i.id from ingredients i
  ) r where r.id = v_i2;

  insert into dettature (testo, provenienza, esito, creato_da)
  values ('VERIFICA scelta fra due', 'app', 'capita', v_tit)
  returning id into v_det;
  v_dett := v_dett || v_det::text;

  -- (1) UNA RIGA CON DUE CANDIDATI CHIEDE «QUALE», non «se».
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, motivo, stato)
  values (v_det, 1, 'giacenza',
          jsonb_build_object('quanto_ce', 4, 'candidati', jsonb_build_array(v_n1, v_n2),
                             'nome_sentito', 'VERIFICA'),
          false, 'VERIFICA: quanto ce n''e''', 'Ne ho trovati due', 'in_attesa')
  returning id into v_az;

  if (select domanda from azioni_della_dettatura(v_det) where id = v_az) <> 'scegli' then
    raise exception 'Una riga con due candidati non chiede di scegliere: chiede «%»',
      (select domanda from azioni_della_dettatura(v_det) where id = v_az);
  end if;
  if jsonb_array_length((select scelte from azioni_della_dettatura(v_det) where id = v_az)) <> 2 then
    raise exception 'I due candidati non arrivano alla schermata come due scelte.';
  end if;

  -- (2) UNA SCELTA CHE NON ERA STATA OFFERTA SI RIFIUTA.
  --     🔴 E' la porta da cui si abbinerebbe una misura alla cosa sbagliata.
  begin
    perform scegli_per_azione_dettata(v_az, gen_random_uuid());
    raise exception 'Una scelta mai proposta e'' stata accettata.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%proposto%' then raise; end if;
  end;

  -- (3) SCEGLIERE ESEGUE, in un gesto solo — sul prodotto B, che è mio.
  v_r := scegli_per_azione_dettata(v_az, v_i2);
  if (select stato from azioni_dettate where id = v_az) <> 'eseguita' then
    raise exception 'Scegliere non ha eseguito: la riga e'' rimasta in sospeso.';
  end if;
  if (select dati->>'ingredient_id' from azioni_dettate where id = v_az) <> v_i2::text then
    raise exception 'La scelta non e'' finita nei dati della riga.';
  end if;
  if (select dati->'candidati' from azioni_dettate where id = v_az) is not null then
    raise exception 'I candidati sono rimasti attaccati alla riga gia'' decisa.';
  end if;
  if (select domanda from azioni_della_dettatura(v_det) where id = v_az) is not null then
    raise exception 'Una riga eseguita chiede ancora qualcosa.';
  end if;
  -- ⚠️ E l'effetto è avvenuto DAVVERO sul prodotto scelto, non sull'altro:
  --    è il modo in cui questa prova discrimina fra i due candidati. Senza
  --    questi due controlli passerebbe anche un codice che sceglie a caso.
  if (select coalesce(sum(quantity_remaining), 0) from stock_lots where ingredient_id = v_i2) <> 4 then
    raise exception 'La giacenza del prodotto scelto non e'' stata allineata a 4.';
  end if;
  if (select count(*) from stock_lots where ingredient_id = v_i1) <> 0 then
    raise exception 'E'' stato toccato il prodotto NON scelto.';
  end if;

  -- (4) UNA RIGA DI NATURA `creazione` CON TUTTO A POSTO CHIEDE «SE».
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, stato)
  values (v_det, 2, 'movimento_cassa',
          jsonb_build_object('verso', 'uscita', 'importo', 12, 'mezzo', 'cassa'),
          false, 'VERIFICA: uscita di 12', 'in_attesa')
  returning id into v_az;
  if (select domanda from azioni_della_dettatura(v_det) where id = v_az) <> 'se' then
    raise exception 'Una riga con tutto a posto non chiede il permesso: chiede «%»',
      (select domanda from azioni_della_dettatura(v_det) where id = v_az);
  end if;

  -- (5) UNA RIGA A CUI MANCA QUALCOSA CHE NESSUNO PUO' PROPORRE dice `manca`.
  insert into azioni_dettate (dettatura_id, progressivo, tipo, dati, sicuro, frase, stato)
  values (v_det, 3, 'temperatura', jsonb_build_object('gradi', 4), false,
          'VERIFICA: 4 gradi', 'in_attesa')
  returning id into v_az;
  if (select domanda from azioni_della_dettatura(v_det) where id = v_az) <> 'manca' then
    raise exception 'Una temperatura senza frigo non dice che manca qualcosa: dice «%»',
      (select domanda from azioni_della_dettatura(v_det) where id = v_az);
  end if;

  -- (6) I DUE ELENCHI HANNO IL PORTIERE, dopo il `drop` che li ha ricreati.
  perform set_config('request.jwt.claims', null, true);
  begin
    perform * from azioni_dettate_in_attesa();
    raise exception 'Le cose in sospeso si leggono senza essere il titolare.';
  exception when sqlstate 'P0001' then
    if sqlerrm not like '%titolare%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_tit)::text, true);

  -- ------------------------------------------------------------------------
  -- PULIZIA — solo roba mia, per identificativo, tenuto in un ELENCO
  -- ------------------------------------------------------------------------
  delete from azioni_dettate where dettatura_id::text = any(v_dett);
  delete from dettature where id::text = any(v_dett);
  delete from rettifiche_giacenza where ingredient_id::text = any(v_ingr);
  delete from stock_consumptions where ingredient_id::text = any(v_ingr);
  delete from stock_lots where ingredient_id::text = any(v_ingr);
  delete from price_history where ingredient_id::text = any(v_ingr);
  delete from ingredients where id::text = any(v_ingr);
  -- ⚠️ Le lapidi non stanno solo sull'ingrediente: lotti, rettifiche, storico
  --    prezzi e scarichi sono tabelle tracciate e ognuna lascia la SUA. Si
  --    cercano per il prodotto che nominano dentro la riga conservata —
  --    e' la stessa forma usata dalla verifica della caparra sui conti.
  delete from deleted_records
   where record_id = any(v_ingr) or record_id = any(v_dett)
      or (record ->> 'ingredient_id') = any(v_ingr);

  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle tre domande');
  raise notice 'verifica: le tre domande si distinguono, una scelta mai proposta si rifiuta, e scegliere esegue sul prodotto giusto';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260827000007', 'un_si_che_risponde_a_qualcosa')
on conflict (version) do nothing;
