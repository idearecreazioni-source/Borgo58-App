# Le tabelle sul telefono — la misura e l'elenco da spuntare

**21/08/2026** · nato dal **settimo difetto** trovato dalle mani di Alessio:
in Magazzino, dal suo iPhone, il titolo è tagliato a metà parola, la fila dei
pulsanti scorre di lato e la tabella degli ingredienti esce a destra.

> ⚠️ **Questo documento non è un lavoro da fare: è una misura e una domanda.**
> Non si correggono 31 schermate, né stanotte né tutte insieme.

---

## 1 · La misura, rifatta

Il validatore aveva contato **32 schermate con una tabella, 1 sola con la
variante a blocchetti, 9 senza nemmeno lo scorrimento**. Rimisurato leggendo
i file: i primi due numeri tornano, **il terzo no — sono 15, non 9**.

| | quante |
|---|---|
| schermate con una tabella | **32** |
| con i **blocchetti** per il telefono (la forma giusta) | **1** — solo `ReservationsList` |
| con il solo **scorrimento laterale** | **16** |
| **senza nemmeno quello** | **15** |

⚠️ **E due dei 15 non c'entrano**: `StampaAdempimenti` e `ManualeCompleto`
sono fogli **da stampare**, dove la larghezza dello schermo non è il vincolo.
I casi veri sono quindi **13**.

⚠️ **Magazzino NON è fra i 15**: la sua tabella lo scorrimento ce l'ha. Vuol
dire che *lo scorrimento laterale non basta* — è la cosa che la mano di
Alessio ha misurato e che nessun conteggio avrebbe detto.

---

## 2 · Cosa NON è in discussione

**La forma giusta esiste già e non se ne inventa una seconda**: blocchetti sul
telefono, tabella sul computer, **coi campi in un posto solo**
(`src/lib/calcoli/prenotazioni.js`, giro D3 del 18/08). Due elenchi di
colonne divergono in silenzio, e a restare indietro sarebbe il telefono.

---

## 3 · La domanda per Alessio — l'elenco da spuntare

**La risposta la dà lui, non io.** Per ognuna: *questa la guardo dal telefono,
o solo da seduto al computer?*

### Quelle che secondo me userà dal telefono — da confermare

| schermata | oggi | quando la si usa |
|---|---|---|
| **Magazzino** (elenco ingredienti) | scorre | in piedi davanti alla dispensa |
| **Allineamento magazzino** | non scorre | contando la merce, col telefono in mano |
| **Temperature HACCP** | non scorre | a giro fra frigo e freezer |
| **Pulizia e sanificazione** | non scorre | durante il servizio |
| **Ricevimento merci** | scorre | col fattorino davanti |
| **Scadenze** | scorre | davanti alla cella |
| **Lista della spesa** | scorre | al mercato |
| **Ordini ai fornitori** | scorre | in giro |
| **Sconti e omaggi** | non scorre | a fine serata |

### Quelle che secondo me userà solo dal computer — da confermare

Proiezione fiscale · Previsioni · Deducibilità · Andamento mensile ·
Sezione personale · Scontrinato · Fatture fornitori · Dipendenti ·
Editor menu · Bevande e vini · Preventivi · Ricette e schede.

### E due che non contano

Manuale HACCP completo e Stampa adempimenti: **sono fogli da stampare**, non
schermate.

---

## 4 · Cosa propongo, quando avrà spuntato

1. **Solo le sue spuntate**, una alla volta, riusando la forma di
   `ReservationsList` — e **coi campi in un posto solo**, come lì.
2. **Prima Magazzino**, perché è quella dove il difetto è stato visto da una
   mano ed è la più usata in piedi.
3. ⚠️ **Il titolo tagliato e la fila dei pulsanti sono un difetto a parte** e
   più piccolo: si curano in Magazzino insieme alla tabella, e la stessa cura
   serve ovunque ci sia una fila di pulsanti sopra un elenco.

---

## 5 · Il limite, dichiarato

🔴 **Nessuna prova automatica l'avrebbe preso, e nessuna lo prenderà**: in
questo progetto le prove non hanno un ambiente che disegna una schermata, e
men che meno ne misura la larghezza. **L'unico strumento che trova questa
famiglia di difetti è una mano su un telefono vero** — come è successo.

⚠️ È l'ottava voce dell'elenco della decisione 2 (le prove che guardano una
schermata, rinviate): la risposta alla domanda *«una prova automatica
l'avrebbe preso?»* è **no**, e resta no finché quelle prove non esistono.
