-- =====================================================================
-- «STESSA FORMA» VUOL DIRE ANCHE STESSI NOMI
-- 24/08/2026 — correzione della 20260824000006, aggiunta e non riscritta
-- =====================================================================
-- 🔴 LA MIGRAZIONE PRECEDENTE PROMETTEVA UNA COSA E NE FACEVA UN'ALTRA.
-- Il suo commento dice, testualmente: *«STESSA FORMA di partite_ferme(),
-- colonna per colonna: le due alimentano la stessa schermata e le stesse
-- sei risposte. Se divergesse anche solo una colonna, la riga aperta dal
-- secondo elenco si comporterebbe diversamente da quella aperta dal
-- primo — e nessun errore lo direbbe.»*
--
-- E poi chiamava `giorni_fermo` la colonna che in `partite_ferme()` si
-- chiama **`ferma_da`**. Cioè: aveva scritto da sé il difetto che
-- prometteva di evitare, nella stessa pagina.
--
-- ⚠️ COME SAREBBE FALLITO: la schermata legge `p.ferma_da`, quindi le
-- righe che arrivano dall'elenco completo avrebbero mostrato **«ferma da
-- undefined giorni»**. Non un errore, non una schermata bianca: una riga
-- che si legge male e basta. Trovato confrontando i nomi veri delle due
-- funzioni prima di collegarle alla schermata, non provandole.
--
-- ⚠️ E LA 006 NON SI RISCRIVE (regola di Alessio, 23/08): il file racconta
-- cosa è successo quel giorno, e correggerlo lo renderebbe una bugia per
-- chi ricostruirà da zero fra un anno. Vale **anche quando la correzione
-- è una riga sola e il file non è ancora andato in produzione** — ed è
-- esattamente questo caso.
--
-- ⚠️ SERVE UN `drop`, non un `create or replace`: cambiare il NOME di una
-- colonna di uscita non è una sostituzione, Postgres risponde «cannot
-- change name of output parameter». E dopo un drop i permessi tornano
-- aperti al mondo (trappola dell'11/08), quindi si richiudono qui sotto.
-- =====================================================================

-- rete-guardie: partite_in_giacenza — la colonna «giorni_fermo» sparisce
-- APPOSTA: si chiamava cosi' nella 006 e in «partite_ferme()» si chiama
-- «ferma_da». Non si toglie un'informazione, si allinea un nome — ed e'
-- tutto il senso di questa migrazione.
drop function if exists partite_in_giacenza(text);

create function partite_in_giacenza(p_cerca text default null)
returns table (
  lotto_id       uuid,
  ingrediente_id uuid,
  prodotto       text,
  unita          text,
  giacenza       numeric,
  trasformata    numeric,
  da_guardare    numeric,
  durata_giorni  integer,
  ultima_mossa   date,
  ferma_da       integer,
  scadenza       date,
  ricordamelo_il date,
  perche         text,
  e_ferma        boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_oggi date := oggi_a_roma();
  v_q    text := nullif(btrim(coalesce(p_cerca, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  return query
  with mosse as (
    select c.ingredient_id,
           max((c.created_at at time zone 'Europe/Rome')::date) as ultima
      from stock_consumptions c
     group by c.ingredient_id
  ),
  trasf as (
    select t.lotto_id, sum(t.quantita) as quanta
      from trasformazioni_dichiarate t
     group by t.lotto_id
  ),
  base as (
    select l.id, l.ingredient_id, i.name, i.unit::text as u,
           l.quantity_remaining as giac,
           coalesce(tr.quanta, 0) as trasf,
           i.shelf_life_days as durata,
           greatest(
             coalesce(m.ultima, (l.received_at at time zone 'Europe/Rome')::date),
             coalesce((l.abbattuta_il at time zone 'Europe/Rome')::date,
                      (l.received_at at time zone 'Europe/Rome')::date)
           ) as ultima_mossa,
           l.expiry_date, l.ricordamelo_il
      from stock_lots l
      join ingredients i on i.id = l.ingredient_id
      left join mosse m on m.ingredient_id = l.ingredient_id
      left join trasf tr on tr.lotto_id = l.id
     where l.quantity_remaining > 0
       and l.chiusa_il is null
       and i.tenuto_in_magazzino
       and (v_q is null or i.name ilike '%' || v_q || '%')
  )
  select b.id, b.ingredient_id, b.name, b.u,
         b.giac, b.trasf,
         greatest(b.giac - b.trasf, 0),
         b.durata,
         b.ultima_mossa,
         (v_oggi - b.ultima_mossa)::int,
         b.expiry_date,
         b.ricordamelo_il,
         case
           when b.durata is null then
             format('Ferma da %s giorni. Questo prodotto non ha una durata dichiarata, quindi il fermo non si puo'' giudicare.',
                    (v_oggi - b.ultima_mossa)::int)
           when (v_oggi - b.ultima_mossa) > b.durata then
             format('Ferma da %s giorni, e questo prodotto dura %s giorni.',
                    (v_oggi - b.ultima_mossa)::int, b.durata)
           else
             format('Ferma da %s giorni, dentro i %s giorni che dura.',
                    (v_oggi - b.ultima_mossa)::int, b.durata)
         end,
         b.durata is not null
           and (v_oggi - b.ultima_mossa) > b.durata
           and (b.ricordamelo_il is null or b.ricordamelo_il <= v_oggi)
           and b.giac > b.trasf
    from base b
   where b.giac > b.trasf
   order by (b.durata is not null and (v_oggi - b.ultima_mossa) > b.durata) desc,
            (v_oggi - b.ultima_mossa) desc,
            b.name;
end $$;

comment on function partite_in_giacenza(text) is
  'Tutte le partite ancora in casa, nella stessa forma di partite_ferme() — stessi nomi di colonna, perche'' alimentano la stessa schermata. Serve a chi arriva dalle Scadenze con una partita in mano.';

revoke all on function partite_in_giacenza(text) from public, anon;
grant execute on function partite_in_giacenza(text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — la PROPRIETA' che la 006 prometteva e non teneva
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_diverse text;
begin
  -- 🔴 Non si controlla «la colonna si chiama ferma_da»: si controlla che
  -- **ogni** colonna di `partite_ferme()` esista con lo stesso nome e lo
  -- stesso tipo nell'altra. E' una PROPRIETA', e resta vera domani quando
  -- qualcuno aggiungera' una colonna a una delle due — anzi, diventa
  -- rossa proprio allora, che e' il punto.
  with colonne as (
    select p.proname,
           u.nome,
           format_type(u.tipo, null) as tipo
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral unnest(p.proargnames, p.proallargtypes) as u(nome, tipo)
     where n.nspname = 'public'
       and p.proname in ('partite_ferme', 'partite_in_giacenza')
  ),
  ferme as (select nome, tipo from colonne where proname = 'partite_ferme'),
  giacenza as (select nome, tipo from colonne where proname = 'partite_in_giacenza')
  select string_agg(f.nome || ' (' || f.tipo || ')', ', ' order by f.nome)
    into v_diverse
    from ferme f
   where not exists (
     select 1 from giacenza g where g.nome = f.nome and g.tipo = f.tipo
   );

  if v_diverse is not null then
    raise exception 'partite_in_giacenza non ha le stesse colonne di partite_ferme: mancano o differiscono %.', v_diverse;
  end if;

  -- ⚠️ E la controprova che il confronto DISCRIMINA: se non trovasse
  -- nessuna colonna da nessuna delle due parti, il `not exists` sarebbe
  -- vuoto e la verifica passerebbe senza aver guardato niente. E' la
  -- trappola del caso vuoto (17/08), qui sui cataloghi invece che sui
  -- dati.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       cross join lateral unnest(p.proargnames) as u(nome)
      where n.nspname = 'public' and p.proname = 'partite_ferme') < 10 then
    raise exception 'partite_ferme dichiara meno di dieci colonne: il confronto non sta guardando quello che crede.';
  end if;

  raise notice 'Le due funzioni hanno la stessa forma, nomi compresi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000007', 'stessa_forma_vuol_dire_stessi_nomi') on conflict (version) do nothing;
