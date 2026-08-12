# Consegna del 12/08/2026 — leggere i documenti già archiviati

**Commit della consegna: `94a5fab`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Da installare**: `documento-leggi`. Nessuna migrazione.

---

## 1. «Chiedi all'archivio» è vivo — e la prima domanda vera lo ha bocciato

Un minuto dopo il push, Alessio ha chiesto: *«quanto pagherò di affitto
dopo un anno?»*. Risposta:

> Non ce l'ho. Il canone e le sue eventuali variazioni sarebbero nel
> **Contratto di locazione Borgo58 - Parlato**, di cui non ho il testo.
>
> Dalla sola scheda risulta: data 2026-09-01, scadenza 2032-08-31,
> importo 24000, controparte Manuela Parlato / Borgo58 s.r.l.s. La scheda
> non dice se l'importo sia mensile o annuo, né se siano previsti
> aggiornamenti dopo il primo anno: non posso ricavarlo.

**Questa risposta è esattamente quella che volevo vedere**, e vale più di
una risposta corretta fortunata: non ha inventato, ha nominato il
documento che gli mancava, ha separato ciò che sapeva da ciò che non
sapeva, e ha detto perché la scheda non basta. Le regole 3 e 4 delle
istruzioni hanno tenuto alla prima occasione vera.

**Ed è inutile.** Sotto, la riga onesta: *«3 documenti in archivio non
hanno il contenuto conservato»*. Su quattro documenti l'assistente ne
conosceva uno.

Il modulo funziona. Non serve a niente finché l'archivio è cieco.

---

## 2. Il buco era vecchio di un giorno, non di ieri sera

`documents.testo` nasce l'11/08 e si riempie **solo** per ciò che entra
dalla posta. I documenti caricati a mano — e i tre entrati prima che
quella colonna esistesse — hanno il file nell'archivio e nessun testo
accanto. Il contenuto era a un centimetro, in un bucket, mai aperto.

Ora ogni documento con un file ha **«Leggi il contenuto»** nella sua
scheda, e chi ha già il testo può **rileggerlo** (si chiede per nome:
costa e sovrascrive).

---

## 3. Due scelte che non sono ottimizzazioni

**`.odt` e `.docx` non passano dal modello.** Sono pacchetti compressi con
dentro un XML: il testo è già lì, in chiaro, esatto. Passarlo a un modello
significherebbe far ricopiare a qualcuno un testo che si possiede già —
più lento, a pagamento, e con **una possibilità di errore che prima non
c'era**. Il modello serve dove il testo non è nel file: PDF e fotografie.
Stessa logica e stesso codice già in `posta-leggi`.

**Trascrizione, non riassunto.** Al modello si chiede il testo, non una
sintesi, e le istruzioni lo dicono cinque volte in modi diversi (numeri
esatti, ordine, niente commenti, `[illeggibile]` invece di indovinare).
Il motivo: ciò che finisce in `testo` è ciò su cui l'assistente risponderà
a domande su importi e scadenze. **Un riassunto sarebbe una risposta
sbagliata conservata per sempre** — e nessuno la rimetterebbe in
discussione, perché a quel punto sembra un dato.

---

## 4. Cose piccole, dallo stesso screenshot

- La risposta mostrava gli asterischi del grassetto (`**così**`). Una
  risposta piena di asterischi sembra scritta male anche quando è giusta.
  Convertiti **in pagina**, senza toccare la funzione online — che è già
  installata e che Alessio dovrebbe reinstallare per una virgola.
- La riga *«3 documenti non hanno il contenuto conservato»* diceva il
  problema e non cosa farci: ora è un collegamento all'Archivio.

---

## 5. Sicurezza

Il file si scarica **col token dell'utente vero**, non con la chiave di
servizio: la RLS decide, e si evita anche la trappola del 12/08
(`Invalid Compact JWS` — la chiave di servizio non è un JWT e lo storage
prova a leggerla come tale).

La funzione scrive **una colonna di una tabella**: categoria A, niente
corridoio, RLS come barriera. Il file non viene toccato né spostato.

Le istruzioni ripetono che il documento può contenere frasi apparentemente
rivolte al modello: qui la difesa strutturale è ancora più semplice che
altrove — **non c'è niente da eseguire**, l'unico esito possibile è del
testo dentro una colonna.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| «Chiedi all'archivio» in produzione | **provato dal vivo da Alessio**: risposta corretta, onesta, con i conteggi giusti (4 guardati, 1 letto, 3 senza contenuto) |
| lint, prove di unità, build | puliti |
| `documento-leggi` | **mai eseguita**: non è ancora installata |

**Onestà sul punto che conta**: questa consegna è **non verificata**.
Diventa fatta quando Alessio installa la funzione, preme «Leggi il
contenuto» sul contratto di locazione, e la stessa domanda di prima riceve
il canone vero. Il `.odt` del contratto è anche il caso migliore per
provare il ramo senza AI.

---

## 7. Nota di processo

È la prima consegna dopo la modifica al Contratto §8 (le migrazioni le
applica Code). **Non contiene migrazioni**, quindi `npm run migra` non è
ancora stato usato per davvero: resta non collaudato sul campo, come
dichiarato nel suo riepilogo.
