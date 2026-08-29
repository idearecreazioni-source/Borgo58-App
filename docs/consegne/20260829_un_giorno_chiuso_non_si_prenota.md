# Un giorno chiuso non si prenota, e chi aveva prenotato resta da chiamare

**Blocco 1 del mandato del 29/08 (sera)** · 29/08/2026

| | |
|---|---|
| commit del lavoro | `443a00a` |
| working tree al momento del riepilogo | pulito salvo il Blocco 2 in corso (`20260829000011`, `src/lib/calcoli/stagionalita.js`, `tests/unita/stagionalita.test.js`) |
| migrazione introdotta | `20260829000010_un_giorno_chiuso_non_si_prenota.sql` |
| applicata in produzione | **NO** — vedi «Cosa non è stato fatto» |
| applicata sul progetto di prova | sì, e rotta due volte |
| prove | 454 su 454 verdi (65 file, `npm run test:app`), 584 pure |

---

## 🔴 IL PUSH NON ERA STATO FATTO, e il mandato diceva di sì

Il mandato si apre con *«IL PUSH E' GIA' FATTO… le migrazioni in attesa
vanno applicate subito, all'inizio, prima di ogni altra cosa»*.

**Misurato, non dedotto**, chiedendolo al server e non alla copia locale:

```
git ls-remote origin master  →  40f15f7677d53be3c87b971b9f8f09cb4d019bbc
git rev-parse HEAD           →  b1b3da5e11b7b5b885633c7542677bdb1fd5376b
git log --oneline origin/master..HEAD  →  9 commit
```

`git fetch` è riuscito (exit 0, ha stampato il ref) e `git ls-remote`
interroga GitHub, non la cache: **su GitHub ci sono nove commit in meno di
quelli che ho sul disco**, e fra quelli mancanti ci sono le cinque
migrazioni del 29/08 mattina.

Quindi `npm run migra` si è **rifiutato**, come deve:

> FERMO: queste migrazioni non sono ancora su GitHub.
> · 20260829000005 … · 20260829000009

⚠️ **Non l'ho aggirato**, ed è il punto: quel freno esiste perché fra il
commit e il push c'è Alessio, e finché non ha spinto la produzione
girerebbe codice che nessuno può leggere. La regola del §2 punto 4 dice
esattamente questo, e dice anche che il controllo sta nello script e non
nella memoria di chi lancia il comando.

**In produzione ci sono 321 migrazioni; nel repository ce ne sono 327
dopo questo blocco.** Le sei di scarto aspettano il push.

---

## Cosa era rotto, misurato prima di correggere

Il controllo della chiusura **esisteva già** in tutte e due le funzioni
pubbliche. Viveva **dentro** il ramo `if coalesce(v_attivo, false)`, cioè
dentro l'interruttore `prenotazioni_online_attive`.

Misurato sul progetto di prova — dove quell'interruttore è **spento** —
creando una chiusura per il 2026-09-08 e chiamando le due funzioni, dentro
una transazione poi annullata:

| interruttore | `public_reservation_options` | `submit_public_reservation` |
|---|---|---|
| **spento** | `{"orari": [], "attivo": false, "sold_out": false}` | 🔴 **la richiesta è ENTRATA** |
| acceso | `{"chiuso": true, "motivo": "…"}` | respinta, com'è giusto |

🔴 **E il modo di fallire era il peggiore**: nessun errore, nessun avviso.
La richiesta entrava, e la si sarebbe scoperta solo aprendo la giornata.

⚠️ **La distinzione che sistema la cosa**: l'interruttore governa un
**calcolo** — quali orari proporre — non un **fatto**. «Quel giorno siamo
chiusi» l'ha scritto Alessio con la data davanti. Un fatto certo non può
dipendere da un interruttore che governa una stima. Per questo il
controllo sale **accanto al freno del «siamo al completo»**, che ha
esattamente la stessa forma ed è fuori dall'interruttore dal 14/08.

---

## Cosa fa adesso

### 1a — in un giorno di chiusura non si prenota

* Il controllo esce dall'interruttore in **tutt'e due** le funzioni.
* `public_reservation_options` dichiara la chiusura anche a interruttore
  spento, e comprende il **riposo settimanale**: per chi prenota è la
  stessa cosa — quel giorno non si mangia qui.
* Il modulo pubblico **parte dal primo giorno in cui si mangia qui**
  (`giorni_chiusi_prenotabili()` → `min` del campo data), e quando si
  sceglie un giorno chiuso lo dice **lì dove si è toccato**, col primo
  giorno utile dopo quello. Il pulsante d'invio si spegne.

⚠️ **Limite dichiarato, e non è aggirabile**: un campo data del browser
**non sa spegnere i singoli giorni** — sa solo avere un minimo e un
massimo. Le date chiuse dopo la prima quindi restano *selezionabili*, e
vengono **rifiutate subito**, con la frase e la via d'uscita. Renderle
davvero non cliccabili vuol dire sostituire il campo con un calendario
nostro, e su un telefono si perde il selettore nativo. È la domanda n. 1.

### 1b — le prenotazioni già prese restano

In cima alla giornata compare **«Questo giorno il locale è chiuso»** con
la ragione, e sotto **resta tutto**. `perche_chiuso()` distingue il
**riposo settimanale** dalla **chiusura a date**: sono due fatti diversi
e la frase da leggere è diversa.

✅ **VISTO A SCHERMO**, tutti e due i rami, sul progetto di prova:
* con una chiusura scritta → *«Questo giorno il locale è chiuso.
  GUARDA-29AGO Evento privato a locale chiuso Le 9 prenotazioni qui sotto
  restano: è gente da chiamare.»*
* senza chiusura, in un giorno senza servizio → *«…È il giorno di riposo
  settimanale.»*

### 1c — l'avviso sull'ora, che avvisa e non blocca

Su una richiesta in attesa compare **«A quest'ora c'è già una
prenotazione»**. Nessun calcolo di rotazione dei tavoli: non esiste in
questo gestionale e non è stato costruito.

⚠️ **Conta solo le CONFERMATE**, ed è la parte che decide se l'avviso dice
il vero: una richiesta in attesa non tiene occupato niente (decisione del
14/08), quindi contarla direbbe «c'è già qualcuno» quando non c'è ancora
nessuno. E si esclude la riga stessa.

🔴 **DIFETTO TROVATO GUARDANDO, non rileggendo**: l'avviso l'avevo messo
solo nell'elenco sotto la pianta. Aprendo la giornata **non compariva** —
perché **una richiesta appena arrivata non ha ancora un tavolo**, e le
prenotazioni senza tavolo vivono in una striscia separata sopra la
pianta. Cioè l'avviso stava dove non si sarebbe quasi mai visto. Ora è in
tutt'e due i posti.

🔴 **E UN SECONDO DIFETTO, sempre guardando**: la prima versione scriveva
*«A quest'ora c'è già 2 prenotazioni»*. Il verbo era attaccato al numero
sbagliato.

### 1d — i turni della cucina e le chiusure

⚠️ **Verificato, e non c'era niente da correggere**: `si_lavora_in_cucina(data)`
— nata ieri con la `20260829000005` — **guarda già** le chiusure, e una
chiusura che si è pronunciata vince sulla settimana tipo. Coerente con 1b.

🔴 **Ma la misura ha trovato altro**: quella funzione **non la chiama
nessuno**. Zero funzioni del database, zero righe del client. Il
calendario della cucina esiste, è coerente, e **non è collegato a niente**
— il suo primo lettore sarà il punto 3f (le preparazioni ricorrenti).

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è stata
contraddetta.

Voci **toccate** (lette prima di lavorare, e nessuna cambiata):
* *Sala e pianta* — «14/08: una richiesta in attesa NON tiene occupato
  niente». È **la ragione** per cui l'avviso 1c conta solo le confermate:
  la decisione non è rovesciata, è applicata.
* *Sala e pianta* — «18/08: le legende si tolgono», «19/08: in Comande la
  sala non cambia da sola». Non toccate.
* *Magazzino e scarico* — «29/08: aperto al pubblico e si lavora in cucina
  sono due cose distinte». Confermata dalla misura del 1d.

Voci **aggiunte** a `docs/DECISIONI.md` in questo stesso blocco, come la
regola pretende: le tre decisioni di Alessio su 1a, 1b e 1c, in *Sala e
pianta*.

---

## Come è stato provato

**Dentro la migrazione**, sei controlli, e il primo è il caso **positivo**:
senza, un rifiuto più avanti non dimostrerebbe che la causa è la chiusura
— potrebbe essere qualunque altro controllo della funzione.

🔴 **LA PRIMA STESURA DELLA VERIFICA SI È FERMATA, ed è la lezione più
utile del blocco.** Cercava «un giorno in cui il locale è aperto» — e sul
progetto di prova **tutti e quattordici i servizi sono spenti**, quindi
non ne esiste nessuno. La verifica non era sbagliata: era **appoggiata a
una riga che non è sua**. Riscritta perché il perimetro se lo costruisca
da sé — accende la cena di quel giorno della settimana per il tempo della
prova, e rimette le righe intere.

**Rotta due volte, e i due errori sono su due controlli diversi:**

| rottura | dove fallisce |
|---|---|
| la chiusura torna dentro l'interruttore (col commento intatto, così il controllo del corpo vivo non se ne accorge) | controllo (2): *«A interruttore spento una richiesta è entrata in un giorno chiuso»* |
| `perche_chiuso` dice sempre «riposo» | controllo (5): *«perche_chiuso non racconta la chiusura come dovrebbe»* |

⚠️ **La verifica si è estratta e lanciata da sola**: rilanciare la
migrazione intera avrebbe rimesso a posto la funzione rotta *prima* di
verificarla — un `create or replace` cura da sé la rottura che gli si
mette davanti.

⚠️ **C'è un controllo che si ferma se una sostituzione non attecchisce**:
guarda il **corpo vivo** delle due funzioni e pretende il segno della
correzione. Senza, una `create or replace` non passata lascerebbe metà
dei controlli a provare il codice vecchio.

**Le due reti dei permessi sono diventate rosse da sole** sulla funzione
nuova — che è il lavoro per cui esistono. Dichiarata in tutte e due con la
ragione: `giorni_chiusi_prenotabili` restituisce **solo delle date**,
senza motivo, cioè quello che un ristorante scrive sulla porta; e
`security definer` senza portiere serve davvero, perché la chiama il
modulo pubblico, dove chi legge non ha e non può avere un accesso.

**Guardato con gli occhi** sul progetto di prova, dopo aver constatato dal
DOM che la porta 5173 parla col database di prova (`bnwqgpuyzmzujxfbtyvs`)
e non con la produzione:

| cosa | esito |
|---|---|
| giorno chiuso, interruttore spento | «Quel giorno siamo chiusi», campo ora sparito, pulsante spento |
| giorno **aperto**, interruttore spento | campo ora libero, pulsante acceso — invariato |
| giorno chiuso, con un giorno aperto dopo | «…Il primo giorno utile dopo quello è il 12 set 2026.» |
| giornata con chiusura scritta | striscia in cima + 9 prenotazioni tutte visibili |
| giornata di riposo settimanale | striscia in cima con la frase diversa |
| richiesta alle 20:00 con una confermata alle 20:00 | «A quest'ora ci sono già 2 prenotazioni.» |
| richiesta alle 21:30, nessuna confermata a quell'ora | nessun avviso |

---

## Cosa NON è stato fatto, e perché

* **Nessuna migrazione è stata applicata in produzione.** Le cinque del
  mattino e questa aspettano il push di Alessio. `npm run migra` si
  rifiuta, e non è stato aggirato.
* **Le date chiuse restano tecnicamente selezionabili** dopo la prima:
  vedi il limite dichiarato sopra, e la domanda n. 1.
* **`si_lavora_in_cucina()` resta senza lettori.** Non è stato collegato
  niente: il suo posto è il punto 3f, che è un altro blocco.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
* Il modulo pubblico **con l'interruttore acceso e un giorno chiuso**: in
  produzione l'interruttore è acceso, sul progetto di prova è spento, e
  non l'ho acceso lì per non cambiare uno stato di Alessio. Quel ramo è
  provato dentro la migrazione, non guardato.
* **Nessuna mano vera** ha mandato una richiesta dal sito.
* **Nessuna immagine è stata guardata**: lo screenshot non funziona in
  questo ambiente, e tutto ciò che è «visto» è **testo letto dal DOM**.
  Colori, contrasto e come sta la striscia gialla su un telefono in mano
  non li ha visti nessuno.
* Le misure di schermo (larghezze, bersagli) **non sono state fatte** su
  queste due schermate: il blocco non le chiedeva.

**Cosa ho contato senza leggerlo**
* «454 prove verdi» e «65 file» sono il totale stampato da `npm run test:app`,
  letto dal codice d'uscita del processo (EXIT=0), non prova per prova.
* «9 commit non pubblicati» viene da `git log --oneline origin/master..HEAD`;
  ho letto i titoli, non i contenuti.
* «321 migrazioni in produzione» è un `count(*)` su `applied_migrations`.

**Quali mie affermazioni sono diventate false mentre lavoravo**
* Avevo scritto, progettando, che l'avviso 1c andava «nell'elenco delle
  prenotazioni». **Diventata falsa aprendo la schermata**: nell'elenco
  finiscono solo le prenotazioni **che hanno già un tavolo**, e una
  richiesta appena arrivata non ne ha. La frase era vera del codice che
  avevo scritto e falsa del posto in cui serve.
* La prima verifica dichiarava di provare «un giorno aperto»: era falsa
  sul progetto di prova, dove nessun giorno è aperto.

**Quali blocchi non ho aperto**
* **Blocchi 2, 3, 4 e 5**: questo riepilogo copre il solo Blocco 1. Il
  Blocco 2 è in corso al momento in cui scrivo.

**Quali conteggi sono pavimenti**
* «9 date chiuse su 61 in produzione» è calcolato sugli orari di
  **oggi**: cambia il giorno che Alessio accende o spegne un servizio, o
  scrive una chiusura.
* «zero non alimentari dentro una ricetta» è del Blocco 2 e non di questo.

**Cosa ho lasciato sul progetto di prova**
* **Niente.** Contato dopo:
  * prenotazioni con marchio `GUARDA-29AGO` o `VERIFICA%`: **0**
  * chiusure con quei marchi: **0** (restano le 3 `BASE-` dello scenario)
  * clienti creati dai numeri di prova: **0**
  * trigger di `reservations` rimasti spenti: **0**
  * lapidi in `deleted_records`: **7409 prima e 7409 dopo** — `reservations`
    e `service_closures` non sono nel perimetro del registro, misurato.
* ⚠️ **Una cosa ho dovuto rimettere a mano, e va detta**: per guardare il
  modulo con un giorno **aperto** ho acceso la cena del sabato sul
  progetto di prova. Avevo salvato la riga in una tabella temporanea —
  **che è morta con la sessione di `psql`**, cioè il salvataggio non è
  sopravvissuto. L'ho rimessa leggendo le altre tredici righe, che sono
  **tutte identiche** (20:00 / 22:30 / spento) e combaciano con la
  produzione. Contato dopo: **0 servizi attivi, 61 giorni chiusi** —
  esattamente come prima di toccarla. *Ha funzionato, ma il salvataggio
  era in un posto che non dura quanto il lavoro: è la regola del 14/08
  («salvare la riga intera») fallita in una forma nuova.*
* I due documenti vuoti che Alessio tiene apposta **non sono stati
  toccati**.

---

## Domande per Alessio

Sono in fondo al riepilogo del Blocco 2, tutte insieme e numerate.
