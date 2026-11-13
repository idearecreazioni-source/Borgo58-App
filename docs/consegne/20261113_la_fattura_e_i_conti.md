# La fattura e i conti (13/11/2026) — pezzo 5a di 5

Commit sotto questa consegna: `4f7f1dd9`. Migrazione `20261113000007_la_fattura_e_i_conti`. `operazioni-atomiche` ha quattro voci nuove.

Piano approvato da Alessio il 13/11 («sì, approvo»), dopo due sue correzioni:
- «la fattura non deve essere promessa: si può emettere al momento» (il giro dalla chiusura del conto è il pezzo 5b);
- «non posso stare lì a digitare Incassata controllando i bonifici: si riconciliano in automatico quando carico l'estratto conto».

Turno di Prova dato dalla chat madre.

## La regola: un euro si conta una volta
- **Fattura dal conto di un tavolo**: incasso e ricavo ci sono già, dalla chiusura del conto. La fattura **non aggiunge niente**. Quando prende il numero, il conto diventa «fattura fatta» con quel numero e quella data, nella stessa transazione e prima che la mail parta.
  - Se intanto il conto ha avuto lo scontrino, la fattura non prende il numero e non parte.
  - Un conto ha una sola fattura, e un conto scontrinato non si fattura.
- **Fattura senza tavolo** (evento, catering): l'incasso entra da qui.
  - **Contanti** → cassa, **carta** → banca: da soli, quando la fattura parte. Se l'incasso non si può scrivere (per esempio non c'è un conto in banca), la fattura parte lo stesso e arriva un avviso. In pagina c'è «Segna incassata».
  - **Bonifico e assegno** → quando si carica l'estratto conto (CSV o CBI), il gestionale li **incassa da solo** solo se valgono tutte queste condizioni:
    - lo stesso importo al centesimo;
    - **una sola** fattura possibile;
    - **il numero della fattura scritto nel bonifico**;
    - nessun'altra entrata uguale in attesa;
    - nessun movimento di prima nota che potrebbe essere lui.

    In tutti gli altri casi la fattura è **proposta** fra i movimenti da abbinare, con «Incassa questa fattura»: un tocco.
- ⚠️ **Il solo nome del cliente non basta per l'automatico.** È la decisione di Alessio dell'11-12/11 sugli avvisi della banca, ricordata dalla chat madre: in automatico solo quando è certo, cioè importo esatto più un riferimento univoco. La revisione ha poi mostrato che un nome come «Pasticceria» o «Mario» è troppo comune. Ad Alessio era stato detto «nome o numero»: la regola è stata stretta dopo, e glielo si dice.
- **Il numero non si legge dentro una data**: «13/11/2026» non è la fattura 11. Valgono «fattura 12», «FT. N. 12/2027» e «12/2027» con l'anno intero.

## Cosa entra
- La causale «Incasso fattura» (di sistema).
- `cash_movements.fattura_emessa_id`: un incasso per fattura. Non si cancella a mano, stessa regola dei pagamenti ai fornitori: si usa «Annulla l'incasso».
- La guardia `fattura_dal_conto_guardia`: conto chiuso, non scontrinato, non già fatturato, una fattura sola anche in bozza.
- Il trigger `fattura_emessa_effetti`: numerata → il conto diventa «fattura»; partita senza tavolo in contanti o carta → l'incasso, che non ferma mai la spedizione.
- `proposte_movimento_banca` ripresa identica, con il genere nuovo `fattura_emessa` (solo fatture partite davvero).
- I gesti, tutti del titolare e tutti dal corridoio:
  - `incassa_fattura_da_movimento_banca`;
  - `incassa_da_soli_bonifici` (un guasto su un'entrata non disfa le altre);
  - `incassa_fattura_a_mano`;
  - `annulla_incasso_fattura`.
- **La pagina della banca**: dopo il caricamento dice «N fatture ai clienti incassate da sole» con l'elenco. Un errore dell'abbinamento non dice «non ho caricato niente».
- **La pagina delle fatture**: per ogni fattura uscita una riga sui soldi:
  - «Pagata al tavolo»;
  - «Incassata il … in banca/cassa»;
  - «Da incassare: …».

  Ci sono anche «Segna incassata» e «Annulla l'incasso».

## Revisione (ecc:database-reviewer)
Corretti:
1. **(alta)** Il numero della fattura si trovava dentro le date. Ora no, ed è provato nella verifica.
2. **(alta)** Il nome bastava con una parola comune. Ora il nome conta solo per ordinare le proposte, a parole intere e fuori da una lista di parole comuni. L'automatico vuole il numero.
3. **(alta)** Un guasto a metà disfaceva tutti gli abbinamenti, e due entrate uguali per una fattura sola: corretti entrambi.
4. **(media)** La carta senza conto in banca: l'avviso resta la strada prevista, e ora c'è «Segna incassata».
5. **(media)** Uno scontrino stampato fra la bozza e l'invio: il conto non si sovrascrive e la fattura non parte.
6. **(media)** Dopo «Annulla l'incasso» di contanti o carta non c'era modo di rifarlo: c'è «Segna incassata».
7. **(media)** Due bozze per lo stesso conto: ora la frase è leggibile.
8. **(media)** La verifica toccava le entrate vere: ora le mette da parte (e si annulla tutto).
9. **(bassa)** Si poteva incassare una fattura non ancora partita: ora solo le partite.

⚠️ **Detto, non corretto**: la frase finale della verifica (il `notice`) dice ancora «il bonifico col nome del cliente si incassa da solo». È stata scritta prima di stringere la regola, e la migrazione era già applicata su Prova, quindi non si riscrive. Il codice e la verifica fanno la cosa giusta: col solo nome la verifica (4a) pretende la proposta e **niente** incasso automatico.

## Verifica dentro la migrazione (annullata, zero residui)
1. La fattura dal tavolo: il conto diventa «fattura» col numero, e nessun incasso in più.
2. Un conto scontrinato non si fattura, e un conto ha una fattura sola.
3. Contanti: alla partenza c'è l'incasso in cassa, uno solo.
4. Bonifico:
   - alla partenza niente;
   - col solo nome diventa proposta, non incasso (4a);
   - una data che contiene il numero vale 0;
   - col numero si incassa da sola, in banca, sul conto giusto (4b).
5. Due fatture con lo stesso importo: niente da solo, due proposte.
6. «Annulla l'incasso» libera il bonifico.
7. L'incasso non si cancella a mano, e lo staff non incassa.
8. Le frasi.

## Su Prova (13/11)
- Prima a secco quattro volte (due campi obbligatori dei movimenti della banca mancavano nella verifica), poi `prova:migra`: 485 migrazioni.
- `operazioni-atomiche` è installata su Prova.
- Nessun dato lasciato.
- ⚠️ **Non provato dal vivo nella pagina**: il caricamento di un estratto conto vero con un bonifico per una fattura. È provato nella verifica (sul database vero di Prova) e nelle prove di schermata.

## Prove
- `tests/schermate/banca-csv.test.jsx`: dopo il caricamento le fatture si incassano da sole e la pagina lo dice; se l'abbinamento non riesce, il caricamento resta fatto e lo dice.
- `tests/schermate/fatture-clienti.test.jsx` (13): i soldi delle fatture uscite («al tavolo», «incassata», «Segna incassata»).
- Le prove di schermata della banca sanno le due funzioni nuove.

## Cosa abbiamo rovesciato
Niente di nuovo. Il rovesciamento della decisione del 14/08 (Fatture in Cloud) è già dichiarato con il pezzo 1, voce 110.

## Rilascio su work (solo col sì di Alessio)
1. Le migrazioni `20261113000002`-`07`.
2. Le funzioni `operazioni-atomiche`, `fattura-spedisci` e `posta-leggi`.
3. Approve and deploy.

## Resta (pezzo 5b)
- La Proiezione conta il ricavo delle fatture **senza tavolo**, alla data della fattura.
- La fattura si apre direttamente dalla chiusura del conto («vuole fattura»).
