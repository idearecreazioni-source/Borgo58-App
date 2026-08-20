# Il fabbisogno di un evento — blocco 0 dei preventivi, la riparazione

**Migrazione**: `20260820000005_il_fabbisogno_di_un_evento.sql`
— **applicata in produzione il 20/08**, 1 su 1 dopo il push.
✅ **Numeri veri dopo**: **155 migrazioni**, 0 ricette, 0 voci di storia, 26
tracce, 0 movimenti, 8 conti di cui 0 aperti, 0 menu — **tutto invariato**. Reti
di sorveglianza ferme: 16 senza portiere, 10 aperte ad anon, 0 date a
Greenwich, 0 lapidi di prova, 0 predefiniti di data, 0 policy pubbliche.
**Mandato**: [`20260820_i_preventivi_per_gli_eventi.md`](../mandati/20260820_i_preventivi_per_gli_eventi.md).
Nessuna operazione nuova nel corridoio.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha aperto una prenotazione evento** dopo la riparazione:
   nessuna prova di questo progetto guarda una schermata.
2. ⚠️ **In produzione non esiste nessun menu e nessuna ricetta**, quindi il
   calcolo non ha mai incontrato dati veri — né prima né dopo.
3. ⚠️ **L'interruttore dei semilavorati in cella guarda la giacenza di OGGI**,
   e un preventivo parla di fra due mesi. È dichiarato sotto: è la stessa
   regola dello scarico vero, e si tiene.
4. ⚠️ **`listRecipeIngredientsForRecipes` è rimasta senza chiamanti**: non è
   stata cancellata, ed è **dichiarato nel file** invece di lasciarlo
   scoprire.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 La prova è stata scritta PRIMA, e l'ho vista diventare rossa

Era la condizione posta: *«altrimenti non sai se stai riparando quello che
credi»*. Scritta contro la funzione vecchia, ha dato:

> **TypeError: Cannot read properties of null (reading 'current_price')**
> — 3 prove su 3 rosse.

⚠️ **Non un numero sbagliato: una rottura.** La funzione sommava nel browser i
soli ingredienti **diretti** delle ricette del menu; una riga che contiene una
preparazione o un bocconcino non ha nessun ingrediente, e la funzione ne
leggeva il prezzo.

⚠️ **E si sarebbe rotta su quasi ogni menu vero**, perché Alessio *«scompone
sempre»* — è scritto nel mandato delle Produzioni. Era quindi un difetto
**vivo**, non una possibilità teorica: chiunque avesse aperto oggi una
prenotazione evento con un menu normale avrebbe visto la schermata rompersi.

Più due difetti minori nello stesso posto: **ignorava lo scarto** (200 g
puliti si comprano 235) e **la resa** dei componenti.

---

## 🔴 Dove vive il calcolo, ed è la parte che conta

Il fabbisogno di un evento e il food cost di una ricetta **non possono essere
calcolati in due posti**: prima o poi direbbero cose diverse e nessuno saprebbe
quale credere.

⚠️ **E la riparazione non scrive una terza ricorsione.** Riusa
`fabbisogno_preparazione`, che esiste dal 14/08 e sa già fare tutto — scende di
livello in livello, divide per la **resa** del componente, applica lo
**scarto** a ogni foglia, esclude le righe opzionali, e onora l'interruttore
delle preparazioni che stanno in cella.

`fabbisogno_menu_evento` aggiunge **solo** la moltiplicazione giusta: quante
**dosi** di quel piatto servono per quelle persone.

⚠️ **Le dosi, non le persone**: un piatto da 4 porzioni servito a 8 persone
sono **2 dosi**. Passare le persone direttamente avrebbe moltiplicato per
quattro tutto il menu — ed è una delle risposte sbagliate che i numeri della
prova distinguono.

✅ **Conseguenza che vale più della riparazione stessa**: da oggi il fabbisogno
di un evento e lo scarico vero del magazzino **si comportano identicamente**,
perché sono la stessa funzione.

---

## I numeri, scelti perché distinguano

8 persone su un piatto da 4 porzioni, cioè 2 dosi. La catena è a **quattro
livelli**: ingrediente → preparazione → preparazione → bocconcino → piatto.

| | kg |
|---|---|
| dal bocconcino: 2 × 6 pz × 1 kg | 12,000 |
| dall'ingrediente diretto: 2 × 0,5 kg **+ 20% di scarto** | 1,200 |
| ✅ **totale giusto** | **13,200** → 26,40 € |
| ✗ catena persa al primo livello | 1,200 |
| ✗ scarto ignorato | 13,000 |
| ✗ porzioni ignorate | 52,800 |

⚠️ **Sono tutte diverse**, ed è il punto: con numeri comodi — due piatti, due
persone — le risposte sbagliate avrebbero coinciso con quella giusta e la
prova non avrebbe misurato niente. È la lezione del 19/08.

⚠️ **E c'è la prova che guarda solo lo scarto**: lo stesso menu con scarto 20 e
con scarto 0 deve dare **numeri diversi**. Senza quel confronto, un calcolo che
ignora lo scarto passerebbe.

---

## Le prove, e la rottura

**Cinque controlli dentro la migrazione** (la catena a quattro livelli, nessuna
riga senza ingrediente, lo scarto che cambia il risultato, le porzioni, e zero
persone che viene **rifiutato** invece di rispondere zero) e **3 prove col
token di un utente vero** — 152 pure + **245** sull'app in tutto.

| rottura | cosa è diventato rosso |
|---|---|
| lo scarto tolto dalla ricorsione riusata | **2 prove su 3**, fra cui *«lo scarto non cambia niente: il calcolo non lo guarda»* |
| *(prima della riparazione)* la funzione vecchia | **3 su 3**, con l'errore vero |

⚠️ **La rottura dello scarto è stata fatta sul database di prova, non sul
file**, e poi la funzione è stata **rimessa riapplicando la migrazione che la
crea**. ⚠️ Quella migrazione si è fermata sulla propria verifica — dichiara
che l'elenco di chi può bussare da fuori sia 12, e oggi è **10**, perché nel
frattempo delle porte sono state chiuse. *Non è un danno: è un'affermazione
vecchia dentro una migrazione vecchia*, ed è lo stesso caso già dichiarato il
15/08. La funzione era già stata rimessa prima di quel controllo, e le 245
prove lo confermano.

---

## Per Alessio, in una riga

La stima degli ingredienti di un evento si rompeva su qualunque piatto che
contenesse una preparazione — cioè quasi tutti i tuoi: adesso la fa il
gestionale con lo stesso conto che usa per scaricare il magazzino, scarto
compreso.

---

**Commit del lavoro**: `91abf69` — «Il fabbisogno di un evento — blocco 0
dei preventivi, la riparazione».
**Working tree**: pulito.
**Migrazione**: `20260820000005` — **in produzione**, 155 in tutto.
