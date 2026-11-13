# Il file XML della fattura ai clienti, controllato con lo schema ufficiale (13/11/2026) — pezzo 2b di 5

Commit sotto questa consegna: `e81c8e0b`. Nessuna migrazione: questo pezzo non tocca il database.

Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md). Via al pezzo 2b dato da Alessio («Si parti»). Lo strumento delle prove `xmllint-wasm` è stato aggiunto col suo sì («Sì aggiungilo»).

## Cosa entra
- **`supabase/functions/_shared/fatturaEmessa.js`**: il file XML della fattura elettronica nel formato **FPR12** (fattura fra privati), schema ufficiale **1.2.3** (specifiche tecniche SdI 1.9).
  - Sta in `_shared` perché lo useranno due posti, che devono dire la stessa cosa: la pagina e la funzione che spedirà dalla PEC (pezzo 3).
  - Nessuna dipendenza: gira nel browser, in Node e in Deno.
  - Anche **i conti** (`totaliFattura`, `alCentesimo`, `imponibileRiga`) sono passati qui da `src/lib/calcoli/fattureEmesse.js`, che ora li riesporta: così la funzione di spedizione rifà gli stessi numeri del database senza una copia.
- **`xmlFattura()`** restituisce il file e il suo nome (`IT01343950869_<progressivo>.xml`), oppure **l'elenco in italiano di cosa sistemare**. Se qualcosa non va, il file non esce:
  - i dati della società e del cliente (partita IVA e codice fiscale **con la cifra di controllo**, CAP, provincia, IBAN per il bonifico, codice destinatario);
  - un carattere che lo SdI rifiuta (un'emoji). Le virgolette «curve» del telefono, il trattino lungo e il simbolo € diventano quelli semplici;
  - testi troppo lunghi; la causale lunga si divide in pezzi da 200;
  - una data impossibile, una natura IVA fuori dall'elenco ufficiale;
  - un totale congelato che non torna con le righe;
  - righe senza IVA oltre 77,47 € (vorrebbero la marca da bollo: si chiede a Laura);
  - un cliente estero (per ora no: regole sue, si chiede a Laura).
- **IVA inclusa**: nel file il prezzo è **senza IVA**, a 8 decimali, ricavato dal totale della riga già al centesimo (come il database). Il riepilogo per aliquota porta imponibile e imposta **del database**. La frazione di centesimo dello scorporo va in «Arrotondamento», come prevede lo schema: i conti dello SdI (imponibile = righe + arrotondamento, imposta = imponibile × aliquota) tornano.
- **Nella bozza, «Scarica il file di prova»**: lo stesso file che partirà, fatto con quello che si vede sullo schermo, con «BOZZA» al posto del numero. Non parte niente. Se manca qualcosa, lo elenca. Se cambi la bozza dopo, l'esito vecchio sparisce.
- **Regime fiscale**: `ordinario` → RF01 (quello della S.r.l.s. dalla migrazione del 30/07), `forfettario` → RF19, altrimenti il file si ferma.

## Lo schema ufficiale nelle prove
- `tests/dati/fatturapa/Schema_VFPR12_v1.2.3.xsd`: da fatturapa.gov.it («Formato FatturaPA»), così com'è.
- `tests/dati/fatturapa/xmldsig-core-schema.xsd`: da w3.org, lo schema della firma che il primo importa. La prova lo legge da qui, senza andare in rete.
- Il controllo lo fa **`xmllint-wasm` 5.3.0** (libxml2, la stessa di `xmllint`). È solo una devDependency, mai nell'app.

## Revisione (ecc:code-reviewer)
Verdetto: niente di critico né di grave. Corretti tutti i rilievi:
1. **(medio)** Le righe partivano dal prezzo × quantità senza arrotondare: con «1,5 × 0,33» la riga del file non tornava col conto e la differenza finiva tutta in «Arrotondamento». Ora la riga parte dal suo totale al centesimo.
2. Natura controllata sull'elenco ufficiale.
3. Cifra di controllo di partita IVA e codice fiscale (società e cliente).
4. CAP, provincia, nazione, REA, socio unico, codice destinatario, PEC e IBAN ricontrollati anche nel modulo (il database li garantisce già, ma il file si farà anche dalla funzione).
5. I caratteri di comando 0x7F-0x9F non passano più.
6. Data vera (non il 31 febbraio).
7. L'esito del file di prova sparisce se la bozza cambia.
Lasciato com'è, apposta: la soglia del bollo blocca anche le N3.x diverse da N3.1. È il verso prudente: si chiede a Laura.

## Prove
- `tests/unita/fattura-xml.test.js` (16): campi e conti del file, scorporo, conti dello SdI, persona con PEC, bonifico con IBAN, caratteri, causale lunga, errori in italiano, file BOZZA, totale che non torna, bollo, estero, quantità a metà, cifre di controllo, data e natura.
- `tests/unita/fattura-xml-schema.test.js` (10): nove fatture diverse passano lo schema ufficiale; un file senza un campo obbligatorio viene rifiutato.
- `tests/schermate/fatture-clienti.test.jsx` (7, due nuove): il file di prova dice cosa manca, poi si scarica con BOZZA.
- Tutte le prove pure, il controllo dello stile e la compilazione: verdi in locale.

## Cosa abbiamo rovesciato
Niente di nuovo. Il rovesciamento della decisione del 14/08 (Fatture in Cloud) è già dichiarato con il pezzo 1, voce 110.

## Rilascio
- **Nessuna migrazione e nessuna funzione da installare.** Su work basta il codice della pagina, col sì di Alessio (Approve and deploy).
- Da guardare con Laura: scaricare un file di prova e farglielo controllare.
