-- ---------------------------------------------------------------------
-- La prova che si dimenticava metà di quello che aveva spostato
-- ---------------------------------------------------------------------
-- Trovato subito dopo aver applicato `20260814000007` in produzione,
-- rileggendo la sala dal connettore invece di fidarsi del «zero residui»
-- che la migrazione stessa dichiarava.
--
-- COSA È SUCCESSO. La verifica di `…007` prova il comando «questa diventa
-- la disposizione base»: sposta due tavoli in un giorno, promuove, e poi
-- rimette la base com'era. Solo che li aveva spostati **in due
-- direzioni** — (1900, 900) e (1990, 900) — e li ha rimessi a posto **su
-- una sola**:
--
--     update dining_tables set x = v_x_base       where label = 'T5';
--     update dining_tables set x = v_x_base + 90  where label = 'T6';
--
-- La `x` è tornata giusta, la `y` è rimasta a 900. Risultato: T5 e T6
-- sono finiti in mezzo ai divani, e la migrazione ha comunque dichiarato
-- «residui della verifica: zero» — perché controllava le righe lasciate
-- in giro (prenotazioni, conti, scostamenti), non i valori cambiati su
-- righe che dovevano restare.
--
-- ⚠️ LA LEZIONE, che vale oltre questo caso. Una verifica che modifica
-- dati esistenti non si ripulisce cancellando: si ripulisce
-- **rimettendo**. E «rimettere» vuol dire salvare la riga intera prima e
-- riscriverla intera dopo, non ricordarsi a mano quali colonne si erano
-- toccate. Quello che si ricorda a mano si dimentica a metà — ed è
-- esattamente quello che è successo qui.
--
-- ⚠️ PERCHÉ NON HO CORRETTO `…007` INVECE DI SCRIVERE QUESTA. Quella
-- migrazione è già applicata in due database: riscriverla farebbe girare
-- a chi controlla un file diverso da quello che ha prodotto lo stato
-- reale (Contratto §8). Su una ricostruzione da zero `…007` rifarà lo
-- stesso spostamento e questa lo rimetterà a posto subito dopo: il
-- risultato finale è lo stesso, e la storia resta leggibile.
--
-- PERIMETRO STRETTO E DICHIARATO: si toccano due sagome, e solo se sono
-- esattamente dove la verifica le ha lasciate. Se nel frattempo Alessio
-- le ha spostate lui, non si tocca niente: una migrazione non sovrascrive
-- una scelta di chi apparecchia.
--
-- Idempotente (§7 punto 3).

do $rimetti$
declare
  n integer := 0;
begin
  -- T5: base dichiarata in `…007` = (1150, 600). La verifica l'ha
  -- lasciato a (1150, 900).
  update dining_tables set y = 600
   where label = 'T5' and tipo = 'tavolo' and x = 1150 and y = 900;
  n := n + coalesce((select count(*) from dining_tables where label = 'T5' and y = 600), 0);

  -- T6: base dichiarata = (1240, 600). Lasciato a (1240, 900).
  update dining_tables set y = 600
   where label = 'T6' and tipo = 'tavolo' and x = 1240 and y = 900;

  select count(*) into n
  from dining_tables
  where label in ('T5', 'T6') and x in (1150, 1240) and y = 900;

  if n > 0 then
    raise exception 'Sono rimaste % sagome nel punto in cui la verifica le aveva lasciate.', n;
  end if;

  raise notice 'Sala rimessa a posto: T5 e T6 sono tornati accanto a T7, dove la migrazione dichiarava di averli messi.';
end $rimetti$;

-- ---------------------------------------------------------------------
-- Verifica — non «le due righe», ma la regola che non erano rispettando
-- ---------------------------------------------------------------------
-- Non si può pretendere che TUTTA la sala stia dove `…007` l'aveva messa:
-- da domani Alessio la sposta, ed è il senso del blocco. Si controlla
-- l'unica cosa che resta vera per sempre: i cinque quadrati della sala
-- bassa stanno alla stessa altezza, cioè sono davvero accostabili in fila
-- come nella disposizione di partenza — che è la cosa che il difetto
-- aveva rotto.
do $verifica$
declare
  n_altezze integer;
begin
  select count(distinct y) into n_altezze
  from dining_tables
  where active and tipo = 'tavolo' and zona = 'sala_bassa';

  if n_altezze <> 1 then
    raise exception 'I tavoli della sala bassa stanno su % altezze diverse: la disposizione di partenza non è quella dichiarata.', n_altezze;
  end if;

  -- E nessuno di loro è finito addosso ai divani.
  if exists (
    select 1 from dining_tables t
    join dining_tables d on d.tipo = 'divano' and d.active
    where t.active and t.tipo = 'tavolo' and t.zona = 'sala_bassa'
      and t.x < d.x + d.larghezza_cm and t.x + t.larghezza_cm > d.x
      and t.y < d.y + d.profondita_cm and t.y + t.profondita_cm > d.y
  ) then
    raise exception 'Un tavolo della sala bassa è sovrapposto a un divano.';
  end if;

  raise notice 'I cinque tavoli della sala bassa sono in fila e nessuno sta addosso ai divani.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000008', 'la_prova_rimette_a_posto')
on conflict (version) do nothing;

select label, x, y
from dining_tables
where active and tipo = 'tavolo'
order by position;
