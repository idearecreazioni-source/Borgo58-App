# Un revisore automatico sulle proposte — proposta, NON attivata

*Scritta il 02/09/2026, su richiesta di Alessio. **Niente è stato
installato, attivato o configurato.** Prima di toccare qualcosa serve un suo
via esplicito.*

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione in vigore viene ribaltata: oggi un revisore
automatico non esiste, e questa è una cosa nuova che si aggiunge o non si
aggiunge.

---

## 1 · L'obiettivo, e da dove nasce

Il 31/08 Alessio ha chiesto che io controllassi *«che le PR non abbiano
commenti di bug emersi dai check di IA esterna»*. Misurato il 02/09 sulle
ultime proposte: **quel revisore non esiste**. L'unico robot che ha mai
scritto un commento è quello di Cloudflare (sulla #9), e annuncia una
pubblicazione — non segnala difetti.

Quindi la richiesta oggi non ha nulla da controllare. **L'obiettivo è dargli
qualcosa da controllare**: un secondo paio d'occhi sulle proposte, che non
sia né Alessio né io.

⚠️ **Il valore vero, e va detto per non aspettarsi la cosa sbagliata**: non è
trovare i difetti che le prove già trovano — quelle girano e sono 1.276
(817 pure, 459 sul database). È vedere **quello che le prove non guardano**:
una regola scritta più larga del vero, un rifiuto che non dice cosa fare, un
numero scritto a mano che invecchierà, un controllo che approva senza aver
guardato. In questa sola giornata ne sono passati **quattro** di quel tipo,
e li ho trovati io rompendo le cose apposta — non le prove.

---

## 2 · Cosa controllerebbe

Su ogni proposta, prima del merge:

| | |
|---|---|
| **il diff** | le righe cambiate, con un po' di contorno |
| **le regole di questo progetto** | `CLAUDE.md` e `docs/CONTRATTO.md`, se glieli si dà da leggere |
| **quello che le prove non vedono** | messaggi di rifiuto, commenti diventati falsi, numeri scritti a mano, guardiani che non discriminano |

**Cosa NON controllerebbe, e va detto perché non si scambi per una rete
intera:**

* **non guarda una schermata.** Un testo troppo piccolo, un riquadro che
  sborda, un colore illeggibile con le luci basse: quelli li ha trovati
  Alessio col tablet in mano, e continueranno a trovarsi così.
* **non tocca il database vero**, e non sa cosa c'è dentro.
* **non impedisce niente**: scrive un commento, non blocca il merge. Il
  merge resta di Alessio.

---

## 3 · 🔴 I falsi positivi — la parte che decide se serve o dà fastidio

Questo progetto ha **molte scelte volute che somigliano a difetti**, e un
revisore che non le conosce le segnalerebbe tutte. Gli esempi non sono
teorici: sono presi dal codice di oggi.

| cosa segnalerebbe | perché è invece una scelta |
|---|---|
| «manca un `.limit()` su queste letture» | 🔴 **è vietato apposta**: `ManualeCompleto.jsx` e l'export della prima nota alimentano documenti esibibili. Un limite produrrebbe fogli che *sembrano* completi. C'è un'avvertenza scritta in cima a due file |
| «questa funzione scavalca la RLS senza controllare chi chiama» | **tredici** sono così **per necessità**, con l'elenco congelato in `tests/app/permessi.test.js`. Un portiere le romperebbe (regola del 27/08) |
| «questi due posti dicono la stessa cosa: unificali» | a volte sì (è un riflesso da togliere), a volte **no** — dicono cose diverse in parte, e servono entrambi. La distinzione è nel §6 di `CLAUDE.md` |
| «questa espressione per gli indirizzi email è più stretta della norma» | **voluto**, e scritto: rifiuta indirizzi legali che nessuno usa, per non far passare un valore che romperebbe il marcatore |
| «commenti troppo lunghi» | in questo progetto il commento porta **la misura e la data**, ed è quello che impedisce di rifare un errore già fatto |
| «questa migrazione ha un difetto» | 🔴 **una migrazione applicata non si riscrive MAI** (regola del 23/08). Un suggerimento di correggerla è un invito a rompere la storia |

⚠️ **La conseguenza pratica**: senza istruzioni, il primo giro produrrebbe
**decine di commenti sbagliati**. E in questo progetto c'è già la regola su
cosa succede allora: *un guardiano che grida sempre si impara a spegnere.*

**La cura, e non è facoltativa**: gli si danno da leggere `CLAUDE.md` e
`docs/CONTRATTO.md`, e gli si dice che quelle sono **decisioni prese**, non
suggerimenti. Il che costa: sono file lunghi, e vanno letti a ogni giro.

---

## 4 · Le tre strade, coi numeri veri

**Fatto che cambia tutto, misurato: il repository è PUBBLICO.** Questo apre
gratis strade che su un repository privato si pagano.

| | chi è | costo | dove gira |
|---|---|---|---|
| **A · CodeRabbit** | servizio esterno | **gratis per i repository pubblici**, per sempre | sui loro computer |
| **B · Claude** | l'azione ufficiale di Anthropic | **a consumo, dal credito che già usiamo** | dentro i nostri lavori su GitHub |
| **C · Copilot** | GitHub | richiede un abbonamento (~10 $/mese) | su GitHub |

### 🔴 Il problema della B, ed è il più serio di tutta la proposta

**Il credito è UNO SOLO, e lo usa già il locale.** L'account AI ha un tetto
di **10 $ al mese** con la ricarica automatica spenta — deciso apposta l'11/08
perché *«quando il credito finisce il sistema si ferma invece di continuare a
spendere»*.

Da quel credito mangiano già: la lettura della posta (ogni 15 minuti), la
lettura delle etichette dalle foto, l'assistente dell'archivio, le schede
dei prodotti.

⚠️ **Quindi un revisore chiacchierone non costa solo soldi: spegne il
gestionale.** Finito il credito, la posta smette di essere letta e le foto
delle etichette smettono di funzionare — **in silenzio**, perché nessuno
guarda il credito ogni giorno. È esattamente la forma di guasto che questo
progetto insegue: qualcosa che smette di funzionare senza dirlo.

**Quanto costerebbe, onestamente**: non lo so, e non lo invento. Misurato:
le proposte tipiche di questi giorni sono **2-7 file e qualche centinaio di
righe**, ma due su quindici erano da **55 file e 3.980 righe**. Il costo
dipende dal modello scelto e da quanto contorno gli si dà. **Si misura sui
primi tre giri veri, non prima.**

### Il problema della A

È un servizio esterno che **legge il repository**. Qui pesa poco — il
repository è già pubblico, quindi non gli si sta dando niente che non sia
già visibile a chiunque. ⚠️ Ma va detto: **è un terzo che entra**, e la sua
qualità e i suoi prezzi non li decidiamo noi. Oggi è gratis per i
repository pubblici; domani è una loro scelta.

---

## 5 · I permessi necessari, e il punto dove sbaglierebbe

| | A · CodeRabbit | B · Claude |
|---|---|---|
| leggere il codice | sì | sì |
| scrivere commenti | sì | sì |
| **vedere i segreti di GitHub** | **no** | **sì, se il lavoro glieli passa** |
| una chiave nuova da custodire | no | **sì** (`ANTHROPIC_API_KEY`) |

🔴 **E qui c'è una cosa che va scritta prima di decidere.** In questo
repository i segreti di GitHub sono dieci, e fra loro ci sono:

```
SERVICE_ROLE_PRODUZIONE     ← la chiave che scavalca ogni permesso sul gestionale vero
DB_URL_PRODUZIONE           ← l'indirizzo del database vero, con la password dentro
PIN_COLLAUDO · PASSWORD_PROVA · TEST_*_PASSWORD
```

Un revisore che gira **dentro i nostri lavori** (strada B) sta nello stesso
posto di quelle chiavi. Non vuol dire che le veda — non gliele passeremmo —
ma la distanza è di una riga di configurazione.

🔴 **E c'è una trappola con un nome preciso, da evitare in ogni caso.** Su un
repository pubblico, una proposta che arriva da un estraneo **non riceve i
segreti** — lo impedisce GitHub, ed è una protezione. Ma esiste un modo di
scrivere il lavoro (`pull_request_target`) che **glieli darebbe**. È
l'errore classico di questa famiglia. Qualunque strada si scelga, il
revisore va scritto con `pull_request`, mai con l'altro.

---

## 6 · Dove commenterebbe

* **sulle righe** della proposta, dove sta il problema;
* **un commento di riepilogo** quando non trova niente, così si distingue
  «ha guardato e va bene» da «non ha guardato».

⚠️ **Non blocca il merge**, e non deve: un revisore che ferma la
pubblicazione diventa un cancello, e i cancelli che sbagliano si aggirano.
La decisione resta di Alessio.

---

## 7 · Come si spegne

| strada | come | quanto ci vuole |
|---|---|---|
| **A** | si toglie l'accesso al repository dalle impostazioni | un minuto, dal browser |
| **B** | si cancella il file del lavoro, **oppure** si toglie il segreto | un minuto |

⚠️ **In tutt'e due i casi si spegne senza toccare il codice del gestionale**,
ed è una condizione che pongo io: un revisore che per essere tolto obbliga a
rimettere le mani nel programma non è una prova, è un impegno.

---

## 8 · Cosa consiglio, e perché

**La A (CodeRabbit), per un periodo di prova dichiarato.**

Tre ragioni misurate:

1. **Non tocca il credito del locale.** È la ragione che pesa più di tutte:
   la posta e le etichette non possono smettere di funzionare per colpa di un
   revisore.
2. **Non entra dove stanno le chiavi.** Legge un repository che è già
   pubblico.
3. **Costa zero**, quindi la domanda «serve davvero?» si può rispondere
   guardando invece che immaginando.

⚠️ **Con una condizione, e senza non lo proporrei**: si guarda **dopo tre
proposte vere** e si contano due cose — *quanti rilievi erano veri* e
*quanti erano falsi allarmi*. Se i falsi sono la maggioranza, si spegne. Un
revisore che grida a vuoto non è neutro: **insegna a non leggere i
commenti**, e quel danno resta anche dopo averlo spento.

**La B resta la strada giusta il giorno che serve un revisore che conosce
questo progetto**, perché gli si possono dare da leggere le nostre regole. Ma
allora vuole **un credito suo**, separato da quello del locale — e quella è
una decisione di spesa, non tecnica.

---

## 9 · Cosa NON farò senza un via esplicito

* installare o autorizzare qualunque applicazione sul repository;
* creare, modificare o leggere segreti e variabili;
* scrivere un file di lavoro che faccia girare un revisore;
* attivare alcunché su account esterni.

---

## 10 · Cosa resta non misurato

* **Quanto costerebbe la strada B**, in euro per proposta. Si misura sui
  primi tre giri, non prima.
* **Quanti falsi allarmi produrrebbe la A** su questo codice: la tabella
  del §3 dice quali *tipi* sono prevedibili, non quanti.
* **Se le istruzioni bastano a farlo tacere sulle scelte volute.** Nessuno
  l'ha provato qui, e resta la domanda che decide se il revisore serve o
  dà fastidio.
