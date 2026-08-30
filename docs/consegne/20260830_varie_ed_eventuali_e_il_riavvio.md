# «Varie ed eventuali», e il telefono dopo un riavvio — 30/08/2026

> **Blocco 5** del mandato del 30/08. Chiude **M4**; **T1** è fatta a metà,
> e la metà che manca è di Alessio.
>
> **Il commit che sta sotto questo riepilogo: `2e93004`.**
>
> **Migrazione `20260830000001`** — applicata al progetto di prova,
> **non ancora in produzione**: aspetta il suo push.

---

## 1. «Imballaggi e asporto» → «Varie ed eventuali» (5a)

Delle sei categorie dei materiali di consumo proposte il 29/08 ne cambia
**una sola**, con la sua ragione: **l'asporto non lo farà.**

⚠️ **Cambia anche il codice nascosto**, non solo il nome che si legge:
`imballaggi` → `varie_materiali`. Una riga che si chiama «Varie ed
eventuali» e dentro dice `imballaggi` è una frase destinata a diventare
falsa per chi leggerà il database fra sei mesi.

### 🔴 E cambiare un codice non è gratis — l'ho scoperto rompendo, non leggendo

Per vedere scattare il controllo «nessun prodotto orfano» ho inserito un
prodotto in «imballaggi». **Me l'ha rifiutato il database prima di
arrivarci**: `ingredients.category` è una **chiave esterna** verso
`categorie_ingrediente.codice`, con `on update no action`.

Due conseguenze, e sono opposte:

- **un prodotto orfano è impossibile per costruzione** — il caso da cui mi
  stavo difendendo non può accadere. Il controllo resta, **dichiarato come
  rete che non può scattare**: se un giorno quella chiave sparisse, sarebbe
  l'unico posto che se ne accorge;
- **ma se un prodotto ci punta, è la RINOMINA a essere respinta**, con un
  errore di vincolo in inglese che non dice né cosa fare né perché. Per
  questo il controllo vero sta **PRIMA** dell'update, in italiano, e nomina
  la via d'uscita:

> «Non posso rinominare «Imballaggi e asporto»: ci sono già 1 prodotti
> dentro (…). Spostali in un'altra categoria dal Magazzino, poi riapplica.»

**Provato**: costruito il caso, il rifiuto è arrivato con quella frase e col
nome del prodotto dentro.

### La misura

**Zero** prodotti in `imballaggi`, in produzione **e** sul progetto di prova.
⚠️ La migrazione **non si fida di questa misura: la rifà.** *Una misura di
ieri non è una condizione di oggi.*

### Rotta in due modi, su controlli diversi

| rottura | cosa fallisce |
|---|---|
| rimessa la categoria vecchia | il controllo (1): «la categoria «imballaggi» esiste ancora» |
| un prodotto dentro la categoria vecchia | il **controllo che viene prima**, in italiano, col nome del prodotto |

⚠️ **La verifica è stata estratta e lanciata da sola** (lezione del 26/08):
rilanciare la migrazione intera rimetterebbe a posto la rottura prima di
metterla alla prova.

---

## 2. Il telefono bianco dopo un riavvio (5b)

Alessio: dopo un riavvio il gestionale di prova non riparte, il tunnel punta
a una porta vuota, e **dal telefono si vede solo bianco senza che niente
spieghi cosa fare**.

### Si può fare che riparta da solo? Sì — MISURATO

La cartella «Esecuzione automatica» di Windows esiste su questa macchina ed
è già in uso (contiene tre voci). Un file messo lì parte a ogni accensione:
**non serve niente di nuovo, serve una copia.**

C'è ora **`scripts/avvio/Avvia da solo il gestionale di prova.bat`**, pronto
da copiare, con le istruzioni dentro (Windows+R → `shell:startup` → trascina
una copia).

### 🔴 E il file NON è quello che c'è già sul Desktop, apposta

`Avvia Borgo 58.bat` lancia `npm run dev`, che si collega al **locale vero**.
⚠️ **Un file che parte da solo a ogni accensione e apre il gestionale vero è
il modo più facile di scrivere dati finti nei dati veri senza accorgersene.**
Quello nuovo lancia `npm run dev:prova`, e lo scrive in cima insieme al
segno da guardare (il pallino arancione in basso a destra).

### ⚠️ Perché è «fatta a metà»

**Non l'ho installato io.** Mettere un file nella cartella di avvio automatico
è una modifica al suo computer, non al gestionale: la regola di questo
progetto è che io scrivo e lui installa. Il file è pronto; il gesto è suo, ed
è **la domanda n. 5**.

### Cosa NON ho misurato, e perché

**Cosa vede esattamente il telefono quando il server è spento.** Per
misurarlo avrei dovuto spegnere il gestionale sulla porta 5173, che è quello
che Alessio sta usando — e la regola è di non fermarlo mai. Il «bianco» è
**riferito da lui** e coincide con quanto misurato il 28/08 da chi ha scritto
`scripts/telefono.mjs` («da lì veniva la pagina bianca sul telefono»), ma
**non l'ho visto io stanotte**.

⚠️ E la seconda metà della sua richiesta — *«che almeno il telefono dica "il
gestionale sul computer non è acceso" invece di restare bianco»* — **non è
stata costruita**, e la ragione è di merito: quella pagina dovrebbe servirla
qualcosa che resta acceso quando il gestionale è spento, cioè **un secondo
programma sempre in funzione**. È più macchinario di quanto valga il
problema, *se* il gestionale riparte da solo. Se dopo l'avvio automatico il
bianco capitasse ancora, allora vale la pena — ed è la **domanda n. 6**.

---

## Cosa abbiamo rovesciato

**Una voce, ed è un commento di codice, non una decisione scritta.**

- **cosa era stato deciso e quando** — 29/08/2026, nel commento della
  migrazione dei materiali: *«"Altro" sta in entrambi apposta — sdoppiarla
  darebbe due righe che dicono la stessa cosa»*.
- **la ragione di allora** — buona: due contenitori generici per lo stesso
  mondo sono due posti dove finisce la stessa roba, e chi cerca deve
  guardare in tutti e due.
- **cosa si decide adesso** — i materiali hanno **«Varie ed eventuali»**, e
  «Altro» resta con `ambito = 'entrambi'`. Quindi per un materiale di
  consumo ci sono **due** contenitori generici.
- **perché la ragione di allora non vale più** — 🔴 **vale ancora, e questo è
  il prezzo che accettiamo per stanotte.** Alessio ha chiesto quella
  categoria con quel nome; toccare «Altro» per farla quadrare vorrebbe dire
  prendere al posto suo una decisione che non ha preso. La tensione è
  **dichiarata dentro la migrazione** e sta come **domanda n. 4**: quale
  delle due tenere lo decide lui, e si chiude con tre righe.

Registrato in [`docs/decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Rilettura obbligatoria

### Cosa NON ho verificato con gli occhi

- **La schermata di un materiale di consumo** dopo la rinomina: la categoria
  nuova è nel database e nel catalogo, ma **non ho aperto la scheda di un
  prodotto per vederla nella tendina**.
- **Il file di avvio automatico**: non è mai stato eseguito. So che
  `npm run dev:prova` funziona perché l'ho usato tutta la notte, non perché
  abbia lanciato quel `.bat`.
- **Il telefono bianco**: vedi sopra — non misurato da me.

### Cosa ho contato senza leggerlo

- «Le sei categorie dei materiali»: contate dalla query, e la migrazione le
  ricontrolla.

### Quali mie affermazioni sono diventate false mentre lavoravo

- La prima versione della migrazione diceva che il controllo sugli orfani
  era **ciò che rende sicuro il cambio di codice**. È falso: lo rende sicuro
  la chiave esterna, e quel controllo non può scattare. L'ho riscritta
  **prima di committarla**, e adesso il commento dice come stanno le cose.

### Quali conteggi sono pavimenti

- «Zero prodotti in `imballaggi`» è esatto oggi, su tutti e due i database:
  non è un pavimento. Lo diventa domani, ed è per questo che la migrazione
  rifà la misura.

### Cosa ho lasciato sul progetto di prova

**Niente.** Il prodotto `MISURA30AGO-orfano` creato per la rottura è stato
cancellato **per nome**, e la categoria rimessa: controllato dopo — **zero**
righe `MISURA30AGO%` fra i prodotti, **zero** fra le prenotazioni, sei
categorie di materiali, 344 migrazioni.
