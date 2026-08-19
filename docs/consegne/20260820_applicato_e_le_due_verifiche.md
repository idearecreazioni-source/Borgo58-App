# Il blocco 2 è in produzione, e le due verifiche hanno trovato qualcosa

**Migrazioni applicate**: `20260819000013_il_prezzo_al_pezzo` e
`20260820000001_una_selezione_si_copia` — **2 su 2**, dopo il push di Alessio.
**Corridoio**: `operazioni-atomiche` **v29 → v30** in produzione.
**Autorizzazione**: sua, esplicita, con i vincoli di sempre (annuncio prima,
solo lavoro già su GitHub, numeri veri dopo).

---

## I numeri veri, letti dalla produzione dopo l'applicazione

| | |
|---|---|
| migrazioni | **151** (erano 149) |
| tipi di ricetta nel database | **3** (`piatto_finito`, `preparazione`, `finger`) |
| ricette · di cui finger | **0 · 0** |
| ricette con un prezzo a pezzo | **0** |
| menu · piatti in menu | **0 · 0** |
| produzioni registrate | **0** |
| tracce nel registro delle cancellazioni | **26** — *invariate* |
| movimenti di cassa | **0** — *invariati* |
| conti · di cui aperti | **8 · 0** — *invariati* |

E le quattro reti permanenti, **tutte ferme dove erano**: **16** funzioni
senza portiere, **10** aperte ad anon, **0** funzioni che decidono la data a
Greenwich, **0** lapidi di prova, **0** predefiniti di data.

⚠️ **Il 16 non è diventato 17**, ed è una conseguenza voluta:
`duplica_ricetta` è `security invoker`, non `definer` — scrivere su quelle tre
tabelle è già riservato al titolare da nove policy, quindi non c'era niente da
scavalcare e non c'è un portiere in più da tenere allineato a mano.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha toccato una spunta**, e nessuna prova di questo
   progetto guarda una schermata.
2. ⚠️ **In produzione non esiste nessun bocconcino**: il pannello non è mai
   comparso su dati veri, e non può, finché il Ricettario è vuoto.
3. ⚠️ **La parte online in produzione è la v30**, cioè il codice pushato. Le
   righe aggiunte dopo (solo commenti, l'avvertenza sulla zona d'ombra) vanno
   online alla prossima installazione. *Il codice eseguito è identico; a
   divergere è un commento.*

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 Verifica 1 — dove il tipo «finger» si affaccia

La richiesta era: *«una cosa è il vincolo e un'altra è dove il tipo si
affaccia»*. Rimisurato sulla produzione e sul codice.

| dove | un finger ci compare? | |
|---|---|---|
| **Produzioni** | **no** | l'elenco chiede `recipe_type = 'preparazione'` |
| **Sorveglianza delle rese** | **no** | lavora sulle produzioni *registrate*: senza produzione non c'è resa |
| viste e funzioni del database che guardano il tipo | **3 sole** | `check_recipe_component` (lo ammette apposta), `ingrediente_di_preparazione` (lo rifiuta apposta), `duplica_ricetta`. **Nessuna vista** guarda il tipo |
| **elenco delle ricette** | 🔴 **sì, e male** | vedi sotto |
| **elenchi del menu** (carta e piatti del giorno) | 🔴 **sì** | vedi sotto |

### 🔴 Nell'elenco delle ricette un bocconcino era indistinguibile da un piatto

Due difetti, tutti e due **silenziosi**, tutti e due corretti:

- **nessun cartellino**: il codice mostrava «preparazione» solo per il tipo
  `preparazione`, quindi un bocconcino compariva **nudo**, uguale a un piatto;
- **il numero sbagliato di specie**: la colonna delle porzioni mostrava
  `portions_yield` per tutto ciò che non era una preparazione — cioè **«1»**
  su un bocconcino, invece della sua **resa**. Un numero plausibile, e della
  categoria sbagliata.

Adesso tutti e due passano da `eComponente()`, che è la funzione che risponde
alla domanda vera — *«questa ricetta può stare dentro un'altra?»* — invece di
elencare i tipi a mano. **Un tipo nuovo domani entra da solo.**

### 🟡 Gli elenchi del menu offrono TUTTE le ricette — e non è colpa dei finger

Nella carta e nei piatti del giorno l'elenco è `listRecipes()` **senza nessun
filtro sul tipo**: da sempre ci si possono mettere anche le **preparazioni**.
I bocconcini si aggiungono a quella lista.

🔴 **Non è un difetto introdotto adesso, ed è dichiarato invece che corretto**,
per una ragione precisa: **decidere se un bocconcino può andare in carta da
solo è esattamente la domanda lasciata aperta** nella migrazione del prezzo a
pezzo — il giorno che ci va, ci sono due prezzi per la stessa cosa e serve una
regola su quale vince. Filtrarli fuori adesso vorrebbe dire **rispondere a
quella domanda di nascosto**; e filtrare le preparazioni è una seconda
decisione ancora diversa (una conserva venduta in vasetto è un caso vero).
Va in coda, come decisione da prendere.

---

## Verifica 2 — la parola «bocconcino» dove prima c'era «preparazione»

Cercata in tutta l'interfaccia. Tre posti dicevano «preparazione» a proposito
di cose che ora possono essere bocconcini:

| dove | prima | adesso |
|---|---|---|
| cartellino della riga dentro una ricetta | sempre «preparazione» | «bocconcino» sui finger |
| cartellino nell'elenco delle ricette | niente sui finger | «bocconcino» |
| cartellino del modulo «Ingrediente / Preparazione» | «Preparazione» | «Preparazione o bocconcino», **solo quando i bocconcini esistono** |
| tendina di quel modulo | solo il nome | «… · bocconcino» sui finger |

⚠️ **E solo lì**: gli `isPreparazione` che restano nel codice sono la domanda
*«ha una resa invece delle porzioni?»*, e per un finger la risposta è **sì** —
quella parola è giusta dov'è, perché descrive un comportamento condiviso e non
il tipo. La prova che li tiene onesti è `eComponente()`, che è l'unico posto
dove quella domanda ha una risposta.

---

## 🔴 La zona d'ombra, scritta adesso che ce ne ricordiamo

Richiesta di Alessio, e la ragione è che **questo è il primo pezzo nuovo che
nasce lì dentro**: «Fai una copia» vive in una funzione online — scelta giusta
e non in discussione, perché copiare una selezione scrive in tre tabelle e o
riesce tutto o non riesce niente.

Ma le funzioni online **leggono con una chiave loro e non passano dal punto
dove vive il segnale delle letture tagliate**. Scritto in **tre posti**, con la
forma già usata per le letture annidate — non «non può succedere», ma **da cosa
dipende**:

- in cima a `supabase/functions/operazioni-atomiche/index.ts`, dove sta chi ne
  scriverà una nuova;
- in `src/lib/supabase.js`, accanto al segnale, fra i limiti dichiarati;
- in CLAUDE.md §8 e in un **addendum al referto** del 19/08, con la tabella di
  cosa legge oggi ciascuna delle quattro funzioni e perché è piccola.

⚠️ **Oggi non morde perché quelle letture sono piccole per costruzione** — le
righe di *una* ricetta, gli allegati di *una* mail. **Cambia** il giorno in cui
una funzione online legge una tabella che **cresce nel tempo**: l'archivio
documenti intero, uno storico prezzi, un registro. Quel giorno tornerebbe più
corta **senza dirlo a nessuno**.

⚠️ **La domanda scrivendone una nuova**: *questa lettura può tornare più corta
senza dirlo?* Se sì, o si chiede `count=exact` e si confronta lì dentro, o si
dichiara il taglio a chi legge il risultato.

---

## Per Alessio, in una riga

È tutto in produzione e non si è mosso nessun numero del locale; correggendo
mi sono accorto che nell'elenco delle ricette un bocconcino sembrava un
piatto, e l'ho sistemato.

---

**Commit delle correzioni**: `952db8d` — «Un bocconcino non sembra più un piatto, e la zona d'ombra è scritta».
**Working tree**: pulito.
**Migrazioni**: 151 in produzione, **2 applicate in questo giro**.
**Corridoio**: v30 in produzione.
**Prove**: 146 pure + **224** sull'app, tutte verdi.
