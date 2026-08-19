# Una lettura tagliata si denuncia — e l'elenco di collaudo diventa un comando

**Migrazione**: `20260819000011_i_conti_di_prova_si_annullano.sql`
— applicata sul progetto di prova, **NON ancora in produzione** (aspetta il
push).
**Tre cose autorizzate da Alessio**: sistemare il taglio a mille righe (prima
il segnale, poi i due punti che fanno male), costruire il comando che rilegge
i dati di collaudo, e annullare i due conti rimasti aperti.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha visto l'avviso a schermo.** In questo progetto le
   prove non hanno un ambiente DOM: è provato che il gestionale **si accorga**
   della lettura tagliata, non che la striscia si veda.
2. 🔴 **La migrazione dei conti non è in produzione**: i due conti aperti di
   T1 e T6 ci sono ancora finché Alessio non pusha.
3. ⚠️ **Il segnale non copre le Edge Function** (`posta-leggi`,
   `assistente-archivio`, `documento-leggi`, `operazioni-atomiche`): leggono
   con una loro chiave e non passano dal punto unico.
4. ⚠️ **Non copre le letture annidate** (`select("*, righe(*)")`), che
   possono essere tagliate **nelle righe figlie** senza che il numero di
   righe padre lo mostri. È la forma più silenziosa, e resta aperta.
5. ⚠️ **Il rifiuto dell'export e l'avviso sul manuale HACCP non sono stati
   visti scattare con dati veri**: in produzione non c'è nessun movimento di
   cassa e nessun registro HACCP con più di mille righe.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento**, ma **una cosa scritta l'08/08 si scopre incompleta
invece che sbagliata.** In cima a `cash.js` c'è dal 08/08 un'avvertenza:
*«niente `.limit()` qui: alimenta anche l'export CSV della prima nota,
quindi un limite produrrebbe un export fiscale incompleto ma dall'aspetto
normale»*. Era giusta, e guardava dalla parte sbagliata: **il limite non lo
mettevamo noi**, lo mette il gateway a mille righe. La regola resta; cambia
chi la può violare.

---

## 1 · Il segnale, in un punto solo

🔴 **Il fatto**: chiedendo un elenco senza dire quante righe si vogliono ne
tornano al massimo mille, **senza nessun errore** — misurato: 1000 consegnate
su 1930. Chiedere esplicitamente più righe non serve, il tetto vince. Non è
nel nostro codice: è l'impostazione «Max rows» del progetto Supabase.

**Dove sta il riconoscimento**: dentro `src/lib/supabase.js`, nell'unico
punto da cui passano tutte le letture dell'app. ⚠️ **Qui e non in ogni
schermata**, perché la correzione punto per punto sarebbe «trovarli tutti», e
il prossimo che scrive una lettura nuova ricomincia da capo.

**Come si sa che era tagliata**: chiedendo `Prefer: count=exact`, il database
aggiunge alla risposta **quante righe c'erano davvero**
(`Content-Range: 0-999/1930`). Se ne sono arrivate meno di quelle dichiarate,
la lettura era tagliata. ⚠️ È l'unico modo: il numero di righe ricevute, da
solo, non distingue «erano tutte» da «erano mille».

**Chi lo dice a chi guarda**: `<AvvisoLettureTagliate>` nel telaio comune —
una striscia sopra ogni schermata che nomina la tabella, le righe ricevute e
quelle esistenti. ⚠️ **Non un avviso nel registro tecnico**, che non
leggerebbe nessuno; e **non sparisce da solo**: si toglie premendo, dopo aver
ristretto la ricerca. *Un avviso che se ne va allo scadere di un tempo lascia
sullo schermo dei numeri che nessuno sa più essere parziali.*

⚠️ **Il costo, dichiarato**: il database conta le righe a ogni lettura di
elenco. Su queste dimensioni non si misura.

🔴 **E la prova ha trovato subito un allarme falso, che è il difetto peggiore
per un guardiano.** La prima stesura escludeva le letture limitate guardando
l'intestazione `Range` — ma `.limit()` viaggia come **parametro
nell'indirizzo**, non come intestazione. Risultato: **ogni lettura limitata
apposta veniva denunciata come tagliata**. Trovato dalla prova, non
rileggendo.

---

## 2 · La prima nota

Con i campi «dal» e «al» **vuoti** la schermata chiedeva *tutti* i movimenti,
e sullo stesso elenco calcolava entrate, uscite **e il file CSV**. Due cose:

- **il periodo parte dal mese in corso** invece che vuoto;
- 🔴 **l'export si RIFIUTA** se la lettura è tornata tagliata, dicendo perché
  e cosa fare.

⚠️ **Il valore di partenza da solo non basterebbe** — chi svuota i campi
torna nel caso di prima — ed è il motivo per cui la difesa vera è il rifiuto.
*O completo per costruzione, o dichiarato parziale: su un file che si porta
al commercialista non c'è una terza strada.* Un export che si scarica lo
stesso, con un avviso da qualche parte, è un export incompleto che qualcuno
aprirà fra sei mesi senza ricordarsi dell'avviso.

---

## 3 · Il manuale HACCP

Di partenza guarda gli ultimi 30 giorni ed è al sicuro; con l'interruttore
**«tutto»** ogni registro viene chiesto per intero. Adesso, se anche un solo
registro torna a metà, **il documento lo dichiara in testa** — e ⚠️ **lo
dichiara stampato**, senza `print:hidden`: il destinatario di quel foglio non
è chi sta davanti allo schermo, è chi viene a controllare. Nasconderlo alla
stampa lascerebbe il difetto esattamente dov'era.

*Un documento che dichiara «registro completo» e ne mostra mille è una
dichiarazione falsa, non un'imprecisione.*

---

## 4 · La prova che può fallire

`tests/app/lettura-tagliata.test.js` **si costruisce milleduecento righe**,
legge, e pretende che il gestionale se ne accorga. ⚠️ **Provarlo sotto le
mille non proverebbe niente**: qualunque codice, anche uno che non guarda
affatto, passerebbe.

⚠️ **E la prova entra dal collegamento dell'APP, non da uno suo**: è la
lezione del 18/08 — il riconoscimento vive dentro quel collegamento, e una
prova con un client proprio non lo eserciterebbe, passando verde su un
difetto intatto.

| rottura | cosa è diventato rosso |
|---|---|
| tolto il confronto fra righe ricevute e righe dichiarate | *«nessuna lettura denunciata»* |
| (trovato dalla prova) l'esclusione delle letture limitate guardava solo l'intestazione | *«ha gridato su una lettura limitata apposta»* |

E le due metà che impediscono a un codice sbagliato di passare: **non si
lamenta** su una lettura con `.limit()`, e **non si lamenta** su un elenco che
ci sta tutto. Senza di loro, un codice che gridasse sempre passerebbe.

---

## 5 · L'elenco dei dati di collaudo diventa un comando

**`npm run collaudo:stato`** legge la produzione e stampa cosa c'è, diviso in
quattro: i **gesti di collaudo**, i **documenti entrati dalla posta**, i loro
**effetti** (ingredienti, diciture, lotti, storico prezzi) e **quello che non
è di prova e non va toccato**. Poi l'**ordine in cui si toglie** e le **due
cose che non tornano come prima**.

⚠️ **Il paragrafo scritto a mano è stato TOLTO, non aggiornato**: era una
fotografia, e aveva sbagliato **tre volte in sei giorni**. *Un elenco che si
rilegge non può invecchiare; uno scritto a mano invecchia sempre* — e questo
è l'unico foglio che dirà cosa buttare via la sera prima dell'apertura, cioè
la sera in cui non ci si può permettere che sia sbagliato.

⚠️ **La distinzione fra i dati e i loro EFFETTI** è quella su cui l'elenco
vecchio faceva cercare una cosa che non c'era: «le sei fatture di collaudo»
sono **documenti**, e le fatture registrate sono **zero**.

⚠️ **Il limite del comando, dichiarato**: l'elenco delle *cose da guardare* è
scritto nel file; i *numeri* mai. Una tabella nuova che si riempisse di dati
di collaudo non comparirebbe finché nessuno la aggiunge.

⚠️ **Trappola pagata scrivendolo**: una domanda al database con un carattere
fuori dall'alfabeto inglese si rompe con *«invalid byte sequence»* quando
passa dalla riga di comando (18/08). Il testo italiano fuori dalla SQL sta
benissimo; dentro, no.

---

## 6 · I due conti rimasti aperti

Migrazione `20260819000011`. 🔴 **ANNULLATI, non chiusi**, ed è la cosa da non
sbagliare: **chiudere un conto scrive un incasso**, e in produzione ci sono
**zero movimenti di cassa** — la proprietà che ha reso questi lavori a costo
zero e che serve ancora per il collaudo generale. Un conto annullato, per
tutto il resto del gestionale, è un conto che non è mai esistito.

⚠️ **Il perimetro è una proprietà, non due identificativi**: «i conti rimasti
aperti da prima di oggi». Scrivere i due `id` sarebbe un fossile, e su un
altro database non farebbe niente senza dirlo.

⚠️ **E si ferma se trova qualcosa che non è un residuo**: un conto aperto
vecchio ma con dei pagamenti sopra o uno sconto collegato non è roba di
collaudo, e lì la migrazione rifiuta invece di decidere.

**Le prove, e la rottura**: applicata la prima volta sul progetto di prova ha
detto *«conti rimasti aperti: 0»* — cioè **non ha provato niente** (la
trappola del caso vuoto, 17/08). Costruito allora un conto aperto datato
ieri: **annullato**, con la ragione e la data di chiusura scritte. Aggiunto un
pagamento sopra: **rifiutata**, *«non sono residui di collaudo, e non li
tocco»*.

I controlli dentro la migrazione guardano le proprietà che contano: dopo,
**zero** residui aperti, e **nessun euro entrato** — movimenti di cassa,
scarichi di magazzino e tracce di cancellazione identici a prima.

---

## Per Alessio, in una riga

Da adesso, se il gestionale riceve solo una parte delle righe, te lo dice
sopra la schermata e si rifiuta di esportarti un file incompleto; l'elenco
dei dati di prova non è più un foglio da aggiornare a mano ma un comando che
lo rilegge; e i due conti rimasti aperti si annullano senza scrivere nessun
incasso.

---

**Commit del lavoro**, in quest'ordine: `a3cb30b` (il segnale e i due punti),
`af28a87` (il comando dei dati di collaudo), `d4bab12` (i conti annullati).
**Working tree**: pulito.
**Migrazione**: `20260819000011` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
