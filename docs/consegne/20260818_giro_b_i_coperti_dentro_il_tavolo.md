# Giro B — i coperti dentro il tavolo, e «c'è posto?» dal telefono

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
punti **2 + 1**. Segue il [giro A](20260818_giro_a_la_sala_non_si_perde.md),
non ancora validato: il validatore guarda A e B insieme.

- **HEAD dichiarato**: `3188233`
- **Working tree**: pulito
- **Migrazioni**: `20260818000001_i_coperti_dentro_il_tavolo.sql`,
  `20260818000002_chi_ha_corretto_e_quando.sql` e
  `20260818000003_gli_orfani_e_la_traccia_della_sala.sql` (i cinque rilievi
  della validazione)
- **Prove**: **53** pure (erano 49) + **151** sul progetto di prova (erano 144)
  — tutte verdi
- **Lint**: zero avvisi · **Build**: ok

---

## Cosa abbiamo rovesciato

⚠️ **Due rovesciamenti, tutti e due del 14/08, tutti e due registrati** in
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md) (righe 2 e 3).

### 1 · «Nel sistema non esiste una capacità per tavolo»

**Cosa era stato deciso, e quando.** Il 14/08: nessun numero di coperti su un
tavolo, scritto come vincolo — `dining_tables_sagoma_check` rifiuta un
`tavolo` con `posti_fissi`.

**La ragione di allora.** *La capienza varia con la disposizione*: contare un
secchio di posti e sottrarre le persone prenotate è sbagliato **per
costruzione** — due persone a un tavolo da sei lasciano quattro posti che non
esistono.

**Cosa si decide adesso.** Sul tavolo si legge quanti ne tiene (90×90 = 4,
180×90 = 6), e accostandone due il numero **scende**: somma meno due per ogni
giunzione.

**Vale ancora, e questo è il prezzo che accettiamo.** La ragione del 14/08 non
era «i posti non esistono»: era che **un totale di sala fisso non descrive la
sala**. E infatti il secchio unico non torna — i posti stanno *dentro il
tavolo*, il totale si ricalcola sulla disposizione di quel giorno, e un
accostamento lo **abbassa**. Cade «non esiste capacità per tavolo»; resta, più
forte, «non esiste una capienza della sala indipendente da come è messa».
Il prezzo: quel vincolo era anche una **difesa** contro il ritorno del secchio
unico, e da oggi quella difesa la fa il **disegno**, non il database.

⚠️ **E una precisazione che non va usata per attenuare il rovesciamento.** La
capacità sta su `formati_tavolo`, non su `dining_tables`: quindi
`dining_tables_sagoma_check` **non è stato toccato** — verificato nel blocco
di verifica, che si ferma se il vincolo non c'è più. **Il rovesciamento resta
intero lo stesso**: l'invariante diceva *«nessun numero di coperti è associato
a un tavolo»*, e metterlo sul formato a cui il tavolo punta è associarcelo a
un passo di distanza. Il vincolo sopravvive alla lettera, non alla sostanza.

### 2 · «Dentro la sagoma ci sta il suo nome e basta»

**Cosa era stato deciso, e quando.** Il 14/08, da Alessio, **dopo averlo
visto**: sulla sagoma il solo nome.

**La ragione di allora.** In 90 cm non entrano due righe leggibili — sul
telefono si accavallavano, sul computer l'ora usciva tagliata.

**Cosa si decide adesso.** Torna una seconda riga: **la cifra dei coperti**,
col punto che segna «corretto a mano». Lo chiede il mandato del 18/08.

**Vale ancora, e questo è il prezzo che accettiamo.** Il problema non era «una
seconda riga», era **una riga lunga**: `20:00 · 2` in 90 cm non ci sta, `7 ·`
sì. Il prezzo è che nella sagoma non entra **nient'altro** — non «4 posti»,
non l'ora, non la ragione. Le parole stanno nell'elenco sotto. Se al collaudo
risultasse illeggibile anche così, cade il numero, non l'elenco.

---

## Le tre misure fatte prima di costruire

### 1 · Il vincolo, e chi altro conosce quel vocabolario

`dining_tables_sagoma_check` è **un solo vincolo composito su 9 colonne**: tre
vocabolari (`tipo`, `forma`, `zona`), quattro intervalli di misura, due regole
condizionali. Chi altro conosce il vocabolario di `tipo`:

| posto | c'è? |
|---|---|
| database | sì — il vincolo |
| una funzione che lo ridice | **nessuna** |
| un elenco in `constants.js` | **nessuno** |
| la schermata | **sì, ma non come elenco**: [`SalaEOrari.jsx:235`](../../src/pages/calendario/SalaEOrari.jsx) è un ternario con un ramo di scarico — `chef_table` finisce in «Bancone» per default, non per scelta |

### 2 · 🔴 La rete del 17/08 non scatta, e non scatterebbe mai

Il mandato chiedeva di **verificare che scatti**. Misurato: **non vede quel
vincolo, e per costruzione.** `vocabolari_chiusi()` filtra
`array_length(k.conkey, 1) = 1`, e il commento di quella stessa migrazione
nomina *«la sagoma di un tavolo»* come ragione del filtro — per non riempire
la rete di falsi allarmi. Riproducendo il ramo (b) della funzione in
produzione: la riga esiste con `n_colonne = 9` → **`la_rete_lo_vede = false`**.

**Conteggio, misurato in produzione**: **1** vincolo composito porta
vocabolari, ed è questo; dentro ce ne sono **3**. Quindi la rete guarda **82**
vocabolari e **3 le sfuggono** — non per difetto, per il filtro dichiarato.
La riga è stata scritta accanto agli 82 in `CLAUDE.md`: *un elenco che
dichiara cosa non contiene è una rete; uno che tace è una falsa sicurezza.*

⚠️ **Lo scorporo non si fa in questo giro**, per decisione del validatore: con
la capacità sul formato il vincolo non si allarga, quindi l'avvertenza
operativa non ha più il suo bersaglio e non c'è niente da vedere scattare.
Va in coda, unito alla voce *«il controllo che guarda la forma invece del
comportamento»* — insieme al ternario di `SalaEOrari.jsx`, che è un valore
predefinito che sbaglia in silenzio, cioè i 33 posti in un'altra veste.

### 3 · Dove il numero viene riletto sul passato

Chiesto dal validatore: se domani un formato passa da 4 a 5, cosa succede alle
serate già passate?

**Misurato: sì, viene riletto.** Il selettore di data della pianta
([`PiantaGiornata.jsx`](../../src/pages/calendario/PiantaGiornata.jsx)) è un
`<input type="date">` **senza `min`**: le serate passate sono raggiungibili, e
la capienza verrebbe ricalcolata coi formati di oggi.

**Non è stato congelato niente** (non era richiesto, e per le decisioni future
è giusto: si decide sempre col numero di adesso). **È dichiarato**, e non solo
qui: `posto_per_la_serata()` **restituisce la frase insieme al numero** —
*«Serata passata: la capienza è ricalcolata coi formati di oggi, non è una
fotografia di allora»* — così un'eventuale seconda schermata che mostrasse lo
stesso totale se la porta dietro. Stessa forma di `calcola_imposte()`.

---

## Cosa è stato costruito

### `formati_tavolo` — la capacità è un dato di Alessio

Due righe (90×90 → 4, 180×90 → 6), modificabili da *Calendario Eventi → Sala e
orari* senza migrazione. `dining_tables.formato_id` obbligatorio sui tavoli e
vietato sugli arredi fissi (vincolo **nuovo e separato**,
`dining_tables_formato_check`).

**Perché sul formato e non sulla sagoma**: Alessio non ha detto «i 180 non si
accostano perché sono larghi», ha detto **«perché sono di uno stile
diverso»** — che è una proprietà del formato. Scriverlo lì registra la sua
*ragione* invece di un suo *effetto*: due 90×90 di un altro stile comprati
domani sarebbero un formato diverso e, correttamente, non accostabili a questi
sette.

⚠️ **`posti_fissi` e `formati_tavolo.coperti_base` non sono un doppione**, ed è
scritto nella migrazione perché il prossimo che legge non ci metta un
guardiano: `posti_fissi` è un'etichetta su un arredo **fisso** (divano, Chef
Table) ed è dichiarato **fuori** dal conteggio di «c'è posto?»;
`coperti_base` alimenta quel conteggio e vive solo sui tavoli. Il
discriminante del 17/08 — *direbbero esattamente la stessa cosa?* — risponde
no, quindi nessun riflesso e nessuna rete.

**Sanatoria dichiarata**: 7 tavoli quadrati e 2 lunghi assegnati per misura,
una volta sola, solo dove il formato era vuoto. Un tavolo di una misura che
nessun formato descrive **non si indovina**: la migrazione si ferma e lo
nomina.

### La regola dell'accostamento

Due tavoli sono accostati quando sono dello **stesso formato** e i loro
rettangoli **si toccano** su un lato. Coperti = somma meno due per giunzione.

⚠️ **Dove finisce la geometria e comincia la regola**: *se* due tavoli si
toccano non può venire da altro che dalla posizione; *quanti* ne tengono è
aritmetica **scritta**. Il gruppo resta **derivato per data** e non è una
tabella — il **Contratto §5** («nessuna entità gruppo di tavoli») resta vero,
e non è stato toccato.

Due misure con la loro ragione: **tolleranza 5 cm** (l'aggancio della pianta è
a 10, quindi accostati si toccano esatti e distanti sono ad almeno 10: 5 sta in
mezzo) e **contatto minimo 30 cm** (due tavoli che si sfiorano a uno spigolo
non sono un tavolone).

### La correzione a mano — una sola, sull'insieme

`correzioni_coperti (data, tavoli[], coperti, ragione)`, chiave l'**insieme di
tavoli di quel giorno**; un tavolo singolo è un insieme di uno.

⚠️ **Il «contro il muro» non è stato costruito**, e la ragione è quella del
validatore: sarebbero due strade per lo stesso numero, il flag saprebbe solo
sottrarre, e potendo contraddirsi servirebbe una **precedenza inventata**. Il
muro si scrive nella ragione.

⚠️ **Decade quando l'insieme cambia**, per decisione di Alessio, e non serve
cancellare niente: se l'insieme non è più un gruppo, nessuna riga combacia.
**Sparire è il comportamento voluto** — ed è la distinzione che al 17/08
mancava un nome: *ciò che rende un valore che sparisce un difetto altrove non
è la sparizione, è il silenzio*. Qui lo schermo lo dice, sotto l'elenco.

⚠️ **Non si cancella da sola**: riformando lo stesso insieme lo stesso giorno,
il numero torna. Scelta dichiarata — un trascinamento per sbaglio non deve
distruggere un numero scritto a mano.

### Chi ha corretto, e quando (`20260818000002`)

Condizione posta dal validatore aprendo la correzione **a tutto lo staff**.

**Il «quando» non prende una colonna nuova**: `aggiornato_il` c'è già e la
scrive lo stesso trigger — una seconda direbbe la stessa cosa e potrebbe
contraddirla (regola del 16/08). Si espone quella.

**Il «chi» è onesto su quanto il gestionale sa davvero.** Misurato prima di
scegliere: gli accessi sono per **ruolo** e non per persona (2 titolari + 2
staff in `user_roles`, utenti di prova compresi), e `user_roles` si legge
**solo per la propria riga** — quindi una giunzione per mostrare il ruolo di
un altro tornerebbe **vuota in silenzio**. Quindi:

- in tabella si conserva `corretto_da`, cioè **l'identificativo vero**
  dell'accesso: è il fatto durevole, e il giorno che esisteranno accessi per
  persona rende la storia attribuibile **all'indietro** senza rifare niente;
- a schermo si dice ciò che si può sapere senza aprire un permesso nuovo:
  **«l'hai messo tu»** oppure **«da un altro accesso»**, più la data.

⚠️ **Limite dichiarato**: finché si entra per ruolo, «un altro accesso» è
tutto ciò che si può dire con verità. Un nome sarebbe inventato.

**E l'accesso condiviso è una scelta, non un rinvio** (Alessio, 18/08): per
adesso lo staff entra con un accesso solo. Conservare **sotto** l'identificativo
vero è quindi una scelta esplicita e non un dettaglio di implementazione — è
**la forma opposta al campo dimenticato**: un dato conservato oggi *perché
servirà*, invece di uno perso *perché oggi non serviva*. Il giorno degli
accessi personali, la storia vecchia diventa leggibile all'indietro senza che
si rifaccia niente.

⚠️ **Due posti dove l'accesso condiviso costa, girati da qui ad Alessio e
scritti in `CLAUDE.md` §10 perché non si perdano:**
- **il manuale HACCP esibibile** registra chi ha fatto letture e pulizie: con
  un accesso solo dirà «staff» ovunque. **Va sentita Tiziana** — se per lei è
  un problema, la scadenza si sposta da «prima di assumere» a **«prima
  dell'apertura»**;
- **cassa e mance** sono i due posti dove, quando un numero non torna, la
  domanda è *«chi»*: con l'accesso condiviso non ha risposta, e sulle mance i
  soldi sono **di altri**.

⚠️ **Lo scrive il trigger, mai la schermata** — un campo che la schermata può
dimenticare di passare è un campo che prima o poi si perde in silenzio (il
`mezzo` delle mance, 16/08).

⚠️ **`is not distinct from` e non `=`**: con `auth.uid()` nullo (una
migrazione, una verifica) un confronto normale darebbe `NULL`, che a schermo
si legge «non l'ho fatto io» — cioè una risposta al posto di «non lo so».

⚠️ **La verifica chiama anche `posto_per_la_serata()`**, che *non* è stata
ridefinita ma chiama la funzione qui buttata e rifatta. Postgres non traccia
le chiamate fra funzioni: si sarebbe potuta lasciare rotta senza che niente lo
dicesse fino al primo uso. È la lezione del 17/08 applicata al caso in cui a
rompersi è il **chiamante**. E il caso «un altro accesso» è provato con un
utente diverso, perché una prova fatta col solo proprio accesso passerebbe
anche se la funzione rispondesse sempre «sì, sei stato tu».

⚠️ **L'array è ordinato da un trigger**: senza, un client che passasse
l'insieme in ordine sparso scriverebbe una riga che non combacia mai — nessun
errore, e la correzione invisibile per sempre. Ordinato **per id e non per
etichetta**, così rinominare un tavolo non fa perdere una correzione.

### «C'è posto?» e la soglia

`posto_per_la_serata(data)`: capienza, prenotati, in attesa, restanti, soglia,
avvertenza. **Avvisa, non impedisce** — non c'è niente che si spenga o rifiuti.

⚠️ **Le richieste in attesa non si sommano ai confermati** (14/08: una
richiesta in attesa non tiene niente) **ma si dichiarano a parte**: sommarle
direbbe «prenotati» di gente che non ha prenotato, nasconderle farebbe
superare la soglia confermandone quattro insieme.

⚠️ **Il conteggio guarda i soli tavoli**: divani e Chef Table restano fuori
perché sono **un'altra formula** (l'aperitivo), non perché siano stati
dimenticati — e l'avvertenza lo dice.

Soglia **25** in `service_settings.soglia_coperti_serata`, modificabile da
*Sala e orari*. Il predefinito non risponde al posto di Alessio: **è** la sua
risposta, dichiarata nel mandato.

### Dove vive il calcolo

Sopra `pianta_del_giorno(p_data)`, che è già l'unico posto dove pianta base e
scostamento del giorno si sommano. Così la sala disegnata e il conteggio non
possono dire due numeri diversi — stesso principio di `orderTotals()`.

**Categoria A del Contratto**: correzione e formati scrivono su **una** tabella
ciascuno, quindi chiamata diretta. Il corridoio non è stato toccato, e non
doveva esserlo.

---

## Le prove, e la controprova

Tre versi, **discriminanti solo insieme** (`tests/app/coperti-sala.test.js`, 6
prove nuove):

1. **stessa sera, stesse prenotazioni, due disposizioni → due totali.** Le
   prenotazioni restano identiche fra le due misure; si asserisce la
   **differenza** (`capienza_B === capienza_A - 6`), non il numero.
2. **la correzione sopravvive** a un ricalcolo che non cambia l'insieme (il
   tavolone si sposta **intero**);
3. **e decade** quando l'insieme cambia — mentre la correzione dell'altro
   formato, il cui insieme non è cambiato, resta.

Più: i due formati **non si fondono** toccandosi, e la soglia si prova
**facendola scattare nei due versi** invece di confrontarla con sé stessa —
`oltre_soglia === prenotati >= soglia` sarebbe vero anche se la soglia non
fosse letta da nessuna impostazione. Il valore di Alessio viene **rimesso
com'era**, e il ripristino è verificato.

**Esercitati entrambi i formati**, in ogni verso: una regola scritta solo per i
quadrati passerebbe una prova costruita solo sui quadrati.

### La controprova: rotte apposta, viste diventare rosse

Sul progetto di prova, due versioni deliberatamente sbagliate:

| cosa è stato rotto | esito |
|---|---|
| il calcolo **ignora le giunzioni** | **3 prove rosse su 6** |
| la correzione **non decade mai** (match per sovrapposizione invece che per uguaglianza) | **1 rossa**, ed è esattamente la n. 4 |

Poi la migrazione è stata riapplicata per rimettere a posto, e lo script
usa-e-getta cancellato.

### Il difetto trovato dalle prove, che leggendo non si vedeva

🔴 Le prime sei prove rispondevano **`permission denied`** mentre la stessa
funzione, chiamata da psql come ruolo `authenticated`, rispondeva
regolarmente. Misurato invece che supposto (ACL, `security definer`, cache di
PostgREST: tutti a posto), la causa era che **le funzioni di
`src/lib/api/sala.js` usano il collegamento dell'app**, e la prova aveva
aperto un client suo: l'app parlava da **anonima**.
La prova ora entra sul collegamento dell'app — che è anche l'unico modo per
cui eserciti il tratto **fra schermata e database**, cioè il pezzo dove il
16/08 si è perso il `mezzo` delle mance.

---

## L'applicazione in produzione — i numeri veri

Applicate **2 su 2**, in ordine. Totale in produzione: **131 migrazioni**.
I tre controlli chiesti dal validatore, letti col connettore in sola lettura:

**1 · Le sagome sono ancora 13 e identiche.** 13 righe, 13 attive: 9 tavoli,
3 divani, 1 Chef Table, 2 ruotate. Misure, zone, posizioni, versi e
`posti_fissi` invariati rispetto alla misura fatta a inizio sessione — la
migrazione scrive **solo** `formato_id`.

**2 · Ciascun tavolo ha preso il formato giusto.**

| formato | coperti | quanti | quali |
|---|---|---|---|
| Quadrato 90×90 | 4 | **7** | T3, T4, T5, T6, T7, T8, T9 |
| Rettangolare 180×90 | 6 | **2** | T1, T2 |

**3 · Chef Table e divani sono fuori dal conteggio della cena, non dentro con
un numero.** Per **due** ragioni indipendenti, entrambe verificabili dal
connettore: nessun arredo fisso ha un formato (**0**), e
`coperti_del_giorno()` filtra `p.tipo = 'tavolo'` **e** passa da un `join
formati_tavolo` che loro non hanno. I `posti_fissi` restano dove stavano e
non entrano in nessun calcolo: *Chef Table = 4 · Divano 1 = 6 · Divano 2 = 6 ·
Divano 3 = 6*. E il vincolo del 14/08 regge: **0** tavoli con `posti_fissi`.

⚠️ **Nota per chi valida**: `coperti_del_giorno()` è concessa al solo ruolo
dell'app, quindi **dal connettore in sola lettura non è eseguibile** — è
corretto che sia così. I controlli qui sopra sono scritti apposta per essere
rifatti senza chiamarla.

### Il primo numero vero della sala

Nella disposizione base di adesso **T5·T6 sono accostati e T7·T8·T9 pure**:
due giunzioni nel secondo gruppo, una nel primo. Con la regola, la sala vale
**34** e non 40 — che è esattamente il punto di tutto il giro.
⚠️ Calcolato **a mano dalle coordinate**, non letto dalla funzione (vedi la
nota qui sopra): è il primo numero che Alessio vedrà a schermo, e va
confrontato con quello.
⚠️ E **`CLAUDE.md` §12 diceva «T5·T6·T7 accostati e T8·T9 accostati»**: era
vero il 14/08 e non lo è più, perché Alessio nel frattempo li ha spostati.
Corretto — è una descrizione di come sono messi, non una regola.

---

## I cinque rilievi della validazione — cosa è stato fatto

Migrazione **`20260818000003_gli_orfani_e_la_traccia_della_sala.sql`**.

### 1 · Tolleranza 5 cm contro aggancio a 10 — misurato, e il rapporto ora è scritto

**Misura chiesta, misura fatta.** Nella sala vera le tre coppie accostate
(T5-T6, T7-T8, T8-T9) stanno a distanza **0**, non a 10. E la ragione non è
fortuna: **tutte e 13 le sagome hanno misure multiple di 10** (misurato: 0
fuori). Con le posizioni agganciate a un passo di 10 e ogni misura multipla di
10, **ogni bordo cade su un multiplo di 10** — quindi le distanze possibili
sono 0, 10, 20… e mai qualcosa in mezzo. Una tolleranza strettamente fra 0 e
10 è perciò **equivalente a «distanza esattamente zero»**: assorbe un
arrotondamento, non accosta tavoli lontani.

**Quindi il difetto non è vivo, ma i due numeri non erano collegati.** Ora:

- vivono in **un posto solo** ([`src/lib/calcoli/sala.js`](../../src/lib/calcoli/sala.js)),
  col rapporto scritto per esteso, e `PiantaSala.jsx` importa il passo da lì
  invece di dichiararlo per conto suo;
- una **prova pura** congela il rapporto (`tolleranza < griglia`) **e lo prova
  al contrario** — senza, la funzione potrebbe restituire `true` sempre;
- una **prova sui dati veri** verifica l'ipotesi che regge tutto: ogni misura
  è multipla del passo. ⚠️ Il giorno che entra in sala un tavolo da 95 cm
  quella prova diventa **rossa da sola**, e si scopre leggendo un errore
  invece che contando male i coperti di una serata.

⚠️ **Non è un vincolo del database, ed è una scelta**: vietare ad Alessio un
mobile di una misura qualsiasi sarebbe una regola scritta da noi sulle sue
cose. La rete avvisa, non impedisce — come tutto il resto di questo giro.

**E la prova è stata VISTA diventare rossa**, non data per funzionante — la
condizione posta dalla validazione, ed è la lezione del formattatore degli
importi (*un controllo che nessuno ha mai visto scattare è un controllo di cui
non sappiamo niente*). Messo T3 a **95 cm** sul progetto di prova: **una sola
prova rossa su sette**, e il messaggio nomina il tavolo e dice dove andare a
rivedere i due numeri. Poi rimesso il valore **che c'era** — non uno «giusto».

⚠️ **E quel giro ha trovato di più di quanto cercava**: modificando T3 la sua
`updated_at` si è riempita, e questo ha messo in luce che la verifica della
migrazione 3 sarebbe fallita da lì in avanti (vedi sotto). *Il difetto non è
uscito rileggendo il codice: è uscito chiedendosi come far fallire una prova.*

### 2 · La sovrapposizione ≥ 30 cm è aritmetica scritta, non geometria

Dichiarata qui e nel codice, **insieme al «meno due per giunzione»**: sono
due numeri della stessa natura. Nessuno ha misurato che a 29 cm non ci si
sieda — è la soglia sotto la quale due tavoli che si toccano non fanno un
piano su cui apparecchiare.

**Vista lavorare sui dati veri, e il validatore l'ha confermata per conto
suo**: T5-T8 e T6-T7 stanno a distanza **zero** e hanno sovrapposizione
**−190** (cioè nessuna), e correttamente **non** risultano accostati. Senza
quella soglia, quattro tavoli che si sfiorano agli spigoli sarebbero diventati
un tavolone.

### 3 · Il blocco 2×2 — nessuna regola speciale, ed è la risposta giusta

**Fatta l'aritmetica prima di chiedere.** La regola non è approssimativa sui
blocchi: quattro quadrati 2×2 fanno un quadrato di 180×180, e la regola dà
16 − 2·4 = **8**, che è esattamente «due per lato». Tre in fila danno 8, e un
3×3 darebbe 12 — sempre il perimetro. **Il taglio a zero non si attiva in
nessuna disposizione ragionevole.**

⚠️ **Resta che, se si attivasse, nasconderebbe in silenzio un risultato
assurdo** — ed è la famiglia dello scarto a zero. Dichiarato come limite, e
come **ramo mai percorso**.

**Deciso da Alessio: nessuna regola speciale.** Oltre alla fila la regola resta
**la stessa** — somma meno due per giunzione, su qualunque forma — e se un
numero non gli torna lo sistema con la **correzione a mano**, che esiste già.
⚠️ E la ragione vale oltre questo caso: *una regola in più per un caso raro è
un posto in più dove sbagliare.*

### 4 · La resurrezione della correzione — una DECISIONE, non un funzionamento

🔴 **Il difetto vero era la frase, non il comportamento**, ed è il risultato
migliore di questo giro. La schermata diceva solo *«decade e torna quello
calcolato»*, e poi rifacendo lo stesso accostamento nello stesso giorno il
numero **tornava**: **la schermata dichiarava una perdita che non avveniva.**

⚠️ **È una famiglia che avevamo già visto, ma mai qui.** È la stessa forma del
manuale HACCP che stampava «conforme» dove il database apriva una non
conformità: **un testo che descrive male il proprio programma.** Fino a oggi
l'avevamo incontrata solo su **documenti esibibili**, dove il danno è verso
un'ispezione. Qui era su **un messaggio di interfaccia** — e il danno è che
qualcuno rinuncia a un gesto perché il programma gli dice che perderà qualcosa
che invece non perde. *Vale come precedente: la famiglia non riguarda solo ciò
che si stampa.*

**Ed è una DECISIONE, non la descrizione di come funziona.** Scritta così
perché è esattamente la distinzione che il registro dei rovesciamenti esiste
per tenere in vita:

- **Alessio aveva detto una cosa più stretta** — *«quando divido un tavolone
  che avevo accostato, torna al numero originale calcolato»*. Della
  **sopravvivenza al rimontaggio** non aveva detto niente: è **un'estensione
  mia**.
- **La mia ragione**: la riga non si cancella perché un trascinamento per
  sbaglio non deve distruggere un numero scritto a mano, e la correzione è
  legata a *quei tavoli in quella giornata* — se tornano insieme, è di nuovo il
  caso per cui era stata scritta.
- ✅ **Confermata da Alessio il 18/08**, girata dal validatore proprio perché
  era mia e non sua. Nessuna riga da cambiare — ma resta scritta come scelta,
  non come effetto collaterale.

**E la schermata ora lo dice per intero**: «non lo perdi — se rimetti insieme
gli stessi tavoli oggi stesso, torna anche il tuo numero».

### 5 · Le correzioni orfane

Un array non può avere una chiave esterna, quindi il vincolo si scrive come
**reazione**: un trigger su `dining_tables` che, cancellata una sagoma,
**toglie le correzioni che la nominano**. ⚠️ Cancella la riga **intera** e non
l'elemento: togliere un tavolo da un insieme lo farebbe combaciare con un
gruppo *diverso*, cioè un numero deciso per tre tavoli finirebbe addosso a due.

⚠️ **Provato nei due versi**: la correzione che nomina la sagoma sparita se ne
va, **e** una che non la nomina resta. Senza il secondo, un trigger che
cancellasse tutto avrebbe passato il primo.

⚠️ **Il caso che il trigger non prende, dichiarato**: una **ricostruzione** rifà
le sagome con identificativi nuovi senza cancellare le vecchie, quindi le
orfanerebbe tutte in un colpo — la lezione del giro A. Non si chiude con un
vincolo: si chiude sapendo che `correzioni_coperti` è **un appunto per una
giornata, non uno storico**. Se un giorno servisse conservarlo, servirà prima
una regola su quanto.

### Le due aggiunte non chieste, dichiarate come tali

Nessuna delle due era nei rilievi; entrambe chiudono un buco che i rilievi
hanno fatto emergere, e vanno scritte perché **chi legge fra sei mesi capisca
perché ci sono**.

**1 · Le correzioni se ne vanno con la sagoma.** Chiude la famiglia
dell'orfano **nel verso pulito**: via con lei, non lasciate lì a non
combaciare con niente. L'alternativa — lasciarle e filtrarle a ogni lettura —
è la stessa forma del flag «cancellato» che questo progetto ha scartato l'08/08:
basta dimenticare un filtro.

**2 · `dining_tables.updated_at` nasce da un LIMITE DI VERIFICA, non da un
difetto.** Nessun dato era sbagliato: è che la validazione, dal connettore in
sola lettura, **non poteva distinguere «non ho toccato le posizioni» da «le ho
toccate e rimesse uguali»** — non esiste una fotografia di prima, e la tabella
non aveva una data di ultima modifica. Quella notte quel punto è rimasto **sulla
mia parola**. La colonna esiste perché la **prossima** volta non debba
rimanerci: non sorveglia nessuno, rende rispondibile una domanda che oggi non
lo era.

⚠️ **Nasce senza valore predefinito** (lezione del 14/08): su una riga già
esistente un predefinito dichiarerebbe una modifica mai avvenuta. Si chiama
`updated_at` e non `aggiornato_il` perché `set_updated_at()` scrive quel nome,
e riusarla su un nome diverso fallisce a tempo di esecuzione (trappola del
12/08).

🔴 **E la sua verifica era sbagliata, trovato pensando a come rendere rossa una
prova.** La prima stesura pretendeva che **nessuna sagoma preesistente** avesse
una data: vero il giorno dell'applicazione, **falso per sempre dopo** — sarebbe
bastato che Alessio rinominasse un tavolo o ne spegnesse uno, che sono gesti
legittimi, perché la migrazione si rifiutasse di riapplicarsi **su una sua
scelta**. È la lezione del 14/08 sommata a quella del 16/08: *un guardiano dice
come deve essere fatto il mondo, non com'era quando l'ho guardato.* Al suo
posto la proprietà vera — **la colonna non ha un valore predefinito** — che è
ciò che davvero garantisce l'assenza di modifiche inventate. Quante sagome non
sono mai state toccate resta come **notizia**, non come pretesa.
**Dimostrato**: dopo aver modificato T3 sul progetto di prova, la migrazione si
riapplica ancora — ed è esattamente il caso che la versione di prima avrebbe
fatto fallire.

⚠️ **Nasce senza valore predefinito** (lezione del 14/08): su una riga già
esistente un predefinito dichiarerebbe una modifica mai avvenuta. Vuoto vuol
dire «mai toccata da quando la colonna esiste», che è la verità — e la verifica
controlla proprio questo, che **nessuna delle 13 sagome preesistenti dichiari
una modifica**. Si chiama `updated_at` e non `aggiornato_il` perché
`set_updated_at()` scrive quel nome, e riusarla su un nome diverso fallisce a
tempo di esecuzione (trappola del 12/08).

---

## Le due scelte che la validazione ha riconosciuto migliori del richiesto

Registrate qui **come scelte** e non come dettagli, perché siano ripetibili:

1. **L'autore lo scrive il database, non la schermata.** La schermata non può
   dimenticarlo, e non c'è nessun campo da passare che qualcuno possa omettere.
   È la **cura strutturale** della famiglia dei 33 posti dove una dimenticanza
   sbaglia in silenzio — invece di aggiungere il trentaquattresimo.
2. **`dining_tables_formato_check` è un biconditional** (`(tipo = 'tavolo') =
   (formato_id is not null)`) e non due controlli separati. Il verso che conta
   è quello meno ovvio: **impedisce a un tavolo senza formato di sparire in
   silenzio** dall'`inner join` di `coperti_del_giorno()`, cioè di far
   risultare la sala più piccola del vero senza nessun errore.

E un terzo, di forma: `is not distinct from` sul confronto dell'autore, perché
con `auth.uid()` nullo un `=` darebbe `NULL` — che a schermo si legge «non
l'ho fatto io», cioè una risposta al posto di «non lo so».

---

## Cosa NON è verificato

- ⚠️ **Nessuna mano vera l'ha ancora usato.** Il numero sulla sagoma, la
  correzione a mano e il riquadro «c'è posto?» non sono mai stati toccati da
  Alessio. In particolare **non è stato verificato che la cifra sia leggibile**
  in un quadrato di 90 cm su un telefono: è precisamente il punto su cui il
  14/08 lui aveva corretto una mia scelta guardandola.
- **Zero prenotazioni vere** in produzione per una serata piena: la soglia dei
  25 non è mai scattata su dati veri.
- **Il conteggio non è mai stato confrontato con la sala vera apparecchiata.**
  I numeri (4 e 6) sono suoi e tornano da soli — 7×4 + 2×6 = 40, che è il «40
  sulla carta» del mandato — ma nessuno ha ancora contato le sedie.
- **Due tavoli che si SOVRAPPONGONO non risultano accostati**, e la cosa è
  silenziosa. La pianta base ha un controllo sulle sovrapposizioni, la
  disposizione di una giornata no. Non è stato chiuso in questo giro:
  un'occlusione è un errore di trascinamento, non un tavolone.
- **Il taglio a zero di `greatest()`** non è mai stato visto attivarsi, perché
  non si attiva su nessuna disposizione ragionevole (vedi rilievo 3). Resta un
  ramo di codice mai percorso.
- **Il trigger delle correzioni orfane non è mai scattato su una sagoma vera**:
  le sagome si disattivano, non si cancellano. È provato solo su sagome create
  dalla verifica.
- **`prova:base` non semina né formati né correzioni**: lo stato di partenza
  del progetto di prova non ha ancora una serata con un tavolone corretto a
  mano da guardare.

---

## Il censimento sulle date — quinta ricomparsa, non scoperta nuova

Chiesto dal validatore **prima** del giro C, e per una ragione precisa: le tre
fasce di colore e il «da liberare entro le…» sono tutte affermazioni sugli
orari di **una serata che attraversa la mezzanotte**. Se «quale sera è questa»
non è deciso prima, il giro C riscrive la stessa trappola in tre posti nuovi.

**Misurata mentre era attiva**: alle 01:31 italiane il database rispondeva
`current_date = 2026-08-17`, cioè **ieri**. Fuso del database: UTC.

**Il censimento, letto dal database vero** e non dal testo delle migrazioni
(che conterebbe anche i blocchi di verifica): **18 punti vivi** — **10
funzioni** (20 occorrenze) e **8 colonne** con `default CURRENT_DATE`.

| | punti | quali |
|---|---|---|
| **intendono la SERATA DI SERVIZIO** | **11** | `registra_conteggio_cassa`, `conti_da_fiscalizzare`, `quadratura_fiscale`, `scarichi_senza_ricavo`, `versa_in_banca`, `pareggia_anticipazione` · predefiniti di `cash_movements.movement_date`, `tips_collected.collected_date`, `discounts_gifts.movement_date`, `conteggi_cassa.contato_il`, `daily_menus.service_date` |
| **intendono il GIORNO DI CALENDARIO**, e lì `current_date` è giusto | **7** | `pos_in_transito` e `previsione_cassa` (i giorni bancari sono giorni veri), `saldo_anticipazioni`, `submit_public_reservation` (un cliente prenota per una data) · predefiniti di `foraged_items.harvest_date`, `deductible_expenses.expense_date`, `anticipazioni_socio.pagata_il` |

⚠️ **Il numero che conta è il secondo**: il lavoro **non** è sostituire
`current_date` ovunque — su 7 punti sarebbe sbagliato. E i tre punti nominati
dall'audit dell'08/08 (prima nota, mance, sconti/omaggi) stanno tutti
nell'undici.

⚠️ **Dichiarata come RICOMPARSA.** È la stessa famiglia dell'audit dell'08/08
(14 punti JavaScript, `oggiLocale()`) e dello scenario di collaudo del 17/08,
dove l'avevo chiamata io stesso *«la stessa trappola riaperta in uno script
nuovo perché è solo un comando»*. **Quinta volta.** Una trappola curata cinque
volte sul posto e mai alla radice non è sfortuna: **manca un concetto** — la
«serata» non coincide col giorno di calendario, e finché non esiste come idea
nel programma continuerà a ricomparire ogni volta che qualcuno scrive una data
in un posto nuovo. Scritto così in `CLAUDE.md` §8, perché è quello il lavoro
vero quando lo affronteremo.

**Nessuna correzione in questo giro**, per decisione del validatore: la misura
decide se la cura sta nel giro C o in un lavoro a sé. Nel codice nuovo di
questa consegna la data locale è usata:
`(now() at time zone 'Europe/Rome')::date`.

⚠️ **CONDIZIONE SCRITTA ADESSO, VINCOLANTE PER IL GIRO C.** Il giro C parla di
orari di una serata che attraversa la mezzanotte: **qualunque cosa scriva lì
non deve aggiungere un dodicesimo punto a quell'elenco.** Se in C serve «che
sera è», si usa **un solo posto e lo si nomina** — anche se per ora fa la cosa
semplice — così quando arriverà il lavoro vero ci sarà **un punto solo da
cambiare invece di tre nuovi da trovare**.

---

## Per Alessio, in una riga

Sui tavoli compare quanti ne tengono; accostandone due il numero scende da
solo, e si può correggere a mano quando la sala dice altro. Quanti ne tiene un
tavolo e sopra quanti coperti farsi avvisare si cambiano da *Sala e orari*.
