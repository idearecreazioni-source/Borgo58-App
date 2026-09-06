# SPEC-0013 — MEMO voce: gli appunti si approvano

**06/09/2026.** Riepilogo per il validatore.

* **HEAD dichiarato**: `b726fda` — il commit che sta sotto questo file.
* **Ramo**: `spec-0013-appunti-vocali`, aperto da `89625a4` (master). Proposta #33.
* **Migrazioni**: **nove**, e i numeri si scrivono per intero — la forma
  abbreviata «…001 → …009» nomina i due estremi e lascia mute quelle in
  mezzo, ed è la rete del progetto ad averlo fatto notare fermandosi:

  | versione | cosa fa |
  |---|---|
  | `20260906000001` | gli appunti vocali si approvano |
  | `20260906000002` | scegliere non esegue più |
  | `20260906000003` | ogni elemento porta le sue scelte |
  | `20260906000004` | l'appunto lo assegna il database |
  | `20260906000005` | «non ho capito» un gesto ce l'ha |
  | `20260906000006` | una porta sola e niente gare |
  | `20260906000007` | due mani insieme sullo stesso appunto |
  | `20260906000008` | l'appunto si tiene mentre ci si scrive |
  | `20260906000009` | il lucchetto c'era già, e ora si vede |

  Applicate al **solo progetto di prova** (378 registrate lì) quando questo
  documento è stato scritto.
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

---

## 5 · La coda del 06/09 sera — due difetti dal vivo

🔴 **Rilasciato SPEC-0013, due difetti sono usciti al primo uso vero.**

**(1) «segna il pesce spada nella spesa spicciola» diventava «Lista della
spesa».** La spesa spicciola è la Tasca; le liste distinte sono SPEC-0012 e
non sono implementate. L'appunto risultava **eseguibile**, quindi mostrava
«Approva» — e un tocco per sbaglio avrebbe scritto nella lista sbagliata.
⚠️ Non era un errore di ascolto: MEMO aveva capito, e l'aveva pure scritto
nei dati (`note: "spesa spicciola"`). L'aveva **ricondotto**, che è
precisamente ciò che SPEC-0013 vieta.

**(2) «Approva» non scriveva niente e la schermata non lo diceva.** Causa
vera: la funzione online `operazioni-atomiche` in produzione era a una
versione che **non conosceva `approva_appunto`** — era stata installata solo
sul progetto di prova. Errore di consegna mio: ho pubblicato un pulsante che
chiama una porta che non avevo installato.

### Cosa è stato fatto

* La regola sta in `supabase/functions/ascolta-voce/destinazioni.ts` ed è
  **deterministica**, non solo nel prompt: se il modello dichiara il nome di
  una lista, il gestionale — che ne ha una sola — non offre di scriverci
  dentro. ⚠️ Non cerca parole italiane: guarda un fatto dichiarato.
* Il fallimento dice **prima il fatto**: «Non è stato scritto niente.
  L'appunto è ancora qui, intero». Il motivo viene dopo, il pulsante diventa
  «Riprova», e non compare mai «✓ Fatto» quando non è fatto.
* **Due reti**, perché le cause possibili sono due e nessuna copre l'altra:
  `tests/unita/corridoio-conosce-i-gesti.test.js` prende il caso in cui il
  corridoio **nel repository** non conosce un gesto che il client chiama;
  `scripts/funzioni-indietro.mjs` prende il caso in cui lo conosce e quello
  **installato** è indietro — che è quello che è successo.

### Collaudo sul progetto di prova, con le funzioni vere

Fatto con le due funzioni installate sulla prova e il modello vero: **18
controlli su 18**.

| caso | esito |
|---|---|
| «spesa spicciola» → tipo `lista_spesa_spicciola`, **non** `lista_spesa` | ✅ |
| appunto **non eseguibile**, titolo «Aggiungi a «spesa spicciola»» | ✅ |
| approvarlo viene **rifiutato** dal database | ✅ |
| «parmigiano alla lista della spesa» → `lista_spesa`, approvabile | ✅ |
| dettare **non scrive** (73 → 73 righe in lista) | ✅ |
| approvare riesce, riga `eseguita`, appunto `approvato` e chiuso | ✅ |
| la riga compare in lista, **una sola** (73 → 74) | ✅ |
| riapprovare è **rifiutato**, la lista non cresce | ✅ |

Tutto ciò che il collaudo ha creato è stato cancellato.

### Cosa il rilascio dovrà distribuire

Non basta pubblicare il sito: **servono anche le due funzioni online**.

| cosa | perché |
|---|---|
| il sito | il messaggio del fallimento e i nomi in italiano |
| `ascolta-voce` | la regola sulla lista nominata e il prompt |
| `operazioni-atomiche` | il rifiuto che spiega — e senza, «Approva» resta rotto |

⚠️ **Limite dichiarato del controllo nuovo**: gira dove c'è un accesso a
Supabase, cioè da una pubblicazione lanciata a mano. **Nei controlli di
GitHub non c'è**, quindi lì non gira e lo scrive a schermo invece di tacere.
Chiuderlo davvero vuol dire dare a quel lavoro un accesso in lettura a
Supabase, ed è una decisione di Alessio.

### Cosa NON è verificato

- 🔴 **Nessuna mano ha visto le schermate corrette**: il collaudo è passato
  dalle funzioni online e dal database, non da un dito su un tablet.
- ⚠️ **Le correzioni non sono in produzione**: il sito e le due funzioni
  vanno pubblicati perché servano.
- ⚠️ **L'appunto vero del pesce spada è stato lasciato intatto** in
  produzione, com'è stato chiesto: `in_attesa`, appunto `aperto`, nessuna
  scrittura da nessuna parte.
