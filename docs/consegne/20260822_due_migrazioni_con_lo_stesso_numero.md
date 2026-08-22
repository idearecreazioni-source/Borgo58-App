# Due migrazioni con lo stesso numero — perché i turni non sono mai entrati

**Nato da**: Alessio ha pushato, il sito è andato online, e le Comande del
gestionale **vero** hanno cominciato a rispondere
*«Could not find the 'turno' column of 'order_items' in the schema cache»*.
**Migrazione**: nessuna nuova. Quella dei turni **cambia numero**, da
`20260821000001` a **`20260821000005`**, e il suo contenuto non è cambiato di
una riga.

---

## 1 · Cos'era, misurato

Due file nella cartella delle migrazioni avevano **lo stesso numero di
versione**:

```
20260821000001_una_percentuale_si_scrive_in_un_modo_solo.sql   ← applicata il 20/08
20260821000001_i_turni_dei_pasti.sql                           ← mai applicata
```

🔴 **`applied_migrations` ha per chiave la VERSIONE, non il nome del file.**
Applicata la prima, la seconda risultava **già applicata**: `npm run migra`
diceva «non manca niente», e non mancava niente *secondo il registro*.

Letto in produzione col connettore in sola lettura, prima di toccare
qualunque cosa:

| domanda | risposta |
|---|---|
| `20260821000001` a chi è intestata? | `una_percentuale_si_scrive_in_un_modo_solo`, applicata il 20/08 alle 22:44 |
| `order_items` ha la colonna `turno`? | **no** |
| esiste `chiamate_turno`? | **no** |
| migrazioni registrate | **165** |
| conti aperti in quel momento | **4**, con 16 righe di comanda |

⚠️ **E l'auto-registrazione non poteva accorgersene**: in fondo alla
migrazione dei turni c'è `insert into applied_migrations … on conflict do
nothing`. La riga di quella versione **c'era già**, col nome dell'altra:
l'inserimento non ha fatto niente, com'era scritto che facesse.

⚠️ **Il difetto era anche sul progetto di prova, e non si vedeva**: lì la
migrazione dei turni era **girata** (la colonna c'è, le 18 prove passano) ma
il registro diceva **166 con 167 file applicati**. La prova funzionava e il
suo registro mentiva — cioè il caso peggiore, perché nessuno va a
controllare un registro quando tutto funziona.

---

## 2 · Perché è la famiglia di §8, e non un errore di battitura

*Una risposta più corta che ha l'aria di essere intera.* `npm run migra` non
ha sbagliato un calcolo: ha risposto con precisione a una domanda leggermente
diversa da quella che gli era stata fatta — *«manca qualche **versione**?»*
invece di *«manca qualche **migrazione**?»*. Finché i due insiemi coincidono
la differenza non esiste; il giorno che due file condividono un numero,
**una migrazione sparisce e lo strumento dichiara che va tutto bene**.

⚠️ **Ed è arrivato online prima di essere scoperto**, che è la parte che
costa: il codice nuovo chiedeva una colonna che nel database vero non c'era,
quindi **in sala aggiungere un piatto a una comanda falliva**. Il push del
codice e l'applicazione della migrazione sono due gesti separati, ed è
giusto che lo siano — ma qui il secondo *sembrava già fatto*.

---

## 3 · La rete, e la rottura che la prova

`versioniDoppie()` in `scripts/comune.mjs`, chiamata **da `npm run migra` e
da `npm run prova:migra`** prima di guardare qualunque cosa: è una proprietà
della cartella, non uno stato del database, quindi si controlla per prima e
vale su tutti e due i progetti.

**Rotta apposta** (non promessa): rimesso un secondo file col numero
`20260821000001`, `npm run migra` si è fermato subito:

```
FERMO: due migrazioni hanno lo stesso numero di versione.
  20260821000001: 20260821000001_doppione_finto.sql  +  20260821000001_una_percentuale…sql
```

Poi il file finto è stato tolto e lo strumento è tornato normale.

⚠️ **Il messaggio dice cosa fare**, non solo cosa non va: rinomina la più
recente **e cambia anche la versione nel suo `insert into
applied_migrations`** — perché sono due posti e dimenticare il secondo
rimetterebbe il difetto in una forma nuova.

---

## 4 · Cosa è stato fatto

1. La migrazione dei turni è **rinominata** `20260821000005`, e la versione
   nella sua auto-registrazione è cambiata di conseguenza. **Il corpo non è
   toccato**: è lo stesso file provato ieri.
2. **Riapplicata sul progetto di prova**, che ora dice **167 migrazioni**
   registrate — ⚠️ e la riapplicazione è anche la prova che è idempotente:
   ha stampato «column already exists, skipping», «relation already exists,
   skipping», e la verifica in fondo è passata di nuovo.
3. `versioniDoppie()` e i due comandi che la chiamano.
4. Il riepilogo dei turni corretto: nominava il numero vecchio.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **La migrazione non è ancora in produzione** mentre scrivo: il file
   nuovo esiste solo qui, e non si applica niente che non sia già su GitHub.
   Serve un push di Alessio, poi si applica e i numeri veri finiscono in
   coda a questo riepilogo.
2. ⚠️ **La rete guarda i numeri, non i nomi**: due file con lo stesso
   *nome* e numeri diversi resterebbero possibili. Non è un difetto —
   sarebbero due migrazioni distinte e il registro le distinguerebbe — ma
   va detto che il controllo copre una cosa sola.
3. ⚠️ **Non ho cercato altri doppioni nella storia**: lo strumento adesso li
   troverebbe tutti al primo lancio, e non ne ha trovati (167 file, nessun
   altro numero ripetuto).

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione è stata cambiata: la migrazione fa quello che
faceva, la Cucina raggruppa come deciso ieri, e il numero di versione non è
una decisione — è un identificativo che era in conflitto.

⚠️ L'unica cosa che cambia di stato è **il numero nominato dal riepilogo dei
turni**, che ora è `20260821000005`: chi legge quel documento fra sei mesi
deve trovare il numero che sta davvero nel registro.

---

## 5 · Applicata in produzione — i numeri veri

*(Da riempire subito dopo l'applicazione: prima del push non c'è niente da
riportare, e un riepilogo che dichiara numeri non ancora misurati è
precisamente il difetto che questo documento racconta.)*
