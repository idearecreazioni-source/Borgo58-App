# La pagina «Fatture ai clienti» e la bozza che si salva intera (13/11/2026) — pezzo 2a di 5

Commit sotto questa consegna: `905df1bc`. Il lavoro è in `bbee49f3`; `905df1bc` fa rileggere i prezzi con la virgola. Migrazione `20261113000003_la_bozza_della_fattura_si_salva_intera`.

Piano approvato da Alessio il 13/11 (PIANO_fatture_emesse_13-11.md). Via al pezzo 2 dato da Alessio («Sì parti»). Il pezzo 2 è diviso in due: **2a** è la pagina con la bozza, **2b** sarà il file XML con lo schema ufficiale.

## Cosa entra
- **La pagina `/fatture-clienti`**, solo titolare, con la voce «Fatture ai clienti» nel menu dopo «Fatture Fornitori». Contiene:
  - **I dati di Borgo 58 in fattura**: ragione sociale, P.IVA, codice fiscale, sede, REA, capitale, socio unico, PEC, IBAN. Dice quali dati mancano per fare una fattura. Il salvataggio è una scrittura diretta su `entities` (la RLS la apre al solo titolare), e la cache dei soggetti si svuota dopo.
  - **La bozza**:
    - cliente, scelto dall'elenco o creato al momento («+ Nuovo cliente»);
    - data, modo di pagamento e causale;
    - le righe, ognuna con cosa, quantità, prezzo, IVA e natura se l'IVA è 0;
    - il totale in diretta, diviso per aliquota.
  - **Le cifre si scrivono come le scrive Alessio**: «27,50» e «1.234,50». Si rileggono allo stesso modo.
  - **L'elenco** delle fatture: numero (o «bozza»), data, cliente, totale e stato. Si aprono solo le bozze e le scartate.
- **Dal conto del tavolo**: in Cassa → Incassato e scontrinato, accanto a un conto segnato «fattura promessa», c'è **«Prepara la fattura»**. Apre la bozza con i piatti (supplementi compresi), il coperto e la causale «Conto del tavolo N». Se il totale della fattura non torna con il conto, lo dice.
- **I prezzi IVA inclusa** (`fatture_emesse.prezzi_ivati`, vero di partenza). Al ristorante il prezzo è già con l'IVA, quindi per ogni aliquota l'IVA si **scorpora**: imponibile = round(lordo × 100 / (100 + aliquota), 2), imposta = lordo − imponibile. Il totale della fattura resta quello pagato, al centesimo.
- **`totali_fattura()`**: il conto per aliquota in un posto solo. **`emetti_fattura()`** è ripresa da `20261113000002` con un solo cambio: i totali vengono da lì.
- **`salva_bozza_fattura()`**: salva la testata e tutte le righe insieme, tutto o niente. Passa dal corridoio `operazioni-atomiche`, dove c'è la voce nuova `salva_bozza_fattura`. Una fattura scartata dallo SDI si corregge da qui: cliente, causale, pagamento e righe. Data, numero e «IVA inclusa» non cambiano.
- ⚠️ **Il pulsante «Emetti» non c'è, apposta.** Senza la spedizione una fattura numerata resterebbe «da inviare» col numero consumato. Arriva col pezzo 3.

## Revisione (ecc:code-reviewer)
Verdetto: «approva con correzioni». Le sei correzioni sono tutte fatte:
1. Nell'elenco, il totale di una scartata corretta si ricalcola dalle righe.
2. «IVA inclusa» è bloccata dopo l'uscita, nel database e nella spunta.
3. Il prezzo che arriva dal conto è arrotondato al centesimo.
4. Il capitale sociale si scrive in cifre italiane, con una frase in italiano se è sbagliato. «10.000» vale diecimila.
5. I campi della testata si controllano prima della conversione, e una S.r.l.s. mancante si dice in italiano.
6. L'errore della pagina ha `role="alert"`.

Altri due difetti trovati dalle prove della pagina:
- il totale in diretta saltava i prezzi scritti con la virgola;
- un effetto azzerava la scheda della società mentre la si scriveva.

## Verifica dentro la migrazione (annullata, zero residui)
1. Una bozza nuova si salva con le sue righe, IVA inclusa.
2. Lo scorporo: 4 × 25 € + 122 € al 22% = 190,91 + 31,09 = 222,00.
3. Riscrivere la bozza sostituisce le righe.
4. Senza IVA inclusa il conto è quello di prima: 200 + 32.
5. «Emetti» congela gli stessi totali.
6. Una fattura uscita non si riscrive. Una scartata sì, ma senza cambiare data né «IVA inclusa».
7. Sono rifiutati in italiano, senza lasciare niente: senza righe, senza cliente, cliente storpiato, riga senza prezzo, IVA 0 senza natura.
8. Lo staff non salva.

**Su Prova**:
- prima a secco (eseguita e annullata), poi `prova:migra`: ci sono 481 migrazioni;
- `operazioni-atomiche` è reinstallata su Prova.

## La pagina aperta e interrogata (Prova, 13/11, accesso di collaudo)
- Il menu mostra «Fatture ai clienti».
- La scheda della società dice: «mancano: partita IVA, indirizzo della sede, CAP, comune, provincia».
- Ho creato un cliente di prova e una bozza:
  - 4 × 27,50 al 10%;
  - 24,40 al 22%;
  - in pagina: 100,00 + 10,00 e 20,00 + 4,40, totale **134,40 €**;
  - `totali_fattura()` su Prova dice gli stessi numeri;
  - l'elenco mostra «bozza · 13 nov 2026 · … · 134,40 € · bozza».
- **Bozza e cliente di prova cancellati subito dopo.** Prova è tornata a 0 fatture e 0 clienti.
- ⚠️ **Visto per caso, non di questo lavoro**: aprendo **direttamente l'indirizzo** di una pagina solo-titolare (anche `/fatture-fornitori`) si torna alla Dashboard. Dal menu si apre. Va guardato a parte.
- Fuori: la luce del ristorante e l'uso con le mani occupate. Restano ad Alessio.

## Prove
- `tests/unita/fatture-emesse.test.js`: 10 prove, comprese quelle sull'IVA inclusa (il totale è sempre il lordo pagato, al centesimo).
- `tests/schermate/fatture-clienti.test.jsx`: 5 prove:
  - i dati della società si salvano;
  - la bozza con il totale in diretta e lo scorporo;
  - niente «Emetti»;
  - l'errore accanto al pulsante;
  - dal conto del tavolo arrivano piatti, supplemento e coperto, senza il piatto tolto.
- Tutte le prove pure (3115) e di schermata (652) erano verdi prima delle ultime correzioni.

## Cosa abbiamo rovesciato
Niente di nuovo. Il rovesciamento della decisione del 14/08 (Fatture in Cloud) è già dichiarato con il pezzo 1, voce 110.

## Rilascio
1. **Prova**: fatto (migrazione + `operazioni-atomiche`).
2. **work**, solo col sì di Alessio, in quest'ordine:
   - la migrazione `20261113000003` (con la `20261113000002`, se non è ancora lì);
   - **`npm run funzione -- operazioni-atomiche --conferma`**, altrimenti «Salva la bozza» risponde che l'operazione non esiste;
   - Approve and deploy.
