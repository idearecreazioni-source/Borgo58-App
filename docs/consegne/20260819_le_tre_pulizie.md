# Tre pulizie — un censimento in disaccordo, due file di servizio, due contatori cresciuti in silenzio

**Nessuna migrazione.** Sono tre cose piccole che hanno in comune una sola
forma: **qualcosa che dice il falso senza essere rotto**.

---

## ⚠️ Cosa NON è verificato

1. ⚠️ **Che togliere `supabase/.temp/` non spenga niente è una misura, non
   una prova con le mani**: gli strumenti di questo repository leggono
   `.env.db`, non quel file. Chi usasse il comando `supabase` a mano dovrà
   rifare `supabase link` una volta — e a quel punto sceglierà lui a quale
   progetto.
2. ⚠️ **I due contatori sono misurati sulla produzione a 137 migrazioni** (in
   sola lettura): quando le otto in coda saranno applicate il primo cambierà,
   ed è dichiarato dove.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 1 · Il censimento della giornata operativa era in disaccordo col codice

Tre righe di
[`referti/20260819_censimento_giornata_operativa.md`](../referti/20260819_censimento_giornata_operativa.md)
dicono una cosa e il codice consegnato ne fa un'altra:

| punto | il censimento | il codice | chi ha ragione |
|---|---|---|---|
| `versa_in_banca` | serata | calendario | **il codice** |
| `scarichi_senza_ricavo` | serata | calendario | **il codice** |
| rimborso al titolare | «da decidere» | calendario | **il codice**: la decisione è stata presa |

Il perimetro l'ha **ristretto Alessio** dopo che il censimento era stato
scritto: seguono la serata **due gesti soli**.

⚠️ **Le righe vecchie non sono state cancellate.** Erano la proposta con cui
si è arrivati alla decisione; sopra c'è un riquadro che dice che erano in
disaccordo e perché. *Senza, chiunque riaprisse quel documento fra sei mesi
confronterebbe la tabella col database e aprirebbe **tre segnalazioni che non
sono difetti**.* Un censimento superato dalle decisioni prese dopo di lui non
è più una misura: è una fonte di falsi allarmi.

---

## 2 · Due file di servizio puntavano un clone pulito alla produzione

`supabase/.temp/linked-project.json` era **committato**, e dentro c'era il
riferimento del progetto **vero**: un clone appena fatto nasceva col comando
`supabase` già collegato ai dati del locale. `supabase/.temp/cli-latest` è la
versione dello strumento, cioè un file che cambia da sé.

⚠️ **Perché è più di un fastidio**: è il genere di cosa che un domani fa
applicare a mano una migrazione sui dati veri **credendo di essere sul
progetto di prova** — e in questo progetto la separazione fra i due database
è una delle poche reti che proteggono il locale.

Tolti dal repository e messi fra gli ignorati, con la ragione scritta accanto
alla riga.

⚠️ **La cancellazione è finita nel commit sbagliato**, `7e75a48` (il portiere
delle uscite future), perché era già in attesa nell'indice di git quando quel
commit è stato fatto — e il suo messaggio non la nomina. **Dichiarata invece
che riscritta**: correggere la storia toglierebbe a chi controlla il modo di
confrontare un commit con quello che diceva di essere.

---

## 3 · Due contatori cresciuti in silenzio

### Le funzioni senza guardiano: **13 dichiarate, 15 vere**

Le funzioni che scavalcano la RLS e che lo staff può eseguire senza che
nessuno chieda chi sia. Il numero stava in CLAUDE.md dal 13/08.

⚠️ **Sei delle quindici non erano mai state dichiarate per nome**: le tre
della lista della spesa (il 13/08 erano nominate solo come gruppo, e *un
elenco per categorie non si può confrontare*), `funzioni_multi_tabella`,
`incasso_conto` e `uscite_future` — quest'ultima era un difetto vero, chiuso
dalla [consegna del portiere](20260819_il_portiere_che_mancava.md).

**E il numero ha smesso di essere un numero**: adesso è un elenco che il
database si costruisce dal catalogo, congelato nome per nome in
`tests/app/permessi.test.js`.

### Le tracce di cancellazione: **25 dichiarate, 26 vere**

La ventiseiesima è **legittima, e la sua provenienza è la parte che conta**:
`reservations`, 18/08 alle 18:56, con `reservation_date` **1991-06-07** —
la data-marcatore della verifica di `20260818000008` (il conto che sa da
quale prenotazione nasce). Quella verifica esercita **la pulizia notturna
della privacy**, e quella pulizia scrive nel registro una riga **senza nome,
telefono, email e note**.

✅ **Controllato riga per riga, non dedotto**: nome e telefono **non ci sono
proprio** nella copia conservata. Quindi la traccia in più non è un residuo
di prova dimenticato: **è la dimostrazione che la regola della privacy del
10/08 funziona** — resta il fatto della cancellazione, se ne va la persona.

⚠️ Ed è il motivo per cui non è stata tolta: `deleted_records` non si può
ripulire da nessuno dall'app, e giustamente.

---

## Per Alessio, in una riga

Tre cose che raccontavano il falso senza essere rotte: un documento superato
dalle tue decisioni, un file che puntava al database vero, e due conteggi
scritti a mano che non erano più veri.

---

## Le domande

Nessuna.

---

**Commit del lavoro**: `e6428dc` — «Le tre pulizie, e i due contatori che
smettono di essere numeri». ⚠️ Quel commit porta **anche questo file**, che è
documentazione: qui la consegna è fatta di sole correzioni a documenti, e
spezzarla in due commit avrebbe prodotto un commit di lavoro vuoto.
**Migrazioni**: nessuna.
**Working tree**: pulito.
