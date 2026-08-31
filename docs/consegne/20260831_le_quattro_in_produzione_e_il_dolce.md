# Le quattro in produzione, e «Dolce e da meditazione» che cambia mondo

**31/08/2026, primo pomeriggio.** Riepilogo per il validatore.

* **HEAD dichiarato**: `79f503a577e1697c0bf4513ef0a028168a945a74` — il commit che sta sotto questo file.
* **Prove**: 657 pure verdi (58 file), lint pulito, build pulita.

### La migrazione che entra, per intero

* `20260831000010` — «Dolce e da meditazione» passa dal mondo Vini al mondo
  Liquori e distillati

---

## Cosa abbiamo rovesciato

**Niente.** Alessio corregge una **mia proposta** che non era mai stata una
sua decisione: le categorie di Vini e Liquori erano nate stamattina
dichiarate come *proposta da correggere leggendo*, sul precedente del 29/08
sui materiali (*«ha chiesto esplicitamente che le proponga io e che lui le
corregga leggendo»*). Le ha guardate e ne ha spostata una. È il meccanismo
che ha funzionato, non una decisione ribaltata.

---

## 1 · Le quattro migrazioni sono in produzione

Il freno del backup **ha lasciato passare**: ha visto la copia rimessa sul
Desktop e l'ha dichiarata — *«copia di sicurezza: 2026-08-31_1242 (1.6 ore
fa)»*. Applicate 4 su 4.

**Letto dalla produzione dopo, non dedotto:**

| | |
|---|---|
| migrazioni | **365** |
| ultima | **`20260831000009`** |
| mondi del magazzino | **7** |
| categorie per mondo | Alimentari **14** · Vini **5** · Bevande **1** · Liquori e distillati **3** · Materiale di consumo **4** · Pulizia e sanificazione **1** · Varie ed eventuali **1** |

⚠️ **Coincide con la misura del validatore delle 14:08** (14/5/1/3/4/1/1),
che era stata presa *prima* delle quattro: quelle quattro non toccavano le
categorie, e infatti il conto non è cambiato.

---

## 2 · «Dolce e da meditazione» passa ai liquori

Risultato voluto da Alessio:

```
Vini                  →  Rosso · Bianco · Rosato · Bollicine
Liquori e distillati  →  Amari · Distillati · Liquori dolci ·
                         Dolce e da meditazione
```

⚠️ **SI SPOSTA, NON SI DISTRUGGE** (regola del 27/08). Cambiano **mondo e
ordine**, non il **codice**: il codice è l'identificativo con cui i prodotti
puntano alla categoria, e cambiarlo vorrebbe dire cancellarla e ricrearne una
nuova — cioè orfanare tutto quello che la porta.

⚠️ **Misurato prima di scrivere**: la portano **zero prodotti**. Quindi lo
spostamento non tocca niente di scritto — ma la forma resta quella giusta
anche per il giorno in cui ce ne saranno, che è precisamente il motivo per
cui quella regola esiste.

🔴 **E IL CODICE RESTA `vino_dolce` DENTRO IL MONDO DEI LIQUORI**, che a
leggerlo fra sei mesi sembra un errore e non lo è: *un codice è un
identificativo, non una descrizione*. Sta scritto dentro la migrazione perché
nessuno lo «raddrizzi» credendo di sistemare qualcosa.

⚠️ **L'ordine lo mette in fondo ai liquori** (430, dopo il 420 di «Liquori
dolci»): è l'ordine in cui Alessio li ha elencati, e in questo progetto
l'ordine di un elenco è un suo dato.

✅ **Provata con due rotture su controlli diversi**, che danno due errori
diversi: rimessa fra i vini → *«sta in "vini", doveva passare ai liquori»*;
ordine cambiato → *«L'ordine è 999, doveva essere 430»*. Poi rimesso tutto e
riverificato.

🔴 **UN LIMITE TROVATO ROMPENDO, e dichiarato invece che corretto**: il terzo
controllo — *nessun prodotto orfano* — **non si può far fallire**, perché la
chiave esterna lo impedisce già a monte (un `update` verso una categoria
inesistente viene respinto dal database). È un **doppione del vincolo**, e
resta come rete di riserva per il giorno in cui quella chiave venisse tolta.
⚠️ La migrazione **non è stata riscritta** per aggiungere la nota: si
dichiara, non si corregge un file già applicato (regola del 23/08).

---

## 🔴 Quello che NON è in produzione, e perché

**Lo spostamento è applicato al progetto di prova (366 migrazioni) e NON al
gestionale vero (365).** `npm run migra` si è rifiutato due volte, e tutte e
due le volte aveva ragione:

1. **manca il riepilogo** — questo file lo chiude;
2. **la migrazione non è su GitHub** — *la produzione non deve mai correre
   avanti al repository: se il commit venisse riscritto, il database vero
   sarebbe l'unico posto dove quella migrazione è mai esistita*.

⚠️ Quindi **in produzione Vini ha ancora 5 categorie e Liquori 3**. I due
conti chiesti — Vini 4, Liquori 4 — sono veri **sulla prova**, e diventano
veri in produzione dopo il push e l'applicazione.

---

## RILETTURA

### Schermate aperte e guardate
**Nessuna, ed è onesto dirlo**: questa consegna non tocca nessuna schermata.
Sposta una riga di catalogo e applica migrazioni già provate. Le sette porte
del Magazzino le avevo aperte e premute stamattina; questo spostamento
cambierà solo **quale nome sta in quale porta**, e va guardato dopo che
entrerà in produzione.

### Cosa ho contato senza leggerlo
Niente: i conteggi dei mondi e delle categorie sono letti dal database vero
con una query, e riportati come sono usciti.

### Mie affermazioni diventate false mentre lavoravo
**Una.** Ho scritto nella migrazione, in buona fede, che i tre controlli
della verifica sono tre controlli. Rompendoli ho misurato che **il terzo non
è raggiungibile**: la chiave esterna scatta prima. Dichiarato qui e non
nascosto.

### Blocchi non aperti
Restano quelli di stanotte, mai aperti: **etichetta «investimento»**,
**chiusura dell'anno fiscale**, **il pacchetto per la commercialista**, la
**coda di `RICHIESTE.md`**.

### Conteggi che sono pavimenti
Nessuno, qui: sono conteggi esatti su una tabella di catalogo con otto righe.
