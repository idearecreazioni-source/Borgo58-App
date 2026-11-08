# Le fatture dalla PEC (08/11/2026)

Migrazione `20261108000001_la_fattura_dalla_pec`. È il rilascio di «fatture dalla PEC», nelle PR #336, #337, #338 e #339, unite su master con la #341.

## Cosa c'è nel database
- **Il tipo `registra_fattura`** è ammesso fra le proposte della posta (vincolo `posta_azioni_tipo_check`).
- **`registra_fattura_dalla_posta(p_azione_id)`**, riservata al titolare:
  - controlla che la proposta esista, che sia una registrazione di fattura e che non sia già decisa;
  - pretende una sola società Borgo 58 (srls);
  - registra la fattura con `registra_fattura_elettronica`, con i dati che il codice ha letto dall'XML;
  - segna la proposta come fatta, con il numero della fattura, attraverso `esegui_azione_posta`, che non è stata riscritta.
- Possono chiamarla solo gli utenti entrati (`authenticated`). Il controllo «solo il titolare» è dentro la funzione.

## Cosa c'è nelle funzioni e nella pagina
- **posta-in-arrivo:** salva il mittente vero e l'oggetto pulito della busta PEC.
- **posta-leggi:**
  - tace sui file tecnici della busta e sulle ricevute del gestore;
  - legge XML e .p7m come testo;
  - costruisce dal codice la proposta «Registra la fattura n. X»;
  - dice «è già registrata» quando la fattura c'è già;
  - non fa doppioni di proposte.
- **operazioni-atomiche:** ammette `registra_fattura_dalla_posta`.
- **Pagina Posta:** mostra il mittente vero, l'oggetto pulito, la casella («a borgo58@pec.it») e i tasti «Registra la fattura n. X» / «Non registrarla».

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola), con 8 prove:
  - la fattura nasce su Borgo 58;
  - la proposta risulta fatta;
  - la seconda pressione dice «già fatta»;
  - il doppione è rifiutato;
  - un promemoria non passa;
  - lo staff è rifiutato;
  - anon è rifiutato.
- **Revisioni:**
  - `ecc:database-reviewer` sulla migrazione;
  - revisioni ECC sulle funzioni (mittente falso, ricevute, XML tagliati, doppioni): tutto corretto prima dell'unione.
- **Prove:** 2864 prove pure e 586 prove della schermata in locale, poi tutti i Controlli verdi su ogni PR e su slave.
- **Prova:** migrazione applicata e le tre funzioni pubblicate prima di work.

## Applicazione su work
- Copia di sicurezza: `2026-11-08_1136`.
- I numeri dell'applicazione si aggiungono dopo.
- ⚠️ Questa scheda è arrivata in ritardo: andava nella #339. `npm run migra` ha fermato il giro prima di toccare work, come deve.
