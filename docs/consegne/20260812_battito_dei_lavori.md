# Consegna del 12/08/2026 — ogni lavoro pianificato nasce col battito

**Commit della consegna: `4f6c72a`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

Coda della consegna «posta viva» (`0f1865c`), aperta dal tuo controllo:
il lavoro della privacy delle 4:30 non scriveva il proprio battito.

**Da applicare in produzione**: `20260812000008`. Nessuna funzione online
da ridispiegare, nessuna modifica al frontend.

---

## 1. La correzione chiesta era una riga. Quella che serviva, no.

Il bersaglio era giusto: `pulisci_richieste_scadute()` — nata nel Blocco 2
*prima* che la sentinella esistesse — non scriveva in `stato_lavori`.

Andando ad aggiungere quella riga è emerso il resto, che nessuno aveva
guardato perché non c'era motivo di guardarlo:

> la sentinella controllava **un solo lavoro**, `promemoria_agenda`,
> scritto a mano dentro il suo corpo.

`lettura_posta` e `pulizia_posta` il battito lo scrivevano — e non lo
leggeva nessuno. **Sorvegliati per finta**: la riga in `stato_lavori` si
aggiorna, il registro sembra sano, e il giorno che si fermano il silenzio
è identico a quello di prima. Aggiungere il quarto battito e lasciare la
sentinella com'era avrebbe prodotto **tre** lavori sorvegliati per finta
invece di due — e il controllo `cron.job` ↔ `stato_lavori` che proponi
sarebbe passato verde su tutti e quattro.

È lo stesso difetto della giornata, un livello più in su: non un errore
che non blocca niente, ma **una difesa che non difende e non lo dice**.

---

## 2. Cosa c'è adesso

1. **L'elenco dei lavori da sorvegliare è una tabella**
   (`lavori_sorvegliati`): nome del battito, nome in `cron.job`,
   tolleranza, e la frase che dice **cosa smette di funzionare**. Quella
   frase finisce nel messaggio su Telegram, ed è la parte che dice ad
   Alessio se deve alzarsi: *«le richieste rifiutate non vengono più
   cancellate: i dati dei clienti restano oltre il termine dichiarato
   nell'informativa»* è un'informazione; *«pulizia_richieste ferma»* no.

2. **Il censimento nei due versi, dentro la sentinella.** Un lavoro in
   `cron.job` che nessuno sorveglia → allarme. Un lavoro sorvegliato che
   non è più pianificato (o è stato disattivato) → allarme. È la tua
   lezione — *ogni lavoro pianificato nasce col battito* — messa nel
   database invece che in un controllo di routine da ricordarsi di fare.
   Se domani si aggiunge un lavoro e ci si dimentica il battito, **lo dice
   il sistema entro un quarto d'ora**, non il prossimo audit.

3. **Un tipo di allarme per lavoro** (`lavoro_fermo_<nome>`). Il freno
   anti-tempesta è per tipo: con un tipo solo, il secondo lavoro rotto
   nella stessa ora resterebbe muto.

4. **Tolto `authenticated` dalla sentinella.** Residuo del 10/08: nessuno
   la chiama dall'app, la chiama `pg_cron`, e un utente qualunque poteva
   far partire il giro degli allarmi.

---

## 3. Un difetto di misura trovato strada facendo

`chiedi_lettura_posta()` scriveva il battito **solo dopo aver chiamato
l'AI**. Cioè misurava *«l'ultima volta che ho chiesto una lettura»*, non
*«l'ultima volta che ho fatto il mio giro»*.

Sorvegliare quello avrebbe fatto gridare la sentinella **ogni notte
tranquilla** — cioè quasi sempre, visto che il lavoro gira ogni quarto
d'ora e la posta arriva a giornate. Un allarme che suona quando va tutto
bene si impara a ignorare, ed è peggio di nessun allarme.

Ora il battito si scrive anche a mani vuote. **Resta fuori un solo caso**:
parola d'ordine assente dal Vault con posta in attesa — lì il giro *non*
è andato a buon fine, e la sentinella deve vederlo (stessa logica già in
`send_due_task_reminders`).

---

## 4. Verificare una sentinella significa metterla in condizione di gridare

E questa grida su Telegram. È esattamente la trappola dell'11/08 (il
collaudo di una migrazione che fa suonare il telefono di Alessio), e la
migrazione degli allarmi del 10/08 ci era già caduta dentro: la sua
verifica chiama `segnala_allarme()` due volte per davvero.

Quindi, stessa soluzione dell'email di conferma: **la decisione è separata
dall'invio**.

- `lavori_in_silenzio()` e `lavori_senza_sentinella()` rispondono *chi* è
  fermo e *quali* scarti ci sono — e basta;
- `controlla_lavori_pianificati()` le interroga e avvisa.

La verifica dentro la migrazione prova le due funzioni di decisione, e
**conta gli allarmi prima e dopo pretendendo lo stesso numero**: se un
giorno qualcuno ci infilasse un invio, la migrazione fallirebbe invece di
telefonare.

---

## 5. Limite dichiarato, non aggirato

**La sentinella non sorveglia se stessa.** Un testimone non testimonia
della propria assenza: se si ferma `sentinella-lavori`, tacciono tutti gli
allarmi dei lavori e nessuno lo dice. Servirebbe un occhio fuori dal
database, che oggi non c'è.

Per questo `sentinella-lavori` è **esclusa esplicitamente** dal censimento
invece di essere messa nell'elenco dei sorvegliati — dove avrebbe un
battito che nessuno legge, cioè esattamente il difetto che questa consegna
chiude.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| migrazione applicata sul progetto di prova | **fatto**, e rieseguita: idempotente |
| i 4 lavori risultano sorvegliati | **fatto** (la prova pretende esattamente 4) |
| ogni lavoro, uno per uno, oltre la sua tolleranza → visto | **fatto**, dentro la migrazione |
| battito mai scritto = silenzio | **fatto** |
| censimento: lavoro pianificato non sorvegliato → visto | **fatto** |
| censimento: lavoro sorvegliato non più pianificato → visto | **fatto** |
| la verifica non manda avvisi | **fatto**: allarmi contati prima e dopo, invariati |
| sentinella intera dal vivo (sul progetto di prova) | **fatto**: sana → 0 avvisi; ferma da 30 ore → 1 avviso che nomina i dati dei clienti; tre giri → sempre 1 |
| pulizia dei dati di prova | **fatto**: zero allarmi e zero righe residue |
| lint, prove di unità, build | puliti (gancio pre-commit) |
| **produzione** | **non applicata**: la applica Alessio |

**Non verificato, e dichiarato**: che in produzione il primo giro reale di
`pulisci_richieste_scadute()` scriva davvero il battito — succede stanotte
alle 4:30, dopo che Alessio avrà applicato la migrazione. Fino ad allora
il battito di partenza è quello messo dalla migrazione (`now()`), scelto
di proposito: senza, la sentinella griderebbe subito per un guasto
inventato dalla migrazione stessa. Il costo dichiarato è che, se quel
lavoro fosse **già** rotto oggi, l'allarme arriverebbe fra 26 ore invece
che subito.

---

## 7. Fuori consegna, ma è la risposta a una domanda aperta

Il riepilogo precedente lasciava scritto: *«il lavoro pianificato ogni
quarto d'ora non è ancora stato osservato partire da solo»*.

**Osservato adesso, in produzione, dal connettore in sola lettura**:
`lettura-posta` risulta eseguito da `pg_cron` alle 09:00, 09:15, 09:30 e
09:45 di oggi, tutti `succeeded`. Il lavoro parte da solo. Nessuna
migrazione lo riguarda: era già così, mancava solo che qualcuno guardasse.

---

## 8. Poscritto — questa migrazione ha prodotto un falso allarme

Applicata in produzione alle 12:16, alle 12:30 ha fatto suonare Telegram
con un guasto che non esisteva. Causa, conseguenze e correzione in
[`20260812_falso_allarme.md`](20260812_falso_allarme.md).
