# Consegna del 12/08/2026 — l'indice dell'Archivio si tiene pronto

**Commit della consegna: `4bb3abf`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Migrazione `20260812000010` già applicata in produzione**: è la **prima
applicata da me**, col comando nato tre ore fa. I numeri sono in §4.

---

## 1. L'origine è una domanda di Alessio, non un audit

> *«Col passare del tempo si accumuleranno molti dati nell'archivio. Ogni
> volta che farò una domanda l'assistente dovrà leggere tutto per trovare
> la risposta?»*

La risposta per la parte cara era no — il modello legge al massimo 12
documenti, entro un tetto di caratteri, e il prezzo di una domanda non
cresce con l'archivio.

Ma andando a rispondergli con precisione invece che a memoria, la risposta
per il database era **sì**: `documenti_per_domanda()` costruiva il vettore
di ricerca di **ogni** documento **a ogni domanda**, dentro un
`cross join lateral`.

Con quattro documenti non si misura. Con tremila, ogni domanda rilegge da
capo qualche decina di megabyte di testo per decidere cosa è pertinente —
**prima ancora di chiamare l'AI**.

**Non si sarebbe mai manifestato come guasto**: come lentezza crescente,
di quelle a cui ci si abitua un mese alla volta e che nessuno data mai.

---

## 2. Cosa cambia

Il vettore di ricerca diventa una **colonna calcolata e conservata**
(`documents.ricerca`): Postgres la aggiorna da sé quando il documento
cambia, e la domanda si limita a confrontare. Il lavoro si paga una volta,
quando il documento entra, invece che a ogni domanda per sempre. Indice
GIN sulla colonna.

**Il comportamento è identico** — stesse colonne, stesso ordine, stessa
rilevanza, nessun `where` aggiunto: l'elenco resta **tutto** l'Archivio in
ordine di pertinenza, che è ciò che permette di dire «guardati 40, letti
6» invece di un «non risulta» cieco.

**Via `idx_documents_testo`**: copriva il solo `testo` e non lo leggeva
nessuno — la ricerca guarda anche titolo, tipo, controparte e note. Un
indice che nessuno legge si paga a ogni scrittura.

**Dettaglio non ovvio**: `to_tsvector(regconfig, text)` con la lingua
scritta a mano è l'unica forma ammessa in una colonna calcolata — la
variante a un argomento dipende dalla configurazione della sessione e
Postgres la rifiuta. Non è stile: è il motivo per cui `'italian'` compare
scritto invece di essere un default.

**Cosa NON entra nel vettore**: date e importi. Cercarli come parole
darebbe corrispondenze a caso; le domande sulle scadenze si rispondono
con le schede, che il modello riceve comunque tutte.

---

## 3. Le due prove che non erano ovvie

1. **I documenti già in archivio hanno il vettore senza che nessuno li
   abbia toccati.** Una colonna calcolata si riempie da sola anche sul
   passato — ma se così non fosse, l'archivio di ieri sarebbe diventato
   **invisibile** da un momento all'altro, e la prima avvisaglia sarebbe
   stata un «non risulta» sbagliato.
2. **Il vettore segue le modifiche**: la verifica cambia il testo di un
   documento e controlla che la sua pertinenza cambi di conseguenza. È la
   differenza fra una colonna calcolata e una copia scritta una volta e
   dimenticata — e la seconda si sarebbe comportata bene per settimane.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| progetto di prova | **applicata due volte**: idempotente |
| prove automatiche | **29 verdi** |
| **produzione** | **applicata**, con `npm run migra -- --conferma` |
| documenti con l'indice pronto | **4 su 4** — letti dopo, dal connettore in sola lettura |
| indice nuovo presente / vecchio rimosso | **1 / 0** |
| migrazioni registrate | **64** |
| residui della prova | **0** |
| lint, prove di unità, build | puliti |

**Non verificato, e dichiarato**: che sia effettivamente più veloce. Con
quattro documenti non è misurabile, e non ho inventato un archivio finto
per produrre un numero che avrebbe misurato l'archivio finto. Il guadagno
è strutturale — lavoro fatto una volta invece che a ogni domanda — e si
vedrà quando ci sarà qualcosa da vedere.

---

## 5. Nota di processo — prima applicazione vera del comando nuovo

È la prima migrazione applicata in produzione dalla sessione Code, dopo la
modifica al Contratto §8 di stamattina. Il giro è stato:

1. `npm run migra` in sola lettura → *«da applicare (1): 20260812000010,
   254 righe»*;
2. `npm run migra -- --conferma` → applicata, registrata;
3. resoconto letto **dal connettore in sola lettura**, cioè per una strada
   diversa da quella che ha scritto.

I due vincoli non sono stati messi alla prova qui, perché la migrazione
era già passata dalla prova ed era già committata — cioè hanno taciuto
correttamente. Provati accendendoli stamattina, come da riepilogo
`20260812_chi_applica_le_migrazioni.md`.
