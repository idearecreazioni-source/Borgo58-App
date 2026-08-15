-- ---------------------------------------------------------------------
-- Le regole di deducibilità si leggono — accenti al posto degli apostrofi
-- ---------------------------------------------------------------------
-- Trovato da Alessio aprendo la schermata per la prima volta, un'ora dopo
-- la consegna: le regole si chiamano «Marketing / pubblicita'» e le note
-- dicono «per una societa'», «le indennita' chilometriche», «cio' che non
-- si deduce».
--
-- PERCHÉ È SUCCESSO, ed è un errore mio e non una scelta. Dentro
-- `20260815000002` ho scritto i dati seminati in ASCII per prudenza sugli
-- apostrofi SQL, mentre i commenti della stessa migrazione hanno gli
-- accenti e sono passati senza problemi (`PGCLIENTENCODING=UTF8` è imposto
-- da `scripts/comune.mjs`). Quindi la prudenza non serviva, e ha degradato
-- proprio la parte che si vede.
--
-- ⚠️ E NON È UN DETTAGLIO ESTETICO, per due motivi. Il primo: le etichette
-- originali in `DEDUCTION_CATEGORIES` avevano gli accenti giusti —
-- spostarle era un trasloco, e un trasloco che peggiora il testo non è un
-- trasloco fedele. Il secondo: `regole_deducibilita.etichetta` non è
-- un'etichetta di schermata, è un DATO. Finisce nell'export CSV, nel menu
-- delle causali, sulla scheda del fornitore e — il giorno che Laura
-- risponde — dentro un documento che qualcuno legge fuori di qui.
--
-- NON SI CORREGGE LA MIGRAZIONE GIÀ APPLICATA (Contratto §8): girerebbe a
-- chi controlla un file diverso da quello che ha prodotto lo stato reale.
--
-- ⚠️ IL PERIMETRO È STRETTO E DICHIARATO: si riscrive **solo** se il testo
-- è ancora esattamente quello sbagliato. Se Alessio nel frattempo ha
-- rinominato una regola o riscritto una nota, non si tocca niente — non è
-- una data da ricordare né un flag, è il confronto col valore vecchio.
-- Stessa forma della sanatoria del 14/08 sui due tavoli.
--
-- Idempotente per costruzione: alla seconda esecuzione nessuna riga
-- corrisponde più al testo vecchio e l'aggiornamento non tocca nulla.
-- ---------------------------------------------------------------------

update regole_deducibilita
   set etichetta = 'Marketing / pubblicità'
 where etichetta = 'Marketing / pubblicita''';

update regole_deducibilita
   set nota = 'Interamente deducibile per una società, nessun plafond.'
 where nota = 'Interamente deducibile per una societa'', nessun plafond.';

update regole_deducibilita
   set nota = '75% deducibile. Dal 2025 il pagamento in contanti la rende indeducibile (esenti i biglietti di trasporto pubblico di linea e le indennità chilometriche entro i limiti).'
 where nota = '75% deducibile. Dal 2025 il pagamento in contanti la rende indeducibile (esenti i biglietti di trasporto pubblico di linea e le indennita'' chilometriche entro i limiti).';

update regole_deducibilita
   set nota = 'Spese di pubblicità deducibili.'
 where nota = 'Spese di pubblicita'' deducibili.';

update regole_deducibilita
   set nota = 'Contenitore per ciò che non si deduce. L''elenco dei casi ricorrenti è il quesito L9 per la commercialista: finché non risponde, ci finisce dentro solo ciò che decide Alessio, voce per voce.'
 where nota = 'Contenitore per cio'' che non si deduce. L''elenco dei casi ricorrenti e'' il quesito L9 per la commercialista: finche'' non risponde, ci finisce dentro solo cio'' che decide Alessio, voce per voce.';

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  n integer;
begin
  -- Nessuna regola deve più portare un apostrofo dove va un accento.
  select count(*) into n
    from regole_deducibilita
   where etichetta ~ '[a-z]''($|[ ,.])' or coalesce(nota, '') ~ '[a-z]''($|[ ,.])';
  if n <> 0 then
    raise exception 'Ci sono ancora % regole con un apostrofo al posto di un accento.', n;
  end if;

  -- ⚠️ E il trasloco resta fedele: le percentuali non le tocca nessuno.
  -- È il controllo che conta davvero — una migrazione che «sistema il
  -- testo» e intanto sposta un numero fiscale sarebbe molto peggio del
  -- difetto che corregge.
  if (select percentuale_deducibile from regole_deducibilita
       where etichetta = 'Trasferte (vitto/alloggio/trasporto)') <> 75 then
    raise exception 'La percentuale delle trasferte è cambiata: non doveva.';
  end if;
  if (select percentuale_deducibile from regole_deducibilita
       where etichetta = 'Indeducibile') <> 0 then
    raise exception 'La percentuale della regola «Indeducibile» è cambiata: non doveva.';
  end if;

  select count(*) into n from regole_deducibilita;
  if n <> 6 then
    raise exception 'Le regole sono % invece di 6: la correzione ne ha create o tolte.', n;
  end if;

  -- E nessuna è stata confermata da questa migrazione.
  select count(*) into n from regole_deducibilita where verificata_il is not null;
  if n <> 0 then
    raise exception 'Una regola risulta confermata dalla commercialista: non è mestiere di questa migrazione.';
  end if;

  raise notice 'Le regole si leggono: accenti a posto, percentuali intatte, sei regole.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260815000003', 'le_regole_si_leggono')
on conflict (version) do nothing;

select etichetta, percentuale_deducibile from regole_deducibilita order by ordine;
