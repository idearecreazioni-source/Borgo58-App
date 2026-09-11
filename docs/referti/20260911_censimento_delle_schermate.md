# Il censimento delle schermate — 11/09/2026 (mandato notturno 2, fase 1)

La mappa verificabile chiesta dal mandato: per ogni difetto trovato, **dove sta,
come è stato visto, e che fine ha fatto**.

La regola seguita:
- si corregge solo ciò che è un difetto osservabile, in un file che nessuna PR
  aperta tocca;
- ciò che sta nei file delle PR #57, #58 e #59 si segnala e basta;
- ciò che è una scelta si lascia ad Alessio.

---

## 1. Come è stato fatto

Due censimenti, indipendenti.

### A. Il censimento visivo (schermate aperte davvero)

**La copia misurata.** Una copia **solo locale**: master `59f4d2d` più le PR
#57, #58 e #59, unite in un ramo mai pubblicato e poi cancellato
(`solo-locale-integrazione`, `c6cebd8`). Così un difetto già curato da una PR
aperta non compare.

**Il collegamento.** Il gestionale vero, collegato **solo a Borgo58-Prova**,
entrato come titolare di collaudo con le credenziali di `.env`, mai stampate.

**Le schermate: 98.** Sono le 88 rotte del router e 10 preparazioni del
censimento della #57, che aprono un modulo o attivano un filtro senza mai
premere «Salva».

**Le forme: 4, per 392 viste.**
- iPhone 390;
- iPhone largo 440;
- caratteri grandi (390 a 64 punti per cm);
- computer 1280.

**Nessuna scrittura sui dati.** Nel browser (protocollo di Chrome, `Fetch`) si
è fermata ogni richiesta verso il database che non fosse una lettura:
- inserimenti, modifiche e cancellazioni;
- le funzioni online;
- le chiamate a funzioni del database che scrivono. L'elenco è stato calcolato
  leggendo i corpi delle 448 funzioni di `public` in una sessione **a sola
  lettura imposta dal database** (`default_transaction_read_only`): 287 leggono,
  161 scrivono o chiamano chi scrive.

**Le scritture fermate: 14, da due sole schermate, e sono comportamenti noti.**
- Lista della spesa, `add_below_threshold_items`: il controllo del
  sotto-soglia all'apertura, deciso il 13/08.
- Schede prodotto: la funzione online `schede-prodotto`, chiamata all'apertura
  per contare i prodotti da compilare.

**L'unica scrittura non fermata** è la sessione di accesso dell'utente di
collaudo, come nel censimento della #57.

**Misurato per ogni vista:**
- pagina che scorre di lato;
- controlli fuori dallo schermo;
- controlli sovrapposti;
- pulsanti con la scritta tagliata;
- testi con codici tecnici (`parola_parola`), identificativi e gergo;
- la parola «task»;
- le frasi lunghe sempre visibili.

**Provato prima su risposte note.**
- In Agenda trova «+ Nuovo task».
- Sulla Lista della spesa ferma le due scritture dell'apertura.
- Sulla Dashboard trova «fisco_scadenze».

⚠️ **Il primo giro si è fermato dopo 20 viste**, sull'elenco degli
ingredienti: 747 pulsanti confrontati a coppie. Il confronto ora si fa solo
fra elementi alla stessa altezza, e ogni misura ha un tempo massimo.

### B. Il censimento dei testi (lettura del codice)

Sono state lette tutte le 90 pagine e i componenti che usano, cercando
quattro cose:
- spiegazioni sempre visibili;
- dettagli tecnici o di provenienza nel posto sbagliato;
- parole diverse per la stessa cosa;
- frasi ripetute.

⚠️ Da qui **nessuna correzione è partita senza essere riverificata sul codice
di master**, e le frasi che un commento dichiara volute da Alessio non sono
state toccate.

---

## 2. Cosa è stato corretto, e dove

| PR | cosa | come si è visto |
|---|---|---|
| **#60** | «task» → «impegno» in 9 frasi a schermo | censimento visivo (Agenda, scheda, Dashboard) e dei testi |
| **#61** | allergeni di un piatto: una lettura fallita diceva «Nessun allergene risulta…»; la riga «non riesco a leggere» ignorava o spezzava la frase della schermata | censimento dei testi, riverificato; prova rossa su master |
| **#62** | aprire una prenotazione **servita** dava una **pagina bianca**; nell'elenco due stati avevano l'etichetta illeggibile | censimento visivo: `/calendario-eventi/:id` non si apriva in nessuna forma; prova rossa su master |
| **#63** | codici del database a schermo: scheda ingrediente («stock_lots…», fonte del prezzo), Editor menu («finger_food»), Cantina («liquori»), Prestiti («cassa»), stagioni del menu | censimento visivo e dei testi; prova rossa su master; censimento dopo: nessun codice |
| **#64** | coi caratteri grandi la scheda di un fornitore scorreva di lato (470 su 390) | censimento visivo prima e dopo |
| **#65** | quattro frasi non più vere: «Struttura 4-4-4-2» (Ricettario), «caricato dal foglio, chiuso e non più ritoccabile» (Proiezione fiscale), «scegli «Avuta gratis»» (Lista della spesa, il pulsante si chiama «Me l'hanno regalato»), «le ore qui sotto» (previsione, sono sopra) | censimento dei testi, riverificato sul codice; fotografie dopo |

---

## 3. Il censimento visivo, tutte le segnalazioni

| schermata · forma | segnalato | esito |
|---|---|---|
| `/calendario-eventi/:id` · tutte | non si apre (errore alla riga 334) | **corretto, #62** |
| `/magazzino/fornitori/:id` · caratteri grandi | menu fuori (40–417), pagina 470/390 | **corretto, #64** |
| `/ricettario/ingredienti/:id` · tutte | codici `stock_lots`, `recipe_ingredients`… | **corretto, #63** |
| `/editor-menu` · tutte | codice `finger_food` | **corretto, #63** |
| `/dashboard` · tutte | codici `fisco_scadenze`, `haccp_locale`; «Task di oggi» | parole: **#60**; codici: file della **#58**, segnalato (§4) |
| `/agenda`, `/agenda/nuovo`, `/agenda/:id` | «task» | **#60** |
| `/fotografa` · caratteri grandi | «📷 Fotografa» sopra altri controlli | **falso allarme**: pulsante fisso in basso; la sovrapposizione esiste solo nella fotografia della pagina intera |
| `/detta` · 390, 440 | «Premi e parla» sopra un altro controllo | **non verificato**, stessa forma del caso sopra (pulsante fisso); file della #57 e della #58 |
| `/comande/bar` · caratteri grandi | «?» sopra «✓ Evaso» | **falso allarme**: «✓ Evaso» è dentro un riquadro che scorre, tagliato e non visibile (fotografia guardata) |
| `/personale/mance` · tutte | «Rimuovi» e «€» sovrapposti | **falso allarme**: righe tagliate dal riquadro che scorre (fotografia guardata); file della #57 |
| `/calendario-eventi/clienti/:id`, `/agenda/:id`, `/magazzino/fornitori/:id`, `/fiscale/deducibilita` | sovrapposizioni di 8 punti | **falso allarme**: margine negativo voluto di `tocco-testo` (0,5 rem per lato) |
| `/magazzino/produzioni`, `/magazzino/fermi` (pannelli) | non misurati | sul progetto di prova non ci sono preparazioni né partite |

**Nessun'altra schermata** ha dato pagine che scorrono, controlli fuori dallo
schermo o scritte tagliate nelle quattro forme.

⚠️ **I limiti dello strumento**, scritti perché il prossimo censimento li
corregga:
- non sa che un elemento dentro un riquadro che scorre è tagliato;
- conta come sovrapposizione il margine negativo di `tocco-testo`;
- è Chrome, non Safari;
- misura i controlli, non ogni testo;
- è entrato solo come titolare.

Lo strumento non è committato: usa il pilota di Chrome della #57
(`chrome-senza-schermo.mjs`), che su master non c'è. Va portato nel repository
dopo l'unione della #57.

---

## 4. Trovati nei file delle PR aperte — segnalati, non toccati

**Nei file della PR #58**
- 🔴 **La spunta della Dashboard chiude un impegno ricorrente senza far
  nascere il successivo.**
  - `Dashboard.jsx:113` usa `updateTask(…, {status: "completato"})`.
  - Il successivo lo crea solo `completa_task`; nessuno dei tre trigger su
    `tasks` lo fa (letto nel codice e nelle migrazioni).
  - Oltre al file della #58, il mandato vieta di toccare la logica di
    completamento.
- La Dashboard mostra la categoria come codice: «· fisco_scadenze»,
  `Dashboard.jsx` `{t.category}`. È stato visto dal censimento visivo.
- «Elimina» nella scheda di un impegno non chiede conferma (`TaskForm.jsx`).

**Nei file della PR #57**
- «Sala e orari»: un campo legge `service_settings.ora_primo_turno`, colonna
  tolta il 18/08. Segnalato dal censimento dei testi, **non riverificato**.
- Lettura del codice, non riverificati:
  - «Previsione»: la stessa colonna mescola «cassa», «contante», «banca»,
    «bonifico»;
  - «Sconti e omaggi»: il nome del tablet su ogni riga.

**Nei file delle PR #57 e #58**
- In MEMO voce, la stessa frase d'errore compare due volte, nella striscia e
  nel riquadro giallo (`Detta.jsx`). Letto dal censimento dei testi.

**Da trasformare in «?», come chiede il mandato alla #57**
- La frase sugli impegni automatici riservati, nella scheda di un impegno.
- Le didascalie di «Sala e orari» (una dozzina).
- Le spiegazioni di «Previsione», «Sconti e omaggi», «Sezione personale» e
  «Mance».

---

## 5. Trovati e lasciati ad Alessio (sono scelte, non difetti)

1. **I finger food non hanno una sezione, in due posti.**
   - Il menu stampato: `EditorMenuHome`, `CATEGORY_ORDER`.
   - La scheda di un menu: `MenuDetail`, `SECTIONS` e
     `itemsByCategory = { antipasto, primo, secondo, dolce }`, dove
     `map[i.category]?.push(i)` scarta in silenzio le altre categorie.

   Se un piatto finger food è in un menu, non esce sul foglio e non compare
   in nessuna sezione della sua scheda. **Letto nel codice, non provato con
   un menu vero.** Prima va deciso se un finger food possa stare in un menu,
   e dove.
1-bis. **La scatola degli allergeni dell'Editor menu** (`EditorMenuHome`,
   righe 226-233 circa) dice che gli allergeni sono «solo stimati… finché non
   li confermi». Secondo il censimento dei testi, è la regola tolta il
   25/08/2026. **Non riverificato.** È un testo sugli allergeni stampati:
   nel dubbio non si tocca, lo guarda Alessio.
2. **Parole diverse per la stessa cosa**, fuori da «task»: in questa pagina
   solo le principali. Le altre stanno nell'elenco completo del censimento dei
   testi, che non è committato.
   - «promemoria» ha tre significati;
   - «appunto», «le cose che hai dettato», «in sospeso»;
   - «Laura» e «la commercialista»;
   - «coperti», «persone» e «ospiti»;
   - «giro», «turno», «ultimo ingresso» e «ultimi arrivi»;
   - «soglia» e «scorta minima»;
   - «partita» e «lotto»;
   - «Caricamento…», «Sto guardando…» e «Carico…»;
   - «(opzionale)», «(opz.)» e «(facoltativo)».
   Uniformarle vuol dire scegliere la parola: una decisione per volta.
3. **Spiegazioni sempre visibili candidate al «?» o a sparire**, in file liberi:
   - la scatola rossa della schermata iniziale HACCP (validazione del
     consulente);
   - «Una richiesta non tiene nessun tavolo…» in cima al Calendario;
   - le tre spiegazioni di «Causali»;
   - «Quanto è entrato e quanto ha un documento fiscale…» in «Incassato e
     scontrinato»;
   - le spiegazioni di «Schede prodotto», «Posta in arrivo» e «Previsioni».

   Toccano scelte economiche o fiscali, o il modo in cui Alessio legge la
   schermata. Il mandato dice: nel dubbio non si toglie, si segnala.
4. **Sottotitoli e descrizioni delle schermate iniziali** che elencano il
   contenuto: Ricettario, Proiezione fiscale, Personale, Magazzino. Le due
   frasi **non più vere** fra queste («Struttura 4-4-4-2»; «caricato dal
   foglio, chiuso e non più ritoccabile») sono corrette in **#65**, togliendo
   solo la parte falsa. Il resto, cioè se una schermata iniziale debba
   elencare il suo contenuto, è una scelta di disegno.
5. **Il gergo sulle schermate del titolare**: «token» (costo delle domande),
   «(domande L4 e L9 per Laura)», il nome del modello in «letto con …»,
   «what-if», «food cost target». Sono informazioni che Alessio usa: se e come
   riscriverle è una sua scelta.

---

## 6. Proposta per il prossimo mandato

1. **La spunta della Dashboard**, dopo la #58: chiudere dalla Dashboard come
   dall'Agenda (`completaTask`), così un ricorrente fa nascere il successivo.
   È l'unico difetto trovato che cambia un dato.
2. **Portare lo strumento del censimento nel repository** dopo la #57, con i
   due limiti corretti (tagli dei riquadri, margini di `tocco-testo`). Poi
   farlo girare come prova, così un difetto visivo nuovo diventa rosso da solo
   invece di aspettare un collaudo.
3. **Un giro di «?»** sulle spiegazioni del §5.3, una schermata alla volta,
   con Alessio che decide quali restano visibili.
4. **Un vocabolario unico**, §5.2: una tabella di poche righe con la parola
   scelta per ogni cosa.
