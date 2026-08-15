# Consegna del 15/08/2026 (sesta) — le causali di sistema fuori dal menu

> ⚠️ **DOCUMENTO POSTUMO.** Scritto il 16/08/2026, **dopo** il push del
> commit. Scostamento dalla regola di `CLAUDE.md` §2, e **l'eccezione
> d'emergenza non si applica**: era una correzione di un difetto in
> produzione, ma **non bloccava Alessio dal vivo** — nessuna spesa era
> ancora stata registrata. Rilevato dal validatore; la rete che impedisce
> il ripetersi è in `20260816_i_riepiloghi_arretrati.md`.

**Commit coperto: `d06c32a`.** Nessuna migrazione: è una correzione di
sola lettura lato client.

---

## 1. Come è emerso

Alessio ha aperto la prima nota per capire come registrare una spesa senza
documento, e nello screenshot che ha mandato si vedeva il menu delle
causali aperto. Dentro, insieme alle sue, comparivano **«Versamento in
banca»**, **«Differenza di cassa in meno»** e **«Rimborso al titolare»** —
causali che non sceglie lui: le scrive il gestionale quando conta il
cassetto, versa in banca o rimborsa un'anticipazione.

---

## 2. Perché non era un fastidio estetico

⚠️ **Sceglierne una a mano per una spesa vera l'avrebbe fatta sparire dai
costi in silenzio.** Dal Blocco 6 le causali di sistema sono trattate come
**spostamenti di denaro e non come spese**: `rettifiche_fiscali()` e
`costi_da_classificare()` le saltano apposta, perché un versamento in
banca non è un costo.

Una spesa vera archiviata sotto «Rimborso al titolare» non sarebbe
comparsa da nessuna parte — **senza nessun errore**. È la forma di guasto
che questo progetto cerca di non produrre: non una cosa che si rompe, una
cosa che tace.

Il difetto l'ho introdotto io il 15/08 creando quelle causali, e non
l'avevo previsto: le avevo protette dal *cancellarle* (vincolo del
database) ma non dallo *sceglierle*.

---

## 3. Cosa è cambiato

- Il filtro sta in **`listCausali()`**, cioè nell'unico posto da cui le
  schermate chiedono «quali causali posso scegliere». Gli altri due
  chiamanti — sconti/omaggi in cassa e chiusura conto in sala — chiedono
  un genere che non ha causali di sistema, quindi non cambiano. Verificato
  cercando tutti i chiamanti, non assunto.
- In **Cassa → Causali** restano visibili, perché quella schermata serve a
  vederle tutte: con scritto «la scrive il gestionale», **senza** la
  casella del costo fisso e **senza** il pulsante per spegnerle.
- ⚠️ Il pulsante non c'è invece di esserci e fallire: il vincolo del
  database già le protegge, e **un tasto che dà errore ogni volta insegna
  solo a diffidare dei tasti**.

**Nota di processo**: Alessio aveva chiesto di gestirsele da solo. Gli è
stato risposto che su queste tre **non è possibile** — il vincolo del
database rifiuta la disattivazione — e ha quindi chiesto la correzione.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| le causali di sistema non compaiono fra quelle scegliibili | **prova automatica nuova** |
| …ma esistono ancora, e sono **5** | **provato** |
| il vincolo che impedisce di spegnerle o marcarle costo fisso | **già provato**, invariato |
| tutti i chiamanti di `listCausali` controllati | **3 su 3**, due non impattati |
| prove automatiche | **86 verdi** (erano 85) |
| lint, build | puliti |
| produzione | **107 migrazioni**, invariate: nessuna migrazione in questa consegna |

---

## 5. Cosa NON è verificato

- **Nessuno ha registrato un movimento di prima nota in produzione**: in
  quel momento ce n'erano zero. La correzione è verificata dalla prova
  automatica e dalla lettura dei chiamanti, non dall'uso.
- **Il caso che ha generato il difetto non si è mai verificato**: nessuna
  spesa era stata archiviata sotto una causale di sistema, quindi non c'è
  niente da sanare in produzione. Verificato col connettore: zero
  movimenti.
