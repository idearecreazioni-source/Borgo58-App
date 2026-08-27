# Le nove schermate provate a mano, e il vocabolario che non filtrava — 27/08/2026

**HEAD dichiarato**: `ae30000` — «Un valore fuori vocabolario resta fuori, e
la verifica lo prende nei due versi». Questo riepilogo è l'ultimo commit
della consegna e sta sopra di lui.

**(vero)** = misurato sul gestionale di Alessio · **(prova)** = sul progetto
di prova.

---

## 1. LA FINESTRA SULLA 5199 — chiusa, e la causa NON era il comando

**Cosa c'era** (vero, misurato): sulla porta 5199 girava
`npx vite --port 5199` — **non** `npm run dev:collaudo`. Lanciato a mano,
`npx vite` legge `.env.local`, che punta al **gestionale vero**.

**Chiusa.** Riaperta con:

```bash
npm run dev:collaudo
```

**A quale database punta adesso** (prova, misurato leggendo quello che il
server serve al browser, non quello che dichiara):

```
VITE_SUPABASE_URL": "https://bnwqgpuyzmzujxfbtyvs.supabase.co"
```

cioè **il progetto di prova**. `oudjuqbqszisdtwzbxdo` sarebbe il vero.

### Il comando è sano — la causa è un'altra, e va detta

`npm run dev:collaudo` esegue `node scripts/dev-prova.mjs -- --port 5199`,
che legge `.env.test` e **si rifiuta di partire** se manca. Non ha mai potuto
aprire la produzione.

🔴 **La causa vera**: **qualunque** `npx vite --port <numero>` o
`npm run dev -- --port <numero>` apre il gestionale **vero** su una porta
qualsiasi, identico a vedersi. La 5199 è «la porta del collaudo» per
convenzione, non per costruzione, e chi la occupa a mano la occupa col vero.

### Il segno c'era, e non è bastato

**Misurato** (prova): il pallino di `SegnaleDatabase` funziona — dice
«DATABASE DI PROVA», colore terracotta, e nel suo testo nascosto porta pure
il riferimento del progetto. Lato **4,23 mm**, in basso a destra.

⚠️ Sulla finestra sbagliata avrebbe detto «DATI VERI» in scuro. **Chi l'ha
aperta non l'ha guardato.** Un pallino da 4 mm senza parole, in basso a
destra, è un segno che protegge chi già sospetta.

⚠️ È **fuori dal mio mandato** e non l'ho riparato di nascosto: la cura
vorrebbe una decisione di Alessio, ed è la **domanda 1**.

---

## 2. LE NOVE SCHERMATE, UNA PER UNA

Apparecchiata una filza di nove righe in sospeso sul progetto di prova, con
dati **plausibili** e non segnaposto. Per ognuna: cosa ho premuto, cosa è
successo.

| # | tipo | cosa ho premuto | cosa è successo (prova) |
|---|---|---|---|
| 1 | giacenza | **«È questo»** | *«Pomodoro ciliegino: ne risultavano 2 kg, ne hai 4,5. Ce ne sono in più 2,5.»* — la riga si era aperta da sola col **4,5** già scritto |
| 2 | temperatura | **«Conferma»** | registrata, **3,5 °C** già nel campo |
| 3 | promemoria | **«Crea task»** | rimandato in Agenda, il promemoria **c'è** — titolo, descrizione e data (+3 giorni) precompilati |
| 4 | pulizia | **«Conferma»** | registrata su **«BASE-Sanificazione piani di lavoro»**, nota già scritta |
| 5 | lista spesa | **«+ Aggiungi»** | «carta forno», 2 pz, **come nome libero** (decisione del 27/08 rispettata) |
| 6 | merce buttata | **«Conferma»** | **1,2 kg** di Patata novella, motivo **spreco** |
| 7 | carico merce | **«Registra carico»** | rimandato in Magazzino — **cinque campi** precompilati: prodotto, fornitore, 12 kg, scadenza, costo 1,85 |
| 8 | prodotto nuovo | **«Crea ingrediente»** | 🔴 **prima ha rifiutato** (vedi sotto), poi creato |
| 9 | ricetta | **«Crea ricetta»** | creata, aperta la sua scheda |

**Chiesto al database dopo** (prova), non letto sullo schermo: **nove righe
su nove** in stato `fatta_a_mano`, ognuna con la sua ora. Effetti veri
contati uno per uno: giacenza pomodoro **16,5** (4,5 allineati + 12
caricati), 1 temperatura, 1 pulizia, 1 riga di lista, 1 scarico, 1 partita, 1
prodotto, 1 ricetta. **Nessun doppione.**

### 🔴 Il caso 8 ha provato la cosa che il mandato chiedeva di provare

Il modulo del prodotto nuovo pretende il **prezzo**, che dalla voce non
arriva mai (il prompt non lo chiede, e via automatica il prezzo nasce a zero
*dichiarato*). Il salvataggio è stato **rifiutato dal browser**, e la riga in
sospeso è **restata in sospeso**.

È esattamente il collaudo chiesto: *apri e non salvare → la riga non si
chiude*. Successo da solo, senza costruirlo.

⚠️ **È una differenza fra le due strade, ed è nel verso buono**: chi va a
mano è costretto a mettere il prezzo vero invece dello zero.

---

## 3. 🔴 IL DIFETTO TROVATO APRENDO LA SCHERMATA

Sul promemoria (caso 3) la categoria arrivava come **`fisco`**, che fra le
sei ammesse **non c'è**:

- a schermo il menu mostrava **`fisco_scadenze`** — la **prima** della lista,
  perché un `<select>` con un valore che non ha mostra la prima;
- nel database è finito **`altro`**.

**Nessuno dei due era il valore passato, e nessuno dei due l'ha scelto una
persona.** Nessun errore, da nessuna parte.

⚠️ **Quel caso preciso l'avevo costruito io** col dato di prova: il prompt
del promemoria non chiede la categoria. Ma **per altri campi la chiede
eccome** — la categoria di una ricetta, categoria e unità di un prodotto
nuovo, l'unità di una riga di spesa, verso e mezzo di un movimento — e un
modello che risponde fuori elenco è la cosa più normale del mondo.

### Perché è più grave sulla strada pensata per essere più sicura

| | valore storto |
|---|---|
| via **automatica** | **fa fallire** l'azione contro il vincolo → rumoroso, la riga resta in attesa col suo errore |
| via **a mano** (prima di oggi) | **silenzioso**: modulo pieno di un valore plausibile che nessuno ha scelto |

🔴 *La strada che esiste per far passare le cose dagli occhi di Alessio
sarebbe stata la più pericolosa delle due.*

### La cura riusa la rete che c'era

`valore_del_vocabolario()` interroga `vocabolari_chiusi()` — che si costruisce
dai cataloghi e conosce **sia gli enum sia i vincoli `check`** — e restituisce
**vuoto** se il valore non appartiene. Il campo si apre col predefinito del
modulo, che è un valore scelto apertamente.

⚠️ **Sette dei nove campi interessati sono enum, DUE sono testo con vincolo**
(`cash_movements.mezzo`, `stock_consumptions.reason`, più `tasks.category`).
Un controllo sui soli enum avrebbe lasciato scoperto **proprio il campo su
cui il difetto è stato visto**.

### 🔴 E la verifica non vedeva il verso opposto

Il filtro può sbagliare in due modi: troppo largo (passa lo storto) o troppo
stretto (**svuota anche i campi buoni**). La prima verifica prendeva solo il
primo: messo un filtro che restituisce sempre vuoto, è passata **VERDE**.

**La ragione, misurata** (prova):

```
null <> 'primo'                 →  NULL   (e un `if` su NULL non scatta)
null is distinct from 'primo'   →  true
```

🔴 È la trappola del 26/08 — *«in SQL il terzo stato sparisce dai
confronti»* — ricomparsa **lo stesso giorno in cui è stata riletta**, e in un
posto nuovo: non in un guardiano sui dati, ma **dentro il blocco di verifica
di una migrazione**, dove tace proprio quando il codice si rompe.

La `…016` rifà il controllo con `is distinct from`. **Provata su tutte e due
le rotture**: ora diventa rossa con due messaggi diversi.

⚠️ **E l'ha trovata la SECONDA rottura, non la prima.** *Una rottura sola non
dice che una verifica discrimina: dice che discrimina in quel verso.*

---

## Cosa abbiamo rovesciato

**Niente.** Voci di `docs/DECISIONI.md` toccate: **due aggiunte**, entrambe
sue di oggi — le nove schermate provate in due, e l'ordine nuovo dei tre
pezzi che restano (prima la pagina che si ricarica, poi il pollice, MEMO per
ultimo).

Una decisione in vigore è stata **rispettata e verificata a schermo**: la
lista della spesa ha ricevuto «carta forno» come **nome libero**, senza
toccare il magazzino (27/08).

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: tutto è **letto dal DOM**.
- **Niente da un telefono vero.**
- **Non ho guardato la finestra sbagliata prima di chiuderla**: che mostrasse
  «DATI VERI» è **dedotto** dal codice del pallino, non visto. Quello che ho
  misurato è il pallino sulla finestra **giusta**.

**Cosa ho contato senza leggerlo**
- Le **438 prove sull'app** e le **505 pure**: ho letto il totale.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- 🔴 *«Il giro finale è rosso su 41 file»*: **falso** — avevo due giri di
  prove in parallelo sullo stesso database di prova. Da solo: **438 verdi**.
- 🔴 *«La prova nuova è verde»*: **falso** — falliva **una volta su sei**,
  perché cercava «30» dentro un indirizzo che contiene un identificativo
  casuale. Corretta e provata **otto giri di fila**.
- *«Il segno del database è assente sulla pagina di accesso»*: **falso** — il
  mio setaccio cercava elementi **con testo**, e il pallino non ne ha.

**Quali blocchi non ho aperto**
- **La pagina che si ricarica** (che Alessio ha messo per primo), **il
  pollice**, **MEMO**. Nessuno dei tre toccato: questo giro era la finestra e
  le nove schermate.

**Prove**
- app: **62 file, 438 prove** (uscita 0) · pure: **44 file, 505 prove**
- lint zero avvisi, build verde

**Migrazioni**
- repository **288**, produzione **270**, prova **288**.
- **Diciotto in attesa del push** (le 16 di prima più `…015` e `…016`).

**Dati di prova**: **8 cose tolte**, zero residui contati uno per uno.
⚠️ **Resta l'allineamento della giacenza** (pomodoro ciliegino a 4,5 invece
di 2): è una correzione su un dato preesistente, e disfarla vorrebbe dire
scrivere un secondo allineamento — cioè un'altra riga finta. Restano anche le
**lapidi** delle tabelle tracciate, che nessuno può ripulire dall'app.

**Trappole nuove** (§8 di `CLAUDE.md`): quattro — il valore fuori vocabolario
che diventa la prima opzione; `<>` contro un valore vuoto dentro una
verifica; la prova che cerca un valore breve in un identificativo casuale;
le prove in parallelo sullo stesso database.
