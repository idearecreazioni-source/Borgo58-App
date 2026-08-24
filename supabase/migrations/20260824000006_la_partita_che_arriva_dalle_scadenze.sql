-- =====================================================================
-- LA PARTITA CHE ARRIVA DALLE SCADENZE
-- 24/08/2026 — decisione di Alessio sull'opzionale A del mandato
-- =====================================================================
-- 🔴 IL DIFETTO, MISURATO. Dalla schermata delle scadenze un pulsante
-- dice «Altre risposte: abbattuto, trasformato, reso al fornitore…» e
-- porta a «Fermi da troppo». Misurato sul progetto di prova:
--
--   lotti in giacenza                       203
--   in «Scadenze — da guardare»              65
--   in «Fermi da troppo»                      0
--   prodotti con una durata dichiarata     2 su 129
--
-- Chi ha in mano il calamaro scaduto e vuole dire «l'ho abbattuto» preme
-- quel pulsante e arriva su una pagina che risponde **«Niente fermo»**.
-- Le sei risposte stanno sulla RIGA di una partita ferma, e quella
-- partita lì non c'è. *Un collegamento che porta in un vicolo cieco e'
-- peggio di un collegamento che manca: promette una strada.*
--
-- ---------------------------------------------------------------------
-- COSA SI DECIDE, E COSA SI E' ESCLUSO
-- ---------------------------------------------------------------------
-- Alessio, 24/08: *«nessun terzo pulsante: la scelta delle due risposte
-- in Scadenze resta. Fai funzionare il collegamento invece di portare a
-- una pagina vuota.»*
--
-- ⚠️ Escluso quindi il terzo bersaglio per riga — cambierebbe di fatto il
-- numero delle risposte in Scadenze, che e' una decisione del 23/08, e va
-- contro «se un comando si ripete per ogni riga, quasi sempre ne basta
-- uno». Resta: **la schermata dei fermi sa mostrare anche le partite non
-- ferme**, quando ci si arriva da lì.
--
-- ⚠️ E LA RADICE RESTA SCOPERTA, dichiarata da Alessio: «Fermi da troppo»
-- e' vuota perche' **2 prodotti su 129 hanno una durata**, e senza durata
-- il fermo non si puo' misurare. Quella si cura con la shelf life, in un
-- lavoro a parte. Questo chiude il vicolo cieco, non la causa.
--
-- ---------------------------------------------------------------------
-- LA FUNZIONE
-- ---------------------------------------------------------------------
-- ⚠️ STESSA FORMA di `partite_ferme()`, colonna per colonna: le due
-- alimentano la stessa schermata e le stesse sei risposte. Se divergesse
-- anche solo una colonna, la riga aperta dal secondo elenco si
-- comporterebbe diversamente da quella aperta dal primo — e nessun errore
-- lo direbbe.
--
-- ⚠️ E la differenza col fermo si LEGGE, non si indovina: `giorni_fermo`
-- resta il numero vero, `durata_giorni` puo' essere **vuota** (nessuna
-- durata dichiarata) e allora `perche` dice che il fermo non e'
-- misurabile — non «zero giorni», che si leggerebbe «appena mossa».
create or replace function partite_in_giacenza(p_cerca text default null)
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
  giorni_fermo   integer,
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
  -- Portiere: `security definer` gira senza RLS, quindi il controllo va
  -- rimesso dentro. Qui basta l'utente autenticato, come per
  -- `partite_ferme()`: sono gli stessi dati, e li vede tutto lo staff.
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
           -- L'orologio riparte da un abbattimento, se c'è stato: stessa
           -- regola di `partite_ferme()`, non una copia diversa.
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
       -- ⚠️ La durata NON e' richiesta qui, ed e' l'unica differenza
       -- sostanziale con `partite_ferme()`: senza, il fermo non si
       -- misura, ma la partita esiste lo stesso e le sei risposte hanno
       -- comunque senso.
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
   -- Le ferme in cima, poi le altre dalla piu' vecchia: chi arriva qui
   -- per una partita precisa la cerca, chi ci arriva per guardare trova
   -- comunque prima quello che ha bisogno di una risposta.
   order by (b.durata is not null and (v_oggi - b.ultima_mossa) > b.durata) desc,
            (v_oggi - b.ultima_mossa) desc,
            b.name;
end $$;

comment on function partite_in_giacenza(text) is
  'Tutte le partite ancora in casa, nella stessa forma di partite_ferme(). Serve alla schermata dei fermi quando ci si arriva dalle Scadenze con una partita in mano: nelle Scadenze le risposte sono due, qui sono sei, e prima quel collegamento portava a una pagina vuota.';

revoke all on function partite_in_giacenza(text) from public, anon;
grant execute on function partite_in_giacenza(text) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica — e ogni prova misura una DIFFERENZA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_ing_con  uuid;
  v_ing_senza uuid;
  v_lotto_c  uuid;
  v_lotto_s  uuid;
  v_forn     uuid;
  v_ente     uuid;
  r          record;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
  v_ferme_p  bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_ferme_p from partite_ferme();
  select id into v_ente from entities order by created_at limit 1;

  -- Perimetro fatto di roba creata qui: mai un ingrediente vero.
  insert into ingredients (entity_id, name, unit, category, shelf_life_days, tenuto_in_magazzino)
  values (v_ente, 'VERIFICA 826 con durata', 'kg', 'altro', 10, true) returning id into v_ing_con;
  insert into ingredients (entity_id, name, unit, category, tenuto_in_magazzino)
  values (v_ente, 'VERIFICA 826 senza durata', 'kg', 'altro', true) returning id into v_ing_senza;

  select id into v_forn from suppliers order by created_at limit 1;

  -- ⚠️ QUARANTA giorni di fermo, non undici: con un valore appena sopra la
  -- soglia, «ferma» e «non ferma» darebbero quasi lo stesso numero e la
  -- prova passerebbe anche col confronto sbagliato di un giorno.
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, received_at)
  values (v_ing_con, v_forn, 5, 5, now() - interval '40 days') returning id into v_lotto_c;
  insert into stock_lots (ingredient_id, supplier_id, quantity_received, quantity_remaining, received_at)
  values (v_ing_senza, v_forn, 5, 5, now() - interval '40 days') returning id into v_lotto_s;

  -- (a) Quella CON durata risulta ferma in tutti e due gli elenchi.
  if not exists (select 1 from partite_ferme() where lotto_id = v_lotto_c) then
    raise exception 'Una partita ferma da 40 giorni con durata 10 deve comparire fra le ferme.';
  end if;
  select * into r from partite_in_giacenza() where lotto_id = v_lotto_c;
  if r.lotto_id is null then raise exception 'La partita con durata manca dall''elenco completo.'; end if;
  if not r.e_ferma then raise exception 'La partita ferma deve risultare ferma anche nell''elenco completo.'; end if;
  if r.giorni_fermo <> 40 then raise exception 'Attesi 40 giorni di fermo, contati %.', r.giorni_fermo; end if;

  -- (b) 🔴 IL CASO CHE HA PRODOTTO IL DIFETTO: quella SENZA durata non
  --     compare fra le ferme e **compare** nell'elenco completo.
  if exists (select 1 from partite_ferme() where lotto_id = v_lotto_s) then
    raise exception 'Una partita senza durata non puo'' risultare ferma: non c''e'' niente con cui misurare.';
  end if;
  select * into r from partite_in_giacenza() where lotto_id = v_lotto_s;
  if r.lotto_id is null then
    raise exception 'La partita senza durata deve comparire nell''elenco completo: e'' il caso per cui esiste.';
  end if;
  if r.e_ferma then raise exception 'Senza durata non si puo'' dichiarare ferma.'; end if;
  -- ⚠️ E la durata resta VUOTA, non zero: uno zero si leggerebbe «dura
  -- zero giorni», cioe' scaduta subito.
  if r.durata_giorni is not null then
    raise exception 'Senza durata dichiarata il campo deve restare vuoto, e vale %.', r.durata_giorni;
  end if;
  if r.perche not ilike '%non ha una durata dichiarata%' then
    raise exception 'Senza durata il motivo deve dirlo, e dice «%».', r.perche;
  end if;

  -- (c) La ricerca per nome restringe davvero, e non taglia via il resto
  --     quando e' vuota.
  if (select count(*) from partite_in_giacenza('VERIFICA 826 senza')) <> 1 then
    raise exception 'La ricerca per nome deve trovare esattamente la partita cercata.';
  end if;
  if (select count(*) from partite_in_giacenza('')) < 2 then
    raise exception 'Una ricerca vuota non deve filtrare niente.';
  end if;
  if (select count(*) from partite_in_giacenza('zzz-non-esiste-zzz')) <> 0 then
    raise exception 'Una ricerca senza risultati deve dare zero righe, non tutte.';
  end if;

  -- --- Pulizia: solo le righe di questa verifica, figlie prima delle madri.
  delete from stock_lots where id in (v_lotto_c, v_lotto_s);
  delete from price_history where ingredient_id in (v_ing_con, v_ing_senza);
  delete from ingredients where id in (v_ing_con, v_ing_senza);

  if (select count(*) from partite_ferme()) <> v_ferme_p then
    raise exception 'Le partite ferme non sono tornate a %.', v_ferme_p;
  end if;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Partite in giacenza: verificato. % ferme prima e dopo, nessun residuo.', v_ferme_p;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000006', 'la_partita_che_arriva_dalle_scadenze') on conflict (version) do nothing;
