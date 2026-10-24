# La banca e le fatture elettroniche entrano da file

**24/10/2026** · richiesta di Alessio · commit sotto questo riepilogo: `ff48999` (il lavoro è `2737bc8` + `ff48999`) · ramo `claude/project-thread-yqj6ae`, proposta #199 verso `slave` · working tree pulito al commit

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

## Cosa NON è verificato

1. **La migrazione non è applicata né a Borgo58-Prova né in produzione.** Lo schema finto è PG16, la produzione PG17. Da questo ambiente non ci sono le chiavi del progetto di prova.
2. **Il corridoio non è installato** con le tre operazioni nuove: finché non lo è, rispondono 404.
3. **Nessuna delle due schermate è stata aperta**, né da me né da Alessio.
4. Nei tre estratti veri non c'è il bonifico del 20/10 (−4.941,00): l'abbinamento fattura ↔ bonifico è provato solo dentro la verifica della migrazione, con dati costruiti.
5. Limite noto e non coperto: con **più conti attivi e nessuno predefinito**, `pay_supplier_invoice` rifiuta prima che il conto venga corretto. Oggi il conto è uno.

## Cosa abbiamo rovesciato

Niente.

## Cosa resta

Applicare a Borgo58-Prova (`npm run prova:migra`), installare il corridoio sulla prova, provare le due schermate con la fattura vera, poi produzione. Per la produzione l'ordine è quello di sempre: copia di sicurezza di meno di 24 ore, poi `slave`, `master`, `npm run migra -- --conferma`. Questo riepilogo va aggiornato con i numeri veri dell'applicazione.
