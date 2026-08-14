# Consegna del 14/08/2026 (undicesima) — la prenotazione si prende dalla pianta

**Commit della consegna: `9af6f32`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `f398564` | la sala in piedi sul tablet delle Comande |
| `bdd2ba4` | la prenotazione si prende guardando la sala — migrazione `20260814000010` |
| `af4054e` | le prove: 52 → 55 |
| `0e38fb6` | dal telefono la sala si vedeva a metà, e non si poteva scorrere |
| `9af6f32` | `CLAUDE.md`: la coda della sala, e il primo conto su tre tavoli |

**Applicata in produzione**: `20260814000010`. **96 migrazioni**.
`operazioni-atomiche` reinstallata (**v19 → v20**).

Coda del blocco Sala, tutta nata **dall'uso**: tre giri di prova di
Alessio sulla schermata vera, tre difetti che nessuna verifica scritta
prima avrebbe trovato.

---

## 1. ✅ Il collaudo principale è passato da una mano vera

Il criterio 1 del mandato — *«tre sagome accostate, in sala si apre UN
conto, non tre»* — era dichiarato «provato dentro la migrazione, mai da
una mano vera». **Ora lo è**: Alessio ha aperto T7, T8 e T9 accostati dal
tablet, e in cima alla schermata è comparso `T7 · T8 · T9 aperto`, con
una sola comanda.

È l'unica cosa che questo blocco non poteva dimostrare da solo.

---

## 2. La prenotazione si prende guardando la sala

> *«al momento la prenotazione non si prende guardando la piantina e non
> va bene. come faccio a sapere se c'è posto così?»*

Aveva ragione, e **il pezzo mancante era uno solo**: assegnare una
prenotazione toccando i tavoli c'era già (§5 del mandato); prendere una
prenotazione **nuova** da lì, no. Al telefono si esce dalla pianta, si
compila un modulo altrove e si torna a cercare dove metterli — cioè non
lo si fa.

**Un tocco su una sagoma vuol dire tre cose, e non possono essere
ambigue:**

| Situazione | Cosa fa il tocco |
|---|---|
| c'è un lavoro in corso | aggiunge o toglie il tavolo dalla scelta — **anche se è già promesso**: è il secondo giro, che al telefono si fa |
| tavolo libero | comincia una prenotazione nuova su quello |
| tavolo già promesso | apre **quella** prenotazione: si modifica, si sposta su altri tavoli, si annulla se il cliente disdice |

⚠️ **L'ultima riga è la risposta di Alessio a una mia domanda sbagliata.**
Gli avevo proposto tre strade per il tavolo già occupato (lascialo fare /
chiedi conferma / impediscilo). Nessuna delle tre: *«vorrei la
possibilità di spostare una prenotazione già assegnata a un tavolo o di
modificarla se il cliente vuole togliere o aggiungere coperti»*. Il
problema non era il permesso — era che **toccare un tavolo occupato non
faceva niente**.

### Nasce confermata e senza email — e la ragione conta

Decisione sua: al telefono la conferma gliel'ha appena data a voce, e
un'email che ripete la stessa cosa è rumore.

⚠️ **Non è stato costruito nessun interruttore per ottenerlo, ed è il
punto interessante**: l'email dell'11/08 parte su un **cambio di stato**
verso `confermata`, mai su un inserimento. Una prenotazione che *nasce*
confermata non attraversa nessun cambio di stato, quindi non manda
niente. Stessa cosa per Telegram, che guarda `source = 'form_pubblico'`
mentre questa nasce `interno`.

**Sono due comportamenti dedotti da come è fatto il resto, quindi la
verifica li controlla invece di fidarsene** — dentro la migrazione e
nelle prove automatiche. Un domani qualcuno potrebbe cambiare quel
trigger per un'altra ragione, e il silenzio sparirebbe senza che nessuno
lo colleghi a questa scelta.

Prenotazione + righe dei tavoli sono **due tabelle** → corridoio (B4).

---

## 3. Due difetti di schermo, e il secondo era peggio del primo

Trovati aprendo il gestionale dal tablet e dal cellulare.

**Il tablet**: la sala è larga il doppio di quanto è profonda, e sdraiata
su uno schermo verticale si vedeva a metà. Ora in Comande è **in piedi**:
ingresso in fondo, sala alta in cima, e si scorre in giù — che è il verso
in cui si scorre con un dito. Le etichette si rigirano di un quarto per
restare leggibili; l'unica che corre lungo la sagoma è «Chef Table»,
perché su un bancone profondo 70 cm scritta dritta sborderebbe sui
vicini.

**Il cellulare**, e qui i difetti erano due:

1. **La sala non si girava da sola**: in Comande era in piedi perché
   gliel'avevo detto io, altrove restava sdraiata comunque. Ora la pianta
   **si misura addosso al riquadro** e si mette in piedi quando sdraiata
   non ci sta. ⚠️ La soglia non è un numero di pixel scelto a occhio: è la
   stessa che tiene le sagome toccabili, ed è in **centimetri veri** con
   la calibrazione del dispositivo — due schermi con gli stessi pixel
   possono essere grandi il doppio.
2. ⚠️ **Non si poteva scorrere**, ed è ciò che rendeva il primo difetto
   irreparabile a mano. L'SVG aveva `touch-none`: serve a non far
   scappare il dito mentre si trascina un tavolo, ma **spegneva anche lo
   scorrimento di tutta la pianta**. La metà non visibile non era
   scomoda: era *irraggiungibile*. Ora il divieto sta **solo sulle sagome
   trascinabili** — il dito sul tavolo lo muove, il dito sul pavimento
   sposta la vista.

La misura avviene con `useLayoutEffect`, prima che il browser disegni:
altrimenti a ogni apertura la pianta si vedrebbe girare per un istante.

---

## 4. Un difetto evitato scrivendo, che vale la pena scrivere

I campi del modulo erano definiti **dentro** il componente. Così sarebbero
stati un componente *nuovo* a ogni render: React li avrebbe smontati e
rifatti a ogni lettera digitata, e **il cursore sarebbe saltato fuori
dalla casella dopo il primo carattere**.

È lo stesso modo di perdere ciò che si sta scrivendo del difetto del
12/08 (la schermata che ricaricava e buttava via le modifiche), solo più
veloce a farsi notare — e per questo meno pericoloso. Spostati a livello
di modulo.

---

## 5. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata due volte**: idempotente |
| **il conto su tre tavoli accostati, da una mano vera** | ✅ **provato in produzione da Alessio** |
| la prenotazione nasce **confermata** e **interna** | **provato** (migrazione + prova automatica) |
| **nessuna email al cliente** | **provato**, contando gli invii registrati |
| nome e telefono ripuliti dagli spazi | **provato** |
| l'etichetta del tavolo è fotografata | **provato**: rinominando il tavolo non cambia |
| il secondo giro con rischio scritto | **provato** |
| cambiare i tavoli a una già presa | **provato**: sostituisce l'insieme, non lo somma |
| rifiuti: senza tavoli, senza nome, data passata, zero persone | **quattro rifiuti** |
| la prende anche lo **staff** | **provato** |
| il ruolo **anonimo** non la può prendere | **rifiutato** (42501) |
| geometria della pianta in piedi, misurata sul disegno vero | 12,0 × 24,1 cm reali, ogni tavolo **1,05 cm** — il minimo del progetto |
| etichette leggibili in piedi | **tutte a 0°** tranne «Chef Table», lungo il bancone |
| prove automatiche | **55 verdi** (erano 52) |
| lint, build | puliti |
| **produzione** | **96 migrazioni**, corridoio **v20** |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| dati di prova lasciati in produzione | **zero** |

---

## 6. Cosa NON è verificato, e lo dico chiaro

- **La prenotazione presa dalla pianta non è mai stata presa da una mano
  vera.** È provata dal database e dalle prove automatiche; il gesto —
  tocco i tavoli, scrivo il nome, prenoto — non l'ha ancora fatto nessuno.
- **Il trascinamento di un tavolo e il pulsante per girarlo** restano non
  provati da un dito vero. Lo scorrimento col dito sul cellulare
  nemmeno: è la correzione più recente e non è ancora stata vista.
- ⚠️ **La pianta mostra tutta la serata, non un momento.** Un tavolo
  prenotato alle 19:30 resta colorato anche se alle 22 si libera: non
  esistono turni né finestre temporali (§8 del mandato). Ogni sagoma
  occupata porta scritta l'ora, e decide lui. **È una scelta, non una
  mancanza** — ma è la cosa che più facilmente verrà scambiata per un
  difetto.
- **Il conteggio in cima al giorno non è una capienza**: è quante
  prenotazioni e quante persone lui ha confermato. Nessun numero dice
  quante ne entrano, e non deve.
- **`privacy_consent_at` resta vuoto** sulle prenotazioni prese al
  telefono: al telefono nessuno ha spuntato niente, e segnare un consenso
  che non c'è stato sarebbe peggio di non averlo. Da rivedere con Laura
  insieme al resto del dossier privacy.
- **La riga del Contratto §5 sui tavoli uniti è ancora quella vecchia**:
  resta il commit separato da autorizzare, dichiarato da due riepiloghi.
