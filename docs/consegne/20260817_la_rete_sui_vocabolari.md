# Consegna del 17/08/2026 (terza) — la rete sui vocabolari chiusi

**Commit della consegna: `e8e501e`** (`Un vocabolario solo per i mezzi? La
misura dice no, e per un motivo piu' grosso`). Working tree pulito prima di
questo riepilogo. Questa consegna **non modifica** `docs/CONTRATTO.md`.

Chiude la voce «la rete sui vocabolari chiusi in due posti» del registro del
collaudo, e l'ordine è stato scelto da Alessio: **prima la rete, poi le
piccolezze**, perché la rete vive nelle prove e nel database e quindi non
cambia le schermate che lui sta guardando — mentre le piccolezze toccano
proprio quelle.

Due commit:

| commit | cosa |
|---|---|
| `2063c67` | la migrazione `20260817000003`, la regola, le due prove, la cura del difetto |
| `e8e501e` | la misura chiesta da Alessio prima di decidere l'unificazione |

---

## 1. La trappola, e perché una rete

Un elenco chiuso di valori ammessi vive in più di un posto, e nessuno
controllava che i posti dicessero la stessa cosa. **Tre morsi in due
giorni**, tutti su lavoro nuovo:

- **16/08** — gli scarichi di magazzino: aperto il vocabolario nella
  funzione e non nel vincolo della tabella. Il primo vitto del personale
  sarebbe fallito con un errore incomprensibile;
- **17/08** — i metodi di pagamento: identico, trovato applicando;
- **17/08** — e costruendo la rete: vedi §3.

⚠️ **I POSTI SONO TRE, NON DUE**, e la scoperta cambia la forma della cura:

| | dove | quanti |
|---|---|---|
| 1 | il database decide (un tipo `enum` o un vincolo `check`) | **82** |
| 2 | una funzione ridice l'elenco, per dare un messaggio leggibile | **9** |
| 3 | `constants.js` lo ridice, per riempire un menu a tendina | **37** |

E i tre sbagliano in modi diversi. Fra 1 e 2 l'errore è **rumoroso ma
incomprensibile**, e arriva al primo uso vero. Fra 1 e 3, se il JavaScript è
più **stretto** l'errore è **silenzioso** — un valore legittimo che non si
può scegliere e nessuno lo scopre; se è più **largo**, il salvataggio
fallisce sull'unica persona che ci prova.

⚠️ **Perché una rete e non un «riflesso».** La regola del 16/08 dice che
quando due posti direbbero la stessa cosa il secondo va reso un riflesso del
primo, invece di costruirgli un guardiano. Qui non si applica, e il perché va
scritto: i tre posti **non dicono la stessa cosa**. Il database dice *quali
valori sono legali*, `constants.js` dice *come si scrivono in italiano* — e
un'etichetta italiana è roba della schermata. Ciò che si sovrappone è solo
l'insieme delle chiavi, e su quello serve un guardiano.

---

## 2. È una rete sola con quella delle mance? No — e il discriminante era già scritto

La domanda posta dal validatore. Sono la **stessa famiglia** — due posti che
devono dire la stessa cosa e nessuno che controlli — ma il rimedio è diverso,
e a distinguerli basta la domanda che la regola del 16/08 conteneva già:
**direbbero *esattamente* la stessa cosa?**

- **Sì → si toglie il doppione**, non si costruisce un guardiano. È quello
  che ha fatto `payloadMancia`: l'elenco dei campi ora esiste in un posto
  solo e la prova pura lo congela. È un **riflesso**, non una rete.
- **Solo in parte → non si possono fondere, e serve un guardiano.** È il caso
  dei vocabolari.

**E un terzo risultato, misurato invece che sospettato.** Ciò che rende un
disaccordo *silenzioso* non è la duplicazione: è un **valore predefinito nel
database**. Se la colonna ha un predefinito e la schermata dimentica il
campo, il database non dà errore — scrive il predefinito. È esattamente così
che si è perso il `mezzo` delle mance il 16/08.

`vocabolari_chiusi()` adesso riporta il predefinito, e il numero è
**33**: i posti dove una dimenticanza sbaglierebbe in silenzio. Non è più un
sospetto, è un elenco da camminare.

⚠️ **E la forma vulnerabile è ancora in giro**: `createCashMovement` riceve
dalla schermata un oggetto già pronto — la stessa forma che ha perso il
`mezzo`. Oggi `PrimaNota.jsx` passa tutto (verificato), quindi non c'è un
difetto vivo; ma la cura del 16/08 è stata applicata a **un** chiamante, non
alla famiglia.

---

## 3. 🔴 Il difetto trovato costruendo la rete, vivo in produzione

**«Assegno» compariva nel menu della lista della spesa**, dove
`shopping_list_items_payment_method_check` ammette solo `contante`,
`bonifico`, `carta`. Sceglierlo faceva fallire la chiusura della riga.

Le due schermate — fatture e lista della spesa — condividevano un elenco
solo. Finché i due vocabolari coincidevano non si vedeva: è stato aggiungere
l'assegno alle fatture, **ieri**, a spaccarli. Un difetto introdotto da un
lavoro corretto, in un punto che quel lavoro non toccava.

**La cura**: due elenchi, `PAYMENT_METHODS` e `PAYMENT_METHODS_SPESA`, e la
lista della spesa usa il suo.

⚠️ **Non si è allargato il vincolo per far posto all'assegno**: quale sia il
vocabolario della sua spesa lo decide Alessio, e aggiungere un valore per far
tornare un conto sarebbe una regola scritta da me sul suo modo di comprare.

---

## 4. La misura che Alessio ha chiesto prima di decidere

Alla cura lui ha risposto con una domanda migliore: *«perché non lasciare
tutti i metodi ovunque? Due elenchi diversi sono proprio ciò che ha prodotto
il difetto»* — col vincolo giusto: **il lavoro non è nel menu, è nelle
conseguenze.**

Misurato. Chi tiene un «mezzo di pagamento», e cosa ne fa:

| dove | che domanda risponde | scrive un movimento? |
|---|---|---|
| `supplier_invoices.payment_method` (4, con assegno) | con che **strumento** pago una fattura | **sì**, con la data di uscita vera |
| `shopping_list_items.payment_method` (3) | con che strumento ho pagato la spesa | 🔴 **no, niente** |
| `order_payments.mezzo` (contante, carta) | come **incassa** il locale in sala | no, per scelta del 04/08 — ed è denaro in **entrata** |
| `deductible_expenses.payment_method` (5) | se la spesa è **tracciata** ai fini fiscali | no: `app` e `altro_tracciato` esistono per la regola del contante |
| `tips_collected` / `tip_distributions.mezzo` (2) | come sono **arrivate** le mance | sì (i saldi le leggono) |
| `anticipazioni_socio.fondi` (contanti, conto_personale) | da quale tasca del **titolare** | sì |
| `cash_movements.mezzo`, `scadenze_previste.mezzo` (cassa, banca) | **dove** stanno i soldi | è la destinazione, non lo strumento |

**«I mezzi di pagamento» non è un vocabolario: sono quattro concetti.**
Strumento, forma d'incasso in sala, tracciabilità fiscale, destinazione.
Unificarli tutti direbbe che «bonifico» ha senso su una mancia e «app» su
una fattura.

I due che *sono* lo stesso concetto sono la fattura e la spesa — e lì la
misura ha trovato la ragione vera per non unificare adesso.

### 🔴 Chiudere una riga della lista della spesa non scrive nessuna uscita

`close_shopping_list_item` registra importo e mezzo sulla riga, crea il lotto
in magazzino, e **non tocca la prima nota**. `purchased_amount` non è letto
da nessuna funzione, da nessuna vista e da nessun totale — verificato dal
connettore: solo dalla schermata che lo mostra.

**La spesa pagata dalla lista è denaro uscito che nessun saldo e nessun
totale dei costi conosce.** È la stessa forma di «pagare una fattura non era
un movimento» (rilievo del 13/08) e del doppio conteggio chiuso stamattina.
**Nessuna consegna la dichiara come scelta**, quindi è un buco, non un
patto.

⚠️ **E questo decide la domanda sul vocabolario.** Cosa farebbe oggi quella
schermata se ricevesse «assegno»? *La stessa cosa che fa con «bonifico»:
niente.* Il mezzo lì è **decorativo** — non è che l'assegno non sia gestito,
è che nessun mezzo lo è. Unificare adesso produrrebbe esattamente il
«vocabolario finto» che Alessio ha nominato, e per un motivo più grosso
dell'assegno.

**Decisione**: due vocabolari dichiarati, e la rete che sorveglia che non si
separino di nascosto. L'unificazione diventa la cosa giusta *dopo* che la
lista scrive la sua uscita — e allora costa poco.

⚠️ **Quel lavoro ha dentro una decisione che non è mia**, ed è posta ad
Alessio: la lista contiene sia righe pagate sul posto (mercato, ricevuta) sia
righe **ordinate** dalla Fase B, per cui arriverà una fattura. Scrivere un
movimento per tutte conterebbe due volte quelle fatturate — cioè
ricostruirebbe dall'altro lato il difetto chiuso stamattina.

---

## 5. Com'è fatta la rete

**Nel database** (`20260817000003`), due elenchi che **si costruiscono da
soli** interrogando i cataloghi — nessun elenco scritto a mano, che
invecchierebbe in silenzio:

- `vocabolari_chiusi()` → tabella, colonna, fonte (`enum`/`vincolo`), valori,
  **e il predefinito**. Un vocabolario nuovo aggiunto domani compare qui da
  solo, e la prova diventa rossa finché qualcuno non dichiara se una
  schermata lo rispecchia. È la forma di `funzioni_aperte_ad_anon()` (13/08)
  e di `npm run prova:stato` (16/08).
- `guardie_vocabolario()` → le funzioni che ridicono un elenco.
  ⚠️ **Solo i confronti con un parametro (`p_…`)**: `status in
  ('chiuso','omaggiato')` dentro una query è un **filtro**, cioè un
  sottoinsieme voluto, e trattarlo come una guardia darebbe una decina di
  allarmi falsi permanenti — che è il modo in cui una rete viene spenta.

**La regola** vive in `src/lib/calcoli/vocabolari.js` come **funzione pura**,
non dentro le asserzioni di un file di prove, e la ragione è duplice: perché
la si possa provare al contrario senza rompere niente, e perché sia leggibile
in un posto.

**Le due prove**:

- `tests/unita/vocabolari.test.js` — **10 controlli AL CONTRARIO**, su dati
  inventati: valore che la schermata offre e il database rifiuta · valore
  legittimo che la schermata non offre (il caso silenzioso) · colonna che non
  è un vocabolario · riflesso non dichiarato · valore vuoto non dichiarato ·
  guardia allargata senza il suo vincolo · esenzione che zittisce solo la sua
  · elenco di etichette non dichiarato.
  ⚠️ Su dati inventati **e non mutando i file dell'app**: il gestionale gira
  dalla stessa cartella in cui si lavora, e rompere `constants.js` per vedere
  la prova diventare rossa farebbe comparire menu rotti sotto le mani di chi
  sta collaudando.
- `tests/app/vocabolari.test.js` — **6 controlli** sugli elenchi veri del
  database, compreso che nessuno dei due sia vuoto (la trappola del caso
  vuoto, `CLAUDE.md` §8: una prova che gira sul niente dimostra che il codice
  non esplode, non che funziona).

**Le due esenzioni**, ognuna con la sua ragione scritta — e una prova
pretende che esistano ancora, perché un'eccezione che sopravvive alla cosa
che escludeva è un pezzo di rete spento senza che nessuno l'abbia deciso:

| funzione | perché non deve combaciare |
|---|---|
| `annulla_prenotazione(p_stato)` | non valida un vocabolario: accetta di proposito solo i due stati in cui si può annullare |
| `preavviso_giorni(p_conservazione)` | non è una guardia ma un ramo: il frigo prende 2 giorni, dispensa e freezer 14. Non rifiuta niente |

⚠️ **Il limite è dichiarato** (`LIMITE_DICHIARATO` nel file): la rete
confronta gli **insiemi di valori**, non sa quale schermata usa quale elenco.
Usare l'elenco giusto contro la colonna sbagliata resta possibile — ma
sbaglia **rumorosamente**, perché il database rifiuta al primo salvataggio. È
il caso silenzioso quello che la rete chiude.

---

## 6. Numeri veri dell'applicazione in produzione

```
Vocabolari chiusi nel database: 82. Funzioni che ne ridicono uno: 9.
Guardie senza vocabolario combaciante: 2 (le dichiarate).
Vocabolari su colonna con predefinito, dove una dimenticanza e' silenziosa: 33.

 vocabolari | guardie | dove_una_dimenticanza_e_silenziosa
         82 |       9 |                                 33

── Com'e' andata
  applicate e registrate: 1 su 1
    · 20260817000003_i_vocabolari_si_contano.sql
  totale migrazioni in produzione: 127
```

Applicata il **17/08/2026 alle 15:35:51 UTC**. **Nessuna sanatoria**: la
migrazione crea due funzioni di sola lettura e non tocca nessuna riga.

⚠️ **I tre numeri sono identici a quelli del progetto di prova** (82/9/33), e
non è un dettaglio: è la conferma che i due schemi sono allineati. Se
divergessero, la rete direbbe cose diverse nei due posti.

### Controlli dal connettore in sola lettura

| Controllo | Valore |
|---|---|
| Migrazioni in produzione | **127** |
| Le due funzioni nuove sono `security definer`? | **no** — decidono i cataloghi, che sono leggibili da chiunque; nessun portiere da tenere allineato |
| Eseguibili da `anon` | **no** |
| Funzioni raggiungibili con la sola chiave pubblica | **10, invariato** |
| Policy dello schema `public` intestate al ruolo `public` | **0** |
| Lapidi in `deleted_records` | **25, invariate** |
| Note di credito · fatture | 0 · 0 |

---

## 7. Cosa NON è verificato

- **La cura dell'assegno non è stata provata da una mano vera**: nessuno ha
  aperto la lista della spesa e guardato che il menu ora offra tre voci.
  ⚠️ **E quella schermata è cambiata mentre Alessio collaudava** — dichiarato
  a lui subito: è l'unica schermata toccata fuori dal giro delle sette prove,
  e la regola del collaudo dice che mentre lui guarda il codice dell'app non
  si tocca. Toccata perché il difetto era vivo, non per comodità.
- **La rete non ha ancora impedito niente**: è verde dal primo giro. Che
  sappia gridare è provato dai 10 controlli al contrario, non dal campo.
- **I 33 posti dove una dimenticanza è silenziosa non sono stati
  camminati**: il numero è misurato, l'elenco esiste, nessuno l'ha percorso.
- **Il buco della lista della spesa non è chiuso**: è misurato e scritto, e
  aspetta una decisione di Alessio (§4).
- **Nessun vocabolario è stato aggiunto o cambiato per provare la rete sul
  database vero**: farlo vorrebbe dire una migrazione finta in produzione.

---

## 8. Stato finale

| | |
|---|---|
| Migrazioni in produzione | **127** |
| Migrazioni nel repository / sul progetto di prova | 127 / 127 |
| Corridoio `operazioni-atomiche` | produzione **v29**, prova **v12** |
| Prove automatiche | **49 pure + 144 sul progetto di prova** |
| Collaudo, primo e secondo giro | chiusi |
| La rete sui vocabolari | **fatta** |
| Prossimo | le piccolezze (D), tutte insieme, quando Alessio ha finito il giro |
