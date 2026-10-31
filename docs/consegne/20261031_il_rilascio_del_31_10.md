# Il rilascio del 31/10: backup onesto, stampa incerta e Bar, schermo del PC

**HEAD dichiarato sotto questo riepilogo:** master `b4d801f`, cioè l'unione di #285. Questo file nomina la migrazione che entra in produzione con questo rilascio, come chiede `npm run migra`. I numeri dell'applicazione si aggiungono dopo, in una PR a parte.

## Cosa entra
Alessio lo ha autorizzato il 31/10:
- con «1 si ok» ha detto di preparare il rilascio dopo l'unione di #280–#282;
- con «Si» ha dato l'ultimo sì alla domanda «Porto il rilascio in produzione adesso?».

Le PR:
- **#277:** il riepilogo del rilascio del 30/10.
- **#278:** backup, verifica e deposito-orfani controllano di parlare con la produzione.
- **#279:** col profilo «Computer» le scritte tornano piccole sul PC calibrato. Alessio l'ha controllato su Prova.
- **#280:** il backup dice onestamente cosa ha copiato.
  - La chiave dei documenti è obbligatoria.
  - L'elenco del deposito si legge a pagine.
  - I documenti si contano contro il database.
- **#281:** deposito-orfani non tocca gli allegati della posta.
- **#282:** la stampa incerta dice una cosa sola, e il Bar vede se il suo foglio è uscito.
  - Migrazione **`20261031000001`** (`la_stampa_incerta_e_il_bar`).
- **#283:** col profilo «Computer» e la finestra stretta, la barra in alto e il menu a cassetto sono piccoli.

Funzioni online: nessuna cambiata.

## Numeri, misurati prima della migrazione
- **Copia di sicurezza:** `2026-10-31_1349`, fatta con lo script nuovo della #280. È anche la prima prova vera dello script.
  - 148 tabelle e 1.824 righe, contate e confermate.
  - 4 utenti e 4 identità.
  - 3 documenti su 3 dichiarati.
  - Zip di 810 KB.
- **`npm run migra` in sola lettura:** 450 migrazioni nel repository e 449 in produzione. Manca solo `20261031000001`.
  - Si è fermato per l'assenza di questo riepilogo, ed è il motivo per cui il riepilogo esiste.
- **Peso:** il gestionale pesa 446,55 kB su 450, `/prenota` 147,39 su 160.
- **Revisione:** `ecc:code-reviewer` sull'intero rilascio ha dato GO, senza rilievi critici o alti.

## Prima dell'unione
- **Il cancello della filiera della #285 era rosso:** era partito prima che Prova finisse di pubblicare. Rilanciato, è passato.
- **Prova delle schermate della #282:** Chrome non si era avviato sul server di GitHub. Rilanciata, è passata.

## Non verificato
- I numeri dell'applicazione in produzione arrivano dopo, in un secondo riepilogo.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- **«Il rilascio è pronto».** L'ho scritto prima di questo riepilogo, che `migra` pretende. Mancava, e l'ha trovato `migra`, non io.

## Cosa abbiamo rovesciato
- **Il rilascio «solo #278–#282».** La #283 è entrata perché era già unita e controllata su slave quando il rilascio è partito.
