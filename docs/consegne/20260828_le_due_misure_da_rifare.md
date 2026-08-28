# Blocco 6 — le due misure da rifare

**28/08/2026** · Blocco 6 del mandato. Le ha chieste Alessio, non il validatore.

| | |
|---|---|
| **HEAD dichiarato** | `d906008` — *La rete dei riepiloghi guardava un giro troppo tardi* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | **nessuna** |
| **Prove** | 525 di calcolo (6 nuove), 449 sull'app (3 nuove) — verdi |

---

## 6a · IL FOOD COST, SU QUANTE RICETTE

### Il rilievo

Il riepilogo del 27/08 diceva **due numeri per la stessa cosa**: in apertura
«la prova ha 116 ricette», e poi la misura di garanzia — *«il food cost non si
è mosso»* — dichiarata su **106 ricette, 481,7078**. Dieci di differenza, mai
spiegate. Ed è la garanzia su cui poggiava tutto il blocco della separazione
prodotto / ingrediente.

### La misura, rifatta

| | |
|---|---|
| ricette che esistono | **116** |
| righe di `v_recipe_costs` | **116** — nessuna esclusa dal calcolo |
| ricette con almeno una riga di ingredienti | **106** |
| ricette **senza nessuna riga** | **10** |
| somma dei `food_cost_base` su tutte e 116 | **481,7078** |
| somma sulle sole 106 | **481,7078** |

**I due numeri non erano in contraddizione**: erano due conteggi diversi — le
ricette che *esistono* e le ricette che *hanno qualcosa da costare* — e nessuno
diceva quale fosse quale. **Il totale non cambia includendole, perché
contribuiscono zero.**

### 🔴 E la conseguenza è quella che Alessio ha nominato

Le dieci sono **ricette senza ingredienti**: Anelletti al forno, Busiate al
pesto trapanese, Cassata siciliana, Crudo di gambero rosso, Involtini di pesce
spada, Maialino nero dei Nebrodi, Risotto agli agrumi, Sarde a beccafico,
Sformato di broccoli e ricotta, Spaghetti con le vongole.

Il loro zero è uno zero **per costruzione, non una misura**. Quindi la garanzia
«il food cost non si è mosso» vale su **106 ricette, non su 116**: sulle altre
dieci non c'era niente da muovere.

### La rete nuova, e cosa congela

Il totale **non mostra** la cosa che conta: uno zero si somma come niente.
`tests/app/food-cost-quante-ricette.test.js` congela tre proprietà:

1. **nessuna ricetta è esclusa dal calcolo** (la vista ne ha quante ne esistono);
2. 🔴 **uno zero nel food cost è SOLO una ricetta senza ingredienti** — se una
   ricetta *con* ingredienti costasse zero, quel numero si legge «piatto
   economico» ed è invece «non lo so»;
3. **nessuna riga di ricetta punta a un ingrediente senza prezzo** — misurato:
   133 ingredienti, **nessuno senza prezzo**, 16 a prezzo zero, e **nessuno dei
   16 compare in una ricetta**.

⚠️ La terza serve perché la seconda **non la prende**: un ingrediente senza
prezzo dentro una ricetta che ne ha altri quattro non porta il totale a zero —
lo porta **più in basso del vero, in silenzio**.

### Le rotture, che danno esiti diversi

| rottura | food cost | esito |
|---|---|---|
| una ricetta con un ingrediente prezzato **e uno a zero** | **4,4805** | 🔴 rossa **solo la terza** — il caso silenzioso |
| tolto il prezzato: resta solo quello a zero | **0,0000** | 🔴 rosse la **seconda e la terza** |

Dati di prova creati con identificativi miei e cancellati per identificativo:
**116 ricette e 481,7078 dopo, come prima**.

---

## 6b · LA RETE DEI DOCUMENTI CHE NON SI È RIFIUTATA

### La misura, e cambia la correzione

Le tre domande del mandato, con la risposta misurata:

| domanda | risposta |
|---|---|
| la rete esiste nel codice? | **sì** — `migrazioniSenzaRiepilogo()` in `scripts/comune.mjs`, chiamata da `migra.mjs` come «Vincolo 0» |
| controlla al momento sbagliato? | **sì**, ma per una ragione scritta |
| è aggirabile dal comando? | **no** — `--salta` e `--fino-a` cambiano *cosa* si applica, non *se* il controllo gira |

🔴 **LA RETE NON È STATA AGGIRATA E NON È ROTTA.** Guarda ciò che è **già**
applicato — scelta deliberata e documentata a lungo nel codice, perché il
riepilogo contiene i **numeri veri dell'applicazione**, che si conoscono solo
dopo. Per come è fatta **non può fermare la PRIMA applicazione non
documentata**: fa scattare il blocco al giro successivo.

✅ **Ed è esattamente quello che è successo.** Le cinque migrazioni del 27/08
sono entrate, e al giro dopo la macchina si è fermata — c'è il file
`20260827_arretrato_le_cinque_migrazioni_senza_riepilogo.md` che lo racconta.
La rete ha fatto quello che sapeva fare, **in ritardo di un giro**.

### 🔴 E c'era un secondo buco, mai misurato: la forma abbreviata

Un riepilogo che scrive «`…026` → `…032`» nomina i **due estremi** e lascia
mute le cinque in mezzo. **Stanotte quattro migrazioni su quindici erano in
quello stato** (Blocco 1).

⚠️ **La trappola era già DESCRITTA** nel commento della soglia — è il motivo
per cui le migrazioni fra il 10/08 e il 15/08 non passerebbero il controllo — e
non era mai stata chiusa per il futuro.

### La cura

Un **Vincolo 0-bis** che guarda le migrazioni che stanno per **entrare**.

⚠️ **Non pretende i numeri veri**, che si conoscono solo dopo: pretende che il
riepilogo **esista e nomini le versioni per intero**. La differenza è tutta qui
— un documento senza i numeri dell'applicazione non è «un documento con dei
buchi da riempire»: è il racconto del lavoro, che a quel punto è finito e
committato. I numeri si aggiungono dopo, come sempre.

La ricerca è stata estratta in una **funzione pura** (`versioniNonNominate`)
apposta: finché stava dentro la funzione che legge la cartella, l'unico modo di
provarla era avere davvero quei file — quindi **il caso che conta, l'intervallo,
non si poteva provare**.

### Provata al contrario, contro il comando vero

```
A) una migrazione finta SENZA riepilogo
   → FERMO: queste migrazioni stanno per entrare in produzione e nessun
     riepilogo le nomina. · 20260828000001 · 20260828000002 · 29990101000001

B) la stessa, CON un riepilogo che la nomina
   → passa il controllo, e cade sul vincolo successivo:
     FERMO: queste migrazioni non risultano applicate sul progetto di prova.
```

⚠️ Nel caso A la rete ha segnalato **anche le mie due migrazioni del Blocco 2**,
che in quel momento non avevano ancora un riepilogo. Ha funzionato su di me.

I due file finti sono stati rimossi.

---

## Cosa abbiamo rovesciato

**Una cosa, e va detta perché tocca una scelta scritta con cura.**

- *Cosa era stato deciso e quando* — 16/08/2026: la rete dei riepiloghi guarda
  ciò che è **già** applicato, e non ciò che sta per esserlo. Il commento in
  `scripts/comune.mjs` lo spiega: pretenderlo prima «costringerebbe a scrivere
  un documento con dei buchi da riempire, cioè a fingere».
- *La ragione di allora* — il riepilogo contiene i numeri veri
  dell'applicazione, noti solo dopo. Vera, e non è cambiata.
- *Cosa si decide adesso* — **il controllo di prima resta intero**, e gliene si
  affianca uno **prima**, che chiede una cosa diversa e più debole: che il
  documento **esista e nomini le versioni**.
- *Perché la ragione di allora non vale più* — **vale ancora**, e infatti non è
  stata toccata. Quello che è cambiato è che si sono separate due domande che
  quel commento trattava come una: *«il riepilogo ha i numeri?»* (dopo) e *«il
  riepilogo esiste e dice quali versioni entrano?»* (prima). ⚠️ **Il prezzo è
  reale e va dichiarato**: l'ordine scritto in CLAUDE.md §2 — *commit → push →
  `npm run migra` → riepilogo* — adesso vuole il riepilogo **prima** del
  comando, coi numeri aggiunti dopo. In pratica è già quello che si fa (il
  riepilogo del 27/08 esisteva prima dell'applicazione, e diceva «nessuna in
  produzione»).

Una riga in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Voci di `docs/DECISIONI.md` toccate

**Nessuna.** La rete dei riepiloghi non ha una voce lì dentro: la sua ragione
vive solo nel commento del codice, ed è una delle cose che ho verificato prima
di cambiarne il momento.

---

## Rilettura

- **Cosa NON ho verificato con gli occhi** — niente di questo blocco è
  osservabile a schermo. Il comportamento della rete l'ho visto **eseguendo il
  comando vero**, che è la cosa giusta da guardare qui.
- **Cosa ho contato senza leggerlo** — le 116 righe di `v_recipe_costs` e i 133
  ingredienti sono conteggi; **i dieci nomi delle ricette senza ingredienti li
  ho letti uno per uno** ed è quello che ha permesso di dirne il nome.
- **Quali mie affermazioni sono diventate false mentre lavoravo** — una, ed è
  istruttiva: avevo scritto nel controllo della migrazione del Blocco 2 che
  `p_scadenza`… no. Qui: la prima versione della verifica di 6b contava le
  righe restituite da `avvisi_del_gestionale()` per dimostrare che il corpo era
  intero. **Era sbagliata**: quella funzione filtra gli avvisi a conteggio zero,
  quindi su un database tranquillo sarebbe stata verde per il motivo sbagliato.
  Sostituita con un controllo sul **corpo**.
- **Blocchi non aperti** — vedi il riepilogo finale.
- **Conteggi che sono pavimenti** — nessuno in 6a. In 6b, «quattro su quindici»
  è esatto.
- **Cosa ho lasciato sul progetto di prova** — niente: la ricetta e le due
  righe delle rotture sono state cancellate per identificativo, e il totale del
  food cost è tornato a 481,7078.
