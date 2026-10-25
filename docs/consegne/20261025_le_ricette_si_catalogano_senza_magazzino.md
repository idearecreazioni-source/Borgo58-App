# Le ricette si catalogano senza collegare il magazzino

**25/10/2026** · richiesta di Alessio · commit sotto questo riepilogo: `430b12b` (il lavoro è `6053af4` + `430b12b`) · ramo `claude/project-thread-7v8uro`, proposta verso `slave` · working tree pulito al commit

## Cosa ha chiesto

*«vorrei poter già catalogare tutte le mie ricette fin d'ora quindi vorrei che l'associazione avvenisse solo quando si dovrà calcolare il food cost e mettere effettivamente una ricetta tra le preparazioni e/o in menu»*. Più: «Bozze di ricetta» diventa «Bozze». Proposta approvata da lui («1 si»).

## Cosa cambia

**Migrazione `20261025000020_le_ricette_si_catalogano_senza_magazzino`.**

- Tabella `ricetta_ingredienti_da_collegare`. Contiene `recipe_id` (cascade), `posizione`, `nome` (obbligatorio), `quantita` (vuota o > 0), `unita` (testo libero), `nota`. Lettura aperta ad `authenticated`, scrittura solo al titolare, nessun permesso ad `anon`. Nel `perimetro_registro` è classificata **fuori**. I vincoli hanno la frase in italiano.
- ⚠️ Si è scelta una tabella a sé invece di `recipe_ingredients.ingredient_id` vuoto, perché `recipe_ingredients` la leggono 19 funzioni e 4 viste (costi, scarico, allergeni, fabbisogno). Una riga senza prodotto lì dentro avrebbe dovuto essere esclusa in ognuna, e la ventiquattresima lettura l'avrebbe dimenticata.
- `promuovi_bozza_ricetta` (corpo preso dalla `20261010000001`) cambia in due punti:
  - un ingrediente non collegato **non è più un buco**: va nella tabella nuova;
  - quantità e unità si pretendono solo sulle righe collegate.
- Tre trigger rendono obbligatorio il collegamento, e il rifiuto nomina **tutti** gli ingredienti scoperti:
  - quando la ricetta diventa `pronta_per_carta`;
  - quando entra in `menu_items`;
  - quando diventa componente di un'altra ricetta (`recipe_ingredients.component_recipe_id`).
- Il quarto trigger è lo specchio: una riga da collegare non si aggiunge a una ricetta che è già pronta, in un menu o usata come componente.
- `collega_ingrediente_ricetta(p_riga, p_ingredient_id)` passa dal corridoio, è `security definer` e ha il portiere del titolare. Rifiuta se manca la quantità o se l'unità non è del gestionale. In una transazione inserisce la riga in `recipe_ingredients` e la toglie dalla tabella nuova.
- `estrapola_ricette` segnala le righe «non collegato al magazzino».
- `duplica_ricetta` (dal corpo vivo) copia anche le righe da collegare.
- Il blocco di verifica ha sette passi ed è annullato alla fine (`pretendi_nessun_residuo`). Più l'auto-registrazione.

**Corridoio**: `collega_ingrediente_ricetta` in `OPERAZIONI`.

**Schermate.**
- «Bozze» al posto di «Bozze di ricetta».
- Nella bozza, la conferma dice quanti ingredienti restano da collegare.
- Nella scheda ricetta c'è la sezione «Da collegare al magazzino» (`IngredientiDaCollegare.jsx`). Nome, quantità e unità si correggono in posto; «Collega a un prodotto…» passa dal corridoio; «Togli» chiede conferma con un secondo tocco. L'esito compare sulla riga toccata.
- Accanto al costo compare «Parziale: N ingredienti da collegare al magazzino».
- Sopra gli allergeni compare «Elenco incompleto», con i nomi.
- La scheda dello staff mostra quelle righe fra gli ingredienti, senza poterle modificare.

## Verifiche

- `npm run lint` pulito. `npm run test`: **2281 verdi**. `npm run test:schermate`: **443 verdi**, comprese tre nuove (una bozza coi soli ingredienti non collegati si può confermare; la sezione e «Parziale» compaiono, e senza righe non compaiono). `npm run build` riuscito.
- **Progetto di prova**, dal PC di Alessio:
  - Il primo lancio si è **fermato sul passo (3c)**. La verifica usava come componente un piatto finito, e lo respingeva prima una regola più vecchia, con il suo messaggio. Il catalogo dopo il fallimento: nessuna tabella, nessun trigger, nessuna ricetta di prova. Corretto in `430b12b`: ora il passo usa una preparazione, e al passo (6) controlla che, tolta la riga, entri.
  - Con `430b12b`, migrazione verde due volte (idempotente). Registro da 429 a **430**.
  - Corridoio da versione 45 a **46**.
  - `npm run test:app` su `ricette-da-collegare`, `bozze-ricetta`, `permessi` e `vincoli-che-parlano`: **41 prove verdi su 41**.

## Cosa NON è verificato

1. **In produzione non c'è niente**: né la migrazione né il corridoio nuovo. Arrivano dopo il merge, con una copia di sicurezza fresca e l'ok di Alessio.
2. **Nessuna schermata è stata aperta** con gli occhi: sezione «Da collegare», «Parziale» ed «Elenco incompleto» sono provati solo dalle prove di schermata, con dati finti.
3. Non è stato misurato a 390 punti se la riga della sezione «Da collegare» sborda.
4. Le prove sull'app sono girate solo sui quattro file toccati, non sull'intera suite: quella la fa la coda su GitHub.

## Cosa abbiamo rovesciato

- **Cosa era stato deciso e quando**: il 06/10/2026 (`20261006000001`), un ingrediente di bozza non collegato era un buco, e la promozione a ricetta lo rifiutava.
- **La ragione di allora**: una ricetta con righe senza prodotto mostrerebbe costo e allergeni che sembrano interi e non lo sono.
- **Cosa si decide adesso**: la ricetta nasce lo stesso, con quelle righe a parte. Il collegamento è obbligatorio, per vincolo del database, per carta, menu e uso come preparazione.
- **La ragione di allora vale ancora, e questo è il prezzo che accettiamo**: costo e allergeni sono parziali finché restano righe da collegare, e lo si dichiara a schermo. Una ricetta così non arriva in un menu né su un foglio per il cliente. Riga n. 106 in `docs/decisioni_rovesciate.md`.
