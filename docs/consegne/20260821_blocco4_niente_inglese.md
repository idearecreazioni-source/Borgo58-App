# Blocco 4 — niente inglese quando cade la rete

**21/08/2026** · **nessuna migrazione**. Tocca il corridoio da cui passano
tutte le scritture, e per questo è stato fatto a passi piccoli.

---

## 1 · Riprodotto, non dedotto

**Fatta cadere la rete** verso le sole funzioni online, lasciando vivo tutto
il resto — che è il caso di Alessio in modalità aereo. Poi il gesto: tocco
T5, premo «Apri 2 tavoli insieme».

**Quello che compariva, misurato:**

```
Failed to send a request to the Edge Function
```

| | |
|---|---|
| a che altezza | **151 punti** |
| dov'era il pulsante premuto | **1707 punti** |
| **distanza** | **1556 punti**, su uno schermo alto **1024** |

🔴 **Il messaggio e il gesto non stavano nella stessa schermata.** Si premeva,
non succedeva niente, e la spiegazione era fuori dallo schermo — in inglese.

---

## 2 · La cura, e perché le quattro chiamate non erano scritte male

Tutte e quattro leggono già la frase italiana che ci scriviamo noi nel corpo
della risposta. **Il ramo che mancava è un altro**: quando la rete è staccata
la richiesta *non parte*, quindi non esiste nessun corpo, e tutte e quattro
ricadono sul messaggio della libreria.

La regola sta in **`src/lib/calcoli/erroriDiRete.js`**, un posto solo, con
**10 prove**. Tre casi:

| caso | cosa si legge |
|---|---|
| il server ha risposto con una frase nostra | **quella**, intatta — è scritta per chi sta in sala |
| la richiesta non è partita | *«Non sono riuscito ad aprire il conto: sembra che manchi la connessione. Riprova appena torna.»* |
| ha risposto senza una frase nostra | il gesto in italiano, e l'originale fra parentesi |

⚠️ **E DICE QUALE GESTO**, che era metà del difetto: «Failed to send a
request» non distingue un conto che non si apre da un documento che non si
legge. Il corridoio traduce il nome dell'operazione in italiano
(`IN_ITALIANO` in `operazioni.js`); ⚠️ **chi non è in elenco non resta muto** —
si usa il nome tecnico, che è brutto ma vero. *Un elenco che invecchia non
deve far sparire l'informazione.*

---

## 3 · 🔴 IL PRIMO DISCRIMINANTE ERA SBAGLIATO, e l'ha trovato l'occhio

Avevo scritto: *«se c'è `context`, il server ha risposto»*. Sembrava ovvio.

**Guardando la schermata dopo la correzione**, la frase era:

```
Non sono riuscito a aprire il conto. (Failed to send a request to the Edge Function)
```

Cioè **metà cura**: il gesto in italiano, e l'inglese appiccicato dietro.

**Misurato il perché**: la libreria avvolge anche il fallimento della rete e
gli allega comunque un `context`. Il discriminante buono è **come si chiama
il guasto e cosa dice** (`FunctionsFetchError`, «failed to send / to fetch»),
non cosa la libreria gli ha allegato.

> ⚠️ **Rileggendo il codice non l'avrei mai visto**: il ragionamento era
> coerente con sé stesso, e sbagliato su un fatto della libreria. **L'ha
> trovato la frase vera a schermo.** È la stessa forma della prova che non
> discrimina, spostata su un'ipotesi mia.

⚠️ **E la stessa lettura ha trovato un secondo difetto più piccolo**: «a
aprire» invece di «ad aprire». Nessuna prova l'avrebbe segnalato, e si legge
male.

**Le due cose hanno la loro prova**, costruita sull'errore **come arriva
davvero** (con `name` e `context` insieme): rimettendo il discriminante
vecchio, diventa rossa.

---

## 4 · Il messaggio è andato dove sta il dito

Non spostato: **copiato** accanto alla barra dei tavoli. Quello in cima resta,
perché gli altri gesti della schermata sono lì.

✅ **Misurato dopo**: distanza dal pulsante **da 1556 punti a 92**. Ora si
vedono insieme.

⚠️ **`<DatoNonLetto>` non è stato usato, ed è una scelta**: quel componente
dice *«questo dato non l'ho letto»* e ha il gesto per riprovare. Qui non è un
dato che manca — è **un'azione che non è riuscita**, e il gesto per riprovare
è il pulsante stesso, che è già lì. Usarlo avrebbe detto la cosa sbagliata.

---

## 5 · Cosa ho guardato

| cosa | prima | dopo |
|---|---|---|
| la frase | *«Failed to send a request to the Edge Function»* | *«Non sono riuscito ad aprire il conto: sembra che manchi la connessione. Riprova appena torna.»* |
| resta inglese? | — | **no** |
| distanza dal pulsante | 1556 punti | **92** |

**E il progetto di prova è pulito**: 0 conti aperti.

---

## 6 · Cosa non è verificato

- ⚠️ **Ho provato una delle quattro chiamate** — il corridoio, che è quella da
  cui passano tutte le scritture. Le altre tre (schede prodotto, assistente
  archivio, lettura documento) hanno **la stessa identica forma** e la stessa
  regola, ma **non le ho viste fallire**.
- ⚠️ **La rete l'ho fatta cadere io, dall'interno del browser**: è il
  fallimento della `fetch`, che è quello che succede in modalità aereo. **Non
  ho provato una rete lenta** che va in timeout — è il terzo caso, quello che
  la regola chiama «il gestionale non ha risposto».
- ⚠️ **Le 53 schermate esposte non le ho aperte una per una**: la cura è nel
  punto unico da cui passano, quindi vale per tutte per costruzione, ma
  l'unica vista con gli occhi è Comande.

---

## 7 · 🔴 UN PUSH È AVVENUTO — dichiarato, come chiedeva il mandato

Il mandato diceva di fermarsi e scriverlo se un push fosse partito lo stesso.
**Misurato dal registro dei riferimenti remoti**, non sospettato:

```
7498350 refs/remotes/origin/master@{0}: update by push
```

| | |
|---|---|
| cosa è uscito | `7498350` — *«Da un conto aperto si esce, e lo spostamento torna raggiungibile»* |
| quando l'ho committato | **17:26** |
| il primo commit di questa serata | **17:49** |
| **i quattro commit di stasera sono usciti?** | **NO** — sono tutti in locale |

⚠️ **Non l'ho fatto io**: dal terminale di Claude Code `git push` fallisce
sempre (§4 di CLAUDE.md). È uscito per un'altra strada — Alessio, o il
pulsante di pubblicazione dell'interfaccia grafica (§11).

⚠️ **Cosa comporta, detto per intero**: quel push **ha ripubblicato il sito**
con la correzione della regressione dello spostamento — che è una cosa buona,
ed era il lavoro che Alessio aveva appena chiesto. **E ha tolto il freno**
che tiene le migrazioni lontane dal database vero per quel commit: `npm run
migra` confronta con `origin/master`, quindi tutto ciò che è uscito smette di
essere «non ancora su GitHub».

✅ **Ma non cambia niente per questa serata**: nessuna migrazione è stata
scritta, e il database vero non è stato toccato.

**Lo stato, in forma ricontrollabile:**

```
origin/master  7498350   (prima di questo mandato)
HEAD locale    853c4e3   (4 commit avanti)
```

---

## 8 · Cosa abbiamo rovesciato

**Niente.** Le quattro chiamate leggevano già la frase italiana quando c'era,
e quella regola non cambia: **si aggiunge il caso in cui una frase non
c'è.** Il commento del 09/08 che diceva *«va mostrato intatto, non sostituito
da un generico non-2xx»* resta vero — e adesso vale anche quando il generico
sarebbe stato l'unica cosa rimasta.
