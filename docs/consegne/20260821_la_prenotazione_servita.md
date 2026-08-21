# Blocco 1 — la prenotazione servita

**21/08/2026** · migrazione **`20260821000004`**, applicata **solo al progetto
di prova**. In produzione **non è entrata**: Alessio non c'è.

---

## 1 · La misura, prima di costruire

### Esiste già un legame fra il conto e la prenotazione?

✅ **Sì, e vale per tutte le prenotazioni**, non solo per quelle nate da un
preventivo. `apri_conto` (giro D1, 18/08) sceglie fra le confermate di quella
serata sui tavoli aperti quella con **l'ora più vicina a adesso**.

⚠️ **Non ho dovuto costruire nessun legame nuovo**: la cura si appoggia a
quello.

### Quanti punti tocca uno stato nuovo

| dove | quanti |
|---|---|
| il vocabolario | un **enum** `reservation_status`, non un `check` |
| funzioni del database che filtrano `confermata` **su `reservations`** | **9** |
| file dell'app che nominano `confermata` | **11**, per 23 occorrenze — ⚠️ ma alcuni sono falsi positivi: le «regole di deducibilità confermate da Laura» non c'entrano |

**Le 9 funzioni**: `accetta_preventivo`, `apri_conto`, `assegna_prenotazione`,
`capienza_della_sala`, `crea_prenotazione_su_tavoli`, `email_conferma_dovuta`,
`posto_per_la_serata`, `pulisci_richieste_scadute`, `turni_del_giorno`.

⚠️ **Ne ho toccate due** — `capienza_della_sala` e `turni_del_giorno`. Le
altre sette restano su `confermata` **e va detto perché**: `apri_conto` non
deve riagganciare una prenotazione già servita; `pulisci_richieste_scadute`
cancella rifiutate e annullate, e una servita è **storia**, non scarto.

### 🔴 Chi conta le prenotazioni, e la conseguenza dichiarata

**`capienza_della_sala`** somma le `party_size` delle confermate di quella
data, e **da lì passa la spunta «sala piena»**.

> ⚠️ Una prenotazione servita che smette di contare fa **scendere** i
> prenotati: una sala che risultava piena **può tornare non piena, e la
> spunta si spegne da sola.**

È corretto — quei posti si sono davvero liberati — e succede **senza che
nessuno lo chieda**, perché il trigger del 21/08 ricalcola quando cambia lo
stato di una prenotazione. **Ma è il genere di effetto che fra sei mesi
sembra un guasto**, quindi è scritto nella migrazione e qui.

⚠️ **`coperti_del_giorno` invece NON guarda le prenotazioni** — misurato:
conta i posti dei tavoli. Il mandato lo dava per possibile; non è così.

---

## 2 · La regola, scritta con le parole di Alessio

> **IL TAVOLO MOSTRA LA FASCIA CHE DEVE ANCORA ARRIVARE,
> NON QUELLA GIÀ PASSATA.**

Sta in `src/lib/calcoli/ritardo.js`, `fascePerIlTavolo`, con **6 prove**.

⚠️ **È scritta come una frase e non come due condizioni apposta**: i due casi
che Alessio ha nominato — il tavolo che torna libero, e quello che perde il
giallo e resta rosso — **non sono scritti da nessuna parte nel codice**. Li
produce la regola. E ne produce un terzo che nessuno aveva nominato: servite
tutte e due, il tavolo torna bianco.

**Rotta apposta** (tolto il filtro sulle servite): **3 prove rosse**, e i
messaggi sono i due casi di Alessio parola per parola —
`expected ['presto'] to deeply equal []` e
`expected ['presto','tardi'] to deeply equal ['tardi']`.

---

## 3 · 🔴 DUE ERRORI MIEI, trovati da due reti diverse

### Ho riscritto una funzione a memoria

Ho ricostruito `turni_del_giorno` da una lettura **parziale** del suo corpo,
e ho cambiato senza accorgermene: **l'ordine dei casi delle fasce** (nel vero
`tardi` viene per primo), i nomi dei CTE, e — la cosa peggiore — **l'ho resa
`security definer` quando era `invoker`**.

**L'ha presa `tests/app/turni-sala.test.js`**: *«a pranzo le fasce si leggono
sugli orari del pranzo»* → `expected 'pieno' to be 'tardi'`.

> ⚠️ È **esattamente** la trappola scritta in CLAUDE.md dal 18/08: *una
> funzione si riscrive dal DATABASE, mai dal file (o dalla memoria) — fra i
> due ci stanno tutte le migrazioni che l'hanno toccata.* L'ho riaperta un
> mese dopo averla scritta.

**Cura**: ripresa dal corpo vivo della produzione e modificata
**chirurgicamente** — due sole righe, il resto identico carattere per
carattere.

### Ho aperto una funzione che non era aperta

Riscrivendo `capienza_della_sala` avevo aggiunto `grant execute … to
authenticated`, dando per scontato che servisse. **Misurato: in produzione
non è eseguibile da nessuno** — la chiamano solo altre funzioni.

Il mio `grant` **avrebbe fatto vedere allo staff quanti posti restano**, che
è una decisione che nessuno ha preso.

**L'ha presa `tests/app/permessi.test.js`**, che elenca per nome le funzioni
che scavalcano la RLS senza chiedere chi sei: `capienza_della_sala` è
comparsa in quell'elenco e la prova è diventata rossa.

> ⚠️ **È il lavoro per cui quella rete è stata scritta il 19/08**, e ha preso
> un errore che nessuna rilettura avrebbe visto: il codice era corretto, il
> permesso no.

⚠️ **E c'è una cosa che le due hanno in comune**: tutti e due gli errori sono
nati dal *riscrivere* invece che dal *modificare*. La cura è la stessa in
entrambi i casi — partire dal vero e toccare il meno possibile.

---

## 4 · Cosa ho guardato

Costruita sul progetto di prova la scena **esatta** del secondo caso di
Alessio: su **T7**, primo giro alle 20:00 e ultimo turno alle 22:15.

| momento | T7 | il numero sul tavolo |
|---|---|---|
| **prima** | «mezzo e mezzo» (due fasce) | — |
| **dopo aver chiuso il conto delle 20:00** | 🔴 **rosso** (`turno`) | **2** |

✅ **Il caso di Alessio funziona**: il tavolo ha perso il giallo del primo
giro e gli resta il rosso dell'ultimo turno.

✅ **E il numero è quello giusto**: **2**, cioè le persone dell'ultimo turno —
non le 4 della prenotazione già servita.

### E una cosa che ho trovato guardando

**La servita perdeva il nome nell'elenco «Stasera»**: l'elenco prende le righe
dai turni (che ora includono le servite) ma cercava il nome fra le sole
confermate, quindi compariva una riga «—».

⚠️ **La migrazione prometteva il contrario** (*«non si tolgono dall'elenco:
chi sta in sala deve poter vedere che quel tavolo ha già avuto il suo primo
giro»*), quindi era una discrepanza fra quello che avevo scritto e quello che
si vedeva. Curato: ✅ **entrambe le prenotazioni sono nell'elenco col loro
nome.**

**E la scena è stata tolta**: 0 scene, 0 conti aperti, e il servizio della
cena **rimesso spento** com'era.

---

## 5 · Cosa non è verificato

- 🔴 **La migrazione NON è in produzione.** Applicata e riapplicata **tre
  volte** sul progetto di prova (le prime due si sono fermate, e i motivi
  sono sopra). Aspetta Alessio.
- ⚠️ **La servita nell'elenco non si distingue da chi deve ancora arrivare.**
  Il dato c'è, il segno a schermo no: **come si vede una servita nell'elenco
  è una decisione di Alessio** e non l'ho presa io.
- ⚠️ **Il primo caso — il tavolo che torna del tutto bianco — l'ho visto solo
  nelle prove**, non a schermo: la scena che ho costruito è quella a due
  turni, che è il caso più difficile.
- ⚠️ **Nessuna mano ha chiuso un conto dalla schermata**: l'ho chiuso dal
  database. Il trigger sta su `orders` e vale per tutte le strade, ma il
  gesto vero non è stato fatto.

---

## 6 · Cosa abbiamo rovesciato

**Niente.** Nessuna decisione precedente cambia: **si aggiunge uno stato che
mancava.**

⚠️ La cosa più vicina a un rovesciamento è che una prenotazione onorata
smette di contare per la capienza — ma quello non era stato deciso: era la
conseguenza del fatto che *«servita» non esisteva*, e nessuno l'aveva mai
scelto.
