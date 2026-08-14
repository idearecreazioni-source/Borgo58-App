# Consegna del 14/08/2026 (diciassettesima) — sconti e omaggi: come entrano, e con quale perché

**Commit della consegna: `366f41c`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `63c4bd3` | il saldo di cassa non dice più a metà: gli incassi di sala non sono lì |
| `c84298a` | un omaggio ha un perché — migrazione `20260814000012` |
| `366f41c` | `CLAUDE.md`: gli incassi che non ci sono e l'omaggio che ha un perché |

**Applicata in produzione**: `20260814000012`. **98 migrazioni**. Nessuna
funzione online reinstallata (nessun nome di operazione è cambiato).

Nata da una domanda di Alessio mentre lavoravamo alle comande: *«vorrei
definire in che modo entra nel sistema un conto omaggiato o scontato»*, e
poi *«vorrei definire le causali»*.

---

## 1. ⚠️ Una mia affermazione sbagliata, corretta nella stessa
conversazione

Guardando che `close_order_paid` e `close_order_as_discount_gift` **non
scrivono in `cash_movements`**, ho detto ad Alessio che era «un buco»,
paragonandolo al difetto delle fatture fornitori chiuso il 13/08.

**Non lo era.** La decisione era già stata presa il **04/08** ed è scritta
sul commento della tabella `orders`:

> *«Chiuso» qui NON registra un incasso in cassa — quello arriverà con
> l'integrazione RT (§3.2); oggi è solo lo stato operativo del tavolo.*

Gliel'ho riproposta come scelta fra tre strade e ha **confermato quella**,
più la seconda: un omaggio non è un movimento di soldi e non tocca la
prima nota.

**Va scritto perché è il tipo di errore che conta**: ho chiamato «buco»
una scelta documentata, e l'ho fatto dopo aver cercato nelle migrazioni
ma non nei commenti delle tabelle. La documentazione di quella decisione
era nel posto giusto — solo, non l'avevo letta.

---

## 2. Cosa mancava davvero: la schermata non lo diceva

Il saldo di Cassa mostra `fondo + incassi − uscite` ed **escludeva in
silenzio tutti gli incassi di sala**.

⚠️ Un numero che sembra completo e non lo è è la stessa forma dello scarto
a zero e dell'elenco allergeni vuoto: **nessuno lo legge come «manca
qualcosa», lo si legge come il cassetto.** Finché il registratore
telematico non c'è, quella riga è l'unica cosa che separa *«il cassetto è
così»* da *«il cassetto sembra così»*.

Ora, sotto il saldo: *«Gli incassi qui sono solo quelli che scrivi tu.
Chiudere un tavolo in Comande non ne crea uno: gli incassi di sala
arriveranno tutti insieme dal registratore telematico, quando ci sarà.»*

E in *Sconti e omaggi*: *«Un omaggio non tocca la prima nota: nessun euro
entra e nessuno esce. Quello che ti è costato davvero sono gli
ingredienti.»*

⚠️ **Coda dichiarata**: quando arriverà il registratore telematico **va
deciso chi comanda** sugli incassi, altrimenti entrano due volte. Scritta
in `CLAUDE.md` §6.

---

## 3. La causale diventa obbligatoria

Le quattro causali esistevano dal 02/08 — **Cortesia**, **Cliente
ricorrente**, **Recupero disservizio**, **Altro** — e Alessio le tiene
così, gestendole da *Cassa → Causali*. **Il gestionale non ne propone di
nuove**: sono dati suoi.

Quello che mancava è che **si potesse chiudere un tavolo in omaggio senza
dire perché**. Ora non si può più.

**Non è una formalità**: il budget degli omaggi della Proiezione (Blocco
3) si legge da qui. «Cortesia» è un investimento che decide lui,
«recupero disservizio» è un costo che dice che qualcosa in cucina non ha
funzionato. Senza causale sono lo stesso numero.

**Dove sta la garanzia**: `discounts_gifts.causale_id` è `not null`,
perché quella tabella si scrive da **due porte** — la chiusura del conto
in sala (funzione, corridoio) e il registro manuale in Cassa (categoria
A, direttamente dal browser). Un controllo nella sola funzione avrebbe
lasciato aperta la seconda. La funzione aggiunge la **frase leggibile**,
perché chi chiude un tavolo non deve leggere un codice Postgres.

### ⚠️ La trappola, trovata prima di romperla

**«Alla romana» non passava nessuna causale.** L'arrotondamento per
difetto si chiude come *sconto* (decisione del 09/08) e il client mandava
solo la nota «Alla romana: 2 × 12,00».

Reso obbligatorio il campo, **quel gesto — il più frequente dei tre — si
sarebbe rotto al primo tentativo, in sala, con un cliente che aspetta.**

Ora la schermata chiede la causale anche lì, e **solo quando una cortesia
c'è davvero**: se la cifra è esatta è un pagamento normale e non nasce
nessuno sconto.

**Regola generale**: prima di rendere obbligatorio un campo, cercare
**tutti** i chiamanti che lo lasciavano vuoto.

### ⚠️ Il secondo difetto, trovato da una prova scritta mesi fa

Avevo messo il controllo della causale **prima** di cercare il conto:
così un conto inesistente rispondeva *«scegli perché»* — una diagnosi che
manda a cercare nel posto sbagliato.

L'ha preso `permessi.test.js`, scritta per verificare tutt'altro (che il
corridoio arrivi fino al database e restituisca il *suo* messaggio).
L'ordine giusto è: prima dire se la cosa di cui si parla esiste, poi se i
dati sono completi.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata tre volte**: idempotente |
| omaggio **senza** causale | **rifiutato**, con frase leggibile |
| ...e **il conto resta aperto** | **provato** (un rifiuto che chiude il tavolo sarebbe peggio del difetto) |
| causale **inventata o spenta** | **rifiutata** |
| con la causale giusta: sconto scritto, conto omaggiato | **provato** |
| **la porta diretta dal browser** (insert in tabella) | **rifiutata dal `not null`** |
| le quattro causali di Alessio sono intatte | **provato** |
| sanatoria delle righe senza causale | **0 da sistemare** (in produzione non ce n'erano) |
| prove automatiche | **55 verdi** |
| lint, build | puliti |
| **produzione** | **98 migrazioni** |
| elenco anonimi | **12**, invariato |
| dati di prova lasciati | **zero** |

---

## 5. Cosa NON è verificato, e lo dico chiaro

- **Nessuno ha ancora chiuso un conto in sconto o omaggio** nel
  gestionale vero: `discounts_gifts` è vuota. Tutto quello che c'è è
  provato dentro la migrazione.
- ⚠️ **L'«alla romana» con la causale nuova non è mai stato fatto da una
  mano vera.** È il gesto che ho appena reso più lungo, ed è quello che si
  usa di più: **è la prova che vale più di tutte le altre** di questa
  consegna.
- **Il costo degli ingredienti di un omaggio sarà zero** finché il
  Ricettario è vuoto — e la schermata lo dichiara già come «parziale»,
  contando le righe non valorizzate. Ma finché non c'è una ricetta vera,
  quel numero non dice niente.
- ⚠️ **In produzione c'è ancora 1 conto aperto** su «T7 · T8 · T9», vuoto:
  è quello del collaudo. Il pulsante per toglierlo è stato pubblicato con
  la consegna precedente, ma non è ancora stato premuto.
- **Il trattamento fiscale degli omaggi sistematici (TD27) resta di
  Laura**, come già scritto sulla schermata: non lo decide il gestionale.
