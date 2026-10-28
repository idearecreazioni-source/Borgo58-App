# Lo schermo di ogni apparecchio — mandato per la notte del 29/10/2026

**Decisioni di Alessio del 28/10/2026, sera.** Sono arrivate dalla sessione madre con le sue parole:

> «i task sono molto grandi e non mi piace, preferirei delle scritte più piccole e pulite e questa cosa vale per tutte le schermate del gestionale su pc praticamente. Su iphone invece sono perfette ed è partendo da questo che ho chiesto questa personalizzazione»

E sui consigli che gli sono stati dati: *«accetto i tuoi consigli»*.

---

## Le decisioni, già prese (non si rimettono in discussione)

1. **Una scelta sola per apparecchio**: Telefono, Mini tablet, Tablet o Computer. Si fa una volta e quell'apparecchio la ricorda.
2. **La scelta cambia sia le misure (testi, tasti, righe) sia la disposizione.**
   - Il tablet della sala apre le Comande con i tasti grandi.
   - Il computer mostra le tabelle complete e più dense.
   - Il telefono resta com'è.
3. **La priorità è il computer:** testi più piccoli e puliti in tutte le schermate. Il suo esempio è l'Agenda, dove righe e scritte sono troppo grandi.
4. 🔴 **Il telefono non si tocca.** Su iPhone «sono perfette».
5. **Prima di costruire, un'anteprima**, come per il restyling. Alessio guarda il computer più denso e decide; senza il suo sì niente arriva su slave.

---

## 🔴 Prima la misura: perché il computer è grande

Questo l'ho letto nel codice di slave il 29/10. Va verificato misurando, non preso per buono.

| cosa | dove | quanto vale | sul computer (`--pxcm` 37,8) |
|---|---|---|---|
| testo del corpo | `src/index.css` riga ~224 | `--pxcm × 0,4` | 15,1 punti |
| `.testo-sala` (quasi tutte le schermate) | `src/index.css` riga ~531 | `--pxcm × 0,32` | 12,1 punti |
| `.testo-sala-titolo` | riga ~604 | `--pxcm × 0,48` | 18,1 punti |
| `.tocco-riga` (ogni riga toccabile, l'Agenda) | riga ~331 | almeno `--pxcm × 1,05` | **39,7 punti di altezza** per riga |
| `.tocco-bottone` | riga ~336 | almeno `--pxcm × 0,85` | 32 punti |
| il campo (pavimento) | riga ~327 | `max(44px, --pxcm × 1,05)` | 44 punti |

- **`--pxcm`** dice quanti punti fa un centimetro vero sullo schermo. Vale 37,8 di partenza (`PXCM_DEFAULT` in `src/lib/touch.js`). La calibrazione col righello (`CalibrazioneTocco.jsx`, in Sala) lo salva **per apparecchio** in `localStorage` (`b58_pxcm`).
- 🔴 **La causa probabile è che le misure pensate per il dito valgono anche col mouse.** Sul computer una riga dell'Agenda è alta come un dito, cioè un centimetro vero, mentre col mouse ne basterebbe la metà.
- ⚠️ **C'è già un precedente:** il pavimento dei 16 punti dei campi vale solo sotto 767 punti (`@media (max-width: 767px)`, riga ~630), perché *«sul computer non si applica affatto»*. Il ragionamento è lo stesso, ma lì era una soglia di larghezza: stanotte diventa una scelta dell'apparecchio.
- ⚠️ **In stampa non deve muoversi niente.** Il blocco `@media print` in fondo a `index.css` rifissa le taglie in punti, e va lasciato vincere.

---

## Cosa fare stanotte, in due fasi

### Fase A — l'anteprima (obbligatoria, prima di tutto il resto)
1. Prendi le schermate che Alessio usa di più al computer: **Agenda** (il suo esempio), **Dashboard**, **Prima nota**, **Ricettario → ingredienti** e una tabella lunga a piacere (Magazzino o Fatture).
2. Fotografale a **1280 e 1920 punti**, **com'è oggi** e **com'è col profilo Computer**.
   - Usa il banco delle schermate finte (`tests/visive/schermate/`, `scripts/prova-visiva-schermate.mjs`) e aggiungi le pagine che mancano.
   - La regola di sempre: i dati finti scelti per i casi difficili, cioè titoli lunghi e molte righe.
3. Fai la stessa foto anche **a 390 punti col profilo Telefono**, per dimostrare che il telefono è identico a prima.
4. **Pubblica il confronto come pagina da guardare (Artifact)**, come per il restyling, con «prima / dopo» affiancati e le misure scritte sotto, per esempio «riga Agenda: 39,7 → 28 punti».
   - Se ti sembrano utili, proponi due densità: «compatto» e «molto compatto».
   - Ne raccomandi una sola, con la ragione.

### Fase B — la costruzione (su un ramo, NON unito)
**Disegno consigliato.** Se trovi qualcosa di meglio, cambialo e scrivi perché.

- **Il profilo dell'apparecchio**: `data-schermo="telefono|mini_tablet|tablet|computer"` su `<html>`, salvato in `localStorage` (`b58_schermo`), con lettura e scrittura in `try/catch`.
  - **Il primo valore lo propone il gestionale da sé:**
    - puntatore fine (`(pointer: fine)`) e larghezza da 1024 in su: **computer**;
    - puntatore grossolano: **telefono** sotto 768, **tablet** sopra.
  - **Alessio lo può cambiare** con una scelta visibile ma discreta, per esempio in fondo alla barra laterale: «Questo apparecchio: Computer». Il nome «Mini tablet» deve corrispondere a quello che lui ha in sala.
  - Sta in un posto solo, accanto a `touch.js` (per esempio `src/lib/schermo.js`), e si applica prima del primo disegno come `applyPxCm()`, così la pagina non salta.
- **Le misure del profilo Computer**: un insieme di variabili CSS, non classi riscritte una per una.
  - Per esempio `--alto-riga`, `--alto-bottone`, `--testo-corpo`, `--testo-sala`, ridefinite sotto `[data-schermo="computer"]`.
  - Le classi `.tocco-riga`, `.tocco-bottone`, `.testo-sala`, `.testo-sala-titolo` e il testo del corpo le leggono.
  - Sul computer le misure sono in **punti fissi**, non in centimetri: col mouse il centimetro vero non serve.
- **Il profilo Telefono non cambia niente.** Le variabili valgono di partenza esattamente le formule di oggi.
- **Tablet e mini tablet:**
  - stanotte non cambiano le misure, perché sono quelle calibrate per la sala e per le Comande;
  - la calibrazione col righello resta com'è e vale per quell'apparecchio.
- **La disposizione:**
  - dove esiste già una doppia forma (schede sul telefono e tabella sul computer, scelte oggi con un `md:`/`lg:`), il profilo Computer deve dare la tabella anche quando la finestra è stretta;
  - non inventare disposizioni nuove stanotte: elencale come seguito.
- 🔴 **Le Comande restano fuori dal profilo Computer** (la classe `contenuto-ampio` le esclude già dal telaio desktop). Sono calibrate sul tablet di sala.

---

## Le regole (valgono tutte, senza eccezioni)

- **Il telefono è intatto.**
  - Prova visiva a 360, 390 e 430 col profilo Telefono: le stesse misure di prima su tutte le schermate del banco.
  - Se una misura del telefono cambia anche di un punto, è un difetto da correggere, non da dichiarare.
- **La stampa è intatta.** Misura un documento stampabile prima e dopo, alle due larghezze, come già fa il commento di `index.css`.
- **Le soglie del progetto valgono anche sul computer:**
  - nessun testo sotto i minimi dichiarati in `index.css` e in `tests/visive/`;
  - i bersagli del mouse non sotto i 24 punti (WCAG 2.2, criterio 2.5.8);
  - i contrasti invariati.
- **Nessuna migrazione e nessuna funzione online.** È tutto nel sito.
- **Sul ramo, mai su `master`.** Si apre una proposta verso `slave` e **non si unisce**: la unisce Alessio dopo l'anteprima. La produzione non si tocca.
- **Il peso del pacchetto resta sotto il tetto:** `node scripts/peso-pacchetto.mjs`, oggi 443 kB su 450.
- **Sempre ECC, e si dice quale:**
  - **ecc:frontend-design-direction** per la direzione della densità;
  - **ecc:a11y-architect** sulle misure del computer;
  - **ecc:react-reviewer** e **ecc:code-reviewer** sul codice.
  - Si applicano i rilievi, oppure si scrive perché no.
- **Le prove:**
  - `npm run test`, `npm run test:schermate` (non `npx vitest`), `npm run lint -- --max-warnings=0`, e la prova visiva estesa alle pagine nuove;
  - le reti esistenti non si spengono.
- **Il riepilogo** va in `docs/consegne/20261029_lo_schermo_di_ogni_apparecchio.md`, con la forma solita: numeri misurati, non verificato, dato per fatto, affermazioni diventate false, cosa abbiamo rovesciato.
- **Si scrive ad Alessio in italiano, sempre**, semplice, guidandolo verso una scelta.
- **Mai il PIN di Alessio**; `.env` mai nei commit; nessun cambio di ramo nella cartella principale `Borgo58-App`; si lavora in una cartella di lavoro a parte.

---

## Cosa trova Alessio al mattino
1. **La pagina dell'anteprima**, con un consiglio solo e una domanda sola («Va bene questa densità?»).
2. **La proposta su GitHub con la costruzione**, con i controlli verdi e **non unita**.
3. **Cosa resta per dopo:**
   - le disposizioni nuove;
   - il mini tablet, se va distinto dal tablet;
   - le schermate che col profilo Computer stanno ancora larghe.
