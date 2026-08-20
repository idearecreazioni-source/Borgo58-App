# Cosa non mi convince — rilettura a serata finita

**20/08/2026** · Code → validatore

Il mandato della serata chiudeva così: *«Se finisci tutti e quattro i blocchi,
FERMATI. Non prendere altro lavoro non mandatato: rileggi quello che hai fatto
e scrivi cosa non ti convince. Nessuno sta guardando, ed è esattamente il
momento in cui il lavoro non chiesto costa più di quanto rende.»*

Questo è quel documento. **Non è un elenco di cose da fare**: è quello che
guarderei per primo se dovessi validare il lavoro di stasera.

---

## 🔴 Un difetto l'ho trovato rileggendo, e l'ho corretto

Non l'ho lasciato in elenco perché riguarda **dati di clienti** e costava una
riga — la regola della sessione dice di non decidere al posto di Alessio su
soldi e dati dei clienti, ma qui non c'era nessuna decisione da prendere: era
sbagliato e basta.

**`storia_cliente` confrontava il mittente con «contiene» invece che per
uguale.** Un cliente con la mail `rossi@x.it` avrebbe visto nella sua storia
anche la corrispondenza di `mario.rossi@x.it`: **la posta di un cliente dentro
la scheda di un altro**, e nessuna schermata l'avrebbe segnalato — le righe
sembrano legittime.

Corretto (si estrae l'indirizzo da `Nome <mail>` e si confronta per uguale), e
c'è ora una prova che lo sorveglia: **rimessa la versione vecchia, diventa
rossa** dicendo esattamente questo.

---

## Le cinque cose che guarderei per prime

### 1 · 🔴 La rete del blocco A guarda la FORMA, non il comportamento

`tests/unita/letture.test.js` pretende che ogni `.catch` marchi `NON_LETTO` o
dichiari perché tace. **Non sa se la schermata mostra davvero la riga.**

Il caso che resta possibile: marcare `NON_LETTO` e poi **non guardarlo mai**.
Ne ho curati 13 e li ho scritti tutti io stasera — e proprio per questo non
sono la persona giusta per dire che sono tutti collegati.

⚠️ **E nessuno li ha visti**: senza ambiente DOM, in questo progetto nessuna
prova guarda una schermata. **È la voce che pesa di più su tutta la serata**,
ed è la domanda 1 del riepilogo del blocco A.

### 2 · 🔴 Il prodotto cartesiano di `da_allineare()`: quante altre funzioni hanno la stessa forma?

Il difetto era `left join stock_lots` **e** `left join rettifiche_giacenza`
nella stessa query, con un `sum()` sopra: la giacenza veniva moltiplicata per
il numero di correzioni. **6 kg con 12 correzioni diventavano 72.**

⚠️ Nessun errore, un numero **plausibile e sempre più alto del vero**.

🔴 **Non ho misurato se altre funzioni del gestionale hanno la stessa forma** —
due o più `left join` verso tabelle-figlie con un aggregato sopra. È una
famiglia, non un caso, e ha esattamente il profilo di quelle che questo
progetto insegue: *sbaglia in silenzio e in una direzione sola*. **Voce di
coda, non fatta.**

### 3 · Il food cost reale mescola due perimetri, e non lo dice

Lo **stimato** conta solo gli scarichi con un conto dietro (`order_id not
null`): è il cibo **venduto**. Lo **scostamento** conta **tutte** le
rettifiche, anche su prodotti che nessuno ha mai venduto.

Il numero è giusto come *«quanto mi è costato in più di quanto pensavo»*, ma la
**percentuale** rapporta due insiemi diversi. Oggi non morde (zero ricette,
zero conti chiusi), e l'avvertenza che esce col numero parla d'altro.

⚠️ **Non l'ho corretto** perché la cura giusta non è ovvia — restringere le
rettifiche ai soli prodotti venduti nasconderebbe proprio gli sprechi su ciò
che non si vende, che è informazione vera. Va deciso guardando dati veri, e non
ce ne sono.

### 4 · Il consenso registrato e revocato nella STESSA transazione resta valido

La regola confronta le due date, e `registra_consenso` / `revoca_consenso`
usano entrambe `now()` — che **dentro una transazione è un istante solo**
(trappola del 16/08). Chiamandole nella stessa transazione, `revocato <
consenso` è **falso** e il consenso risulta ancora valido.

Nella pratica sono due gesti separati da giorni, quindi **non è raggiungibile
dall'app**. Ma è armato, ed è la stessa forma che stasera ha già morso due
volte (lo storico dei costi, «l'ultima partita»).

⚠️ La cura sarebbe `clock_timestamp()` o un progressivo. **Non fatta**: non
volevo toccare la regola del consenso a fine serata, con Alessio assente, per
un caso che dall'app non si produce.

### 5 · La pulizia del blocco D non è mai girata su numeri diversi da zero

Ha girato su un progetto di prova **appena costruito**: i suoi 18 guardiani
hanno confrontato zeri con zeri. In produzione confronteranno 13 sagome, 17
causali, 14 disposizioni, 8 impegni.

⚠️ **Non c'è modo di provarlo davvero senza applicarlo**, ed è il motivo per
cui va fatto con Alessio davanti e dopo un backup.

---

## Due cose che invece mi convincono, e le scrivo perché non si perdano

- **Le rotture hanno trovato quattro difetti che nessuna rilettura aveva
  visto**: il costo dell'«ultima partita» scelto a caso, il prodotto
  cartesiano, il conteggio delle prove saltate che ignorava `describe.skipIf`,
  e la mia prova che cercava il nome della sentinella invece della chiamata.
  ⚠️ **E una rottura non ha trovato niente per colpa della prova, non del
  codice**: quella sul food cost passava verde. *Rompere è servito più che
  rileggere, cinque volte su cinque.*
- **La ricostruzione da zero del progetto di prova** — 162 migrazioni in fila —
  ha trovato un guardiano che era **una fotografia della produzione**. Non era
  mandatata: l'ho fatta perché mi serviva un Ricettario vuoto. È il tipo di
  verifica che nessuno fa finché non serve, e serve nel giorno peggiore.

---

## E una cosa che ho fatto e che andava chiesta

Nel blocco A ho sistemato `scarico-magazzino.test.js`, che **non era nel
mandato**: andava in timeout e faceva risultare «saltate» sei prove. L'ho
toccato perché senza, la suite non passava e non potevo dichiarare chiuso il
blocco.

⚠️ Era dentro il tema del blocco A — *qualcosa che non trova quello che cerca e
continua zitto* — ma resta **lavoro non chiesto**, e lo dichiaro qui invece di
lasciarlo scoprire.
