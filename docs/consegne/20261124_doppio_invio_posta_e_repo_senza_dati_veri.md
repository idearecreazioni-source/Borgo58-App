# Doppio invio, posta che non si ferma in silenzio e repo senza dati veri (24/11/2026)

Revisione dell'11/11 (punti 8, 11, 12) e revisione generale di work del 23/11 (punto 9). Già in slave con le PR #465, #466, #467, #468 e #469.

## Migrazione
- `20261124000001` (`i_doppi_invii_non_scrivono_due_volte`), punto 8 dell'11/11: `pareggia_anticipazione`, `registra_restituzione_prestito` e `registra_caparra` BLOCCANO la riga che decide (la nota, il prestito, la prenotazione) con `for update` mentre controllano: un secondo invio uguale aspetta il primo e poi rilegge. Ogni funzione si cambia dal corpo vivo in un punto solo (controllato: la riga deve comparire una volta sola). Niente vincoli unici: un secondo movimento legittimo per la stessa prenotazione o lo stesso prestito esiste. Termina con una verifica (legge il corpo vivo delle tre funzioni) e si registra in `applied_migrations`.
- Provato il 24/11 su Prova con `npm run prova:blocco` (due sessioni SQL, una transazione tenuta aperta): senza il blocco escono 1.400 euro su un prestito da 700; col blocco il secondo invio aspetta 4 secondi e viene rifiutato (700 su 700).

## Funzione online
- `posta-leggi`:
  - punto 11: se l'elenco delle mail non si legge, lancia un errore (avviso su Telegram, solo il codice di stato) invece di fermarsi in silenzio;
  - punto 12: un .docx/.odt si apre solo nel pezzo che serve e solo se dichiara meno di 8 MB; il tentativo di lettura si conta PRIMA di aprire gli allegati (con una nota «lettura in corso»), quindi una mail che fa morire la funzione esce dalla coda dopo `MAX_TENTATIVI`;
  - punto 9: nel testo di esempio e in un commento, nome e cifre di un contratto vero sono sostituiti da nomi e cifre inventati.

## Repo
- Punto 9: nomi veri (la proprietaria del locale, chi ha prestato i soldi) e cifre dell'affitto e dei prestiti sostituiti con nomi e cifre inventati nei file di consegna, nei commenti e in un test. La storia di git resta com'è.

## Su work, ognuno col sì scritto di Alessio (dato il 24/11)
Copia di sicurezza → migrazione `20261124000001` → funzione `posta-leggi` → «Approve and deploy» (il sito non cambia).

## Cosa NON è verificato
- La prova vera del blocco è fatta sulla restituzione del prestito; rimborso e caparra usano lo stesso blocco ma non sono stati provati con due sessioni.
- Il lavoro che legge la posta gira ogni 15 minuti: in un guasto lungo l'avviso Telegram si ripete (nessun freno aggiunto da questa consegna).
- Il filtro dello zip (fflate) e il conto anticipato di `posta-leggi` non si eseguono da qui: li provano la lettura del codice e la revisione.
