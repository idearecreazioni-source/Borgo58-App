-- =====================================================================
-- I GIORNI IN ATTESA SI CONTANO IN ITALIA
-- 29/08/2026 — coda del Blocco 3 del mandato del 29/08 (sera)
-- =====================================================================
-- 🔴 DIFETTO MIO, ED È LA TRAPPOLA PIÙ RIPETUTA DI QUESTO PROGETTO.
-- `aggiungi_da_fare` e `cose_da_fare`, nate un'ora fa, contano da quanti
-- giorni una preparazione aspetta con `now()::date` — che è la data di
-- **Greenwich**, non quella italiana. Fra mezzanotte e le due di notte
-- Greenwich è ancora **ieri**: una voce segnata all'una di notte
-- comparirebbe «da ieri» il giorno stesso, e il conteggio dei giorni
-- sarebbe più basso del vero per due ore ogni notte.
--
-- ⚠️ Per un ufficio è ininfluente. Per una cucina che chiude all'una no —
-- ed è precisamente l'orario in cui qualcuno si segna «domani il fondo
-- bruno».
--
-- ✅ **A trovarlo è stata la rete delle date** (`tests/app/giornata-operativa.test.js`),
-- diventata rossa da sola e nominando tutt'e due le funzioni con il
-- perché: *«usa now()::date senza fuso»*, *«taglia a data aggiunta_il
-- senza fuso»*. Non una rilettura.
--
-- ⚠️ **È IL GIORNO DI CALENDARIO, non la serata di servizio**, ed è una
-- scelta: una cosa da fare in cucina non è un gesto di cassa né un conto.
-- Alle 00:30 «domani» è davvero domani per chi cucina. Sta dalla parte
-- dei sette punti che il censimento del 18/08 dichiara giusti così.
--
-- ⚠️ **Non riscrivo la `…016`**: è già applicata (regola di Alessio,
-- 23/08).
-- =====================================================================

create or replace function aggiungi_da_fare(p_recipe_id uuid, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $corpo$
declare
  v_nome  text;
  v_tipo  recipe_type;
  v_prima timestamptz;
  v_oggi  date := (now() at time zone 'Europe/Rome')::date;
begin
  select r.name, r.recipe_type into v_nome, v_tipo from recipes r where r.id = p_recipe_id;
  if v_nome is null then
    raise exception 'Questa preparazione non esiste.';
  end if;
  -- ⚠️ Solo le PREPARAZIONI: un piatto finito non si «produce», si serve.
  -- Il rifiuto dice cosa è, non solo che non si può.
  if v_tipo = 'piatto_finito' then
    raise exception '«%» è un piatto del menu, non una preparazione: non si produce in anticipo.', v_nome;
  end if;

  select d.aggiunta_il into v_prima from preparazioni_da_fare d where d.recipe_id = p_recipe_id;
  if found then
    return jsonb_build_object(
      'aggiunta', false,
      'gia_c_era', true,
      'messaggio', format('«%s» è già fra le cose da fare, da %s.', v_nome,
        case
          when (v_oggi - (v_prima at time zone 'Europe/Rome')::date) = 0 then 'oggi'
          when (v_oggi - (v_prima at time zone 'Europe/Rome')::date) = 1 then 'ieri'
          else format('%s giorni', v_oggi - (v_prima at time zone 'Europe/Rome')::date)
        end));
  end if;

  insert into preparazioni_da_fare (recipe_id, aggiunta_da, nota)
  values (p_recipe_id, auth.uid(), nullif(trim(p_nota), ''));

  return jsonb_build_object('aggiunta', true, 'gia_c_era', false,
    'messaggio', format('«%s» è fra le cose da fare.', v_nome));
end;
$corpo$;

revoke all on function aggiungi_da_fare(uuid, text) from public, anon, authenticated;
grant execute on function aggiungi_da_fare(uuid, text) to authenticated;

create or replace function cose_da_fare()
returns table (
  recipe_id      uuid,
  nome           text,
  aggiunta_il    timestamptz,
  giorni_in_attesa integer,
  da_ricorrenza  boolean,
  ricorre_ogni   integer,
  nota           text
)
language sql
stable
security definer
set search_path = public
as $corpo$
  select d.recipe_id, r.name, d.aggiunta_il,
         ((now() at time zone 'Europe/Rome')::date
          - (d.aggiunta_il at time zone 'Europe/Rome')::date)::integer,
         d.da_ricorrenza, ric.ogni_giorni, d.nota
    from preparazioni_da_fare d
    join recipes r on r.id = d.recipe_id
    left join preparazioni_ricorrenti ric
           on ric.recipe_id = d.recipe_id and ric.attiva
   order by d.aggiunta_il;
$corpo$;

comment on function cose_da_fare() is
  'Le preparazioni in attesa, con da quanti giorni sono li'' — contati in ORA ITALIANA. L''anzianita'' si vede: una lista senza eta'' diventa un cimitero.';

revoke all on function cose_da_fare() from public, anon, authenticated;
grant execute on function cose_da_fare() to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_ric   uuid;
  v_miei  uuid[] := array[]::uuid[];
  v_g     integer;
  v_r     jsonb;
begin
  -- (0) LE SOSTITUZIONI HANNO ATTECCHITO, e si guarda il corpo vivo.
  if pg_get_functiondef('cose_da_fare()'::regprocedure) not like '%Europe/Rome%' then
    raise exception 'cose_da_fare conta ancora i giorni a Greenwich.';
  end if;
  if pg_get_functiondef('aggiungi_da_fare(uuid,text)'::regprocedure) not like '%Europe/Rome%' then
    raise exception 'aggiungi_da_fare conta ancora i giorni a Greenwich.';
  end if;

  insert into recipes (name, category, recipe_type, yield_quantity, yield_unit)
  values ('VERIFICA-29AGO fuso', 'antipasto', 'preparazione', 1, 'kg')
  returning id into v_ric;
  v_miei := v_miei || v_ric;

  perform aggiungi_da_fare(v_ric, null);

  -- (1) APPENA MESSA: zero giorni.
  select giorni_in_attesa into v_g from cose_da_fare() where recipe_id = v_ric;
  if v_g <> 0 then
    raise exception 'Una voce appena messa risulta in attesa da % giorni.', v_g;
  end if;

  -- (2) 🔴 IL CASO CHE IL FUSO SBAGLIAVA: una voce messa **all'una di notte
  --     italiana di oggi** deve risultare di OGGI, non di ieri. A Greenwich
  --     quell'istante e' ancora il giorno prima.
  --     ⚠️ Il caso si COSTRUISCE, non si aspetta: aspettare l'una di notte
  --     vorrebbe dire una verifica che prova qualcosa una volta al giorno.
  update preparazioni_da_fare
     set aggiunta_il = ((now() at time zone 'Europe/Rome')::date + time '01:00')
                       at time zone 'Europe/Rome'
   where recipe_id = v_ric;

  select giorni_in_attesa into v_g from cose_da_fare() where recipe_id = v_ric;
  if v_g <> 0 then
    raise exception 'Una voce messa all''una di notte risulta in attesa da % giorni invece che da oggi.', v_g;
  end if;

  v_r := aggiungi_da_fare(v_ric, null);
  if (v_r ->> 'messaggio') not like '%da oggi%' then
    raise exception 'Il messaggio dice «%» invece di «da oggi».', v_r ->> 'messaggio';
  end if;

  -- (3) E IL VERSO OPPOSTO: due giorni indietro devono restare DUE. Senza,
  --     una funzione che risponde sempre «oggi» passerebbe il controllo (2).
  update preparazioni_da_fare
     set aggiunta_il = ((now() at time zone 'Europe/Rome')::date - 2 + time '01:00')
                       at time zone 'Europe/Rome'
   where recipe_id = v_ric;
  select giorni_in_attesa into v_g from cose_da_fare() where recipe_id = v_ric;
  if v_g <> 2 then
    raise exception 'Una voce di due giorni fa risulta in attesa da % giorni.', v_g;
  end if;

  delete from preparazioni_da_fare where recipe_id = any(v_miei);
  delete from recipes where id = any(v_miei);

  perform pretendi_nessun_residuo(v_foto, 'la verifica dei giorni in attesa');
  raise notice 'I giorni in attesa si contano in ora italiana: una voce dell''una di notte e'' di oggi, una di due giorni fa e'' di due giorni fa.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260829000020', 'i_giorni_in_attesa_si_contano_in_italia') on conflict (version) do nothing;
