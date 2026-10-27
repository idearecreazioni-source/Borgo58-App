# I promemoria per luogo — 28/10/2026

**HEAD dichiarato sotto questo riepilogo:** `7819de6a`, sul ramo `claude/promemoria-luogo` aperto da `origin/master` `63612900`. Questo riepilogo è l'ultimo commit della consegna. Working tree pulito, a parte `.env` (ignorato, copia temporanea, tolta a fine lavoro).

## Origine
Alessio, il 27/10: *«esiste un modo per legare un task ad una posizione? del tipo "ricordami di fare questo quando arrivo a casa"»*.

Scelte sue del 28/10:
- **Luoghi:** Casa e Ristorante.
- **Cosa ricorda:** *«una qualunque cosa che ho chiesto sul momento del tipo "quando arrivo a casa ricordami di pesare la mamma"»*, quindi ogni impegno aperto di quel luogo, senza guardare la data.
- **Se non c'è niente:** nessuna notifica.

## Come funziona
Il gestionale è un sito, e un sito chiuso non sa dove si trova il telefono. Lo sa l'iPhone. Un'automazione dell'app Comandi («quando arrivo a Casa») chiama la funzione online `promemoria-luogo`, che legge gli impegni aperti di quel luogo e risponde con il testo della notifica. Quando non c'è niente, il testo è vuoto.

## Cosa cambia
- **Database (Prova; in produzione dopo il merge su master):**
  - `20261028000001_un_promemoria_aspetta_che_arrivo_a_casa`:
    - colonna `tasks.luogo` con il vincolo `luogo_chiuso` (casa, ristorante o vuoto);
    - `agenda_corsie()` restituisce il luogo;
    - `completa_task` lo porta sul successivo di un ricorrente.
  - `20261028000002_la_voce_sa_dire_dove`: il ramo `promemoria` di `fai_azione_dettata` scrive il luogo, solo se è uno dei due. Un luogo sconosciuto non ferma la dettatura: l'impegno nasce senza luogo.
  - `20261028000003_la_chiave_del_luogo`:
    - tabella `chiavi_luogo` (impronta sha256, solo titolare);
    - `crea_chiave_luogo`, `revoca_chiave_luogo`, `chiavi_luogo_elenco`;
    - `luogo_promemoria`, aperta ad `anon` con il freno di 30 letture all'ora per chiave.
- **Funzione online nuova:** `promemoria-luogo`, installata senza verifica del token (`SENZA_TOKEN`, con la ragione scritta). Legge soltanto.
- **Voce:** `ascolta-voce` chiede al modello il campo `luogo` (in `index.ts` e `agenda.ts`), solo se è stato detto e mai nel titolo.
- **Schermate:**
  - la scheda dell'impegno ha «Ricordamelo quando arrivo»: Da nessuna parte / a casa / al ristorante;
  - l'Agenda mostra «Quando arrivo: Casa» nel quadrotto;
  - pagina nuova `/agenda/luoghi` («Quando arrivo…», solo titolare): la chiave e i dati da copiare nell'automazione;
  - l'appunto da approvare dice «ricordamelo quando arrivo a: casa».
- **`ElencoAdattivo`:** le colonne della tabella da computer sono quelle di tutte le righe, non della prima. Il difetto c'era già con «In lista da»; con il luogo sarebbe diventato frequente.
- **Prova sui permessi (`tests/app/permessi.test.js`):** le funzioni aperte ad `anon` passano da 13 a 14, con la ragione scritta.

## Verificato
- **Migrazioni su Prova:** tutte e tre applicate due volte, con «Provato e annullato: zero residui».
  - La 3 è stata riapplicata dopo la revisione di sicurezza. La rete delle guardie l'ha fermata perché toglievo un messaggio di rifiuto: è dichiarato nel file con `rete-guardie`.
- **La funzione su Prova (versione 2)**, provata da qui con una chiave e un impegno di prova, poi cancellati:
  - a casa risponde «Casa: 1 cosa da fare / • PROVA CURL pesare la mamma» (200);
  - al ristorante risponde vuoto (200, 0 byte);
  - chiave sbagliata: 401; luogo sconosciuto: 400; richiesta oltre 2 KB: 413; `GET`: 405.
- **`ascolta-voce` su Prova:** versione 45 → 46.
- **Prove:**
  - unità: `luogo-promemoria` (10 prove nuove) e `vocabolari` (con `TASK_LUOGHI` dichiarato);
  - schermate: `agenda-luogo-nella-scheda` e `elenco-colonne-di-tutte-le-righe`. Le schermate sono 60 file, 462 prove, tutte verdi;
  - `npm run test:app -- tests/app/permessi.test.js` contro Prova: 23 prove verdi.
- **Revisioni ECC:**
  - `ecc:security-reviewer`: nessun problema grave. Applicati:
    - errori inattesi non detti fuori;
    - luogo controllato prima della chiave;
    - testo ricevuto non ripetuto;
    - tetto di 2 KB e `nosniff`.
  - `ecc:code-reviewer`: applicati la tabella allineata e il luogo inventato dalla voce che cade nella scheda.

## Non verificato
- **Le schermate nuove non le ho aperte in un browser** con un accesso: la scheda, la pagina «Quando arrivo…» e l'etichetta in Agenda sono provate solo dalle prove di schermata. Vanno guardate sull'anteprima.
- **L'automazione sull'iPhone non l'ha costruita nessuno.** La pagina dice solo ciò che è già stato verificato con la Scorciatoia della voce (`Ottieni contenuto di URL`, POST, corpo JSON). I passaggi di «Quando arrivo» e della notifica si scrivono sulle schermate del telefono di Alessio.
- **La voce dal vivo** («quando arrivo a casa ricordami di…»): non provata, perché serve il modello vero.
- **Le 459 prove contro il progetto di prova:** le fanno girare i controlli della PR.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
- Nulla.
- Le funzioni aperte ad `anon` crescono da 13 a 14: è una crescita dichiarata nella prova, non un rovesciamento.
