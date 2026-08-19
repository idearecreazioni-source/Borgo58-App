# Il registratore telematico — quello che serve è il simulatore che si rifiuta di stampare

**Decisioni di Alessio, sera del 20/08/2026.** Da fare **quando tocca**: non è
il prossimo lavoro, e il registratore vero **non è ancora scelto**.

---

## 🔴 Prima la misura: metà di questo esiste già

Chiesto al database prima di progettare, com'è regola qui.

| pezzo | c'è? |
|---|---|
| `orders.documento_fiscale` | ✅ vocabolario chiuso: vuoto · `scontrino` · `fattura_da_emettere` · `fattura` |
| `orders.documento_numero`, `orders.documento_emesso_il` | ✅ già in tabella, con un vincolo che pretende numero **e** data quando è una fattura |
| `conti_da_fiscalizzare(entità, dal, al)` | ✅ l'elenco dei conti incassati **senza documento**, sulla **serata di servizio** |
| `quadratura_fiscale(...)` | ✅ incassato · fiscalizzato · da fiscalizzare, con la frase che ne dichiara il limite |
| `ricavi_non_fiscalizzati`, `imposte_e_fiscalizzato` | ✅ già collegati al motore fiscale |
| **un simulatore di registratore** | 🔴 **non esiste niente** |
| **l'elenco che si fa notare a fine serata** | 🔴 non esiste: oggi è una schermata da aprire di propria iniziativa |
| **la segnalazione manuale «lo scontrino non è uscito»** | 🔴 non esiste come gesto di sala |

⚠️ **Conseguenza sul disegno**: questo mandato **non crea un modulo nuovo**,
estende quello che c'è. In particolare `documento_emesso_il` è già la colonna
che regge la decisione sullo scarto fra le due giornate (sotto): **non serve
inventarne un'altra**.

---

## Le decisioni di Alessio, e la ragione di ognuna

### 1 · Il simulatore serve a verificare che i due mondi coincidano, e basta

Incassi della sala contro chiusura fiscale. **Niente memoria fiscale, niente
progressivi, niente aliquote per reparto** — *«il resto è parte del
registratore, su cui non abbiamo controllo»*.

⚠️ **E resta GENERICO**: il modello vero non è scelto, quindi il simulatore
**non imita nessun apparecchio**. Imitarne uno adesso significherebbe legarsi
a un protocollo che potrebbe non essere quello comprato.

### 2 · 🔴 Ma il simulatore che serve è quello che SI RIFIUTA DI STAMPARE

È il cuore del mandato, ed è il rovesciamento del modo ovvio di costruirlo.

Il gesto previsto in sala è: **il cameriere chiude il conto sul gestionale e
lo scontrino esce da solo**. Quindi il caso che fa male **non è quello in cui
i totali coincidono** — quello è la giornata normale. È **il conto chiuso e lo
scontrino non uscito**: nel gestionale l'incasso c'è, fiscalmente non esiste,
e il cliente è già fuori dalla porta.

Il simulatore deve saper fare almeno:

- **stampante muta** (nessuna risposta);
- **risposta a metà** (il protocollo si interrompe);
- **doppia stampa** (lo stesso conto battuto due volte);
- ⚠️ **e la più insidiosa**: la stampante che risponde **«fatto»** e stampa
  una **pagina bianca**. Nessun protocollo la copre, perché il registratore
  crede di aver stampato.

Alessio: *«deve aiutarci a simulare tutte le situazioni»*.

### 3 · Il conto si chiude lo stesso, e finisce in un elenco «da fiscalizzare»

**La sala non si blocca mai davanti al cliente.** È la stessa regola già
applicata allo scarico di magazzino il 13/08: una scrittura di conseguenza non
impedisce il gesto principale.

### 4 · 🔴 Ma l'elenco deve FARSI NOTARE

Se a fine serata non è vuoto, Alessio vuole **essere avvisato prima di poter
chiudere la giornata** — non trovarselo in una schermata da aprire di propria
iniziativa.

⚠️ *Un elenco che nessuno guarda non è una rete.* È la stessa lezione della
soglia di magazzino del 13/08 (tutto acceso, e muto) e delle letture tagliate
del 19/08 (il segnale sta dove si guarda, non in un registro tecnico).

### 5 · La segnalazione manuale la può fare chiunque sia in sala

«Questo scontrino non è uscito» è un gesto di **tutto lo staff**, non del solo
titolare.

⚠️ **Serve anche col registratore più moderno**, ed è la ragione che lo rende
non facoltativo: esiste un buco che **nessun protocollo copre** — la stampante
che risponde «fatto» e stampa una pagina bianca. Solo un occhio umano la vede.

### 6 · La fiscalizzazione passa tutta dal gestionale

Si **ristampa da lì** quando la stampante torna. **Niente battute a mano sul
registratore**: sarebbe una seconda porta d'ingresso agli incassi, e due porte
che scrivono la stessa cosa sono la premessa del doppio conteggio — la regola
«chi comanda sui ricavi» del 15/08.

### 7 · 🔴 Lo scarto fra le due giornate si DICHIARA, non si appiana

Uno scontrino ristampato il giorno dopo porta **la data di quando esce**,
mentre l'incasso appartiene **alla serata in cui il cliente ha pagato**.

**Decisione di Alessio**: *l'incasso resta nella serata giusta*, e accanto si
dichiara **che è stato fiscalizzato dopo** e **dove lo si ritroverà** nella
quadratura del registratore.

⚠️ **Non spostarlo per far coincidere i due mondi**: la serata risulterebbe
**più magra del vero**, ed è precisamente il difetto che questo gestionale
insegue da giorni — un numero più corto con l'aria di essere intero.

⚠️ **Le due date esistono già**: la serata è `serata_di_servizio(closed_at)`,
il giorno del documento è `documento_emesso_il`. Il lavoro è **farle vedere
insieme quando divergono**, non aggiungerne una terza.

---

## I blocchi, in ordine di dipendenza

### Blocco 1 — l'elenco che si fa notare

Il pezzo che vale di più **e non ha bisogno di nessun hardware**. `conti_da_fiscalizzare()`
c'è già: manca l'avviso che compare **quando si chiude la giornata**, e la
segnalazione manuale di sala.

⚠️ **Va fatto per primo anche perché è utile senza registratore**: dal primo
giorno di apertura, se una fattura resta da emettere, quell'elenco parla.

### Blocco 2 — il simulatore che si rifiuta

Un finto registratore col suo interruttore per ciascuno dei quattro guasti.
**Generico**, nessun protocollo vero.

### Blocco 3 — la ristampa e lo scarto dichiarato

La ristampa dal gestionale, e la riga che dice *«incassato la sera del X,
fiscalizzato il Y»* dove le due date divergono.

### Blocco 4 — il registratore vero

Solo **dopo** che il modello è scelto, e solo se risponde alla domanda qui
sotto.

---

## Prove che possono fallire

- ⚠️ **La prova che conta di più è quella del guasto**, non quella del giorno
  buono: chiuso un conto con la stampante muta, l'incasso c'è **e** il conto è
  nell'elenco da fiscalizzare. Se la prova gira solo sul caso in cui la stampa
  riesce, non sta misurando niente — è la trappola del caso vuoto del 17/08.
- **La pagina bianca**: il registratore risponde «fatto», e la segnalazione
  manuale rimette il conto nell'elenco. **Deve poterlo fare un utente dello
  staff**, non il solo titolare: se la prova gira col titolare, non sta
  provando il gesto vero.
- **Lo scarto delle giornate**: un conto della sera del 1° fiscalizzato il 2
  **resta nei ricavi del 1°**, e la quadratura del 2 lo dichiara. ⚠️ La prova
  legge **entrambe** le date.
- **La doppia stampa** non produce due incassi.
- 🔴 **E la rottura**: togliere l'avviso di fine giornata e verificare che una
  prova diventi rossa. *Se non diventa rossa, l'elenco è tornato a essere una
  schermata che nessuno apre.*

---

## Cosa questo mandato NON copre

- memoria fiscale, progressivi, aliquote per reparto — sono del registratore;
- l'invio dei corrispettivi all'Agenzia — lo fa l'apparecchio;
- le fatture elettroniche, che restano a Fatture in Cloud (mandato cumulativo,
  blocco 4);
- il modello di registratore, che non è scelto.

---

## ⚠️ Il quesito da fare al fornitore PRIMA di comprare

**Non è codice, ed è la cosa che va decisa prima di tutto il resto.**

> *«Questo modello comunica il proprio stato al gestionale — carta finita,
> coperchio aperto, errore di stampa — e con quale collegamento?»*

⚠️ **Non è una cosa che si aggiunge dopo: o il modello lo fa, o non lo fa.**
Se non lo fa, il blocco 1 (l'elenco che si fa notare) e la segnalazione
manuale di sala smettono di essere una rete di riserva e diventano **l'unica**
difesa contro un incasso che fiscalmente non esiste.

Sta anche in [`CODA_E_DECISIONI.md`](../CODA_E_DECISIONI.md), fra le cose in
capo ad Alessio, accanto alle domande da fare alla banca.
