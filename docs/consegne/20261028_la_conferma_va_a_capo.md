# La conferma «Elimina» va a capo al telefono

Dalla **prima segnalazione di Alessio con «Segnala»** (28/10/2026, scheda di un impegno, iPhone).

## Il difetto

Premendo «Elimina» nella scheda di un impegno, la riga di conferma voleva
stare tutta accanto a «Salva modifiche»: la domanda «Elimino l'impegno
«…»?» si schiacciava in quattro righe, «Sì, elimina» veniva tagliato e
«Annulla» usciva dallo schermo.

## Cosa cambia

- `src/components/ConfermaDistruttiva.jsx` (usata da tutti i 23 «Elimina»
  con conferma): la riga va a capo quando non c'è posto. La domanda resta
  sopra, i due pulsanti vanno sotto **insieme** e senza spezzarsi.
  La distanza di 5 mm fra «Sì, elimina» e «Annulla» resta quella di prima.
- `src/pages/agenda/TaskForm.jsx`: la riga di «Salva modifiche» può andare
  a capo, così la conferma scende sotto il pulsante.

## Misurato

Schermata finta della scheda (prove visive, nessun database), con «Elimina»
premuto:

| Larghezza | Pagina più larga dello schermo? | Domanda | Pulsanti |
| --- | --- | --- | --- |
| 390 px | no (390 = 390) | una riga, sotto «Salva modifiche» | sotto la domanda, interi (40–122 e 141–199 px) |
| 320 px, testo a 22 px | no (320 = 320) | sotto «Salva modifiche» | sotto la domanda, interi (55–146 e 165–229 px) |

Prove di schermata: 464 su 464. Prove pure: le solite 3 che falliscono solo
su Windows per gli a capo (bozze-col-lordo, indirizzo-funzioni-vault).

Revisione `ecc:react-reviewer`: nessun problema bloccante.

## Resta

- In `fiscale/AndamentoMensile.jsx` la conferma sta in una cella allineata a
  destra: se va a capo, si allinea a sinistra. Solo estetica, ed è meglio
  dello sforamento di prima; lasciato.
- Non provato su un iPhone vero: si guarda su Prova.

## Cosa abbiamo rovesciato

Niente.
