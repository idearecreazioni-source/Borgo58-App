# Consegna del 12/08/2026 — il carico da fattura

**Commit della consegna: `b89f288`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Migrazione `20260812000011` già applicata in produzione** (da me, col
comando). **`posta-leggi` già installata** in produzione — anche questo da
me, ed è la prima volta: vedi §5.

**Non ancora provato dal vivo**: nessuna fattura vera è passata di qui.

---

## 1. Cosa cambia per Alessio

Fino a stamattina, quando arrivava una fattura, l'assistente proponeva
`da_fare_a_mano` con dentro *«carica il magazzino»* e *«registra i lotti in
HACCP»*: una lista di compiti scritta in Agenda. Onesta — e da fare a mano
venti volte al mese.

Ora propone **`carico_magazzino`**. Confermando, per ogni riga della
fattura nasce un lotto in magazzino e la riga nel registro HACCP di
ricevimento merci.

---

## 2. Perché è una sola funzione, e qui non è una formalità

Un carico sono N lotti più N righe di registro. A metà strada si
otterrebbe la cosa peggiore delle due:

- merce in giacenza che **non risulta ricevuta**, oppure
- un registro HACCP che dichiara un controllo su roba che il magazzino non
  ha mai visto.

**Il registro HACCP è un documento esibibile a un'ispezione.** Una sua riga
scritta a metà non è un fastidio operativo: è una dichiarazione falsa.
Regola B4 applicata dove conta di più.

---

## 3. Le quattro decisioni

**1. Una riga senza ingrediente non si carica, e si dice.** L'assistente
riceve l'elenco degli ingredienti del Ricettario e propone l'abbinamento,
ma «Pomodoro pelato 3kg» e `Pomodori pelati` restano due stringhe diverse.
La funzione restituisce `lotti / haccp / saltate` e la schermata segna «da
abbinare» **prima** della conferma, non dopo. Creare un ingrediente nuovo a
ogni nome diverso riempirebbe il Ricettario di doppioni — e i doppioni in
magazzino sono giacenze sbagliate per sempre.

L'elenco degli ingredienti viene passato al modello **solo quando c'è un
documento vero da leggere**: su una pubblicità sarebbero token buttati a
ogni giro, per sempre.

**2. Una riga per prodotto nel registro HACCP, non una per consegna.** Un
registro che dice «spesa Mililli, 4 °C» non serve a un'ispezione: serve
sapere *cosa* è arrivato. La temperatura invece è una sola — è quella del
furgone, misurata una volta.

**3. Il numero di lotto del fornitore si conserva.**
`stock_lots.supplier_batch_number` esiste dal primo giorno e non l'aveva
mai riempito nessuno. È il dato che serve a rintracciare la merce se un
lotto viene richiamato: senza, un richiamo obbliga a buttare tutto invece
di una cassa.

Per aggiungerlo, `register_stock_delivery` — che resta **l'unico punto di
scrittura di `stock_lots`** — è stata *ricreata*, non solo sostituita: in
Postgres un parametro in più è una funzione nuova, e due sovrapposte
renderebbero ambigua ogni chiamata per nome (`42725`, a runtime, sul carico
manuale che oggi funziona). Semantica e permessi identici: lo staff
registra una consegna, il costo solo il titolare.

**4. La temperatura non passa da `numeroValido`.** Quella funzione tratta
lo zero come «niente», perché un importo di zero euro è quasi sempre un
campo non compilato. **0 °C è la temperatura del pesce fresco**, e −18 lo è
altrettanto. Un dato HACCP azzerato in silenzio è esattamente ciò che un
registro non deve fare.

---

## 4. La correzione promessa stamattina

Per gli allegati che si aprono da soli (`.odt`, `.docx`) si conserva ora il
**testo esatto** invece del riassunto del modello. Ce l'abbiamo già in
mano, gratis, e non lo usavamo.

Il motivo non è la completezza in astratto: un riassunto risponde bene a
«quanto pago d'affitto» e male a «chi paga le manutenzioni straordinarie»,
perché quella clausola può non esserci finita. **E nessuno se ne
accorgerebbe**, perché la risposta sarebbe un «non risulta» credibile.

---

## 5. Nota di processo — anche le funzioni online le installo io

Seconda modifica al Contratto §8 nella stessa giornata, e per la stessa
ragione della prima: l'installazione dal pannello si è rotta **tre volte su
quattro** (paste troncato a metà, con un errore che parla di parentesi).
La differenza rispetto alle chiavi che erano già sulla macchina — controllo
dell'**account**, non solo dei dati — gli è stata posta dentro la scelta.

`npm run funzione <nome> -- --conferma`, con gli stessi vincoli di
`npm run migra`: solo file committati, niente si muove senza `--conferma`.
In più un vincolo suo: **quali funzioni vanno installate senza verifica del
token vive nel file** (`SENZA_TOKEN`), non in un flag da ricordare. Oggi ce
n'è una sola, `posta-in-arrivo`, che la chiama un servizio di posta:
installarla col flag sbagliato la renderebbe irraggiungibile e **la posta
smetterebbe di arrivare in silenzio**; installare le altre con quel flag
spalancherebbe una porta.

**Due cose imparate pagandole, ora in `CLAUDE.md` §8:**

1. **Un access token Supabase non è copiabile a mano dal pannello.** Dopo
   la generazione la pagina passa all'elenco, dove è già mascherato. Ciò
   che si copia «da dove si vede» è lungo 108 caratteri invece di 44 e
   viene rifiutato dal CLI e dall'API. Si risolve con `npx supabase login`:
   il browser autorizza, la chiave non la vede e non la incolla nessuno —
   e non finisce in nessun file di progetto. *Corollario diagnostico:
   quando una chiave viene rifiutata, misurarne lunghezza e alfabeto prima
   di dare la colpa ai permessi.*
2. **Un deploy può superare i due minuti e stampa `WARNING: Docker is not
   running` anche quando riesce.** Un timeout del terminale non è un deploy
   fallito: si controlla con `functions list`, dove `version` si incrementa
   a ogni installazione riuscita.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| progetto di prova | **applicata due volte**: idempotente |
| verifica dentro la migrazione, dal ruolo vero del titolare | 3 righe di cui una non abbinata → **2 lotti, 2 righe HACCP, 1 saltata e dichiarata** |
| costo, scadenza e numero di lotto conservati | **provato** riga per riga |
| doppio tocco | **innocuo**: `gia_fatta`, e i lotti restano 2 |
| carico senza nemmeno una riga valida | **rifiutato**, non passato in silenzio |
| la mail si archivia da sé | **provato** |
| pulizia della prova | **verificata**: zero lotti, ingredienti, fornitori residui |
| prove automatiche | **29 verdi** |
| **produzione — migrazione** | **applicata**: 65 migrazioni, una sola `register_stock_delivery` con la firma nuova, zero residui |
| **produzione — `posta-leggi`** | **installata**: `version 10`, e risponde `401 Chiamante non riconosciuto` a una chiamata senza firma (cioè è partita, non è andata in errore di avvio) |
| lint, build | puliti |

**Non verificato, e dichiarato**: nessuna fattura vera è mai passata di
qui. Non so se il modello abbinerà bene le righe ai suoi ingredienti,
perché non l'ho mai visto farlo su un documento vero — e con un solo
fornitore reale in anagrafica non ho un campione onesto.

⚠️ **La prova dal vivo lascerà dietro di sé lotti di magazzino e righe di
registro HACCP veri.** Vanno cancellati subito dopo (§5 punto 8): un
registro HACCP con dentro una consegna mai avvenuta è peggio di un
registro vuoto. Detto ad Alessio prima, non dopo.
