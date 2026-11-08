# MEMO gestisce il piano dell'investimento (08/11/2026)

Migrazione `20261108000003_memo_gestisce_il_piano`. È la PR8a, cioè l'aggiunta D del piano del 07/11 per la parte di MEMO in chat. La parte della Posta è la PR8b.

## Cosa c'è
- **Tre operazioni nuove di MEMO**, dette a voce o scritte. Prima del sì non si scrive niente.
  - `piano_collega`: una spesa del progetto va su una voce. Passa da `segna_investimento`, la stessa porta della spunta, e collega tutto il resto non assegnato.
  - `piano_voce_aggiorna`: stato, previsto IVA inclusa o nota di una voce. La nota nuova si aggiunge a quella vecchia.
  - `piano_voce_nuova`: gruppo, descrizione, previsto. Se l'aliquota non è detta è al 22%; se lo stato non è detto, la voce nasce «stimata».
- **Il catalogo di MEMO** porta, numerate, le voci del piano e fino a 40 spese del progetto con un resto da assegnare. Gli id non escono. La numerazione sta in una funzione sola, `piano_per_memo()`.
- **Con un dubbio** il modello mette `sicuro: false` e le alternative. Se manca qualcosa, l'anteprima lo dice.
- **Al sì si ricontrolla tutto.** L'id salvato vince sul numero, che nel frattempo può indicare un'altra riga.
- **Solo il titolare.** Lo staff riceve un rifiuto detto in italiano.
- **Schermata**: gli appunti mostrano «voce del piano», «spesa», «adesso è…», senza gli identificativi.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - le reti dei tipi, cioè ramo e uscita;
  - catalogo numerato senza id;
  - collegamento, ricontrollo al sì e spesa già in parte sulla stessa voce;
  - aggiornamento e nota aggiunta;
  - id che vince sul numero;
  - zero e stato inventato;
  - voce nuova coi ripieghi e doppione;
  - portiere dello staff.
- **Provata su Prova** in una transazione annullata prima di applicarla, poi applicata con il sì di Alessio: 465 migrazioni.
- **Revisione `ecc:database-reviewer`:** corretti l'id che vince sul numero, gli importi zero/NaN/enormi, la nota che cancellava e la verifica più ampia. Il «critico» sul catalogo per lo staff non vale: `voce_catalogo()` era già riservata al titolare.
- **Prove pure:** 2887, con le etichette nuove degli appunti.

## Applicazione su work
I numeri si aggiungono dopo.
