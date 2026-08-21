# La produzione è vuota

**21/08/2026** · migrazione **`20260820000012`** applicata al database vero.
**165 migrazioni in produzione.**

La condizione che la teneva ferma è caduta: Alessio ha confermato che i
quattro documenti veri (atto notarile, partita IVA, contratto di locazione
Parlato, business plan) sono scaricati e al sicuro fuori dal gestionale.

---

## 1 · Il backup, prima di tutto

| | |
|---|---|
| dove | `Desktop\Backup Borgo 58\2026-08-21_1144` |
| peso | **6,1 MB**, di cui **5,0 MB** di documenti |
| contenuto | 100 tabelle, **602 righe**, **13 file** del deposito |

⚠️ **I 13 file ci sono tutti**, verificati uno per uno — compresi i quattro
documenti veri. Il mio primo conteggio ne diceva 1 perché guardava solo il
primo livello della cartella: **corretto misurando, non fidandomi**.

✅ **E il backup è stato dimostrato funzionante**, non solo prodotto: rimesso
in piedi sul progetto di prova, **602 righe su 602, zero differenze**.

---

## 2 · La rimisura, e cosa non tornava

Il perimetro era cambiato di nuovo. Ogni scostamento rispetto all'elenco:

| voce | l'elenco diceva | misurato oggi | |
|---|---|---|---|
| conti | 8 | **9, di cui 1 APERTO** | 🔴 il collaudo di ieri sera ha aperto T6 |
| rettifiche di giacenza | non c'era la voce | **1** | 🔴 l'allineamento magazzino di ieri sera |
| spunta «sala piena» a mano | non c'era la voce | **1**, sul 26/08 | 🔴 messa da Alessio ieri sera |
| clienti | non c'era la voce | **4**, uno con mail e consenso | 🔴 il collaudo del consenso |
| avvisi | «5 su 12 sono veri» (19/08) | **16**: 7 rincari, 6 scadenze, 3 altri | |
| impegni di Alessio | 6 nominati dal mandato | **8** | già dichiarato ieri: c'è anche *Deposito bilancio* e *Tassa concessione libri sociali* |
| tracce lasciate dai documenti | +10 | **+15** | 🔴 tre stime diverse in tre giorni: +10, poi +14, ora **+15** |

⚠️ **Le tracce sono l'esempio del perché si rimisura**: il numero è cambiato
**tre volte**, e la migrazione non contiene nessuno di quei numeri — li
**fotografa e li confronta**, quindi non poteva fallire per questo. *Un
guardiano che esprime una proprietà sopravvive a un perimetro che cambia; uno
che contiene una fotografia no.*

### Le tre novità erano già coperte

- **`rettifiche_giacenza`** è cancellata **prima** dei lotti e degli
  ingredienti (`restrict`): verificato leggendo il vincolo vero.
- **Il conto aperto** si cancella insieme agli altri: `orders` non ha trigger
  che si oppongano, e non è una tabella tracciata.
- **La spunta «sala piena»** ⚠️ **RESTA, ed è voluto** — vedi §5.

---

## 3 · La prova sui dati veri, prima della produzione

Il backup di stamattina è stato **rimesso sul progetto di prova** e la
pulizia applicata **lì**, sui dati veri di oggi. Ha retto:

```
Il residuo di collaudo è andato via. Le lapidi sono passate da 26 a 41:
è previsto, documents è una tabella tracciata.
```

Poi la stessa migrazione in produzione, **da sola**: nient'altro è entrato
nel database vero in questo giro.

---

## 4 · Cosa non è cambiato — verificato DOPO, come chiesto

| deve restare | misurato dopo |
|---|---|
| la pianta reale della sala | **13 sagome, 14 disposizioni** ✅ |
| lo scenario della Proiezione | **1**, con i suoi **12 mesi** ✅ |
| causali di cassa | **17** ✅ |
| regole di deducibilità | **6** ✅ |
| orari di servizio | **14** ✅ |
| formati tavolo | **2** ✅ |
| lettori POS | **2** ✅ |
| aziende | **2** ✅ |
| ruoli | **4** ✅ |
| impegni scritti da Alessio | **8** ✅ — tutti e sei i nominati, più i due già dichiarati |
| l'avviso vero `lavoro_fermo_lettura_posta` | **1** ✅ |
| migrazioni | **164 → 165** ✅ |

### E cosa è andato a zero

conti · prenotazioni · preventivi · clienti · documenti · posta ·
ingredienti · lotti · fornitori · righe di lista · scarichi · rettifiche di
giacenza · impegni generati — **tutti a 0**.

**Il deposito documenti: 13 file → 0.**

🔴 **E la voce che conta per domani: `partite in scadenza` = 0.**

---

## 5 · Due cose restano, e vanno dette

### La spunta «sala piena» del 26 agosto

⚠️ **Resta accesa, ed è la regola che funziona, non una dimenticanza.**
`giornate_sold_out` con `preventivo_id` vuoto vuol dire *«l'ha messa Alessio a
mano»*, e **nessun ricalcolo la tocca** — è scritto nel trigger dal 20/08, e
la ragione è che *una sala che si sblocca in silenzio fa scoprire il buco
troppo tardi*.

Quella del 26/08 l'ha messa lui ieri sera per collaudo. **Va tolta da lui**,
dalla schermata, in due tocchi. Toglierla da qui vorrebbe dire che il
gestionale può disfare una sua decisione senza dirglielo.

### Due avvisi di collaudo sopravvivono

Degli avvisi ne sono andati **13** (7 `rincaro_*`, 6 `scadenze_*`) e ne
restano **3**. Uno è quello vero del 12/08. Gli altri due —
`corridoio_salva_preventivo` e `evento_annullato_…` — sono nati dal collaudo,
**ma sono la storia di due guasti veri**: il criterio della migrazione è sui
tipi, non sulla provenienza, e allargarlo avrebbe cancellato anche la prova
che quelle reti funzionano.

⚠️ **`evento_annullato_64f8be91…` nomina un preventivo che adesso non esiste
più.** Non è un difetto — un registro di avvisi racconta cosa è successo,
non cosa esiste ancora — ma è bene saperlo prima di trovarcelo.

---

## 6 · La misura che ha contraddetto il mandato

Il mandato diceva: *«I file del deposito, poi la pulizia»*.

🔴 **Misurato, l'ordine è l'inverso.** `deposito:orfani` toglie i file che
**nessun documento nomina più**: lanciato prima, ne trovava **3** su 13 —
gli altri 10 avevano ancora la loro riga. Lanciato dopo la pulizia, li trova
tutti e 13.

Fatto nell'ordine che funziona, e dichiarato invece di eseguito alla lettera.
*Ogni volta che una misura contraddice il mandato, vince la misura.*

---

## 7 · La rete che si è messa di traverso, e aveva ragione

`npm run migra` si è **rifiutato di applicare la pulizia**: le tre migrazioni
di stanotte erano in produzione e **nessun riepilogo le nominava per intero**.

Non è stato aggirato. È stato scritto il riepilogo arretrato
([i cinque difetti del collaudo](20260821_i_cinque_difetti_del_collaudo.md)),
committato, e solo allora la rete ha lasciato passare.

⚠️ È la seconda volta in dodici ore che un controllo di questo progetto ferma
un'operazione irreversibile e ha ragione. La prima era `--fino-a`, che
avrebbe applicato **questa stessa migrazione** un giorno prima del previsto.

---

## 8 · Lo stato finale

| | |
|---|---|
| lint | zero avvisi (**con `no-undef` acceso da stanotte**) |
| prove pure | **173 passate** |
| prove sui dati veri | **292 passate**, 0 saltate |
| migrazioni in produzione | **165** |
| progetto di prova | ricostruito e riazzerato — ⚠️ aveva i dati veri dal ripristino, ora non più: **0 clienti con nome vero** |

---

## 9 · Cosa non è verificato

- 🔴 **La verifica vera è domani alle 10:00**: l'avviso delle scadenze non
  deve partire. Non perché rotto — perché **non c'è più niente in scadenza**
  (misurato: 0 partite con data di scadenza). È arrivato per sei giorni di
  fila su merce che non esiste, ed è il motivo di questa pulizia.
- ⚠️ **Nessuna mano ha ancora aperto il gestionale vuoto.** Le schermate che
  prima mostravano dati adesso mostreranno elenchi vuoti, ed è il momento in
  cui si scopre se qualcuna dice «non c'è niente» quando dovrebbe dire
  «non ho ancora niente da mostrare».
- ⚠️ **I documenti veri non sono più nel gestionale**, e il deposito è vuoto:
  l'unica copia dentro il perimetro del progetto è il backup di stamattina.
  **Va portato fuori dal computer.**

---

## 10 · Cosa abbiamo rovesciato

**Niente.**

⚠️ La deroga del 13/08 che teneva i dati di collaudo in produzione — *«il
limite non è una data ma un evento: la prima fattura vera»* — **non è stata
rovesciata: si è esaurita**. È stata rinnovata più volte con la sua ragione
(erano l'unica dispensa su cui provare scarico e produzioni), e finisce
adesso perché Alessio ha deciso che il gestionale deve partire pulito.

⚠️ **La ragione di allora resta vera**, ed è il prezzo che si paga: da oggi
non c'è più nessuna dispensa, nessuna ricetta, nessun prezzo su cui provare
il magazzino che scende e le produzioni. Quelle funzioni sono costruite e
provate nelle migrazioni, **ma nessuno le vedrà lavorare finché non entrerà
merce vera.**
