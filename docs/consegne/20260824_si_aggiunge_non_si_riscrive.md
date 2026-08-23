# Si aggiunge, non si riscrive — e il blocco di pulizia

**24/08/2026 (notte del 23)** — quinta consegna della sessione, dopo
`321f1ac`. Tre cose chieste da Alessio: sistemare le due migrazioni ferme
**senza toccare nessun file già pubblicato**, scrivere dove si troverà la
mina della `…006`, e preparare il blocco unico di pulizia dei residui.

| | |
|---|---|
| HEAD dichiarato | `72348d6` |
| migrazioni nuove | `20260823000023_la_verifica_che_mancava.sql`, `20260823000024_il_gestionale_riparte_pulito.sql` |
| applicate | ✅ progetto di prova (196) — ❌ **non** in produzione (192, invariata) |
| file già pubblicati toccati | **nessuno** |
| prove | 324 pure, tutte verdi |

---

## La regola nuova, scritta in §8

> *«Le migrazioni già applicate non si riscrivono mai: il file racconta
> cosa è successo quel giorno, e correggerlo lo rende una bugia per chi
> ricostruirà da zero fra un anno.»*

⚠️ E vale **anche per le verifiche**: se una verifica era scritta male, la
versione buona sta nella migrazione nuova.

---

## `20260823000023` — la verifica che mancava

Fa due cose e non tocca niente di ieri.

**Controlla che la `…006` sia atterrata tutta.** Si era fermata a metà in
produzione (colonna rinominata, funzioni non ancora riscritte); poi è
stata applicata per intero, ma nessuno aveva più controllato. ⚠️ Cerca il
nome vecchio **non preceduto da `p_`**, perché il parametro
`p_haccp_receiving_temp` resta com'è **per scelta della `…006`**:
rinominarlo romperebbe le chiamate per nome del corridoio. Esito: **4
funzioni col nome nuovo, 0 col vecchio.**

**Rifà la verifica della `…012` e la registra.** Quella di ieri prendeva
in prestito un prodotto vero in chili — e in produzione i prodotti sono
**zero**: l'insert non toccava nessuna riga, nessun rifiuto scattava, e il
controllo leggeva «non è successo niente» come «la regola non funziona».
⚠️ **Anche la ricetta era in prestito**: su un database senza ricette
l'intero blocco sarebbe stato **saltato in silenzio**. La nuova costruisce
tutto da sé.

⚠️ E prova anche il **verso opposto** — una quantità che il campo
conserva deve passare. Senza, la prova sarebbe contenta pure di un
controllo che rifiuta sempre.

⚠️ La registrazione della `…012` è l'**ultima** istruzione, non la prima:
se la verifica si fermasse, non verrebbe mai eseguita.

✅ **Provata al contrario**: spento il controllo sulle quantità, diventa
rossa; riacceso, verde. Zero residui, trigger tornato acceso.

---

## La mina della `…006`, scritta dove può saltare

Non solo nel riepilogo: sta in
[`scripts/prova-ricostruisci.mjs`](../../scripts/prova-ricostruisci.mjs),
che è **l'unico posto da cui quella mina può saltare di nuovo** — una
ricostruzione da zero. Il comando ora rinfresca le statistiche del
catalogo **prima** di applicare le migrazioni, con la storia intera
scritta accanto: la riga incriminata, i due piani misurati, il fatto che
si fermò a metà, la cura che ha funzionato, e cosa fare se un giorno
succedesse lo stesso.

Più due regole nuove nel **§8 di CLAUDE.md**: quella sui due piani
diversi (una famiglia che questi appunti non avevano) e quella sul non
riscrivere le migrazioni applicate.

---

## `20260823000024` — il blocco unico di pulizia

**Pronto, applicato solo sulla prova, fermo in produzione.**

### 🔴 Non erano tre cose, ma sette

Cercandoli **tabella per tabella** invece di partire dai tre noti:

| cosa | quante |
|---|---|
| conti di sala (21 e 22/08) | **28** — uno ancora **aperto** |
| loro righe · agganci ai tavoli · pagamenti | 53 · 32 · 2 |
| prenotazioni «prova 1/2/3» + agganci | 3 + 3 |
| giornate segnate al completo (26/08) | 1 |
| chiamate di turno | 1 |
| allarmi di collaudo | 3 (il quarto resta) |
| tracce nel registro | **98** — vedi sotto |

### 🔴 Le tracce non sono 43, sono 98

E questo **non l'avevo previsto**: cancellare i conti **produce** altre 55
tracce (`order_items` e `order_payments` sono tabelle tracciate). È
esattamente il motivo per cui il registro si svuota **per ultimo** — e ora
il numero è misurato, non stimato.

### La condizione che decide è una proprietà, non una data

Pulisce **solo dove non c'è nessun movimento di denaro e nessuna
fattura** — la frase di Alessio resa misurabile. Fa due lavori insieme:

- **protegge il futuro**: rieseguita dopo il primo incasso non tocca
  niente e lo dice;
- **protegge il progetto di prova**, dove i movimenti sono 90 e i conti
  348: lì lo scenario di collaudo non si tocca. ✅ Verificato applicandola:
  prova prima e dopo, **348 conti e 262 prenotazioni invariati**.

⚠️ E il **meccanismo viene provato lo stesso** dove la condizione è falsa:
la verifica costruisce una prenotazione e un conto propri e controlla che
l'ordine regga (`orders.reservation_id` è `restrict` — la prenotazione
**non** si può togliere prima del conto). Senza, sulla prova sarebbe
passata verde senza provare niente.

### ✅ Prova generale su una copia fedele della produzione

Ripristinato l'ultimo backup in un database usa-e-getta e applicata lì la
pulizia. Zero errori in tutti e cinque i file del ripristino.

| | prima | dopo |
|---|---|---|
| conti · righe · agganci · pagamenti | 28 · 53 · 32 · 2 | 0 · 0 · 0 · 0 |
| prenotazioni · agganci | 3 · 3 | 0 · 0 |
| giornate al completo · chiamate | 1 · 1 | 0 · 0 |
| allarmi | 4 | **1** |
| tracce nel registro | 43 | 0 |
| **ricette · voci di carta** | 14 · 14 | **14 · 14** |
| **impegni · sagome · causali** | 8 · 13 · 17 | **8 · 13 · 17** |

⚠️ Il controllo finale guarda **anche ciò che NON doveva sparire**: un
controllo che guarda solo ciò che è stato tolto non si accorgerebbe di una
cancellazione andata troppo in là.

### Cosa resta fuori, e perché

- ⚠️ **L'allarme del 12/08** («il lavoro lettura-posta non arriva in fondo
  da 170 minuti»): racconta un guasto **vero**, e il §8 dice che gli
  avvisi veri non sono dati di prova. Se lo vuoi via è una riga in una
  migrazione nuova.
- ⚠️ **Le 14 disposizioni della sala** (18, 19 e 23/08) e **le 6 domande
  all'archivio**: sono gesti tuoi, non miei. Lasciate e segnalate.
- **Il menu vero** (14 ricette, 1 menu, 14 voci), **gli 8 impegni con i
  codici F24**, la sala, gli orari, le causali, le regole di
  deducibilità, i parametri fiscali, i 4 accessi, le 12 righe delle
  pulizie privacy: configurazione e storia di ciò che ha funzionato.

---

## Cosa abbiamo rovesciato

**Niente.** La regola sul non riscrivere le migrazioni applicate è nuova e
non ne sostituisce nessuna: rende esplicito ciò che il Contratto §8 già
diceva in forma breve.

---

## Cosa NON è verificato

- **La `…023` e la `…024` non sono mai girate in produzione.**
- **Il ramo che pulisce non è mai girato su un database vero**, solo su
  una copia fedele — che è la cosa più vicina possibile senza toccare
  niente.
- **Nessuna mano vera** ha aperto l'app dopo le migrazioni di ieri sera.
- **Il terzo progetto Supabase** resta fermo: aspetto che tu guardi dal
  pannello se l'organizzazione lo permette senza spendere.

---

## Cosa aspetta il tuo via libera

1. **Il push** dei commit locali — senza, `…022`, `…023` e `…024` non
   possono entrare in produzione.
2. `20260823000023` — sistema il registro delle migrazioni (nessun dato
   toccato).
3. `20260823000024` — **il blocco di pulizia**, con l'elenco qui sopra.
   ⚠️ Rende `20260823000022` (il solo registro) superflua: la `…024` fa
   quel lavoro e altri sei, e nell'ordine giusto. Se vuoi tenerla indietro:
   `npm run migra -- --salta 20260823000022 --conferma`.
4. **L'allarme del 12/08**: lo tolgo o resta?
5. **Le disposizioni della sala e le domande all'archivio**: restano o
   vanno via col resto?
