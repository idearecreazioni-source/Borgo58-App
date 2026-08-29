# Lo scadenziario entra anche in un magazzino vuoto

**Coda dell'applicazione in produzione del 29/08 (sera)** · 29/08/2026

| | |
|---|---|
| commit del lavoro | `a0ceddf` |
| migrazione introdotta | `20260829000022_lo_scadenziario_entra_anche_a_magazzino_vuoto.sql` |
| migrazione che registra | `20260829000006_lo_scadenziario_sa_di_piu.sql` |
| applicata in produzione | **NO** — nata dopo il push, aspetta il prossimo |
| applicata sul progetto di prova | sì, e rotta due volte |

---

## Cosa è successo

Applicando i diciassette lavori in attesa, la catena si è fermata alla
**seconda**:

```
ERROR: Verifica impossibile: nessuna partita con scadenza in giacenza.
```

**Non è un guasto: è una guardia voluta.** Il blocco di verifica della
`20260829000006` si rifiuta di passare su un magazzino vuoto, e ha
ragione — lì sotto ogni controllo passerebbe senza provare niente, che è
la trappola del caso vuoto del 17/08.

⚠️ **Ma quella guardia ha un prezzo che nessuno aveva pagato prima.** In
produzione gli ingredienti sono **zero**, quindi lotti con scadenza non ce
ne sono e non ce ne saranno finché non entra la prima merce vera. Quella
migrazione **non può entrare in produzione**, oggi e per tutto il tempo in
cui il magazzino resta vuoto.

### Cosa è entrato davvero, misurato oggetto per oggetto

Il messaggio dello strumento dice *«questa girava dentro una transazione:
non ha lasciato niente a metà»*. **Non gli ho creduto** — è la regola del
28/08, quando il registro diceva una cosa e il database un'altra. Misurato
subito dopo:

| cosa | esito |
|---|---|
| migrazioni registrate | 321 → **322**: solo la `20260829000005` |
| `settimana_cucina` | creata, **7 righe** |
| `si_lavora_in_cucina(date)` | c'è |
| `service_closures.si_lavora_in_cucina` | c'è |
| `partite_in_scadenza` | **ancora la firma vecchia** — la `…006` non ha lasciato niente |

Il messaggio diceva il vero, ma l'ho verificato invece di crederci.

---

## 🔴 E LA CONSEGUENZA NON ERA TEORICA

Il codice della schermata **Scadenze** è **già pubblicato** — ogni push su
`master` ripubblica il sito — e legge due colonne che solo quella
migrazione aggiunge: `ferma_da` e `e_preparazione`. Senza di lei:

* a schermo si leggerebbe **«ferma da undefined giorni»**;
* il filtro **«comprati / preparati»** metterebbe **tutto** fra i comprati
  e **niente** fra i preparati, **senza nessun errore**.

⚠️ **Oggi non morde**, perché con zero lotti quella schermata è vuota: è un
difetto **armato**, che scatterebbe col primo carico. È la stessa forma
del 22/08, quando il codice online chiedeva una colonna che il database
vero non aveva e in sala aggiungere un piatto a una comanda falliva.

**È questa la ragione per cui non mi sono limitato a saltarla.**

---

## La cura

`…022` installa **lo stesso identico corpo** della `…006` — ripreso dal
database del progetto di prova, dove quella migrazione è applicata, e non
ricopiato dal file — e lo verifica con un esempio che **si costruisce da
sé**: un ingrediente e un lotto creati lì dentro, controllati, e tolti.

⚠️ *Un esempio si costruisce, non si prende in prestito: se una verifica
dipende dai dati di Alessio, cade il giorno che quei dati mancano.* La
`…006` prendeva in prestito, e infatti è caduta.

⚠️ **I permessi sono quelli MISURATI** su tutt'e due i database prima di
toccare niente — `security definer`, chiuso ad `anon`, aperto a chi ha
fatto il login — non ricopiati da una funzione accanto. È l'errore che
avevo già pagato poche ore prima sulla `20260829000018`.

⚠️ **La `…006` si registra qui**, come il 24/08 la `…032` registrò la
`…030`. Senza, ogni prossima applicazione la riproverebbe e si fermerebbe
sullo stesso punto. **E va saltata per sempre**, anche in una ricostruzione
da zero, finché il magazzino di partenza è vuoto:

```bash
npm run migra -- --salta 20260829000006 --conferma
```

---

## Come è stato provato

Applicata **prima sul progetto di prova**, come vuole la regola. Poi rotta
due volte, su due controlli diversi:

| rottura | dove fallisce |
|---|---|
| `ferma_da` torna sempre vuota | controllo (2) — *«a schermo si leggerebbe "ferma da undefined giorni"»* |
| i giorni alla scadenza contati con uno in più | controllo (3) — *«i giorni che mancano sono 4 invece di 3»* |

🔴 **E la prima rottura che avevo scritto non provava niente**: aveva
prodotto SQL non valido, e la verifica falliva con *«function does not
exist»* — cioè su un controllo che non stavo mettendo alla prova. Rifatta
in modo che la funzione resti valida.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di `docs/DECISIONI.md` è toccata: qui
non si cambia nessuna regola, si mette in produzione una funzione che il
codice pubblicato già si aspetta.

---

## RILETTURA

**Cosa NON ho verificato con gli occhi**
* **La schermata Scadenze non è stata aperta** dopo questo lavoro: in
  produzione è vuota (zero lotti) e sul progetto di prova mostrava già le
  due colonne, perché lì la `…006` era applicata da stamattina.
* **Il difetto «ferma da undefined giorni» non l'ho visto succedere**: l'ho
  dedotto leggendo il codice della schermata e misurando che la funzione in
  produzione non restituisce quelle colonne. È un ragionamento, non una
  fotografia.

**Cosa ho contato senza leggerlo**
* «321 → 322» e i conteggi delle tabelle vengono da query dirette.
* «zero ingredienti in produzione» è un `count(*)`.

**Quali mie affermazioni sono diventate false mentre lavoravo**
* Avevo scritto, applicando, che i diciassette lavori sarebbero entrati
  tutti. **Falsa alla seconda.**
* La prima rottura che ho scritto la credevo valida: non lo era.

**Cosa ho lasciato sul progetto di prova**
* **Niente**: ingredienti con nome `VERIFICA-29AGO%` **0**, lotti orfani
  **0**, e la funzione è tornata sana dopo le due rotture.
