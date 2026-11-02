# Restyling «Osteria raffinata», primo passo: il carattere e il tema scuro — 27/10/2026

**HEAD dichiarato sotto questo riepilogo:** il commit che contiene questa riga, sul ramo `claude/restyling-osteria` aperto da `origin/slave` `831bd14`. Tre commit: il lavoro (`269ce97`), il logo al buio, e questo riepilogo aggiornato. Working tree pulito.
**Nessun database e nessuna funzione toccati.** Cambia solo l'aspetto.

## Origine
Il 27/10 Alessio ha scelto, fra tre proposte, la direzione A «Osteria raffinata», con i titoli in **Bricolage Grotesque** al posto di Fraunces: gli sembrava *«troppo antico/elaborato»*. Ha chiesto anche di poter passare dal chiaro allo scuro: *«non mi dispiacerebbe poter swichare tra la modalità chiara a quella con sfondo marrone»*. Confronto: https://claude.ai/artifact/DMBMfCkuTNh3hSXNFqXomP.

## Cosa cambia
- **Titoli in Bricolage Grotesque** (`--font-display`), da Google Fonts, pesi 400-700. Il resto resta in Inter. Il menù stampato resta in Cormorant.
- **Tema scuro, con tre scelte nel piede del menu:** Chiaro, Scuro, Come il telefono.
  - La scelta resta sul dispositivo. Senza scelta resta il chiaro.
  - `public/tema.js` mette il tema prima che la pagina si disegna, quindi non c'è il lampo bianco. È un file perché la CSP ammette solo script da `'self'`.
- **Un colore, una cosa sola.** Una sostituzione automatica su 134 file separa i colori che facevano due mestieri:
  - `bg-white` → `bg-b58-campo` (297);
  - testo chiaro sui pulsanti → `text-b58-sul-colore` (224);
  - fondi scuri pieni → `bg-b58-inverso` (49);
  - colori usati come scritta → `…-testo` (624);
  - veli dietro le finestre → `bg-b58-velo` (4).
  - **Di giorno ogni nome nuovo vale esattamente il colore di prima.**
- **Solo a schermo.** La carta esce chiara sempre, con le regole di stampa intatte.
- **Restano chiare** (`.tema-chiaro`) la pianta della sala, la sua legenda, il foglio della carta e il preconto. I colori dei tavoli sono misurati sul chiaro e scelti da Alessio.
- **Prove visive:** il carattere locale è ora Bricolage (TTF variabile ufficiale, `tests/visive/caratteri/`, licenza OFL), al posto di Fraunces.

## Verificato
- **Prove visive:** 48 misure su 48, col carattere nuovo.
- **Prove di schermata:** 448 verdi.
- **Prove pure:** verdi, salvo le 3 già note per gli a capo CRLF. Una quarta rossa passa da sola (`investimento`). Nuova: `tema` (5).
- **Compilazione:** va. `tema.js` arriva in `dist/`. `npx oxlint` pulito sui file nuovi.
- **A occhio, al buio:** Dashboard, Prima nota, Spesa spicciola, Archivio e Agenda, dalle pagine delle prove visive.
- **Revisione `ecc:code-reviewer`:** approva. Nessuna classe costruita al volo è sfuggita, nessun testo chiaro su fondo chiaro, la stampa non cambia, di giorno nessun colore cambia.
- **Revisione `ecc:a11y-architect`, contrasti calcolati:** al buio i testi principali stanno fra 8 e 15:1. Corretti i tre punti che peggioravano al buio:
  - il pulsante oro della sala;
  - un nome in Scadenze;
  - il grigio chiaro di Tailwind.

## Trovato sull'anteprima
- Al buio la scritta «Borgo» del logo, scura, quasi spariva. Ora il logo sta su una targhetta color panna, solo al buio.

## Non verificato
- **Il gestionale vero al buio dopo l'accesso:** tutte le altre schermate, le finestre, la sala sul tablet. Serve l'anteprima.
- **La barra del browser sul telefono:** resta verde anche al buio (`theme-color`), dettaglio estetico.

## Rimasto com'era, segnalato dalla revisione (non nato da questo lavoro)
- **Pillole col testo chiaro su fondo oro** (2,55:1), uguali anche di giorno. Esempi: Dashboard:396, PiantaGiornata.
- **Testi attenuati a `/60`, `/50`, `/30`:** sotto 4,5:1, già oggi di giorno.
- **Bordi dei campi `border-stone-300`:** 1,5:1, già oggi di giorno.
- Sono la parte «contrasti» del lavoro di accessibilità ancora da fare.

## Decisione che spetta ad Alessio
- Guardare l'anteprima e dire se il carattere e il tema scuro vanno bene, prima di unire.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Avevo detto ad Alessio che il file del carattere pesava 100-200 kB: quello ufficiale variabile pesa 408 kB. Gliel'ho detto prima di scaricarlo.

## Cosa abbiamo rovesciato
- Fraunces come carattere dei titoli, scelto all'inizio del progetto. Ora è Bricolage Grotesque, per scelta di Alessio.
