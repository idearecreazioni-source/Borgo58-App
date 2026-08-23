-- =====================================================================
-- GLI INCASSI, GIORNO PER GIORNO
-- 23/08/2026
-- =====================================================================
-- Blocco 4 del mandato del 23/08.
--
-- ---------------------------------------------------------------------
-- IL BUCO, e Alessio lo cercava
-- ---------------------------------------------------------------------
-- Fra il TOTALE DEL PERIODO e il SINGOLO CONTO non c'era niente. La
-- domanda «quanto abbiamo fatto martedi'?» non aveva una risposta in
-- nessuna schermata: o si guardava il mese, o si contavano i conti a mano.
--
-- ---------------------------------------------------------------------
-- 🔴 DUE COLONNE, NON UNA — e il caso che lo dimostra e' nei dati veri
-- ---------------------------------------------------------------------
-- Misurato sul progetto di prova:
--
--   | serata     | conti | incassato | scontrinato |
--   |------------|-------|-----------|-------------|
--   | 02/06/2026 |   3   |  338,00   |   189,50    |
--   | 03/06/2026 |   3   |  583,50   |   583,50    |
--   | 04/06/2026 |   4   |  645,00   |   571,50    |
--
-- ⚠️ Il 2 giugno e' **il caso che serve a far vedere perche'**: 148,50 euro
-- incassati senza un documento fiscale. Con una colonna sola quel giorno
-- sarebbe indistinguibile dal 3 giugno, dove i due numeri coincidono.
--
-- ⚠️ E la differenza NON e' un errore di calcolo: e' merce da fare. I due
-- totali in cima alla schermata gia' la dicono per l'intero periodo — qui
-- si dice **in quale giorno**, che e' l'unica forma in cui si puo' andare
-- a chiudere il buco.
--
-- ---------------------------------------------------------------------
-- LE SCELTE, tutte gia' prese altrove e qui solo rispettate
-- ---------------------------------------------------------------------
--   * si conta a **SERATE**, non a giorni di calendario
--     (`serata_di_servizio(closed_at)`): un conto chiuso all'una di notte
--     appartiene alla sera prima, ed e' la regola delle 5 del 18/08;
--   * gli **omaggi non contano**: incassano zero, quindi non c'e' nessun
--     corrispettivo da emettere — stessa esclusione di `quadratura_fiscale`;
--   * l'incasso e' `coalesce(collected_amount, totale_conto())`, cioe' **cio'
--     che e' entrato davvero** e non il valore dei piatti.
--
-- 🔴 IL CORPO E' STATO PRESO VIVO DA `quadratura_fiscale` (`npm run
-- funzione:viva`), non riscritto a memoria: e' la stessa regola vista per
-- giorno invece che in totale, e le due devono restare d'accordo. Se
-- l'avessi ricopiata dal file che l'ha creata avrei perso tutto cio' che
-- le migrazioni successive le hanno aggiunto.
-- =====================================================================

create or replace function quadratura_fiscale_per_giorno(
  p_entity_id uuid,
  p_dal       date default null,
  p_al        date default null
)
returns table (
  serata          date,
  quanti          integer,
  incassato       numeric,
  scontrinato     numeric,
  da_fiscalizzare numeric,
  quanti_da_fare  integer
)
language plpgsql
stable
security definer
set search_path = public
as $funzione$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale e'' riservata al titolare.';
  end if;

  return query
  with conti as (
    select serata_di_servizio(o.closed_at) as sera,
           o.documento_fiscale,
           coalesce(d.collected_amount, t.totale) as incasso
      from orders o
      left join discounts_gifts d on d.id = o.discount_gift_id
      cross join lateral totale_conto(o.id) t
     where o.entity_id = p_entity_id
       and o.status in ('chiuso', 'omaggiato')
       and serata_di_servizio(o.closed_at) between v_dal and v_al
  ),
  reali as (select * from conti where incasso > 0)
  select r.sera,
         count(*)::integer,
         sum(r.incasso),
         coalesce(sum(r.incasso) filter (
           where r.documento_fiscale in ('scontrino', 'fattura')), 0),
         coalesce(sum(r.incasso) filter (
           where r.documento_fiscale is null
              or r.documento_fiscale = 'fattura_da_emettere'), 0),
         coalesce(count(*) filter (
           where r.documento_fiscale is null
              or r.documento_fiscale = 'fattura_da_emettere'), 0)::integer
    from reali r
   group by r.sera
   order by r.sera desc;
end $funzione$;

comment on function quadratura_fiscale_per_giorno(uuid, date, date) is
  'Incassato e scontrinato serata per serata (23/08/2026). ⚠️ DUE colonne e non una: il 02/06 del progetto di prova fa 338,00 incassati contro 189,50 scontrinati, e con un numero solo quel giorno sarebbe indistinguibile da uno in cui i due numeri coincidono. Conta a SERATE, non a giorni di calendario.';

revoke all on function quadratura_fiscale_per_giorno(uuid, date, date) from public, anon, authenticated;
grant execute on function quadratura_fiscale_per_giorno(uuid, date, date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit    uuid;
  v_staff  uuid;
  v_ente   uuid;
  v_tot    numeric;
  v_somma  numeric;
  v_n      int;
  v_passato boolean;
  v_motivo text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  select id into v_ente from entities order by created_at limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- ===== 1. 🔴 LA PROPRIETA' CHE CONTA: la somma dei giorni deve fare
  -- =====    il totale del periodo. Se i due numeri divergessero, la
  -- =====    schermata direbbe due cose diverse sullo stesso fatto — che
  -- =====    e' precisamente cio' che questa schermata serve a scoprire.
  select q.incassato into v_tot from quadratura_fiscale(v_ente, null, null) q;
  select coalesce(sum(g.incassato), 0) into v_somma
    from quadratura_fiscale_per_giorno(v_ente, null, null) g;

  if v_tot <> v_somma then
    raise exception 'La somma dei giorni fa % e il totale del periodo %: due numeri per lo stesso fatto.',
      v_somma, v_tot;
  end if;

  -- ⚠️ E vale anche per lo scontrinato, che e' la seconda colonna: se
  -- tornasse solo il primo numero, meta' della schermata sarebbe falsa
  -- senza che nulla lo mostri.
  select q.fiscalizzato into v_tot from quadratura_fiscale(v_ente, null, null) q;
  select coalesce(sum(g.scontrinato), 0) into v_somma
    from quadratura_fiscale_per_giorno(v_ente, null, null) g;
  if v_tot <> v_somma then
    raise exception 'Lo scontrinato dei giorni fa % e quello del periodo %.', v_somma, v_tot;
  end if;

  -- ===== 2. Ogni giornata quadra da sola: incassato = scontrinato + da fare.
  if exists (
    select 1 from quadratura_fiscale_per_giorno(v_ente, null, null) g
     where g.incassato <> g.scontrinato + g.da_fiscalizzare
  ) then
    raise exception 'C''e'' una serata in cui incassato non fa scontrinato piu'' da fiscalizzare.';
  end if;

  -- ===== 3. ⚠️ E il caso che il blocco esiste per mostrare DEVE esserci,
  -- =====    o la prova gira sul caso vuoto (regola del 17/08): serve
  -- =====    almeno una serata in cui i due numeri NON coincidono.
  select count(*) into v_n from quadratura_fiscale_per_giorno(v_ente, null, null) g
   where g.incassato <> g.scontrinato;
  if v_n = 0 then
    raise notice 'ATTENZIONE: nessuna serata con incassato diverso da scontrinato. Il caso che questa schermata serve a mostrare non e'' presente in questo database, quindi la prova non lo esercita.';
  end if;

  -- ===== 3-bis. 🔴 IL CASO SI COSTRUISCE, non si spera che ci sia.
  -- =====
  -- ⚠️ Trovato rompendo: togliendo le fatture dallo scontrinato la
  -- verifica restava VERDE, perche' in questo database di fatture non ce
  -- n'e' nessuna (misurato: 319 scontrini, 10 da emettere, 0 fatture). La
  -- prova non era falsa — girava su uno stato di partenza che non
  -- conteneva il caso, ed e' la regola del 17/08.
  --
  -- ⚠️ Si cambia il documento di un conto vero e **si rimette la riga
  -- com'era**, non si ricorda a mano quale colonna si e' toccata (regola
  -- del 14/08: quello che si ricorda a mano si dimentica a meta').
  declare
    v_conto    uuid;
    v_doc_era  text;
    v_sera     date;
    v_sco0     numeric;
    v_sco1     numeric;
    v_sco2     numeric;
    v_incasso  numeric;
  begin
    select o.id, o.documento_fiscale::text, serata_di_servizio(o.closed_at)
      into v_conto, v_doc_era, v_sera
      from orders o
     where o.entity_id = v_ente
       and o.status = 'chiuso'
       and o.documento_fiscale = 'scontrino'
     limit 1;

    if v_conto is null then
      raise notice 'Nessun conto con scontrino: il caso della fattura non e'' stato esercitato.';
    else
      select g.scontrinato into v_sco0
        from quadratura_fiscale_per_giorno(v_ente, v_sera, v_sera) g;

      -- (a) FATTURA: conta come scontrinato quanto uno scontrino.
      update orders set documento_fiscale = 'fattura' where id = v_conto;
      select g.scontrinato into v_sco1
        from quadratura_fiscale_per_giorno(v_ente, v_sera, v_sera) g;
      if v_sco1 <> v_sco0 then
        raise exception 'Una fattura non conta fra i documenti emessi: lo scontrinato passa da % a %.',
          v_sco0, v_sco1;
      end if;

      -- (b) SENZA DOCUMENTO: lo scontrinato deve CALARE di quell'importo.
      --     ⚠️ È la meta' che discrimina: senza, la prova passerebbe anche
      --     se lo scontrinato contasse tutto.
      update orders set documento_fiscale = null where id = v_conto;
      select g.scontrinato into v_sco2
        from quadratura_fiscale_per_giorno(v_ente, v_sera, v_sera) g;
      if v_sco2 >= v_sco0 then
        raise exception 'Togliendo il documento a un conto lo scontrinato non cala: % contro %.',
          v_sco2, v_sco0;
      end if;

      -- ⚠️ La riga torna com'era: una verifica che modifica dati esistenti
      -- si ripulisce RIMETTENDO, non cancellando (regola del 14/08).
      update orders set documento_fiscale = v_doc_era
       where id = v_conto;

      select g.scontrinato into v_sco1
        from quadratura_fiscale_per_giorno(v_ente, v_sera, v_sera) g;
      if v_sco1 <> v_sco0 then
        raise exception 'La verifica non ha rimesso il conto com''era: % contro %.', v_sco1, v_sco0;
      end if;
    end if;
  end;

  perform set_config('request.jwt.claims', null, true);

  -- ===== 4. Il portiere: dalla sala non si leggono gli incassi.
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    v_passato := false;
    begin
      perform * from quadratura_fiscale_per_giorno(v_ente, null, null);
      v_passato := true;
    exception when others then
      v_motivo := sqlerrm;
    end;

    perform set_config('request.jwt.claims', null, true);

    if v_passato then
      raise exception 'Dalla sala si possono leggere gli incassi giorno per giorno.';
    end if;
    if v_motivo not like '%riservata al titolare%' then
      raise exception 'Il portiere ha rifiutato per un altro motivo: %', v_motivo;
    end if;
  end if;

  raise notice 'Verifica passata: la somma dei giorni fa il totale del periodo, su tutte e due le colonne.';
end $verifica$;


-- ---------------------------------------------------------------------
-- CODA, fuori mandato e dichiarata: «1 conti» e gli accenti
-- ---------------------------------------------------------------------
-- ⚠️ Trovato guardando la schermata mentre si provava il blocco 4, non
-- cercandolo: l'avvertenza in cima diceva **«1 conti incassati non hanno
-- ancora un documento»**, e scriveva gli accenti con l'apostrofo
-- («finche'», «c'e'», «puo'»). Sono due righe, ed è la schermata dei
-- soldi: un plurale sbagliato lì fa sembrare sbagliato anche il numero.
--
-- 🔴 Il corpo è preso VIVO dal database, non dal file che l'ha creata.
create or replace function quadratura_fiscale(p_entity_id uuid, p_dal date default null, p_al date default null)
returns table (
  incassato numeric, fiscalizzato numeric, da_fiscalizzare numeric,
  quanti_da_fare integer, fatture_da_emettere numeric, quante_fatture integer,
  dal date, al date, avvertenza text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_dal date := coalesce(p_dal, date_trunc('month', oggi_a_roma())::date);
  v_al  date := coalesce(p_al, oggi_a_roma());
begin
  if not is_titolare() then
    raise exception 'La quadratura fiscale è riservata al titolare.';
  end if;

  return query
  with conti as (
    select o.documento_fiscale,
           coalesce(d.collected_amount, t.totale) as incasso
      from orders o
      left join discounts_gifts d on d.id = o.discount_gift_id
      cross join lateral totale_conto(o.id) t
     where o.entity_id = p_entity_id
       and o.status in ('chiuso', 'omaggiato')
       and serata_di_servizio(o.closed_at) between v_dal and v_al
  ),
  reali as (select * from conti where incasso > 0)
  select
    coalesce((select sum(incasso) from reali), 0),
    coalesce((select sum(incasso) from reali
               where documento_fiscale in ('scontrino', 'fattura')), 0),
    coalesce((select sum(incasso) from reali
               where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere'), 0),
    coalesce((select count(*) from reali
               where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere'), 0)::integer,
    coalesce((select sum(incasso) from reali where documento_fiscale = 'fattura_da_emettere'), 0),
    coalesce((select count(*) from reali where documento_fiscale = 'fattura_da_emettere'), 0)::integer,
    v_dal, v_al,
    -- Il numero e il suo limite viaggiano insieme.
    (case
       when (select count(*) from reali) = 0 then
         'Nessun conto incassato nel periodo.'
       when (select count(*) from reali
              where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere') = 0 then
         'Tutti i conti incassati del periodo hanno il loro documento.'
       -- ⚠️ Il singolare non è una finezza: «1 conti» in una schermata di
       -- soldi fa dubitare del numero accanto.
       when (select count(*) from reali
              where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere') = 1 then
         'Un conto incassato non ha ancora un documento fiscale. Resta in elenco finché non lo emetti: non sparisce da solo.'
       else
         (select count(*) from reali
           where documento_fiscale is null or documento_fiscale = 'fattura_da_emettere')
         || ' conti incassati non hanno ancora un documento fiscale. Restano in elenco finché non li emetti: non spariscono da soli.'
     end)
    || ' Gli omaggi non sono contati: non incassano niente, quindi non c''è corrispettivo da emettere.'
    || (case
          when exists (select 1 from reali where documento_fiscale = 'scontrino') then ''
          else ' Finché non c''è il registratore telematico nessuno scontrino può essere battuto, quindi è normale che qui risulti tutto da fare.'
        end);
end;
$function$;

revoke all on function quadratura_fiscale(uuid, date, date) from public, anon, authenticated;
grant execute on function quadratura_fiscale(uuid, date, date) to authenticated;

do $coda$
declare
  v_tit uuid; v_ente uuid; v_frase text;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  select id into v_ente from entities order by created_at limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select q.avvertenza into v_frase from quadratura_fiscale(v_ente, null, null) q;

  -- Nessun apostrofo al posto di un accento, in nessuna delle frasi.
  if v_frase like '%finche''%' or v_frase like '%c''e''%'
     or v_frase like '%puo''%' or v_frase like '%e'' normale%' then
    raise exception 'L''avvertenza scrive ancora gli accenti con l''apostrofo: %', v_frase;
  end if;
  if v_frase like '%1 conti%' then
    raise exception 'L''avvertenza dice ancora «1 conti».';
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Coda: l''avvertenza usa gli accenti veri e il singolare quando il conto è uno.';
end $coda$;

-- ⚠️ La registrazione sta in FONDO, dopo la coda: era finita a metà file,
-- e una migrazione che si registra prima di aver finito risulterebbe
-- applicata anche se la parte dopo fallisse (§7.4 del protocollo).
insert into applied_migrations (version, name)
values ('20260823000015', 'gli_incassi_giorno_per_giorno') on conflict (version) do nothing;
