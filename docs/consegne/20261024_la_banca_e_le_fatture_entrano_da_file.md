# La banca e le fatture elettroniche entrano da file

**24-25/10/2026** · richiesta di Alessio · commit sotto questo riepilogo: `cd85c63` · consegna in produzione: `18ecd6c` (proposta #199 verso `slave`, poi #201 `slave`→`master`, merge `dab77a4`); dopo, sul ramo, `52062a8` + `cd85c63` (lo zip, vedi in fondo) · ramo `claude/project-thread-yqj6ae` · working tree pulito al commit

## Cosa ha chiesto

Collegare le fatture elettroniche che riceve (SDI, via Aruba) alle Fatture fornitori. Nell'attesa che la banca dica se c'è un'API, caricare l'estratto conto scaricato a mano e farlo elaborare dal gestionale.

## Cosa cambia

**Due lettori, che girano nel browser.**

- `src/lib/calcoli/cbi.js` legge il flusso CBI «RH» di Credem: record a 120 colonne (RH/61/62/63/64/65/EF), letti per posizione. Le posizioni sono state misurate su tre flussi veri. Se saldo iniziale + movimenti ≠ saldo finale, o se il conteggio di EF non torna, il lettore **si ferma** e non carica niente. `movimentiDaCaricare()` produce l'impronta di ogni movimento. Due movimenti identici nello stesso file prendono `#2`: due commissioni uguali sono due fatti, e ricaricando un estratto che si sovrappone non entrano due volte.
- `src/lib/calcoli/zip.js` apre lo zip della banca così com'è. Legge l'indice centrale e decomprime con `DecompressionStream`. Rifiuta con una frase gli archivi cifrati e gli zip64.
- `src/lib/calcoli/fatturaPA.js` legge una FatturaPA FPR12, in XML semplice o in busta `.p7m` (DER, BER a lunghezza indefinita, base64). ⚠️ **La firma non viene verificata**: la busta si apre e basta. Ciò che è inutilizzabile **ferma** la fattura: numero o data mancanti, divisa non EUR, importi illeggibili, fornitore senza partita IVA o codice fiscale, note di credito TD04/TD05, tipi non gestiti. Ciò che è strano si **dichiara** prima della conferma: totale assente, differenza pari al bollo, scadenze che non fanno il totale.

**Migrazione `20261024000001_la_banca_e_le_fatture_entrano_da_file`.**

- `partita_iva_normale()`, più tre colonne nuove su `supplier_invoices` (`imponibile`, `imposta`, `file_sdi`, con indice unico parziale su `file_sdi`).
- `registra_fattura_elettronica` passa dal corridoio:
  - rifiuta la tasca, una fattura intestata a un'altra partita IVA (solo se la società ha la sua scritta), un file già registrato, la stessa fattura due volte (fornitore + numero normalizzato + data) e una partita IVA presente su due fornitori;
  - il fornitore si **ritrova per partita IVA** sulla stessa società, altrimenti nasce;
  - la fattura nasce da `create_supplier_invoice`, quindi l'impegno in Agenda segue la stessa strada di sempre.
- Tabella `movimenti_banca`: solo titolare, `perimetro_registro` = fuori, vincoli con la frase in italiano. ⚠️ **Caricare non scrive in prima nota.**
- `carica_movimenti_banca` riconosce il conto dall'IBAN. Un IBAN sconosciuto viene respinto, e il messaggio manda a Cassa → Conti correnti.
- `proposte_movimento_banca` propone **solo importi identici al centesimo**: fatture non pagate della stessa società, oppure movimenti di banca già scritti entro ±7 giorni.
- `paga_fattura_da_movimento_banca` (corridoio) paga con `pay_supplier_invoice`, la stessa strada del pulsante «Pagata», e mette sul conto del movimento il movimento di cassa che nasce.
- `registra_movimento_banca` (corridoio) vuole una causale dell'utente di direzione giusta e un tipo di documento. ⚠️ Nessun tipo di documento è proposto: «non documentato» scelto per comodità toglie la spesa dai deducibili in silenzio.
- `abbina_movimento_banca`, `ignora_movimento_banca` (vuole il perché) e `riapri_movimento_banca`. ⚠️ Riaprire scioglie il collegamento e **non cancella niente** dalla prima nota.
- Blocco di verifica in 15 passi, annullato alla fine (`ZZ_ANNULLA`), con `pretendi_nessun_residuo`. Auto-registrazione.

**Migrazione `20261024000002_i_movimenti_della_banca_parlano_italiano`.** Le prove sul progetto di prova (`tests/app/vincoli-che-parlano.test.js`) sono diventate rosse appena la `…001` è entrata: le due unicità e la chiave esterna verso il conto di `movimenti_banca` erano mute, perché la `…001` dava la frase ai soli `check`. La `…002` le dà la frase; la sua verifica guarda **tutte** le unicità e chiavi esterne della tabella dal catalogo, e ne ha trovata una quarta che la rete non elencava (`movimenti_banca_cash_movement_id_fkey`). Rotta apposta togliendo una frase: diventa rossa nominandola. La `…001` non è stata riscritta: sulla prova è già applicata.

**Migrazione `20261024000003_il_portiere_dei_movimenti_della_banca`.** La rete dei portieri (`tests/app/permessi.test.js`) ha segnalato quattro funzioni `security definer` (paga, abbina, registra, ignora) il cui controllo del titolare stava solo dentro `movimento_banca_da_abbinare()`, chiamata nell'inizializzazione di una variabile: il rifiuto c'era, ma non nel corpo del gesto. Ora ognuna lo scrive da sé; corpi presi dalla `…001`, cambia solo l'inizio. Sul Postgres locale: la verifica della `…003` passa due volte e la verifica intera della `…001`, rieseguita dopo, resta verde.

**Migrazione `20261025000001_le_spese_della_banca_hanno_il_loro_documento`.** Decisione di Alessio del 25/10, dopo la prova: una commissione di banca non aveva un tipo di documento giusto, e «non documentato» l'avrebbe tolta dai deducibili. Nuovo valore `estratto_conto` in `cash_document_type` (etichetta «Estratto conto (spese bancarie)» in `CASH_DOCUMENT_TYPES`). La causale resta un dato suo, da Cassa → Causali: in produzione oggi non ce n'è una per le spese di banca.

**Corridoio**: tre nomi nuovi in `OPERAZIONI`.

**Il lettore dell'XML è suo, non `DOMParser`.** CodeQL ha segnalato `parseFromString` su un testo da file come «testo reinterpretato come HTML» (alto). Non era sfruttabile (application/xml, solo testo estratto e mostrato da React), ma un allarme alto acceso si impara a ignorare. `leggiXml()` costruisce solo elementi, attributi, testo, entità, commenti e CDATA; si ferma su tag non chiusi o non corrispondenti e **rifiuta i DOCTYPE**. Riletta la fattura vera: stessi campi.

**Schermate**: `/cassa/banca` («Movimenti della banca», da Cassa) e `/fatture-fornitori/da-file` («Carica una fattura elettronica», da Fatture fornitori). Guardia sincrona sul doppio tocco, e l'esito sulla riga toccata.

## Verifiche

- `npm run lint` pulito; `npm run test` **2280 verdi**, di cui 45 nuove (18 CBI, 22 FatturaPA, 5 zip); `npm run build` riuscito.
- I lettori sono stati provati **sui file veri**, che stanno fuori dal repository:
  - la fattura FPR 98/26 (TD01, 4.941,00, imponibile 4.050,00, IVA 891,00): zero errori e zero avvisi;
  - i tre flussi CBI: zero errori, 3 movimenti in tutto, impronte tutte distinte.

  Le prove nel repository **ricostruiscono** la forma di quei file: il repository è pubblico.
- La migrazione è stata applicata **su un Postgres 16 locale con uno schema finto** costruito apposta: verde, e rieseguita una seconda volta (idempotente). Due rotture fatte apposta la rendono rossa:
  - il conto del movimento non aggiornato nel pagamento;
  - prima, un controllo che non discriminava, perché c'era un solo conto: corretto con due conti.

## In produzione (25/10/2026)

Copia di sicurezza prima: `2026-10-25_1047` (141 tabelle, 1696 righe, 3 documenti, 4 utenti, controllo di completezza superato). Ok di Alessio in chat alle 10:07 (questa consegna) e alle 10:44 (la spesa spicciola `20261019000002`, che stava già su `master` e andava applicata insieme).

- Giro in sola lettura `npm run migra -- --salta 20261019000001`: 427 nel repository, 421 applicate, **da applicare esattamente 5** — `20261019000002`, `20261024000001`, `20261024000002`, `20261024000003`, `20261025000001`. Nessun rifiuto.
- `--conferma`: esito 0, 5 su 5, ognuna col suo «Fatto: …» di verifica. Totale in produzione: **427**.
- ⚠️ `20261019000001` risulta **registrata** (11:11:13 UTC, stesso istante della `…002`) ma il suo file **non è mai girato**: la registra la `…002` apposta (sue righe 384-388), come la `20260824000032` con la `…030`. Il registro dice 427 e non 426 per questo.
- `operazioni-atomiche`: versione **39 → 40** in produzione. Secrets non toccati.
- Dopo, misurato dal connettore in sola lettura: `applied_migrations` **427**; `movimenti_banca` **0**; `supplier_invoices` **0**; `estratto_conto` esiste in `cash_document_type`. `npm run consegne`: nessun arretrato.

Sul progetto di prova: tutte e quattro applicate (427), corridoio alla versione 45; Alessio ha registrato dalla schermata la FPR 98/26 e l'ha pagata abbinando il bonifico −4.941,00 del flusso CBI del 20/10 (movimento in banca, conto Credem, promemoria in Agenda chiuso).

## Cosa NON è verificato

1. **In produzione nessun gesto è stato fatto**: zero movimenti di banca, zero fatture. Le schermate le ha aperte Alessio solo sul progetto di prova.
2. Sulla prova restano non abbinati la commissione (−1,00, ora registrabile col documento «Estratto conto») e il +5.000,00 del prestito, che va prima registrato da Cassa → Prestiti.
3. **La schermata col caricamento di uno zip non è stata aperta** (vedi in fondo): provata solo col lettore fuori dall'app.
4. L'abbinamento fattura ↔ bonifico è provato solo dentro la verifica della migrazione, con dati costruiti. Il bonifico vero del 20/10 (−4.941,00) **c'è** nel flusso di quel giorno, insieme alla commissione (−1,00) e a un bonifico in entrata (+5.000,00): il saldo passa da 3.987,44 a 4.045,44. ⚠️ Una prima versione di questo punto diceva il contrario: era una frase scritta senza aver elencato i movimenti, smentita elencandoli.
5. Limite noto e non coperto: con **più conti attivi e nessuno predefinito**, `pay_supplier_invoice` rifiuta prima che il conto venga corretto. Oggi il conto è uno.

## Cosa abbiamo rovesciato

Niente.

## Cosa resta

- Alessio: creare una causale «Spese bancarie» (Cassa → Causali) e registrare il prestito da Cassa → Prestiti, poi abbinarlo.
- Lo zip: proposta a sé verso `slave`, da aprire sulla schermata della prova prima di `master`.

## Dopo la consegna: le fatture in uno zip (`52062a8`, `cd85c63`)

Alessio scarica le fatture ricevute da Aruba tutte insieme (Fatture ricevute → seleziona → Azioni → Scarica XML → Applica). Il file è uno .zip con i `.xml` sotto una cartella `XML/`. `ImportaFatturaElettronica.jsx` ora apre gli .zip (riusa `leggiZip`), mostra una riga per fattura, conta e dice i file che non sono fatture, e ha «Registra tutte», in fila una alla volta. Nessuna migrazione: i doppioni li ferma già `registra_fattura_elettronica` (stesso `file_sdi`, oppure stesso fornitore + numero + data).

- Provato col lettore, fuori dall'app, sullo zip vero di Aruba (fuori dal repository): due fatture lette, zero errori e zero avvisi. Provato anche con uno zip costruito, fattura vera più un metadato finto: il metadato viene saltato.
- Difetto trovato provando lo zip vero e corretto in `cd85c63`: come `file_sdi` finiva «archivio.zip › XML/nome.xml», quindi il controllo per nome del file non avrebbe riconosciuto la stessa fattura caricata da sola. Ora si conserva il nome del solo file.
- `npm run lint` pulito, `npm run test` 2280 verdi, `npm run build` riuscito.

