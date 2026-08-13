# Consegna del 14/08/2026 (seconda) — la coda della Fase B

**Commit della consegna: `01f0da3`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `fde41d0` | il fornitore del prodotto arriva fino alla riga — `20260814000002` |
| `b2ad2aa` | dire di chi è una dicitura, dopo che la fattura è già passata |
| `e9c5233` | nella riga di una versione c'erano due menù indistinguibili |
| `01f0da3` | stato della produzione, e le diciture senza padrone a verbale |

**Applicata in produzione**: `20260814000002`. **88 migrazioni**. Nessuna
funzione online reinstallata.

⚠️ **Nota di processo, dichiarata**: i primi tre commit sono stati
**pushati prima di questo riepilogo**, contro la regola di `CLAUDE.md`
§2 («nessun push senza il riepilogo corrispondente»). È successo perché
si stava correggendo dal vivo un difetto che bloccava Alessio, un
tentativo per volta. Il riepilogo arriva ora e li copre tutti e tre;
l'hash dichiarato è quello che verrà pushato adesso.

---

## 1. La domanda che conteneva mezza diagnosi

Dieci minuti dopo aver acceso la Fase B:

> *«Ho aggiunto il fornitore a mandorle e melanzane ma non genera
> messaggi. Lo fa perché ho aggiunto il fornitore dopo che l'articolo è
> entrato nella lista della spesa?»*

**No — e la risposta vera è peggiore della sua ipotesi.** Il fornitore
l'aveva messo **sulla scheda del prodotto** (Augeri sulle melanzane,
Mililli sulle mandorle), mentre la riga della lista ne teneva **uno suo**,
rimasto vuoto.

⚠️ **Nessuno dei due posti sbagliava.** La lista mostrava le righe, la
schermata degli ordini le metteva nel riquadro «senza fornitore», e tutti
e due dicevano il vero. È la forma di difetto che questo progetto cerca
apposta — **due posti dove vive la stessa informazione** — con
un'aggravante: qui non si contraddicevano, **tacevano**. Un dato che si
contraddice si nota; uno che tace somiglia a «non c'è niente da fare».

**Correzione in tre punti, e nessuno da solo basta:**

1. una riga **eredita** il fornitore abituale del prodotto, da entrambe le
   porte (controllo delle scorte e aggiunta a mano). Una scelta esplicita
   vince sempre sull'eredità;
2. le righe **già in lista** sistemate una volta, dentro la migrazione —
   altrimenti la correzione varrebbe solo per il futuro e le sue due
   righe resterebbero mute. ⚠️ Perimetro stretto e dichiarato, perché
   tocca dati veri: solo `da_comprare`, solo dove il fornitore sulla riga
   è vuoto, solo copiando ciò che ha scritto **lui** sulla scheda. Mai
   sovrascrivere una scelta già fatta;
3. il fornitore si **cambia sulla riga**, dalla lista della spesa:
   ereditarlo senza poterlo correggere avrebbe spostato soltanto il punto
   in cui ci si blocca — ed è dove si era bloccato lui.

**Ereditare non è scegliere in silenzio**: il fornitore l'ha scritto lui
sulla scheda, la riga lo mostra, e il messaggio si rilegge prima di
partire.

---

## 2. Trovato strada facendo, e non c'entrava col suo problema

Il controllo dei doppioni di `add_below_threshold_items` guardava solo le
righe **da comprare**. Una riga già **ordinata** non lo era, quindi al
giro successivo lo stesso prodotto sarebbe rientrato in lista — e si
sarebbe **ordinato due volte** ciò che era già stato chiesto e non era
ancora arrivato.

Nessuno se ne sarebbe accorto prima della consegna doppia: la lista
avrebbe avuto ragione (la giacenza è ancora bassa) e l'ordine anche.
Corretto e provato nella stessa migrazione.

---

## 3. Il secondo pezzo del problema, che la migrazione non copriva

Guardando il risultato in produzione col connettore: **tutte e 12 le
diciture di `articoli_fornitore` hanno il fornitore vuoto.**

⚠️ **Non è un difetto del carico da fattura.** Il codice il fornitore lo
scrive, e la schermata di conferma lo chiede: le fatture di collaudo sono
entrate il 12-13/08, quando in anagrafica non c'era **nessun** fornitore
— Mililli e Augeri li ha creati il 13/08 alle 22:28.

**Ma la conseguenza è il cuore della Fase B**: le bozze d'ordine
funzionano e usano il **nome interno**, marcando ogni riga «non so come lo
chiama lui». Cioè la promessa della fase — *l'ordine nella lingua del
fornitore* — resta inerte sui dati veri **senza che niente si rompa**.

**Nessun collegamento indovinato dal sistema.** Si potrebbe risalire al
fornitore dal documento di origine, ma sbagliare vorrebbe dire mandare a
un fornitore le parole di un altro. Quindi non un backfill: il **posto
per dirlo** — un menù «chi la vende?» nella tabella delle versioni, sulla
scheda dell'ingrediente, dove quelle diciture sono già elencate. Il caso
del doppione (stessa dicitura già assegnata a quel fornitore) torna con
una frase leggibile invece del codice del database.

---

## 4. «Il menù non mi propone nessun fornitore»

Segnalato subito dopo. **Il codice nuovo era online davvero** (verificato
leggendo il bundle pubblicato: contiene la stringa nuova), i due fornitori
esistono, sono attivi e appartengono alla S.r.l.s. — l'elenco che quel
menù legge non poteva essere vuoto. Confermato da lui: nella scheda del
prodotto il campo Fornitore propone Mililli e Augeri.

Quello che si apriva vuoto era **l'altro menù della stessa riga**: quello
per dichiarare che due diciture sono lo stesso prodotto, che con una
versione sola non ha niente da proporre — e sta a due centimetri
dall'altro senza un'etichetta che li distingua.

**Un menù che si apre vuoto sembra un menù rotto.** Nascosto quando le
versioni sono meno di due, e la colonna si chiama «Chi la vende» invece
di «Fornitore», così il bersaglio è scritto sopra.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| una riga nata sotto soglia eredita il fornitore del prodotto | **provato** |
| un'aggiunta a mano lo eredita | **provato** |
| una scelta esplicita **non** viene sovrascritta dall'eredità | **provato** |
| la sistemazione non tocca chi ha già un fornitore suo | **provato** |
| **un prodotto già ordinato non rientra in lista** | **provato** |
| un secondo giro non duplica la riga | **provato** |
| prove automatiche | **46 verdi** |
| lint, build | puliti |
| **produzione** | **88 migrazioni** |
| **le due righe vere hanno ritrovato il fornitore** | **2 su 2**, letto dal connettore |
| elenco anonimi · `security definer` senza portiere | **12** · **14**, invariati |
| residui della verifica in produzione | **zero** |
| il codice nuovo è davvero pubblicato | **verificato sul bundle** |

---

## 6. Cosa NON è verificato, e lo dico chiaro

- **Nessun ordine è ancora partito.** Le due righe adesso si raggruppano
  sotto Augeri e Mililli, ma il messaggio non è stato ancora generato né
  aperto in WhatsApp da nessuno.
- **Le 12 diciture sono ancora senza fornitore**: finché Alessio non le
  assegna, ogni riga della bozza sarà marcata «non so come lo chiama
  lui». Il criterio di accettazione n. 2 del mandato — *le diciture nel
  testo sono quelle del fornitore, verificate contro `articoli_fornitore`*
  — **resta aperto**.
- **Il menù «chi la vende?» non è mai stato usato davvero**: è stato
  pubblicato pochi minuti fa.
- **Nessuna prova automatica copre l'eredità del fornitore lato
  applicazione**: le verifiche sono quelle dentro la migrazione. La suite
  resta a 46.
- **I dati di collaudo restano in produzione**, **`/prova-voce` è ancora
  lì**, e il messaggio delle 10:00 dello scadenziario non l'ha ancora
  visto partire nessuno.
