-- ---------------------------------------------------------------------
-- Un solo conto aperto per tavolo (§3.2.1) — vincolo, non buone intenzioni
-- ---------------------------------------------------------------------
-- Trovato nell'audit dell'08/08/2026. Oggi niente impedisce che lo stesso
-- tavolo abbia DUE conti aperti insieme: la schermata controlla prima di
-- crearne uno, ma legge un elenco caricato qualche secondo prima.
--
-- Con un solo tablet il caso e' raro. Con i due tablet decisi in §3.2.1
-- (Sala + Bar, che prende ordini anche lui) diventa una questione di
-- tempo: due camerieri aprono T1 a pochi secondi di distanza e nascono due
-- conti separati. La griglia ne mostra uno solo, si chiude quello, e
-- l'altro resta aperto per sempre con dentro piatti che nessuno paghera'.
-- Nessun errore, nessun avviso.
--
-- La schermata non puo' garantire l'unicita': puo' solo guardare una foto
-- vecchia di qualche secondo. Solo il database puo', ed e' lo stesso
-- principio di §3.18 — la regola vive nel database, non nell'interfaccia.
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Prima di vincolare: c'e' gia' un doppione?
-- ---------------------------------------------------------------------
-- Se ce ne fossero, la creazione dell'indice fallirebbe con un messaggio
-- oscuro. Meglio fermarsi qui dicendo esattamente quali tavoli sistemare:
-- unire o chiudere due conti e' una decisione di sala, non un'operazione
-- che una migrazione possa prendersi la liberta' di fare da sola.
do $doppioni$
declare
  elenco text;
begin
  select string_agg(table_label || ' (' || n || ' conti)', ', ')
    into elenco
  from (
    select table_label, count(*) as n
    from orders
    where status = 'aperto'
    group by table_label
    having count(*) > 1
  ) d;

  if elenco is not null then
    raise exception E'Ci sono gia'' tavoli con piu'' di un conto aperto: %.\nVanno sistemati a mano PRIMA di applicare questa migrazione (chiudere o annullare quelli di troppo dalla schermata Comande), altrimenti il vincolo non puo'' essere creato.', elenco;
  end if;
end $doppioni$;

-- ---------------------------------------------------------------------
-- 2. Il vincolo
-- ---------------------------------------------------------------------
-- Indice unico PARZIALE: vincola solo le righe con status = 'aperto'.
-- Lo stesso tavolo puo' avere quanti conti chiusi/annullati/omaggiati si
-- vuole nello storico — e' l'apertura contemporanea a non avere senso.
create unique index if not exists uniq_conto_aperto_per_tavolo
  on orders (table_label)
  where status = 'aperto';

comment on index uniq_conto_aperto_per_tavolo is
  'Un tavolo non puo'' avere due conti aperti insieme (§3.2.1). Parziale: lo storico dei conti chiusi sullo stesso tavolo resta libero. Il secondo tentativo riceve un errore 23505, che la schermata Sala traduce in "apro il conto che c''e'' gia''".';

-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
-- Non basta controllare che l'indice esista: §7 punto 2 dice di non
-- dichiarare verificata una regola restrittiva senza averla vista
-- respingere qualcosa davvero. Quindi si prova la collisione vera, su un
-- tavolo finto che viene cancellato subito dopo.
do $verifica$
declare
  esiste boolean;
  respinto boolean := false;
  tavolo_finto constant text := '__prova_vincolo_conto__';
begin
  select exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uniq_conto_aperto_per_tavolo'
  ) into esiste;

  if not esiste then
    raise exception 'Il vincolo uniq_conto_aperto_per_tavolo non esiste: la migrazione non ha fatto quello che dichiara.';
  end if;

  insert into orders (table_label) values (tavolo_finto);

  begin
    insert into orders (table_label) values (tavolo_finto);
  exception
    when unique_violation then respinto := true;
  end;

  delete from orders where table_label = tavolo_finto;

  if not respinto then
    raise exception 'Il vincolo esiste ma NON ha bloccato il secondo conto sullo stesso tavolo: inutile cosi''.';
  end if;

  raise notice 'Vincolo verificato sul campo: il secondo conto aperto sullo stesso tavolo e'' stato respinto, e il tavolo di prova e'' stato rimosso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260808000002', 'un_solo_conto_per_tavolo')
on conflict (version) do nothing;

-- Riepilogo: il vincolo e la fotografia dei conti aperti adesso.
select
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'uniq_conto_aperto_per_tavolo') as vincolo_creato,
  (select count(*) from orders where status = 'aperto')                          as conti_aperti_ora,
  (select count(distinct table_label) from orders where status = 'aperto')       as tavoli_distinti;
