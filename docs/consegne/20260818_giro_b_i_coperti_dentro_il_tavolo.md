# Giro B — i coperti dentro il tavolo, e «c'è posto?» dal telefono

**Consegna del 18/08/2026.** Mandato [«La sala e le prenotazioni»](../mandati/20260818_la_sala_e_le_prenotazioni.md),
punti **2 + 1**. Segue il [giro A](20260818_giro_a_la_sala_non_si_perde.md),
non ancora validato: il validatore guarda A e B insieme.

- **HEAD dichiarato**: `3188233`
- **Working tree**: pulito
- **Migrazioni**: `20260818000001_i_coperti_dentro_il_tavolo.sql` e
  `20260818000002_chi_ha_corretto_e_quando.sql`
- **Prove**: 49 pure + **150** sul progetto di prova (erano 144) — tutte verdi
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

---

## Per Alessio, in una riga

Sui tavoli compare quanti ne tengono; accostandone due il numero scende da
solo, e si può correggere a mano quando la sala dice altro. Quanti ne tiene un
tavolo e sopra quanti coperti farsi avvisare si cambiano da *Sala e orari*.
