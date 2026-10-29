# Le comande escono dal ponte — 29/10/2026

Lo chiede Alessio: il tablet va provato **al collaudo**, quindi una comanda inviata deve uscire da sola dalla stampante. Prima ha visto il piano, poi ha risposto *«sì al piano delle comande dal ponte»*.

**Gli scontrini restano fuori.** In coda entrano solo fogli non fiscali, e una comanda non va mai al registratore.

## Cosa cambia
- **All'invio** (`order_items.sent_at` da vuoto a pieno): se il reparto ha una stampante attiva, entra in coda un foglio per conto e per reparto. Un'aggiunta a un turno già uscito va su un foglio a parte, come in `bigliettiCucina`. Il biglietto «avanti col prossimo turno» entra in coda se la cucina ha una stampante.
- **Il ponte lo stampa.** Per la cucina le righe si segnano stampate (`prepared_at`, la stessa firma di prima). Tutte le righe di un foglio prendono la stessa ora, così una ristampa lo rifà uguale.
- **Il bar non si segna.** Al bar `prepared_at` vuol dire «evaso»: si stampa e basta, e lo schermo del Bar resta uguale.
- **Stampato a mano = tolto dalla coda.** Il foglio può uscire da «Stampa da qui» o da «È uscito». Se escono tutte le righe, il lavoro si annulla. Se ne esce solo una parte, il lavoro si rifà con le righe che mancano. Una riga stornata esce dalla coda.
- **«Non si sa se è uscito» non si ristampa mai da solo.** Decide chi guarda la stampante, con «È uscito» oppure «Ristampa».
- **Cosa scade da solo:**
  - una comanda ferma in coda per più di tre ore non esce più;
  - non esce nemmeno una comanda di un conto già chiuso.
- **Senza stampante attiva non cambia niente**, né nel database né nella pagina. In produzione oggi non c'è nessun apparecchio.
- **Un invio non si ferma mai per la stampa.** Ogni errore della coda diventa un avviso, e ogni foglio ha il suo blocco. La pagina Cucina mostra il foglio come «non è nella coda».

## I pezzi
- **`supabase/migrations/20261029000001_le_comande_escono_dal_ponte.sql`:**
  - `lavori_stampa` ha `order_id`, `chiamata_id`, `reparto` e `righe`;
  - i tipi `comanda` e `chiamata`;
  - l'indice «uno aperto per apparecchio» ora vale solo per prove e stati;
  - `componi_comanda`, i due trigger e `ponte_esito_lavoro`, che segna la cucina;
  - per lo staff, `stato_stampa_cucina()` e `manda_alla_stampante()`;
  - la verifica dentro: dieci prove, annullate, zero residui.
- **`ponte/`** (versione 0.2.0):
  - `righeDellaComanda` e `righeImpaginate` in `testo.mjs`;
  - `foglioComanda` in ESC/POS e in ePOS;
  - `esegui.mjs` accetta `comanda` e `chiamata`, e le rifiuta per il registratore.
- **Pagina Cucina:**
  - con la stampante, sotto ogni foglio c'è lo stato e ci sono i tasti;
  - se il ponte è spento compare l'avviso rosso, e uno quando la stampante è ferma;
  - «Stampa da qui» si spegne mentre la stampante sta stampando;
  - la regola pura è in `src/lib/calcoli/fogliInCoda.js`.
- **Pagina Stampanti:** nell'elenco dei lavori compaiono anche «comanda» e «biglietto del turno».
- **Guide:**
  - `COLLAUDO_PORTATILE.md`: B4, la comanda a casa con l'apparecchio finto; C3 punto 9, il tablet con la TM vera, su cucina e poi su bar;
  - `PONTE.md`.

## Il foglio sulla carta
Dice le stesse cose della pagina Cucina, nello stesso ordine:
- in cima, reparto e tavolo, poi l'ora;
- la riga di stacco di ogni turno;
- «2 x piatto»;
- SENZA e le frasi delle sostituzioni, prima della nota;
- la nota del tavolo in fondo.

Come esce sulla carta:
- i piatti sono in doppia altezza e SENZA è in grassetto;
- le lettere accentate diventano «e'», e «1°» diventa «1o», perché una termica appena tolta dalla scatola non le sa stampare;
- un foglio oltre le 400 righe si taglia, e lo dice.

## Prove
- **Su Prova:**
  - `npm run prova:migra -- 20261029000001` passata due volte: verifica «Fatto», zero residui, ripetibile;
  - `npm run test:app -- tests/app/comande-dal-ponte.test.js`: 6 passate. Lo staff manda la comanda come la manda il tablet, la coda la riceve, lo staff legge lo stato senza indirizzi, «Stampa da qui» la toglie e «Ristampa» la rimette.
- **Prove di unità** (`tests/unita/ponte-comande.test.js`, `fogli-in-coda.test.js`, `ponte.test.js`, `letture.test.js`): 52 passate.
  - Tutte le prove di unità: tre cadute sono fuori da questo lavoro, cioè `bozze-col-lordo` e `indirizzo-funzioni-vault`. Leggono le migrazioni e cadono per gli a capo di Windows di questa copia; cadono uguali anche nella copia della #270, che in CI era verde.
- **Prove delle schermate:** 474 passate, più le 6 nuove di `cucina-con-la-stampante.test.jsx`.
- **Il resto:** lint pulito; compilazione riuscita; peso di 445,85 kB su un tetto di 450.

## Revisioni ECC
- **ecc:database-reviewer.** Applicato:
  - 🔴 allo staff nessun testo grezzo del ponte, che può contenere l'indirizzo della stampante: solo frasi fisse (`frase_di_stampa`). La verifica (6d) lo controlla;
  - 🔴 `manda_alla_stampante`:
    - serve un ruolo nel locale;
    - un lucchetto contro i doppi tocchi;
    - sostituisce i lavori che si sovrappongono (`&&`);
    - al massimo 200 righe;
    - un freno a 40 fogli in coda;
  - ogni foglio nel suo blocco d'eccezione, e l'uscita subito quando l'update non riguarda la stampa;
  - stampato a metà: si rifà con le righe che mancano;
  - le righe stornate escono dalla coda;
  - la scadenza delle tre ore;
  - le righe già stampate non si accodano;
  - un biglietto creato già stampato non si accoda;
  - le frasi sulle chiavi esterne;
  - `stable` per l'etichetta degli allergeni;
  - una frase diversa per l'incerto chiuso a mano.
- **ecc:react-reviewer.** Applicato:
  - un errore di rete non cancella più lo stato della stampante: `NON_LETTO`, e la pagina lo dice;
  - un incerto o un fallito si dicono prima di «non è in coda»;
  - l'errore di un tasto non sparisce alla lettura dopo;
  - le letture sono numerate;
  - «Stampa da qui» è spento durante la stampa;
  - più fogli possono essere in invio insieme;
  - l'allarme forte c'è solo per fallito e incerto;
  - l'emoji è nascosta ai lettori di schermo.
  - Non fatto: `Foglio` resta definito dentro la pagina, com'era. Spostarlo cambia tutto il file, ed è un lavoro a parte.
- **ecc:code-reviewer** (ponte): approvato. Applicato:
  - il foglio tagliato lo dice;
  - la riga di stacco anche in ePOS;
  - NFC prima di togliere gli accenti;
  - `\n` al posto degli a capo dentro le stringhe.

## Non verificato
- **La TM vera:** grassetto, doppia altezza e taglio vengono dal manuale ESC/POS. Si vedono al collaudo (C3 punto 9).
- **Un tablet vero su Prova con il ponte acceso:** l'ho provato con l'accesso dello staff, non dallo schermo. Lo fa Alessio a casa (B4).
- **ePOS:** solo per lettura del codice e con le prove sull'XML.
- **Le lettere accentate:** una TM si può impostare per stamparle. Si decide al collaudo, con il fornitore.

## Per dopo
- Lo zip sul Desktop (`Ponte collaudo\ponte-collaudo.zip`) ha ancora il ponte 0.1.0: va rifatto con questo ponte dopo l'unione su slave.
- In Sala non c'è ancora un avviso quando un foglio non è uscito: lo vede solo la pagina Cucina.
- La produzione solo con il sì di Alessio, dopo il collaudo.
