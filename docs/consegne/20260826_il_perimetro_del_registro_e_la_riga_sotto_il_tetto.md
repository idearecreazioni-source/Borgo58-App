# Il perimetro del registro, e la riga sotto il tetto

**26/08/2026, secondo giro** · quattro blocchi: **1 saltato**, 3 chiusi.

- **HEAD dichiarato**: `b590ef8f574d2a8d41418f7df62f0ca50217ce79`
- **Working tree**: pulito al momento della scrittura di questo riepilogo.
- **Migrazioni**: repository **269**, progetto di prova **269**, produzione
  **260**. Le nove di scarto sono **IN ATTESA del push**.

---

## Blocco 1 — SALTATO, e perché

Le quattro migrazioni del giro precedente **non sono su GitHub**. Verificato
col comando che ha il controllo dentro (`npm run migra`, in sola lettura), non
dedotto:

```
migrazioni nel repository: 264
gia' applicate in produzione: 260
FERMO: queste migrazioni non sono ancora su GitHub.
  · 20260826000007_il_freno_sta_anche_sulla_porta_che_scrive.sql
  · 20260826000008_un_identificativo_che_non_esiste_si_dice.sql
  · 20260826000009_chi_ha_toccato_il_tetto_della_spesa.sql
  · 20260826000010_il_guardiano_guarda_le_righe_non_le_lapidi.sql
```

⚠️ **Il `git fetch` da questo terminale riesce** (l'ho lanciato e ha risposto
`0`), quindi il confronto con `origin/master` è aggiornato: non è il caso in
cui il riferimento remoto è vecchio e non si sa. **Nel gestionale vero non è
stato applicato niente**, e i numeri che il mandato chiedeva di riportare dopo
l'applicazione non esistono.

---

## Blocco 2 — Il perimetro che non era cresciuto col gestionale

### Le premesse, rifatte

| | esito |
|---|---|
| **P1** — 21 tabelle su 119 scrivono in `deleted_records`, tutte via `log_deleted_record` | ✅ confermata, elenco **identico** nome per nome |
| **P2** — il commento della tabella dichiara il criterio dell'08/08 | ✅ confermata alla lettera |
| **P3** — restano fuori `prestiti_privati`, `restituzioni_prestito`, `conti_bancari`, **la tabella dei movimenti di banca**, `spesa_spicciola` | ⚠️ **cade in un punto** |

🔴 **P3 cade su «la tabella dei movimenti di banca»: quella tabella non
esiste.** I movimenti di banca sono righe di `cash_movements` (distinte da
`mezzo`), e `cash_movements` **è già tracciata** dall'08/08. L'unica tabella
che punta a `conti_bancari` è proprio lei. Quindi le candidate erano quattro,
non cinque — e la parte che regge è la sostanza del blocco, per cui non l'ho
saltato.

### Il censimento: 119 tabelle, guardate dentro

🔴 **Due cose che dal nome non si vedevano**, ed è il motivo per cui il mandato
chiedeva di aprirle:

- **`spesa_spicciola` non tiene soldi.** Colonne: `articolo`, `categoria`,
  `nota`, `nel_carrello`, `preso_il` — **nessun importo**. Le tre righe vere
  sono «Prova», «varie», «Vatie». È l'elenco di cosa prendere al supermercato,
  e il suo stesso commento dice «non scrive nessun costo». **Non è chiaramente
  dentro il criterio**: sta fra le da decidere.
- **`reservation_deposits` non ha una colonna `id`.** Il trigger scrive
  `record_id` prendendo `to_jsonb(old) ->> 'id'`: lì resterebbe **vuoto**, e la
  lapide nascerebbe senza il riferimento che serve a ritrovare la riga. Si
  scopre **leggendo il corpo del trigger**, non contando che esista.

### Cosa dice il corpo di `log_deleted_record`, letto per intero

Copia `to_jsonb(old)` — la riga **intera**, qualunque siano le sue colonne,
quindi tabelle di forma diversa vanno bene senza modifiche. Prende
`record_id` da `old.id` (vuoto se la tabella non ce l'ha) e `deleted_by` da
`auth.uid()` (vuoto quando a cancellare è un lavoro notturno o una migrazione).
È `before delete for each row`, quindi **scatta anche sulle cancellazioni a
cascata**: qui succede in due punti e in tutti e due è voluto — una nota di
credito cancellata lascia le lapidi dei suoi utilizzi, un conto cancellato
lascia quella della sua segnalazione fiscale (e `orders` non è tracciata:
sono due domande diverse, non un'incoerenza).

### Le cinque che entrano — `20260826000011`

`prestiti_privati` · `restituzioni_prestito` · `conti_bancari` ·
`note_credito_utilizzi` (la madre è dentro dal 17/08 e la figlia che porta
l'importo era rimasta fuori) · `segnalazioni_fiscali`.

**Come si giudica, dai fallimenti e coi conteggi:**

```
lapide del prestito: id b9f48862-…, importo 1234.56, da_chi «VERIFICA perimetro»
lapidi dopo le quattro cancellazioni: 2637 -> 2641
spesa_spicciola resta fuori: lapidi 2641 prima, 2641 dopo
verifica del perimetro: nessun residuo, lapidi 2637 -> 2637
```

La terza riga è il controllo che il mandato chiedeva: **una tabella che resta
fuori non deve lasciare niente**, altrimenti un trigger finito addosso a tutto
sembrerebbe un successo. E la lapide non deve solo esistere: la verifica
pretende che dentro ci sia **l'importo**, non un guscio vuoto.

**Controprove, sul solo blocco di verifica estratto:**

| rottura | cosa dice |
|---|---|
| tolto il trigger a `conti_bancari` | `Il perimetro non torna su 1 voci: conti_bancari (manca il registro)` |
| messo il trigger su una che resta fuori | `Cancellando da spesa_spicciola, che resta fuori, sono comparse 1 lapidi.` |

---

## Blocco 3 — Che il perimetro non invecchi di nuovo

`perimetro_registro` classifica **ogni** tabella: dentro, fuori, oppure
**vuoto = non l'ha ancora deciso nessuno**. Oggi: **26 dentro, 23 da decidere,
120 classificate** (le 119 più sé stessa).

`perimetro_da_sistemare()` dichiara una **proprietà** — «ogni tabella ha una
risposta, e il registro corrisponde alla risposta» — non una quantità: non
dice «devono essere 21», quindi non diventa falso il giorno che il numero
cambia per un motivo giusto.

⚠️ **Perché una classificazione esplicita e non un setaccio automatico.**
Misurato prima di scegliere: cercando le tabelle non tracciate con una colonna
che parla di denaro ne escono **32**, e dentro ci sono il listino dei modelli
AI, il prezzo di un piatto in carta e il prezzo del coperto. Un guardiano che
ne segnala 32 quasi tutte legittime viene spento al secondo allarme.

⚠️ **Il terzo stato non è un rinvio comodo**: è l'unico onesto per le tabelle
che il mandato lascia decidere ad Alessio. Metterle `fuori` sarebbe rispondere
al posto suo; metterle `dentro` anche.

**Provato su un caso di cui conoscevo già la risposta:**

```
con la tabella finta il guardiano dice: manca il registro
e senza classificazione dice: non classificata
```

🔴 **E ROMPENDOLO È SALTATO FUORI UN BUCO VERO — `20260826000012`.** Il caso
«classificata fuori e col trigger addosso» era scritto `where p.dentro = false
and v.ha_trigger`: su una tabella **da decidere** (`dentro` vuoto) quella
condizione vale `null` e **non scatta**. Messo apposta il trigger su una da
decidere, il guardiano ha risposto «tutto a posto» — e a fermare la verifica è
stato un altro controllo. ⚠️ Non è un caso di scuola: è il modo esatto in cui
il perimetro si allargherebbe di nuovo in silenzio, con la decisione **presa
di fatto e mai scritta**. Chiuso col quinto caso, «decisa di fatto», provato
nei due versi (col trigger grida, senza tace).

---

## Blocco 4 — La riga sotto il tetto — `20260826000013`

La schermata dice chi ha messo il tetto e chi l'ha sbloccato. La frase la
compone il **database**, come per le imposte: una seconda schermata che
mostrasse lo stesso dato eredita la frase invece di riscriverla.

🔴 **Il valore attuale continua a non avere un autore, e la riga LO DICE:**

> «Questo tetto c'era già quando il gestionale ha cominciato a registrare chi
> lo tocca: non l'ha messo nessuno.»

⚠️ Un campo vuoto onesto vale più di un nome inventato — **e detto in parole
vale più di un campo vuoto**, perché chi guarda una casella vuota pensa a un
guasto.

Il «chi» dice solo quello che il gestionale sa: si entra per **ruolo** e non
per persona, quindi «l'hai messo tu» oppure «da un altro accesso» — la stessa
forma decisa il 18/08 per la correzione dei coperti, riusata invece di
inventarne una seconda.

✅ **GUARDATA DAVVERO**, aprendo il gestionale puntato alla prova e leggendo
la schermata: la riga compare sotto il campo del tetto, e premendo **Salva**
cambia in «L'hai messo tu il 26/08/2026 alle 18:53». Poi lo stato della prova
è stato rimesso com'era, riscrivendo la riga intera.

🔴 **E APRENDO LA SCHERMATA È SALTATO FUORI UN RESIDUO IN PRODUZIONE DI PROVA**
— la verifica si è fermata dicendo che il tetto **risultava attribuito a
qualcuno**. A lasciarlo lì era stata `tests/app/assistente-foto.test.js`, che
rimetteva **il numero** e non **la riga**: giusta finché la riga era fatta di
quel numero, diventata falsa in silenzio il giorno stesso in cui la riga ha
acquistato `tetto_da` e `tetto_il`. Corretta: ora salva `select *` e riscrive
la riga intera, e confronta che sia tornata identica.

⚠️ **È il limite del guardiano dei residui di stamattina che morde tre ore
dopo essere stato dichiarato**: quello conta le righe, e una riga **modificata
e lasciata modificata** non cambia nessun conteggio. A trovarla è stata la
verifica di un lavoro fatto dopo, non un controllo sui residui.

---

## Le due migrazioni di correzione, e perché sono due

🔴 **`20260826000014` ha curato un difetto e ne ha aperto un altro.**
`tests/app/permessi.test.js` è diventata rossa da sola: le funzioni che
scavalcano la RLS senza chiedere chi sei erano passate da **23 a 25**, e le due
in più erano le mie (`perimetro_da_sistemare`, `perimetro_da_decidere`, nate
`security definer` e concesse ad `authenticated` **senza portiere**). Ho messo
il portiere — e un minuto dopo `tests/app/migrazioni-senza-portieri.test.js` ha
detto che così le verifiche delle `…011` e `…012` sarebbero diventate
**fragili**: una migrazione non ha un utente, quindi su una ricostruzione da
zero si fermerebbero.

**`20260826000015` prende l'altra strada, e la scelta è misurata**: nessun
punto di `src/` chiama quelle due funzioni, quindi si **chiude la porta**
(revoca a tutti) invece di metterci un portiere — è il precedente di
`uscite_future` del 19/08. Così le migrazioni tornano a chiamarle senza
problemi e nessun accesso ci arriva lo stesso. ⚠️ **Il debito della
ricostruzione non si accumula**: se avessi solo dichiarato la chiamata con
`rete-portieri:`, quelle due migrazioni sarebbero andate saltate per sempre in
ogni ricostruzione da zero, come già succede per la `20260824000030` e la
`…033`.

⚠️ **Rovesciamento dichiarato**: la `…015` rovescia la `…014` di un'ora prima.
La ragione della `…014` — «ogni `security definer` ha il suo portiere», 13/08 —
**vale ancora intera**: cambia il modo di rispettarla, perché una funzione che
nessun accesso può eseguire soddisfa quella regola meglio di una che li
respinge uno per uno.

---

## Cosa abbiamo rovesciato

**Uno solo**, ed è interno al giro: la `…014`, rovesciata dalla `…015` un'ora
dopo (sopra, con le quattro righe). **Nessuna decisione di Alessio è stata
rovesciata**, e il criterio dell'08/08 sul registro delle cancellazioni non è
stato toccato: questo giro lo **applica** a chi è arrivato dopo.

---

## Voci di `docs/DECISIONI.md`

**Aggiunte** (sezione *Assistente — foto*), perché nate in questo mandato:
la schermata del tetto mostra chi l'ha toccato · 60 comandi vocali all'ora
confermati · le 14 ricette senza ingredienti sono normali e non si toccano.

**Lette e non contraddette**: il criterio del registro delle cancellazioni
(08/08, nel commento della tabella) · la pulizia dei dati dei clienti (10/08),
che è la ragione per cui `customers` e `reservations` restano **fuori** dal
registro — tracciarle significherebbe non aver tolto i dati personali · la
lapide della previsione intera e non dei dodici mesi (15/08).

---

## Rilettura obbligatoria

**Cosa NON ho verificato con gli occhi.** Il gestionale **vero** non l'ho
aperto: le migrazioni non sono in produzione. Della schermata del tetto ho
guardato **il testo letto dal DOM**, non un'immagine: colori, ingombro e
leggibilità di quella riga sul tablet non li ha visti nessuno. E non ho
guardato le altre schermate toccate dal perimetro — non ce ne sono.

**Cosa ho contato senza leggerlo.** Le **21** tabelle già tracciate: ho
verificato che il trigger esista e che chiami `log_deleted_record`, e ho letto
il corpo di **quella funzione**, ma non ho aperto i 21 trigger uno per uno. Le
**23** da decidere: le ho classificate leggendo i commenti delle tabelle e le
loro colonne, non i dati dentro (tranne `spesa_spicciola`, che ho aperto).

**Quali mie affermazioni sono diventate false mentre lavoravo.** Due.
(a) «`spesa_spicciola` sta chiaramente dentro il criterio» — l'ho creduto
dalla premessa del mandato finché non ho guardato le colonne: non ha importi.
(b) «Il portiere sulle due funzioni del perimetro è la cura giusta»
(`…014`) — falsa un minuto dopo, e rovesciata dalla `…015`.

**Quali blocchi non ho aperto.** Il **Blocco 1**, e non per scelta: le
migrazioni non sono su GitHub.

**Quali conteggi sono pavimenti e non totali.** Le **26 dentro** e le **23 da
decidere** sono una **classificazione, non una misura**: dicono cosa ho
deciso io oggi, e le 23 aspettano Alessio. Le **119** tabelle, le **21**
tracciate e le **32** con colonne di denaro sono totali letti dal catalogo.

**Migrazioni in attesa**, in ordine — le quattro del giro precedente più le
cinque di adesso:

1. `20260826000007_il_freno_sta_anche_sulla_porta_che_scrive`
2. `20260826000008_un_identificativo_che_non_esiste_si_dice`
3. `20260826000009_chi_ha_toccato_il_tetto_della_spesa`
4. `20260826000010_il_guardiano_guarda_le_righe_non_le_lapidi`
5. `20260826000011_il_perimetro_del_registro_smette_di_invecchiare`
6. `20260826000012_una_decisione_di_fatto_non_e_una_decisione`
7. `20260826000013_la_riga_sotto_il_tetto_dice_chi`
8. `20260826000014_il_perimetro_lo_guarda_il_titolare`
9. `20260826000015_una_porta_chiusa_invece_di_un_portiere`

⚠️ **La `…011` scrive 120 righe di classificazione e le cinque cancellazioni
della sua verifica** (create e tolte, lapidi prima = lapidi dopo). La `…013` e
la `…015` non creano niente. **In produzione le lapidi sono zero**, quindi
dopo l'applicazione devono restare zero.

**Lezioni nuove nel file delle trappole** (`CLAUDE.md` §8), due: un guardiano
che conta le righe non vede una riga modificata — col caso vero che l'ha
morso tre ore dopo · una tabella «da decidere» può essere decisa di fatto,
perché in SQL il terzo stato sparisce dai confronti.

---

## Domande per Alessio

1. **Le comande e i conti devono lasciare traccia quando si cancellano?** Oggi
   lasciano traccia le **righe** di un conto e i **pagamenti**, ma non il conto
   in sé. **Raccomandazione: sì** — costa niente e chiude il cerchio; l'unico
   effetto è che nel registro comparirà una riga in più per ogni conto tolto.
2. **E il magazzino?** Partite, scarichi, rettifiche di giacenza, produzioni:
   sono i numeri da cui esce il food cost, e cancellandoli oggi non resta
   niente. **Raccomandazione: sì per gli scarichi e le rettifiche** (portano un
   costo fotografato che non si ricostruisce), **no per il resto** per ora.
3. **Gli ordini ai fornitori?** **Raccomandazione: no per adesso** — un ordine
   non è ancora un documento fiscale, e la fattura che arriva dopo la traccia
   ce l'ha già.
4. **Le caparre dei clienti?** Sono soldi veri, ma la loro tabella sparisce
   insieme alla prenotazione — e le prenotazioni le cancella la pulizia
   notturna **per privacy**. **Raccomandazione: no**, e lo dico contro il mio
   istinto: tracciarle rimetterebbe nel registro pezzi di qualcosa che stiamo
   cancellando apposta.
5. **La spesa spicciola al supermercato?** Non ha importi, è solo l'elenco di
   cosa prendere. **Raccomandazione: no.**
6. **La posta ricevuta, PEC comprese?** Sono documenti con valore legale, ma
   dentro ci sono anche messaggi di persone. **Raccomandazione: no adesso**, e
   riguardarlo quando la posta sarà collegata all'archivio per davvero.
