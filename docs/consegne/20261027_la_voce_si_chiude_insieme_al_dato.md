# La voce si chiude insieme al dato: prima nota e spesa spicciola — 27/10/2026 (notte)

**HEAD dichiarato sotto questo riepilogo:** `61c8ef6`, sul ramo `claude/voce-una-transazione` aperto da `origin/slave` `4a2716c`. Working tree pulito.
**Migrazione `20261026000002_la_voce_si_chiude_insieme_al_dato`: applicata SOLO al progetto di prova. `operazioni-atomiche` installata SOLO sul progetto di prova** (versione 46 → 47). Produzione non toccata.

## Origine
La verifica architetturale del 25/10 (voce P0.1 del piano) ha trovato una violazione della regola B4 in 11 schermate: una cosa detta a MEMO e finita a mano si salvava in due chiamate. Prima il dato, poi `useDaVoce().chiudi()` → `chiudi_azione_a_mano`. Un errore fra le due lasciava il dato scritto e la cosa «da fare», e la volta dopo la stessa spesa entrava due volte.

Alessio ha autorizzato il 26/10 sera il lavoro notturno, fermandosi alla copia di prova. Il piano per lotti è di `ecc:planner`. Questo è il primo lotto: Prima nota e Spesa spicciola, perché toccano i soldi.

## Cosa cambia
- **Migrazione `20261026000002`:**
  - `chiudi_azione_dalla_schermata(id, schermata, esito)`: controlla che la cosa detta si finisca da quella schermata, confrontando con `azione_percorso()` e non con un elenco di tipi, poi la chiude. Se rifiuta, dice che il dato non è stato registrato.
  - `registra_movimento_cassa(jsonb, uuid)`: scrive solo le colonne che la schermata manda, così i valori predefiniti restano. Rifiuta per nome un campo sconosciuto.
  - `aggiungi_spesa_spicciola(text, text, text, uuid)`.
  - Tutte `security invoker` (commentato): la RLS resta la barriera, come nell'insert diretto.
  - Verifica: giro completo, doppione rifiutato senza scrivere, tipo sbagliato, campo sconosciuto, appunto chiuso. Tutto annullato, zero residui.
- **`operazioni-atomiche`:** le due operazioni sono nell'elenco chiuso.
- **`src/lib/api/cash.js` e `spesaSpicciola.js`:** con `azioneDettataId` passano dal corridoio, senza l'insert diretto di sempre. Una rilettura fallita dopo il salvataggio non è più spacciata per un salvataggio fallito.
- **`src/lib/daVoce.js` e `calcoli/aMano.js`:** `idDaChiudere` e `segnaChiusa`. `chiudi()` resta per le 9 schermate dei lotti successivi.
- **`PrimaNota.jsx` e `SpesaSpicciola.jsx`:** passano l'id con la scrittura, e la seconda chiamata non parte più.

## Verificato
- `npx oxlint`: zero avvisi.
- Prove pure: verdi, salvo le 3 rosse già note per gli a capo CRLF di Windows (`bozze-col-lordo`, `indirizzo-funzioni-vault`), che in LF passano.
- Prove di schermata: 448 verdi.
- Progetto di prova, migrazione: applicata e riapplicata (idempotente). Il primo tentativo, prima delle correzioni, si era fermato sul controllo dei residui perché nello stesso momento le prove di GitHub scrivevano sullo stesso database. È stato annullato intero e rifatto a database libero.
- `npm run test:app` su `voce-chiusa-col-dato` (nuovo), `uscita-a-mano`, `migrazioni-senza-portieri` e `scritture-dal-corridoio`: 13 verdi, con il corridoio aggiornato installato sulla prova.
- Revisione `ecc:code-reviewer`: nessun rilievo alto. Accolti:
  - il percorso al posto dell'elenco di tipi;
  - il messaggio che dice che il dato non è entrato;
  - la rilettura tollerante;
  - un caso di prova in più.

## Non verificato
- Le schermate aperte davvero nel browser con una cosa detta: provate con le prove di schermata (finte) e dal client vero, ma non a mano.
- La suite completa `npm run test:app`: la gira la CI sulla proposta.

## Decisioni che spettano ad Alessio
1. **Cambia un comportamento.** Se la cosa detta era già stata finita (per esempio da un'altra scheda), oggi il movimento entra lo stesso. Con questa modifica viene rifiutato con il messaggio «… Quindi il movimento non è stato registrato.». È proprio il doppione che si toglie, ma è un rifiuto che prima non c'era.
2. **I lotti successivi:** magazzino (consumo, allineamento, carico), HACCP (temperature, pulizie), lista della spesa, agenda, ricette, ingredienti. Stesso schema, una proposta per lotto.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
- **Deciso il 23/08 (`spesaSpicciola.js`):** la spesa spicciola è «categoria A», una tabella sola senza corridoio.
- **La ragione di allora:** nessuna conseguenza altrove.
- **Cosa si decide adesso:** quando arriva dalla voce passa dal corridoio, perché le scritture sono due (la voce e la chiusura della cosa detta).
- **Perché la ragione di allora non vale più:** la ragione vale ancora per l'inserimento senza voce, che resta diretto. Con la voce la conseguenza altrove c'è, ed è la cosa detta da chiudere.
