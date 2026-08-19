# Il prezzo a pezzo del finger — blocco 2, prima metà

**Migrazione**: `20260819000013_il_prezzo_al_pezzo.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Mandato**: [`20260819_i_finger_food_e_lo_storico_dei_costi.md`](../mandati/20260819_i_finger_food_e_lo_storico_dei_costi.md).

⚠️ **Il blocco 2 è spezzato in due, e la ragione è una richiesta di Alessio**:
la schermata per comporre una selezione è quella su cui lui passerà **ore di
seguito** inserendo decine di ricette, e le scelte che pesano lì — quanti
tocchi per aggiungere un bocconcino, se il costo si aggiorna sotto gli occhi,
se una selezione si può duplicare — **vanno chieste, non scelte**. Sono in
fondo a questo riepilogo, e il lavoro riprende con le sue risposte.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha scritto un prezzo a pezzo dalla schermata.** Il campo
   è provato dal database e dalle prove col token di un utente vero; il
   modulo del Ricettario non l'ha aperto nessuno.
2. ⚠️ **Il prezzo non lo legge ancora nessuno.** Serve al modulo preventivi,
   che è in coda e non esiste. ⚠️ È la ragione per cui il campo è **a
   schermo** e non solo nel database: *un dato scritto che nessuno può vedere
   è indistinguibile da un dato non scritto* (lezione del 18/08).
3. ⚠️ **La contraddizione futura è scritta, non impedita**: vedi sotto.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## Dove sta il prezzo, e perché non è un secondo prezzo della stessa cosa

Deciso da Alessio. L'obiezione posta prima di costruirlo era che i prezzi di
vendita vivono già in **tre** posti — `menu_items.selling_price` (la carta),
`bar_items.selling_price` (le bevande), `daily_menu_items.price` (il piatto
del giorno) — e che un quarto è la premessa di due numeri che si
contraddicono.

**La sua risposta regge, e non è una scorciatoia**: non sono due prezzi dello
stesso oggetto. Il prezzo della carta è di un **piatto**; questo è di un
**bocconcino**. Cose diverse, ognuna col suo.

🔴 **Il caso in cui si contraddirebbero esiste, e si SCRIVE invece di
risolverlo** (decisione sua): il giorno in cui **lo stesso finger andasse in
carta anche da solo** ci sarebbero due prezzi per la stessa cosa e servirebbe
una regola su quale vince. Oggi non succede, e **niente lo impedisce**. Sta
scritto in tre posti — nel commento della colonna nel database, nella
migrazione e nel mandato — perché *chi lo scoprirà vendendo non avrà tempo di
cercarne la ragione*.

⚠️ **E metà della contraddizione è impedita**: un prezzo a pezzo **non si può
scrivere su un piatto finito**, dove sarebbe davvero un secondo prezzo
accanto a quello della carta. È un vincolo del database.

⚠️ **Vuoto non è zero**: la colonna nasce vuota, e vuota vuol dire «non l'ho
ancora deciso» — 0,00 vorrebbe dire «lo regalo». La schermata lo scrive sotto
il campo. È la regola applicata quattro volte il 16/08.

---

## Le prove, e le due rotture

**Quattro controlli dentro la migrazione** — il prezzo si scrive e **si
rilegge com'è stato scritto** (⚠️ non basta che la scrittura non dia errore:
una colonna che arrotonda male direbbe un prezzo diverso da quello digitato),
il vuoto resta ammesso, un piatto finito lo rifiuta, un prezzo negativo lo
rifiuta. Più **due prove** col token di un utente vero.

| rottura | cosa è diventato rosso |
|---|---|
| il vincolo «solo sui finger» diventa sempre vero | *«Un piatto finito ha accettato un prezzo a pezzo»* |
| il vincolo «non negativo» diventa sempre vero | *«Un prezzo a pezzo negativo è stato accettato»* |

---

## 🔴 Un errore mio, e vale la pena scriverlo

Ho lanciato **due suite di prove insieme** sullo stesso database di prova, e
il risultato è stato **cinque file rossi e ottanta prove saltate** — nessuno
dei quali era un difetto vero. Rilanciata da sola: **34 file, 221 prove,
tutte verdi**.

⚠️ È una trappola **già scritta in CLAUDE.md §8** dal 10/08: *«le prove
sull'app girano in fila, mai in parallelo: il database è uno solo»*. Ci sono
cascato lo stesso perché la seconda l'ho lanciata mentre la prima era ancora
in corso in sottofondo. *Un rosso va guardato prima di crederci: qui diceva
una cosa falsa, e la causa ero io.*

---

## Per Alessio, in una riga

Sui bocconcini puoi scrivere quanto costa venderne uno singolo, e il
gestionale non ti lascia metterlo su un piatto — dove sarebbe un secondo
prezzo accanto a quello della carta.

---

## 🔴 Le tre domande sulla schermata, prima di costruirla

Sono le tre che Alessio ha nominato, e le pongo invece di sceglierle perché è
la schermata su cui passerà ore.

**1 · Quanti tocchi per aggiungere un bocconcino.** Oggi il modulo di
composizione chiede: scegli il tipo (ingrediente o preparazione), cerca,
seleziona, quantità, unità, aggiungi — **sei gesti per ogni riga**, e per un
finger la quantità è **sempre 1 pezzo**.

**2 · Il costo mentre componi.** Il vincolo del progetto è che il food cost si
calcola in **un posto solo**, il database: rifarlo nella schermata per
l'anteprima sarebbe un secondo calcolo dello stesso numero — il difetto che
il mandato di correzione ha chiuso in nove punti.

**3 · Duplicare una selezione** per farne una variante.

---

**Commit del lavoro**: `09ec133` — «Il prezzo a pezzo del finger — blocco 2,
prima metà».
**Working tree**: pulito.
**Migrazione**: `20260819000013` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
