# La prova del modulo pubblico salta i giorni chiusi — 12/09/2026

**Solo prove.** Codice dell'app: non toccato. **Migrazioni**: nessuna.
**Funzioni online**: nessuna. **HEAD dichiarato**: vedi l'ultima riga.
Autorizzazione di Alessio del 12/09: il controllo su GitHub usa il progetto di
prova come sempre; nessuna modifica a produzione.

---

## Il difetto

Dal 12/09 il controllo «Prove contro il progetto di prova» è rosso su ogni PR
(#67, #68, #69, #71; su #70 è stato annullato dalla coda), sempre sulla stessa
prova: `tests/app/prenotazione-pubblica.test.js` → «invia la richiesta anche
con il gestionale aperto e loggato», `P0001`.

- Sul progetto di prova le prenotazioni online sono **spente**
  (`service_settings.prenotazioni_online_attive = false`), e c'è una chiusura
  il **13/09** («BASE-Evento privato a locale chiuso», creata il 23/08).
  Letto in sola lettura, con la sessione verificata a `transaction_read_only =
  on`.
- Con l'interruttore spento, la scelta del giorno della prova rispondeva
  **sempre «domani alle 20:00»**. Il 12/09 domani è il 13/09.
- `submit_public_reservation` rifiuta un giorno chiuso **prima** di guardare
  l'interruttore: «Quel giorno siamo chiusi» (migrazione `20260829000010`,
  righe 49-50).

Una prova che dipende dalla data, non un difetto del gestionale.

## Cosa cambia

- `tests/app/momentoPrenotabile.js` (nuovo): la scelta del giorno, **pura**.
  Salta i giorni per cui `public_reservation_options` risponde `chiuso: true`,
  cioè chiuso, di riposo o al completo; la funzione lo dice anche a
  interruttore spento (stessa migrazione). Riceve chi legge le opzioni.
- `tests/app/prenotazione-pubblica.test.js`: `quandoSiPuoPrenotare` usa quella
  funzione con la lettura vera (`getReservationOptions`). Il resto della prova
  non cambia.
- `tests/unita/momento-prenotabile.test.js` (nuovo): 4 casi senza database.

## Come è stato verificato

- La prova nuova: **4/4**.
- **Rossa con la regola di prima**, cioè togliendo il salto dei giorni chiusi:
  **3 casi su 4 rossi**, e il primo risponde `2026-09-13` invece di
  `2026-09-14`. Poi rimessa.
- `npm run lint` pulito. Prove pure **1299/1301**: le due rosse sono i fine riga
  di Windows, rosse anche su master.
- La prova contro il database **non è stata lanciata da qui**: la lancia il
  controllo su GitHub di questa PR, come autorizzato.
- `git merge-tree` con i rami di #57–#71: nessun conflitto.

## Cosa NON è verificato

- Che il controllo su GitHub torni verde: lo dirà la sua esecuzione.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `ef9b2e4` sul ramo
`prova-prenotazione-giorno-chiuso`, cioè il commit immediatamente sotto questo
documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
