# L'assistente si chiama MEMO — 27/08/2026

**HEAD dichiarato**: `7901fa2` — «L'assistente si chiama MEMO». Questo
riepilogo è l'ultimo commit della consegna e sta sopra di lui.

**(vero)** = misurato sul gestionale di Alessio · **(prova)** = sul progetto
di prova.

---

## Il censimento: otto in elenco, **cinque** oltre

La regola dei cinque posti chiedeva di cercare **tutti** i punti dove
l'assistente è nominato. Oltre agli otto del mandato ne sono venuti fuori
**cinque**:

| dove | cosa diceva |
|---|---|
| `Detta.jsx` | la didascalia: «Quello che **l'assistente** capisce con sicurezza lo scrive da sé» |
| `Fotografa.jsx` | l'errore di lettura: «non sono riuscito a leggere **la spesa dell'assistente**» |
| `DocumentoDetail.jsx` | «**l'assistente** di questo documento conosce solo la scheda» |
| `SchedeProdotti.jsx` | «Quello che **l'assistente** deduce vale» |
| `RicettaDetail.jsx` | «non li ha ancora visti né una persona né **l'assistente**» |

### 🔴 E uno era più di un nome

In `RicettarioHome.jsx` c'era:

> «L'assistente completa i campi mancanti. **Gli allergeni li confermi tu.**»

La seconda frase è **la regola che Alessio ha tolto il 25/08** — un allergene
dedotto vale come confermato. Il 27/08 quella regola era già stata trovata
scritta in **quattro** posti dopo essere stata rimossa da uno solo: **questo è
il quinto**, ed è saltato fuori censendo un'altra cosa.

⚠️ **Non era una frase innocua**: diceva a chi legge di fare un lavoro che il
gestionale non chiede più.

---

## Cosa NON ha preso il nome, e perché

| | ragione |
|---|---|
| i pulsanti **«Fotografa»** e **«Premi e parla»** | sono il **gesto**, non il nome. Il titolo dice dove sei, il pulsante dice cosa fare |
| «Quanto sta costando», «9 foto lette», la riga del tetto | invariati per decisione |
| **tutte le risposte dopo un gesto** | lì il nome sposterebbe la colpa su un personaggio invece di dire cosa fare |
| i **nomi tecnici** (`assistenteFoto.js`, `assistente-archivio`) e i commenti | rinominarli è lavoro di codice, non di parole — e cambiarne metà darebbe **due vocabolari nello stesso file** |
| il **sorvegliante notturno** | non esiste ancora: non si battezza |

**Controprova fatta** (misurata sul codice): in `calcoli/voce.js`,
`calcoli/foto.js`, `calcoli/schedaLetta.js`, `calcoli/erroriDiRete.js` e in
tutte le funzioni online, **MEMO non compare mai**.

---

## Visto a schermo (prova)

| | |
|---|---|
| titoli | **MEMO foto** · **MEMO voce** |
| pulsanti | «Fotografa» · «🎙 Premi e parla» — **intatti** |
| «assistente» nei testi delle due schermate | **zero** |
| riga dei costi | «**MEMO**, questo mese: 0,49 € su 10,00 €» |
| menu laterale | MEMO foto · MEMO voce · MEMO |
| schede prodotto | «Compila con **MEMO** (25)» |
| posta in arrivo | «**MEMO** legge e propone cosa fare» |
| «Quanto sta costando» | invariato |

⚠️ **La spesa è salita da 0,20 a 0,49 €** (prova): sono le mie chiamate all'API
di oggi per provare la Scorciatoia. Sul gestionale vero non è cambiato niente.

---

## Cosa abbiamo rovesciato

**Niente.** Voci di `docs/DECISIONI.md`: **una sezione nuova** («MEMO
(l'assistente)») con quattro voci — il nome, i due pulsanti che restano, il
nome che non va nelle risposte, e le tre cose invariate.

E una decisione in vigore è stata **rimessa in piedi**: la rimozione del
cancello sugli allergeni del 25/08, che era ancora raccontata in un quinto
posto.

---

## RILETTURA

**Quanti posti raccontavano la stessa cosa**: **otto in elenco + cinque
trovati censendo = tredici**, più **uno** che raccontava una regola abolita.

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: tutto è **letto dal DOM**.
- **Niente da un telefono vero.**
- **Il menu laterale l'ho letto dal DOM aperto da codice**, non toccandolo.
- **La Scorciatoia rinominata «MEMO»**: ho cambiato le istruzioni, ma il nome
  sul telefono lo dà Alessio quando la costruisce — non l'ho visto.

**Cosa ho contato senza leggerlo**
- Le **438 prove sull'app** e le **505 pure**: ho letto il totale.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- 🔴 *«Le occorrenze di "assistente" nei testi visibili sono dieci»*:
  **falso** — sei erano code di commenti multi-riga; i testi veri erano
  **quattro**, e li ho trovati solo aprendo le schermate.

**Quali blocchi non ho aperto**: **nessuno.** Il mandato è chiuso su tutti e
quattro i blocchi.

---

## CODA · IL MODULO CHE RISULTAVA «NON SVILUPPATO»

Segnalato da Alessio dopo il resto: la Dashboard diceva ancora «Modulo non
ancora sviluppato» mentre MEMO foto e MEMO voce funzionavano **da quella
notte** — ha dettato dal telefono e dall'orologio, e il promemoria è arrivato
in Agenda.

⚠️ **È la stessa famiglia della frase sugli allergeni trovata poche ore
prima**: un posto rimasto indietro rispetto a quello che il gestionale fa.

**Misurato da dove veniva** (l'elenco scritto a mano in `src/data/modules.js`):

| | |
|---|---|
| moduli in elenco | **16** |
| con una schermata | **13** |
| senza | **3** — Ricerca Ricorrente, Monitoraggio Social, MEMO |
| di questi, **diventati falsi** | **uno**: MEMO |

Gli altri due lo dicono ancora **ed è vero** (misurato: nessuna rotta, nessuna
schermata). *Si corregge quello che è diventato falso, non tutto.*

⚠️ **E MEMO non prende una rotta sua**, che sarebbe stata la cura frettolosa:
le sue schermate sono **due** e stanno già fuori dai moduli, perché sono gesti
che partono da qualunque punto. Una terza voce che porta a una delle due
sarebbe un doppione; una che porta a un riepilogo sarebbe una schermata
inventata per riempire un elenco. Il modulo dichiara le sue **porte**, il menu
non lo ripete, e chi arriva alla pagina a mano ci trova le due porte.

**Visto a schermo** (prova): menu con **due** voci MEMO e non tre; la pagina
del modulo dice «Questo modulo si usa da due porte, in cima al menu» coi due
collegamenti; Ricerca Ricorrente e Monitoraggio Social continuano a dire «non
ancora sviluppato».

**Prove**: app **62 file / 438 prove** (uscita 0), pure **44 / 505**, lint
**zero avvisi**, build verde.

**Migrazioni**: repository **288**, produzione **270**, prova **288**.
**Diciotto in attesa del push** — nessuna nuova in questo giro. Ordine:
`git push` di Alessio → `npm run migra -- --conferma` → riepilogo → secondo
push.

**Trappole nuove**: nessuna. La forma incontrata qui — una regola tolta che
resta scritta altrove — è già la prima voce della §8, e questo giro ne è la
**conferma sul campo**: il quinto posto è saltato fuori due giorni dopo,
censendo un'altra cosa.
