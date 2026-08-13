# Consegna del 13/08/2026 (settima) — la lista della spesa

**Commit della consegna: `2682ede`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `726939e` | la lista si riempie da sola: la soglia si può scrivere — `20260813000014` |
| `2682ede` | stato della produzione dopo l'applicazione |

**Applicata in produzione**: `20260813000014`. **86 migrazioni**. Nessuna
funzione online da reinstallare (il corridoio non è cambiato).

È la **Fase A del mandato «filiera della spesa»**, e ha potuto partire
solo perché il Blocco 1 — il magazzino che scende — è stato chiuso poche
ore prima.

---

## 1. Il modulo c'era già. Mancava quello che lo teneva muto

Il mandato diceva: *«Cosa esiste già: lotti, consumi, ingredienti,
diciture fornitore, prezzi storici. Cosa manca: la soglia di scorta.»* La
ricognizione lo ha confermato — righe automatiche e manuali, raggruppate
per fornitore, chiusura con acquisto e carico del magazzino: tutto già
costruito.

**Mancavano tre cose, e la prima teneva ferme le altre due.**

### 🔴 La soglia non si poteva scrivere da nessuna parte

`stock_minimum_threshold` esisteva sulla tabella dal primo giorno, ed era
**solo mostrata** in Magazzino — nessun campo, in nessuna schermata, la
scriveva. Con la soglia sempre vuota nessuna riga automatica poteva
nascere: il pulsante «aggiungi quelli sotto soglia» rispondeva
«nessuno», e da fuori **sembrava che funzionasse**.

È lo stesso modo di fallire del magazzino che non scendeva: tutto acceso,
nessun errore, e muto. Ora il campo sta sulla scheda dell'ingrediente, in
creazione **e** in modifica.

### La lista non diceva i numeri veri

Il fabbisogno veniva **congelato quando la riga nasceva**: se nel
frattempo arrivava merce, restava scritto quello di ieri. Ora giacenza,
soglia e mancante si leggono dallo **stesso conteggio che usa il
Magazzino** (`lista_spesa()` su `v_stock_levels`), mai da una copia — è
la lezione di `posti_liberi()` e `orderTotals()`, e qui costerebbe cara:
due numeri diversi sullo stesso prodotto, e uno dei due finisce in un
ordine.

### Una riga rientrata non lo diceva

Comprato il prodotto al mercato, la riga restava lì identica e si
comprava due volte. Ora dichiara **«ora ce n'è abbastanza»** — e **non
sparisce da sola**: la lista è di Alessio, il sistema propone senza
decidere. Cancellarla automaticamente sarebbe cancellare la sua lista.

---

## 2. La regola che protegge tutto il resto

⚠️ **Nessuna soglia viene proposta dal sistema.** Un ingrediente senza
soglia non entra **mai** in lista da solo. Una soglia inventata sarebbe
un numero credibile e sbagliato, e da qui la strada verso un ordine vero
è corta: è la lezione dello scarto a zero, con una conseguenza più
grossa. La proposta automatica resta fuori perimetro finché non ci
saranno mesi di consumi veri.

⚠️ **Zero non è «nessuna soglia»**: sarebbe una soglia che non scatta
mai, cioè un campo compilato che non fa niente — la stessa trappola dello
scarto 0 e dei 0 °C del pesce fresco. Rifiutato da un **vincolo sulla
colonna**, non da un controllo nella schermata: la modifica di un
ingrediente è una scrittura diretta, e sarebbe entrata da lì.

---

## 3. Due dettagli che si pagano solo se sbagliati

**Il controllo del sotto-soglia parte all'apertura della lista**, non da
un pulsante da ricordarsi di premere. Una lista che dice la verità solo a
chi sa che va aggiornata non è una lista.

**La quantità si corregge riga per riga, e si ricarica solo la riga
toccata.** Ricaricare tutto avrebbe buttato via le quantità che sta
ancora scrivendo sulle altre righe — è il difetto del 12/08 sulla posta,
quello che gli fece perdere due collegamenti in silenzio.

⚠️ **`create_ingredient` è stata cancellata e ricreata**, non affiancata:
un parametro in più fa una funzione **nuova**, e due sovrapposte rendono
ambigua ogni chiamata per nome (42725, a tempo di esecuzione, sulla
creazione di un ingrediente che oggi funziona). Stessa trappola di
`register_stock_delivery` il 12/08 e di `segnala_allarme` stamattina. E
**dopo un `drop` i permessi tornano quelli di partenza** — eseguibile da
chiunque abbia la chiave pubblica del sito — quindi è richiusa a mano e
la verifica lo controlla, insieme all'elenco degli anonimi.

**Lo stato `ordinata` è già ammesso**: oggi non lo scrive nessuno, lo
scriverà la Fase B. Il percorso di una riga (da comprare → ordinata →
acquistata) è una cosa sola, e spezzarlo avrebbe voluto dire toccare due
volte lo stesso vincolo.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| la soglia si scrive alla nascita dell'ingrediente | **provato** |
| soglia zero e soglia negativa | **rifiutate**, anche dalla modifica diretta |
| **un ingrediente senza soglia non entra mai in lista da solo** | **provato** |
| uno sotto soglia entra, con giacenza/soglia/fabbisogno veri | **provato** |
| arriva merce → i numeri si aggiornano da soli | **provato** |
| la riga dichiara «ora ce n'è abbastanza» | **provato** |
| ...e **non** viene cancellata dal sistema | **provato** |
| un secondo giro non duplica la riga | **provato** |
| stato `ordinata` ammesso, stato inventato rifiutato | **provato** |
| lo staff respinto sulla lista completa | **provato** |
| lo staff non può creare un ingrediente dopo il `drop` | **provato** |
| **una sola `create_ingredient` in produzione** | **verificato**: nessuna ambiguità |
| creazione **attraverso il corridoio** col parametro nuovo | **provato** (prova automatica) |
| elenco anonimi | **12**, controllato dentro la migrazione |
| prove automatiche | **42 verdi** (erano 36) |
| lint, build | puliti |
| **produzione** | **86 migrazioni** |
| `security definer` senza portiere | **14**, invariato |
| residui della verifica in produzione | **zero**, zero righe in lista |

---

## 5. Cosa NON è verificato, e lo dico chiaro

- **Nessun ingrediente ha una soglia**, e il sistema non gliene propone:
  gli 8 prodotti di collaudo sono a zero soglie. Finché Alessio non ne
  scrive almeno una, la parte automatica della lista resta ferma **per
  costruzione, non per guasto**.
- **Non si è ancora vista riempirsi da un consumo vero.** La catena
  completa — piatto servito → giacenza che scende → sotto soglia → riga
  in lista — richiede ricette e conti veri, e il Ricettario è vuoto. Le
  due metà sono provate separatamente, la giunzione no.
- **«In lista dal» è la data in cui la riga è nata**, cioè la prima volta
  che la lista è stata aperta dopo che il prodotto era sceso sotto
  soglia. Non è «da quando è sotto soglia» al minuto: per averlo servirebbe
  sorvegliare la giacenza in continuo, e non varrebbe il prezzo.
- **Una riga vecchia rimasta indietro non ha scadenza**: la lista non
  invecchia e non pulisce niente da sola. Voluto — è la sua lista.
- **La Fase B non esiste ancora**: il raggruppamento per fornitore in
  schermata c'è già, la bozza del messaggio e la registrazione
  dell'ordine no.
- **I dati di collaudo restano in produzione** e **`/prova-voce` è ancora
  lì**; il messaggio delle 10:00 dello scadenziario non l'ha ancora visto
  partire nessuno.
