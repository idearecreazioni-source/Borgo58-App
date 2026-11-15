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
