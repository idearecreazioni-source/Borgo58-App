# Il pollice, e la chiave che non valeva — 27/08/2026

**HEAD dichiarato**: `f57743a` — «Le istruzioni della Scorciatoia dicono a
quale gestionale vale la chiave». Questo riepilogo è l'ultimo commit della
consegna e sta sopra di lui.

**(vero)** = misurato sul gestionale di Alessio o sui suoi transcript ·
**(prova)** = sul progetto di prova.

---

## 0. IL TASK CHE GIRAVA — vivo apposta

**Misurato**: i due processi attivi sono `npm run dev:collaudo` (il server di
prova che ho riaperto io, PID 13218) e `npm run dev:prova` (quello di
Alessio, di ieri). Nessuno dei due aspetta niente: sono server. Il primo
risponde, e serve il progetto di **prova** (prova).

### E la domanda rimasta aperta: la forma sana l'ho applicata ovunque?

**Sì — zero attese malate** (vero, misurato sul transcript di oggi col metro
provato prima su **cinque** casi di risposta nota).

🔴 **E il metro ha dovuto essere corretto due volte prima di rispondere.** Le
prime due versioni classificavano per *quale parola si aspetta*; il
discriminante vero è un altro: **può non finire mai?**

| forma | finisce sempre? |
|---|---|
| `until <parola del successo>` senza tetto | 🔴 no |
| lo stesso con `break` dopo N giri | ✓ sì |
| `for i in 1..N; do … break; done` | ✓ sì |
| `sleep N` nudo | ✓ sì |

Col metro giusto, i quattro comandi che il setaccio segnalava sono **falsi
allarmi**: contengono la stringa «until grep» perché la stavo **cercando**
(erano `grep` e `ps | grep`), non perché eseguano un'attesa. E l'unico
«malato» della versione precedente era la **dimostrazione** scritta apposta
stamattina, che ha un tetto di quattro giri.

⚠️ Terza volta oggi che un setaccio dà falsi allarmi. *Un setaccio che cerca
una forma nel testo trova anche i comandi che cercavano quella forma.*

---

## 1. IL POLLICE — misurato, poi spostato

**Decisione di Alessio**: il gesto principale sta in basso, dove arriva il
pollice di chi tiene il telefono in una mano.

### Dov'era prima (prova, misurato a 375 punti)

| schermata | il gesto stava a | alto |
|---|---|---|
| Fotografa | **167 punti** dal bordo alto | 12 mm |
| Detta | **186 punti** dal bordo alto | 12 mm |

Il terzo superiore dello schermo: il punto più lontano dal pollice.

### Le due regole stanno insieme — era la cosa da misurare

La voce del 21/08 vieta lo scorrimento laterale. **Misurato dopo lo
spostamento** (prova, 375 punti), su tutt'e due:

| | |
|---|---|
| barra larga | **375 su 375** — sbordo **zero** |
| scorrimento laterale | **no**, né prima né dopo |
| cosa resta coperto | **niente** |
| pulsante | **12,00 mm** |

**Sul computer** (1280 punti, prova): la barra torna `static`, sfondo
trasparente, nessun bordo, spaziatore `display:none`. **Niente è cambiato.**

### 🔴 Lo spaziatore non è un dettaglio

Una barra `fixed` **copre** quello che sta sotto, e — misurato prima di
scrivere — né `/fotografa` né `/detta` avevano un respiro in fondo (`pb-…`).
Senza spaziatore, la prima riga lunga sarebbe sparita in silenzio. Il
componente tiene nel flusso esattamente l'altezza che occupa.

### E `gestoInBasso` nasce SPENTO

`ScattaFoto` vive in **due** posti: su «Fotografa» la foto **è** la
schermata; sulla scheda di un prodotto è **uno dei tanti campi**. Un pulsante
inchiodato in fondo direbbe che la foto conta più del prezzo e degli
allergeni. Per questo la barra è un componente a sé e non una modifica dentro
`ScattaFoto`.

### Nessun'altra schermata ha un'azione sola

**Misurato**: sette file usano il gesto principale (`tocco-azione`); di
questi, **cinque** hanno molte azioni (Sala, Bar, Cucina, Preconto, Pulizia,
Spesa spicciola). Restano le **due** nominate dalla decisione.

⚠️ **Quali altre contino è di Alessio**, non mia: il criterio («l'azione è una
sola e si fa in piedi») è suo. È la domanda 2.

⚠️ **La barra è larga tutta la pagina**, non su un lato. La decisione dice
«sul lato della mano che tiene il telefono», e quale sia quella mano il
gestionale non lo sa: larga tutta arriva a tutte e due.

---

## 2. LA CHIAVE DELLA SCORCIATOIA — nessuna delle tre

**Misurate una per una prima di toccare niente:**

| ipotesi | esito |
|---|---|
| (a) chiave della prova, indirizzo del vero | 🔴 **falsa, ed era invertita**: `bnwqgpuyzmzujxfbtyvs` **è il progetto di prova** (vero, letto da `ambiente.js` e `comune.mjs`). Il vero è `oudjuqbqszisdtwzbxdo`. Chiave e indirizzo stavano **sullo stesso progetto**. |
| (b) cancellata ripulendo i dati di prova | **falsa**: c'è ancora — «iPhone di Alessio», creata **26/08 alle 23:44**, **usi 0**, mai usata, non revocata (prova) |
| (c) il controllo è cambiato oggi | **falsa**: `voce_apri_sessione` confronta ancora l'impronta sha256, e **provato davvero** — una chiave appena creata **passa**, una inventata è **respinta** (prova) |

**E la prova che chiude** (prova): chiamato l'indirizzo di prova con una
chiave di prova, la funzione online ha risposto correttamente — `esito:
non_capita`, dettatura registrata, **0,0269 €**. Il meccanismo è **sano**.

🔴 **Quindi: la chiave che Alessio ha in mano non combacia con quella
salvata.** Da qui non posso sapere perché — la chiave si vede una volta sola
e il gestionale ne conserva solo l'impronta.

### La cosa sotto, che è più grossa della chiave

Le istruzioni mostravano **un** indirizzo — sempre quello giusto, quello del
gestionale aperto — ma lo dicevano **in codice**: venti lettere a caso,
illeggibili. Chi le legge mentre lavora sulla prova **non ha modo di
accorgersi** di quale dei due sta guardando, e una chiave creata su uno non
vale sull'altro.

⚠️ **E il modo in cui sbaglia è muto**: «Questa chiave non vale» sembra una
chiave copiata male, non un gestionale diverso.

**Adesso, con le parole e non col codice** (prova, visto a schermo):

- *«Quella che crei qui vale per **il database di prova**, e solo per quello.
  Se ne fai una mentre guardi l'altro gestionale, questa smette di
  funzionare — e la Scorciatoia dirà soltanto "Questa chiave non vale".»*
  (cambia anche colore fra i due gestionali)
- la chiave appena nata lo **ripete**, che è il momento in cui la si copia;
- passo 4: *«È l'indirizzo di questo gestionale, cioè **il database di
  prova**»*;
- passo 8: riconosce **«Questa chiave non vale»** per nome ed elenca le tre
  ragioni in ordine di frequenza, con la cura.

⚠️ **Un difetto di lingua visto a schermo**, non leggendo il codice: *«è
quello di il database di prova»* — il nome porta già l'articolo dentro.
Riscritto coi due punti.

---

## Cosa abbiamo rovesciato

**Niente.** Voci di `docs/DECISIONI.md` toccate: **due**.
- *«Il gesto principale sta dove arriva il pollice»*: da **NON ANCORA
  FATTO** a ✅ fatto sulle due schermate nominate, con la misura che dimostra
  che le due regole stanno insieme.
- **aggiunta** la decisione sulle istruzioni della Scorciatoia.

E una decisione presa oggi è stata **rispettata**: il segno «DATI VERI» resta
il pallino — non l'ho toccato.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
- **Nessuna immagine**: tutto è **letto dal DOM**.
- **Niente da un telefono vero**: la larghezza è emulata a 375 punti.
- **Il pollice non l'ha provato un pollice**: che 12 mm in basso siano
  comodi con una mano occupata è una cosa che si prova tenendo il telefono.
- **La Scorciatoia non l'ho provata dall'orologio**: ho provato l'indirizzo
  con `curl`, che è la stessa chiamata ma non lo stesso gesto.

**Cosa ho contato senza leggerlo**
- Le **505 prove pure**: ho letto il totale.
- Le **sette schermate col gesto principale**: contate da un `grep`, poi
  guardate una per una per capire quante azioni hanno.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- 🔴 *«Il setaccio delle attese trova un caso malato»*: **falso**, era la
  dimostrazione che avevo scritto io, e ha il tetto. Metro corretto **due
  volte**.
- 🔴 *«Le istruzioni della Scorciatoia si leggono»*: **falso** — a schermo
  dicevano «di il database di prova». Visto guardando.

**Quali blocchi non ho aperto**
- **Blocco 2** — le cinque cose viste col telefono (lo stato «Pronta per la
  carta» che si contraddice, il pulsante inerte, la tabella che sborda, il
  conteggio 5/4, lo storico del costo). **Nessuna toccata.**
- **Blocco 3** — MEMO. **Non aperto.**

**Prove**: pure **505** su 44 file (uscita 0), lint **zero avvisi**, build
verde. Le prove sull'app non le ho rilanciate dopo il pollice: **non ho
toccato logica**, solo disposizione — ed è una cosa che nessuna prova di
questo progetto guarda.

**Migrazioni**: repository **288**, produzione **270**, prova **288**.
**Diciotto in attesa del push.** Ordine: `git push` di Alessio →
`npm run migra -- --conferma` → riepilogo → secondo push.

**Trappole nuove** (§8 di `CLAUDE.md`): due — l'identificativo tecnico dentro
un'istruzione; il metro che classifica per la parola invece che per «può non
finire mai».
