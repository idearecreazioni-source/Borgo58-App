# Le spese «Da collocare», la via di ritorno e le pagine pubbliche

**12/10/2026.** Riepilogo per il validatore. La consegna comprende tutto ciò che
sta su `claude/align-prod-staging-data-zym1ue` e non è ancora su `master`: la
proposta #177, già unita in `slave`, e la #178.

⚠️ **Scritto PRIMA di applicare in produzione**, perché `npm run migra` lo
pretende («nessun riepilogo le nomina»). I numeri veri dell'applicazione vanno
aggiunti in fondo, alla voce § 7, dopo `--conferma`.

---

* **Ramo**: `claude/align-prod-staging-data-zym1ue`, proposta
  idearecreazioni-source/Borgo58-App#178 verso `slave`.
* **HEAD del codice coperto da questo riepilogo**: `2f846f7`. Questo documento
  è il commit sopra, ed è sola documentazione.
* **Working tree**: pulito dopo questo commit.
* **Controlli su GitHub per `2f846f7`**: tutti verdi — codice, prove pure e
  compilazione; prove visive in Chrome; prove contro il progetto di prova;
  cancello della filiera. Saltati, come previsto su un ramo, «Pubblica su
  Borgo58-Prova» e «Manda in produzione».

## 1 · Migrazioni (versioni per intero)

| versione | cosa | Prova | Produzione |
|---|---|---|---|
| `20261011000001` | «Estrapola la spesa» dalle ricette (`estrapola_ricette`, R11) | già applicata: il primo `npm run prova:migra` dell'11/10 sera ne ha trovata **una sola** da applicare, la `…002` | da applicare |
| `20261011000002` | le spese «Da collocare» (C12): tabella, guardiano, `annota_spesa_da_collocare`, `colloca_spesa`, `togli_foto_spesa`, il tipo vocale `spesa_da_collocare` e il suo ramo in `fai_azione_dettata` | applicata **al secondo giro** (vedi § 4) | da applicare |
| `20261011000003` | la via di ritorno: `annulla_collocazione_spesa`, `elimina_spesa_da_collocare`, il guardiano che ammette il solo ritorno, le frasi sui tre legami | applicata | da applicare |
| `20261011000004` | una foto, un appunto: `spese_da_collocare.chiave` (unica) e `annota_spesa_da_collocare` che alla stessa chiave restituisce l'appunto già scritto | **da applicare** (provata solo in locale, vedi § 3-bis) | da applicare |

Nessuna va saltata. Comando previsto: `npm run migra -- --conferma`, dopo
l'unione su `master` (il freno `nonAncoraSuGitHub` guarda `origin/master`).

## 2 · Funzioni online

| funzione | cosa cambia | Prova | Produzione |
|---|---|---|---|
| `ascolta-voce` | ogni spesa detta diventa `spesa_da_collocare` con la destinazione **proposta**; la riga sull'appunto la scrive `rigaDellaSpesa` invece del modello | installata il 12/10 | da installare |
| `leggi-foto` | riconosce uno scontrino o una fattura e restituisce `acquisto` (importo, data, esercente, cosa, documento, dubbi) | installata l'11/10 | da installare |
| `operazioni-atomiche` | `colloca_spesa`, `annulla_collocazione_spesa`, `elimina_spesa_da_collocare` | installata il 12/10 | da installare |

⚠️ `ascolta-voce` si installa con la verifica del token **spenta**, come
sempre: lo decide `SENZA_TOKEN` in `scripts/funzione.mjs`, non un flag.

## 3 · Cosa c'è dentro, in breve

* **C12 — Da collocare.** Tutte le spese dette a MEMO o fotografate diventano
  un appunto in `spese_da_collocare`, che **non è contabilità**. Alessio le
  colloca da `/cassa/da-collocare`: prima nota, la sua tasca, anticipo,
  archivio, oppure ignora. La foto resta finché la spesa non è collocata; in
  Archivio diventa il file del documento, altrove si toglie. Rovesciamento
  n. 99.
* **La via di ritorno.** Una collocata si annulla togliendo l'effetto nella
  stessa transazione; si respinge solo un anticipo già rimborsato. Un appunto
  mai collocato si toglie. Il guardiano si apre di un solo passo, nella forma
  esatta del ritorno, e dal browser la tabella si legge soltanto.
  Rovesciamento n. 100.
* **Le pagine pubbliche partono da sole.** `src/main.jsx` carica
  `src/Pubblico.jsx` per `/prenota` e `/privacy`, `src/App.jsx` per il resto.
  `npm run peso` sull'ultima compilazione: chi apre `/prenota` scarica
  **145,74 kB** compressi (tetto 160), chi apre il gestionale **415,32**
  (tetto 430). Prima della divisione la stessa misura dava 412,22 per tutti.
* **Dalla #177**: la bozza di ricetta in una schermata sola; Ricerca
  ricorrente e Monitoraggio social tolti, Agricolo «messo da parte»; MEMO che
  risponde a voce sulle giacenze (V2); la palette nuova sulla sola Dashboard
  (U1, prima parte); «Estrapola la spesa» (R11); la carta dei vini stampata
  come il menu (N19).
* 🔴 **Il Contratto è stato modificato**, nella #177, commit `a07153b`: §5,
  Ricerca ricorrente e Monitoraggio social tolti, Agricolo messo da parte.
  Autorizzato da Alessio l'11/10 («sì, aggiorna anche il contratto»), in un
  commit a parte. Lo dichiaro qui come vuole §6 di `CLAUDE.md`.

## 3-bis · I due rilievi della validazione del 12/10, e cosa ne è stato

1. **«Riprova» dopo una rete incerta poteva creare due appunti** — vero, e
   chiuso. Se la risposta di `annota_spesa_da_collocare` si perdeva dopo la
   scrittura, «Riprova» chiamava di nuovo e nasceva un secondo appunto (con
   una seconda copia della foto, perché il nome del file era nuovo a ogni
   giro). Ora la schermata genera una **chiave per foto** una volta sola e la
   ripassa a ogni «Riprova»; il database la ricorda (`…004`, indice unico) e
   restituisce l'appunto già scritto; il file prende il nome dalla chiave, e
   «esiste già» si tratta come «caricato dal giro di prima» (`giaCaricata`).
   Prove: la `…004` passa due volte in locale e diventa **rossa** con la
   funzione vecchia (0 appunti con quella chiave); a schermo
   `tests/schermate/foto-riprova-una-volta.test.jsx` diventa **rossa** se
   «Riprova» genera una chiave nuova; 3 prove pure su `giaCaricata`.
   ⚠️ La voce non ne ha bisogno: l'appunto dettato si scrive approvandolo,
   una volta sola.
2. **`npm run deposito:orfani` si ferma se la tabella non c'è ancora** —
   vero, ed è il verso giusto: la sua interrogazione nomina
   `spese_da_collocare.foto_path`, e prima della `…002` in produzione
   risponde con un errore invece di dichiarare orfane foto che non conosce.
   Nessuna modifica: **l'ordine è applicare le migrazioni prima di usare
   quel comando sulla produzione**, ed è scritto qui.

## 4 · Cosa si è visto

**Sul progetto di prova, con le mani di Alessio (11-12/10, dalle sue
fotografie):**

* Il pallino in basso a destra era rosso mattone: database di prova.
* **Prima applicazione della `…002` fermata**:
  `operator does not exist: entity_type = text` alla riga 1208, la prima
  chiamata a `colloca_spesa` nella verifica. Il CASE confrontato con l'enum
  restituiva `text`. Corretto in `8983120` con `(case …)::entity_type`. La
  migrazione non risultava registrata da nessuna parte, quindi correggere il
  file non riscrive una migrazione applicata. Le istruzioni eseguite fuori dai
  blocchi erano rimaste sulla prova, e il rilancio è idempotente.
* ⚠️ **Perché non l'avevo visto**: avevo provato in locale su un database
  finto dove `entity_type` era `text`. Rifatto con l'enum vero: la riga
  vecchia riproduce lo stesso errore, la nuova passa, anche due volte di fila.
* **A voce**: «la spesa €12 al panificio» → appunto «Spesa da collocare» con
  «Approva» → in «Da collocare» → collocato in prima nota → in Prima nota
  un'uscita di 12,00 € «Da una spesa da collocare (detta a MEMO)».
* **Con la foto**: uno scontrino di trattoria letto come 69,00 €, «Trattoria
  Il Gabbiano», 6 febbraio 2016, ed entrato in «Da collocare» con la foto.
  Collocato nella tasca, compare in Prima nota della tasca alla data dello
  scontrino. Era fuori dal periodo predefinito, che parte dal mese in corso.
* **La via di ritorno, usata per pulire**: le due spese annullate e tolte.
  Alessio: «fatto, pulizia andata». ⚠️ Dalle fotografie **non** ho visto la
  Prima nota dopo la pulizia: lo dice lui, io non l'ho misurato.
* Un appunto dettato **prima** che la `…002` fosse sulla prova è rimasto
  senza «Approva», perché il catalogo non conosceva il tipo. Buttato da
  Alessio. È il comportamento previsto per un tipo sconosciuto.

**In locale (PostgreSQL 16, database finto con l'enum vero):**

* `…002` e `…003` passano due volte di fila.
* La `…003` per rottura:
  - col guardiano vecchio → rossa;
  - con `annulla` che non toglie il movimento → rossa;
  - con `elimina` che accetta una collocata → **resta verde**, perché lo
    respinge comunque il guardiano della tabella. La proprietà ha due guardie.

**Prove automatiche sull'ultimo codice**:

* unitarie **2227** verdi;
* schermate **437** verdi, +3 per «Annulla la collocazione» (con conferma e
  una volta sola), «No, lascia stare» e «Togli l'appunto»;
* lint a zero; compilazione riuscita.

## 5 · Cosa NON è verificato

* Nessuna delle quattro migrazioni è in produzione, e la `…004` non è
  ancora nemmeno sulla prova. Nessuna funzione è installata
  in produzione.
* La `…003` non è stata vista girare in un database Supabase **da me**: la sua
  applicazione sulla prova l'ha lanciata Alessio, e la fine di
  `npm run prova:migra` non compare nelle fotografie. Che sia entrata lo
  dimostra che «Annulla la collocazione» ha funzionato, perché quella
  funzione esiste solo lì.
* La schermata «Da collocare» con i gesti nuovi non l'ho aperta io: l'hanno
  provata le prove a schermo e le mani di Alessio.
* Il collocamento in **anticipo** e in **archivio** non è stato fatto da una
  mano: solo dalle verifiche delle migrazioni e dalle prove a schermo.
* Dal telefono non è stato provato niente di questa consegna.

## 6 · Cosa abbiamo rovesciato

* **N. 99** — una spesa detta andava da sé nel soggetto che le parole
  indicavano (07/09). Adesso va in «Da collocare» e decide Alessio. La ragione
  di allora — dettare serve a non ripassare dal computer — **vale ancora**: il
  prezzo è un passaggio in più per ogni spesa detta.
* **N. 100** — una spesa collocata non si toccava più (11/10, poche ore
  prima). Adesso si annulla togliendo l'effetto. La ragione di allora — la
  stessa spesa in un posto solo — **vale ancora**, e regge perché il ritorno
  toglie l'effetto prima di una nuova collocazione. Il «per sempre» lasciava
  un vicolo cieco.
* Il **Contratto §5** (vedi § 3) è un cambiamento autorizzato, non un
  rovesciamento di una regola architetturale.

### Affermazioni diventate false mentre lavoravo

* In `CLAUDE.md` §7 la riga di C12 diceva che la spesa si colloca «una volta
  sola» senza via di ritorno. È rimasta, ma con sotto la riga della `…003` che
  la corregge.
* Nel messaggio di `8983120` avevo scritto che l'appunto senza «Approva» era
  colpa della migrazione fermata a metà. Era nato **prima** di qualunque
  applicazione. Corretto con `--amend` prima che il commit avesse un altro
  figlio. Il ramo è mio, e la spinta è stata `--force-with-lease`.

## 7 · Applicazione in produzione

*Da compilare dopo `npm run migra -- --conferma` e le tre
`npm run funzione … -- --conferma`: quante migrazioni sono entrate, l'esito
di ogni funzione, e le righe di `spese_da_collocare` (devono essere zero).*
