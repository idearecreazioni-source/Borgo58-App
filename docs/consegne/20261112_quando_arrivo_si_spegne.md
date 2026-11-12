# «Quando arrivo» si spegne (12/11/2026)

Migrazione `20261112000007_quando_arrivo_si_spegne`. Decisione di Alessio del 12/11: i promemoria per luogo (nati il 28/10) si tolgono. Il raggio dei Comandi dell'iPhone è troppo largo, il GPS oscilla e la stessa notifica arrivava più volte.

## Cosa cambia
- **Agenda.**
  - Non c'è più il pulsante «Quando arrivo…» in cima all'elenco.
  - Non c'è più la colonna «Quando arrivo» nell'elenco degli impegni.
  - L'indirizzo `/agenda/luoghi` porta all'Agenda: un vecchio segnalibro non apre una scheda vuota.
- **Scheda dell'impegno.**
  - Non c'è più il gruppo «Ricordamelo quando arrivo» (i due pulsanti «a casa» / «in cantina»).
  - Il salvataggio non nomina più il luogo: un impegno che ce l'ha già **lo tiene così com'è** nel database, anche se lo si apre e lo si salva.
- **Voce.**
  - Le istruzioni di `ascolta-voce` non chiedono più il campo «luogo». «Quando arrivo a casa ricordami di pesare la mamma» diventa un impegno normale, col posto dentro il titolo («Pesare la mamma a casa»), così non si perde.
  - Anche la scheda aperta da un appunto vocale non legge più il luogo.
  - Sugli appunti vecchi che avevano un luogo, la riga dice «luogo: casa» invece di «ricordamelo quando arrivo a: casa».
- **Funzione online `promemoria-luogo`** tolta dal repository, e dall'elenco di quelle installate senza token (`scripts/funzione.mjs`).
- **Database (la migrazione).**
  - Revoca tutte le chiavi del luogo ancora attive (`revocata_il = now()`).
  - Toglie le quattro funzioni: `luogo_promemoria(text,text)` (l'unica aperta ad `anon`), `crea_chiave_luogo(text)`, `revoca_chiave_luogo(uuid)`, `chiavi_luogo_elenco()`.
  - Aggiorna i commenti di `tasks.luogo` e di `chiavi_luogo`, che promettevano ancora la notifica all'arrivo.

## Cosa resta, apposta
- **Nessun dato perso.** La colonna `tasks.luogo` e il vincolo `luogo_chiuso` restano come sono. Gli impegni che hanno un luogo restano impegni normali.
- **`agenda_corsie()` e `completa_task`** non cambiano. La prima restituisce ancora il luogo (la schermata non lo mostra), la seconda lo porta sull'impegno successivo di un ricorrente. Nessuna delle due usava le funzioni tolte.
- **La tabella `chiavi_luogo` resta, come storico** (chi, quante volte, quando revocata). Senza chiavi attive e senza funzioni non apre niente; la RLS resta del solo titolare. Toglierla sarebbe una cancellazione senza guadagno.
- **`TASK_LUOGHI` in `constants.js` resta**, perché è lo specchio del vincolo `luogo_chiuso` nella rete dei vocabolari. Tolta solo la frase «a casa / in cantina» dei pulsanti.
- **`fai_azione_dettata` non è toccata.** Scrive il luogo solo se l'appunto lo contiene; con le istruzioni nuove la voce non lo manda più. Un appunto vecchio già in attesa con un luogo, se approvato, lo scriverebbe ancora: è un dato innocuo, che nessuno mostra.
- **L'indice `idx_tasks_luogo_aperti`** (serviva alla lettura del telefono) resta: costa pochissimo, e toglierlo vorrebbe dire toccare la tabella degli impegni.

## Ordine di rilascio (Prova, poi work)
1. **Il sito e la migrazione**, insieme. Per i Controlli: `prova:migra` prima del giro, perché `tests/app/permessi.test.js` adesso si aspetta 17 funzioni aperte ad `anon` invece di 18.
2. **La funzione online `ascolta-voce`**, per le istruzioni senza il luogo. Finché non si reinstalla, la voce può ancora capire un luogo e scriverlo nella colonna (innocuo, invisibile).

## Da fare a mano
- **Cancellare la funzione online `promemoria-luogo` da Prova e da work**, solo col sì di Alessio:
  - Prova: `npx supabase functions delete promemoria-luogo --project-ref <ref di Prova>`
  - work: `npx supabase functions delete promemoria-luogo --project-ref <ref di work>`
  - Senza le funzioni del database risponderebbe comunque con un errore: cancellarla toglie solo una porta morta.
- **Alessio cancella dall'iPhone** l'automazione «quando arrivo a…» e il comando che chiamava il gestionale. Dopo la migrazione, la chiave che c'è dentro è già revocata.

## Controlli
- **Verifica dentro la migrazione:**
  - le quattro funzioni non ci sono più, con nessuna firma;
  - nessuna chiave del luogo è attiva;
  - `tasks.luogo` e `luogo_chiuso` ci sono;
  - `agenda_corsie()` e `completa_task(uuid)` ci sono;
  - `chiavi_luogo` c'è e `anon` non la legge;
  - nessun residuo.
- **Non ancora provata su Prova.**
- **Prove pure:**
  - `tests/unita/quando-arrivo-spento.test.js`: la migrazione revoca e toglie senza toccare il dato, la porta è chiusa ovunque (funzione online, pagina, voce), i luoghi restano lo specchio del vincolo;
  - `tests/schermate/quando-arrivo-tolto.test.jsx`: niente colonna, niente gruppo nel modulo, un impegno nuovo si salva senza luogo, uno che ce l'ha non lo perde al salvataggio;
  - `tests/schermate/elenco-colonne-di-tutte-le-righe.test.jsx`: la stessa prova di prima, adesso su «In lista da».
- **Prove sul database aggiornate** (girano solo nei Controlli): `permessi.test.js` (17 funzioni aperte ad `anon`) e `orfane.js` (tolta `luogo_promemoria`).
- **Tolte:** `luogo-promemoria.test.js`, `promemoria-luogo-chiavi.test.jsx`, `agenda-luogo-nella-scheda.test.jsx`.

## Applicazione su work
- La migrazione, col sito;
- la funzione online `ascolta-voce`;
- la cancellazione di `promemoria-luogo`, col sì di Alessio.
