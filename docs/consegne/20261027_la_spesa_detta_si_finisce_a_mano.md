# La spesa detta si finisce a mano — 27/10/2026

**HEAD dichiarato sotto questo riepilogo:** il commit che contiene questo file, sul ramo `claude/da-collocare-a-mano` aperto da `origin/slave` `831bd14`. Un commit. Working tree pulito.
**Migrazione `20261027000002_la_spesa_da_collocare_si_finisce_a_mano`: applicata (e riapplicata) SOLO al progetto di prova.** Produzione non toccata. Il corridoio `operazioni-atomiche` NON è stato reinstallato sul progetto di prova: lì c'è la versione del secondo lotto della voce (#246), e installarla da questo ramo l'avrebbe tolta.

## Origine
Alessio, provando la voce sul telefono la mattina del 27/10: detto «ho speso tre euro di pane», MEMO ha fatto un appunto «spesa da collocare». «Fallo a mano» portava su «Da collocare», che diceva «Niente da collocare» e non aveva un modo per scriverla: un vicolo cieco. Il percorso c'era dalla `20261025000042`; mancavano i campi e la scrittura.

Decisione di Alessio, sue parole: *«teniamo la regola per ora e sistemiamo il vicolo cieco»*. La regola dell'11/10 resta: una spesa detta va prima fra quelle da collocare, e la destinazione la sceglie lui.

## Cosa cambia
- **`azione_campi` ha il ramo `spesa_da_collocare`:** importo, giorno, chi (il numero del fornitore diventa il nome) e che cosa. Il ramo è inserito nel corpo vivo, confrontato su prova e produzione (identici), come la `20261025000042`.
- **`annota_spesa_dettata_a_mano(uuid, jsonb)`**, dal corridoio. Chiude la cosa detta e scrive la spesa in una transazione, come «Approva»: `voce_risolvi_dati` e poi `fai_azione_dettata`. Dalla schermata cambiano solo i quattro campi. Natura proposta, mezzo, causale, documento e dettato restano quelli capiti da MEMO. Un campo svuotato resta vuoto.
- **«Da collocare» con `?daVoce=`:** in cima ci sono la striscia della voce e la scheda «La spesa che hai detto». Salvando, la spesa entra nell'elenco qui sotto, da collocare come le altre. Senza voce la schermata è quella di sempre.
- **Corridoio:** una riga nuova nell'elenco `OPERAZIONI`.

## Verificato
- **Progetto di prova:** migrazione applicata due volte. Verifica superata con zero residui. I sei controlli sono:
  - la schermata riceve i campi;
  - il giro completo;
  - il doppione rifiutato col suo messaggio;
  - il campo svuotato;
  - il tipo sbagliato;
  - lo staff fermato.
- **Prove di schermata:** `da-collocare-a-mano` (8, nuova) e `da-collocare` (8). Tutte verdi.
- **Prove pure:** verdi, salvo le 3 già note per gli a capo CRLF (le stesse fallono su un altro ramo). La rete `campi-data` aveva fermato la casella del giorno senza larghezza: corretta.
- **`npx oxlint`:** zero avvisi sui file toccati.
- **Revisione `ecc:database-reviewer`:** nessun bloccante. Accolti:
  - il controllo del doppione ora guarda il messaggio esatto;
  - la guardia di idempotenza cerca il `when`;
  - i prerequisiti controllano il percorso;
  - un commento spiega perché qui «cosa manca» non ferma.
- **Revisione `ecc:react-reviewer`:** nessun bloccante. Accolti:
  - se la rilettura fallisce, «Fatto» resta in vista;
  - l'errore è annunciato (`role="alert"`);
  - il bottone con la scheda vuota resta raggiungibile da tastiera e dice cosa manca;
  - due prove in più: il doppio tocco e la rilettura fallita.

## Non verificato
- **La schermata aperta a mano dal telefono**, sull'anteprima o sul gestionale vero.
- **Il giro dal client vero col corridoio:** sul progetto di prova il corridoio non ha ancora questa operazione (vedi sopra).

## Decisione che spetta ad Alessio
- Nessuna nuova: è la correzione che ha chiesto.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Le istruzioni di prova date ad Alessio stamattina («la spesa si apre in Prima nota») erano sbagliate: una spesa detta così diventa «da collocare». Corrette in chat.

## Cosa abbiamo rovesciato
- Niente. La regola dell'11/10 resta com'era.
