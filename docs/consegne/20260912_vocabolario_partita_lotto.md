# Vocabolario, riga 1: «partita» e «lotto» — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## La regola

- **«partita»** è quello che hai in magazzino.
- **«lotto»** è il numero di lotto del fornitore (la parola della
  rintracciabilità HACCP).

## Cosa cambia

Le occorrenze a schermo di «lotto/lotti» (ricerca `\<(lott[oi])\>` sul codice
di master, poi lette una per una) sono tutte numeri di lotto **tranne una**:

| File | Prima | Adesso |
|---|---|---|
| `src/pages/magazzino/Produzioni.jsx:552` | «registrata prima che il gestionale contasse i **lotti** senza prezzo» | «… contasse le **partite** senza prezzo» |

Restano come sono, perché sono numeri di lotto:
- «N° lotto» in Posta in arrivo;
- «Tracciabilità lotti», «N. lotto» e «Nessun lotto registrato» in HACCP;
- «lotto X» nelle Scadenze (è `lotto_fornitore`);
- il lotto della raccolta propria.

Non si toccano i commenti nel codice, i nomi tecnici né i dati.

## Come è stato verificato

- `oxlint` sul file: pulito.
- `git merge-tree` con i rami di #57–#72: nessun conflitto.
- Nessuna prova sulle schermate cita la frase cambiata (ricerca in `tests/`).

## Cosa NON è verificato

- La riga compare solo su una produzione registrata prima del 30/08, con
  costo senza stato: non l'ho aperta a schermo.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `656aa5c` sul ramo `vocabolario-partita-lotto`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
