# MEMO propone le rate quando cambia il previsto (14/11/2026)

Migrazione `20261114000010_le_rate_si_propongono`. Nessun commit creato, come richiesto.

## Cosa c'è

- Quando MEMO propone di cambiare il previsto di una voce del piano che ha rate, aggiunge nello stesso appunto una seconda azione `piano_rate_ricalcola`, già compilata.
- Le rate restano negli stessi mesi e nello stesso numero. Le rate ancora senza coperture seguono le proporzioni degli importi precedenti; l'ultima prende i centesimi rimasti, quindi la somma torna al nuovo previsto esatto.
- Una rata coperta anche solo in parte da una spesa o fattura non viene riscritta. È la scelta prudente: il suo importo è già legato a denaro reale. Se il nuovo previsto è più basso di quelle rate, o non lascia niente alle aperte, MEMO non propone le rate e lo spiega nell'anteprima.
- Al sì, il calcolo viene rifatto nella stessa transazione. L'identificativo salvato della voce continua a vincere sul numero del catalogo.
- Se viene approvata solo la riga delle rate, usa il previsto attuale della voce. È un no-op quando la modifica del previsto non è entrata: così non può creare rate per una cifra che la voce non ha mai avuto.
- La seconda riga è leggibile negli appunti, per esempio `Rate: 3 × 3.266,67 € (prima 3 × 3.000 €)` quando i centesimi non richiedono un'ultima rata diversa. Identificativi e dati tecnici restano nascosti.
- Il portiere resta il titolare, come per le altre operazioni del piano.

## Verifica dentro la migrazione (annullata, zero residui)

1. Il tipo nuovo ha ramo e uscita nelle reti dei comandi vocali.
2. Cambiando 9.000 € in 9.800 €, MEMO prepara tre rate, conserva i mesi e la loro somma fa 9.800 €.
3. La dettatura crea esattamente due azioni nello stesso appunto; la seconda contiene le rate già calcolate.
4. Approvandole insieme, previsto, somma delle rate e mesi restano corretti.
5. Una rata già coperta non cambia; il resto viene distribuito solo sulle altre.
6. Una voce senza rate non riceve alcuna proposta; l'id della voce batte un numero di catalogo vecchio.
7. Lo staff viene respinto.

## Prove

- `tests/unita/appunti-in-chiaro.test.js` controlla l'etichetta leggibile delle rate, senza identificativi.
- `tests/app/appunti-vocali.test.js` aggiunge la prova contro il database: una modifica del previsto crea la seconda azione, nello stesso appunto, con tre mesi e 9.800 € totali. Non è stata eseguita, perché parla al database.

## Cosa abbiamo rovesciato

1. **Cosa era stato deciso e quando**: l'11/11/2026, nella migrazione `20261111000003`, cambiando il previsto MEMO avvisava che le rate non tornavano e chiedeva di sistemarle a mano dalla pagina del piano.
2. **La ragione di allora**: il gestionale non sapeva scegliere da solo in quali mesi distribuire il nuovo totale.
3. **Cosa si decide adesso**: dopo la risposta di Alessio del 13/11, MEMO propone le rate già compilate, mantenendo mesi e numero e ricalcolando gli importi in proporzione.
4. **Perché la ragione non vale più**: la regola sui mesi è stata decisa dal titolare. Il prezzo accettato è che MEMO non inventa nuovi mesi e non cambia le rate già collegate a pagamenti; nei casi incompatibili avvisa invece di forzare una proposta.

## Applicazione su work

1. Confrontare prima i corpi vivi indicati nell'intestazione della migrazione, in particolare `voce_risolvi_piano`, `fai_piano_memo` e `scrivi_dettatura`.
2. Applicare `20261114000010_le_rate_si_propongono` dopo la PR 1 (`20261114000001`).
3. Non serve reinstallare funzioni online: la seconda azione viene costruita dal database mentre registra l'appunto.

## Revisione (Claude, 14/11)

Codice scritto da ChatGPT, rivisto da Claude. Corretti prima della consegna: le ancore di `scrivi_dettatura` (rientro del testo vivo), un cast nella verifica e la fattura di prova segnata come investimento. Provata a secco e applicata su Prova (490 migrazioni). Da fare in una migrazione a parte (trovati da `ecc:database-reviewer`): rata a zero o negativa se il resto è di pochi centesimi; la seconda azione nasce anche se la prima ha un «manca».
