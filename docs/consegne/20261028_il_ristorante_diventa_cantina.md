# Il ristorante diventa cantina, e «Da nessuna parte» se ne va — 28/10/2026

Alessio, guardando la scheda dell'impegno, ha scritto: *«trovo inutile il tasto "da nessuna parte" preselezionato. possiamo tenere solo "casa" e "al ristorante" (che chiamerei cantina) che seleziono se serve»*. La richiesta mi è arrivata dalla sessione madre.

## Cosa cambia
- **Nella scheda dell'impegno** restano due tasti, «a casa» e «in cantina». Di partenza nessuno è acceso, e toccare di nuovo quello acceso lo spegne: l'impegno si salva senza luogo.
- **Migrazione `20261028000006_il_ristorante_diventa_cantina`:**
  - gli impegni con `luogo = 'ristorante'` passano a `'cantina'`;
  - il vincolo `luogo_chiuso` ammette `casa` e `cantina`;
  - in `fai_azione_dettata`, cioè nella voce, sia «cantina» sia «ristorante» vanno in cantina;
  - `luogo_promemoria`, quello che legge il telefono, conosce casa e cantina.

  I due corpi delle funzioni sono stati toccati sul posto, come nella 20261028000002.
- **Funzioni online:**
  - `promemoria-luogo`: la notifica dice «Cantina: …»;
  - `ascolta-voce`: l'istruzione chiede `"cantina"`, anche quando Alessio dice «ristorante».
- **Il resto:** `TASK_LUOGHI` in `src/lib/constants.js` dice `cantina` / «Cantina» / «in cantina». Da lì lo seguono l'Agenda («Quando arrivo: Cantina»), la pagina «Quando arrivo…» e la rete dei vocabolari.

## Le scelte
- **Cambia anche il valore, non solo la scritta.** La parola si vede: è quella che Alessio scrive nell'automazione dell'iPhone (il campo «luogo»), e la pagina «Quando arrivo…» gliela mostra. Oggi costa poco, perché l'automazione del ristorante non è ancora stata creata e nessun telefono manda «ristorante».
- **La voce che dice ancora «ristorante» va in cantina.** È lo stesso posto: farlo nascere senza luogo vorrebbe dire non ricordarlo mai. L'alias è in tre punti: la funzione del database, l'istruzione della voce e la scheda che riceve una dettatura.

## Revisione ECC
**ecc:code-reviewer** non ha trovato difetti bloccanti, e conferma quattro cose:
- l'ordine della migrazione è corretto, e nessun trigger su `tasks` può fallire sull'aggiornamento;
- le sostituzioni sul posto sono esatte e idempotenti;
- un luogo spento si salva come vuoto;
- non resta nessun «ristorante» come luogo nel codice.

Il riepilogo dei [promemoria per luogo](20261028_i_promemoria_per_luogo.md) resta com'era, perché racconta quel giorno: questo file ne è il seguito.

## Numeri, misurati
- **Su Prova:** applicata, con la verifica passata fino a «Provato e annullato: zero residui». Prova ha 448 migrazioni.
- **Funzioni online su Prova:** `promemoria-luogo` dalla versione 2 alla 3, `ascolta-voce` dalla 46 alla 48 (installata due volte, la seconda con l'ordine dei valori corretto).
- **Prove delle schermate:** 62 file, **472 passate**. La prova del luogo nella scheda controlla che «Da nessuna parte» non ci sia, che nessun luogo sia acceso di partenza e che toccare due volte spenga.
- **`tests/unita/luogo-promemoria.test.js`:** 10 passate. Legge il vincolo dalla 20261028000006.
- **`npm run lint -- --max-warnings=0`:** pulito.

## Non verificato
- **Produzione:** non toccata. Ci vanno la migrazione e le due funzioni online, col rilascio, dopo l'ok di Alessio.
- **La voce dal vivo** («quando arrivo in cantina ricordami di…») non l'ha detta nessuno: è provata nella verifica della migrazione, non con l'assistente vero.

## Dato per fatto senza misurarlo
- Che nessuna automazione dell'iPhone mandi già «ristorante». Lo ha scritto la sessione madre; in produzione la notifica è stata installata oggi.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
- Il disegno di stamattina («Da nessuna parte» acceso di partenza, poi casa e ristorante) lo ha rovesciato Alessio stesso guardandolo: **due luoghi soli, spenti di partenza, e la cantina al posto del ristorante**.
