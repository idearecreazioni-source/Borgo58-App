# La lista della spesa non si apriva, e il lint non lo vedeva

**21/08/2026** · nono difetto, trovato dalle mani di Alessio dal telefono:
*«non compare nulla»*. Non una lista vuota — **il nulla**, perché la
schermata si rompeva prima di disegnare.

**Nessuna migrazione**: il database non c'entra, e infatti le due righe
c'erano.

---

## 1 · Il difetto

`src/pages/magazzino/ListaSpesa.jsx:136`

```js
items.filter((i) => i.status === da_comprare || i.status === ordinata)
```

`da_comprare` e `ordinata` **non esistono**: non stringhe, non importate, non
dichiarate. Identificatori nudi → `ReferenceError` al primo render → il
componente non monta.

🔴 **E il commento sopra quella riga racconta il difetto del 19/08** — le
righe «ordinata» che non comparivano. **La correzione di quel difetto ha
rotto la schermata intera**, e in produzione le due sole voci sono
entrambe `ordinata` (mandorle 2 kg, melanzane 5 kg): esattamente quelle che
quella riga doveva far vedere.

⚠️ **La cura è stata verificata contro il database, non contro la memoria**:
il vincolo su `shopping_list_items.status` ammette esattamente
`da_comprare`, `ordinata`, `acquistato`.

---

## 2 · 🔴 Il reperto che vale più del difetto

Il validatore ha lanciato `npx oxlint` su quel file: **«Found 0 warnings and
0 errors. 92 rules.»**

**Due variabili inesistenti passavano il lint del progetto** — e «lint
pulito» compare come garanzia in ogni riepilogo di questi giorni, i miei di
stanotte compresi.

### Perché non lo prendeva — risposta esatta

**La regola `no-undef` esiste in oxlint, funziona, e prende il difetto: era
semplicemente spenta.** Misurato:

```
npx oxlint -D no-undef src/pages/magazzino/ListaSpesa.jsx
  → error eslint(no-undef): 'da_comprare' is not defined
  → error eslint(no-undef): 'ordinata' is not defined
```

Non è assente e non è inapplicabile ai `.jsx`. È **fuori dalle categorie che
oxlint accende da sé**, e la ragione è buona: senza sapere quali variabili
globali esistono nell'ambiente, quella regola grida su `console`, `fetch`,
`window`, `Deno`. **Provato**: accendendola senza configurare niente, escono
decine di errori su `Buffer`, `console`, `Deno`, `fetch`, `btoa`. *Un
guardiano che grida sempre si impara a spegnere* — ed è il motivo per cui
accenderla e basta non sarebbe stata una cura.

### Cosa è stato fatto

`.oxlintrc.json` adesso dichiara **dove gira ogni pezzo di codice**:

| cartella | ambiente |
|---|---|
| `src/**` | browser |
| `scripts/**`, `tests/**`, `*.config.js` | node **e** browser |
| `supabase/functions/**` | browser + `Deno`, `EdgeRuntime` |
| `docs/**`, `dist/**` | **fuori dal lint** — copie di documentazione, non codice vivo |

…e `no-undef` è accesa. **Il gancio pre-commit lancia già `npm run lint` con
zero avvisi tollerati**: da adesso una variabile inesistente **impedisce il
commit**.

### Il numero chiesto: quanti altri punti come questo

**Due in tutto il progetto**, e il secondo non l'aveva visto nessuno:

| dove | cosa | come si manifesta |
|---|---|---|
| `ListaSpesa.jsx:136` | `da_comprare`, `ordinata` | 🔴 **la schermata non si apre** (fuori da qualunque `try`) |
| `fiscale/DeduzioniFiscali.jsx:144` | `ricarica()` — la funzione lì si chiama `reload()` | 🟡 correggendo la descrizione di una spesa: **il dato si salva**, ma la schermata non si aggiorna e compare un errore tecnico in inglese |

⚠️ **I due sbagliano in due modi diversi, e la differenza è dove stanno**:
il primo nel corpo del componente, quindi rompe tutto; il secondo dentro un
`try/catch`, quindi il difetto si traveste da messaggio d'errore. **Il
secondo sarebbe rimasto lì per mesi.**

### E `npm run build` avrebbe dovuto prenderlo?

**No, e non è un'opinione: è misurato.** Ho rimesso il difetto e lanciato la
build:

```
npm run build   →   ✓ built in 892ms
```

Nessun errore. Chi costruisce il sito non fa analisi di ambito: tratta un
identificatore sconosciuto come una variabile globale che *forse* esisterà a
runtime. **Né il lint né la build lo prendevano** — l'unica cosa che poteva
prenderlo era aprire quella schermata, ed è quello che è successo.

---

## 3 · Come si è rotto, e cosa insegna

Il 19/08 la riga fu corretta per far comparire le voci `ordinata`. Chi l'ha
scritta — io — ha tolto le virgolette senza accorgersene, e **tre garanzie
di fila hanno detto che andava bene**: il lint era cieco su questo, la build
non guarda gli ambiti, e nessuna prova apre una schermata.

> ⚠️ **«Lint pulito» non voleva dire quello che questo progetto credeva.**
> È la stessa forma della prova che non discrimina: un controllo che passa
> sempre non è un controllo, è una rassicurazione. La differenza è che qui
> la rassicurazione era scritta in ogni riepilogo.

⚠️ **Voce annotata e non aperta**: `da_comprare` è scritto a mano in **3
punti su 2 file**, e in `constants.js` non c'è. È un vocabolario chiuso che
vive nel database e viene ridetto a mano — la rete del 17/08 non lo sorveglia
perché nessun elenco lo ridice in un posto solo. Non toccato stanotte.

---

## 4 · Cosa non è verificato

- 🔴 **Nessuna mano ha ancora riaperto la lista della spesa dal telefono.**
  La cura è provata dal lint (che ora discrimina: rimesso il difetto, torna
  rosso) e dai valori letti dal vincolo vero. **Manca l'occhio.**
- ⚠️ **La correzione in Deduzioni fiscali non è stata esercitata**: nessuna
  prova tocca quel gesto, e in produzione non c'è nessuna spesa da correggere.
- ⚠️ **Il lint acceso non è ancora passato da un commit vero**: il gancio lo
  lancerà la prossima volta.

---

## 5 · Cosa abbiamo rovesciato

**Niente.** Nessuna decisione precedente cambia: la configurazione del lint
non era una scelta dichiarata da qualche parte — era il valore predefinito
di oxlint, che nessuno aveva mai messo in discussione. Aggiungere `no-undef`
non rovescia una regola: **rende vera una frase che il progetto diceva già**
(«lint pulito prima di ogni commit», §5 punto 5).

---

## 6 · Cosa NON è stato toccato — in forma ricontrollabile

Chiesto dal validatore che un mandato su dati irreversibili dichiari cosa non
deve cambiare, in una forma verificabile **dopo**. Letto dal database vero a
lavoro finito:

| | valore |
|---|---|
| migrazioni in produzione | **164** |
| **la pulizia `20260820000012` risulta applicata?** | **no — 0** |
| tracce nel registro delle cancellazioni | **26** (invariate) |
| documenti nell'archivio | **10** (invariati) |
| righe in lista della spesa | **2**, entrambe `ordinata` |

⚠️ **Le due righe `ordinata` sono la prova che il difetto mordeva**: erano il
100% della lista, ed erano esattamente quelle che la riga rotta doveva
mostrare.

---

## 7 · Un errore mio nel metodo, dichiarato

Ho lanciato **due batterie di prove insieme** sullo stesso progetto di prova —
una in secondo piano e una in primo. Risultato: **27 file rossi e 132 prove
saltate**, che non erano difetti ma i due giri che si pestavano i piedi.

⚠️ **La trappola è scritta in §8 di CLAUDE.md dal 10/08** (*«le prove
sull'app girano in fila, mai in parallelo: il database è uno solo»*), e
l'ho riaperta credendo che «in background» fosse un'altra cosa.

**Rilanciata da sola: 42 file, 292 prove, tutte verdi.** Più 173 pure.

> ⚠️ E vale la lezione già scritta due volte questa notte: *un rosso non si
> archivia come «rete ballerina» — si misura*. Rilanciando un file da solo è
> passato al primo colpo, e quello ha detto che il difetto era nel come li
> avevo lanciati, non nel codice.
