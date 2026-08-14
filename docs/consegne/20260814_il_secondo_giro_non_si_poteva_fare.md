# Consegna del 14/08/2026 (tredicesima) — il secondo giro non si poteva fare

**Commit della consegna: `e9ee2d4`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `e9ee2d4` | non si poteva cominciare una prenotazione su un tavolo già occupato |

**Nessuna migrazione.** Produzione invariata: **97 migrazioni**, corridoio
**v20**, elenco anonimi **12**. Solo schermata.

Quarta coda del blocco Sala, ancora **dall'uso**: Alessio ha provato a
fare la doppia prenotazione che avevamo appena finito di progettare, e
non ci è riuscito.

---

## 1. Il difetto, e perché era peggio di come suona

> *«non riesco a mettere una doppia prenotazione su un tavolo»*

Il tocco su una sagoma aveva tre significati, tutti e tre corretti presi
singolarmente:

- lavoro in corso → aggiunge o toglie il tavolo dalla scelta;
- tavolo **libero** → comincia una prenotazione nuova su quello;
- tavolo **già promesso** → apre *quella* prenotazione.

⚠️ **Insieme lasciavano un buco esattamente dove serviva di più.** Per
cominciare una prenotazione bisognava partire da un tavolo libero: se i
tavoli che servono sono già promessi — cioè **il secondo giro**, il caso
per cui il giorno prima avevamo costruito il giallo e il verde — non
c'era nessun modo di partire.

L'unica strada praticabile era cominciare da un tavolo libero qualsiasi e
poi aggiungere quello occupato. **Non è una strada: è un caso fortunato**,
e dipende dall'esistere di un tavolo libero che non c'entra niente.

⚠️ **È lo stesso modo di fallire di tutta questa serie**: nessun errore,
nessun avviso, ogni singolo pezzo che fa la cosa giusta — e il gesto che
serve che non si può fare. Non lo avrebbe trovato nessuna verifica
scritta a tavolino, perché ogni regola presa da sola era quella voluta.

---

## 2. La correzione

**Un modo esplicito, invece di dedurlo dal tavolo toccato.** Sopra la
pianta c'è ora **«+ Prenotazione nuova»**: si entra dichiarandolo, e da lì
ogni tocco aggiunge o toglie un tavolo — promesso o no.

Il tocco diretto su un tavolo libero **resta com'era**: è la scorciatoia
del caso normale, ed è giusto che il caso normale costi un tocco solo.

**E quando fra i tavoli scelti ce n'è uno già promesso, il riquadro lo
dice**: chi c'è e a che ora. ⚠️ Non è un avviso e non blocca niente — è la
sola cosa che serve sapere per decidere il secondo giro, ed è esattamente
l'informazione che **la spunta tolta il giorno prima chiedeva ad Alessio
di dichiarare a mano**. Il colore la mostra sulla pianta, questa riga la
scrive per esteso al momento in cui conta.

---

## 3. Il pallino, tolto su richiesta

Segnava «questa sagoma l'hai spostata solo per oggi».

> *«vedere questo pallino non mi serve, togliamolo»*

Ha ragione: quale tavolo ha spostato lo sa, l'ha appena fatto lui. E su
una sagoma da 90 cm era spazio rubato al nome — che è l'unica cosa che
dentro il tavolo ci sta ancora.

Quanti ne ha spostati **resta scritto sotto la pianta**, dove serve
davvero perché è lì che ci sono i comandi per rimetterli a posto. E non
si chiama più «pallino rosso»: la scritta lo diceva anche col colore
sbagliato.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| lint, build | puliti |
| prove automatiche | **55 verdi**, invariate |
| modifiche al database | **nessuna** |
| **produzione** | **97 migrazioni**, invariata |
| file toccati | `PiantaSala.jsx`, `PiantaGiornata.jsx`, questo riepilogo |

---

## 5. Cosa NON è verificato, e lo dico chiaro

- ⚠️ **La doppia prenotazione non è ancora riuscita a nessuno.** È il
  terzo riepilogo di fila in cui la cosa appena costruita non è stata
  provata da una mano vera — e stavolta pesa di più, perché è proprio il
  gesto che ieri risultava impossibile. **La prova che serve è una sola**:
  premere «+ Prenotazione nuova», toccare un tavolo già promesso,
  prenotare a un'ora diversa, e vedere se diventa mezzo giallo e mezzo
  verde.
- **Nessuna prova automatica copre questa schermata.** Le 55 verdi
  guardano il database; il comportamento del tocco — quale dei tre
  significati scatta e quando — è provato solo leggendolo. È il pezzo di
  questo blocco con meno rete sotto, e va detto.
- **Restano non provati da una mano vera** il trascinamento, il giro del
  tavolo e i due colori, come nei riepiloghi precedenti.
- ⚠️ **In produzione restano due prenotazioni di prova** di Alessio
  («alessio» e «Alessio», entrambe alle 20:00): da togliere prima che
  arrivino prenotazioni vere.
- **La riga del Contratto §5 sui tavoli uniti è ancora quella vecchia.**
  Quarto riepilogo che lo dichiara: è un commit separato di due minuti,
  e aspetta solo un sì di Alessio.
