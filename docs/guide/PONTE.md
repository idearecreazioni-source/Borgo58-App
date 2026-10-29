# Il ponte: come si collegano stampanti e registratore

Il gestionale è un sito, e un sito non può parlare con le stampanti del ristorante. Ci parla un piccolo programma, **il ponte**, che gira su un mini-PC acceso nel locale:

1. tu premi «Prova di stampa» nel gestionale;
2. il gestionale mette il lavoro in coda;
3. il ponte lo prende e lo manda alla stampante;
4. il ponte riscrive com'è andata.

Se internet cade, il ponte aspetta e riprova da solo.

---

## Prima del collaudo

### 1 · Il mini-PC
- **Che cosa serve:**
  - Windows 10 o 11;
  - collegato **col cavo** allo stesso router delle stampanti (meglio del Wi-Fi);
  - sempre acceso;
  - nelle impostazioni di risparmio energia: «Sospendi: mai».
- **Consigliato:** una piccola batteria (UPS). Così un calo di corrente non lo spegne a metà servizio.

### 2 · Node
Scarica **Node LTS** da https://nodejs.org e installalo con le scelte già proposte.

### 3 · La cartella del ponte
Copia la cartella `ponte` del gestionale sul mini-PC, per esempio in `C:\Borgo58\ponte`. Non serve altro.

### 4 · La chiave
1. Nel gestionale (da titolare) vai in **Comande → Stampanti → Crea la chiave del ponte**.
2. Copia la chiave: si vede **una volta sola**.
3. Se la perdi, premi «Togli» e creane un'altra.

### 5 · La configurazione
Nella cartella del ponte apri `config.json` con il Blocco note. Se non c'è, il passo 6 lo crea. ⚠️ Dopo la prima installazione il file è protetto: per cambiarlo apri il Blocco note **come amministratore** (tasto destro → Esegui come amministratore), poi rilancia il passo 6. Scrivi:
- **`indirizzo`:** l'indirizzo del gestionale. Te lo do io.
- **`chiavePubblica`:** la chiave pubblica del gestionale. Te la do io (non è segreta).
- **`chiavePonte`:** la chiave del passo 4.
- **`simulatore`:** lascia `false`.

### 6 · L'installazione
1. Cerca **PowerShell** nel menu Start, tasto destro, **Esegui come amministratore**.
2. Scrivi `cd C:\Borgo58\ponte` e premi Invio.
3. Scrivi `powershell -ExecutionPolicy Bypass -File .\installa.ps1` e premi Invio.

Il comando:
- controlla Node;
- prova a parlare col gestionale (se la chiave è sbagliata lo dice subito);
- installa il ponte in modo che parta da solo a ogni accensione e ripartisca se si ferma.

Entro un minuto, in **Comande → Stampanti**, il ponte risulta **● Acceso**.

---

## Il giorno del collaudo, col fornitore

Per ogni apparecchio:
1. **Comande → Stampanti → Aggiungi un apparecchio.**
2. Compila la scheda:
   - **Nome:** per esempio «Stampante cucina».
   - **Che cos'è:** «Registratore telematico» oppure «Stampante delle comande».
   - **Modello:**
     - per il registratore, «Epson FP-81 II RT (FPMate)»;
     - per le stampanti, «Epson TM in rete (ESC/POS)», salvo che il fornitore dica ePOS.
   - **Indirizzo IP** e **porta:** te li dice il fornitore. Le porte di solito sono 80 per il registratore e 9100 per le stampanti.
   - **Stampa i biglietti di:** cucina o bar.
3. Premi **Prova di stampa**. Deve uscire un foglio «PROVA DI STAMPA — Documento non fiscale». Nelle «Ultime prove» la riga diventa **Fatto**.
4. Fai le prove di guasto, davanti all'apparecchio:
   - apri il coperchio e premi **Leggi lo stato**: deve dire «Coperchio aperto»;
   - togli la carta e premi **Leggi lo stato**: deve dire «Carta finita».

**Cosa chiedere al fornitore quel giorno:**
- indirizzi IP **fissi**, che non cambiano quando si riaccende il router;
- sul registratore, il servizio XML/FPMate acceso;
- il manuale «Fiscal ePOS-Print / FPMate».

---

## Cosa vuol dire quello che leggi

| Nelle «Ultime prove» | Vuol dire | Cosa fare |
|---|---|---|
| Aspetta il ponte | Il ponte non l'ha ancora presa | Se resta così, il ponte è spento: guarda il mini-PC |
| Fatto | L'apparecchio ha detto di sì | Niente |
| Non riuscito | Non è partito niente, oppure l'apparecchio ha detto di no (carta, coperchio, spento) | Leggi la frase, sistema, riprova |
| **Non si sa se è uscito** | Il ponte ha mandato, ma la risposta non è arrivata | **Guarda la stampante.** Poi premi «Ho guardato, chiudi». Non si riprova da solo, apposta |

⚠️ **Per ora niente scontrini.** Il registratore stampa solo il foglio di prova **non fiscale**, che non è un incasso e non va all'Agenzia delle Entrate. Gli scontrini veri saranno un passo a parte.

⚠️ **Un foglio bianco con «Fatto» resta possibile.** Nessun apparecchio sa dire che il foglio è uscito vuoto: se lo vedi, è un guasto della stampante.

---

## Per chi aggiorna il ponte

- **Le prove senza apparecchi veri:** `node ponte/simulatore.mjs` accende una stampante e un registratore finti su `127.0.0.1` (porte 19100 e 18080). Quello che stamperebbero finisce in `ponte/uscita/`.
  - Per i modi che vanno storti: `node ponte/simulatore.mjs muto` (anche `a_meta`, `carta_finita`, `coperchio_aperto`, `rifiuta`, `pagina_bianca`).
  - Nel gestionale scegli il modello «Apparecchio finto», e in `config.json` metti `"simulatore": true`.
- **Le prove automatiche:**
  - `tests/unita/ponte.test.js`: contro il simulatore, senza rete;
  - `tests/app/ponte-dal-vivo.test.js`: contro Prova.
- **Il registro** è in `ponte/ponte.log`. La chiave del ponte non ci finisce mai.
- **Per togliere il servizio:** `powershell -ExecutionPolicy Bypass -File .\installa.ps1 -Togli`.
