# L'avviso sul prodotto fermo

**23/08/2026 — Blocco 3** del mandato «l'unità in grammi, l'avviso sul
prodotto fermo, e due schermate». Disegno di Alessio.

| | |
|---|---|
| migrazioni | `20260823000013_il_prodotto_fermo.sql`, `20260823000014_il_reso_nei_tre_posti.sql` |
| applicate | ✅ progetto di prova — ❌ **non** in produzione |
| corridoio | **v21**, tre operazioni nuove |
| schermata | `/magazzino/fermi` — *Fermi da troppo* |
| prove nuove | `tests/app/prodotto-fermo.test.js` — 8, tutte verdi |

---

## L'idea: guarda i movimenti, non la data

Lo scadenziario del 13/08 guarda la **scadenza**. Questo guarda **da
quanto una partita non viene toccata**.

⚠️ **Sono due domande diverse e servono tutte e due**, e si è visto sui
dati veri: la partita di collaudo era ferma da **25 giorni** con durata 7,
e **scadeva fra due mesi** — lo scadenziario non l'avrebbe mai nominata.

---

## Le sei risposte, e ognuna manda il prodotto per una strada diversa

| risposta | cosa fa |
|---|---|
| **Consumato** | chiude il ciclo, esce e basta |
| **Buttato** | chiude il ciclo **e apre una non conformità** nel registro HACCP |
| **Reso al fornitore** | chiude il ciclo, **ma non è uno spreco** e nei conti va altrove |
| **Ancora qui, ricordamelo fra…** | 3 / 7 / 14 / 30 giorni |
| **Abbattuto** | l'orologio riparte, e **la scadenza la mette Alessio** |
| **Trasformato** | il prodotto non muore: vive nella preparazione che lo include |

---

## 🔴 La regola che non si sbaglia

> *«Rispondere trasformato NON scala quell'ingrediente dal magazzino,
> perché verrà scalato alla registrazione della preparazione che lo
> include, altrimenti rischiamo di scalare due volte.»* — Alessio

Quindi «trasformato» **registra una dichiarazione, non un movimento**: la
giacenza non si tocca, il lotto non si chiude. Cambiano solo due cose —
fino a quando quella parte non deve più far gridare l'avviso, e **in cosa
è finita**, che è l'anello di rintracciabilità che altrimenti si spezza.

✅ **Provato con le mani sul gestionale di prova**: dichiarato 1 kg di
ricotta finito in «Cannolo salato di ricotta», e poi letto il database —
**giacenza 2,5000, invariata; scarichi scritti: zero**; la trasformazione
registrata con la ricetta giusta.

⚠️ **E l'avviso è l'eccezione, non la regola**: quando la preparazione
viene registrata normalmente il gestionale scala da solo e l'avviso non
compare nemmeno. Questa risposta serve **solo** alla trasformazione fatta
e non scritta.

### Il «ricordamelo fra…» non è un di più

Condizione posta dal validatore, e regge da sola: se il prodotto è ancora
buono, senza quella risposta **l'unica via d'uscita è mentire** — dire
«consumato» o «buttato» per far tacere l'avviso. *Un avviso a cui devi
mentire smette di funzionare in una settimana.*

⚠️ **E il rinvio ha una fine**: scaduto, la partita torna in elenco da
sola. Un rinvio senza scadenza sarebbe una cancellazione travestita.

### L'abbattimento pretende la data

Senza, si spegnerebbe l'avviso invece di rimandarlo. La schermata lo dice
**dentro il gesto**: *«la durata dopo l'abbattimento la decidi tu: quando
arriverà la tabella della biologa, il gestionale la proporrà da sé»*.

---

## 🔴 Tre difetti trovati dalle reti, non da una rilettura

Il vocabolario si è allargato di un valore (`reso_fornitore`), e **tre
reti sono diventate rosse da sole**:

1. **Il vocabolario vive in TRE posti** (regola del 17/08) e ne avevo
   aggiornati **due**: `record_stock_consumption` — lo scarico a mano —
   continuava a rifiutarlo. ⚠️ **E il difetto sarebbe stato silenzioso dal
   lato giusto**: il reso fatto dall'avviso funziona, quello fatto dallo
   scarico a mano no. *Due porte per la stessa cosa, una aperta e una
   chiusa, e nessuno se ne accorge finché non prova la seconda.*
2. **`sprechi_e_resi()` era `security definer` senza portiere**, e somma
   un **costo**. La rete del 19/08 l'ha nominata.
3. **`CONSUMPTION_REASONS` in `constants.js`** non offriva il valore nuovo
   — *«un valore legittimo che nessuno può scegliere, e in silenzio»*.

Chiuse in `20260823000014`.

---

## Come sono state giudicate le prove: rompendo

| cosa è stato rotto | cosa è diventato rosso |
|---|---|
| il trasformato scala il magazzino | ✅ *«Dichiarare una trasformazione ha scalato il magazzino: si scalerebbe due volte»* |
| il reso viene contato come spreco | ✅ *«Il reso è stato contato fra gli sprechi»* |
| il rinvio non esiste | ✅ *«Una partita rimandata compare ancora fra quelle ferme»* |
| il rinvio non scade mai | ✅ *«Un rinvio scaduto non fa tornare la partita in elenco: sarebbe una cancellazione travestita»* |
| la parte trasformata continua a gridare | ✅ *«Una partita trasformata per intero compare ancora fra quelle ferme»* |

---

## ✅ La schermata, guardata e misurata

Aperta con l'accesso di collaudo, con una partita ferma vera costruita
apposta. Le sei risposte ci sono tutte, il pannello si apre sulla riga
toccata (come la pianta della sala dal 18/08), e il gesto del trasformato
è stato fatto con le mani.

### 🔴 Un difetto trovato guardando, che nessuna prova vede

La riga mostrava per primo **«1,5 kg»** — la parte ancora da decidere — e
in cella ce n'erano **2,5**, perché il trasformato non scala. *Un numero
che sembra la giacenza senza esserlo è la stessa forma dello scarto a
zero.* Corretto con i **tre numeri**, come la nota di credito del 17/08:

> 2,5 kg in cella · 1 già trasformati · 1,5 da decidere

### Le misure, col valore del tablet

⚠️ **Il primo giro di misure era sbagliato**, e va detto perché tornerà:
avevo cambiato `--pxcm` a mano scrivendo `64` **senza l'unità**, e i
`calc()` fallivano in silenzio — le altezze restavano quelle del browser e
io le dividevo per 64, ottenendo millimetri inventati. La misura buona si
fa **dal localStorage, ricaricando**, com'è sul tablet vero.

Con `--pxcm = 64` (mini tablet 7,9") e viewport 768:

| | |
|---|---|
| elementi misurati | **17** |
| sotto il bersaglio di 8,50 mm | **0** |
| testo sotto 3,20 mm | **0** |
| coppie di gesti a meno di 5 mm | **0** |
| la pagina sborda in orizzontale | **no** |

🔴 **Uno era sotto soglia e l'ha trovato la misura**: il rimando alle
scadenze era una parola sottolineata dentro la frase — **3,91 mm**.
Diventato un bersaglio vero.

---

## ⚠️ Cosa abbiamo rovesciato

**Niente.** Lo scadenziario del 13/08 resta intero e non è stato toccato:
questo risponde a un'altra domanda e ci sta accanto, non al posto suo.

⚠️ Una cosa si allarga e va detta: `chiudi_partita` accettava due modi di
chiudere e ora ne accetta **tre**. È stata **estesa**, non affiancata da
una funzione nuova: la chiusura di una partita deve restare un posto solo,
o fra sei mesi ci saranno due modi di chiudere che si comportano
diversamente.

---

## ⚠️ Cosa questo blocco NON verifica

1. 🔴 **Oggi è quasi muto, ed è misurato**: prodotti con una durata
   dichiarata **0 su 127**. Il mandato lo prevedeva («va bene —
   costruiscilo lo stesso, le durate arriveranno dall'assistente»).
2. 🔴 **E il numero è cambiato sotto**: il referto di stamattina ne
   contava **4**. Lo scenario è stato rigenerato alle 10:02 e i campi
   compilati dall'assistente sono vuoti su tutti e 127. *Una fotografia di
   stamattina descrive un database che stasera non c'è più* — la causa
   esatta non è stata determinata, e non cambia il lavoro.
3. **Nessuna mano diversa dalla mia** ha usato la schermata, e le
   risposte provate con le mani sono **una su sei** (il trasformato, che
   è quella che non si può sbagliare). Le altre cinque sono provate dal
   client e dentro le migrazioni.
4. **Il collegamento con le Produzioni non esiste ancora**: quando la
   preparazione viene registrata, la dichiarazione di trasformazione
   **resta lì**. È corretto — è una dichiarazione, non un movimento — ma
   nessuno la chiude, e con l'uso quell'elenco crescerà. Da guardare
   quando ci saranno produzioni vere.
5. **Non è in produzione**: `npm run migra` si rifiuta finché le
   migrazioni non sono su GitHub. E il corridoio **v21 è installato solo
   sul progetto di prova**.

---

## 🔴 Il gancio pre-commit ha bloccato la consegna, e aveva ragione

Al primo tentativo di commit `tests/unita/letture.test.js` è diventata
rossa nominando la riga: la lettura delle preparazioni era scritta
`.catch(() => [])`, cioè **trasformava «non sono riuscito a leggerle» in
«non ce ne sono»** — il difetto del 20/08, riaperto in una schermata
nuova.

⚠️ **E qui mordeva bene**: il menu «in cosa è finito» sarebbe comparso
vuoto, e un menu vuoto si legge «non ci sono preparazioni». Ora la
lettura passa da `leggi()` e la schermata **dichiara** di non averle
lette, lasciando in piedi la strada di scriverlo a mano — che basta da
sola.

*La regola esisteva, lo strumento pure, e a farla rispettare non è stata
la mia attenzione: è stata una prova di forma che non si può aggirare.*
