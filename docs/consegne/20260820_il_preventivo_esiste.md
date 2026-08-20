# Il preventivo esiste — blocco 1 dei preventivi

**Migrazione**: `20260820000006_il_preventivo_esiste.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Corridoio**: **v16 sulla prova** (in produzione resta la v31), due operazioni
nuove: `salva_preventivo`, `nuova_versione_preventivo`.
**Mandato**: [`20260820_i_preventivi_per_gli_eventi.md`](../mandati/20260820_i_preventivi_per_gli_eventi.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna schermata**, ed è voluto: il mandato dice *«prima la cosa deve
   esistere e tornare nei numeri»*. La schermata che commuta è il blocco 2.
2. 🔴 **Nessuna mano ha scritto un preventivo**: tutto passa dalle prove.
3. ⚠️ **In produzione non ci sono ricette né menu**, quindi il costo non ha
   mai incontrato dati veri.
4. ⚠️ **Il ricarico predefinito è vuoto** in produzione, quindi oggi il
   gestionale **non proporrebbe nessun prezzo** — e lo dichiara. Vedi sotto:
   è una scelta, e uno scarto dalla lettera del mandato.
5. ⚠️ **I vini sono trattati come extra**, con un prezzo scritto a mano: non
   esiste ancora una fonte dati per le bottiglie (è il blocco 3 del mandato
   cumulativo, «cantina e bevande»).

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 Due numeri diversi, tenuti separati fin dall'inizio

È la decisione portante del blocco:

- il **prezzo promesso al cliente** è una promessa e **non cambia più**;
- il **costo del momento in cui il preventivo è stato fatto** invecchia,
  perché i prezzi si muovono.

⚠️ **Mescolandoli, fra due mesi nessuno saprebbe se «costava 14» era il costo
di allora o di adesso** — ed è esattamente la domanda a cui lo storico dei
costi, finito ieri, serve a rispondere.

Quindi `preventivi.costo_cibo` è **fotografato** con la sua data
(`costo_rilevato_il`) e non si ricalcola mai. E il **ricarico** si fotografa
insieme: cambiarlo domani non deve riscrivere il prezzo di una promessa già
fatta.

⚠️ **La fotografia è automatica, non un gesto a parte**: la scrive
`salva_preventivo` alla fine. Un pulsante «fotografa il costo» sarebbe un
pulsante che si può dimenticare, e un preventivo senza costo fotografato non
sa più rispondere.

---

## 🔴 Il costo viene dalla stessa funzione dello scarico

Nessuna ricorsione nuova: `fabbisogno_preventivo` chiama
`fabbisogno_preparazione`, la stessa che il magazzino usa per scaricare
davvero — quindi resa, scarto, righe opzionali e semilavorati in cella si
comportano **identicamente**.

⚠️ **Se il numero mostrato al cliente e quello del magazzino nascessero in due
posti, prima o poi divergerebbero — e la differenza la vedrebbe un ospite.**

⚠️ **Le dosi, non le persone, e con le porzioni DELL'EVENTO**: un piatto da 4
porzioni servito a 10 persone a mezza porzione sono **1,25 dosi**.

---

## Le porzioni modificate vivono sul preventivo

`porzioni_per_persona` = 1 vuol dire «come in carta», 0,5 «metà porzione». **La
ricetta in carta resta intatta**, e c'è una prova che lo verifica: *è quella
che distingue «vale per l'evento» da «ho modificato la ricetta»*.

---

## Il prezzo, e la trappola scritta dove si legge

Il ricarico si applica al **solo cibo**; gli extra si sommano dopo, **senza
ricarico**.

⚠️ **L'avvertenza esce insieme al numero** (`prezzo_preventivo` restituisce il
prezzo *e* la frase), come per `calcola_imposte()`: un avviso che vive nel
testo di una schermata non protegge la seconda schermata che mostra lo stesso
numero. È la trappola naturale del modulo — *un preventivo può risultare in
linea sul cibo e in perdita sulla serata*.

**Il prezzo scritto a mano vince sempre**, e resta anche cambiando il ricarico
dopo.

### ⚠️ Il ricarico predefinito nasce VUOTO — uno scarto dal mandato, dichiarato

Alessio ha chiesto *«un valore predefinito, modificabile»*. **Il numero però
non l'ha detto**, e un ricarico inventato da me **decide un prezzo**: sposta la
proposta sempre nella stessa direzione, esattamente come i parametri del POS
del 15/08, che per questa ragione nascono vuoti.

Finché non lo scrive lui, il gestionale **non propone e lo dichiara**
(*«Nessun ricarico impostato…»*) invece di proporre un numero mio. **È l'unico
punto in cui non ho seguito la lettera del mandato**, ed è qui perché la
scelta è sua, non mia.

---

## Le due nature di una riga non si mescolano

Una riga è **cibo** (una ricetta, entra nel costo calcolato, nessun prezzo suo)
oppure **extra** (descrizione e prezzo scritti da Alessio, nessun ricarico).
È un vincolo del database: senza, si potrebbe scrivere una riga che è tutte e
due, e **nessuno saprebbe come contarla**.

---

## Le prove, e le cinque rotture

**Dieci controlli dentro la migrazione** e **8 prove col token di un utente
vero** — 152 pure + **253** sull'app in tutto.

🔴 **I numeri sono scelti perché distinguano**: 10 persone, piatto da 4
porzioni a mezza porzione, extra da 120 €.

| | a persona |
|---|---|
| ✅ giusto: (10 × 3) + 120 = 150 | **15,00** |
| ✗ ricarico anche sugli extra | 39,00 |
| ✗ porzioni ignorate | il costo raddoppia a 20,00 |
| ✗ costo da un secondo posto | 0,00 |

| rottura | cosa è diventato rosso |
|---|---|
| **il costo calcolato da un SECONDO posto** | *«Il costo fotografato è 0,0000 invece di 10,00»* |
| le porzioni dell'evento ignorate | *«Il costo fotografato è 20,0000 invece di 10,00»* |
| il ricarico applicato anche agli extra | *«Il prezzo proposto è 39,00 invece di 15,00»* |
| **il collegamento fra versione nuova e vecchia tolto** | *«Il preventivo vecchio è stato cancellato: la versione nuova è rimasta senza storia»* |
| il costo non si fotografa più | *«Il costo è stato scritto senza dire quando»* |

⚠️ **La prima rottura non aveva morso**: l'avevo lanciata con un comando che
ha prodotto un **errore di sintassi** invece del difetto — il file non
compilava nemmeno, quindi non stavo misurando niente. Rifatta con uno
strumento che scrive il file come si deve, è diventata rossa **col numero
sbagliato giusto**. *È la seconda volta in due giorni che una controprova non
morde: il modo di scoprirlo è guardare COSA dice il rosso, non che sia rosso.*

---

## 🔴 E la rete dei permessi è diventata rossa da sola

Dopo il blocco, la prova che conta le funzioni che scavalcano la RLS senza
chiedere chi sei è passata da **16 a 17**. La nuova era
`costo_cibo_preventivo`: `security definer`, concessa allo staff, e col
portiere **nella funzione che chiama**, non nel proprio corpo.

⚠️ **Nessun dato usciva** — la funzione delegata rifiuta — ma *un portiere
delegato è un portiere che sparisce il giorno che l'altra funzione cambia*.
La porta è stata **chiusa** invece di raddoppiare il controllo: a nessun
client serve il costo nudo, la schermata chiede il prezzo. Il conto è tornato
a **16**, e la migrazione ora **controlla** che quella funzione non sia
eseguibile.

✅ *Questa rete è stata scritta il 13/08 esattamente per questo, e ha fatto il
suo mestiere senza che nessuno si ricordasse di guardare.*

---

## Per Alessio, in una riga

Adesso un preventivo si può scrivere: chi, quando, per quante persone, cosa
mangiano e con che porzioni, più gli extra — e il gestionale ti dice quanto ti
costa **oggi** e quanto chiedere a persona, tenendo separato il prezzo che
prometti dal costo di quando l'hai promesso.

---

**Commit del lavoro**: `8583b04` — «Il preventivo esiste — blocco 1 dei
preventivi».
**Working tree**: pulito.
**Migrazione**: `20260820000006` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
**Corridoio**: da installare in produzione dopo il push.
