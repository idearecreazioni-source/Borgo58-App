# Consegna del 13/08/2026 (sesta) — il magazzino scende da solo

**Commit della consegna: `ad78311`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `e81b069` | il magazzino scende alla chiusura di un conto — `20260813000013` |
| `ad78311` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260813000013`. **85 migrazioni**.
`operazioni-atomiche` reinstallata (**v15 → v16**).

È il **Blocco 1 del mandato «dal magazzino che scende alla rotta
economica»** e chiude il **rilievo 7 del referto**. Del referto resta
aperto **solo l'IRAP**, che aspetta Laura.

---

## 1. Cos'era rotto, e perché non si vedeva

Chiudere un conto scriveva sul conto e sulla cassa e **non toccava la
giacenza in nessun modo**: nessun trigger su `orders`/`order_items`, e le
uniche due cose che muovevano il magazzino erano il carico da fattura
(che lo fa salire) e lo scarico a mano. Con le ricette perfette e la
cella piena, **servire cento coperti lasciava la giacenza esattamente
com'era**.

Nessun errore, nessun avviso: un difetto che non si annuncia. Si sarebbe
scoperto contando a mano — cioè mai, o troppo tardi.

⚠️ **La conseguenza peggiore non era la giacenza sbagliata**: la Fase A
della filiera della spesa fa comparire un ingrediente in lista quando
scende sotto soglia. Con una giacenza che non scende, quella lista
sarebbe stata **costruita, funzionante e muta per sempre** — e sarebbe
sembrata a posto.

---

## 2. Le due decisioni di Alessio

**Quando scende la giacenza.** Alla **chiusura del conto**, non all'invio
in cucina. Un conto si chiude sempre, anche quando è un omaggio; e uno
storno prima della chiusura non deve rimettere dentro niente, perché
niente era ancora uscito.

**Un conto annullato non scarica mai.** Gli avevo proposto la regola più
prudente — «scarica se i piatti erano già andati in cucina» — e l'ha resa
inutile con un fatto del suo locale che io non potevo sapere:

> *«Se il pasto viene prodotto e consumato il conto viene chiuso in modo
> diverso, quindi l'annullamento avviene solo quando la cucina non ha
> ancora prodotto nulla.»*

Da lui un pasto mangiato e non pagato si chiude come omaggio o con una
causale, non si annulla. La mia regola avrebbe quindi scaricato merce mai
uscita dalla cella, in cambio di più codice.

---

## 3. Le regole che valgono più del calcolo

### Non si inventa mai uno scarico

Una voce libera non ha ricetta; una ricetta vuota, o con la resa non
indicata, non dice quanto togliere. In quei casi **non si toglie niente e
lo si dichiara**: la riga finisce in `anomalie_scarico`, che compare in
Magazzino **solo quando c'è qualcosa** — un riquadro che dice «tutto a
posto» ogni giorno si impara a non guardare.

È di nuovo la lezione dello scarto a zero e del «parziale: N conti». Uno
zero silenzioso è peggio di un buco dichiarato, perché ha l'aria di
essere un dato.

### Lo scarico non blocca MAI la chiusura del conto

È una scrittura di **conseguenza**: il cliente ha pagato e sta
aspettando. Se la giacenza non basta si toglie quello che c'è e si scrive
quanto mancava; se succede un guasto imprevisto il conto si chiude lo
stesso, resta l'anomalia e parte un avviso.

⚠️ **Provato forzando un guasto vero**, non sulla parola: la verifica
mette un ostacolo sulla scrittura dei movimenti, chiude un conto dal
ruolo dello staff, e pretende tre cose — che il conto risulti chiuso, che
il guasto sia registrato, e che **non resti mezzo scarico dietro di sé**.
Pretende anche che il conto **non** risulti scaricato, altrimenti non si
potrebbe più riprovare.

### Lo scarto entra nel conteggio, e la regola è una sola

La ricetta dice 200 g puliti, ma per averli se ne prendono 235 dalla
cella: si scarica ciò che esce davvero. La ricorsione che esplode le
preparazioni fino alla materia prima è **la stessa di `v_recipe_costs`**,
non una copia riscritta: due regole per la stessa cosa finirebbero per
dire due numeri diversi, e nessuno se ne accorgerebbe (stesso principio
di `orderTotals()` e `posti_liberi()`).

⚠️ **L'aggancio al Blocco 2 è già previsto**: oggi un semilavorato non ha
un lotto proprio, quindi si esplode. Quando arriveranno le Produzioni,
una preparazione con i suoi lotti smetterà di essere esplosa e verrà
scaricata come se stessa — altrimenti si scaricherebbe due volte.

### Il costo si fotografa adesso

Scaricando dai lotti si sa quanto è costata davvero quella merce, coi
prezzi di quel giorno (`stock_consumptions.costo`). È il **food cost
reale** su cui vive il Blocco 3, e fra sei mesi non si ricostruisce —
stessa ragione del costo degli omaggi di questa mattina.

⚠️ **Conseguenza sui permessi**: `stock_consumptions` aveva la lettura
aperta a chiunque fosse autenticato. Senza il costo era innocua; **col
costo sarebbe il listino d'acquisto a disposizione della sala**. È
diventata titolare-only. Nessuna schermata la leggeva — la funzione che
lo faceva era codice morto, rimosso nell'audit dell'08/08 — quindi non si
rompe niente.

### Doppio scarico impossibile per costruzione

Il segno sta sul conto (`orders.magazzino_scaricato_il`) e un **indice
unico** su (conto, ingrediente) rifiuta un secondo scarico **anche
aggirando la funzione** (provato). Prevenire invece di segnalare, come
per il doppio pagamento di una fattura fornitore.

---

## 4. Chiudere un conto pagato entra nel corridoio

Prima era un `update` su una riga sola fatto dal browser: categoria A,
legittima. Da adesso chiudere tocca `orders`, `stock_lots`,
`stock_consumptions` e `anomalie_scarico` — quattro tabelle che devono
riuscire o fallire insieme, cioè **B4**: una sola funzione Postgres,
invocata attraverso `operazioni-atomiche`.

`close_order_as_discount_gift` è stata ricreata identica con la sola
aggiunta dello scarico in fondo: **un pasto regalato consuma ingredienti
come uno pagato**, e non scaricarlo lascerebbe una giacenza ottimista
proprio sui conti che già costano.

---

## 5. Il telefono di Alessio non ha squillato

Il guasto finto della verifica fa partire un avviso **vero** — è
esattamente la trappola dell'11/08, quando il collaudo di una migrazione
gli mandò una prenotazione finta su Telegram.

Silenziato **usando il freno anti-tempesta del sistema stesso** (un
avviso per tipo all'ora), mettendogli davanti un allarme di quel tipo
appena creato: la regola viene percorsa per intero fino in fondo, il
messaggio non parte. Spegnere l'avviso avrebbe verificato meno.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| il fabbisogno con una preparazione dentro il piatto (0,75 kg) | **provato** |
| lo scarto entra nel conteggio (0,25 → 0,30 kg) | **provato** |
| **FEFO**: si svuota prima il lotto che scade domani | **provato** |
| il costo dei lotti toccati (0,5×2,00 + 0,25×4,00 = 2,00 €) | **provato** |
| giacenza insufficiente: si toglie il possibile, si dichiara il mancante | **provato** |
| voce libera e ricetta vuota dichiarate, non indovinate | **provato** |
| una riga stornata non scarica niente | **provato** |
| **guasto forzato: il conto si chiude lo stesso** | **provato**, e senza mezzo scarico |
| un conto annullato non tocca la giacenza | **provato** |
| chiudere due volte non scarica due volte | **provato**, anche aggirando la funzione |
| lo staff respinto sull'elenco di ciò che non è sceso | **provato** |
| lo sconto/omaggio scarica (letto sul corpo della funzione) | **provato** |
| chiusura dal **ruolo vero dello staff** | **provato** |
| prove automatiche | **36 verdi** (erano 30) |
| lint, build | puliti |
| **produzione** | **85 migrazioni**, corridoio **v16** |
| elenco anonimi · `security definer` senza portiere | **12** · **14**, invariati |
| residui della verifica in produzione | **zero**, 17 lotti intatti, zero allarmi |

`close_order_paid` non entra nel secondo elenco perché il controllo
sull'utente ce l'ha dentro, come `close_order_as_discount_gift`.

---

## 7. Cosa NON è verificato, e lo dico chiaro

- **Non è stato visto con dati veri, e non può esserlo oggi**: il
  Ricettario è **vuoto** (0 ricette, 0 voci di menu, 0 conti). Nessun
  conto reale può ancora scaricare niente. Le verifiche sono quelle
  dentro la migrazione e le 6 prove automatiche nuove — che girano coi
  ruoli veri, ma su dati costruiti apposta e cancellati subito.
- **Il caso interessante è quello che manca**: un piatto vero, con una
  ricetta vera, servito e pagato. Fino ad allora il numero che scende
  dalla cella non è mai stato confrontato con quello che è uscito
  davvero.
- **Le rese delle preparazioni sono quelle dichiarate in ricetta**, non
  quelle misurate: è il Blocco 2, e finché non c'è, un semilavorato
  scarica secondo il libro.
- **I dati di collaudo restano in produzione** per decisione di Alessio
  di stasera, **rinnovata**: sono l'unica dispensa su cui provare questo
  e le Produzioni. Il limite non è una data ma un evento — la prima
  fattura vera di un fornitore vero.
- **`/prova-voce` è ancora lì.**
- **Il messaggio delle 10:00 dello scadenziario** non l'ha ancora visto
  partire nessuno.
