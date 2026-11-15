# MEMO sa che giorno è (15/11/2026)

## Perché
Alessio ha chiesto alla chat «che impegni ho domani?» e MEMO ha risposto che non poteva dirlo «senza sapere la data di oggi». Vero: il modello non riceveva mai la data. In più la risposta aveva due difetti:
- la riga «Dove l'ho letto» compariva due volte (una scritta dal modello, una dal server);
- «Controllalo: alcuni numeri non arrivano dai dati letti» era un falso allarme: la guardia leggeva le date scritte come 30/08/2026 come numeri inventati.

## Cosa cambia (solo la funzione `memo-chat` e la guardia dei numeri)
- A ogni richiesta il modello riceve **oggi e domani a Roma** (giorno della settimana, data per esteso e AAAA-MM-GG, ora), con l'istruzione di calcolare «domani», «questa settimana» da quella data.
- La riga «Dove l'ho letto» scritta dal modello si toglie: resta solo quella del server.
- La guardia dei numeri ignora le date gg/mm/aaaa e le ore e accetta i numeri della data di oggi.

## Come si è provato
Prove unitarie nuove per la guardia. Su Prova, stessa domanda: ora risponde «domani, lunedì 16 novembre 2026», nessun doppione. Resta un «Controllalo» legittimo quando il modello conta a mente («34 impegni»).

## Su work
Solo la funzione `memo-chat`. Nessuna migrazione.

## Seconda correzione dello stesso pacchetto: «Non riesco a leggere i dati» (15/11 sera)
Alessio ha chiesto sul telefono «Quanto ho speso finora sul piano per le attrezzature della cucina?» e la chat si è fermata con «Non riesco a leggere i dati in questo momento. [P1]–[P17] (17 righe)», due volte.

**Causa (riprodotta su Prova con 17 sottovoci)**: per sommare lo speso delle 17 sottovoci di «Attrezzature cucina» il modello usa lo strumento di calcolo, che accettava al massimo 12 numeri; con 17 sollevava un errore, e l'errore buttava via tutta la risposta (e non lasciava traccia: la funzione inghiottiva ogni errore). Su Prova non era mai comparso perché lì lo speso è zero e il modello non calcola.

**Correzione**: il calcolo accetta fino a 500 numeri; un errore di uno strumento torna al modello come errore (`is_error`) invece di far fallire la risposta; ogni errore resta nei registri della funzione (`console.error`) e nel registro del messaggio (`strumenti`). Provato su Prova con la stessa situazione: ora risponde (somma 1.853 € corretta).
