# Quando la richiesta non parte proprio — la terza porta della stessa famiglia

**21/08/2026** · nato dall'**ottavo difetto**, provato da Alessio col metodo
giusto: Magazzino caricato, modalità aereo, poi «rileggi».

---

## 1 · Cosa ha funzionato, e va detto per primo

✅ **La schermata non tace.** Il riquadro «Cosa non è sceso dal magazzino»
resta con quello che aveva già letto, e un messaggio compare. **Non si
disegna serena su una lettura fallita**: il difetto di partenza del blocco A
è chiuso, e stavolta verificato da una mano e non da una prova.

## 2 · Cosa non ha funzionato

🔴 Il messaggio è **«Failed to send a request to the Edge Function»**: in
inglese, tecnico, in cima alla pagina, e **non dice quale dato manca**.

---

## 3 · La misura, com'è stata chiesta — provate tutte e quattro

Le chiamate alle funzioni online nell'app sono **quattro**, e hanno **tutte
la stessa identica forma**:

| chiamata | dove | cosa mostra quando fallisce |
|---|---|---|
| `operazioni-atomiche` (il corridoio) | `src/lib/operazioni.js:16` | frase nostra **se** c'è una risposta; inglese se la richiesta non parte |
| `schede-prodotto` | `src/lib/api/schedeProdotto.js:19` | idem |
| `assistente-archivio` | `src/lib/api/assistente.js:19` | idem |
| `documento-leggi` | `src/lib/api/assistente.js:51` | idem |

⚠️ **Tutte e quattro leggono già il corpo della risposta** e usano la frase
italiana che ci scriviamo noi (`errore.messaggio`). **Non sono scritte male.**

🔴 **Il ramo che manca è un altro, ed è quello che Alessio ha colpito:**
quando la rete è staccata la richiesta **non parte**, quindi non esiste
nessun corpo da leggere — `error.context` non c'è — e tutte e quattro
ricadono su `error.message`, che è il testo inglese della libreria.

**Quindi la risposta alla seconda domanda è: 4 su 4.** Non una che sbaglia
fra quattro che vanno bene — **il ramo «non sono nemmeno riuscito a
chiedere» non è previsto da nessuna delle quattro.**

### Quanto è largo

| | quante |
|---|---|
| funzioni dell'app che passano dal corridoio o da una funzione online | **146** |
| schermate che ne chiamano almeno una | **53** su 94 |
| punti che mettono `e.message` direttamente a schermo | **275** |

⚠️ **I 275 non sono tutti esposti** — la maggior parte riceve frasi italiane
scritte da noi. Il numero che conta è **53**: le schermate dove, con la rete
giù, oggi compare inglese.

---

## 4 · La proposta — sì, è la cura del blocco A estesa

**È la stessa cura, e va nello stesso posto.** Il blocco A ha messo il
riconoscimento delle letture nel **punto unico da cui passano le letture del
database** (`src/lib/supabase.js`), con `<DatoNonLetto>` accanto al dato.
Le funzioni online **non passano di lì**: hanno il loro punto unico, che sono
le quattro chiamate qui sopra.

Quindi:

1. **Un posto solo anche per loro** — una funzione che riceve l'errore di
   `functions.invoke` e decide fra tre casi:
   - c'è una frase nostra → si usa quella (**già funziona, non si tocca**);
   - la richiesta non è partita → *«Non sono riuscito a chiedere: controlla la
     connessione.»*, in italiano;
   - la richiesta è partita e non ha risposto → *«Il gestionale non ha
     risposto. Riprova.»*
2. ⚠️ **Il messaggio va dove sta il dato, non in cima alla pagina.** È la
   regola già scritta il 17/08 (*un rifiuto lontano dal gesto è un rifiuto che
   non c'è*) e la forma è già in casa: `<DatoNonLetto>`, col gesto per
   riprovare.
3. ⚠️ **E deve dire QUALE dato manca.** Oggi la frase non lo dice, ed è la
   metà del difetto: «Failed to send a request» non distingue *le schede
   prodotto non sono arrivate* da *il magazzino non si è caricato*.

---

## 5 · Perché è la terza volta

È la **terza porta della stessa famiglia**, e le tre insieme dicono qual era
il buco:

| | come si perdeva |
|---|---|
| blocco A (20/08) | i `.catch` che ingoiavano: la schermata si disegnava serena |
| difetto 2 (21/08) | gli `?.` su un dato obbligatorio: un buco invece di un errore |
| **difetto 8 (21/08)** | l'errore **arriva**, ma nella lingua della libreria e lontano dal dato |

⚠️ **La differenza fra le prime due e questa**: là il difetto era che *non si
sapeva*, qui che *si sa e non si capisce*. È un difetto più piccolo, e per
questo più facile da lasciare lì.

---

## 6 · Mi fermo qui

**Non ho scritto codice**, come chiesto. La cura tocca il punto da cui passano
tutte le scritture dell'app (il corridoio): non è una cosa da fare all'una di
notte in coda a una consegna.
