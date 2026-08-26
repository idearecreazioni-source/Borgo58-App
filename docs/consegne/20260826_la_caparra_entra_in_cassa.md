# La caparra entra in cassa

**26/08/2026 · notte** — mandato «la caparra che non arriva in cassa».
**Blocchi aperti e chiusi: 1, 2, 5. Blocchi 3 e 4 NON aperti.**

> ⚠️ **Ogni numero di questo riepilogo dice a quale gestionale si riferisce.**
> È il rilievo con cui il mandato si apre, ed era fondato: il riepilogo
> precedente scriveva che il conto del tavolo «ora lascia traccia» — vero sulla
> **prova**, falso in **produzione**, dove la migrazione era ancora in attesa.

| | |
|---|---|
| **HEAD dichiarato** | `bc79a5a3bcbed2edb41324e5c014cfb308ce3edf` |
| **Applicato al gestionale VERO** | `20260826000016` — nient'altro |
| **Applicato alla PROVA** | `20260826000016` e `20260826000017` |
| **In attesa del push** | `20260826000017` + la Edge Function `operazioni-atomiche` |
| **Prove** | oxlint zero avvisi · 475 pure · 424 sull'app (5 nuove), tutte verdi |

---

## Blocco 1 — le tre di stasera sono davvero entrate

**P1 verificata sul GESTIONALE VERO prima di toccare niente**: 26 tabelle
tracciate, e `orders`, `stock_consumptions`, `rettifiche_giacenza` **non** fra
quelle. Confermata.

Applicata `20260826000016` (era su GitHub: `origin/master` = `HEAD`).

### GESTIONALE VERO — prima e dopo

| cosa | prima | dopo |
|---|---|---|
| migrazioni | 269 | **270** |
| ultima | `…000015` | **`…000016`** |
| tabelle tracciate | 26 | **29** |
| `orders` · `stock_consumptions` · `rettifiche_giacenza` | assenti | **presenti, tutte e tre** |
| conti bancari | 0 | **0** |
| Previsione congelata | `2026-08-15 20:29:38.087382+00` | **identica** |
| ricette · impegni · tavoli | 14 · 8 · 13 | **14 · 8 · 13** |
| tetto di spesa | 10,00 | **10,00** |
| movimenti di cassa | 0 | **0** |
| lapidi | 0 | **0** |
| tabelle da decidere | 11 | **11** |

La verifica della migrazione, girando **in produzione**, ha detto: `lapidi 0 ->
3, tutte col riferimento` · `spesa_spicciola resta fuori: 3 prima, 3 dopo` ·
`verifica: nessun residuo, lapidi tornate a 0`.

---

## Blocco 2 — la caparra entra in cassa

### Le premesse, rifatte sul GESTIONALE VERO

| | esito |
|---|---|
| **P2** — `reservation_deposits` ha 3 sole colonne, nessun identificativo proprio | ✅ regge |
| **P3** — zero funzioni nominano `reservation_deposits` | ✅ regge, con la controprova: 18 e 18 |
| **P4** — `mezzo` solo cassa/banca, banca vuole `conto_id`, importo > 0; zero conti | ✅ regge, tutti e quattro |
| **P5** — 17 causali di cassa | ✅ regge |

### Il legame, COSTRUITO e non dato per scontato

P2 dice che la caparra non ha un identificativo proprio: **la sua chiave
primaria è la prenotazione**. Quindi il legame si regge su due colonne nuove:

- `cash_movements.reservation_id` — dal movimento alla prenotazione;
- `reservation_deposits.movimento_id` — dalla caparra al movimento.

È la stessa forma di `prestiti_privati.movimento_id`, che regge dal 22/08.

### 🔴 La privacy: verificata, non data per fatta

Il mandato avvisava che il problema poteva solo **cambiare di posto**. È il
punto su cui ho speso più attenzione, e la risposta è misurata:

- `cash_movements.reservation_id` è **`on delete set null`**, non cascade:
  cancellata la prenotazione **il denaro resta**;
- accanto c'è **`caparra_evento_il`, la data dell'evento fotografata**. Non è
  un dato personale — nessun nome, nessun telefono — quindi sopravvive alla
  pulizia notturna e il movimento continua a dire di che evento era.

**Senza la seconda colonna il problema sarebbe stato solo spostato**: un
incasso rimasto in prima nota che nessuno sa spiegare.

⚠️ E ne discende una regola di disegno, scritta nella migrazione: **lo stato di
«caparra già usata» andrà messo sul MOVIMENTO, non sulla caparra** — la caparra
può sparire con la prenotazione, il movimento no. Serve al Blocco 3.

### La causale che non c'era

Fra le 17 non ce n'era nessuna che nominasse una caparra: non era «scritta con
la causale sbagliata», **non c'era dove scriverla**. Nasce «Caparra ricevuta»,
`di_sistema` come le altre — non si spegne e non si marca costo fisso. Sul
gestionale vero le causali sono ora **18**.

### Togliere una caparra storna, e lo dice

Regola del 16/08: un documento che ha generato un effetto o è respinto o storna
nella stessa transazione. `togli_caparra` toglie caparra **e** movimento, e
restituisce di quanto scende il saldo — la frase si compone **prima** di
cancellare.

### Come si giudica, dai fallimenti — sul PROGETTO DI PROVA

Il blocco di verifica è stato estratto e lanciato contro un database rotto
apposta, perché rilanciare la migrazione intera rimetterebbe a posto la rottura
prima di verificarla.

| rottura | risposta |
|---|---|
| la chiave esterna torna a `cascade` | **`IL DENARO E' SPARITO con la prenotazione: il movimento di cassa non c'e' piu'.`** |
| un trigger azzera `caparra_evento_il` | `La data dell'evento non e' stata fotografata sul movimento.` |
| (prima stesura, rottura troppo larga) | è andata rossa sul controllo del bonifico, **senza raggiungere** quello in esame — la rottura è stata rifatta più stretta |

### I conteggi della verifica — PROGETTO DI PROVA

```
bonifico ACCESO: 1 conti correnti, il gestionale ha scelto il conto da se'
caparra registrata: movimenti 57 -> 58, causale «Caparra ricevuta», evento del 2026-09-25
cancellata la prenotazione: il movimento RESTA (95.00 euro), il riferimento si
svuota, la data dell'evento resta. Lapidi 2917 -> 2918
verifica: nessun residuo, lapidi tornate a 2917
```

Più, silenziosi perché corretti: **una caparra da zero euro respinta** con la
sua frase, e **correggere l'importo che sposta tutti e due i numeri senza
creare un secondo movimento**.

### 🔴 Il guardiano dei residui ha preso un errore mio

Alla prima stesura la verifica lasciava **una lapide in più** (2917 → 2918): il
movimento stornato da `togli_caparra` nel ramo del bonifico non era
nell'elenco degli identificativi da ripulire — avevo tenuto un solo `v_mov`
riusato. **È la trappola del 26/08 mattina ricomparsa la stessa sera**, e a
prenderla non è stata una rilettura ma `pretendi_nessun_residuo`. Corretto con
un array.

### Lato app

`setReservationDeposit` passa dal **corridoio** invece di scrivere dritta dal
browser: da oggi tocca due tabelle (Contratto B4). `registra_caparra` e
`togli_caparra` sono nell'elenco delle operazioni; corridoio installato **sulla
prova, alla versione 27**.

Prova nuova `tests/app/caparra-in-cassa.test.js`, 5 casi, tutti verdi sulla
prova: il movimento con la sua causale, il legame nelle due direzioni, la
correzione che non duplica, lo zero respinto, e **lo staff respinto** (col token
vero: `registra_caparra` è `security definer`, quindi dentro la funzione la RLS
non protegge più).

⚠️ **La prova è nata rossa per la trappola del 18/08, terza ricomparsa**:
`eseguiOperazione` usa **il collegamento dell'app**, e una prova che apre un
client suo fa parlare l'app da anonima — il corridoio risponde «Sessione non
valida» e sembra un guasto del corridoio.

---

## Blocco 5 — il bonifico, preparato e spento

**Cosa esattamente lo tiene spento**: `registra_caparra` con `p_mezzo =
'banca'` conta le righe di `conti_bancari`. Se sono **zero**, si ferma con
*«non c'è nessun conto corrente nel gestionale»*. Sul gestionale vero i conti
sono **0**.

**Non è un interruttore da ricordarsi di girare.** Il giorno che Alessio
registra il suo conto, la funzione lo trova e **si accende da sé** — e finché
il conto è uno lo mette il gestionale, come già decise il 25/08.

**Due lucchetti indipendenti**: la funzione, e il vincolo
`movimento_di_banca_ha_un_conto` già nel database. Il secondo regge anche se
qualcuno scavalcasse la prima.

⚠️ **Le due facce sono provate in due database diversi, ed è voluto**: sul
gestionale vero (0 conti) si prova che è **spento**; sulla prova (1 conto) che
si **accende da sé e sceglie il conto senza chiederlo**. Un interruttore che
dipende dallo stato non si può provare in un posto solo.

---

## Cosa abbiamo rovesciato

Niente di **deciso**. Il campo «Caparra €» non era la scelta di lasciare i
soldi fuori dalla cassa: era metà lavoro, e nessuna consegna l'ha mai
dichiarata come scelta.

⚠️ Cambia però una cosa che valeva **di fatto**: `setReservationDeposit`
scriveva dritta dal browser, e adesso passa dal corridoio.

---

## 🔴 Rilettura obbligatoria

### Per ogni numero, a quale gestionale

- **GESTIONALE VERO**: 270 migrazioni · ultima `…016` · 29 tabelle tracciate ·
  0 conti bancari · 0 caparre · 0 movimenti di cassa · 0 lapidi · 14 ricette ·
  8 impegni · 13 tavoli · tetto 10,00 · 18 causali · 11 tabelle da decidere.
- **PROGETTO DI PROVA**: 271 migrazioni · 57 movimenti di cassa · 3 caparre
  (tutte con `movimento_id` vuoto: sono anteriori) · 1 conto corrente · 2917
  lapidi prima della prova nuova · corridoio alla versione 27.
- **Le 3 caparre da 245,00 €** misurate ieri erano e restano **della prova**.

### Cosa NON ho verificato con gli occhi

- **Nessuna schermata aperta.** Il campo «Caparra €» non l'ho mai visto a
  video: non so come si presenta l'errore «una caparra di zero euro non è una
  caparra» né dove compare nella scheda.
- **Nessuna mano ha registrato una caparra dall'app.** Il giro è provato dal
  client (che è la cosa più vicina) e dentro la migrazione, non da un dito.
- **Il movimento non è stato visto in Prima nota.** Che compaia con la sua
  causale è letto dal database, non dalla schermata.
- **Il bonifico acceso non è mai stato visto da nessuno**: esiste solo come
  ramo di codice esercitato sulla prova.

### Cosa ho contato senza leggerlo

- **Le 424 prove dell'app**: ho letto il totale, non ciascuna.
- **I 57 movimenti di cassa della prova**: contati, non letti uno per uno.
- **Le 29 tabelle tracciate in produzione**: contate e verificate per le tre
  che mi interessavano, non riaperte tutte.

### Quali mie affermazioni sono diventate false mentre lavoravo

- Ho scritto nel corpo della migrazione che la caparra entra «in cassa nel
  momento in cui la ricevi, **non alla serata**». La frase è ambigua e per un
  momento l'ho applicata male: la data del movimento è
  `serata_di_servizio()`, cioè la giornata operativa — non il calendario. La
  decisione di Alessio riguarda **quando** (subito, non al conto), non quale
  data si scrive. Il primo tentativo usava `oggi_locale()`, che **in SQL non
  esiste**: la migrazione si è fermata e l'ho corretto.
- Il file della prova conteneva un `delete` sulle lapidi che **dichiarava una
  pulizia mai avvenuta**. Tolto e sostituito con la ragione misurata.

### Quali blocchi non ho aperto

- 🔴 **BLOCCO 3 — la caparra si propone alla chiusura del conto.** Non aperto.
- 🔴 **BLOCCO 4 — la caparra trattenuta.** Non aperto. Nessun quesito per il
  commercialista è stato scritto, perché la parte fiscale si tocca lì.

Sono i due pezzi che restano fra l'incasso e il conto: **oggi la caparra entra
in cassa e nessuno la scala**, quindi il cliente che paga il conto pieno la
paga due volte. È la prima cosa del prossimo giro.

### Quali voci di `docs/DECISIONI.md` ho toccato

**Aggiunta una sezione nuova**, *Caparre*, con le cinque decisioni del 26/08 e
lo stato di ciascuna (due ✅ costruite, due ⏳ non ancora). Nessuna voce
esistente modificata o contraddetta. La sezione *Registro delle cancellazioni*
di ieri non è stata toccata.

### Quali migrazioni restano in attesa, in ordine

1. `20260826000017_la_caparra_entra_in_cassa.sql`

🔴 **E L'ORDINE DOPO IL PUSH NON È INDIFFERENTE**: prima la migrazione
(`npm run migra -- --conferma`), **poi** la Edge Function
(`npm run funzione operazioni-atomiche -- --conferma`). Al contrario, il
corridoio accetterebbe `registra_caparra` e il database non l'avrebbe: il campo
«Caparra €» si romperebbe in produzione.

### Quali lezioni nuove ho messo nel file delle trappole

Una, in `CLAUDE.md` §8: **una pulizia che non ha il permesso non dà errore —
cancella zero righe in silenzio.** Misurato: `deleted_records` ha una sola
policy, in SELECT. Con la conseguenza generale (*una pulizia che dichiara di
aver fatto una cosa che non ha fatto è peggio di una che manca*) e l'esemplare
vivo già in casa: `tests/app/archivio-domande.test.js` fa lo stesso `delete`, e
non è mai servito a niente.

---

## Cosa resta scoperto, dichiarato

- 🔴 **Nessuno scala la caparra dal conto** (Blocco 3): il buco che il mandato
  di ieri ha misurato è ancora aperto per metà.
- 🔴 **La caparra trattenuta non esiste** (Blocco 4).
- ⚠️ **3 caparre della prova restano senza movimento.** Nessuna sanatoria le
  tocca: in produzione le caparre sono zero, quindi non c'era niente da sanare.
  `registra_caparra` le guarisce da sé se qualcuno ne corregge l'importo.
- ⚠️ **La prova nuova lascia una lapide per giro sul progetto di prova**, e non
  c'è modo di evitarlo dal client. Dichiarato nel file, non nascosto.
