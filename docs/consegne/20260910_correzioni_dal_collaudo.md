# Le correzioni dal collaudo — 10/09/2026

Tre difetti trovati da Alessio col telefono sul progetto di prova, dopo le
consegne #48–#52 della notte.

**Commit sotto questo riepilogo**: `45d83d1`, ramo `correzioni-collaudo`,
nato da `082293b` (la testa della #52). Albero di lavoro pulito al commit.
**Ordine della catena, verificato**: `master` ⊂ #48 ⊂ #49 ⊂ #50 ⊂ #51 ⊂ #52 ⊂
questo ramo; come le cinque prima, la proposta punta a `master`.
**Migrazione**: `20260910000003_il_deposito_dei_documenti_riapre.sql`
**Applicata**: **solo sul progetto di prova** (`Borgo58-Prova`, 387 migrazioni
registrate). In produzione **no**: 380 registrate, l'ultima `20260907000002`,
e le quattro regole che questa migrazione ricrea ci sono già, identiche
(letto il 10/09 col connettore in sola lettura) — lì non creerebbe niente.
**Funzioni online**: nessuna toccata. **Chiamate al modello**: nessuna.

---

## 1. «Salva nell'Archivio» → `new row violates row-level security policy`

- **Dove si fermava, misurato**: al caricamento del **file**, primo passo del
  salvataggio (`uploadDocumentFile`, prima di `create_document` dal 20/08).
  Riprodotto col titolare di prova: stesso identico messaggio.
- **La causa**: su `storage.objects` del progetto di prova le regole erano
  **zero**; il cassetto `documents` c'era, e la `20260802000014` risultava
  registrata (21/08/2026). ⚠️ **Perché mancassero non è misurato.**
- **La cura minima**: le stesse quattro regole della `…014`, create solo se
  mancano. Il cassetto resta del solo titolare.
- **La verifica** prova il flusso coi ruoli veri — il titolare carica, rilegge,
  la scheda nasce col percorso del file e riceve il testo letto; lo staff non
  vede e non carica — e **si annulla da sola** (errore proprio `P0B58`
  catturato per codice: dal deposito non si cancella via SQL). In più
  confronta le quattro condizioni col testo **scritto dal motore stesso** su
  una tabella di passaggio, e pretende che nessun'altra regola nomini il
  cassetto.
- **Sette rotture apposta, ognuna rossa col suo messaggio**: regola aperta a
  tutti in lettura → «lo staff vede il file»; in caricamento → «lo staff ha
  caricato»; regola di caricamento senza titolare → «3 identiche»; «… OR un
  altro utente» → «3 identiche»; quinta regola sul cassetto → «altre 1
  regole»; le due aggiunte con `bucket_id = 'documents'` → «altre 1 regole».
  ⚠️ **Limite dichiarato nel file**: una regola che apre tutto a UN solo altro
  utente senza nominare il cassetto non la prende nessun controllo.

## 2. La spesa spicciola

- **Tolte dal progetto di prova**, per identificativo, dopo averle contate: **136**
  righe `TEST-AUTO due liste#…` (07/09 → 10/09) nella spesa spicciola, **5**
  `TEST-AUTO appunti#…` nella lista della spesa e **1** impegno (06/09).
  «tonno» intatto; lapidi 52394 prima e dopo.
- **La perdita**: approvare un appunto crea righe che la prova non si segnava.
  `due-liste` e `appunti-vocali` ora spazzano per marchio (`righeDaTogliere`),
  e una prova nuova approva un appunto senza leggere le righe e pretende zero
  residui dopo la pulizia.
- **Il riquadro della mattina** contava anche le cose nel carrello: ora
  `daComprare()` (`src/lib/calcoli/spesaSpicciola.js`), la stessa regola della
  pagina. Rotta apposta, diventano rosse le due prove nuove.

## 3. L'Agenda: titolo e contenuti nella stessa colonna

- **Misurato prima**: la spunta stava dentro il titolo, e campi, nota e
  «rimanda» partivano **34,7 punti** più a sinistra (telefono; sul computer la
  nota della stessa cella).
- **La cura**: `ElencoAdattivo` prende `inizio`, una colonna sua per la spunta;
  tutto il resto nella colonna accanto. Senza `inizio` nessun'altra schermata
  cambia.
- **Prova visiva nuova** (`npm run test:visive`, `scripts/prova-visiva.mjs`):
  la vera schermata dell'Agenda, letture finte, Chrome senza schermo a
  390×844 e 1280×900; misura dove comincia ogni scritta. Rossa prima della
  correzione, verde dopo su 10 schede; rossa anche se ne manca una.
  Nessuna dipendenza nuova.

---

## Prove

| giro | esito |
|---|---|
| lint | pulito |
| compilazione | riuscita |
| prove pure | 1285 su 1287 — le 2 rosse (`indice-richieste`, `indice-rovesciamenti`) lo sono **identiche su `082293b`**: fine riga di questa macchina, su GitHub passano |
| schermate | 132 su 132 |
| prova visiva | 10 schede su 10 |
| sul progetto di prova, prima della migrazione | 554 su 557 — rosse le 3 del deposito, col messaggio del collaudo |
| sul progetto di prova, dopo (due giri) | **557 su 557**; residui di prova dopo il giro: zero |

**Revisione Codex** (una): quattro rilievi. Accolti: il confronto esatto delle
regole (prima cercava solo parole dentro) e la prova visiva che pretende tutte
le schede. Non accolti: `righeDaTogliere` che prende anche `TEST-AUTO…` senza
marchio del giro — il prefisso è riservato alle prove (`tests/app/LEGGIMI.md`),
e stringerlo cambierebbe la pulizia di altri tre file; e «sul computer campi e
rimanda partono più a destra» — sono colonne della tabella, per costruzione.

## Cosa non è verificato con gli occhi

- **Da me, nessuna schermata sul telefono.** Il collaudo l'ha fatto Alessio e
  lo dichiara superato; nel dettaglio riporta l'Archivio: salva e rilegge
  anche il PDF grande, con data, titolo e file giusti.
- La prova visiva gira su **Chrome**, non su Safari dell'iPhone, e su dati finti.

## Affermazioni diventate false mentre si lavorava

- La prima stesura della verifica si è fermata su `documents_ha_identita`
  (sezione e data obbligatorie): provava il vincolo, non il deposito. Il file
  si applica in una transazione sola, quindi non è rimasto niente.
- La verifica è stata **irrigidita dopo la prima applicazione** sulla prova
  (rilievo Codex) e riapplicata per versione: le istruzioni che cambiano il
  database sono le stesse, cambia solo il controllo.
- `scripts/prove-app.mjs` dice «per lanciare un file solo: `npm run test:app --
  tests/app/quello.test.js`», ma aggiunge sempre `tests/app` fra i filtri e
  fa girare **tutto**. Annotato, non corretto.

## Cosa abbiamo rovesciato

Niente. Il riquadro che contava anche il carrello non era una decisione: la
pagina della spesa spicciola contava già solo le cose da prendere, e il
riquadro è stato allineato a lei.
