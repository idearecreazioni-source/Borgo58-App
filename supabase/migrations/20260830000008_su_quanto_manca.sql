-- =====================================================================
-- «MANCANO 0,2 g» — MA SU QUANTO? — 30/08/2026
-- =====================================================================
--
-- 🔴 RICHIESTA DI ALESSIO, guardando il Magazzino dal telefono: il riquadro
-- «cosa non è sceso dal magazzino» dice **quanto** manca e non **su quanto**.
-- Senza il paragone quel numero non si può giudicare: 0,2 grammi su 1,5 kg
-- sono polvere, 0,2 grammi su 0,3 grammi sono tutto.
--
-- ⚠️ E IL NUMERO C'ERA GIÀ. `anomalie_scarico.quantita_richiesta` è
-- registrata dal 23/08 da tutti e due i punti che scaricano — misurato — e
-- **non usciva dal database**: la funzione che alimenta la schermata non la
-- restituiva. *Un dato registrato che nessuna schermata può leggere è, per
-- chi usa il gestionale, un dato che non esiste.*
--
-- ⚠️ SI AGGIUNGE UNA COLONNA A UNA FUNZIONE CHE RESTITUISCE UNA TABELLA,
-- quindi va buttata e rifatta — e **una funzione rifatta nasce aperta a
-- tutti** (trappole del 24 e del 27/08). I permessi sono stati MISURATI
-- prima: `anon` no, `authenticated` sì, `service_role` no. Si rimettono
-- uguali, e la verifica li ricontrolla invece di crederci.
--
-- ⚠️ Corpo preso dal database VIVO del progetto di prova (`--prova`): la
-- produzione stanotte è allineata, ma la regola è quella e non si deroga.

drop function if exists scarichi_non_riusciti(date, date);

CREATE OR REPLACE FUNCTION public.scarichi_non_riusciti(p_dal date DEFAULT NULL::date, p_al date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, quando timestamp with time zone, tavolo text, tipo text, descrizione text, quantita_mancante numeric, unita text, conto_id uuid, serata date, altri_scesi integer, produzione text, quantita_richiesta numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- `security definer` gira senza RLS: il controllo va rimesso dentro.
  -- E chi non deve vedere riceve un rifiuto, non un elenco vuoto: una
  -- schermata vuota direbbe "e'' andato tutto bene", che qui e'' falso.
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' vedere cosa non e'' stato scaricato dal magazzino';
  end if;

  return query
  select a.id,
         a.creato_il,
         o.table_label,
         a.tipo,
         a.descrizione,
         a.quantita_mancante,
         i.unit::text,
         a.order_id,
         -- La serata, non il giorno di calendario: un conto chiuso all'una
         -- di notte appartiene alla sera prima.
         case when o.closed_at is not null then serata_di_servizio(o.closed_at) end,
         -- 🔴 QUANTI SONO SCESI LO STESSO — dal conto **o dalla
         -- produzione**. Contare solo il conto faceva dire «non e' sceso
         -- niente» su una produzione da cui era sceso quasi tutto.
         (select count(*)::integer from stock_consumptions sc
           where (a.order_id is not null and sc.order_id = a.order_id)
              or (a.produzione_id is not null and sc.produzione_id = a.produzione_id)),
         -- Il nome della preparazione, quando la riga viene da una
         -- produzione: senza, quella riga non ha nessun padrone a schermo.
         r.name,
         -- 🔴 SU QUANTO MANCA (30/08, richiesta di Alessio). Il numero era
         -- registrato dal 23/08 e non usciva di qui: «mancano 0,2 g» non si
         -- puo' giudicare senza sapere se la dose era 1,5 kg o 0,3 g.
         -- ⚠️ Resta VUOTO dove non e' stato registrato, e la schermata in quel
         --    caso tace invece di inventare un paragone.
         a.quantita_richiesta
    from anomalie_scarico a
    left join orders o      on o.id = a.order_id
    left join ingredients i on i.id = a.ingredient_id
    left join produzioni p  on p.id = a.produzione_id
    left join recipes r     on r.id = p.recipe_id
   where (p_dal is null or (a.creato_il at time zone 'Europe/Rome')::date >= p_dal)
     and (p_al  is null or (a.creato_il at time zone 'Europe/Rome')::date <= p_al)
   order by a.creato_il desc;
end;
$function$;

-- ⚠️ I PERMESSI, RIMESSI COME ERANO E MISURATI PRIMA DEL `drop`.
revoke all on function scarichi_non_riusciti(date, date) from public, anon, authenticated;
grant execute on function scarichi_non_riusciti(date, date) to authenticated;

do $verifica$
declare
  v_foto  jsonb := foto_righe();
  v_tit   uuid;
  v_col   integer;
  v_n     integer;
  v_ok    boolean;
  v_msg   text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Manca il titolare: impossibile verificare.'; end if;

  -- (1) LA COLONNA C'È NELLA FIRMA. Si chiede a `pg_proc`, non a
  --     `information_schema.columns`: quella elenca le colonne delle TABELLE
  --     e una funzione che restituisce una tabella non ci compare (trovato
  --     applicando, poche ore fa, sulla `20260830000005`).
  select count(*) into v_col
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'scarichi_non_riusciti'
     and 'quantita_richiesta' = any(p.proargnames);
  if v_col <> 1 then
    raise exception 'La colonna «quantita_richiesta» non e'' comparsa fra quelle restituite.';
  end if;

  -- (2) I PERMESSI SONO QUELLI DI PRIMA, non più larghi.
  if not has_function_privilege('authenticated', 'scarichi_non_riusciti(date,date)', 'execute') then
    raise exception 'La funzione non e'' piu'' leggibile da chi usa il gestionale.';
  end if;
  if has_function_privilege('anon', 'scarichi_non_riusciti(date,date)', 'execute') then
    raise exception 'La funzione e'' diventata leggibile con la chiave pubblica.';
  end if;

  -- (3) E RISPONDE DAVVERO. Un corpo che si crea non è un corpo che funziona
  --     (17/08): qui si CHIAMA, dal ruolo vero del titolare.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select count(*) into v_n from scarichi_non_riusciti();
  perform set_config('request.jwt.claims', null, true);

  -- (4) E IL PORTIERE RIFIUTA ANCORA chi non è il titolare, invece di
  --     rispondere un elenco vuoto. Rifacendo la funzione si poteva perderlo.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  v_ok := false;
  begin
    perform count(*) from scarichi_non_riusciti();
  exception when others then
    v_ok := true; v_msg := sqlerrm;
  end;
  perform set_config('request.jwt.claims', null, true);
  if not v_ok then
    raise exception 'Chi non e'' il titolare ha potuto leggere cosa non e'' sceso dal magazzino.';
  end if;
  if v_msg not like '%Solo il titolare%' then
    raise exception 'Il rifiuto non dice chi puo'' vederlo: «%».', v_msg;
  end if;

  perform pretendi_nessun_residuo(v_foto, 'la verifica di «su quanto manca»');
  raise notice 'Fatto: il riquadro puo'' dire su quanto. Righe che risponde adesso: %.', v_n;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260830000008', 'su_quanto_manca') on conflict (version) do nothing;
