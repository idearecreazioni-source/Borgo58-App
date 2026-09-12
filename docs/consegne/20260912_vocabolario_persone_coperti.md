# Vocabolario, riga 2: «persone», «coperti», mai «ospiti» — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## La regola

- **«persone»** è quello che dice il cliente: una prenotazione, il modulo
  pubblico, un preventivo.
- **«coperti»** è quello che conta la sala o il conto: il totale della
  serata, la pianta, le comande, la cassa, la Proiezione.
- **Mai «ospiti».**

## Cosa cambia — nove frasi in sette file

| File | Prima | Adesso |
|---|---|---|
| `calendario/ReservationForm.jsx:603` | «Calcola per N **ospiti**» | «… N **persone**» |
| `calendario/ReservationForm.jsx:617` | «scalate sul numero di **ospiti**» | «… di **persone**» |
| `calendario/ReservationsList.jsx:142` (una prenotazione) | «N coperti» | «N persone» («1 persona») |
| `lib/calcoli/prenotazioni.js` (la colonna dell'elenco) | «Coperti» | «Persone» |
| `calendario/ClienteDetail.jsx:406` (storico del cliente) | «N coperti» | «N persone» («1 persona») |
| `calendario/PiantaGiornata.jsx:1106` (totale della serata) | «N persone» | «N coperti» |
| `lib/constants.js:116` (Proiezione, forma di una linea) | «a coperto (persone × scontrino)» | «a coperto (coperti × scontrino)» |
| `calendario/SalaEOrari.jsx:150-151` | «Quante persone entrano lo decidi tu» | «Quanti coperti entrano lo decidi tu» |

Restano come sono, e il perché:
- **il totale della serata nell'elenco prenotazioni** («N coperti», riga
  180): conta la sala;
- **«Persone» nella chiusura alla romana** (`CloseOrderModal`): sono le
  persone che pagano, non i coperti — un bambino è un coperto e non paga;
- **«N. persone» in una spesa di rappresentanza** (Deduzioni): è
  un'annotazione fiscale, non sala né cliente;
- le chiavi e i nomi tecnici (`chiave: "coperti"`, `party_size`).

## ⚠️ Rimandato: l'etichetta del modulo della prenotazione

`ReservationForm.jsx:457` dice ancora «**Coperti**» sopra il numero della
prenotazione, che per la regola è «Persone». La #57 riscrive le righe
450-463 di quel file, e cambiarla adesso crea un conflitto (misurato con
`git merge-tree`). Il mandato dice di non forzare: **va cambiata dopo
l'unione della #57**. Fino ad allora quella scheda ha «Coperti» sull'etichetta
e «persone» sul pulsante del fabbisogno.

## Come è stato verificato

- Sostituzioni contate: ogni frase trovata esattamente una volta. Dopo,
  «ospiti» compare in `src` solo in un commento (`PreventivoDetail.jsx:726`).
- `oxlint` pulito sui sette file. Prove pure **1295/1297**: le due rosse
  sono i fine riga di Windows, rosse anche su master. Nessuna prova in
  `tests/` cita queste etichette.
- `git merge-tree` con i rami di #57–#76 e con i rami del vocabolario non
  ancora pubblicati: nessun conflitto dopo aver tolto l'etichetta della riga
  457. `ReservationForm.jsx` lo toccano anche la #57 e la #62, e
  `SalaEOrari.jsx` la #57, in altre righe.

## Cosa NON è verificato

- Non misurato a schermo: solo testo, di lunghezza simile.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `8d91092` sul ramo `vocabolario-persone-coperti`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
