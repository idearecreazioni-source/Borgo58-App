# Applicato: lo storico dei costi

**Migrazione applicata**: `20260820000003_lo_storico_dei_costi` — **1 su 1**,
dopo il push di Alessio. **Nessuna funzione online toccata.**
Con questa, il **mandato dei finger food è in produzione per intero**.

---

## I numeri veri, letti dalla produzione dopo l'applicazione

| | |
|---|---|
| migrazioni | **153** (erano 152) |
| ricette | **0** |
| **voci di storia** | **0** |
| ingredienti · di cui a prezzo zero | **8 · 0** |
| menu | **0** |
| tracce nel registro delle cancellazioni | **26** — *invariate* |
| movimenti di cassa | **0** — *invariati* |
| conti · di cui aperti | **8 · 0** — *invariati* |

Le reti di sorveglianza, tutte ferme dove erano: **16** funzioni senza
portiere, **10** aperte ad anon, **0** funzioni che decidono la data a
Greenwich, **0** lapidi di prova, **0** predefiniti di data, **0** policy
intestate al ruolo pubblico.

⚠️ **Il 16 non è salito a 24, e va spiegato invece che dichiarato**: questa
migrazione crea **otto** funzioni `security definer`. Verificato una per una
in produzione: **sei non sono eseguibili da nessuno** (girano solo come
trigger, e a un trigger Postgres non chiede il permesso di esecuzione), e le
**due leggibili hanno il portiere** — `storico_costo_ricetta` e
`costo_ricetta_alla_data` rifiutano chi non è il titolare. Nessuna delle otto
è una porta, ed è per questo che il censimento non si è mosso.

---

## 🔴 «Tutto invariato» qui è vero e non dimostra niente

Il Ricettario in produzione è vuoto, quindi applicare **non ha scritto nemmeno
una voce di storia** — ed è esattamente il rilievo posto prima di applicare:
*una strada scollegata non darebbe nessun errore oggi, darebbe un buco muto il
primo giorno che Alessio scrive una ricetta.*

Quindi la verifica è stata fatta su **tre livelli diversi**, e ognuno risponde
a una domanda che gli altri non coprono.

### 1 · Il catalogo dice DOVE sono attaccate le registrazioni

| tabella | trigger | quando | grana | colonne sorvegliate | attivo |
|---|---|---|---|---|---|
| `ingredients` | `trg_storico_prezzo` | AFTER | per riga | **`current_price`** | sì |
| `recipe_ingredients` | `trg_storico_riga` | AFTER | per riga | **tutte** (insert · update · delete) | sì |
| `recipes` | `trg_storico_ricetta` | AFTER | per riga | **`portions_yield`, `yield_quantity`** | sì |

⚠️ **Le colonne sorvegliate sono il punto**: se `portions_yield` fosse caduta
da quell'elenco, oggi non ci sarebbe nessun errore — e il giorno che Alessio
cambia le porzioni di un piatto il costo per porzione cambierebbe **senza
lasciare traccia**. Sono lì tutte e due, lette dal catalogo.

🔴 **E il mio primo controllo era sbagliato**: leggevo il bit numero uno di
`tgtype` come «AFTER», ma quel bit dice **«per riga»**. Rifatto sul bit
giusto: tutti e tre sono **AFTER**. *Un controllo che legge la colonna
sbagliata dà una risposta con l'aria di essere una misura.*

### 2 · Le sei strade sono collegate, ognuna alla sua funzione

| strada | funzione | collegata | trigger attaccato |
|---|---|---|---|
| prezzo | `storico_al_cambio_prezzo` | sì | 1 |
| composizione | `storico_al_cambio_riga` | sì | 1 |
| quantità | `storico_al_cambio_riga` | sì | 1 |
| scarto | `storico_al_cambio_riga` | sì | 1 |
| resa | `storico_al_cambio_ricetta` | sì | 1 |
| porzioni | `storico_al_cambio_ricetta` | sì | 1 |

⚠️ **Il limite di questo controllo, dichiarato**: guarda che la causa sia
*nominata* nel corpo della funzione giusta e che quella funzione abbia un
trigger addosso. **Non prova che il ramo sia raggiungibile** — un ramo
neutralizzato con `if false` conserverebbe la parola e passerebbe. Per quello
servono gli altri due livelli.

### 3 · Il blocco di verifica ha ESERCITATO tutte le strade, in produzione

Ha girato dentro questa migrazione, sui dati veri, e si è pulito da sé (le
tracce sono le stesse prima e dopo). Otto controlli: la catena a quattro
livelli con il rincaro che arriva in cima, il salvataggio a vuoto che non
scrive, il costo di ieri che resta quello di ieri, la resa, le porzioni, il
costo parziale, «tolto», lo scarto.

⚠️ **Gira come proprietaria del database**: prova che i rami si percorrono,
non che si percorrano per un utente normale. Quella metà è provata sul
progetto di prova col token di un utente vero (7 prove).

⚠️ **E che ogni ramo sia PORTANTE** lo dicono le sei rotture fatte ieri sul
progetto di prova: tolta una strada per volta, ognuna ha fatto diventare rossa
una prova diversa.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna voce di storia è mai stata scritta sui dati di Alessio**, e non
   può esserlo finché il Ricettario è vuoto.
2. 🔴 **Nessuna mano ha visto il riquadro «Com'è cambiato»**: nessuna prova di
   questo progetto guarda una schermata.
3. ⚠️ **Nessuna fattura vera è stata caricata con questi trigger accesi**: il
   *tempo* che ci mette non è stato misurato, solo il numero di righe che
   scriverebbe (51 su un Ricettario da 76 ricette).
4. ⚠️ **Il registro non si può ripulire da nessuno**, ed è voluto: le voci
   scritte durante il collaudo resteranno.
5. ⚠️ **`ingredients.current_price` resta `not null default 0`** — un
   ingrediente mai comprato vale zero e abbassa in silenzio il food cost
   ovunque tranne che nel registro, che lo dichiara. **Misurato oggi: 0 su 8
   a zero**, quindi armato e non vivo. È una decisione di Alessio.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento in questo passaggio.**

---

## Per Alessio, in una riga

È in produzione e non si è mosso nessun numero del locale: il gestionale ha
adesso il quaderno dei costi, ed è attaccato a tutte e sei le strade per cui
un costo può cambiare — quando scriverai la prima ricetta comincerà a
riempirsi da solo.

---

**Migrazioni**: 153 in produzione, **1 applicata in questo giro**.
**Prove**: 152 pure + 236 sull'app, tutte verdi.
