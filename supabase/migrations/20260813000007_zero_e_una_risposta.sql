-- =====================================================================
-- Zero è una risposta, non una casella vuota
-- =====================================================================
-- Difetto mio, trovato da Alessio dieci minuti dopo aver messo in
-- funzione le schede dei prodotti: ha premuto «Compila con
-- l'assistente», il giro è andato a buon fine — e i cinque prodotti sono
-- rimasti nell'elenco «schede incomplete», tutti con la stessa riga:
-- *manca: percentuale di scarto*.
--
-- LA CAUSA: `prodotti_da_compilare()` considerava incompleto un prodotto
-- con `waste_percentage_default = 0`. Ma **zero è la risposta giusta**
-- per un detergente, per l'olio, per le mandorle già sgusciate, per la
-- semola: non si scarta niente. Il modello rispondeva correttamente 0, la
-- funzione riscriveva 0, e il prodotto restava incompleto per sempre.
--
-- ⚠️ PERCHÉ NON È SOLO UN FASTIDIO ESTETICO: quell'elenco non si sarebbe
-- svuotato mai, e ogni volta che Alessio avesse premuto il pulsante
-- avrebbe **ripagato una chiamata all'AI** per riscrivere zero sopra
-- zero. È la stessa forma del difetto del 12/08 — la mail che veniva
-- riletta ogni quarto d'ora per sempre — e la stessa regola vale: **un
-- lavoro che costa soldi e non converge mai è una perdita che cresce da
-- sola.** Qui, per giunta, converge all'occhio (il giro «riesce») e non
-- converge nei fatti.
--
-- LA CORREZIONE, e non è mettere una soglia: **il gestionale si segna che
-- la scheda è stata compilata**, invece di dedurlo dal valore.
-- `campi_compilati_il` esisteva già dalla migrazione precedente e serviva
-- esattamente a questo — non lo stavo usando. Un valore non può dire da
-- solo se è «vuoto» o «deciso»: 0 kg di scarto e 0 gradi di temperatura
-- sono numeri veri, ed è la stessa trappola per cui il carico da fattura
-- non fa passare la temperatura HACCP da `numeroValido` (0 °C è la
-- temperatura del pesce fresco, non l'assenza di un dato).
-- =====================================================================

create or replace function prodotti_da_compilare()
returns table (
  id       uuid,
  nome     text,
  unita    text,
  categoria text,
  alimentare boolean,
  mancano  text[]
)
language sql
stable
security definer
set search_path = public
as $funzione$
  select i.id, i.name, i.unit::text, i.category::text, i.alimentare,
         array_remove(array[
           case when i.storage_type is null            then 'conservazione'   end,
           case when i.shelf_life_days is null         then 'durata'          end,
           case when i.haccp_receiving_temp is null    then 'temperatura'     end,
           case when coalesce(array_length(i.seasonality, 1), 0) = 0
                                                       then 'stagionalita'    end,
           -- Lo scarto manca solo se NESSUNO ha ancora compilato la
           -- scheda: uno zero scritto dall'assistente e' una risposta.
           case when coalesce(i.waste_percentage_default, 0) = 0
                     and i.campi_compilati_il is null  then 'scarto'          end,
           case when i.origine_allergeni is null       then 'allergeni'       end
         ], null)
    from ingredients i
   where i.active
     and (i.storage_type is null
          or i.shelf_life_days is null
          or i.haccp_receiving_temp is null
          or coalesce(array_length(i.seasonality, 1), 0) = 0
          or (coalesce(i.waste_percentage_default, 0) = 0 and i.campi_compilati_il is null)
          or i.origine_allergeni is null)
   order by i.name;
$funzione$;

comment on function prodotti_da_compilare() is
  'I prodotti con la scheda incompleta, e quali campi mancano. Uno scarto a zero gia'' compilato NON e'' un campo vuoto: e'' la risposta giusta per un olio o un detersivo, e trattarlo come mancante teneva l''elenco pieno per sempre facendo ripagare ogni giro.';

revoke all on function prodotti_da_compilare() from public, anon, authenticated;
grant execute on function prodotti_da_compilare() to authenticated;

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente uuid;
  v_a    uuid;
  n      integer;
begin
  select id into v_ente from entities order by created_at limit 1;
  if v_ente is null then raise exception 'Nessuna entita''.'; end if;

  insert into ingredients (entity_id, name, category, unit)
  values (v_ente, 'PROVA ZERO detersivo', 'altro', 'l') returning id into v_a;

  -- 1. Prima di essere compilato, manca tutto — scarto compreso.
  select count(*) into n from prodotti_da_compilare() p
   where p.id = v_a and 'scarto' = any (p.mancano);
  if n <> 1 then
    raise exception 'Un prodotto mai compilato deve avere lo scarto fra i campi mancanti.';
  end if;

  -- 2. Compilato con scarto ZERO — la risposta giusta per un detersivo —
  --    non deve piu' comparire fra gli incompleti.
  perform applica_scheda_prodotto(v_a, jsonb_build_object(
    'allergeni',       jsonb_build_array(),
    'stagionalita',    jsonb_build_array('gen','feb','mar','apr','mag','giu',
                                         'lug','ago','set','ott','nov','dic'),
    'conservazione',   'dispensa',
    'durata_giorni',   730,
    'temperatura',     'ambiente',
    'scarto_percento', 0));

  select count(*) into n from prodotti_da_compilare() p where p.id = v_a;
  if n <> 0 then
    raise exception 'Un prodotto compilato con scarto zero risulta ancora incompleto: l''elenco non si svuoterebbe mai.';
  end if;

  -- 3. La prova al contrario: se la scheda non fosse mai stata
  --    compilata, lo zero tornerebbe a contare come campo mancante.
  update ingredients set campi_compilati_il = null where id = v_a;
  select count(*) into n from prodotti_da_compilare() p
   where p.id = v_a and 'scarto' = any (p.mancano);
  if n <> 1 then
    raise exception 'Senza scheda compilata, uno scarto a zero deve tornare a mancare.';
  end if;

  -- 4. Pulizia (regola del 12/08).
  delete from ingredients where name like 'PROVA ZERO%';
  select count(*) into n from ingredients where name like 'PROVA ZERO%';
  if n <> 0 then raise exception 'La prova ha lasciato % prodotti.', n; end if;

  raise notice 'Zero e'' una risposta: l''elenco delle schede incomplete adesso si svuota.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260813000007', 'zero_e_una_risposta')
on conflict (version) do nothing;

select count(*) as schede_ancora_incomplete from prodotti_da_compilare();
