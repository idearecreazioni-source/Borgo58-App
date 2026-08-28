# Blocco 1 — allineare il gestionale vero, e i cinque numeri che l'intervallo lasciava muti

**28/08/2026** · Blocco 1 del mandato.

| | |
|---|---|
| **HEAD dichiarato** | `8ee7167` — *I cinque numeri che l'intervallo lasciava muti* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | nessuna |
| **Migrazioni applicate in produzione** | 🔴 **NESSUNA — l'applicazione è stata BLOCCATA** |

---

## 🔴 IL BLOCCO NON È RIUSCITO, e la ragione non è il lavoro

`npm run migra -- --conferma` **è stato rifiutato dall'ambiente in cui giro**,
non dal gestionale: il comando che scrive nel database vero richiede un
permesso che questa sessione non ha e non può darsi da sola. Non l'ho aggirato.

⚠️ **Quello che è pronto lo è davvero**: le quindici migrazioni dei due blocchi
di ieri hanno superato tutti i controlli di `npm run migra` in sola lettura —
già passate dal progetto di prova, committate, su GitHub, e con l'arretrato
dei riepiloghi chiuso.

**Serve un gesto di Alessio.** La domanda è la n. 1 in fondo.

---

## Cosa è stato fatto, ed era la condizione per applicare

Il mandato chiede, prima di toccare la produzione, di **verificare che ogni
migrazione in partenza sia nominata da un file in `docs/consegne/`**.

🔴 **Quattro su quindici non lo erano.** `20260827000027`, `…028`, `…029` e
`…031` non comparivano per intero in nessun riepilogo del progetto.

⚠️ **E non erano lavoro non documentato.** Appartengono tutte al commit
`d037ade`, cioè al riepilogo *Le categorie diventano dati, e MEMO impara gli
elenchi*, che le descrive una per una nel testo. Quello che mancava era il
**numero**: il riepilogo le scriveva come **intervallo**, `…026 → …032`, e un
intervallo nomina i due estremi e lascia mute le cinque in mezzo.

**La cura**: i sette numeri sono stati scritti per intero in quel riepilogo,
con una riga che dice perché. Nessuna parola del testo è stata cambiata.

⚠️ È la forma di difetto che il commento della soglia in `scripts/comune.mjs`
**descriveva già** — è il motivo per cui le migrazioni fra il 10/08 e il 15/08
non passerebbero il controllo — e che non era mai stata chiusa per il futuro.
Il Blocco 6 la chiude.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna decisione è stata toccata.

---

## Voci di `docs/DECISIONI.md` toccate

**Nessuna.**

---

## Rilettura

- **Cosa NON ho verificato con gli occhi** — niente di questo blocco è
  osservabile a schermo: è un file di documentazione e un comando rifiutato.
- **Cosa ho contato senza leggerlo** — i quindici numeri delle migrazioni in
  attesa vengono dall'uscita di `npm run migra`, non da un conteggio dei file.
- **Quali mie affermazioni sono diventate false mentre lavoravo** — nessuna.
- **Conteggi che sono pavimenti** — nessuno: «quattro su quindici non nominate»
  è esatto, verificato con una ricerca su tutti i file di `docs/consegne/`
  prima e dopo la correzione.
- **Cosa ho lasciato sul progetto di prova** — niente.
