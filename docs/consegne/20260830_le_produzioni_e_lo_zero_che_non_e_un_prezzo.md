# Le Produzioni, e lo zero che non è un prezzo — 30/08/2026 (blocco 2)

**Commit che sta sotto questo riepilogo:** `237c4ec`
**Migrazioni introdotte:** `20260830000004` (lo zero che non è un prezzo),
`20260830000005` (il costo dichiara se è intero), più la parte di
`20260830000007` che classifica `stock_consumptions.quantita_senza_costo`.
**Applicate in produzione:** nessuna. Aspettano il push.

---

## 1. Le quattro cose chieste, e cosa si vede adesso

La schermata **non è stata rifatta** — sue parole: *«è carina sia su pc che
su cell»*. Sono quattro cambiamenti.

| # | chiesto | fatto |
|---|---|---|
| 2a | toccare una preparazione la mette fra le cose da fare, e non apre niente | sì |
| 2b | «Registrala» apre il modulo, con la preparazione già scelta | sì |
| 2c | «Da fare» è una sezione sua in cima, coi quadrotti | sì |
| 2d | l'elenco delle preparazioni in quadrotti sul telefono **e** sul computer | sì |

**Restano com'erano e non sono stati toccati** (punto P6): la ricerca,
l'ordine alfabetico, lo storico dentro ogni voce e «Rendila ricorrente».

### Provato con le mani, non dedotto

Aperta la schermata sul progetto di prova a 375 punti:

* i titoli sono **«Da fare (2)» · «Le preparazioni» · «Fatte di recente»**, e
  il modulo **non c'è**;
* toccato il quadrotto «Baccala mantecato»: il contatore è passato a
  **«Da fare (3)»**, è comparso *««Baccala mantecato» è fra le cose da fare»*
  e **il modulo non si è aperto**;
* premuto «Registrala»: è comparso **«Registra: Busiate trafilate»** coi
  quattro campi, la via d'uscita («Lascia stare») e «Registra la produzione».

Tutto rimesso com'era: le cose da fare sono tornate **2**, com'erano.

### ⚠️ Il prezzo di 2a, dichiarato

Per registrare una cosa **appena finita** adesso servono **due gesti** invece
di uno: la si tocca (entra fra le cose da fare) e poi si preme «Registrala».
È la strada scritta due volte nel mandato, ed è coerente — l'elenco è «cosa si
potrebbe fare», la sezione in cima è «cosa sto facendo adesso». Ma il costo
esiste, e la domanda è in fondo a questo riepilogo.

---

## 2. Il «costata 0,00 €», misurato invece che indovinato (P5)

Il mandato chiedeva di **misurare** e nominava due ipotesi: o la ricetta non
ha ingredienti prezzati, o il costo si perde per strada.

🔴 **Non è nessuna delle due.** Misurato sul progetto di prova:

| cosa | numero |
|---|---|
| righe di ricetta di «Busiate trafilate» | **2** |
| di quelle, con un prezzo | **2** |
| costo vero di quella produzione | **0,0034 €** — non zero |
| farina uscita | **405 g** |
| costo registrato per la farina | **0,0000** (a 1,35 €/kg sarebbero 0,55 €) |
| lotti senza prezzo d'acquisto, in tutto | **8 su 500** |
| scarichi finiti a costo zero con quantità > 0 | **130 su 13.789** |

**La causa**: il lotto da cui è uscita la farina **non ha un prezzo
d'acquisto**, e tutti e due i punti che scaricano scrivevano
`coalesce(unit_cost, 0)`.

Quindi i difetti erano **due, di natura diversa**:

1. **Un dato che non si è potuto leggere veniva mostrato come dato.** «È
   costato zero» diventava indistinguibile da «non so quanto è costato». È la
   famiglia inseguita dal 19/08, nel punto in cui fa più male: il numero che
   ne esce è **plausibile**, e nessuno mette in dubbio un costo un po' basso.
2. **0,0034 € si scriveva «0,00 €»**, che si legge «gratis».

### Le due cure

* **`stock_consumptions.quantita_senza_costo`** — quanta merce è uscita da
  lotti muti. Scritta da **tutti e due** i punti che scaricano (i conti e le
  produzioni), coi corpi presi dal database vivo.
* **`produzioni.costo_stato`** — `completo` / `parziale` / **vuoto**, e il
  vuoto vuol dire «registrata prima del 30/08, non lo so». Riempire le vecchie
  con «completo» sarebbe rispondere al posto di chi non c'era (trappola del
  14/08). Misurato: **14 produzioni** restano senza risposta.
* **`formatEUR`** — sotto il centesimo scrive **«meno di 0,01 €»**, nei due
  versi. ⚠️ **Non tocca il caso «vuoto»**: un importo che non c'è continua a
  scriversi 0,00 € come prima. È un difetto suo, di un'altra famiglia, e
  cambiarlo toccherebbe ogni schermata del gestionale in una notte in cui
  nessuno può guardarle tutte.
* **`riepilogo_preparazioni()`** porta il nuovo stato **dove Alessio l'ha
  visto**: dentro la voce, non nell'elenco in fondo. *Se la risposta
  arrivasse solo in fondo, la correzione sarebbe nella schermata sbagliata.*

### Visto a schermo

> Busiate trafilate · da fare · fatta 1 volta · l'ultima il 15 lug 2026 · da
> una dose escono in media 0,98 kg · **costata meno di 0,01 €**
> **registrata prima che il gestionale contasse i lotti senza prezzo: non so
> se quel costo è intero**

---

## 3. Come è stato verificato

### Un esempio costruito, coi numeri che separano le risposte sbagliate

Un ingrediente mio con **due lotti**: uno da 1 kg **a 2 €** che scade prima, e
uno da 5 kg **senza prezzo**. Una preparazione che ne chiede 2 kg.
Risultato atteso: costo **2,00** e non 4,00, «senza costo» **1** e non 0.
Con un lotto solo le due risposte coinciderebbero e la prova non proverebbe
niente.

E il **verso opposto**: dati tutti i lotti prezzati, la produzione deve
dichiarare **«completo»**. Senza, un codice che dicesse sempre «parziale»
passerebbe il primo controllo.

### Rotte in due modi, su due controlli diversi

| migrazione | rottura | dove è fallita |
|---|---|---|
| `…004` | nessuno conta i lotti muti | *«La produzione dichiara il costo «completo» invece di «parziale»»* |
| `…004` | sempre «parziale» | *«Con tutti i lotti prezzati la produzione dichiara «parziale»»* |
| `…005` | la porta si apre alla chiave pubblica | *«Il riepilogo è diventato leggibile con la chiave pubblica»* |
| `…005` | il corpo si crea ma non risponde | *«function funzione_che_non_esiste_affatto() does not exist»* |

⚠️ **Il corpo che non risponde si prova solo in `plpgsql`**: una funzione
`sql` viene controllata alla creazione. È la lezione del 17/08 — *un corpo che
si crea non è un corpo che funziona* — e per metterla alla prova bisogna
scegliere il linguaggio in cui il difetto è possibile.

### I permessi, misurati e non ricopiati

`riepilogo_preparazioni()` cambia firma, quindi va **buttata e rifatta** — e
una funzione rifatta **nasce aperta a tutti** (trappole del 24 e del 27/08).
Misurati prima: `anon` no, `authenticated` sì, `service_role` no. Rimessi
uguali, e la verifica **li ricontrolla** invece di crederci.
Le altre due funzioni sono `create or replace` con la stessa firma, che in
Postgres **conserva** i permessi: nessun `grant` scritto a memoria, e la
verifica lo controlla lo stesso.

---

## 4. Le misure delle schermate

A **375 punti** e a **tre densità** (37,8 del monitor · 59,5 del tablet da
8,3" · 64 del mini da 7,9"), col metro provato prima su due casi di risposta
nota (`tocco-bottone` = 8,50 mm, `testo-sala` = 3,20 mm):

| | monitor | 59,5 | 64 |
|---|---|---|---|
| sbordi della pagina | 0 | 0 | 0 |
| scorrimento laterale | no | no | no |
| bersagli sotto 8,50 mm | 0 | 0 | 0 |
| testi sotto 3,20 mm | 0 | 1 | 1 |

L'unico testo sotto soglia è il **«?»** della didascalia (2,81 mm a densità
64): è un componente condiviso, **preesistente**, presente in tutto il
gestionale — non introdotto qui.

🔴 **E il mio metro ha mentito due volte, ed è stato corretto tutte e due:**
* la prima versione simulava le altre densità **dividendo** una misura fatta a
  37,8, invece di cambiare davvero `--pxcm`: dava 238 testi piccoli e 49
  bersagli fuori norma, tutti falsi;
* contava le righe dentro un riquadro che scorre come **sbordi della pagina**,
  e misurava il quadratino di una casella invece dell'etichetta che si tocca
  (trappole del 25/08). Corretta: da 200 «sbordi» a **zero**.

*Un metro che sbaglia lo dice il primo confronto con un caso di risposta nota,
non il centesimo.*

---

## 5. Cosa abbiamo rovesciato

**Uno, di Alessio.** Registrato come **n. 71** in
[`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

1. **Cosa era stato deciso e quando.** Il **29/08**, costruendo questa
   schermata: toccare una preparazione la seleziona e apre sotto il modulo di
   registrazione, già pronto.
2. **La ragione di allora.** La schermata risponde a *«ho appena finito di
   cucinare»*: un gesto solo dalla scelta alla registrazione sembrava la
   strada più corta.
3. **Cosa si decide adesso.** I due gesti si separano: **il tocco mette fra le
   cose da fare**, il modulo si apre **solo** da «Registrala».
4. **Perché la ragione di allora non vale più.** Il gesto unico non era più
   corto: era **ambiguo** — lo stesso tocco diceva «questa mi interessa» e
   «sto per registrarla» — e la schermata restava lunga anche quando si stava
   solo guardando, che sul tablet in cucina si sente. ⚠️ Il prezzo (due gesti
   per registrare qualcosa di appena finito) si paga, ed è la domanda 1 qui
   sotto.

---

## 6. Cosa NON è verificato

* **Nessuna produzione vera è stata registrata dopo il cambiamento**: che
  `costo_stato` si scriva davvero è provato dentro la migrazione con un
  esempio costruito, non da un gesto di Alessio in cucina.
* **La riga «una parte della merce non aveva un prezzo» non è stata vista a
  schermo**: sul progetto di prova nessuna produzione è `parziale` (le 14
  vecchie sono tutte «non lo so»). La frase che si è vista è quella del terzo
  stato, che è l'altra.
* **Nessuna immagine è stata guardata**: lo screenshot non funziona in questo
  ambiente, tutte le misure vengono dal DOM.
* **Il conto (non la produzione) non è stato provato col lotto muto**: la
  colonna `quantita_senza_costo` è scritta anche da `scarica_magazzino_conto`,
  ma lì è provata solo dalla forma — nessun conto è stato chiuso su un
  prodotto senza prezzo.
* **Il costo parziale non è ancora mostrato da nessuna parte fuori dalle
  Produzioni**: gli sconti e gli omaggi leggono `costo_ingredienti_conto`, che
  non dichiara niente. Dichiarato, non chiuso.

---

```bash
git -C "C:\Users\User\Desktop\Claude code\Borgo58-App" push
```
