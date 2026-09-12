# Il censimento delle schermate, ripetibile — proposta tecnica, 12/09/2026

Mandato esteso del 12/09, priorità 4. **È una proposta, non uno strumento
committato**, e il perché sta nel §5: lo strumento buono ha bisogno del pilota
di Chrome che introduce la PR #57, e di file che la #57 e la #59 stanno
cambiando. Farne una copia adesso vorrebbe dire due piloti di Chrome, cioè il
difetto che quel file dichiara di chiudere («due copie dello stesso pilota
divergono alla prima correzione»).

La proposta però **non è teorica**: il metodo del §3 è quello con cui sono
state controllate, questa notte, le correzioni delle PR #67 e #69 — 28 viste
in quattro forme — e ha trovato un difetto vero prima del commit (§4).

---

## 1. Cosa c'è oggi

| Strumento | Dove | Cosa fa | Limite |
|---|---|---|---|
| `scripts/prova-visiva.mjs` | master (la #57 e la #59 lo cambiano) | Monta le **vere** schermate dell'Agenda con letture finte scritte a mano (`tests/visive/finti/`), in Chrome senza schermo, a telefono, telefono a 64 punti per cm e computer; misure proprie dell'Agenda | Solo Agenda; le letture finte si scrivono una funzione per volta |
| `scripts/chrome-senza-schermo.mjs` | PR #57 | Il pilota di Chrome comune: `avviaChrome`, `apriScheda`, `apriPagina`, `valuta`, `fotografa`, `nomeFile` | — |
| `scripts/misura-telefono.mjs` + `misura-telefono-rotte.mjs` | PR #57 | Apre il **vero** gestionale collegato al progetto di prova, entrato come titolare di collaudo, e misura le rotte dell'elenco: pagina che scorre, campi fuori, caselle strette, sovrapposizioni, etichette staccate | Ha bisogno delle credenziali e del database; i dati cambiano da una sera all'altra; le scritture si evitano **scegliendo** le rotte, non impedendole |
| Il censimento del mandato notturno 2 | mai committato | Stesso gestionale vero, ma con le scritture **fermate nel browser** (protocollo di Chrome) e l'elenco delle funzioni che scrivono ricavato dal database | Stesso bisogno di database e credenziali |

I falsi allarmi già visti (referto `20260911_censimento_delle_schermate.md`):
- elementi tagliati dentro un riquadro che scorre, contati come sovrapposti;
- il margine negativo di `tocco-testo`, contato come sovrapposizione;
- barre fisse in basso, contate sopra altri controlli;
- una prova che aspettava un testo in minuscolo mentre la schermata lo
  mostra in maiuscolo (`text-transform`: il testo visibile cambia) — trovato
  questa notte.

## 2. Cosa deve poter fare un censimento ripetibile

1. **Girare senza database e senza credenziali**, così può girare in ogni
   PR su GitHub: niente sessioni, niente scritture, niente dati che cambiano.
2. **Dare lo stesso risultato due volte di fila** sullo stesso codice.
3. **Diventare rosso da solo** su un difetto visivo nuovo, invece di
   aspettare un collaudo.
4. **Dire quando non ha misurato**: una schermata che non si è aperta, o che
   ha chiesto un dato che nessuno le ha preparato, non è «verde».

## 3. Il metodo proposto: le vere schermate, con le letture finte generate

### 3.1 Le letture finte, senza scriverle a mano

Un plugin di Vite sostituisce **ogni** funzione esportata da
`src/lib/api/*.js` con una chiamata a `window.__finto(modulo, nome, argomenti)`,
e lascia passare tutto il resto del modulo (le costanti restano quelle vere):

```js
// dentro il plugin, per un file src/lib/api/<modulo>.js
const nomi = new Set([
  ...[...src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((x) => x[1]),
  ...[...src.matchAll(/export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/g)].map((x) => x[1]),
]);
return `export * from ${JSON.stringify(percorso + "?reale")};\n` +
  [...nomi].map((n) =>
    `export const ${n} = (...a) => window.__finto(${JSON.stringify(modulo)}, ${JSON.stringify(n)}, a);`
  ).join("\n");
```

- ⚠️ In un modulo ES un'esportazione **locale** vince su `export *`: per questo
  le funzioni finte sostituiscono quelle vere senza conflitto.
- `src/lib/supabase.js` diventa un oggetto che risponde a tutto e **registra**
  ogni chiamata: una schermata che parla col database senza passare da
  `src/lib/api` si vede.
- `src/context/AuthContext.jsx` diventa un `useAuth` finto, con il ruolo
  scelto dal caso: titolare **e staff**. Il censimento del 11/09 era entrato
  solo come titolare.
- Le risposte stanno in un file per schermata
  (`tests/visive/finti/<schermata>.js`), con **tre varianti** obbligatorie:
  - **piena**, coi nomi più lunghi plausibili;
  - **vuota**;
  - **non letta**, cioè la lettura principale fallisce: è la regola «non vuol
    dire che è vuota» del 19/08, e deve comparire `DatoNonLetto`.

### 3.2 Le viste

- **Forme**: iPhone 390, iPhone largo 440, caratteri grandi (390 a 64 punti
  per cm) e computer 1280.
- **Schermate, primo giro**, le venti che si usano di più:
  - Dashboard, Agenda (elenco e settimana), scheda impegno;
  - Comande: sala, bar, cucina;
  - Calendario e pianta, scheda prenotazione, modulo pubblico;
  - Prima nota, Magazzino, Lista della spesa;
  - scheda ricetta, scheda menu, Editor menu;
  - Temperature HACCP, Mance, Sala e orari, Previsione, MEMO voce.
- Poi le altre, una cartella di dati finti per volta.
- **Stima**: questa notte 28 viste hanno richiesto circa 2 minuti su questo
  computer, quindi 20 schermate × 4 forme × 3 varianti (240 viste) sono circa
  15-20 minuti. Per GitHub conviene un lavoro a sé, che non blocca gli altri.

### 3.3 Cosa rende la prova rossa

| Difetto | Soglia | Rosso? |
|---|---|---|
| La pagina scorre di lato | `scrollWidth` oltre la finestra di più di 1 punto | **sì** |
| Un controllo esce dallo schermo | bordo oltre la finestra di più di 0,5 punti | **sì** |
| Due bersagli di tocco diversi si sovrappongono | più di 2 punti in tutte e due le direzioni, e nessuno dei due contiene l'altro | **sì** — un dito fra i due apre la cosa sbagliata |
| Scritta tagliata in un pulsante | `scrollWidth` oltre `clientWidth` di più di 1 punto | **sì** |
| Testo sotto 3,20 mm | la soglia del progetto (25/08) | **sì** |
| Bersaglio sotto 5,3 mm | la misura fatta con le mani il 18/08 | **sì** |
| Bersaglio fra 5,3 e 8,5 mm | la convenzione del brief | segnalazione, non rosso |
| Un errore in console o un'eccezione | — | **sì** |
| Una lettura chiesta e non preparata nei dati finti | — | **sì**: la vista non è stata misurata davvero |
| Una chiamata dritta al database | — | **sì**: una lettura fuori dal punto unico |
| Nella variante «non letta» non compare `DatoNonLetto` | — | **sì** |

Come si tolgono i falsi allarmi già noti:
- un elemento si misura solo nella sua **parte visibile**, cioè il
  rettangolo tagliato dai contenitori che scorrono o nascondono;
- per le aree di tocco si usa il riquadro del bersaglio **senza** il
  margine negativo di `tocco-testo`;
- le barre fisse si misurano contro la finestra, una volta sola;
- si aspetta sempre il testo **in minuscolo**, perché lo stile può cambiare
  le maiuscole del testo visibile.

## 4. Cosa ha già trovato, questa notte

Con il metodo del §3 (letture finte generate, quattro forme, fotografie),
sulle correzioni di questa notte:

| PR | Viste | Esito |
|---|---|---|
| #67 (allergeni nell'Editor menu) | 12 | 0 difetti |
| #69 (finger food), primo giro | 16 | **3 sovrapposizioni** a 390, 440 e caratteri grandi: nell'avviso della scheda menu due nomi-collegamento su righe vicine avevano aree di tocco che si toccavano. Guardando la fotografia non si vedeva niente: l'ha trovato la misura |
| #69, dopo la correzione | 16 | 0 difetti |

E un falso allarme **della prova stessa**: al primo giro tutte le viste
risultavano «non pronte» perché la prova cercava «Cosa lascio fuori» e la
schermata lo scrive in maiuscolo. Da qui la regola dell'ultima riga del §3.3.

## 5. Perché non è una PR adesso, e come si applica dopo

**Il conflitto non è di righe, è di pezzi**:
- il pilota di Chrome è `scripts/chrome-senza-schermo.mjs`, che nasce con la
  #57: una seconda copia sarebbe il difetto che quel file dichiara di
  chiudere;
- le pagine finte dell'Agenda (`tests/visive/finti/`) e `prova-visiva.mjs`
  li cambiano la #57 e la #59;
- il comando si aggiunge in `package.json`, che la #57 tocca.

**Dopo l'unione della #57 e della #59**, in una PR sola:
1. `scripts/censimento-finto.mjs`: il plugin del §3.1, le forme e le soglie
   del §3.3, e il pilota **importato** da `chrome-senza-schermo.mjs`
   (`avviaChrome`, `apriPagina`, `valuta`, `fotografa`). Nessuna copia.
2. `tests/visive/censimento/`: una pagina che monta la schermata scelta
   dall'indirizzo (`?pagina=…&caso=…`) con `MemoryRouter`, gli stessi fogli
   di stile e `applyPxCm()`.
3. `tests/visive/finti/<schermata>.js`: i dati finti, cominciando dalle venti
   schermate del §3.2.
4. `package.json`: `"test:censimento": "node scripts/censimento-finto.mjs"`.
5. In `.github/workflows/controlli.yml`, un lavoro a sé che lancia
   `npm run test:censimento` su Chrome: senza segreti e senza database.
6. `docs/CI.md`: una riga per Alessio su cosa vuol dire quando è rosso.

La versione di questa notte (plugin, forme, misure, fotografie, un file
solo) è nella cartella locale `_visiva-locale/` delle copie di lavoro di
questo mandato. **Non è committata, apposta**: diventa il punto 1 qui sopra,
importando il pilota invece di ricopiarlo.

## 6. Cosa resta fuori anche così

- **È Chrome, non Safari**: le caselle di data e ora sull'iPhone restano
  una cosa da guardare con gli occhi.
- **I dati finti possono mentire**: una schermata verde coi dati finti può
  rompersi coi dati veri, se i dati veri hanno una forma che nessuno ha
  preparato. Il censimento sul progetto di prova della #57 resta utile, a
  mano e ogni tanto.
- **Non guarda i colori**: se una cosa si distingue con la luce del locale
  lo dice un occhio.
