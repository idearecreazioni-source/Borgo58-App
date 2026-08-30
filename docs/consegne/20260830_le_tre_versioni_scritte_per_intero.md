# Le tre versioni scritte per intero — 30/08/2026, sera

**Commit che sta sotto**: `9e345b44c0573a50e26623686218d6562ca5f28d`
(«Il riepilogo dei sette blocchi dichiara il commit che sta sotto»),
già su GitHub. **Working tree pulito** — verificato con `git status
--porcelain`, che non ha stampato niente, e con `git fetch` prima di
confrontare, non fidandosi della copia locale di `origin/master`.

**Migrazioni che questo riepilogo nomina**, per intero e una alla volta:

* `20260830000009` — la proposta dell'abbinamento fra una voce della carta
  e un prodotto comprato
* `20260830000010` — una parola in comune non è una prova
* `20260830000011` — il controllo che non discriminava

⚠️ **Nessuna delle tre è in produzione nel momento in cui scrivo** (misurato
alle 20:59 del 30/08: 350 applicate, 354 nel repository). Entrano subito
dopo questo documento, ed è **il documento a doverle far entrare**, non il
contrario.

---

## Perché questo riepilogo esiste — è un arretrato, e la rete l'ha trovato

🔴 **`npm run migra` si è rifiutato di toccare il gestionale vero**, nominando
esattamente quelle tre versioni: *«stanno per entrare in produzione e nessun
riepilogo le nomina»*.

⚠️ **E non erano dimenticate: erano scritte in forma abbreviata.** Il
riepilogo [dei sette blocchi del pomeriggio](20260830_i_sette_blocchi_del_pomeriggio.md)
le nomina — «`…009`, `…010` e `…011` di stasera» — e quella forma è
**precisamente quella che la rete avverte di non usare**: tre puntini al
posto di undici cifre non si possono confrontare con un registro di
migrazioni.

🔴 **Il messaggio della rete descriveva il caso da manuale e non questo.**
Dice: *«un riepilogo che scrive “…026 → …032” nomina i due estremi e lascia
mute quelle in mezzo»*. Qui gli estremi non c'erano affatto — **erano
abbreviate tutte e tre**, quindi mute tutte e tre. Il difetto è più semplice
del caso descritto e la cura è la stessa: **il numero si scrive per intero**.

⚠️ **Non si riscrive il riepilogo del pomeriggio** (regola del 23/08, scritta
per le migrazioni e valida identica qui): quel documento è già su GitHub e
racconta cosa è successo quel pomeriggio. Si **aggiunge**. Il costo è un file
in più; il prezzo dell'altra strada sarebbe un documento pushato che cambia
sotto le citazioni di chi l'ha già letto.

---

## Cosa fanno le tre, lette dai loro file

**`20260830000009` — la proposta dell'abbinamento.** Aggiunge
`abbinamenti_carta_proposti()`: data una voce della carta dei vini, propone
quali prodotti comprati potrebbero corrispondere, **mostrando produttore,
descrizione per intero e formato** — non il solo nome. Le parole di Alessio
citate nel file: *«Grillo» contro «Grillo» è testa o croce.*
⚠️ **Legge e basta, non scrive una riga**: propone, non decide.
⚠️ **L'annata non ha una colonna** ed è dichiarato come limite, non come
dimenticanza: la decisione del 30/08 dice che *l'annata è una confezione*,
quindi sta dentro la descrizione dell'articolo. Il gestionale mostra quello
che c'è scritto e **non prova a estrarla**.
⚠️ La somiglianza si conta a **parole in comune** (`pg_trgm` in questo
database non c'è — misurato dal file: le estensioni sono otto), buttando via
le parole di una o due lettere.

**`20260830000010` — una parola in comune non è una prova.** Trovato
guardando la schermata: su «Nero d'Avola» la proposta metteva sotto «Cece
nero», «Gelso nero», «Maialino nero dei Nebrodi». Misurato sul progetto di
prova: **10 proposte su 12** poggiavano su **una parola sola**, e quella
parola stava in **5 prodotti**.
🔴 **La regola nuova non è una soglia**: una proposta ha bisogno **o di
quantità o di specificità** — due parole in comune, oppure una sola che
appartiene a **un prodotto solo**. «Zibibbo» identifica, «nero» no. È una
proprietà dei dati, non un numero tarato a occhio, e resta vera il giorno che
i prodotti saranno mille.

**`20260830000011` — il controllo che non discriminava.** 🔴 Trovato
**rompendo**, non rileggendo. Il terzo controllo della `20260830000010`
doveva dire *«due parole in comune bastano anche se nessuna identifica da
sola»*; rompendo la regola nel modo che quel controllo esiste per prendere,
**la verifica è rimasta verde**. Il perché è la trappola del 27/08: l'esempio
costruito conteneva **per caso** la parola rara che il controllo doveva
escludere, e passava per la ragione sbagliata. Questa migrazione rifà il
controllo **con roba propria**, su due prodotti che condividono due parole
comuni e **nessuna rara** — l'unico caso in cui le due risposte si separano.

⚠️ **Non riscrive la `20260830000010`**: stessa regola del 23/08, stessa
forma con cui la `…032` del 24/08 ha registrato la `…030`.

---

## Cosa abbiamo rovesciato

**Niente.** Questo documento non cambia nessuna decisione: **è** una
decisione già in vigore (§2 di `CLAUDE.md` — nessun push senza il riepilogo
corrispondente) applicata a tre migrazioni che l'avevano avuto solo in forma
abbreviata.

⚠️ Nessuna riga in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Cosa NON è verificato

* **Il contenuto delle tre migrazioni non l'ho scritto io e non l'ho
  rieseguito**: questo riepilogo è compilato **leggendo i loro file**, non
  rifacendo le misure che dichiarano. I numeri citati sopra (10 su 12, 5
  prodotti, 8 estensioni) sono **quelli che i file dichiarano**, non misure
  mie.
* **Nessuna schermata è stata aperta** per questo documento.
* **I numeri veri dell'applicazione** — quante migrazioni risultano dopo, e
  quale è l'ultima — stanno nel riepilogo della sessione di stasera, non
  qui: si conoscono solo dopo, ed è per questo che la rete guarda ciò che sta
  per entrare e non pretende i conteggi in anticipo.
