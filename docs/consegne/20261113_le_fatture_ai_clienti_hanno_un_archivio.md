# Le fatture ai clienti hanno un archivio (13/11/2026) — pezzo 1 di 5

Commit sotto questa consegna: `24a39749`. Migrazione `20261113000002_le_fatture_ai_clienti_hanno_un_archivio`.

Piano approvato da Alessio il 13/11/2026 («Sì, approvo»): work emette le fatture ai clienti e le spedisce dalla PEC borgo58@pec.it allo SDI. Abbonamento Aruba FE Base, quindi niente invio da programmi. Emette solo la S.r.l.s. Nel 2026 non ci saranno fatture: la prima sarà la 1/2027.

## Cosa entra
- **`entities`**: colonne facoltative per i dati che una fattura pretende. Sono sede (indirizzo, CAP, comune, provincia, nazione), REA (ufficio e numero), capitale sociale, socio unico (SU/SM), PEC e IBAN. Ogni forma è controllata e ha la sua frase in italiano. Su work oggi sono vuote, come anche `vat_number`: le compila Alessio nel pezzo 2.
- **`clienti_fattura`**: chi chiede fattura. Contiene ragione sociale oppure nome e cognome, P.IVA oppure codice fiscale, indirizzo, codice destinatario oppure PEC, e un collegamento facoltativo a `customers`. È a parte da `customers` perché lì la chiave è il telefono.
- **`fatture_emesse`** e **`fatture_emesse_righe`**:
  - stato (bozza → da inviare → inviata → consegnata / messa a disposizione / scartata);
  - modalità di pagamento con i codici ufficiali (MP01, MP02, MP05, MP08);
  - aliquota IVA in punti (22, 10, 5, 4, 0; il 10 come partenza);
  - natura obbligatoria solo quando l'aliquota è 0;
  - collegamento facoltativo al conto del tavolo (`orders`) o al preventivo.
- **`emetti_fattura(uuid)`**: dà il numero quando la fattura esce dalla bozza, mai prima, così una bozza buttata non lascia buchi.
  - Il numero è progressivo per società e anno, ed è assegnato sotto lucchetto.
  - Rifiuta una data anteriore all'ultima fattura numerata.
  - Pretende ragione sociale, P.IVA e sede della S.r.l.s.
  - Congela imponibile, imposta e totale. L'imposta si calcola per aliquota, come nel riepilogo della fattura elettronica.
- **Le guardie**:
  - una fattura nasce in bozza;
  - una fattura numerata non si cancella e non cambia numero, data o società;
  - da fuori (`authenticated`) non si numera e, dopo l'uscita, non si tocca. Fa eccezione lo scarto dello SDI: dopo uno scarto si correggono cliente, causale, pagamento e righe;
  - le righe si toccano solo in bozza o dopo uno scarto, e un update guarda sia la fattura di partenza sia quella di arrivo.
- **Solo il titolare**: RLS «for all» con `is_titolare()` su tutte e tre le tabelle.
- **Specchi dei vocabolari** in `src/lib/constants.js`: `STATI_FATTURA_EMESSA`, `MODALITA_PAGAMENTO_FATTURA`, `NATURE_IVA`, `SOCIO_UNICO`, `ALIQUOTE_IVA_FATTURA`. I primi quattro sono iscritti in `src/lib/calcoli/vocabolari.js`.
- **`src/lib/calcoli/fattureEmesse.js`**: i conti dell'anteprima, fatti in interi (millesimi × centesimi) per dare lo stesso totale del database anche sui mezzi centesimi.
- **`src/lib/api/fattureEmesse.js`**: leggere, salvare il cliente ed emettere. È la porta di `emetti_fattura`.

## Revisione (agente ECC database-reviewer, prima di Prova)
Ha trovato cinque problemi, tutti corretti prima di applicare:
1. Una fattura poteva nascere già numerata con un INSERT diretto.
2. Il permesso di numerare era un segnale di sessione, che anche il client può accendere. Ora vale `current_user`.
3. Una riga poteva essere spostata via da una fattura uscita.
4. I totali di una fattura uscita erano modificabili a mano. Inoltre una riga poteva entrare mentre «Emetti» congelava i totali; ora c'è `for share`.
5. I conti in pagina si facevano in virgola mobile; ora si fanno in interi.

## Verifica dentro la migrazione (annullata, zero residui)
1. Senza i dati della società non si emette.
2. La prima fattura prende 1 e la seconda 2. Il caso 4 × 25 € al 10% + 100 € al 22% fa 232,00 €.
3. Una bozza buttata non lascia buchi: la fattura dopo prende 3.
4. Una data anteriore all'ultima numerata è rifiutata.
5. Rifiutati:
   - cancellare una fattura numerata;
   - cambiarle la data;
   - toccarne le righe;
   - darle un numero a mano;
   - farla nascere numerata;
   - spostarne una riga;
   - cambiarne il totale o lo stato da fuori.
6. Dopo uno scarto si correggono righe e causale.
7. Lo staff non vede né fatture né clienti, e non emette.
8. Ogni vincolo nuovo ha la sua frase.

**Provata su Prova** il 13/11: prima a secco (eseguita e annullata), poi `prova:migra`. Ora ci sono 480 migrazioni.

## Prove pure
`tests/unita/fatture-emesse.test.js`, 8 prove:
- lo stesso caso della migrazione;
- l'IVA sul totale dell'aliquota;
- i mezzi centesimi come il database (1,5 × 1,15 = 1,73);
- la natura come gruppo a parte;
- il 10% di partenza;
- «numero/anno»;
- i dati mancanti della società.

## Schermate
Nessuna: questo pezzo non ne ha. La pagina «Fatture ai clienti» arriva nel pezzo 2.

## Cosa abbiamo rovesciato
1. **Cosa era stato deciso e quando**: il 14/08/2026 (mandato cumulativo, Blocco 4) si era deciso: «l'app prepara i dati, Fatture in Cloud emette e trasmette allo SDI: non si costruisce un emettitore».
2. **La ragione di allora**: non costruire da sé il formato della fattura elettronica e il dialogo con lo SDI.
3. **Cosa si decide adesso**: work costruisce il file e lo spedisce dalla PEC (Alessio, 13/11).
4. **Perché**: Fatture in Cloud non è mai stato attivato, e Aruba Base non accetta invii da programmi. **La ragione resta vera nel merito**, e questo è il prezzo che accettiamo: il file si controlla con lo schema ufficiale prima di ogni invio, e la prima fattura vera si spedisce insieme ad Alessio.

È la voce 110 in `docs/decisioni_rovesciate.md`.

## Rilascio
1. **Prova**: fatto.
2. **work**: la migrazione si applica **solo col sì di Alessio**. Tocca solo tabelle nuove e colonne facoltative, e nessuna funzione online va reinstallata.
