# SPEC-0013 — MEMO voce: gli appunti si approvano

**06/09/2026.** Riepilogo per il validatore.

* **HEAD dichiarato**: `b726fda` — il commit che sta sotto questo file.
* **Ramo**: `spec-0013-appunti-vocali`, aperto da `89625a4` (master). Proposta #33.
* **Migrazioni**: **nove**, `20260906000001` → `…009`. Applicate al **solo
  progetto di prova** (378 registrate lì). In produzione, al momento di
  scrivere, **nessuna**.
* **Prove**: 937 pure · 28 sulle schermate · 481 contro il progetto di prova ·
  lint pulito · compilazione pulita. Tutte verdi.
* **Working tree**: pulito dopo questo commit, salvo i documenti locali di
  Alessio in `docs/specifiche/` e `docs/DECISIONI.md`, che **non fanno parte
  di questa consegna** e non sono stati toccati.

---

## Cosa abbiamo rovesciato

**Due**, tutt'e due registrati in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md) (nn. 79 e 80).

1. **«Le misure sicure si salvano da sé»** (25/08). La ragione di allora — in
   cella le mani sono occupate — **non è stata smentita**, ed è il prezzo che
   accettiamo: un gesto in più su ogni misura. Quello che è cambiato è l'altro
   piatto della bilancia: «sicuro» lo dichiara un modello, e il registro delle
   temperature va all'ASP. Decisione dichiarata **sperimentale**, da rivalutare
   prima dell'apertura.
2. **«Scegliere fra i candidati esegue»** (27/08). Non smentita: **soddisfatta
   altrove**. Il sì si è spostato dalla riga all'appunto, quindi scegliere non
   è più l'ultimo gesto — e non compare nessun «secondo pulsante».

---

## 1 · Cosa cambia

🔴 **Niente si scrive prima dell'approvazione.** `azione_si_esegue_da_se` è
**cancellata**, non spenta. `scegli_per_azione_dettata` non esegue più, ed
`esegui_azione_dettata` non è più concessa a nessun utente né offerta dal
corridoio: eseguiva **una riga sola**, e su una lista da tre articoli avrebbe
scritto il primo lasciando gli altri due in un appunto a metà.

🔴 **La destinazione non è più un elenco chiuso.** Via la chiave esterna verso
`tipi_azione_vocale`, che cambia mestiere: non dice più *cosa si può dire*,
dice *cosa il gestionale sa già eseguire*. Una destinazione sconosciuta
produce un appunto leggibile che **dichiara** di non avere un gesto, e
approvarlo è respinto con la ragione e senza buttare via niente.

🔴 **L'unità che si approva è l'appunto.** Le righe additive di una lista si
raggruppano anche se dette in momenti diversi; i movimenti con dati propri
restano separati. Il raggruppamento è un **indice unico parziale** e
l'assegnazione un **trigger** — in `azioni_dettate` si scrive da più porte, e
una regola che vive in una porta la dimentica la porta dopo.

Ogni appunto porta destinazione, **dati concreti**, numero di elementi, età,
incertezza e alternative considerate. Niente scade e niente si chiude da sé.

## 2 · Le tre revisioni del diff

| rilievo | esito |
|---|---|
| porta che eseguiva una riga sola | chiusa |
| gara fra due dettature sullo stesso gruppo | **reale** — chiusa |
| ordine dei lucchetti invertito in `chiudi_azione_a_mano` | corretto |
| appunto che restava aperto e vuoto | corretto |
| `nota_non_capita` marcata non eseguibile | errore mio, corretto |
| riga sotto un appunto appena chiuso | **non riproducibile** |
| prove che non discriminavano | corrette o dichiarate |

🔴 **La gara è reale, e la misura è questa**: due sessioni Postgres
sovrapposte, una detta una riga sul gruppo e tiene aperta la transazione, la
seconda apre lo stesso gruppo. Versione di prima → **una muore** con
`duplicate key value violates unique constraint un_appunto_aperto_per_gruppo`,
cioè **una dettatura persa**. Versione corretta → entrambe riescono.

⚠️ **La riga orfana sotto un appunto chiuso NON si è riprodotta**, misurata
nei due versi con lo stesso metodo (dettatura + `scarta_appunto` sovrapposti):
**0 righe orfane** sia con sia senza la correzione. Il perché è la cosa da
conservare: la chiave esterna `azioni_dettate.appunto_id` fa prendere sulla
riga madre un lucchetto `for key share` che **entra in conflitto** con il
`for update` della chiusura, quindi i due gesti erano già in fila. Il
`for update` esplicito resta lo stesso, perché quella garanzia non dipenda da
un effetto laterale che nessun commento nominava — e la `…009` **corregge il
merito** che la `…008` si era attribuito.

## 3 · Cosa è stato verificato, e come

Controprove fatte, non promesse — ogni regola rotta apposta, guardando *quali*
prove diventavano rosse:

| rottura | pure (14) | app (14) |
|---|---|---|
| non annuncia mai un aggiornamento | 2 | 4 |
| «non lo so» trattato come «è cambiata» | 2 | 4 |
| impronta costante | 3 | 4 |
| non si pretende il pezzo principale | 4 | 1 |
| esecuzione automatica rimessa | — | 1 |

🔴 **Due giri di controprove hanno trovato prove che non provavano niente**:
tre guardavano lo schermo prima che React lo aggiornasse, e quella sulla
misura sicura usava una temperatura senza frigo — che non è mai «sicura»,
quindi non si sarebbe eseguita nemmeno col criterio vecchio. Corrette.

## 4 · Cosa NON è verificato

- 🔴 **Nessuna mano ha visto queste schermate**, e **nessuna dettatura vera è
  passata dal modello**: tutto è provato dal database e dal codice.
- ⚠️ **Le due prove di concorrenza in `tests/app/appunti-vocali.test.js` NON
  discriminano**, ed è dichiarato dentro il file: restano verdi anche con le
  versioni difettose, perché il collegamento del gestionale mette in fila le
  chiamate. Sono guardie sull'esito; la gara è misurata a parte con `psql`,
  e quella misura non è automatizzabile qui (su GitHub `psql` non c'è).
- ⚠️ **`ascolta-voce` è modificata ma non installata**: il prompt che permette
  a MEMO di interpretare liberamente non è ancora in funzione.
- ⚠️ **`voce_da_guardare()` risponde `0,0` a chi non è titolare** invece di
  rifiutare. Comportamento preesistente, lasciato apposta: quel numero è letto
  da una schermata che vede anche la sala. Dichiarato, non corretto.
