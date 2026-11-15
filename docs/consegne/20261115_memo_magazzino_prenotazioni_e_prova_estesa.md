# MEMO come le pagine: magazzino, prenotazioni, banca e la prova estesa (15/11/2026)

## Cosa cambia
- **Migrazione `20261115000016`**:
  - **Magazzino**: «sotto soglia» vale solo per i prodotti tenuti in magazzino (come `sottoScorta` della pagina: era il «55 contro 54»).
  - **Prenotazioni**: conteggio = prenotazioni valide (confermate o in attesa), totale = i loro coperti (come la pagina: «escluse rifiutate/annullate»); le valide vengono per prime.
  - **Banca**: nessun cambio di funzione; la verifica della migrazione prova il caso (un da abbinare, un abbinato, un ignorato) dentro una transazione annullata, perché i movimenti di banca si caricano solo da file e non si cancellano dal client.
- **Prova `tests/app/memo-come-la-pagina.test.js`** (nei Controlli): ora copre anche **cassa** (Borgo 58 e la tasca non si mescolano: conteggio e totale per soggetto) e **HACCP** (una non conformità aperta e vecchia viene prima di più di 50 temperature recenti, senza totale), oltre a piano e fatture fornitori.
- **`memo-chat`**: le descrizioni di magazzino e prenotazioni dicono che cosa contano.

## Ancora da coprire (prova «MEMO = pagina»)
Agenda (un impegno completato non deve comparire), costo piatti (ricetta ritirata), documenti (senza importo), fatture clienti (bozza, scartata, inviata). Oggi sono vuote su work o coincidono già con la pagina.

## Su work
Migrazione `20261115000016` e funzione `memo-chat`. Copia prima.
