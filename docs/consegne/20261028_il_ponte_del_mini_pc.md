# Il ponte del mini-PC — 28/10/2026

Questo è il secondo passo del collegamento delle stampanti, dopo [le stampanti e la coda](20261028_le_stampanti_e_la_coda.md). Il ponte è il programma che girerà sul mini-PC del ristorante. Alessio ha deciso il 28/10: *«Compriamo un mini-PC dedicato. Intanto inizia a costruire le parti che si possono fare prima del collaudo.»*

**Nessuna migrazione e nessuna funzione online.** Questo passo usa le tre porte della `20261028000005`.

## Cosa c'è, in `ponte/`
Tutto il codice è fuori da `src/`, quindi non finisce nel sito. Le dipendenze sono zero: serve solo Node 22 o più recente.
- **`ponte.mjs`**, il giro principale:
  - guarda la coda ogni 2 secondi e manda il battito ogni 30;
  - se il gestionale non risponde, riprova ogni 15 secondi;
  - ogni lavoro ha un tetto di 45 secondi, e un guasto su un lavoro non ferma gli altri;
  - scrive un registro di massimo 2 MB, che non contiene mai la chiave;
  - con `--verifica` fa un battito solo, e serve durante l'installazione.
- **`gestionale.mjs`**: le tre chiamate al gestionale, con la sola chiave pubblica più la chiave del ponte.
- **`esegui.mjs`**: un lavoro della coda portato all'apparecchio, che restituisce l'esito.
- **`rete.mjs`**: TCP e HTTP con un orologio su ogni attesa.
- **`sicurezza.mjs`**: la seconda rete sugli indirizzi, con le stesse regole del vincolo del database.
- **`protocolli/`**, uno per lingua:
  - `escpos.mjs`: stampanti TM, porta 9100, foglio di prova e lettura di stato con DLE EOT;
  - `fpmate.mjs`: registratore FP-81 II RT, **solo documento non fiscale** e lettura di stato;
  - `epos.mjs`: TM in ePOS-Print;
  - `testo.mjs`: righe ripulite, perché il contenuto non diventi mai un comando.
- **`simulatore.mjs`**: una stampante e un registratore finti su 127.0.0.1, con i modi `normale`, `muto`, `a_meta`, `carta_finita`, `coperchio_aperto`, `rifiuta` e `pagina_bianca`.
- **`installa.ps1`**: il servizio di Windows con l'Utilità di pianificazione (all'avvio, come SYSTEM, che riparte da solo). Non serve scaricare niente oltre a Node.
- **`config.esempio.json`**: il modello. `ponte/config.json` e `ponte/uscita/` sono esclusi dal repository.
- **La guida click per click** in [docs/guide/PONTE.md](../guide/PONTE.md).

## 🔴 La regola che tiene insieme tutto: fallito o incerto
- **Fallito** vuol dire che non è partito niente (la connessione non si è aperta), oppure che l'apparecchio ha detto di no (carta, coperchio, HTTP 4xx). Riprovare è sicuro.
- **Incerto** vuol dire che è partito e la risposta non è arrivata, oppure che la risposta non dice com'è andata. Non si riprova da soli.
- **Per ESC/POS si chiede lo stato prima di stampare.** Se la stampante non risponde a quella domanda, il foglio non è ancora partito, quindi il lavoro è fallito e mai incerto.
- **Una lettura di stato non stampa**, quindi non è mai incerta.

## Revisione ECC
**ecc:code-reviewer** non ha trovato difetti critici. Ho applicato tutti i rilievi alti e medi:
- un lavoro inceppato poteva fermare il ponte: ora ha un tetto, diventa incerto e il giro continua;
- la consegna ESC/POS non aveva orologio dopo la connessione: ora ce l'ha, e si aspetta che la stampante chiuda per non tagliarle i byte;
- su Windows in italiano il gruppo si chiama «Amministratori», quindi l'installazione protegge `config.json` per numero e non per nome, e se fallisce lo dice;
- un HTTP 4xx ora è fallito e non incerto;
- una risposta che non è di stampa, o un «tempo scaduto» del registratore, ora è incerto;
- l'attesa del ponte è di 15 secondi, più lunga dei 10 chiesti all'apparecchio, così un rifiuto vero arriva in tempo;
- in https la connessione conta dalla cifratura conclusa;
- un errore nel creare la richiesta non fa più cadere il programma;
- i guasti imprevisti si scrivono nel registro prima di uscire;
- un a capo nel nome non spezza il registro;
- una pagina d'errore del server non viene più letta come JSON;
- reinstallare riavvia il servizio;
- nelle prove, attese per condizione invece che a tempo fisso.

## Numeri, misurati
- **`tests/unita/ponte.test.js`: 24 prove passate**, contro il simulatore modo per modo, senza rete esterna. Coprono:
  - gli indirizzi, come il vincolo;
  - il testo che non diventa comando;
  - le risposte dei tre protocolli;
  - normale, stato, carta, coperchio, muto, a metà, rifiuto, pagina bianca e apparecchio spento;
  - il giro, il tetto per lavoro, il guasto, il 4xx e la risposta che non è di stampa.
- **`tests/app/ponte-dal-vivo.test.js`: 3 prove passate su Prova.** È il codice vero del ponte, con la chiave pubblica e una chiave del ponte:
  - battito;
  - «Prova di stampa», poi il simulatore, poi il gestionale rilegge «stampato»;
  - carta finita, poi «fallito / carta_finita», con la pagina che lo mostra.
- **`tests/app/stampanti.test.js`:** passa ancora, 8 prove.
- **`npm run test`:** 2.421 passate e 3 rosse. Sono le stesse 3 di prima di questo lavoro (`bozze-col-lordo`, `indirizzo-funzioni-vault`), dovute agli a-capo di Windows della copia locale.
- **`oxlint`:** nessun errore. `ponte/**` è aggiunto all'ambiente Node in `.oxlintrc.json`.
- **`installa.ps1`:** zero errori di sintassi (controllato col parser di PowerShell).

## Non verificato
- **Nessun apparecchio vero.**
  - I bit di stato ESC/POS vengono dal manuale generale Epson.
  - I comandi FPMate (`printerNonFiscal`, `queryPrinterStatus`) e i codici di errore (`EPTR_REC_EMPTY`, `EPTR_COVER_OPEN`) vengono dalla documentazione pubblica.
  - Vanno confermati col manuale del fornitore e il giorno del collaudo. La risposta intera dell'apparecchio finisce in `lavori_stampa.esito`, per leggerla quel giorno.
- **`installa.ps1` non è stato eseguito**, perché da qui non si installa un servizio. È provato solo il parser. Sul mini-PC il primo giro va fatto insieme.
- **Il giro principale (`avvia`) non è stato lasciato acceso a lungo.** Sono provati `unGiro` e `battito` presi uno per uno.
- **Il simulatore parla ESC/POS e FPMate, non ePOS.** `epos.mjs` è provato solo nelle risposte.

## Dato per fatto senza misurarlo
- Che il mini-PC abbia Windows 10 o 11. Se arrivasse con Linux, l'installazione andrebbe riscritta. Il programma invece no.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
In questo passo non è stata rovesciata nessuna decisione.

## Dopo il collaudo
1. Confermare comandi e codici sull'apparecchio vero, e correggere `protocolli/` se servono.
2. Le comande dalla coda, con la Cucina che smette di stampare dal browser.
3. Gli scontrini veri, in un passo a parte (mandato del registratore telematico, blocchi 1-3).
