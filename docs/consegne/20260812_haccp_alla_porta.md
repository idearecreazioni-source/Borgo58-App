# Consegna del 12/08/2026 — il registro HACCP si riempie alla porta

**Commit della consegna: `c98732e`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

**Migrazione `20260812000012` applicata in produzione** e **`posta-leggi`
reinstallata** (`version 12`). Correzione di un difetto della consegna
precedente, `20260812000011`, vecchia di due ore.

---

## 1. L'ha trovato una domanda, non una verifica

Alessio, prima ancora di provare il carico:

> *«Arriverà mai una fattura per email, oppure le troverò tutte nel
> cassetto fiscale gestito da Fatture in Cloud che connetterò con l'API?»*

Ha ragione, e la risposta ha portato a galla qualcosa di più grosso della
domanda. In Italia la fattura di un fornitore è elettronica: passa dallo
SdI e arriva all'intermediario, **non per posta**. Per email arrivano bolle
di consegna, copie di cortesia, fornitori piccoli ed esteri.

Ma la conseguenza vera non è sul canale — è sul **tempo**:

> **Una fattura arriva giorni o settimane dopo la merce.**

Il carico del magazzino da un documento tardivo è solo impreciso nella
data. Il registro HACCP di ricevimento merci, no: **la temperatura si
misura quando il furgone è alla porta.** Scriverla partendo da una fattura
significa registrare un controllo che in quel momento nessuno ha fatto.

E siccome quel registro si mostra a un'ispezione: un registro vuoto è una
mancanza, **un registro pieno di controlli mai avvenuti è una
dichiarazione falsa**. Avevo legato le due cose senza pensarci, due ore
prima.

---

## 2. La correzione è una riga, e il suo verso

`registra_haccp` passa da **acceso salvo diverso avviso** a **spento salvo
richiesta esplicita**. Serve ora un `true` esplicito: se il campo manca,
nel registro non si scrive niente.

Scelta di Alessio fra tre proposte (spento di default / lasciare com'era /
togliere del tutto l'HACCP dal carico). Ha scelto la prima: il carico del
magazzino resta automatico, la casella si accende quando la merce è lì —
cioè quando arriva una **bolla insieme al furgone**, che è poi il caso in
cui la posta serve davvero.

**Perché il verso conta più del valore.** Col default acceso, dimenticare
di spegnerlo sporca un registro legale **in silenzio**. Col default spento,
dimenticare di accenderlo lascia un buco **che si vede**, e che si riempie
dalla schermata *Ricevimento Merci* — che esiste da luglio ed è il posto
giusto. Fra un errore silenzioso e uno visibile si sceglie sempre il
secondo.

In schermata la casella nasce spenta e, quando la si accende, compare la
riga che dice cosa sta per succedere: *«scriverà nel registro HACCP una
consegna ricevuta adesso»*.

---

## 3. Cosa NON è cambiato, e perché conta

Il carico del magazzino, la funzione atomica, la schermata di conferma
riga per riga: tutto invariato. **Nessuna di quelle parti è legata
all'email** — il canale è solo chi porta il documento.

Quando si collegherà Fatture in Cloud (B2/B3 del Contratto, già previsto),
lo stesso tipo di azione e la stessa schermata di conferma si alimentano da
lì. Il lavoro di due ore fa non è da rifare: è da collegare a una sorgente
diversa.

---

## 4. Verifica

| Cosa | Stato |
|---|---|
| progetto di prova | **applicata**, verifica interna superata |
| campo assente → nessuna riga di registro | **provato** |
| campo `true` → una riga | **provato** |
| campo `false` → nessuna riga | **provato** (non basta che il campo esista) |
| il carico del magazzino avviene comunque, in tutti e tre i casi | **provato** |
| pulizia della prova | **verificata** |
| prove automatiche | **29 verdi** |
| **produzione — migrazione** | **applicata**: 66 registrate |
| **produzione — `posta-leggi`** | **installata**: `version 12`; `posta-in-arrivo` resta l'unica con la verifica del token spenta, invariata |
| lint | pulito |

**Non verificato, e dichiarato**: nessuna fattura né bolla vera è ancora
passata di qui. È il passo successivo, concordato con Alessio: si inoltra
un documento vero a `info@`, si guarda **senza confermare** come ha
abbinato i prodotti, e solo dopo si decide. I dati della prova li cancello
io subito dopo — e stavolta il registro HACCP non rischia niente, perché
la casella nasce spenta.
