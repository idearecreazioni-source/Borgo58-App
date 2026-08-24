-- =====================================================================
-- LA SCALA DI UNA LINEA È UN DATO, NON UNA PAROLA DENTRO IL NOME
-- 24/08/2026 — la falla che ha reso possibile l'equivoco degli eventi
-- =====================================================================
-- 🔴 IL CASO, misurato in produzione prima di scrivere una riga. La linea
-- si chiama **«Eventi premium (n/mese)»** e ha `quantita = 24`. Se fossero
-- 24 al mese sarebbero 288 eventi l'anno, cioè 432.000 € — più di tutti i
-- ricavi del piano, che stanno a 418.214.
--
-- **Cosa fa il calcolo, misurato**: prende il numero **com'è**. Anzi, per
-- una linea a forfait `quantita` non la guarda affatto — gli eventi li
-- legge da `scenario_mesi.eventi_premium`, che sui dodici mesi somma **24**
-- distribuiti su **7 mesi**. Il ricavo eventi è **36.000 €**, e si ritrova
-- per differenza nei risultati fotografati (143.464 accessori − 107.464
-- delle altre tre linee).
--
-- ✅ **Quindi la previsione congelata è GIUSTA e mente l'etichetta**:
-- «(n/mese)» andava scritto «(n/anno)». Confermato da Alessio: sono 24
-- eventi all'anno. Nessun ricavo gonfiato, nessun pareggio sporcato.
--
-- 🔴 MA LA FALLA È PIÙ LARGA DELL'ETICHETTA, e questo è il punto. Sono
-- **due difetti**, non uno:
--
--   1. **La scala vive dentro un nome scritto a mano.** Finché «al mese» o
--      «all'anno» è una parola nel titolo, nessun controllo può accorgersi
--      che contraddice il calcolo — è lo stesso schema del «percento» che
--      in questo database vuol dire due cose (§8 di CLAUDE.md): un numero
--      la cui unità è nota solo a chi l'ha scritto.
--
--   2. 🔴 **E la quantità di una linea a forfait è INERTE**: si compila e
--      non entra in nessun conto. È la famiglia della soglia di magazzino
--      del 13/08 — *tutto acceso, e muto*. Qui è peggio che muto: quel 24
--      è **l'unico posto** dove un lettore cerca «quanti eventi», e sta
--      accanto a un'etichetta che dice una terza cosa.
--
-- ⚠️ NIENTE SI CORREGGE SULLA PREVISIONE CONGELATA (ordine di Alessio):
-- questa migrazione aggiunge il dato e la rete che lo sorveglia. Se un
-- giorno un numero risulterà sbagliato, si fa una riproiezione — e quella
-- è una decisione sua.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La scala
-- ---------------------------------------------------------------------
alter table scenario_linee_accessorie add column if not exists scala text;

comment on column scenario_linee_accessorie.scala is
  'A che ritmo va letta la quantita'' di questa linea: all_anno, al_mese, al_giorno, per_evento. Prima viveva dentro il nome scritto a mano — «Eventi premium (n/mese)» — e nessun controllo poteva accorgersi se contraddiceva il calcolo.';

-- ⚠️ `not valid` come i vincoli del 24/08: vale sulle righe nuove e lascia
-- stare quelle di una previsione sigillata.
alter table scenario_linee_accessorie drop constraint if exists linea_scala_nota;
alter table scenario_linee_accessorie
  add constraint linea_scala_nota
  check (scala is null or scala in ('all_anno', 'al_mese', 'al_giorno', 'per_evento'))
  not valid;

comment on constraint linea_scala_nota on scenario_linee_accessorie is
  'La quantita'' di una linea si legge all''anno, al mese, al giorno o per evento: sono i quattro ritmi con cui si conta un ricavo. Una scala nuova si aggiunge qui, non si scrive dentro il nome della linea.';

-- ---------------------------------------------------------------------
-- 2 · La scala che il CALCOLO usa davvero
-- ---------------------------------------------------------------------
-- 🔴 QUESTA È LA CHIAVE DELLA RETE, e la ragione per cui non basta
-- aggiungere una colonna: la scala **dichiarata** da chi scrive e quella
-- che il **calcolo** adopera sono due cose diverse, e l'equivoco degli
-- eventi è nato esattamente nello spazio fra loro.
--
-- Come conta oggi `calcola_proiezione`, misurato leggendone il corpo:
--   · forfait  → `eventi_premium` del mese × prezzo. La quantità della
--     riga **non viene usata**: la scala effettiva è `per_evento`, e il
--     numero di eventi lo dicono i dodici mesi.
--   · tutto il resto → quantità × prezzo × giorni lavorati del mese, cioè
--     la quantità è **al giorno**.
--
-- ⚠️ Sta in una funzione perché la rete e la schermata devono chiedere la
-- stessa cosa allo stesso posto: se una delle due se la deducesse, il
-- giorno che il calcolo cambia una direbbe ancora la vecchia.
create or replace function public.scala_del_calcolo(p_forma text)
returns text
language sql
immutable
as $function$
  select case when p_forma = 'a_forfait' then 'per_evento' else 'al_giorno' end;
$function$;

comment on function public.scala_del_calcolo(text) is
  'A che ritmo `calcola_proiezione` legge davvero la quantita'' di una linea, data la sua forma. E'' il metro con cui si giudica la scala dichiarata.';

revoke all on function public.scala_del_calcolo(text) from public, anon, authenticated;
grant execute on function public.scala_del_calcolo(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · La rete: dove la scala non torna
-- ---------------------------------------------------------------------
-- ⚠️ SEGNALA, NON CORREGGE. Su una previsione congelata non si può toccare
-- niente, e su una libera la scelta è di Alessio: una linea può
-- legittimamente avere una scala diversa da quella che il calcolo usa —
-- basta saperlo. Quello che non deve succedere è **non saperlo**.
create or replace function public.scale_che_non_tornano()
returns table (
  scenario_id uuid,
  previsione  text,
  congelata   boolean,
  linea       text,
  quantita    numeric,
  scala_scritta   text,
  scala_del_conto text,
  scala_nel_nome  text,
  perche      text
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not is_titolare() then
    raise exception 'La Proiezione è riservata al titolare.';
  end if;

  return query
  with righe as (
    select a.scenario_id, s.nome as previsione, s.congelato_il is not null as congelata,
           a.linea, a.quantita, a.scala,
           scala_del_calcolo(forma_della_linea(a.forma, a.base)) as del_conto,
           -- ⚠️ LA SCALA SCRITTA DENTRO IL NOME: è il posto sbagliato dove
           -- l'ha messa il foglio, ed è proprio per questo che va letta —
           -- è l'unica cosa che un lettore umano vede.
           case
             when a.linea ~* '(/ *mese|al mese|mensil)'   then 'al_mese'
             when a.linea ~* '(/ *anno|all.?anno|annu)'   then 'all_anno'
             when a.linea ~* '(/ *g(g|iorno)|al giorno)'  then 'al_giorno'
             when a.linea ~* '(per evento|/ *evento)'     then 'per_evento'
           end as nel_nome,
           -- Quanti eventi dicono i dodici mesi: serve a giudicare se la
           -- quantità di una linea a forfait è coerente con loro.
           (select coalesce(sum(m.eventi_premium), 0)
              from scenario_mesi m where m.scenario_id = a.scenario_id) as eventi_anno
      from scenario_linee_accessorie a
      join scenari_proiezione s on s.id = a.scenario_id
  )
  select r.scenario_id, r.previsione, r.congelata, r.linea, r.quantita,
         r.scala, r.del_conto, r.nel_nome,
         case
           -- (1) Il nome dice una scala e la colonna ne dice un'altra.
           when r.nel_nome is not null and r.scala is not null and r.nel_nome <> r.scala then
             format('Il nome dice «%s» e la scala dichiarata dice «%s».', r.nel_nome, r.scala)
           -- (2) Il nome dice una scala e il CALCOLO ne usa un'altra: è il
           --     caso degli eventi — «(n/mese)» su un numero che il conto
           --     legge come totale degli eventi dell'anno.
           when r.nel_nome is not null and r.nel_nome <> r.del_conto then
             format('Il nome dice «%s», ma il calcolo legge questo numero «%s». Uno dei due mente.',
                    r.nel_nome, r.del_conto)
           -- (3) La scala dichiarata non è quella che il calcolo usa.
           when r.scala is not null and r.scala <> r.del_conto then
             format('La scala dichiarata è «%s» e il calcolo legge «%s».', r.scala, r.del_conto)
           -- (4) 🔴 LA QUANTITÀ INERTE: su una linea a forfait il conto non
           --     la guarda, e se non combacia con la somma dei mesi è un
           --     numero che sta lì a dire una cosa che nessuno usa.
           when r.del_conto = 'per_evento' and r.quantita is not null
                and r.quantita <> r.eventi_anno then
             format('Questa riga dice %s, ma gli eventi dei dodici mesi sono %s — e il calcolo usa quelli. Il numero sulla riga non entra in nessun conto.',
                    trim(to_char(r.quantita, 'FM999990.##')), trim(to_char(r.eventi_anno, 'FM999990.##')))
         end
    from righe r
   where (r.nel_nome is not null and r.scala is not null and r.nel_nome <> r.scala)
      or (r.nel_nome is not null and r.nel_nome <> r.del_conto)
      or (r.scala is not null and r.scala <> r.del_conto)
      or (r.del_conto = 'per_evento' and r.quantita is not null and r.quantita <> r.eventi_anno)
   order by r.previsione, r.linea;
end $function$;

comment on function public.scale_che_non_tornano() is
  'Le linee dove la scala scritta nel nome, quella dichiarata e quella che il calcolo usa non dicono la stessa cosa. Segnala e basta: su una previsione congelata non si corregge niente, e su una libera la scelta e'' di Alessio.';

revoke all on function public.scale_che_non_tornano() from public, anon, authenticated;
grant execute on function public.scale_che_non_tornano() to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA, come chiede Alessio
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_staff     uuid;
  v_lapidi    integer;
  v_lapidi2   integer;
  v_scenario  uuid;
  v_riga      uuid;
  v_quante    integer;
  v_perche    text;
  v_rifiutato boolean;
begin
  select count(*) into v_lapidi from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- (a) LO STATO DI PARTENZA, dichiarato voce per voce. ⚠️ In produzione ce
  --     n'è **una** e si sa quale: «Eventi premium (n/mese)», dove il nome
  --     dice «al mese» e il calcolo legge «per evento».
  raise notice '--- Scale che non tornano, adesso ---';
  for v_perche in
    select format('  · %s | %s | %s', r.previsione, r.linea, r.perche)
      from scale_che_non_tornano() r
  loop
    raise notice '%', v_perche;
  end loop;

  -- (b) 🔴 LA ROTTURA APPOSTA, su una previsione LIBERA: si scrive una
  --     scala che contraddice il calcolo, e la rete deve accorgersene.
  --     ⚠️ Senza questo, una rete che non segnala mai niente passerebbe la
  --     (a) — e passerebbe per sempre, perché su un database senza
  --     incoerenze «zero segnalazioni» è indistinguibile da «zero
  --     capacità di segnalare».
  select s.id into v_scenario
    from scenari_proiezione s
   where s.congelato_il is null
     and exists (select 1 from scenario_linee_accessorie a where a.scenario_id = s.id)
   limit 1;

  if v_scenario is null then
    raise exception 'Nessuna previsione libera: la rete non puo'' essere provata rompendola, e una rete mai vista scattare non si sa se scatta.';
  end if;

  select a.id into v_riga from scenario_linee_accessorie a where a.scenario_id = v_scenario limit 1;

  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  if v_quante <> 0 then
    raise notice 'La previsione libera ha gia'' % scale storte: la rottura si somma a quelle.', v_quante;
  end if;

  -- Una linea a coperto dichiarata «al mese»: il calcolo la legge al giorno.
  update scenario_linee_accessorie set scala = 'al_mese' where id = v_riga;
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  if v_quante = 0 then
    raise exception 'ROTTA E NON SEGNALATA: una scala «al mese» su una linea che il calcolo legge al giorno non fa scattare la rete.';
  end if;
  raise notice 'Rotta apposta: la rete segnala % righe.', v_quante;

  -- (c) ⚠️ LA CONTROPROVA CHE DISCRIMINA: con la scala GIUSTA la rete deve
  --     tacere. Una rete che grida sempre si impara a spegnere, ed è il
  --     modo in cui questo progetto ha già perso un guardiano.
  update scenario_linee_accessorie set scala = 'al_giorno' where id = v_riga;
  select count(*) into v_quante from scale_che_non_tornano() r where r.scenario_id = v_scenario;
  if v_quante > 0 then
    raise exception 'La rete segnala anche con la scala giusta: grida sempre, quindi non serve.';
  end if;

  -- (d) IL VOCABOLARIO MORDE sulle righe nuove.
  v_rifiutato := false;
  begin
    update scenario_linee_accessorie set scala = 'ogni_tanto' where id = v_riga;
  exception when others then
    v_rifiutato := true;
  end;
  if not v_rifiutato then
    raise exception 'Una scala inventata e'' stata accettata.';
  end if;

  -- Si rimette com'era: la riga non aveva nessuna scala.
  update scenario_linee_accessorie set scala = null where id = v_riga;

  -- (e) IL PORTIERE, col ruolo vero.
  select ur.user_id into v_staff from user_roles ur where ur.role <> 'titolare' limit 1;
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    v_rifiutato := false;
    begin
      perform * from scale_che_non_tornano();
    exception when others then
      v_rifiutato := true;
    end;
    if not v_rifiutato then
      raise exception 'Lo staff puo'' leggere le quantita'' e i ritmi delle linee della previsione.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La scala e'' un dato, e la rete la confronta col nome e col calcolo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000033', 'la_scala_di_una_linea_e_un_dato') on conflict (version) do nothing;
