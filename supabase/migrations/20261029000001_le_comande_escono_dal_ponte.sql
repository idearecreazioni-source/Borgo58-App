-- =====================================================================
-- LE COMANDE ESCONO DAL PONTE — 29/10/2026, piano approvato da Alessio:
-- «sì al piano delle comande dal ponte». Il tablet va provato al collaudo,
-- quindi una comanda inviata deve uscire da sola dalla stampante.
-- =====================================================================
--
-- 🔴 COSA CAMBIA. Quando una comanda parte dal tablet (`order_items.sent_at`
--    da vuoto a pieno) e per quel reparto c'è una stampante attiva, qui si
--    accoda un lavoro «comanda» per il ponte. Lo stesso per il biglietto
--    «avanti col prossimo turno» (`chiamate_turno`), se c'è la stampante
--    della cucina. Il ponte lo stampa; se è uscito, per la cucina le righe
--    si segnano stampate (`prepared_at`, la stessa firma che la pagina
--    Cucina usa dall'08/08) e il biglietto del turno pure (`stampata_il`).
--
-- 🔴 SENZA STAMPANTI NON CAMBIA NIENTE. Nessuna stampante attiva per quel
--    reparto = nessun lavoro, e la pagina Cucina resta quella di oggi. In
--    produzione oggi non c'è nessun apparecchio: questa migrazione lì non
--    fa uscire niente finché Alessio non ne scrive uno.
--
-- 🔴 IL BAR NON SI SEGNA. Al bar `prepared_at` vuol dire «evaso», non
--    «stampato»: se il ponte lo scrivesse, il giro sparirebbe dallo schermo
--    del Bar prima di essere preparato. Per il bar si stampa e basta.
--
-- 🔴 UN INVIO NON SI FERMA MAI PER LA STAMPA. Il trigger che accoda prende
--    ogni errore e lo lascia passare come avviso: una comanda che non arriva
--    in cucina perché la coda ha un difetto sarebbe molto peggio di un
--    foglio da stampare a mano. La pagina Cucina vede che il foglio non è in
--    coda e lo dice.
--
-- 🔴 STAMPATO A MANO = TOLTO DALLA CODA. Quando qualcuno stampa dal browser
--    (o dice «è uscito»), le righe prendono `prepared_at` e i lavori che le
--    aspettavano si annullano: così il foglio non esce due volte.
--    «Incerto» resta come prima: non si ristampa mai da solo.
--
-- ⚠️ Gli scontrini restano fuori: `tipo` ammette 'comanda' e 'chiamata',
--    che sono fogli non fiscali, e nient'altro di nuovo.

-- ---------------------------------------------------------------------
-- 1. I lavori sanno di quale comanda sono
-- ---------------------------------------------------------------------
alter table lavori_stampa add column if not exists order_id    uuid references orders(id) on delete cascade;
alter table lavori_stampa add column if not exists chiamata_id uuid references chiamate_turno(id) on delete cascade;
alter table lavori_stampa add column if not exists reparto     order_destination;
alter table lavori_stampa add column if not exists righe       uuid[];

comment on constraint lavori_stampa_order_id_fkey on lavori_stampa is
  'Il lavoro di una comanda appartiene a un conto che esiste: se il conto sparisce, sparisce anche il lavoro.';
comment on constraint lavori_stampa_chiamata_id_fkey on lavori_stampa is
  'Il lavoro di un biglietto del turno appartiene a un biglietto che esiste.';

comment on column lavori_stampa.order_id is
  'Per una comanda o un biglietto del turno: il conto da cui viene.';
comment on column lavori_stampa.chiamata_id is
  'Per un biglietto «avanti col prossimo turno»: quale biglietto.';
comment on column lavori_stampa.reparto is
  'Per una comanda: il reparto che la riceve (cucina o bar).';
comment on column lavori_stampa.righe is
  'Per una comanda: le righe d''ordine stampate su questo foglio. Quando è uscito, per la cucina si segnano stampate.';
comment on column lavori_stampa.tipo is
  'prova = un foglio di prova; stato = chiedere all''apparecchio come sta; comanda = il foglio di una comanda per la cucina o il bar; chiamata = il biglietto «avanti col prossimo turno». Gli scontrini non sono ammessi.';

create index if not exists lavori_stampa_order_id on lavori_stampa (order_id) where order_id is not null;
create index if not exists lavori_stampa_chiamata_id on lavori_stampa (chiamata_id) where chiamata_id is not null;
create index if not exists lavori_stampa_righe on lavori_stampa using gin (righe) where righe is not null;

alter table lavori_stampa drop constraint if exists lavoro_tipo_di_questo_passo;
alter table lavori_stampa add constraint lavoro_tipo_di_questo_passo
  check (tipo in ('prova', 'stato', 'comanda', 'chiamata'));
comment on constraint lavoro_tipo_di_questo_passo on lavori_stampa is
  'La coda accetta prove di stampa, letture di stato, comande e biglietti del turno: gli scontrini arriveranno con un passo dedicato.';

alter table lavori_stampa drop constraint if exists lavoro_legami_del_tipo;
alter table lavori_stampa add constraint lavoro_legami_del_tipo
  check (case tipo
           when 'comanda' then order_id is not null and reparto is not null and chiamata_id is null
                          and coalesce(cardinality(righe), 0) between 1 and 200
           when 'chiamata' then order_id is not null and chiamata_id is not null
                           and reparto = 'cucina' and righe is null
           else order_id is null and chiamata_id is null and reparto is null and righe is null
         end);
comment on constraint lavoro_legami_del_tipo on lavori_stampa is
  'Una comanda dice di quale conto, reparto e righe è (al massimo 200); un biglietto del turno dice quale biglietto; una prova o uno stato non sono legati a nessun conto.';

-- Una comanda lunga è più di un foglio di prova.
alter table lavori_stampa drop constraint if exists lavoro_esito_misurato;
alter table lavori_stampa add constraint lavoro_esito_misurato
  check ((esito is null or pg_column_size(esito) <= 4000)
     and (errore_testo is null or length(errore_testo) <= 500)
     and pg_column_size(contenuto) <= 16000);
comment on constraint lavoro_esito_misurato on lavori_stampa is
  'Il contenuto e la risposta di un lavoro di stampa hanno una misura massima: una comanda non è un libro.';

-- 🔴 L'indice «un lavoro aperto per apparecchio» vale solo per prove e
--    stati, come annunciato da 20261028000005: più comande possono
--    aspettare insieme la stessa stampante.
drop index if exists lavori_stampa_uno_aperto_per_apparecchio;
create unique index if not exists lavori_stampa_una_prova_aperta_per_apparecchio
  on lavori_stampa (dispositivo_id) where stato in ('in_coda', 'in_corso') and tipo in ('prova', 'stato');

-- ---------------------------------------------------------------------
-- 2. Il contenuto di una comanda
-- ---------------------------------------------------------------------
-- Le parole sono quelle di `src/lib/constants.js` (ALLERGENS): sulla carta
-- si leggono come a schermo.
create or replace function public.etichetta_allergene(p allergen)
returns text
language sql
stable
set search_path to 'public'
as $function$
  select case p::text
    when 'glutine' then 'Glutine' when 'crostacei' then 'Crostacei' when 'uova' then 'Uova'
    when 'pesce' then 'Pesce' when 'arachidi' then 'Arachidi' when 'soia' then 'Soia'
    when 'latte' then 'Latte' when 'frutta_guscio' then 'Frutta a guscio' when 'sedano' then 'Sedano'
    when 'senape' then 'Senape' when 'sesamo' then 'Sesamo'
    when 'anidride_solforosa' then 'Anidride solforosa' when 'lupini' then 'Lupini'
    when 'molluschi' then 'Molluschi' else p::text end
$function$;

-- 🔴 IL FOGLIO DICE LE STESSE COSE DELLA PAGINA CUCINA (Cucina.jsx): il
--    tavolo, l'ora del primo piatto, i turni con le loro righe di stacco,
--    «bis di …» per un bis (`nomeRiga`), gli allergeni tolti e le frasi
--    delle sostituzioni prima della nota, la nota del tavolo in fondo.
--    Qui c'è solo il CONTENUTO, in forma di dati: l'impaginazione la fa il
--    ponte, e nessun comando per la stampante passa da qui.
create or replace function public.componi_comanda(p_order uuid, p_reparto order_destination, p_righe uuid[], p_aggiunta boolean)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'reparto', p_reparto,
    'tavolo', o.table_label,
    'ora', (select to_char(min(i.sent_at) at time zone 'Europe/Rome', 'HH24:MI')
              from order_items i where i.id = any(p_righe)),
    'aggiunta', coalesce(p_aggiunta, false),
    'nota_tavolo', nullif(btrim(coalesce(o.note, '')), ''),
    'turni', coalesce((
      select jsonb_agg(jsonb_build_object('turno', t.turno, 'righe', t.righe) order by t.turno)
        from (
          select i.turno,
                 jsonb_agg(jsonb_build_object(
                   'quantita', i.quantity,
                   'nome', case when r.recipe_type = 'finger' then 'bis di ' || r.name
                                else coalesce(nullif(r.name, ''), i.free_text_name, '') end,
                   'senza', (select coalesce(jsonb_agg(etichetta_allergene(a.allergene) order by a.allergene::text), '[]'::jsonb)
                               from (select distinct s.allergene from order_item_sostituzioni s
                                      where s.order_item_id = i.id) a),
                   'frasi', (select coalesce(jsonb_agg(s.descrizione order by s.descrizione), '[]'::jsonb)
                               from order_item_sostituzioni s where s.order_item_id = i.id),
                   'nota', nullif(btrim(coalesce(i.note, '')), ''))
                   order by i.sent_at, i.created_at) as righe
            from order_items i
            left join recipes r on r.id = i.recipe_id
           where i.id = any(p_righe) and i.voided_at is null
           group by i.turno
        ) t), '[]'::jsonb))
    from orders o where o.id = p_order
$function$;

revoke all on function public.etichetta_allergene(allergen) from public, anon, authenticated;
revoke all on function public.componi_comanda(uuid, order_destination, uuid[], boolean) from public, anon, authenticated;

-- La stampante attiva di un reparto, se c'è.
create or replace function public.stampante_del_reparto(p_reparto order_destination)
returns uuid
language sql
stable
set search_path to 'public'
as $function$
  select id from dispositivi
   where attivo and tipo = 'stampante_comande' and reparto = p_reparto
   limit 1
$function$;

revoke all on function public.stampante_del_reparto(order_destination) from public, anon, authenticated;

-- Accoda un foglio di comanda. Non controlla chi chiama: gira dentro i
-- trigger e dentro `manda_alla_stampante`, che hanno già deciso.
create or replace function public.accoda_comanda(p_order uuid, p_reparto order_destination, p_righe uuid[], p_aggiunta boolean)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_disp uuid := stampante_del_reparto(p_reparto);
  v_id   uuid;
begin
  if v_disp is null or coalesce(cardinality(p_righe), 0) = 0 then
    return null;
  end if;
  insert into lavori_stampa (dispositivo_id, tipo, order_id, reparto, righe, contenuto)
  values (v_disp, 'comanda', p_order, p_reparto, p_righe,
          componi_comanda(p_order, p_reparto, p_righe, p_aggiunta))
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.accoda_chiamata(p_chiamata uuid)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_disp uuid := stampante_del_reparto('cucina');
  v_id   uuid;
begin
  if v_disp is null then
    return null;
  end if;
  insert into lavori_stampa (dispositivo_id, tipo, order_id, chiamata_id, reparto, contenuto)
  select v_disp, 'chiamata', c.order_id, c.id, 'cucina',
         jsonb_build_object('reparto', 'cucina', 'chiamata', true, 'tavolo', o.table_label,
                            'ora', to_char(c.creata_il at time zone 'Europe/Rome', 'HH24:MI'))
    from chiamate_turno c join orders o on o.id = c.order_id
   where c.id = p_chiamata
  returning id into v_id;
  return v_id;
end $function$;

revoke all on function public.accoda_comanda(uuid, order_destination, uuid[], boolean) from public, anon, authenticated;
revoke all on function public.accoda_chiamata(uuid) from public, anon, authenticated;

-- Quali righe di un lavoro devono ancora uscire: non stornate e, per la
-- cucina, non ancora stampate (al bar `prepared_at` vuol dire «evaso»,
-- non «stampato», e non conta).
create or replace function public.righe_ancora_da_stampare(p_righe uuid[], p_reparto order_destination)
returns uuid[]
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(array_agg(i.id order by i.turno, i.created_at), '{}')
    from order_items i
   where i.id = any(p_righe) and i.voided_at is null
     and (p_reparto = 'bar' or i.prepared_at is null)
$function$;

-- I lavori che aspettano righe ormai stampate (da un'altra parte: il
-- browser, una ristampa) o stornate si sistemano:
--   · niente più da stampare → annullato;
--   · in coda, con qualche riga già uscita → annullato, e un lavoro nuovo
--     con le sole righe che mancano. Il contenuto è una fotografia: se
--     restasse quello, il ponte ristamperebbe anche ciò che è uscito
--     (revisione del database, 29/10).
-- ⚠️ Un lavoro fallito o incerto con righe ancora da stampare resta com'è:
--    lo vede la pagina Cucina, e decide una persona.
create or replace function public.chiudi_lavori_gia_stampati(p_toccate uuid[])
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  l record;
  v_resto uuid[];
begin
  for l in
    select * from lavori_stampa
     where tipo = 'comanda' and stato in ('in_coda', 'fallito', 'incerto') and righe && p_toccate
     for update
  loop
    v_resto := righe_ancora_da_stampare(l.righe, l.reparto);
    if cardinality(v_resto) = 0 then
      update lavori_stampa
         set stato = 'annullato', finito_il = now(),
             errore_testo = case when l.stato = 'incerto'
                                 then 'Segnato uscito da una persona che ha guardato la stampante.'
                                 else 'Già stampato da un''altra parte, o stornato: tolto dalla coda.' end
       where id = l.id;
    elsif l.stato = 'in_coda' and cardinality(v_resto) < cardinality(l.righe) then
      update lavori_stampa
         set stato = 'annullato', finito_il = now(),
             errore_testo = 'Una parte è già uscita: rimesso in coda con le sole righe che mancano.'
       where id = l.id;
      perform accoda_comanda(l.order_id, l.reparto, v_resto, coalesce((l.contenuto->>'aggiunta')::boolean, false));
    end if;
  end loop;
end $function$;

revoke all on function public.righe_ancora_da_stampare(uuid[], order_destination) from public, anon, authenticated;
revoke all on function public.chiudi_lavori_gia_stampati(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. I trigger: l'invio accoda, la stampa a mano toglie
-- ---------------------------------------------------------------------
-- ⚠️ A livello di ISTRUZIONE, con le tabelle di passaggio: un invio di
--    sette piatti è un `update` solo, e deve diventare un foglio solo per
--    reparto, non sette. (Postgres non ammette le tabelle di passaggio
--    insieme a `update of colonna`: per questo si guarda ogni update e si
--    filtra qui sotto.)
create or replace function public.comande_alla_coda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  g record;
  v_toccate uuid[];
begin
  -- ⚠️ Prima di tutto: questo update riguarda la stampa? Quasi mai (una
  --    nota, un prezzo in bozza): allora si esce subito, senza aprire
  --    blocchi d'eccezione su ogni modifica della tabella.
  if not exists (select 1 from nuove n join vecchie v on v.id = n.id
                  where (v.sent_at is null and n.sent_at is not null)
                     or (v.prepared_at is null and n.prepared_at is not null)
                     or (v.voided_at is null and n.voided_at is not null)) then
    return null;
  end if;

  -- (a) Righe segnate stampate (cucina) o stornate adesso: i lavori che le
  --     aspettavano si sistemano.
  begin
    select array_agg(n.id) into v_toccate
      from nuove n join vecchie v on v.id = n.id
     where (v.prepared_at is null and n.prepared_at is not null and n.destination = 'cucina')
        or (v.voided_at is null and n.voided_at is not null);
    if v_toccate is not null then
      perform chiudi_lavori_gia_stampati(v_toccate);
    end if;
  exception when others then
    raise warning 'Una riga è cambiata, ma la coda di stampa non si è aggiornata: %', sqlerrm;
  end;

  -- (b) Righe appena inviate: un foglio per conto e reparto, ognuno nel
  --     suo blocco — un foglio che non entra non toglie gli altri.
  --     🔴 L'AGGIUNTA è un foglio a parte, come in `bigliettiCucina`: le
  --     righe di un turno di cui la cucina ha già avuto la carta.
  --     ⚠️ Una riga della cucina già stampata non si accoda.
  begin
  for g in
    select s.order_id, s.destination, s.aggiunta,
           array_agg(s.id order by s.turno, s.created_at) as ids
      from (
        select n.*,
               (n.destination = 'cucina' and exists (
                  select 1 from order_items x
                   where x.order_id = n.order_id and x.destination = 'cucina'
                     and x.turno = n.turno and x.prepared_at is not null and x.voided_at is null)) as aggiunta
          from nuove n join vecchie v on v.id = n.id
         where v.sent_at is null and n.sent_at is not null and n.voided_at is null
           and (n.destination = 'bar' or n.prepared_at is null)
      ) s
     group by s.order_id, s.destination, s.aggiunta,
              case when s.aggiunta then s.turno end
  loop
    begin
      perform accoda_comanda(g.order_id, g.destination, g.ids, g.aggiunta);
    exception when others then
      raise warning 'La comanda è partita, ma non è entrata nella coda di stampa: %', sqlerrm;
    end;
  end loop;
  exception when others then
    raise warning 'La comanda è partita, ma la coda di stampa non l''ha letta: %', sqlerrm;
  end;
  return null;
end $function$;

drop trigger if exists trg_comande_alla_coda on order_items;
create trigger trg_comande_alla_coda
  after update on order_items
  referencing old table as vecchie new table as nuove
  for each statement execute function comande_alla_coda();

create or replace function public.chiamata_alla_coda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    if tg_op = 'INSERT' then
      if new.stampata_il is null then
        perform accoda_chiamata(new.id);
      end if;
    elsif old.stampata_il is null and new.stampata_il is not null then
      update lavori_stampa
         set stato = 'annullato', finito_il = now(),
             errore_testo = 'Già stampato da un''altra parte: tolto dalla coda.'
       where chiamata_id = new.id and stato in ('in_coda', 'fallito', 'incerto');
    end if;
  exception when others then
    raise warning 'Il biglietto del turno è partito, ma non è entrato nella coda di stampa: %', sqlerrm;
  end;
  return null;
end $function$;

drop trigger if exists trg_chiamata_alla_coda on chiamate_turno;
create trigger trg_chiamata_alla_coda
  after insert or update of stampata_il on chiamate_turno
  for each row execute function chiamata_alla_coda();

revoke all on function public.comande_alla_coda() from public, anon, authenticated;
revoke all on function public.chiamata_alla_coda() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Quello che scade da solo
-- ---------------------------------------------------------------------
-- Come prima, più una cosa: una comanda ancora in coda su un conto ormai
-- chiuso non serve più (il ponte era spento per tutta la cena).
create or replace function public.scadi_lavori_abbandonati()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  update lavori_stampa
     set stato = 'incerto', finito_il = now(), errore_codice = 'interrotto',
         errore_testo = 'Il ponte ha preso questo lavoro e non ha più risposto: forse è uscito, forse no. Guarda la stampante e decidi tu.'
   where stato = 'in_corso' and preso_il < now() - interval '5 minutes';

  update lavori_stampa l
     set stato = 'annullato', finito_il = now(),
         errore_testo = 'Il conto è stato chiuso prima che il ponte stampasse: non serve più.'
   where l.stato = 'in_coda' and l.order_id is not null
     and exists (select 1 from orders o where o.id = l.order_id and o.status <> 'aperto');

  -- ⚠️ E una comanda ferma in coda da tre ore non esce più da sola: con il
  --    ponte spento tutta la sera, riaccenderlo alle 23 stamperebbe la
  --    cena intera (revisione del database, 29/10). La pagina Cucina la
  --    mostra come «non è in coda», e si manda a mano se serve ancora.
  update lavori_stampa
     set stato = 'annullato', finito_il = now(),
         errore_testo = 'Rimasto in coda più di tre ore: non lo stampo più da solo.'
   where stato = 'in_coda' and tipo in ('comanda', 'chiamata') and creato_il < now() - interval '3 hours';
end $function$;

revoke all on function public.scadi_lavori_abbandonati() from public, anon, authenticated;

-- La prova di stampa guarda solo le prove e gli stati: una comanda in coda
-- non è «una prova che aspetta il ponte».
create or replace function public.chiedi_lavoro_dispositivo(p_dispositivo_id uuid, p_tipo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_disp dispositivi%rowtype;
  v_id   uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può provare gli apparecchi.';
  end if;
  if p_tipo not in ('prova', 'stato') then
    raise exception 'Si può chiedere una prova di stampa o lo stato dell''apparecchio, nient''altro.';
  end if;

  perform scadi_lavori_abbandonati();

  select * into v_disp from dispositivi where id = p_dispositivo_id;
  if not found then
    raise exception 'Questo apparecchio non c''è più: ricarica la pagina.';
  end if;
  if not v_disp.attivo then
    raise exception '«%» è spento nel gestionale: accendilo prima di provarlo.', v_disp.nome;
  end if;
  if exists (select 1 from lavori_stampa
              where dispositivo_id = p_dispositivo_id and stato in ('in_coda', 'in_corso')
                and tipo in ('prova', 'stato')) then
    raise exception 'Per «%» c''è già una prova che aspetta il ponte: aspetta che finisca, oppure annullala.', v_disp.nome;
  end if;

  begin
    insert into lavori_stampa (dispositivo_id, tipo, contenuto)
    values (p_dispositivo_id, p_tipo,
            jsonb_build_object(
              'titolo', case when p_tipo = 'prova' then 'PROVA DI STAMPA' else 'STATO' end,
              'righe', jsonb_build_array(
                'Borgo 58',
                v_disp.nome,
                'Documento non fiscale',
                to_char(now() at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI'))))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Per «%» c''è già una prova che aspetta il ponte: aspetta che finisca, oppure annullala.', v_disp.nome;
  end;
  return v_id;
end $function$;

-- ---------------------------------------------------------------------
-- 5. L'esito del ponte segna il foglio della cucina
-- ---------------------------------------------------------------------
create or replace function public.ponte_esito_lavoro(
  p_chiave text, p_id uuid, p_stato text, p_errore_codice text,
  p_errore_testo text, p_stato_dispositivo text, p_esito jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_chiave uuid := ponte_entra(p_chiave);
  v_lavoro lavori_stampa%rowtype;
  v_stato_disp text := case when p_stato_dispositivo in ('pronto', 'carta_finita', 'coperchio_aperto', 'non_risponde', 'errore')
                            then p_stato_dispositivo else 'sconosciuto' end;
  v_codice     text := case when p_errore_codice in ('carta_finita', 'coperchio_aperto', 'non_risponde', 'risposta_a_meta', 'rifiutato', 'interrotto')
                            then p_errore_codice else 'sconosciuto' end;
  v_testo      text := case when p_stato = 'stampato' then null else left(p_errore_testo, 500) end;
begin
  if not is_titolare() then
    raise exception 'La chiave del ponte appartiene a un accesso che non è il titolare.';
  end if;
  if p_stato not in ('stampato', 'fallito', 'incerto') then
    raise exception 'L''esito di un lavoro è stampato, fallito o incerto.';
  end if;

  update lavori_stampa
     set stato = p_stato, finito_il = now(),
         errore_codice = case when p_stato = 'stampato' then null else v_codice end,
         errore_testo = v_testo,
         esito = case when pg_column_size(p_esito) <= 4000 then p_esito end
   where id = p_id and preso_da = v_chiave
     and (stato = 'in_corso' or (stato = 'incerto' and errore_codice = 'interrotto'))
   returning * into v_lavoro;
  if v_lavoro.id is null then
    raise exception 'Questo lavoro non è in corso per questo ponte: forse è già stato chiuso.';
  end if;

  update dispositivi
     set ultimo_stato = v_stato_disp,
         ultimo_stato_testo = v_testo,
         ultimo_contatto_il = case when v_stato_disp = 'non_risponde' then ultimo_contatto_il else now() end
   where id = v_lavoro.dispositivo_id;

  -- 🔴 Uscito = stampato anche per la pagina Cucina. Tutte le righe dello
  --    stesso foglio prendono la stessa ora: è la firma con cui
  --    `bigliettiCucina` le rimette insieme per una ristampa.
  -- ⚠️ Mai per il bar (vedi in testa), e senza far fallire l'esito: se il
  --    conto si è chiuso nel frattempo e il database rifiuta il segno, il
  --    lavoro resta comunque «stampato».
  if p_stato = 'stampato' then
    begin
      if v_lavoro.tipo = 'comanda' and v_lavoro.reparto = 'cucina' then
        update order_items set prepared_at = now()
         where id = any(v_lavoro.righe) and prepared_at is null and voided_at is null;
      elsif v_lavoro.tipo = 'chiamata' then
        update chiamate_turno set stampata_il = now()
         where id = v_lavoro.chiamata_id and stampata_il is null;
      end if;
    exception when others then
      raise warning 'Il foglio è uscito, ma non si è potuto segnare stampato: %', sqlerrm;
    end;
  end if;
end $function$;

-- ---------------------------------------------------------------------
-- 6. La pagina Cucina: cosa sta succedendo, e i due tasti
-- ---------------------------------------------------------------------
-- ⚠️ Per chi lavora in sala e in cucina, non solo per il titolare: lo
--    staff non legge `lavori_stampa`, ma deve sapere se il foglio è uscito.
--    Si vedono solo i fogli dei conti aperti, e niente indirizzi.
-- 🔴 SOLO FRASI FISSE, MAI IL TESTO DEL PONTE: quello può dire
--    «ECONNREFUSED 192.168.1.50:9100», cioè l'indirizzo della stampante
--    (revisione del database, 29/10). Il testo intero lo vede il titolare
--    nella pagina Stampanti.
create or replace function public.frase_di_stampa(p_codice text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case p_codice
    when 'carta_finita' then 'la carta è finita: cambia il rotolo.'
    when 'coperchio_aperto' then 'il coperchio della stampante è aperto: chiudilo.'
    when 'non_risponde' then 'la stampante non risponde: è accesa? Ha la rete?'
    when 'interrotto' then 'il ponte si è fermato a metà.'
    when 'errore' then 'la stampante segnala un errore: spegnila e riaccendila.'
    when 'pronto' then null
    when 'sconosciuto' then null
    else case when p_codice is null then null else 'la stampante non l''ha stampato.' end
  end
$function$;

revoke all on function public.frase_di_stampa(text) from public, anon, authenticated;

create or replace function public.stato_stampa_cucina()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_disp dispositivi%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;
  select * into v_disp from dispositivi where id = stampante_del_reparto('cucina');
  return jsonb_build_object(
    'stampante', case when v_disp.id is null then null else jsonb_build_object(
      'nome', v_disp.nome, 'stato', v_disp.ultimo_stato, 'testo', frase_di_stampa(v_disp.ultimo_stato)) end,
    'ponte_acceso', exists (select 1 from chiavi_ponte c
                             where c.revocata_il is null and c.ultimo_battito > now() - interval '90 seconds'),
    'lavori', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'tipo', l.tipo, 'stato', l.stato, 'righe', to_jsonb(l.righe),
               'chiamata_id', l.chiamata_id, 'errore', frase_di_stampa(l.errore_codice), 'creato_il', l.creato_il)
               order by l.creato_il)
        from lavori_stampa l join orders o on o.id = l.order_id and o.status = 'aperto'
       where l.reparto = 'cucina' and l.tipo in ('comanda', 'chiamata')), '[]'::jsonb));
end $function$;

-- «Riprova», «Ristampa», «Mandalo alla stampante»: il foglio di nuovo in
-- coda. Prima si tolgono i lavori che aspettavano le stesse righe — un
-- foglio fallito o incerto si sostituisce, non si somma.
-- ⚠️ Per un foglio incerto questo tasto è la scelta di una persona che ha
--    guardato la stampante: è il «decide una persona» del 28/10.
create or replace function public.manda_alla_stampante(p_righe uuid[], p_chiamata uuid, p_aggiunta boolean)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order   uuid;
  v_reparto order_destination;
  v_quante  integer;
  v_id      uuid;
begin
  -- Solo chi ha un ruolo nel locale (staff o titolare).
  if auth.uid() is null or not exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'Operazione consentita solo a chi lavora nel locale.';
  end if;
  if p_chiamata is null and coalesce(cardinality(p_righe), 0) not between 1 and 200 then
    raise exception 'Un foglio ha da 1 a 200 righe.';
  end if;
  perform scadi_lavori_abbandonati();

  -- ⚠️ Un tasto premuto da due persone insieme fa UN foglio: si passa uno
  --    alla volta (revisione del database, 29/10). Il secondo trova il
  --    lavoro del primo e lo sostituisce, invece di sommarlo.
  perform pg_advisory_xact_lock(hashtextextended('manda_alla_stampante', 0));

  -- Un freno: una coda lunga vuol dire una stampante ferma, e altra carta
  -- in coda non la fa ripartire.
  if (select count(*) from lavori_stampa where stato = 'in_coda' and tipo in ('comanda', 'chiamata')) >= 40 then
    raise exception 'Ci sono già 40 fogli che aspettano la stampante: guarda il ponte e la stampante prima di mandarne altri.';
  end if;

  if p_chiamata is not null then
    select c.order_id into v_order from chiamate_turno c join orders o on o.id = c.order_id
     where c.id = p_chiamata and o.status = 'aperto';
    if v_order is null then
      raise exception 'Questo biglietto non è più di un conto aperto: ricarica la pagina.';
    end if;
    if stampante_del_reparto('cucina') is null then
      raise exception 'Non c''è una stampante attiva per la cucina: stampa da qui.';
    end if;
    if exists (select 1 from lavori_stampa where chiamata_id = p_chiamata and stato = 'in_corso') then
      raise exception 'La stampante sta già stampando questo biglietto: aspetta qualche secondo.';
    end if;
    update lavori_stampa set stato = 'annullato', finito_il = now(), errore_testo = 'Sostituito da una nuova stampa.'
     where chiamata_id = p_chiamata and stato in ('in_coda', 'fallito', 'incerto');
    return accoda_chiamata(p_chiamata);
  end if;

  select min(i.order_id::text)::uuid, min(i.destination::text)::order_destination,
         count(distinct (i.order_id, i.destination))
    into v_order, v_reparto, v_quante
    from order_items i join orders o on o.id = i.order_id and o.status = 'aperto'
   where i.id = any(p_righe) and i.sent_at is not null and i.voided_at is null;
  if v_order is null or v_quante <> 1
     or (select count(*) from order_items where id = any(p_righe) and sent_at is not null and voided_at is null)
        <> cardinality(p_righe) then
    raise exception 'Questo foglio è cambiato nel frattempo: ricarica la pagina.';
  end if;
  if stampante_del_reparto(v_reparto) is null then
    raise exception 'Non c''è una stampante attiva per questo reparto: stampa da qui.';
  end if;
  if exists (select 1 from lavori_stampa where righe && p_righe and stato = 'in_corso') then
    raise exception 'La stampante sta già stampando questo foglio: aspetta qualche secondo.';
  end if;

  update lavori_stampa set stato = 'annullato', finito_il = now(), errore_testo = 'Sostituito da una nuova stampa.'
   where tipo = 'comanda' and righe && p_righe and stato in ('in_coda', 'fallito', 'incerto');
  v_id := accoda_comanda(v_order, v_reparto, p_righe, p_aggiunta);
  return v_id;
end $function$;

revoke all on function public.stato_stampa_cucina() from public, anon, authenticated;
revoke all on function public.manda_alla_stampante(uuid[], uuid, boolean) from public, anon, authenticated;
revoke all on function public.chiedi_lavoro_dispositivo(uuid, text) from public, anon, authenticated;
revoke all on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.stato_stampa_cucina() to authenticated;
grant execute on function public.manda_alla_stampante(uuid[], uuid, boolean) to authenticated;
grant execute on function public.chiedi_lavoro_dispositivo(uuid, text) to authenticated;
grant execute on function public.ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb) to anon, authenticated;

comment on function public.ponte_prendi_lavori(text, integer) is
  'Il ponte prende fino a 10 lavori in coda. Un lavoro preso e non chiuso da cinque minuti diventa incerto, e non torna in coda.';
comment on function public.stato_stampa_cucina() is
  'Per la pagina Cucina: la stampante della cucina, se il ponte è acceso, e i fogli dei conti aperti con il loro stato nella coda.';
comment on function public.manda_alla_stampante(uuid[], uuid, boolean) is
  'Rimette in coda un foglio di comanda (le sue righe) o un biglietto del turno, al posto dei lavori falliti o incerti per le stesse righe.';

-- ---------------------------------------------------------------------
-- 7. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_foto     jsonb := foto_righe();
  v_titolare uuid;
  v_staff    uuid;
  v_ente     uuid;
  v_ordine   uuid;
  v_disp     uuid;
  v_k        jsonb;
  v_a        uuid;
  v_b        uuid;
  v_c        uuid;
  v_bar      uuid;
  v_ch       uuid;
  v_lavoro   lavori_stampa%rowtype;
  v_r        jsonb;
  v_n        integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'VERIFICA: servono un titolare e uno staff in user_roles.';
  end if;

  if has_function_privilege('anon', 'stato_stampa_cucina()', 'execute')
     or has_function_privilege('anon', 'manda_alla_stampante(uuid[], uuid, boolean)', 'execute')
     or has_function_privilege('authenticated', 'componi_comanda(uuid, order_destination, uuid[], boolean)', 'execute')
     or has_function_privilege('authenticated', 'accoda_comanda(uuid, order_destination, uuid[], boolean)', 'execute')
     or not has_function_privilege('authenticated', 'stato_stampa_cucina()', 'execute')
     or not has_function_privilege('anon', 'ponte_esito_lavoro(text, uuid, text, text, text, text, jsonb)', 'execute') then
    raise exception 'VERIFICA: i permessi delle comande nella coda non sono quelli dichiarati.';
  end if;

  begin
    -- Una stampante finta per la cucina, nessuna per il bar. Quelle vere
    -- di Prova si spengono per la durata della verifica (si annulla tutto).
    update dispositivi set attivo = false where attivo and tipo = 'stampante_comande';
    insert into dispositivi (nome, tipo, protocollo, indirizzo, porta, reparto)
    values ('ZZ cucina della verifica', 'stampante_comande', 'simulatore', '127.0.0.1', 19190, 'cucina')
    returning id into v_disp;

    insert into orders (entity_id, table_label, status, note)
    values (v_ente, 'ZZ tavolo', 'aperto', 'Senza fretta') returning id into v_ordine;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
    values (v_ordine, 'ZZ antipasto', 'cucina', 2, 1, 1) returning id into v_a;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno, note)
    values (v_ordine, 'ZZ secondo', 'cucina', 1, 1, 2, 'ben cotto') returning id into v_b;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ vino', 'bar', 1, 1) returning id into v_bar;

    -- (1) Un invio con cucina e bar: un foglio solo, per la cucina.
    update order_items set sent_at = now() where id in (v_a, v_b, v_bar);
    select count(*) into v_n from lavori_stampa where order_id = v_ordine;
    select * into v_lavoro from lavori_stampa where order_id = v_ordine;
    if v_n <> 1 or v_lavoro.reparto <> 'cucina' or not (v_lavoro.righe @> array[v_a, v_b])
       or cardinality(v_lavoro.righe) <> 2
       or jsonb_array_length(v_lavoro.contenuto->'turni') <> 2
       or v_lavoro.contenuto->>'tavolo' <> 'ZZ tavolo'
       or v_lavoro.contenuto->'turni'->1->'righe'->0->>'nota' <> 'ben cotto'
       or (v_lavoro.contenuto->>'aggiunta')::boolean then
      raise exception 'VERIFICA (1): l''invio non ha accodato il foglio giusto: % lavori, %.', v_n, v_lavoro.contenuto;
    end if;

    -- (2) Il ponte lo stampa: le due righe sono stampate, con la stessa ora.
    perform set_config('request.jwt.claims', json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
    v_k := crea_chiave_ponte('ZZ mini-PC');
    perform set_config('request.jwt.claims', null, true);
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 1 or v_r->0->>'tipo' <> 'comanda' then
      raise exception 'VERIFICA (2a): il ponte non ha preso la comanda: %.', v_r;
    end if;
    perform ponte_esito_lavoro(v_k->>'chiave', v_lavoro.id, 'stampato', null, null, 'pronto', '{}');
    if (select count(distinct prepared_at) from order_items where id in (v_a, v_b) and prepared_at is not null) <> 1
       or (select count(*) from order_items where id in (v_a, v_b) and prepared_at is not null) <> 2
       or (select prepared_at from order_items where id = v_bar) is not null then
      raise exception 'VERIFICA (2b): il foglio uscito non ha segnato le righe della cucina (e solo quelle).';
    end if;

    -- (3) Un piatto in più nel secondo turno è un'aggiunta, su un foglio a parte.
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
    values (v_ordine, 'ZZ contorno', 'cucina', 1, 1, 2) returning id into v_c;
    update order_items set sent_at = now() where id = v_c;
    select * into v_lavoro from lavori_stampa where order_id = v_ordine and stato = 'in_coda';
    if v_lavoro.id is null or v_lavoro.righe <> array[v_c] or not (v_lavoro.contenuto->>'aggiunta')::boolean then
      raise exception 'VERIFICA (3): l''aggiunta non è un foglio a parte: %.', v_lavoro.contenuto;
    end if;

    -- (4) Stampato dal browser: il lavoro esce dalla coda e non stampa due volte.
    update order_items set prepared_at = now() where id = v_c;
    if (select stato from lavori_stampa where id = v_lavoro.id) <> 'annullato' then
      raise exception 'VERIFICA (4): un foglio stampato a mano è rimasto in coda.';
    end if;

    -- (4b) Stampato a mano solo in parte: il lavoro in coda si rifà con le
    --      sole righe che mancano, così il ponte non ristampa il resto.
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
    values (v_ordine, 'ZZ dolce uno', 'cucina', 1, 1, 3) returning id into v_c;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price, turno)
    values (v_ordine, 'ZZ dolce due', 'cucina', 1, 1, 3) returning id into v_ch;
    update order_items set sent_at = now() where id in (v_c, v_ch);
    update order_items set prepared_at = now() where id = v_c;
    if (select count(*) from lavori_stampa where order_id = v_ordine and stato = 'in_coda') <> 1
       or (select righe from lavori_stampa where order_id = v_ordine and stato = 'in_coda') <> array[v_ch] then
      raise exception 'VERIFICA (4b): stampato a metà, il lavoro in coda non porta le sole righe che mancano.';
    end if;
    update order_items set voided_at = now(), void_reason = 'ZZ verifica' where id = v_ch;
    if exists (select 1 from lavori_stampa where order_id = v_ordine and stato = 'in_coda') then
      raise exception 'VERIFICA (4c): una riga stornata è rimasta da stampare.';
    end if;

    -- (5) Il biglietto del turno: in coda, e via se stampato a mano.
    insert into chiamate_turno (order_id) values (v_ordine) returning id into v_ch;
    select * into v_lavoro from lavori_stampa where chiamata_id = v_ch;
    if v_lavoro.id is null or v_lavoro.stato <> 'in_coda' or v_lavoro.contenuto->>'tavolo' <> 'ZZ tavolo' then
      raise exception 'VERIFICA (5a): il biglietto del turno non è entrato in coda.';
    end if;
    update chiamate_turno set stampata_il = now() where id = v_ch;
    if (select stato from lavori_stampa where id = v_lavoro.id) <> 'annullato' then
      raise exception 'VERIFICA (5b): un biglietto stampato a mano è rimasto in coda.';
    end if;

    -- (6) Lo staff vede lo stato e rimanda un foglio; il bar senza
    --     stampante non si può mandare.
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := stato_stampa_cucina();
    if v_r->'stampante'->>'nome' <> 'ZZ cucina della verifica' or jsonb_array_length(v_r->'lavori') < 3 then
      raise exception 'VERIFICA (6a): lo staff non vede lo stato della stampa: %.', v_r;
    end if;
    if manda_alla_stampante(array[v_a, v_b], null, false) is null then
      raise exception 'VERIFICA (6b): la ristampa non è entrata in coda.';
    end if;
    begin
      perform manda_alla_stampante(array[v_bar], null, false);
      raise exception 'VERIFICA (6c): una comanda del bar è andata in coda senza stampante.';
    exception when others then
      if sqlerrm not like 'Non c''è una stampante attiva%' then raise; end if;
    end;
    -- (6d) Allo staff nessun indirizzo, neanche dentro un messaggio d'errore.
    if stato_stampa_cucina()::text ~ '\d+\.\d+\.\d+\.\d+' then
      raise exception 'VERIFICA (6d): lo stato della stampa mostra un indirizzo allo staff.';
    end if;
    reset role;
    perform set_config('request.jwt.claims', null, true);

    -- (7) Senza stampante l'invio passa come oggi, senza lavori.
    update dispositivi set attivo = false where id = v_disp;
    insert into order_items (order_id, free_text_name, destination, quantity, unit_price)
    values (v_ordine, 'ZZ dolce', 'cucina', 1, 1) returning id into v_c;
    update order_items set sent_at = now() where id = v_c;
    if (select sent_at from order_items where id = v_c) is null
       or exists (select 1 from lavori_stampa where v_c = any(righe)) then
      raise exception 'VERIFICA (7): senza stampante l''invio non è andato come oggi.';
    end if;

    -- (8) Un conto chiuso col foglio ancora in coda: il ponte non lo stampa.
    update dispositivi set attivo = true where id = v_disp;
    update orders set status = 'chiuso', closed_at = now() where id = v_ordine;
    v_r := ponte_prendi_lavori(v_k->>'chiave', 5);
    if jsonb_array_length(v_r) <> 0
       or exists (select 1 from lavori_stampa where order_id = v_ordine and stato = 'in_coda') then
      raise exception 'VERIFICA (8): una comanda di un conto chiuso è ancora da stampare: %.', v_r;
    end if;

    -- (9) Ogni vincolo nuovo ha la sua frase.
    if exists (select 1 from vincoli_senza_frase() v where v.tabella = 'lavori_stampa') then
      raise exception 'VERIFICA (9): un vincolo della coda non ha la sua frase in italiano.';
    end if;

    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm <> 'ZZ_ANNULLA' then raise; end if;
  end;

  reset role;
  perform set_config('request.jwt.claims', null, true);
  perform pretendi_nessun_residuo(v_foto, 'la verifica delle comande nella coda');

  raise notice 'Fatto: un invio accoda un foglio per reparto con una stampante; il ponte lo stampa e la cucina lo vede stampato; l''aggiunta è un foglio a parte; stampato a mano esce dalla coda; il biglietto del turno pure; lo staff vede lo stato e rimanda un foglio; senza stampante tutto come oggi; un conto chiuso non stampa. Provato e annullato: zero residui.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261029000001', 'le_comande_escono_dal_ponte')
on conflict (version) do nothing;
