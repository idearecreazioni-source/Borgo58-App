# Consegna del 18/08/2026 — giro A: la sala non si perde più

**Commit della consegna**: quello di questo riepilogo. Working tree pulito
prima di scriverlo. **Nessuna migrazione**: è tutto in
`scripts/prova-ricostruisci.mjs`. `docs/CONTRATTO.md` **non toccato**.

Primo dei cinque giri del [mandato sala](../mandati/20260818_la_sala_e_le_prenotazioni.md).

---

## 1. Da dove nasce: una misura che ha cambiato la diagnosi

Alessio ha trovato la sala nella disposizione di base invece che in quella
salvata come «di sempre». La domanda del mandato era: *`prova:scenario` la
sovrascrive?*

**Misurato: no.** `prova-base.mjs` **legge** `dining_tables` e non ci scrive
mai. 🔴 **La causa ero io**: il 17/08 ho eseguito `prova:ricostruisci --azzera`
per riparare due funzioni rotte, e quel comando svuota il progetto e riapplica
le migrazioni — le sagome tornano alle posizioni del 04/08.

⚠️ **La trappola vera, emersa perché il mandato chiedeva una misura e non una
correzione**: dal 14/08 «questa diventa la base» scrive la disposizione
**dentro `dining_tables`**. Quindi la sala «di sempre» **non è un dato di una
migrazione: è un dato di Alessio**, e `--azzera` la buttava via in silenzio.

*Due lavori diversi: «lo scenario sovrascrive» sarebbe stato correggere uno
script; «un comando distruttivo butta via un dato dell'utente senza nominarlo»
è un'altra cosa.*

---

## 2. Cosa fa adesso il comando

**`--azzera` dice cosa sta per sparire**, prima di svuotare, e nomina ciò che
non torna da nessuna delle due ricostruzioni (migrazioni + `prova:base`):

- **la sala**: quante sagome, e la disposizione «di sempre» che ha addosso —
  con la nota che da oggi si riprende dalla produzione, *ma solo se
  `DB_URL_PRODUZIONE` è configurata*;
- **gli scostamenti di giornata: quanti e di che date.** ⚠️ **Nominare, non
  resuscitare** (rilievo del validatore): non si ripristinano, perché sono la
  disposizione di *un giorno* — rimetterli riporterebbe in vita una sala che
  quel giorno non esiste più, e un `--azzera` che li ripristina
  contraddirebbe sulla stessa riga la distinzione che questo giro è nato per
  scrivere;
- **tutto ciò che qualcuno ha creato a mano** e non è marcato `BASE-`.

⚠️ *Elencare i prerequisiti e tacere le perdite è la stessa forma dello scarto
silenzioso: un comando che dice quello che gli serve e non quello che costa.*

**La sala si riprende dalla produzione**, in **sola lettura**, con la guardia
di `prova:stato`: se quella stringa non punta al progetto del locale non la si
legge — *meglio una sala vecchia che una presa da un database sconosciuto*. E
si **conta** quello che si è mosso (regola del 16/08): «sagome riprese dalla
produzione: 13».

⚠️ **Solo `dining_tables`, mai `disposizioni_giornaliere`.**

⚠️ **E l'aggiornamento va per NOME** (`where label = …`), non per
identificativo: vedi §4.

---

## 3. La verifica che rende il passo dimostrabile

**Rilievo del validatore, e aveva ragione**: «13 sagome, 13 sagome, zero righe
diverse» misurato a mano **non è una prova discriminante**. Zero è anche il
risultato di un confronto che legge due volte lo stesso database, o che guarda
prima di aver ricostruito. E *«senza il ripristino sarebbero state le posizioni
della migrazione»* è un **ragionamento, non una misura**.

Ora c'è una verifica **separata dal passo che ripristina** — ed è tutta la
differenza: confronta la sala del progetto di prova con quella vera riga per
riga e **ferma il comando** se divergono. Togliendo il ripristino, il confronto
trova le posizioni della migrazione e il comando si ferma.

**Provata nei due versi**, e senza ricostruire (costa secondi invece di venti
minuti):

| stato | righe diverse |
|---|---|
| ripristino attivo | **0** |
| una sagoma spostata a mano, come se il ripristino mancasse | **1** |
| rimessa dalla produzione | **0** |

⚠️ E il rilievo sul mio contatore era fondato: avevo letto `true`/`false` come
`t`/`f` e il conteggio delle ruotate diceva zero mentre le righe combaciavano.
**Su un campo il confronto ha sbagliato a leggere.** Per questo la verifica
confronta **la riga intera come stringa** — etichetta, x, y, rotazione, zona —
invece di interpretare campo per campo: non c'è niente da leggere male.

---

## 4. 🔴 Un difetto mio, dentro una rete appena costruita

Prima di collaudare avevo fotografato i 4 scostamenti del progetto di prova.
La fotografia conservava `dining_table_id` — ma **la ricostruzione ricrea le
sagome con identificativi nuovi**, e al momento di rimetterli la chiave
esterna li ha respinti tutti.

> **Una fotografia che conserva un identificativo non sopravvive a una
> ricostruzione: deve conservare il NOME.**

È esattamente ciò che fa il ripristino della sala (`where label = …`), che
infatti ha funzionato. La lezione è scritta al posto della fotografia, insieme
alla query giusta.

**I quattro scostamenti sono persi.** Erano sul progetto di *prova*, li aveva
fatti Alessio durante la serata recitata, e si rifanno trascinando i tavoli:
il costo è di secondi. La forma dell'errore, in produzione, avrebbe un prezzo
diverso.

### E la domanda del validatore: è l'unico posto?

**Cercato: sì.**

| dove | verdetto |
|---|---|
| `prova-base.mjs` | usa gli identificativi **solo dentro la stessa esecuzione** (crea, poi riferisce): non attraversano nessuna ricostruzione |
| `backup.mjs` / `prova-ripristina.mjs` | passano da `pg_dump`/`psql`, che portano gli identificativi **in un database vuoto**: è il caso legittimo, e infatti la prova di ripristino del 10/08 confrontava riga per riga |
| la mia fotografia usa-e-getta | **l'unico caso** del difetto |

---

## 5. Cosa NON è verificato

- **Nessuna mano vera ha eseguito il comando dopo l'ultima modifica**: l'ho
  eseguito io per intero una volta (13 sagome riprese, 0 differenze), e la
  guardia del §3 l'ho provata **dopo**, nei due versi, senza rifare il giro
  completo. Il messaggio di `--azzera` con le date degli scostamenti non è
  mai comparso a schermo: dopo la ricostruzione gli scostamenti sono zero.
- **La guardia non è mai scattata per davvero** in una ricostruzione:
  l'ho vista scattare solo sulla perturbazione simulata.
- **Nessuna prova automatica copre il comando**: non gira nella suite, e
  farcelo girare vorrebbe dire ricostruire il database a ogni `npm test`.
- **`DB_URL_PRODUZIONE` mancante o sbagliata**: i due rami sono scritti ma non
  esercitati — non ho tolto la configurazione per provarli.

## 6. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **129**, invariate |
| Progetto di prova | ricostruito da zero, 129 migrazioni, scenario rimesso |
| Sala sul progetto di prova | **identica alla produzione**, 13 sagome, 0 righe diverse |
| Scostamenti di giornata | **0** (i 4 di Alessio sono persi, vedi §4) |
| Prove automatiche | 49 pure + 144 sul progetto di prova, verdi |
| Prossimo | **giro B**: i coperti dentro il tavolo, poi «c'è posto a quell'ora?» |
