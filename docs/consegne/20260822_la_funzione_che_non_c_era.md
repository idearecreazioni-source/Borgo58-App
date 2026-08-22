# La funzione che non c'era, raccontata come un guasto di rete

**Blocco 1 del mandato del 22/08** (reperto di Alessio dal collaudo).
**Nessuna migrazione.** Solo client.

---

## 1 · Le misure chieste

### a) Quali funzioni online ci sono sui due progetti

| | prova | produzione |
|---|---|---|
| `operazioni-atomiche` | ✅ v19 | ✅ v33 |
| `email-cliente` | ✅ v1 | ✅ v4 |
| `schede-prodotto` | ❌ | ✅ v2 |
| `assistente-archivio` | ❌ | ✅ v1 |
| `documento-leggi` | ❌ | ✅ v3 |
| `posta-leggi` | ❌ | ✅ v16 |
| `posta-in-arrivo` | ❌ | ✅ v5 |
| `notify-telegram-reservation` | ❌ | ✅ v11 |
| `prova-ai` | ❌ | ✅ v4 |

**Sulla prova ce ne sono 2 su 9.**

### b) Le chiavi

Sul progetto di prova ci sono **solo i sette segreti che Supabase si mette da
sé**. Nessuna delle nostre: manca `ANTHROPIC_API_KEY`, manca
`RESEND_API_KEY`, mancano le due di Telegram, manca `NOTIFICHE_FIRMA`. In
produzione ci sono tutte e sei.

⚠️ **Ne discende un'incoerenza già lì**: `email-cliente` **è installata sulla
prova senza la chiave di Resend**. Oggi non morde perché nessuno confermerà
una prenotazione finta da lì, ma è una funzione installata che non può
riuscire.

---

## 2 · 🔴 Perché il messaggio diceva la causa sbagliata

**E non era il discriminante scritto male.** Misurato nel browser vero, non
dedotto:

| | cosa succede al `fetch` |
|---|---|
| funzione **installata** | risposta HTTP regolare — anche un 401 è una risposta |
| funzione **non installata** | `TypeError: Failed to fetch` |
| **rete staccata** | `TypeError: Failed to fetch` |

Gli ultimi due sono **lo stesso identico errore**. Quando una funzione non
esiste il gateway risponde **404 senza le intestazioni CORS**, il browser
blocca la risposta e non dice perché.

⚠️ **Ed è voluto dai browser**: se dicessero la differenza, una pagina
qualunque potrebbe scandagliare la rete di chi la guarda. **Quell'informazione
lato client non esiste.**

🔴 **E DA NODE IL DIFETTO NON SI VEDE.** Chiamata dallo stesso codice fuori dal
browser, `schede-prodotto` risponde `FunctionsHttpError` con HTTP 404 e la
frase esce giusta. Una prova automatica di questo progetto **non avrebbe mai
potuto trovarlo**: il CORS esiste solo dove c'è una pagina.

## La cura: non si legge, si misura

Se il gestionale **in questo istante** sta parlando col database, la rete c'è
— e allora il guasto è di quel servizio.

- `reteViva()` chiede al database il conto delle righe di una tabella,
  **senza portarsene indietro nessuna**;
- ⚠️ **qualunque risposta vale come sì, anche un rifiuto**: se il database
  dice «non hai il permesso», quella frase ha attraversato Internet per
  arrivare fin qui. L'unica cosa che dimostra il contrario è un `fetch` che
  non parte;
- ⚠️ **la sonda si fa solo dentro un guasto già in corso**: il caso normale
  non paga nessun giro di rete in più;
- ⚠️ **e ha tre risposte, non due**: `null` vuol dire «non l'ho misurato», e
  lì si resta sulla frase prudente. Trasformare «non lo so» in «la rete c'è»
  sarebbe la stessa forma dello zero al posto del vuoto.

Le tre frasi adesso:

| caso | frase |
|---|---|
| rete staccata | *«…sembra che manchi la connessione. Riprova appena torna.»* |
| **servizio assente** | *«…questa parte del gestionale non e' installata qui. La connessione c'e' — l'ho appena controllata.»* |
| ha risposto male | la frase scritta dalla funzione, intatta |

## E lo schema stava in quattro copie

Lo stesso identico `try/catch` era ricopiato in **quattro** punti (il
corridoio, le schede prodotto, le due dell'assistente). Ora è
`chiamaFunzione()`.

⚠️ **Non è una pulizia**: questa correzione andava fatta quattro volte, cioè
**poteva fermarsi a tre**.

---

## 3 · ⚠️ L'assistente sul gestionale di prova non può funzionare, e non è un guasto

**No, e installare le funzioni non basterebbe.** Manca la chiave AI, che è
**una sola** e vive sull'account con **tetto di 10 $/mese**: metterla anche
sulla prova vorrebbe dire far pagare i giri di collaudo sullo stesso tetto
che protegge la spesa vera.

**È una decisione di Alessio, non una cosa da fare in silenzio.** Le tre
strade, per quando vorrà sceglierne una:

1. **si lascia com'è** — sulla prova l'assistente non c'è, e adesso il
   pulsante lo dice invece di mandare a cercare una connessione che c'è;
2. **si installano funzioni e chiave anche sulla prova** — l'assistente
   funziona lì, e ogni giro di collaudo consuma il tetto vero;
3. **si installano le funzioni senza la chiave** — peggio di tutte: il
   pulsante fallirebbe dopo aver chiamato, con un messaggio meno chiaro di
   quello di adesso.

⚠️ **Il pulsante non è stato spento e non ha un avviso fisso sopra**: la
regola del 18/08 è che una spiegazione a schermo si legge una volta e poi
diventa arredamento. La frase compare **nel gesto**, che è dove sta il
dubbio.

---

## 4 · Cosa è stato rotto apposta

| rottura | esito |
|---|---|
| sostituito `fetch` con uno che fallisce sempre (telefono in modalità aereo finto) | ✅ la frase **torna** a parlare di connessione |
| chiamato il corridoio, che **è** installato | ✅ non dice mai «non è installata», e la frase vera (*«Operazione non ammessa»*) arriva intatta |
| `reteViva` a `null` nella prova pura | ✅ resta la frase prudente |

⚠️ **La seconda è quella che conta di più**: un messaggio nuovo che comparisse
anche a servizio presente sarebbe un allarme che grida sempre, cioè un
allarme che si impara a spegnere.

---

## ⚠️ Cosa NON è verificato

1. ⚠️ **Alessio non ha ripremuto il pulsante**: la frase nuova è stata letta
   nella pagina viva sul progetto di prova, da qui.
2. ⚠️ **La rete non è stata staccata davvero**: il caso è provato
   sostituendo `fetch`, non spegnendo il WiFi.
3. ⚠️ **Nessuna prova automatica copre il caso vero.** Le prove di questo
   progetto girano fuori dal browser, dove il CORS non esiste e il difetto
   **non si riproduce**. Quello che è provato è la *regola*
   (`erroriDiRete.test.js`, 6 casi nuovi); che il browser si comporti così è
   una misura, non una rete.
4. ⚠️ **`email-cliente` sulla prova resta installata senza la sua chiave.**
   Non toccata: spegnerla o completarla è una decisione.

---

## Cosa abbiamo rovesciato

**Niente di deciso, ma una cosa scritta va corretta.** Il commento in cima a
`erroriDiRete.js` diceva *«le tre cose che possono andare storte, e sono
davvero tre»*. Erano quattro, e la quarta non si vedeva perché **si presenta
travestita da prima**.

⚠️ La ragione di allora **vale ancora intera**: quel file nacque per il
telefono in modalità aereo, e per quel caso era giusto. È la famiglia delle
frasi diventate false — *una frase giusta per un caso, usata per tutti* — e
questa volta la frase non è invecchiata: è nata già coprendo un caso in più
di quelli che sapeva distinguere.
