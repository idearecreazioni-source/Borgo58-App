# Il ponte sul portatile, per il collaudo — 29/10/2026

Lo chiede Alessio, per la chat madre: *«preparare la versione portatile del ponte per il collaudo in negozio: guida, prova generale a casa col simulatore, collegato a Prova.»* Il collaudo si fa dal fornitore, e il mini-PC non c'è ancora.

**Il ponte non è rifatto.** È quello di #266, acceso a mano invece che come servizio.

## Cosa c'è
- **`docs/guide/COLLAUDO_PORTATILE.md`**: la guida, click per click, divisa in quattro parti:
  - **A.** Preparare il portatile: sospensione, Node e riavvio, zip, chiave, config.
  - **B.** La prova generale a casa: otto prove, ognuna con quello che si deve vedere.
  - **C.** Il negozio:
    - cosa è già confermato (la rete del fornitore) e cosa chiedere prima;
    - i limiti di indirizzo e porta;
    - le prove;
    - dove resta la risposta grezza.
  - **D.** Togliere tutto.
  - `PONTE.md` ora rimanda qui.
- **`ponte/portatile/`**: tre file da doppio clic.
  - `1-verifica.cmd`: `ponte.mjs --verifica`.
  - `2-accendi-il-ponte.cmd`: il ponte, finché la finestra è aperta.
  - `3-apparecchio-finto.cmd`: il simulatore, con un menu dei modi.
  - Sono solo ASCII. In `.gitattributes` c'è `*.cmd text eol=crlf`, perché `cmd.exe` con gli a capo di Linux può saltare righe.
- **`ponte/ponte.mjs`**:
  - Quando l'apparecchio ha risposto, il registro ha una riga in più, «risposta dell'apparecchio: …». È la risposta grezza (`esito`) su una riga, tagliata a 2000 caratteri. Al collaudo si legge sul portatile, subito.
  - Un `config.json` scritto male dà solo la frase nostra: il messaggio di `JSON.parse` poteva riportare un pezzo della chiave.
- **`tests/unita/ponte.test.js`**: due prove per la riga nuova.
- **Il pacchetto per Alessio** (fuori da git): `ponte-collaudo.zip`. Contiene la cartella del ponte, la guida e un `config.json` già compilato con indirizzo e chiave pubblica (`anon`) di Prova. Manca solo la chiave del ponte.
  - Prima di scriverla, il ruolo della chiave pubblica è controllato: dev'essere `anon`.
  - L'indirizzo dev'essere quello di Prova.

## La prova generale, fatta da me contro Prova
È il ponte vero, lanciato come processo a parte (come fa `2-accendi-il-ponte.cmd`), col simulatore vero. Ogni prova è nella tabella B3 della guida.

| Caso | Prova di stampa | Leggi lo stato |
|---|---|---|
| verifica | «Il gestionale risponde. Apparecchi attivi: 2.» | — |
| ponte spento | resta `in_coda`; parte da sola quando il ponte si accende | — |
| normale | stampato su tutti e due, foglio «PROVA DI STAMPA … Documento non fiscale» in `uscita/` | stampato, apparecchio `pronto` |
| carta finita | fallito, «…la carta è finita: cambia il rotolo e riprova.» | stampato, apparecchio `carta_finita` |
| coperchio aperto | fallito, «Il coperchio … è aperto: chiudilo e riprova.» | stampato, apparecchio `coperchio_aperto` |
| apparecchio spento | fallito, «L'apparecchio non risponde (ECONNREFUSED).» | fallito, apparecchio `non_risponde` |
| muto | stampante: fallito, dopo 17 secondi; registratore: **incerto**, dopo 17 secondi | — |

- Il registro aveva la riga della risposta grezza per ogni caso in cui l'apparecchio aveva risposto.
- Alla fine ho pulito: su Prova 0 apparecchi, 0 chiavi, 0 lavori.

## Prove
- `npx vitest run tests/unita/ponte.test.js`: 26 passate.
- `npm run lint -- --max-warnings=0`: pulito.
- Un `config.json` con una virgola sbagliata dà «config.json non è scritto bene…», senza pezzi del file.
- **I `.cmd` lanciati con `cmd.exe` vero**, dal pacchetto, in una cartella con gli spazi nel nome:
  - `1-verifica.cmd`, con la chiave ancora da incollare, dà «Questa chiave del ponte non vale.»;
  - il menu, con un numero sbagliato, dà «Numero sconosciuto.»;
  - il menu con «2» accende l'apparecchio finto in `carta_finita`.
- **Trovati così, e sistemati:**
  - sotto l'errore Node 24 stampava «Assertion failed … async.c». Era `process.exit(1)` subito dopo una chiamata di rete: ora c'è `process.exitCode`;
  - le virgolette «» uscivano storpiate nella finestra: ora c'è `chcp 65001`;
  - nella scelta del menu ora si tolgono gli spazi.

## Revisione ECC
- **ecc:code-reviewer: approvato, nessun blocco.**
  - La chiave non può arrivare nel registro attraverso `esito`, perché non viaggia mai verso gli apparecchi.
  - Applicato:
    - il messaggio di `JSON.parse` è nascosto;
    - nel ponte niente «premi Ctrl+C»: lascia la domanda «Terminare il processo batch?»;
    - nel menu, `set "SCELTA="` prima di `set /p`;
    - la guida dice che la riga grezza c'è solo se l'apparecchio ha risposto, e che per ESC/POS sono i byte di stato.
  - Non vero: «`ponte/uscita/` non è ignorata». È ignorata (`git check-ignore`).
- **ecc:doc-updater** ha seguito la guida come Alessio. Applicato:
  - la prova 8 riparte dal modo normale (prima restava muto);
  - il riavvio dopo Node;
  - le estensioni dei file mostrate;
  - il portatile che non si addormenta;
  - la chiave copiata con tre clic (contiene `-` e `_`);
  - il config già pronto nello zip;
  - il nome «Mini-PC ristorante su …» spiegato;
  - la regola dell'ultimo numero dell'IP;
  - come mandare `ponte.log`;
  - cosa fare se la rete cade.

## Non verificato
- **Sul portatile di Alessio.** I `.cmd` li ho controllati per lettura e per a capo, non con un doppio clic su un Windows pulito.
- **Gli apparecchi veri.** Il percorso FPMate (`/cgi-bin/fpmate.cgi?devid=local_printer`) e le risposte reali si scoprono al collaudo: per questo c'è la riga grezza.
- **L'avviso del firewall per Node.** L'apparecchio finto ascolta solo su 127.0.0.1, quindi non dovrebbe chiedere niente. Non l'ho visto su un Windows nuovo.

## Un incidente, mio
La prova generale girava su Prova mentre partivano le prove di slave dopo l'unione della #269. La mia stampante bar e il mio registratore attivi hanno fatto cadere tre prove di `stampanti.test.js`, sui doppioni (23505). Ho rilanciato solo le prove cadute, a Prova pulita. Da qui in avanti: niente dati a mano su Prova mentre girano i «Controlli».

## Gli apparecchi (confermati da Alessio il 29/10)
- **Al collaudo:**
  - il portatile;
  - l'FP-81 II RT;
  - **una sola** TM;
  - forse un tablet.
- **Nel locale:**
  - il mini-PC;
  - l'FP-81 II RT;
  - **due** TM;
  - un tablet.
- **Dove vanno le due TM non è ancora deciso.** La guida non lo scrive.
- **Con una TM sola** la guida fa provare la stampante su «Cucina» e poi su «Bar». Oggi però la prova di stampa va dritta all'apparecchio scelto, quindi questo controlla solo che l'impostazione si salvi e che la stampante risponda. Che i biglietti vadano a destinazione per reparto si vede col passo delle comande dalla coda.
- **Il giro del tablet** (una comanda che esce dalla TM) Alessio lo vuole **provare al collaudo**. Oggi `lavori_stampa.tipo` ammette solo `prova` e `stato`, quindi il passo 2 della consegna di #266 (le comande dalla coda) va costruito prima. Il piano è stato mandato ad Alessio, e si costruisce dopo il suo sì. La guida ne tiene il posto, al punto 9 di C3.

## Per dopo
- Se il fornitore dà porte diverse da 9100 o da 80/443/8008/8043, si allargano insieme il vincolo `dispositivo_porta_del_protocollo` e `ponte/sicurezza.mjs`: è una migrazione.
- Dopo il collaudo, correggere `ponte/protocolli/` con le risposte vere (`ponte.log` e `lavori_stampa.esito`).
