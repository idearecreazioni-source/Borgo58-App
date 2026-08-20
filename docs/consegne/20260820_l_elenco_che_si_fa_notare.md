# L'elenco che si fa notare — blocco 1 del registratore telematico

**Migrazione**: `20260820000004_l_elenco_che_si_fa_notare.sql`
— applicata sul progetto di prova, **NON ancora in produzione**.
**Corridoio**: **v15 sulla prova** (in produzione resta la v30), un'operazione
nuova: `segnala_scontrino_non_uscito`.
**Mandato**: [`20260820_il_registratore_telematico.md`](../mandati/20260820_il_registratore_telematico.md).

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha premuto niente**: né il rifiuto alla chiusura della
   giornata, né la schermata nuova della sala. Nessuna prova di questo
   progetto guarda una schermata.
2. 🔴 **Non esiste nessun registratore**, quindi il giro vero — chiudo il
   conto, lo scontrino non esce, il conto resta in elenco — **non è mai
   avvenuto**. Quello che è provato è cosa succede *dopo*.
3. ⚠️ **In produzione c'è un solo conto chiuso e nessun conteggio di cassa**:
   la rete non ha mai incontrato una serata vera.
4. ⚠️ **Il simulatore non è di questo blocco** (è il blocco 2): il punto di
   contatto col registratore è preparato e **non è mai stato sostituito da
   niente**, quindi che sia davvero sostituibile è un'affermazione, non una
   misura.

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento.**

---

## 🔴 La misura prima di costruire: metà esisteva, e una parte era rotta

| pezzo | stato prima |
|---|---|
| `orders.documento_fiscale`, `documento_numero`, `documento_emesso_il` | ✅ c'erano |
| `conti_da_fiscalizzare()`, `quadratura_fiscale()` | ✅ c'erano |
| la chiusura della giornata | ✅ è `registra_conteggio_cassa` (contare il cassetto) |
| l'avviso che si fa notare | 🔴 non esisteva |
| la segnalazione della sala | 🔴 non esisteva |
| 🔴 **la data del documento sugli scontrini** | **c'era e veniva azzerata** |

🔴 **Il difetto trovato misurando**: `setDocumentoFiscale` scriveva
`documento_emesso_il` **solo per le fatture**, e sugli scontrini lo metteva a
`null`. Uno scontrino ristampato tre giorni dopo **non aveva nessuna data** —
quindi lo scarto fra la serata del cliente e il giorno del documento *non era
nemmeno rappresentabile*, ed è esattamente lo scarto che Alessio ha deciso di
dichiarare. Nessun errore, nessun sintomo: solo una decisione impossibile da
attuare.

---

## Le tre cose costruite

### 1 · La chiusura della giornata non si completa in silenzio

`registra_conteggio_cassa` **rifiuta** se restano conti incassati senza
documento fiscale, e il messaggio dice quanti sono e cosa fare. Si può
chiudere lo stesso **prendendone atto** — e il numero **resta scritto** sul
conteggio (`conteggi_cassa.conti_da_fiscalizzare`).

⚠️ **Il permesso lascia una traccia, ed è la parte che regge**: una rete che si
apre senza lasciare segno smette di essere una rete. Fra sei mesi si potrà
contare quante volte è stata aperta; se fosse un semplice «ok» a schermo, no.

⚠️ **Guarda quella serata E TUTTE QUELLE PRIMA**: un conto rimasto indietro
tre giorni fa è precisamente quello che nessuno ricorda più. Limitarsi alla
serata in corso avrebbe lasciato scappare proprio il caso peggiore.

⚠️ **La regola vive in un posto solo**: «quali conti non hanno un documento»
era dentro `conti_da_fiscalizzare`, che ha un portiere e serve alla schermata.
Adesso è `conti_senza_documento`, e la funzione della schermata è un involucro
col portiere attorno. Copiarla avrebbe prodotto due regole che divergono al
primo ritocco.

🔴 **E la vecchia `registra_conteggio_cassa` a quattro parametri è stata
TOLTA, non lasciata accanto**: in Postgres un parametro in più fa una funzione
*nuova*, e due sovrapposte rendono ambigua ogni chiamata per nome. Lasciandola
lì, il corridoio avrebbe potuto continuare a chiamare quella vecchia — cioè
**la chiusura della giornata senza la rete**.

### 2 · La segnalazione della sala

Nuova schermata `/comande/scontrini`, **aperta a tutto lo staff**: i conti
chiusi di stasera, e su ognuno «Non è uscito».

⚠️ **Sulla fattura il pulsante non compare**: ha un numero, e un numero emesso
non si disfa con un tocco in sala. Il database lo rifiuterebbe comunque — e
*un pulsante che esiste per essere rifiutato è un inganno* (stessa cura del
17/08 su «Rimuovi» e «Pronta per carta»).

⚠️ **Resta scritto chi ha segnalato e quando** (`segnalazioni_fiscali`), e da
quale stato si tornava indietro. Un conto che rientra in elenco senza una
ragione è indistinguibile da un errore.

### 3 · Lo scarto fra le due giornate si dichiara

`conti_fiscalizzati_in_ritardo()` elenca i conti in cui la serata del cliente e
il giorno del documento non coincidono, **con quanti giorni dopo**.

⚠️ **L'incasso non si sposta**: resta nella serata in cui il cliente ha pagato.
Spostarlo per far coincidere i due mondi farebbe risultare quella serata **più
magra del vero** — la stessa forma del numero più corto con l'aria di essere
intero.

---

## 🔴 Il punto in cui il gestionale parlerà col registratore

`src/lib/registratore.js`, **uno solo e sostituibile**. Oggi risponde sempre
`non_collegato` — ed è la verità, l'apparecchio non c'è.

⚠️ **Non risponde «fatto»**, che sarebbe la bugia comoda: segnerebbe i conti
come scontrinati e **svuoterebbe l'unica rete di questo blocco**.

⚠️ E la domanda «lo scontrino è uscito?» ha **una risposta sola**
(`scontrinoEmesso`), scritta lì e non nelle schermate: solo `fatto` con un
numero vale: muto, a metà e non collegato lasciano il conto senza documento.

---

## Le prove, e le due rotture

**Sette controlli dentro la migrazione** e **6 prove col token di un utente
vero** — 152 pure + **242** sull'app in tutto.

⚠️ **La prova all'incontrario c'è, ed è la prima**: con l'elenco vuoto la
giornata si chiude **normalmente, senza avvisi**. Senza di lei, un rifiuto che
scattasse sempre passerebbe tutte le altre — e *un avviso che compare sempre è
un avviso che si impara a ignorare*.

⚠️ **La segnalazione è provata con l'accesso della SALA**, non del titolare: è
il gesto vero, e provarlo col titolare non proverebbe che il cameriere può
farlo.

| rottura | cosa è diventato rosso |
|---|---|
| l'avviso di fine serata non scatta più | *«La chiusura della giornata si è completata in silenzio con dei conti da fiscalizzare»* |
| il permesso non lascia traccia (si scrive sempre 0) | *«Il conteggio non ha registrato quanti conti restavano da fiscalizzare»* |
| il client concede sempre il permesso | *«un conto incassato senza documento BLOCCA la chiusura»* diventa rossa |

---

## 🔴 Tre guardie incontrate costruendo, e nessuna aggirata

La verifica doveva ripulirsi, e per tre volte una protezione esistente si è
messa di mezzo. **Nessuna è stata spenta per comodità**:

1. *«Questo conto è già chiuso: la riga non si può togliere»* e *«è già andata
   in cucina: non si cancella, si storna»* — due guardie del 16/08. Invece di
   spegnerle, il conto di prova prende valore **dai coperti**: nessuna riga di
   comanda, nessuna guardia da scavalcare. ⚠️ *Una verifica che disattiva una
   protezione per fare pulizia è il primo passo verso una che la lascia
   spenta.*
2. Le **lapidi**: `cash_movements` e `conteggi_cassa` sono tabelle tracciate, e
   cancellare lasciava copie finte in un registro che nessuno può ripulire —
   **è già successo il 19/08**. Qui i due guardiani si spengono per la sola
   pulizia e si **controlla al catalogo di averli riaccesi**.

⚠️ **E una misura di passaggio**: le tabelle tracciate sono **21**, non 12
come dicono ancora gli appunti — e `orders` **non è fra queste**. Corretto in
CLAUDE.md.

---

## Per Alessio, in una riga

Se a fine serata resta un conto incassato senza scontrino, il gestionale non ti
lascia chiudere la giornata senza dirtelo — e chiunque in sala può segnalare
uno scontrino che non è uscito.

---

**Commit del lavoro**: `947766f` — «L'elenco che si fa notare — blocco 1 del
registratore telematico».
**Working tree**: pulito.
**Migrazione**: `20260820000004` — sul progetto di prova sì, in produzione
**no**, in attesa del `git push`.
**Corridoio**: da installare in produzione dopo il push, altrimenti la
segnalazione della sala risponde che l'operazione non esiste.
