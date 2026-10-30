# Lo schermo di ogni apparecchio — 29/10/2026, notte

Questa consegna esegue il mandato [lo schermo di ogni apparecchio](../mandati/20261029_lo_schermo_di_ogni_apparecchio.md), sulle decisioni di Alessio del 28/10: *«preferirei delle scritte più piccole e pulite […] su pc praticamente. Su iphone invece sono perfette»*. Il lavoro l'ho fatto nella sessione principale: la sessione notturna non si poteva aprire da remoto.

**La proposta resta NON unita**: la unisce Alessio, dopo aver guardato [l'anteprima](https://claude.ai/artifact/KeWEUAjQHCgjgGQCeP1RxM).

## Cosa c'è
- **`src/lib/schermo.js`**: il profilo dell'apparecchio (Telefono, Mini tablet, Tablet o Computer), salvato in `localStorage` (`b58-schermo`) e messo su `<html>` come `data-schermo`. La forma è la stessa di `tema.js`.
  - **La prima volta lo propone il gestionale:**
    - puntatore fine e **schermo** da almeno 1024 punti: computer;
    - sotto i 768 punti: telefono;
    - tutto il resto: tablet.
  - La proposta non si salva: la scelta salvata è solo quella di Alessio.
- **`src/main.jsx`**: il profilo si applica prima del primo disegno, ma **solo nel gestionale**. Le pagine dei clienti (`/prenota`, `/privacy`) restano come sono.
- **`src/components/Sidebar.jsx`**: «Questo apparecchio», nel piede del menu sotto «Aspetto», con quattro pulsanti.
- **`src/index.css`**: il blocco «IL COMPUTER È PIÙ DENSO». Vale **solo** sotto `[data-schermo="computer"]`, **solo** in `@media screen`, e **solo** dentro `main.contenuto-ampio` e il menu.
  - Testo di base e `.testo-sala-grande` passano da 15,1 a 14 punti, `.testo-sala-titolo` da 18,1 a 17.
  - L'altezza minima di riga, azione e scelta scende da 40, 45 e 44 punti a 32.
  - Nelle celle delle tabelle lo spazio sopra e sotto scende da 12 a 6 punti.
  - `.testo-sala` resta a 12,1 e `.tocco-bottone` a 32.
- **Banco delle schermate:**
  - mette il profilo secondo la larghezza della finestra di prova;
  - `?schermo=…` lo forza;
  - un'ora fissa nei dati finti di «Stampanti», così le foto si confrontano byte per byte.

## Numeri, misurati
- **Telefono e tablet identici:** 36 foto su 36 identiche byte per byte, prima e dopo. Sono nove schermate a 360, 390, 430 e 768 punti, rifatte dopo le correzioni delle revisioni.
- **Computer, a 1280 punti, altezza della pagina:**

  | schermata | prima | dopo | differenza |
  |---|---|---|---|
  | Agenda | 1213 | 998 | −18% |
  | Prima nota | 1530 | 1336 | −13% |
  | Dashboard | 854 | 800 | −6% |
  | Stampanti | 899 | 854 | −5% |
  | Sala e orari | | | −2% |
  | Ingrediente | | | −1% |
  | Archivio, Causali, Spesa | | | 0% (già entro uno schermo) |

  Una riga dell'Agenda passa da circa 70 a circa 45 punti.
- **La variante «più compatto»** (tutto al 90%) è stata fotografata e non costruita. Dà −26% sull'Agenda e −21% sulla Prima nota. Fa scendere le scritte piccole a 11 punti, e un controllo della prova visiva non passa più: un documento in scadenza diventa alto 7,6 mm a 1920 punti.
- **Prove:**
  - prova visiva: 54 misure su 54;
  - `npm run test:schermate`: 474 passate;
  - `tests/unita/schermo.test.js`: 7 passate;
  - `npm run lint -- --max-warnings=0`: pulito;
  - peso del gestionale: 443,88 kB su 450.
- **`npm run test`:** sono rosse le solite 3, dovute agli a-capo di Windows della copia locale (`bozze-col-lordo`, `indirizzo-funzioni-vault`). Le altre passano.

## Revisione ECC
- **ecc:frontend-design-direction:** era la direzione del mandato. Densità solo dove pesa (righe, celle, testo principale), il testo piccolo non scende sotto 12 punti, nessuna disposizione nuova.
- **ecc:a11y-architect:** nessun blocco per WCAG 2.2 AA. Il bersaglio più piccolo è 32 punti, contro un minimo di 24. Applicato: `useId` per l'etichetta del gruppo, perché il menu è montato due volte. Consigliato di non scendere sotto i 12 punti, ed è uno dei motivi per cui il «più compatto» non è la proposta.
- **ecc:react-reviewer:** nessun blocco. Applicato:
  - la prima lettura del profilo mette anche l'attributo sulla pagina;
  - «è un computer?» guarda lo schermo e non la finestra, così il profilo non cambia fra una visita e l'altra;
  - `beforeEach` che pulisce `localStorage` nelle prove.

## Non verificato
- **Sul computer vero di Alessio.** Se lì le schermate restano grandi, la causa probabile è il ridimensionamento di Windows (125% o 150%): l'anteprima glielo chiede.
- **Il passaggio da una pagina dei clienti al gestionale senza ricaricare.** Le due pagine sono due caricamenti separati (`src/main.jsx` carica `Pubblico.jsx` oppure `App.jsx`), quindi il caso non dovrebbe esistere. Comunque la prima lettura del profilo ora mette l'attributo da sé.
- **La stampa:** non l'ho misurata stampando. Il profilo sta tutto dentro `@media screen`, quindi la stampa non lo vede per costruzione, e lo controlla `tests/unita/schermo.test.js`.

## Dato per fatto senza misurarlo
- Che «Mini tablet» sia il nome giusto per l'apparecchio di sala di Alessio. Stanotte mini tablet e tablet hanno le stesse misure.

## Per dopo
- **La disposizione:** col profilo Computer, mostrare la tabella anche quando la finestra è stretta. Oggi decidono i `md:` e gli `xl:` di `ElencoAdattivo`.
- **Mini tablet:** se va distinto dal tablet, con quali misure.
- **Le schermate ancora larghe al computer**, dove pesano gli spazi delle schede (`p-4`, `p-6`) più che le righe.

## Affermazioni diventate false durante il lavoro
- Il mandato diceva «la causa probabile è che le misure pensate per il dito valgono anche col mouse». **Vale per le righe, non per le scritte.** `.testo-sala`, la classe più usata, era già a 12,1 punti sul computer. Le scritte grandi erano poche (14–18 punti), e quindi molte schermate cambiano poco.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata. Il pavimento dei 16 punti dei campi resta solo sul telefono, com'era.
