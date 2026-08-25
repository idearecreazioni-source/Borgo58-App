# La stampa, le spunte e il vincolo che non mentiva
**25/08/2026 — verifica della stampa chiesta da Alessio + mandato accodato, due blocchi**

Commit sotto questo riepilogo: **2cf30ad** *(`Le spiegazioni escono da
accanto alle spunte, e il vincolo non mentiva`)*

**Stato delle migrazioni**, misurato in produzione dopo l'applicazione:

| dove | quante |
|---|---|
| repository | **241** |
| produzione | **241** |
| progetto di prova | **241** |

Le due che aspettavano il push — `20260825000005` e `20260825000006` —
sono **applicate**. Numeri veri letti dopo: **zero** lapidi, **zero**
trigger lasciati spenti, **zero** residui di prova, e
`preparazione_in_cella` non eseguibile da `anon` né da `authenticated`.

Questi due blocchi **non contengono migrazioni**: al database non serviva
niente.

---

## Parte 1 — la verifica della stampa (condizione posta da Alessio)

> *«Hai toccato le regole di stampa e quelle valgono anche per il manuale
> HACCP e il preconto, non solo per il Ricettario. Voglio sapere che i
> fogli escono come prima.»*

### Come è stata fatta

Le tre dichiarazioni del blocco `@media print` **lette dal foglio di
stile vero** (`document.styleSheets`, non riscritte a mano) e
**riapplicate come regole normali**, così il browser le esegue davvero.
Confrontate con lo stato precedente — le stesse classi col loro `calc()`
— a **due calibrazioni**: computer (37,8) e mini tablet (64). Le
dimensioni convertite in **millimetri di carta** (96 punti = un pollice).

### 🔴 Trovato un buco mio

**`.testo-sala-titolo` non era nel blocco print.** È la classe che avevo
creato poche ore prima, e il blocco l'avevo scritto **prima** di lei. Dal
tablet sarebbe rimasta a **8,13 mm** mentre le altre tre scendevano a
3,2-6: titoli sproporzionati sul foglio. Aggiunta a 18,1 punti.

⚠️ *È la forma più banale di frase diventata falsa: un elenco scritto
completo, e completo lo è rimasto per due ore.*

### I documenti, uno per uno

| documento | dal computer | dal tablet |
|---|---|---|
| **manuale HACCP** | **identico** — 373 testi, stesse misure | **identico** |
| ticket di cucina | identico (4,00 mm sulle righe piatto) | **da 6,77 a 4,00 mm** |
| preconto | identico (3,20 mm) | **da 5,42 a 3,20 mm** |

✅ **Il manuale HACCP non è toccato affatto**, ed è la risposta alla
preoccupazione principale: **non usa nessuna** delle classi in centimetri
veri. Verificato **sulla pagina**, misurando 373 testi, non dedotto dal
codice.

⚠️ **Il ticket di cucina è stato misurato su un ticket VERO**: la
schermata Cucina non ne aveva nessuno («niente da stampare» non è la
stessa cosa di «ho guardato»), quindi è stato costruito un conto di prova
con due righe già inviate, agganciato a un tavolo per poter aprire anche
il preconto. Cancellato dopo, **per identificativo**: zero conti di
prova rimasti, lapidi invariate a **1797**.

### 🔴 Il fatto che resta da decidere

**Dal computer i fogli escono esattamente come prima.** Dal tablet no:
ticket e preconto **si rimpiccioliscono del 41%**.

⚠️ **Ma la cosa importante è come stavano PRIMA**: lo stesso ticket usciva
di **due taglie diverse a seconda di dove si premeva stampa** — 4,00 mm
dal computer e 6,77 dal tablet — e **nessuno lo sapeva**, perché la
dimensione era agganciata alla calibrazione dello schermo. La regola nuova
toglie quel silenzio; **quale delle due taglie sia quella giusta è una
decisione di Alessio**, non una misura: dipende da come si legge un
biglietto in cucina, in piedi, durante il servizio. Posta a lui.

---

## Parte 2 — Blocco 1: le spiegazioni accanto alle spunte

### Il difetto, misurato prima di toccarlo

A **390 punti**, le tre spunte della scheda ingrediente:

| spunta | nome | spiegazione | altezza |
|---|---|---|---|
| «Avvisami se il prezzo sale» | **4 righe**, 107 punti | **174 punti** | 128 |
| «È un alimento» | 2 righe, 103 punti | 178 punti | 179 |
| «Il magazzino lo segue» | 3 righe, 132 punti | 149 punti | 230 |

L'accessorio prendeva **più larghezza del nome in tutti e tre i casi**.

### Dopo

| spunta | nome | altezza |
|---|---|---|
| «Avvisami se il prezzo sale» | **2 righe** | **64** |
| «È un alimento» | **1 riga** | **54** |
| «Il magazzino lo segue» | **2 righe** | **64** |

Le tre spunte passano da **537 a 182 punti** di altezza, zero sbordi, e
il pallino «Cosa vuol dire» c'è su tutte e tre — verificato anche
nell'albero della pagina.

### La famiglia: sette candidati, sei falsi allarmi

Il setaccio ha trovato **7** spiegazioni affiancate a una spunta. Lette
una per una:

- **6 erano già sane** — la nota è `block`, cioè va **sotto** il nome e
  non gli ruba larghezza: Agenda (`TaskForm`), due in *Sala e orari*, due
  sui fornitori (`FornitoreDetail`, `FornitoriList`), e il **consenso
  privacy** del form pubblico, che è testo legale e resta intero.
- **1 era vero**: «Mostra allergeni» in Editor Menu — nome schiacciato su
  **2 righe da 48 punti** mentre la frase accanto ne prendeva **207**.

⚠️ *Il setaccio dice dove guardare, non cosa è vero.*

### Il conflitto in Editor Menu, e la terza forma

Quella frase ha una **decisione di Alessio del 17/08** che la pretende
*scritta e non sottintesa*: senza, fra sei mesi qualcuno accende la
casella credendo di stampare la carta. Metterla dietro il pallino
l'avrebbe nascosta.

Usata la **terza forma**, che rispetta entrambe le decisioni: **sotto**,
non accanto. Il nome passa da **48 a 194 punti**, su una riga sola; la
frase resta visibile. È la forma che le altre sei schermate usano già.

⚠️ **E la formulazione di Alessio la ammette**: *«le note sotto un campo
restano»*. Il discriminante è **dove sta**, non che cosa dice.

### La regola nel §8

Scritta in cima alle trappole, coi numeri, e con la nota che **questa è
la terza famiglia di difetti di ingombro che salta fuori solo dal
telefono** — dopo la fila orizzontale di HACCP/Magazzino/Comande e le due
tabelle da 651 punti del Ricettario, entrambe di ieri. Rovesciamento
**n. 49**.

---

## Parte 3 — Blocco 2: il suggerimento e il vincolo

> *«Se scrivo esattamente quello che il campo mi suggerisce, il gestionale
> probabilmente lo rifiuta… uno dei due mente.»*

### 🔴 Provato, e nessuno dei due mente

Scritto «≤ 4°C» **dalla porta vera della schermata** —
`createIngredient`, la stessa funzione che chiama il pulsante — con la
sessione di un utente vero:

| scritto | esito |
|---|---|
| **«≤ 4°C»** *(il suggerimento, alla lettera)* | **ACCETTATO** |
| «ambiente» | ACCETTATO |
| «0-4 °C» | ACCETTATO |
| «4» | ACCETTATO |
| «-100» | **RIFIUTATO**, col messaggio in italiano |

⚠️ **Il campo non ha nessuna verifica locale**: va dritto al database
(`temperatura_attesa: form.temperatura_attesa || null`), quindi questa
prova esercita esattamente la strada della schermata.

### Il numero del mandato era di un'altra tabella

Il vincolo di quel campo non è −80/+150: è **−40/+60**, su una colonna di
**testo**, e guarda **solo i numeri contenuti** nel testo
(`numeri_fuori_intervallo`). Il suo commento lo dice già: *«Si possono
scrivere anche parole ("ambiente") o intervalli ("0-4 °C")»*.

Il **−80/+150** esiste, ma su `haccp_goods_receiving.temperature_c` e
`haccp_temperature_logs.recorded_temp_c` — i **registri**, dove la
temperatura è una colonna **numerica** e una misurazione vera.

### Cercata la stessa contraddizione altrove

- **fasi di ricetta** (`recipe_steps.temperature_c`, testo): suggerisce
  «63°C», vincolo **−40/+300** — *«più larga di quella della consegna
  perché qui si cuoce»*. Va d'accordo.
- **campi dei registri HACCP**: suggerimenti neutri («Temp. °C», «°C»,
  «Min °C»), su campi numerici. Nessuna contraddizione.

**Nessun suggerimento contraddice un vincolo. Niente da correggere** — e
non è uno zero per non aver guardato: sono cinque valori scritti davvero
e quattro vincoli letti dal catalogo.

I quattro ingredienti creati per provare sono stati cancellati: **zero
rimasti**, lapidi invariate a 1797.

---

## Cosa NON è stato verificato con gli occhi

- 🔴 **Nessuna immagine.** Lo screenshot non funziona in questo ambiente:
  tutte le misure vengono dal **DOM**.
- 🔴 **NESSUNO HA STAMPATO NIENTE SU CARTA.** La verifica della stampa è
  fatta applicando le regole vere e misurando in millimetri di carta —
  che è più di una deduzione, ma **non è un foglio guardato**. Il ticket
  su una termica da 80 mm non l'ha visto nessuno.
- **Il pallino «Cosa vuol dire» non è stato aperto con un dito**: si sa
  che c'è (è nell'albero della pagina) e che il suo bersaglio è
  `tocco-bottone` (8,5 mm), non che la spiegazione si legga bene aperta.
- **La scheda ingrediente non è stata guardata da un telefono vero** dopo
  la correzione.

## Cosa è stato dato per fatto senza misurarlo

- Che i **12,1 / 15,1 / 18,1 / 22,7 punti** del blocco print siano i
  valori giusti: sono quelli che le classi producono su un monitor a 96
  dpi, cioè lo stato in cui questi fogli sono sempre stati stampati — ma
  **non è una misura su carta**.
- Che il testo dietro il pallino sia **leggibile aperto** sul telefono:
  il componente esisteva già e non l'ho rimisurato.
- Che le tre spiegazioni riscritte per il pallino dicano **la stessa
  cosa** di prima: le ho riformulate (tolte le parentesi, aggiunto il
  «perché» sul primo), e nessuno le ha rilette contro l'originale se non
  io.

## Affermazioni diventate false mentre lavoravo

- **«Il vincolo accetta solo numeri fra −80 e +150»** (dal mandato): è
  −40/+60, e il −80/+150 è di altre due tabelle.
- **«Verifica provandolo da una schermata»**: il click sul pulsante «Crea
  ingrediente» **non è mai partito** — tre tentativi, nessuna richiesta
  al database (il ricaricamento automatico di Vite azzerava il modulo, e
  il mio modo di riempire i campi non aggiornava lo stato della pagina).
  La prova è passata dalla **funzione che il pulsante chiama**, con la
  sessione vera. È la stessa strada, **non è lo stesso gesto**, e va
  detto.
- Il mio primo controllo sul manuale HACCP ha misurato **la pagina di
  accesso** (4 testi) credendo fosse il manuale: la sessione era caduta.
  Rifatto dopo essere rientrato — 373 testi.

## Cosa abbiamo rovesciato

**Uno**, al numero **49** di
[`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md): «la
spiegazione di una spunta sta accanto al suo nome». ⚠️ La ragione di
allora — *la spiegazione va dove sta il dubbio* — **vale ancora**: cambia
il **posto**, non il principio, perché quella ragione non teneva conto
della larghezza. E **non rovescia la decisione del 17/08** su «copia per
uso interno»: quella frase resta scritta, si sposta soltanto sotto.
