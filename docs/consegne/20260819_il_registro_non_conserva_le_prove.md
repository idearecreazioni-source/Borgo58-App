# Il registro delle cancellazioni non conserva le prove

**Migrazione**: `20260819000010_il_registro_non_conserva_le_prove.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Non è un blocco chiesto da nessuno**: è un residuo trovato applicando le
otto migrazioni del 19/08 in produzione, e corretto subito.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non è in produzione**: le cinque righe finte sono ancora là dentro
   finché Alessio non pusha e la migrazione non viene applicata.
2. ⚠️ **La firma riconosciuta è quella di quelle tre verifiche** («Spesa:
   VERIFICA…»). Una verifica futura che si firmasse diversamente e non
   ripulisse le proprie lapidi non verrebbe presa dalla pulizia — ma
   **verrebbe presa dalla prova**, che cerca la parola in tutta la riga.
3. ⚠️ **Sul progetto di prova il registro resta pieno di righe delle prove
   automatiche** (marcate `TEST-AUTO` e `__PROVA__`): è un database
   usa-e-getta e non è un problema, ma vuol dire che il numero delle lapidi
   là dentro non dice niente. La proprietà controllata è un'altra.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 Il difetto, trovato applicando

Applicate le otto migrazioni in produzione, le lapidi in `deleted_records`
sono passate da **26 a 31**. Cinque righe finte, lasciate dalle verifiche di
`20260819000003`, `…004` e `…005`: quelle verifiche cancellano da sé i
movimenti di prova che si erano costruite, e cancellandoli fanno scattare il
trigger che ne conserva una copia nel registro.

⚠️ **Non è un fastidio d'ordine.** `deleted_records` è un registro
**esibibile** — conserva una copia integrale di ogni riga cancellata dalle
tabelle di soldi, fisco, lavoro e documenti — e **nessuno lo può ripulire
dall'app**, giustamente. Righe finte lì dentro sono dati di prova in mezzo ai
dati veri, cioè la regola di Alessio del 12/08: *da quando entra roba vera,
una riga finta indistinguibile da una vera toglie fiducia a tutto quello che
il gestionale dice.*

⚠️ **E rompe un guardiano.** Dal 16/08 le migrazioni si difendono con una
proprietà: *«le lapidi prima e dopo devono essere le stesse»*. Il 17/08 quel
guardiano ha funzionato. Se il registro cresce a ogni applicazione, quella
proprietà smette di poter essere affermata da chiunque.

**Il perimetro è stretto e dichiarato**: si tolgono solo le lapidi di
`cash_movements` la cui causale d'uso comincia con «Spesa: VERIFICA», che è
la firma che quelle tre verifiche si sono date. La migrazione **controlla
prima di cancellare** che quella firma non compaia su nessun'altra tabella:
se si fosse allargata da sola, non tocca niente.

---

## 🔴 E la prova che doveva sorvegliarlo era cieca

Perché non ricapiti, il controllo diventa una prova automatica. La prima
stesura leggeva **tutte** le lapidi dal client e cercava la parola fra
quelle — ed è stata messa alla rottura, come da regola: una lapide finta
inserita apposta sul progetto di prova.

**Non è diventata rossa.**

Misurato invece che archiviato: **PostgREST restituisce al massimo mille
righe**, e sul progetto di prova le lapidi sono ben oltre. Il controllo
guardava una parte del registro **credendo di guardarlo tutto**.

⚠️ È la famiglia dell'avvertenza dell'08/08 sui `.limit()` nelle liste HACCP
e di prima nota — *un documento che sembra completo senza esserlo* — con
un'aggravante: lì il limite lo scriviamo noi e si vede nel codice, qui è il
**predefinito del gateway** e non si vede leggendo.

**La cura**: la domanda si fa al database, che le righe le ha tutte.
`lapidi_di_prova()` è la stessa espressione che usa la pulizia — un posto
solo — ed è la funzione che la prova interroga. Rimessa davanti la lapide
finta, adesso **diventa rossa**; tolta, torna verde.

---

## Per Alessio, in una riga

Il registro che conserva le righe cancellate si era portato dentro cinque
righe finte delle verifiche: tolte, e adesso c'è un controllo che se ne
accorge da solo.

---

**Commit del lavoro**: `d202a51` — «Il registro delle cancellazioni non
conserva le prove».
**Working tree**: pulito al momento del commit del lavoro.
**Migrazione**: `20260819000010` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
