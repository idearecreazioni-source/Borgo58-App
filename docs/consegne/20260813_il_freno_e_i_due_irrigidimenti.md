# Consegna del 13/08/2026 — il freno chiuso, e i due irrigidimenti

**Commit della consegna: `1e83b2e`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `fc8f57f` | il freno non zittisce più i rincari — migrazione `20260813000001` |
| `c277ff0` | i due irrigidimenti chiesti dal validatore — migrazione `20260813000002` |
| `8ec27ab` | gli avvisi si leggono al volo — migrazione `20260813000003` |
| `1e83b2e` | lo strumento che installa le funzioni online non partiva |

**Applicate in produzione da me**: `20260813000001`, `…02`, `…03`.
**75 migrazioni** registrate. `notify-telegram-reservation` reinstallata
(**versione 9**).

---

## 1. La coda aperta dal validatore: l'allarme `rincaro_Olio` delle 22:44

Chiesto di riconciliarlo e di **scriverlo qui qualunque fosse la
risposta**. La risposta è: **la regola ha funzionato, non è un difetto.**

Lo storico dell'olio, letto in produzione col connettore in sola lettura:

| Documento | Versione | €/l |
|---|---|---|
| DDT PROVA-1 | lattina 5 L | 9,80 |
| FT PROVA-2 | **bottiglia 1 L** | 12,00 |
| FT PROVA-3 | **bottiglia 1 L** | 13,20 |

L'avviso delle 22:44 confronta 12,00 con 13,20: **stessa versione, stesso
fornitore, +10%**. È un rincaro vero e doveva partire. Il passaggio
lattina → bottiglia (9,80 → 12,00) non ha prodotto **nessun** avviso, che
è l'altra metà della regola.

**Perché i due numeri erano uguali** (`+10,0%` e `+10,0% da quando lo
compri`): quella versione era stata comprata due volte in tutto, quindi
«l'ultima volta» e «da quando lo compri» sono lo stesso punto. Non è
l'avviso «coi due numeri» — quello era il rincaro dei pomodori dello
stesso documento, ed è proprio quello che il freno aveva ingoiato.

---

## 2. Il difetto rosso: chiuso, e provato dal vivo quattro volte su quattro

`segnala_allarme()` lascia passare **un avviso per tipo all'ora**, e il
tipo era `rincaro_<ingrediente>`. Due conferme a venti minuti di
distanza, e il secondo rincaro sullo stesso prodotto spariva — **senza
essere nemmeno registrato**. In schermata compariva lo stesso, perché lì
il conto è dal vivo: schermo e Telegram dicevano due cose diverse.

**Il freno non era sbagliato: era sbagliato il metro.** Per un guasto a
raffica il decimo messaggio identico non aggiunge niente; **un rincaro è
un fatto nuovo ogni volta**. Ora il tipo identifica *il rincaro* —
`tipo_allarme_rincaro(ingrediente, versione, prezzo)`.

**Versione E prezzo, non solo il prezzo** come avevo messo in coda ieri:
due versioni dello stesso ingrediente possono arrivare allo stesso prezzo
nella stessa ora (la lattina da 5 L e la bottiglia da 1 L entrambe a
13,20). Silenziare un caso improbabile per comodità **è come è nato
questo difetto**.

### La prova dal vivo, con Alessio al telefono

Due fatture di collaudo nuove (PROVA-4 e PROVA-5), confermate a quattordici
minuti di distanza, sugli **stessi due prodotti**:

| Ora | Prodotto | Avviso | Su Telegram |
|---|---|---|---|
| 01:18 | Pomodoro ciliegino | da 3,90 a 4,05 · **+3,8% / +26,6%** | ✅ |
| 01:18 | Olio extravergine | da 13,20 a 13,80 · +4,5% / +15,0% | ✅ |
| 01:32 | Pomodoro ciliegino | da 4,05 a 4,30 · **+6,2% / +34,4%** | ✅ |
| 01:32 | Olio extravergine | da 13,80 a 14,40 · +4,3% / +20,0% | ✅ |

**Quattro su quattro.** Col difetto di ieri ne sarebbero arrivati due — e
i due persi sarebbero stati proprio quelli coi numeri più grossi. È anche
la prima volta che l'avviso «coi due numeri» è stato visto arrivare.

### Come si è potuto verificare senza far suonare il telefono di Alessio

Il freno viveva **dentro** la funzione che invia: provarlo significava
mandargli messaggi finti, ed è ciò che fece la migrazione degli allarmi
il 10/08. Estratto in `allarme_frenato()` — decisione separata
dall'invio, come per l'email di conferma e per la sentinella. La verifica
della migrazione prova tutto e **non spedisce niente**: stesso rincaro
una volta sola, rincaro diverso sempre, due versioni allo stesso prezzo
distinte, il guasto a raffica ancora frenato, l'ora che scade. E **al
contrario**: che col tipo vecchio il secondo rincaro sarebbe stato
zittito.

**Il controllo che vale più degli altri**: la verifica legge il corpo di
`esegui_azione_posta` e pretende che usi davvero la funzione nuova. Si
può correggere l'aiuto e lasciare il chiamante com'era — la migrazione
passerebbe e il difetto resterebbe vivo. **È esattamente come è nato.**

---

## 3. I due irrigidimenti

### La produzione non corre più avanti a GitHub

`npm run migra` pretendeva «solo file committati». Ma committato vuol
dire soltanto *scritto sul PC di Alessio*: fra il commit e il push c'è
lui, e finché non ha spinto la produzione girerebbe codice che nessuno
può leggere. Se quel commit venisse riscritto, **il database vero
resterebbe l'unico posto dove quella migrazione è mai esistita**.

Ora si fa `git fetch` e si confronta con `origin/master`; se non si
riesce a sapere cosa c'è su GitHub, ci si ferma lo stesso — non sapere
non è un «va bene». **Ordine nuovo, scritto in `CLAUDE.md` §2**: commit →
push di Alessio → applicazione → riepilogo → secondo push.

Verificato dal vivo: il comando **si è rifiutato** di applicare
`20260813000002` prima del push, con il nome del file e il motivo.

**Esteso anche a `npm run funzione`**, che aveva la stessa identica frase
scritta e lo stesso identico buco. Lasciarne uno coperto e l'altro no
sarebbe stato lo stesso errore in due punti — la forma di difetto che gli
audit di questo progetto cercano apposta.

### L'elenco di chi può bussare da fuori

Era passato da **12 a 14** il 12/08: `chiave_articolo` e
`nome_ingrediente_chiave` sono nate senza la revoca che la regola §8
impone dall'11/08 — quando di funzioni aperte al mondo se ne trovarono
**35**. Nessun dato usciva (sono normalizzatori puri: testo dentro, testo
fuori, nessuna tabella), ma **il difetto è il silenzio, non il
contenuto**.

**Chiuse, non documentate come eccezioni.** Tutti e tre i chiamanti sono
`security definer` e girano come proprietario, quindi nessun ruolo
applicativo ne ha bisogno; verificato anche che non compaiano in indici
funzionali o vincoli, dove una revoca si sarebbe sentita su un `insert`
normale invece che su una chiamata diretta.

E l'elenco **non è più un controllo da rifare a mano**, cioè un controllo
che si accorge della deriva dopo, e solo se qualcuno guarda:
`funzioni_aperte_ad_anon()`, la verifica dentro la migrazione, e una
prova automatica che pretende esattamente quelle 12. Provata al
contrario creando una funzione aperta apposta sul progetto di prova: **la
migrazione si è fermata e ha detto quale era comparsa.**

⚠️ **Le 12 rimaste sono lo stato di partenza congelato, non un elenco
dichiarato innocuo**: `abbina_righe_carico` è `security definer` col
permesso predefinito e merita un giro suo. Dichiarato, non fatto qui.

---

## 4. Gli avvisi si leggono, e un rincaro non è un guasto

Domanda di Alessio guardando i quattro avvisi: *«come mai tutti quegli
zeri dopo i prezzi?»*. I numeri erano giusti — `3.9000` è come il
database tiene un prezzo — ma un avviso che arriva durante un servizio si
guarda per un secondo e mezzo.

Guardando la sua schermata ne sono usciti altri due, e nessuno dei due
era stato chiesto:

1. `Tipo: rincaro_Pomodoro ciliegino · Pomodori… · 4.0500` — roba interna
   finita sul suo telefono.
2. **«Di questo avviso ne arriva uno solo all'ora, anche se il guasto si
   ripete»** — da stanotte **falsa** per i rincari: è la frase che
   descriveva il difetto appena tolto. Un messaggio che spiega male come
   funziona il sistema è peggio di un numero scritto brutto, perché **si
   crede alla frase, non al codice**.
3. E un rincaro arrivava sotto **⚠️ QUALCOSA NON VA**, lo stesso titolo di
   un guasto. Non è la stessa cosa: un fornitore che alza i prezzi è il
   gestionale che **funziona**. Confonderli insegna a leggere quel
   triangolo come rumore, e il conto si paga il giorno del guasto vero.

Adesso è così:

```
💶 RINCARO

Rincaro su Pomodoro ciliegino (Pomodori ciliegini di Pachino IGP,
cassa da 6 kg): da 3,90 € a 4,05 € (+3,8%), +26,6% da quando lo
compri — FT 2026/PROVA-4 del 13/08/2026

Lo stesso rincaro non si ripete. Un rincaro diverso arriva sempre.
```

**La categoria la dichiara il database** (`segnala_allarme`, parametro
nuovo), non la indovina la funzione dei messaggi guardando come comincia
il tipo: sarebbe legare il titolo alla chiave del freno, due cose che
oggi coincidono e domani no, senza che niente lo segnali.

⚠️ `segnala_allarme` è stata **ricreata, non affiancata**: un parametro in
più fa una funzione nuova, e due sovrapposte rendono ambigua ogni
chiamata per nome (42725, a tempo di esecuzione). Stessa trappola di
`register_stock_delivery` il 12/08. E **dopo un `drop` i permessi tornano
quelli di partenza** — eseguibile da chiunque abbia la chiave pubblica —
quindi la verifica controlla anche che la revoca abbia richiuso la porta
e che l'elenco sia rimasto a 12.

---

## 5. Un guasto trovato mentre lo usavo: lo strumento diagnostico mentiva

`npm run funzione … -- --conferma` si è fermato dicendo *«se il motivo è
la chiave: lanciare `npx supabase login`»*. **Non era la chiave**: lo
stesso comando lanciato a mano ha installato la funzione al primo colpo.

Su Windows `npx` non è un eseguibile ma un `.cmd`, e da Node 24 un `.cmd`
non si avvia più senza shell. `spawnSync` restituisce `ENOENT` — «non
trovo il programma» — indistinguibile da «non è installato». Lo script
vedeva solo *non ok* e sceglieva la spiegazione più probabile, che era
quella sbagliata.

**È il difetto peggiore per uno strumento diagnostico: manda a cercare
nel posto sbagliato.** Stessa forma del 12/08, quando una chiave
rifiutata sembrava un problema di permessi ed era lunga 108 caratteri
invece di 44.

Tre correzioni, e la prima da sola non bastava:

1. la shell su Windows;
2. `esegui()` distingue «non sono riuscito ad **avviare** il programma» da
   «il programma ha **risposto male**»: due guasti che si cercano in due
   posti diversi, e prima erano lo stesso booleano;
3. **lo script non si fida più del codice di uscita**: legge la versione
   della funzione prima e dopo e dichiara «versione 8 → 9». Che il codice
   di uscita non sia la verità era scritto in `CLAUDE.md` §8 dal 12/08
   come avvertenza da ricordare; ora è un controllo.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| allarme `rincaro_Olio` delle 22:44 | **riconciliato**: regola giusta, non un difetto (§1) |
| le tre migrazioni sul progetto di prova | **applicate due volte**: idempotenti |
| il freno: stesso rincaro una volta sola, diverso sempre | **provato**, e provato **al contrario** |
| il freno per un guasto a raffica | **provato**: resta |
| **quattro avvisi su quattro, dal vivo, su Telegram** | **visto** (§2) |
| l'avviso «coi due numeri» | **visto arrivare per la prima volta** |
| `npm run migra` si rifiuta prima del push | **provato dal vivo** |
| l'elenco di chi bussa da fuori | **12**, provato al contrario |
| il form pubblico regge alle revoche | **verificato**: raggiungibile da `anon` |
| il testo dell'avviso, coi numeri veri | **provato** dentro la migrazione |
| `segnala_allarme` è una sola, e richiusa dopo il `drop` | **provato** |
| installazione della funzione | **versione 8 → 9**, letta dal server |
| prove automatiche | **30 verdi** (erano 29) |
| lint, build | puliti |
| **produzione** | **75 migrazioni** |

---

## 7. Cosa NON è verificato, e lo dico chiaro

- **Il messaggio nuovo non è mai stato visto arrivare.** La funzione è
  installata (versione 9) e il testo è provato dentro la migrazione, ma
  nessuno ha ancora guardato un `💶 RINCARO` sul telefono. La sesta
  fattura di collaudo è già in casella e verrà letta alle 02:00: la
  conferma e la fotografia sono la prima cosa di domani. **Se la
  categoria non arrivasse fino alla funzione, si vedrebbe ancora il
  titolo dei guasti** — è il modo in cui questa correzione può fallire, e
  non è ancora escluso.
- **I dati di collaudo sono ancora in produzione**, ora di sei documenti
  invece di tre: ingredienti, diciture, lotti, storico prezzi, i PDF
  nell'archivio, le mail di prova e gli avvisi. Deroga consapevole di
  Alessio al §5 punto 8, da chiudere **prima che entri una fattura
  vera**.
- **`/prova-voce` è ancora lì**, usa-e-getta e ormai servita.
- **Nessuna fattura vera di un fornitore vero** è ancora passata di qui.
- I due avvisi di ieri restano in tabella col tipo vecchio: innocuo, e
  spariranno con la pulizia.
