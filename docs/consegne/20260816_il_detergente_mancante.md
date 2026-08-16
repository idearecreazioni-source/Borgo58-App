# Consegna del 16/08/2026 (quarta) — il detergente mancante

**Commit della consegna: `421c0a6`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `421c0a6` | la prova rimette il detergente — migrazione `20260816000004`, e la regola in `CLAUDE.md` §8 |

⚠️ **`20260816000004` è committata e NON ancora applicata** (aspetta il
push). I numeri veri vanno in §4, nello stesso giorno.

---

## 1. Cosa è successo

🔴 **La verifica di `20260816000003` ha tolto 2 unità di detergente dalla
merce vera di Alessio, e la pulizia non le ha rimesse.**

Trovato **leggendo la giacenza col connettore** dopo l'applicazione,
invece di fidarsi del «residui: zero» che quella verifica dichiarava — in
perfetta buona fede, perché controllava le righe lasciate in giro e non i
valori cambiati.

La verifica doveva provare che uno scarico a mano registra finalmente il
costo. Per farlo:

1. sceglieva **un ingrediente qualunque già esistente** (`limit 1`);
2. gli aggiungeva un lotto di prova da 10 a 3,00, senza scadenza;
3. ne scaricava 2 col metodo FEFO;
4. cancellava lo scarico **e il lotto di prova**.

⚠️ **Il passo 3 non ha preso dal lotto di prova.** FEFO ordina per scadenza
e, a parità di scadenza, per data di ricevimento: il lotto vero del
«Detergente sgrassante» — ricevuto il 12/08, senza scadenza — viene
**prima** di quello di prova, ricevuto oggi. Le 2 unità sono uscite dalla
merce vera; il passo 4 ha cancellato il lotto di prova **ancora intero**.

Risultato in produzione: un lotto con 10 ricevute e 8 rimaste, e **zero
scarichi registrati** su quell'ingrediente. Merce sparita senza una riga
che la spieghi — che è precisamente la cosa che il magazzino non deve fare.

---

## 2. Perché è la stessa lezione del 14/08

Il 14/08 la verifica della pianta spostava due tavoli in due direzioni e
li rimetteva su una sola: il controllo finale contava le **righe** lasciate
in giro, non i **valori** cambiati su righe che dovevano restare, e
dichiarò zero residui con due tavoli in mezzo ai divani.

⚠️ Qui è lo stesso errore, su una **colonna** invece che su una riga: la
pulizia ha cancellato ciò che aveva creato e non ha rimesso ciò che aveva
cambiato.

**La regola che ne esce è più stretta di quella di allora**, ed è scritta
in `CLAUDE.md` §8:

> Una verifica che prova uno scarico **non riusa un ingrediente vero**. Se
> ne crea uno proprio, **sempre** — non solo quando non ce ne sono. Con un
> ingrediente tutto suo, FEFO non ha nient'altro da cui pescare e il
> problema non può presentarsi. **Il perimetro di una prova dev'essere
> fatto di roba che la prova ha creato.**

---

## 3. La correzione

⚠️ **Perimetro stretto e dichiarato**, come per i due tavoli: si rimette
**solo** se la giacenza è ancora esattamente dove la verifica l'ha
lasciata — stesso costo unitario, stessa quantità ricevuta, 8 rimaste,
nessuna scadenza, e **zero scarichi** su quell'ingrediente. Se nel
frattempo Alessio avesse consumato o caricato qualcosa, non si tocca
niente: *meglio una correzione che non parte di una che sovrascrive una
sua scelta.*

**Non si corregge la migrazione già applicata** (Contratto §8): girerebbe
a chi controlla un file diverso da quello che ha prodotto lo stato reale.

**La verifica fa tre cose:**
1. controlla che il detergente sia tornato a posto;
2. ⚠️ controlla che **nessun lotto** abbia merce mancante senza uno scarico
   che la spieghi — se il difetto si fosse ripetuto su un altro
   ingrediente, lo troverebbe qui invece che fra sei mesi;
3. **prova la regola nuova**: uno scarico su un ingrediente creato dalla
   prova non tocca la merce di nessun altro, verificato confrontando la
   **giacenza totale degli altri prima e dopo** — sui valori, non sul
   numero di righe.

Idempotente per costruzione: rimessa la giacenza, la condizione non è più
vera. Applicata tre volte sul progetto di prova senza errori.

---

## 4. Dopo l'applicazione in produzione

*(da compilare nello stesso giorno, prima del secondo push)*

- migrazioni in produzione: **da compilare**
- detergente: quantità ricevuta e rimasta: **da compilare**
- lotti con merce mancante e nessuno scarico: **da compilare**
- residui della verifica (ingrediente `__PROVA FEFO__`): **da compilare**
- avvisi partiti: **da compilare**

---

## 5. Cosa NON è verificato, e una cosa da dire

- ⚠️ **Non so se il difetto si è presentato anche altrove.** Il controllo 2
  della verifica lo cercherebbe, ma ha un limite dichiarato: guarda solo
  gli ingredienti **senza nessuno scarico**. Se una verifica passata avesse
  tolto merce a un ingrediente che ha anche scarichi veri, quella
  differenza sarebbe indistinguibile da un consumo legittimo. Sui dati di
  oggi il controllo passa; su dati futuri non è una garanzia.
- **Le migrazioni precedenti non sono state ricontrollate una per una** per
  cercare lo stesso schema. Sarebbe il lavoro giusto da fare, e non l'ho
  fatto: lo dichiaro invece di lasciarlo intendere coperto.
- ⚠️ **I dati toccati sono dati di collaudo** (le sei fatture di prova del
  12-13/08, che restano in produzione per deroga dichiarata), non merce
  vera del locale. Questo riduce il danno — non l'errore.
