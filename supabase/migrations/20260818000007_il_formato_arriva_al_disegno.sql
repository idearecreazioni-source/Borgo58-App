-- =====================================================================
-- IL FORMATO ARRIVA AL DISEGNO  (18/08/2026 — giro E del mandato sala)
-- =====================================================================
-- Il giro E costruisce il magnete: avvicinando due tavoli, il gestionale
-- li fa combaciare da solo invece di pretendere dal dito una precisione
-- di due punti di schermo.
--
-- ⚠️ PERCHE' SERVE UNA MIGRAZIONE PER UNA COSA DI DISEGNO. La regola di
-- Alessio e' che si accosta solo dentro lo STESSO FORMATO — «i due da 180
-- sono di uno stile diverso» — e `coperti_del_giorno()` la applica
-- (`a.formato_id = b.formato_id`). Ma `pianta_del_giorno()`, che e' cio'
-- che il disegno riceve, il formato NON lo dice. Un magnete cieco al
-- formato attaccherebbe un 90 a un 180: lo schermo direbbe «attaccati» e
-- il numero direbbe «separati», sul numero con cui si accettano le
-- prenotazioni.
--
-- La colonna si aggiunge IN FONDO. Chi legge questa funzione la legge per
-- nome (`select p.id, p.x ... from pianta_del_giorno(d) p`), quindi una
-- colonna in coda non sposta niente — ma il verso e' comunque quello
-- prudente, e vale la pena scriverlo perche' la prossima volta non si
-- debba ricontrollare.
--
-- ⚠️ E si passa da DROP: `create or replace` rifiuta un cambio di lista
-- delle colonne restituite. Dopo un drop i permessi tornano aperti al
-- mondo (Postgres concede l'esecuzione a `public` di partenza, e Supabase
-- espone via PostgREST tutto cio' che `anon` puo' eseguire): la revoca e'
-- parte della migrazione, non una cortesia.

drop function if exists pianta_del_giorno(date);

create or replace function pianta_del_giorno(p_data date)
returns table (
  id uuid, label text, tipo text, forma text, zona text,
  larghezza_cm integer, profondita_cm integer,
  spostabile boolean, posti_fissi integer,
  x integer, y integer, ruotato boolean, spostato boolean,
  formato_id uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.label, t.tipo, t.forma, t.zona,
         t.larghezza_cm, t.profondita_cm,
         t.spostabile, t.posti_fissi,
         coalesce(d.x, t.x)             as x,
         coalesce(d.y, t.y)             as y,
         coalesce(d.ruotato, t.ruotato) as ruotato,
         d.id is not null               as spostato,
         t.formato_id
  from dining_tables t
  left join disposizioni_giornaliere d
    on d.dining_table_id = t.id and d.data = p_data
  where t.active
  order by t.position;
$$;

comment on function pianta_del_giorno is
  'La sala com''è quel giorno: pianta base + scostamenti della data. Un solo calcolo per Sala e orari e per le Comande. Dal 18/08 porta anche il FORMATO, perché il disegno sappia cosa si accosta con cosa senza rifarsi la regola per conto proprio.';

revoke all on function pianta_del_giorno(date) from public, anon, authenticated;
grant execute on function pianta_del_giorno(date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  n_tavoli   integer;
  n_formati  integer;
  n_arredi   integer;
  aperta     boolean;
  n_prima    integer;
  canarino   integer;
begin
  -- ⚠️ UN CORPO CHE SI CREA NON E' UN CORPO CHE FUNZIONA (17/08):
  -- Postgres accetta una funzione che ne chiama una inesistente e se ne
  -- accorge solo eseguendola. Quindi la verifica la CHIAMA.
  select count(*) filter (where tipo = 'tavolo'),
         count(*) filter (where tipo = 'tavolo' and formato_id is not null),
         count(*) filter (where tipo <> 'tavolo')
    into n_tavoli, n_formati, n_arredi
    from pianta_del_giorno(current_date);

  if n_tavoli = 0 then
    raise exception 'La pianta non restituisce nessun tavolo: la funzione non risponde.';
  end if;
  if n_formati <> n_tavoli then
    raise exception 'La pianta porta il formato solo su % tavoli su %: il magnete resterebbe cieco proprio dove serve.',
      n_formati, n_tavoli;
  end if;

  -- ⚠️ Gli arredi fissi NON hanno un formato, e va bene: divani e Chef
  -- Table non si accostano a niente. Il controllo c'e' perche' un domani
  -- qualcuno potrebbe renderlo obbligatorio sulla tabella e questa riga
  -- diventerebbe rossa invece di lasciar passare un vincolo che cambia
  -- il significato della colonna.
  if n_arredi > 0
     and (select count(*) from pianta_del_giorno(current_date)
           where tipo <> 'tavolo' and formato_id is not null) > 0 then
    raise exception 'Un arredo fisso dichiara un formato: si accosterebbe a un tavolo.';
  end if;

  -- ⚠️ E chi la usa deve continuare a funzionare: `coperti_del_giorno()`
  -- legge da qui, e una colonna in piu' in coda non deve spostarle
  -- niente. Anche questa e' una CHIAMATA, non una lettura del sorgente.
  select count(*), coalesce(sum(coperti), 0)
    into n_prima, canarino
    from coperti_del_giorno(current_date);
  if n_prima = 0 then
    raise exception 'Il conteggio dei coperti non risponde piu'' dopo il rifacimento della pianta.';
  end if;

  -- --- La porta richiusa dopo il drop ---
  select has_function_privilege('anon', 'pianta_del_giorno(date)', 'execute') into aperta;
  if aperta then
    raise exception 'Dopo il drop la pianta e'' rimasta eseguibile da chiunque abbia la chiave pubblica.';
  end if;
  if not has_function_privilege('authenticated', 'pianta_del_giorno(date)', 'execute') then
    raise exception 'La pianta non e'' piu'' eseguibile dal gestionale: la sala sparirebbe da tutte le schermate.';
  end if;

  -- ⚠️ IL CANARINO SI STAMPA, NON SI PRETENDE. La sala di oggi vale 34
  -- coperti, ed e' il numero che dice se qualcosa si e' mosso che non
  -- doveva. Ma e' una DISPOSIZIONE di Alessio, non una regola: scriverlo
  -- come vincolo farebbe fallire questa migrazione il giorno che lui
  -- sposta un tavolo — un guardiano che dice com'era il mondo quando l'ho
  -- guardato invece di come dev'essere fatto (lezione del 16/08).
  raise notice 'Pianta del giorno: % tavoli col formato, % arredi senza, % tavoloni, % coperti in questa disposizione.',
    n_formati, n_arredi, n_prima, canarino;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000007', 'il_formato_arriva_al_disegno')
on conflict (version) do nothing;
