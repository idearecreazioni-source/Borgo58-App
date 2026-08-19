# I finger si compongono — blocco 1 del mandato dei finger food

**Migrazione**: `20260819000012_i_finger_si_compongono.sql`
— applicata sul progetto di prova, **NON ancora in produzione** (aspetta il
push).
**Mandato**: [`20260819_i_finger_food_e_lo_storico_dei_costi.md`](../mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md).
Blocco 1 di tre. **Le due scelte di questo giro le ha fatte Alessio**: un
tipo nuovo invece della strada larga, e il prezzo a pezzo sulla ricetta.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha creato un finger dalla schermata.** Le regole sono
   provate dal database e dalle prove automatiche col token di un utente
   vero, ma il modulo del Ricettario non l'ha aperto nessuno dopo la
   modifica.
2. 🔴 **Lo scarico di magazzino è provato come proprietaria del database**,
   dentro la migrazione: `fabbisogno_conto` **non è concessa all'app** (ed è
   giusto — la chiama la chiusura del conto, non una schermata), quindi da
   una prova col token di un utente non si può chiamare. Aprire quella porta
   per comodità di prova è precisamente ciò che il 16/08 si è deciso di non
   fare.
3. ⚠️ **Non è mai stato chiuso un conto vero con una selezione dentro**: lo
   scarico è provato sul *fabbisogno*, cioè su quanto il gestionale dice che
   uscirebbe, non sul lotto che si svuota.
4. ⚠️ **La stampa del menu e gli allergeni non sono stati guardati**: una
   selezione eredita gli allergeni dei suoi bocconcini, e
   `v_recipe_allergens` non è stata misurata su una ricetta fatta di ricette.
5. ⚠️ **Il prezzo a pezzo non è di questo blocco**: è il blocco 2. Qui c'è
   solo la decisione di dove andrà.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento, ma una regola si RESTRINGE invece di sparire.**

- **Cosa era stato deciso**: solo le preparazioni possono entrare dentro
  un'altra ricetta (trigger `check_recipe_component`).
- **La ragione di allora**: impedire di comporre per sbaglio un piatto dentro
  un altro piatto — che non vuol dire niente e produrrebbe food cost e
  scarichi assurdi.
- **Cosa si decide adesso**: entrano le preparazioni **e i finger**.
- **Perché la ragione di allora vale ancora**, ed è il punto: *quella
  protezione non è stata allargata, è stata ristretta a un elenco più
  preciso.* Un piatto finito dentro un altro piatto **resta rifiutato**, e
  c'è una prova che lo controlla.

---

## 🔴 La misura ha cambiato il lavoro

Il mandato chiedeva di misurare prima di progettare, e la misura ha detto che
**la macchina c'è già**: costruito il caso vero sul progetto di prova, il food
cost di una selezione esce giusto e lo scarico di due porzioni toglie **due
pezzi per tipo**. **Non è nata nessuna tabella.**

Quello che mancava era **un rifiuto**, non un pezzo: *«solo le ricette di tipo
preparazione possono essere usate come componente»*.

---

## Le due decisioni di Alessio

### Un tipo nuovo, non la strada larga

- marcare un finger come **preparazione** funzionerebbe, ma lo farebbe finire
  in **Produzioni** e sotto la **sorveglianza delle rese**: il gestionale gli
  chiederebbe conto di cose che non è;
- lasciar entrare **qualunque ricetta dentro qualunque altra** costa meno
  oggi, ma toglie l'unica protezione contro un piatto dentro un piatto;
- e il tipo dà l'**elenco dei finger**, che serve per comporre e servirà al
  modulo preventivi.

### Il prezzo a pezzo starà sulla ricetta del finger

L'obiezione dei «due prezzi che si contraddicono» è stata **ricollocata, non
scartata**: non sono due prezzi dello stesso oggetto — uno è di un **piatto**,
l'altro di un **finger**.

⚠️ **QUEL CASO NON SI PRESENTERÀ PIÙ, e questa riga sostituisce
un'avvertenza che c'era** (20/08/2026). Fino al 20/08 qui era scritto che il
giorno in cui lo stesso finger fosse andato in carta anche da solo ci
sarebbero stati due prezzi per la stessa cosa, e sarebbe servita una regola
su quale vince. **Alessio l'ha superata**: *«semmai un bocconcino dovesse
diventare un piatto a sé, creerò una ricetta nuova con un nome diverso»*.
Non sarà la stessa cosa, quindi non ci saranno due prezzi della stessa cosa,
e **il prezzo a pezzo resta l'unico prezzo di un bocconcino**.

⚠️ E dal 20/08 non è più nemmeno possibile per sbaglio: **un menu accetta
solo i piatti** (trigger `solo_piatti_in_menu`). L'avvertenza vecchia è
dichiarata decaduta e non cancellata in silenzio — vedi il n. 19 di
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## 🔴 Cosa cambia a valle — misurato PRIMA di introdurre il tipo

La domanda posta da Alessio era la giusta: *un tipo nuovo che nessuno filtra
ricompare nei posti sbagliati in silenzio.* Chi guarda il tipo di ricetta,
misurato sul database e sul codice:

| chi | cosa succede a un finger |
|---|---|
| `ingrediente_di_preparazione` (→ Produzioni) | ✅ **già lo rifiuta**: è l'unica che controlla davvero il tipo. Cambiato solo il messaggio, che diceva «è un piatto finito» e sarebbe stato falso |
| `rese_preparazione`, `produzioni_display` | ✅ lavorano sulle produzioni registrate: senza produzione non c'è resa |
| `fabbisogno_conto`, `fabbisogno_preparazione`, `simula_prezzo_ingrediente` | ✅ nominano `preparazione_id` (la colonna dell'ingrediente), non il tipo: non c'entrano |
| 🔴 `preparazione_requires_yield` | **guardava solo le preparazioni** — vedi qui sotto |
| `listPreparations` (l'elenco dei componenti) | 🔴 filtrava per `preparazione`: allargato, altrimenti il database permette una cosa che nessuna schermata può fare |
| `RECIPE_TYPES` (le etichette) | 🔴 la **rete dei vocabolari** è diventata rossa da sola quando il database ha avuto un valore in più. È il suo mestiere |

### Il buco che il tipo nuovo apriva, e che è stato chiuso nello stesso passo

Il vincolo che pretende la **resa** guardava solo il tipo `preparazione`. Un
finger senza resa sarebbe stato accettato — e il calcolo del costo e dello
scarico **divide per la resa del componente**: senza, il risultato è NULL, e
**costo e merce spariscono senza nessun errore**.

Il vincolo adesso si chiama `componente_richiede_resa` e vale per **chiunque
possa stare dentro un'altra ricetta**. ⚠️ *Il nome è cambiato perché è
cambiato il significato: non «una preparazione vuole la resa», ma «un
componente vuole la resa».*

---

## Un componente non si ripete

Regola di Alessio — *sempre un pezzo per tipo* — ed è un **vincolo del
database**, non un controllo nella schermata: è da lì che nasce lo scarico di
magazzino, e sbagliarlo non dà nessun segnale, dà una giacenza sbagliata tutte
le sere.

⚠️ **Vale per qualunque componente, non solo per i finger, ed è una scelta
dichiarata**: due righe per lo stesso componente sono due risposte alla
domanda «quanto ne va dentro», e niente dice quale vince.

---

## Le prove, e le quattro rotture

**Otto controlli dentro la migrazione** e **sei prove col token di un utente
vero** (`tests/app/finger-si-compongono.test.js`).

🔴 **E la prova usa SEI bocconcini, non due — è la cosa più istruttiva del
giro.** Con due bocconcini e due porzioni le due risposte **sbagliate**
coincidono: 0,020 kg sia ignorando le porzioni sia contando i bocconcini come
porzioni. Con sei e due si distinguono:

| | kg scaricati | cosa vorrebbe dire |
|---|---|---|
| ✅ giusto | **0,120** | 2 porzioni × 6 bocconcini × 10 g |
| ✗ | 0,060 | le porzioni ignorate |
| ✗ | 0,360 | i bocconcini contati come porzioni |

*Un numero scelto per comodità può rendere una prova incapace di distinguere
il giusto dallo sbagliato.*

| rottura | cosa è diventato rosso |
|---|---|
| il vincolo della resa resta com'era | *«Un finger senza resa è stato accettato: costo e scarico sparirebbero in silenzio»* |
| via l'unicità del componente | *«Lo stesso finger è entrato due volte nella stessa selezione»* |
| qualunque ricetta dentro qualunque altra | *«Un piatto finito è entrato dentro un altro piatto»* |
| una porzione invece di due | *«Due porzioni di sei bocconcini scaricano 0,060 kg invece di 0,120»* |

### 🔴 E una rottura ha lasciato un residuo che ha mentito

La seconda rottura sostituiva l'indice unico con uno normale. Rimettendo il
file a posto, `create unique index **if not exists**` ha trovato un indice con
**quel nome** e non ha fatto niente: il vincolo sembrava esserci e non c'era,
e la rottura successiva è fallita **col messaggio di quella prima**.

Adesso l'indice si **toglie e si rifà**. ⚠️ *Anche una controprova lascia
residui, e i suoi residui mentono come tutti gli altri.*

---

## Una nota di CLAUDE.md era più larga del vero

Diceva: *«il nuovo valore di un enum non è usabile nella stessa migrazione in
cui viene aggiunto»*. Misurato oggi in tutti e due i versi: **il confine è la
TRANSAZIONE, non il file.** Dentro un solo blocco fallisce
(*«New enum values must be committed before they can be used»*); in un file
applicato da `psql`, dove ogni istruzione si chiude da sé, l'`alter type` **su
una riga sua** è già committato quando il blocco dopo lo usa.

⚠️ Corretta, con la ragione: *una regola scritta più larga del vero costa un
lavoro spezzato in due per niente* — qui sarebbero state due migrazioni invece
di una.

---

## Per Alessio, in una riga

Adesso puoi creare i bocconcini come ricette a sé, marcarli «finger», e
comporre una selezione mettendoceli dentro: il costo si somma da solo, e due
porzioni ordinate tolgono dal magazzino due pezzi per tipo.

---

**Commit del lavoro**: `005e077` — «I finger si compongono — blocco 1 del
mandato dei finger food».
**Working tree**: pulito.
**Migrazione**: `20260819000012` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
