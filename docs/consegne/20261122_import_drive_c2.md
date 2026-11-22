# L'import dal Drive, pezzo C2: la pagina (22/11/2026)

Seguito di C1 (`20261122_import_drive_c1.md`, database già in slave). Questo pezzo è **solo la pagina**: nessuna migrazione, nessuna funzione online nuova. Su work serve soltanto il sito (dopo C1: migrazione, funzioni, poi «Approve and deploy»).

## Cosa fa `/documenti/importa` (solo titolare; bottone «Importa dal Drive» nell'Archivio)
1. **Prima la mappa.** Alessio sceglie il file CSV (colonne `caricare, nome, cartella, formato, MB, data, tipo, sezione, sensibile, no_AI, link`; virgola, virgolette doppie, UTF-8 con BOM). Si legge nel browser: **non viene caricato da nessuna parte**. Un file che non ha le colonne essenziali è respinto dicendo quali mancano.
2. **Poi i file** (selezione multipla o cartella). La mappa comanda:
   - il nome deve combaciare (maiuscole, apostrofi e trattini tipografici, «è» scritta in due pezzi: uguali; gli accenti NON si tolgono) con una riga **«sì»**;
   - un file **sconosciuto** o su una riga **«no (solo elenco)»** è **rifiutato**, in un riquadro «Rifiutati» con il motivo; non si importa e non si tocca;
   - due righe con lo stesso nome: si distingue dal nome di una cartella del percorso se possibile (la cartella del Drive e quella sul computer NON si confrontano, hanno nomi diversi), altrimenti la pagina **chiede quale riga** e senza risposta non importa.
3. **Anteprima a schede** (una per file, non una tabella: sul telefono una tabella a sei colonne scorre di lato e il controllo `larghezza.test.js` la rifiuta): titolo (dal nome senza estensione, modificabile), sezione (dalla colonna «sezione» del CSV, riconosciuta per codice o etichetta fra le sezioni attive; se non esiste → errore a parole e menù per sceglierla, **non si indovina**), data (da «gg/mm/aaaa (nome)» è sicura; da «(modifica)» è l'ultima modifica del file → **«da verificare»** ma importabile; vuota → la riga non entra finché non si scrive), nota «riservato» dal CSV (solo informativa), casella **«Non far leggere all'AI» SPENTA per tutti** (decisione scritta di Alessio del 22/11: anche i 9 che il CSV segnava no_AI; resta modificabile riga per riga), segnale **doppione** (SHA-256 calcolato nel browser, confrontato con `documents.impronta_sha256` e con gli altri file scelti; un doppione parte **non spuntato**). Una riga con un problema non si può spuntare.
4. **«Importa N documenti»**: apre UN lotto (`lotti_import`), poi per ogni riga: file nel deposito, poi la riga in `documents` con `doc_type`, `document_date`, `title`, `lotto_import_id`, `impronta_sha256`, `sensibile`, `no_ai`. Se la riga non si scrive il file appena caricato si toglie. **Un file che fallisce non ferma gli altri**: l'esito dice chi è entrato e chi no (e perché); i falliti restano in anteprima per riprovare. Se il lotto non si apre non si importa niente.
5. **Annulla questo carico** (con conferma): `annullaLottoImport` di C1 (controllo prima, poi file, poi database).
6. **Elenco del Drive**: dalla stessa mappa, le righe «no (solo elenco)» si scrivono in `elenco_drive` (`no_ai` spento). Prima si vede il **conteggio** (da aggiungere / già presenti / senza un link https valido), poi «Carica N file nell'elenco». Un link già presente non si duplica (indice unico + `ignoreDuplicates`).
   **Scelta fatta:** le righe «sì», che entrano in Archivio come documenti, **NON** vanno nell'elenco (la via più semplice: sono già nel gestionale e MEMO le trova lì; `importato_documento_id` resta per un eventuale uso futuro).
7. **Scheda del documento** (`DocumentoDetail`): interruttore **«Non far leggere questo documento all'AI»**, solo titolare, si salva **subito** (non aspetta «Salva modifiche»), dice cosa significa acceso/spento, e con l'interruttore acceso nasconde «Leggi il contenuto». Mostra anche la nota «riservato».

## 🔴 Nessun file passa da un modello
Niente `documento-leggi`, niente `assistente-archivio`, niente `memo-chat`, niente chiamate a funzioni AI: l'import salva scheda e file e basta. Il contenuto si legge dopo, solo se Alessio lo chiede dalla scheda (e solo se non è bloccato). Lo garantisce `tests/unita/import-drive-c2.test.js` (cerca quei nomi nei sorgenti dell'import).

## Prove
- `tests/unita/import-drive-c2.test.js`: CSV (virgole fra virgolette, BOM, righe a capo), nomi (NFC, apostrofi, «—», accenti), date, sezione, abbinamento (sconosciuto, solo elenco, ambiguo), anteprima e problemi, doppioni, elenco, SHA-256 vero, nessun modello.
- `tests/schermate/importa-dal-drive.test.jsx` (17 prove, file e mappa inventati): vedi sopra, passo per passo.
- `tests/schermate/documento-no-ai.test.jsx`: l'interruttore della scheda.
- `tests/app/import-drive-c2.test.js` (contro Prova): documento con impronta/nota/no_ai e ricerca per impronta, il database rifiuta sezione senza data e impronta storta, elenco senza doppioni, il personale non vede l'elenco né apre lotti. **Niente lotto vero**: un lotto non si cancella e ne lascerebbe uno a ogni giro; aprirlo e annullarlo è provato dalla verifica interna di C1.

## Cosa NON è verificato
- La pagina non è stata provata in un browser vero con file veri: solo con prove di schermata (jsdom) e file inventati.
- Un import completo con un lotto vero su Prova non è stato fatto (vedi sopra).
- La cartella scelta con `webkitdirectory` non è stata provata in un browser vero (Chrome la supporta).
- L'ordine di grandezza: ~27 file, 23 MB; la pagina li calcola e li carica uno alla volta. Non è stato provato con molti file grandi.

## Su work (dopo C1), ognuno col sì scritto di Alessio
1. Rilascio di C1 (copia di sicurezza, migrazione `20261122000001`, 4 funzioni, «Approve and deploy») — il sito con questa pagina esce con lo stesso «Approve and deploy».
2. Primo giro: **3 file non riservati** scelti insieme, guardare l'anteprima e l'Archivio, provare «Annulla questo carico» su un carico di prova solo se Alessio lo vuole; poi gli altri.
3. «Carica l'elenco del Drive» dalla stessa mappa (136 righe «solo elenco»): prima il conteggio, poi il caricamento.

## Dopo la revisione React del 22/11 (cosa è cambiato nella pagina)
- **Il riepilogo di un carico non sparisce**: sta in uno stato a parte («Ultimo carico — com'è andata»), cambiare mappa o scegliere altri file non lo tocca, e «Annulla questo carico» resta raggiungibile. Si chiude solo con «Chiudi questo riepilogo». Un errore dell'annullamento compare dentro il riquadro del carico.
- **Un gesto alla volta**: mentre si importa, si annulla o si scrive l'elenco, tutti i campi sono bloccati (`fieldset`), i bottoni mostrano «Importo X di N…», un secondo clic non parte (`inVolo`) e chiudere o ricaricare la scheda fa chiedere conferma al browser (`beforeunload`).
- **Doppioni**: calcolati con un messaggio «Controllo il file X di N»; un file che non si legge lo dice sulla sua riga («il controllo dei doppioni non è valido per questo file»); togliere un file rifà i segni; quello appena entrato conta come «già in Archivio» per i file uguali rimasti. Le correzioni di Alessio non vengono sovrascritte a fine calcolo.
- **Mai in silenzio**: «N file erano già stati scelti e li ho ignorati»; la chiave di un file comprende il percorso (due cartelle con lo stesso nome file non si confondono); una mappa nuova che non si legge **non butta via quella buona**; virgoletta aperta, punto e virgola al posto della virgola, celle oltre 1000 caratteri e file oltre 2 MB sono errori detti a parole.
- **File grossi o strani**: un file oltre **50 MB** è rifiutato prima di caricarlo (il tetto reale del deposito di work NON è leggibile da qui: il bucket non dichiara un limite proprio; se work ne avesse uno più basso lo rifiuta il deposito e la pagina mostra l'errore com'è); html, svg e programmi sono segnalati e partono non spuntati.
- **Accessibilità**: anello di focus sulle etichette dei file, focus al titolo del riepilogo dopo l'importazione, `role="status"`/`aria-live` su esito e contatori, `role="alert"` sugli errori, `aria-describedby` sul motivo del blocco, aree di tocco più grandi sulle caselle, nomi lunghi a capo. «Scegli una cartella» si nasconde sotto la larghezza `md` (iPhone e iPad non la offrono) con una frase che lo spiega.
- **Carico vuoto**: se nessun file entra, il lotto esiste lo stesso (un lotto non si cancella) ma è vuoto e innocuo; la pagina lo dice e non offre di annullare.

## Dove il blocco «non far leggere all'AI» è davvero sul server
- `supabase/functions/documento-leggi/index.ts` riga 520-527: legge `no_ai` dal documento e risponde 403 **prima** di scaricare il file e prima di usare un testo già salvato. Vale per la scheda del documento e per la chat di MEMO, che passa di lì (`memo-chat/index.ts` ~375, `fetch .../documento-leggi`).
- `supabase/functions/assistente-archivio/index.ts` riga 193-198: secondo lucchetto sul testo (`if (riga?.no_ai === true) continue`); il primo è `documenti_per_domanda` (riga 145), che in `20261122000001` esclude `no_ai` (`where not d.no_ai`).
- Chat di MEMO, metadati: `memo_leggi_documenti` (`20261122000001`, `where not d.no_ai`).
- Elenco del Drive: `elenco_drive_cerca` e `memo_leggi_elenco_drive` escludono `no_ai`.
- Non provato con le chiavi AI vere: il blocco è provato sul testo del codice (`tests/unita/import-drive-c1-sql.test.js`) e, per le funzioni SQL, dalla verifica interna della migrazione.

## Aggiunti ai «non verificato»
- Il **doppio clic** vero (due tocchi ravvicinati su un telefono) non è provato: lo è solo con due clic consecutivi in jsdom.
- Il **cambio di mappa a metà** di un'importazione è impedito (campi bloccati), ma non provato in un browser vero.
- I **file grandi su iPhone** (decine di MB letti in memoria per l'impronta SHA-256) non sono provati: la pagina li legge interi nel browser, e su un telefono con poca memoria potrebbe fallire; in quel caso il file riceve l'avviso «controllo dei doppioni non valido» e si importa lo stesso, se Alessio lo spunta.
