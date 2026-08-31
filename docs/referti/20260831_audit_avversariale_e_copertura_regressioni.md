# Audit avversariale e copertura delle prove di non regressione

**Data della misura:** 31/08/2026  
**Perimetro:** ramo `work`, sorgenti presenti nella copia di lavoro, senza accesso al progetto Supabase di prova.

## 1. Verdetto

I controlli puri sono verdi: **677 prove su 677** dopo la correzione descritta
qui sotto; lint e compilazione terminano con codice zero. Questo risultato non
dimostra però che «l'app è coperta»: la copertura eseguita dalle prove pure è
**9,84% delle righe** dell'intero frontend.

Il dato è fortemente sbilanciato:

| Perimetro misurato | Righe | Istruzioni | Rami | Funzioni |
|---|---:|---:|---:|---:|
| intero `src` | 1.095 / 11.119 (**9,84%**) | 1.311 / 13.241 (**9,90%**) | 1.097 / 11.519 (**9,52%**) | 306 / 4.602 (**6,64%**) |
| regole pure `src/lib/calcoli` | 816 / 859 (**94,99%**) | 1.008 / 1.097 (**91,89%**) | 959 / 1.147 (**83,61%**) | 270 / 282 (**95,74%**) |
| accesso dati `src/lib/api` | 7 / 1.532 (**0,46%**) | 7 / 2.058 (**0,34%**) | 8 / 2.014 (**0,40%**) | 2 / 537 (**0,37%**) |
| pagine `src/pages` | 0 / 7.562 (**0%**) | 0 / 8.731 (**0%**) | 0 / 7.282 (**0%**) | 0 / 3.451 (**0%**) |
| componenti `src/components` | 0 / 535 (**0%**) | 0 / 627 (**0%**) | 0 / 645 (**0%**) | 0 / 202 (**0%**) |

Queste percentuali sono **code coverage delle sole prove pure**. Non sono una
percentuale di requisiti coperti, non comprendono le verifiche SQL contenute
nelle migrazioni e non comprendono le prove contro Supabase, che in questa
sessione non erano eseguibili perché `.env.test` non è presente.

## 2. Difetto riprodotto e chiuso: un falso verde nelle prove dell'app

### Riproduzione prima della correzione

Con `.env.test` assente, `npm run test:app` terminava con **codice 0**. Il
resoconto mostrava file con `0 test` e, negli altri file, tutte le prove
raccolte come `skipped`. Il comando poteva quindi essere interpretato come un
successo senza avere interrogato il progetto di prova.

Questo si discostava dalla regola già scritta in `tests/app/LEGGIMI.md`: le
prove non devono partire senza la configurazione del progetto di prova.

### Correzione

`npm run test:app` ora esegue prima un controllo che:

1. richiede tutte e sei le variabili necessarie;
2. elenca tutte quelle mancanti;
3. rifiuta esplicitamente il riferimento del database di produzione;
4. termina con codice diverso da zero prima che Vitest raccolga le prove.

Quattro prove pure proteggono il controllo. Dopo la modifica, nello stesso
ambiente privo di `.env.test`, `npm run test:app` termina con **codice 1** e
nomina le sei variabili mancanti.

**Gravità: alta per l'affidabilità dei controlli.** Non è stata osservata una
scrittura sul database sbagliato: il difetto misurato era il verdetto verde
senza esecuzione.

## 3. Copertura No Regression Test: cosa è protetto e cosa no

### Coperto bene dalle prove pure

Il nucleo di calcolo ha 94,99% di righe e 83,61% di rami coperti. Sono
esercitate, fra le altre, le regole su conto, sala, turni, quantità,
percentuali, prenotazioni, stato della serata, vocabolari e comandi vocali.

### Copertura presente ma non misurata in questa sessione

Nel repository esistono **67 file** di prove in `tests/app`. Il loro contenuto
copre integrazioni con Supabase, permessi, vincoli, funzioni atomiche e flussi
di dominio. Senza le credenziali del progetto di prova non è stato possibile
misurare quante prove passano oggi né includere il loro contributo nel report
di coverage. Il nuovo preavvio impedisce che questa assenza venga rendicontata
come verde.

### Scoperto dalle reti automatiche attuali

La misura delle prove pure registra **0%** sulle 89 pagine JSX e sui componenti.
Inoltre la pipeline dichiara esplicitamente che nessuna prova guarda una
schermata. Restano quindi fuori dal verdetto automatico:

- rendering e interazioni nel browser;
- navigazione effettiva delle rotte per i due ruoli;
- regressioni responsive su telefono e tablet;
- accessibilità tramite tastiera e lettore di schermo;
- errori JavaScript che emergono solo montando una pagina;
- coerenza fra messaggi mostrati e risultato della scrittura;
- comportamento offline, ricarica e ripresa di una bozza nel browser.

Questo è il principale scarto fra «molte prove di dominio» e «app protetta da
regressioni»: il database e le funzioni pure possono essere corretti mentre il
gesto reale in schermata non è stato eseguito.

## 4. Altri rilievi verificati

### Conteggi dichiarati che invecchiano

La pipeline contiene ancora nei commenti i numeri **657 prove pure**, **459
prove database** e **1.116 prove complessive**. La misura locale dopo questa
correzione è 677 prove pure. Non è stato possibile rimisurare le prove database,
quindi questo referto non sostituisce quel numero con un altro: segnala che i
conteggi scritti a mano non sono una fonte affidabile di stato corrente.

### Dimensione del pacchetto

La compilazione riesce, ma Vite segnala un chunk JavaScript di **1.524,54 kB**
(**361,60 kB gzip**), oltre la soglia di avviso di 500 kB. Non è stata misurata
la velocità su un tablet reale, quindi qui non viene dichiarato un rallentamento;
il rilievo verificato è l'avviso del compilatore e l'assenza di suddivisione del
bundle per rotta.

## 5. Priorità proposte

1. **P0 — mantenere il nuovo blocco anti-falso-verde.** È la condizione per
   dare valore a ogni futuro resoconto delle prove dell'app.
2. **P1 — aggiungere smoke test browser per le rotte critiche:** login,
   prenotazione pubblica, sala/comanda/conto, carico magazzino, registrazione
   HACCP. Devono montare davvero le pagine e fallire sugli errori console.
3. **P1 — produrre coverage separata delle prove database.** Va eseguita nel
   lavoro CI che possiede i segreti, conservando il report come artefatto; non
   va sommata alla percentuale delle prove pure senza distinguere i due giri.
4. **P2 — introdurre soglie per cartella, non una soglia globale.** Una soglia
   globale bassa lascerebbe le pagine a zero; una soglia globale alta renderebbe
   subito inutilizzabile il controllo. La prima soglia utile è impedire che
   `src/lib/calcoli` scenda sotto il valore misurato in questo referto.
5. **P2 — sostituire i conteggi nei commenti con il risultato del runner.** Il
   numero delle prove va letto a fine esecuzione, non mantenuto a mano.

## 6. Metodo riproducibile

Comandi eseguiti dalla radice del repository:

```text
npm test
npm run lint
npm run build
npm run test:app
npx vitest run tests/unita --coverage.enabled --coverage.provider=v8 \
  --coverage.include='src/**/*.{js,jsx}' \
  --coverage.reporter=text --coverage.reporter=json-summary
```

Il comando permanente equivalente all'ultimo è ora `npm run test:coverage`;
scrive il dettaglio navigabile in `coverage/index.html`. La cartella è ignorata
da Git perché è un risultato rigenerabile, non una fonte.
