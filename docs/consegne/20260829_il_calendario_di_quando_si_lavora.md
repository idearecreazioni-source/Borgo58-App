# Come si apre il gestionale, e il calendario di quando si lavora

**Blocchi 0 e 1 del mandato del 29/08/2026 (pomeriggio).**
**Commit dichiarato: `f2fdb2c`** — working tree pulito al momento del commit.
**Migrazione introdotta: `20260829000005`.**
⚠️ Applicata al progetto di prova, **non in produzione**: aspetta il push.

---

## Cosa abbiamo rovesciato

*Niente.* Nessuna decisione in vigore è stata contraddetta. Quattro voci
aggiunte a `docs/DECISIONI.md` nella sessione precedente; qui nessuna voce è
stata toccata.

---

# Blocco 0a — come si apre il gestionale vero a marzo

**È la domanda che Alessio ha chiesto per prima. La risposta è: da internet,
e non dipende dal suo computer.**

Misurato, non dedotto:

| cosa | misura |
|---|---|
| `https://borgo58.it` | risponde **200** in 0,37 s |
| `www.borgo58.it`, `borgo58-app.pages.dev` | 200 |
| `/comande`, `/prenota` chiesti direttamente | 200 |
| chi lo serve | **Cloudflare** (letto nelle intestazioni della risposta) |
| a quale database punta | `oudjuqbqszisdtwzbxdo` — **il locale vero** |
| è aggiornato? | il file del sito pubblicato ha lo **stesso nome** di quello che produce la compilazione del codice di adesso |

✅ **E l'ho aperto con gli occhi**: mostra la schermata del PIN e dichiara
**«DATI VERI — quello che scrivi qui conta davvero»**. Non sono entrato: il
PIN di Alessio non lo uso.

**Quindi, alle sue tre domande:**

1. **Sì, esiste un sito su un server sempre acceso** — Cloudflare — e ogni
   pubblicazione del codice lo aggiorna da sé.
2. **No, il gestionale vero non si apre dal suo computer.** Sul suo computer
   gira il gestionale **di prova** (`npm run dev:prova`, porta 5173): è
   un'altra cosa, collegata a un altro database.
3. **Se il suo computer è spento o rotto, il gestionale funziona lo stesso**,
   dal telefono e da qualunque dispositivo.

⚠️ **Cosa questa misura NON copre.** Ho verificato che il sito risponde e
che punta al database vero; **non** ho verificato quanto reggerebbe un
guasto di Cloudflare o di Supabase, né che qualcuno sappia rimetterlo su se
cadesse. E il gestionale vero non l'ho usato: mi sono fermato alla porta.

---

# Blocco 0b — il calendario: dove vive davvero

**La mia misura di ieri regge, e la discrepanza si spiega coi nomi.** Il
calendario dell'**apertura al pubblico** esiste in produzione, sotto nomi
inglesi — che è probabilmente perché cercandolo in italiano sembra non
esserci:

- **`service_hours`** — 14 righe (7 giorni × pranzo/cena) con `attivo`.
  Oggi: domenica a pranzo, martedì-sabato a cena, lunedì riposo.
- **`service_closures`** — chiusure a date (dal → al, col motivo).
  ⚠️ **Zero righe**: la struttura c'è, i dati no. Quindi ieri ho scritto che
  «ferie ed eventi sono coperti» — vero come struttura, **falso come dati**.
- **`service_settings`** — le regole generali del servizio.

**Quello che non esisteva affatto è il lavoro in cucina**: nessuna colonna,
da nessuna parte, diceva se in un giorno si cucina.

---

# Blocco 1 — il calendario di quando si lavora

## Chi doveva saperlo, e chi lo stava indovinando

Misurato aprendo i corpi vivi delle funzioni:

| chi | guarda gli orari | guarda le chiusure |
|---|---|---|
| prenotazioni pubbliche | ✅ | ✅ |
| Calendario Eventi | visita qualunque data — **voluto** dal 18/08 | — |
| **turni del personale** | ✅ | 🔴 **no** |

In un giorno di ferie, il servizio e la fascia oraria di ogni prenotazione
risultano **vuoti**, e la schermata non dice perché.

## 🔴 E la cura ovvia era sbagliata: provata e ritirata

Avevo riscritto `turni_del_giorno` perché non restituisse niente nei giorni
di chiusura. **La verifica l'ha bocciata**, e guardando meglio aveva
ragione: quella funzione non elenca turni di lavoro, elenca **le
prenotazioni di quella data**. Farle sparire il giorno in cui il locale
chiude vuol dire nascondere **proprio i clienti da avvisare** — un difetto
peggiore di quello che curava.

*Una schermata vuota è una rassicurazione falsa.*

Quindi qui si costruisce **la risposta** (`locale_aperto(data)`), e la
funzione dei turni **non è stata toccata**. Cosa debba fare la schermata
quando quel giorno è chiuso è una decisione di Alessio, ed è fra le domande.

## I due interruttori

Decisione esplicita di Alessio: **«aperto al pubblico» e «si lavora in
cucina» restano due cose distinte**, perché il giorno di chiusura è spesso
proprio quello delle preparazioni lunghe.

- **`settimana_cucina`** — 7 righe, una per giorno.
- **`service_closures.si_lavora_in_cucina`** — per dire, su una chiusura a
  date, che in cucina si lavora lo stesso. Vuoto = vale la settimana tipo.
- **`locale_aperto(data)`** e **`si_lavora_in_cucina(data)`** — le due
  domande secche, che è quello che il mandato chiedeva: non un'agenda.

### 🔴 Come nascono le sette righe

Un valore predefinito su una colonna nuova **risponde al posto di chi non ha
risposto**, e qui le due risposte comode sono entrambe sbagliate: tutto
`false` spegnerebbe le preparazioni ricorrenti senza dirlo, tutto `true`
direbbe che si cucina anche la domenica sera.

Ma **non tutte le caselle sono incerte allo stesso modo**: dove il locale è
aperto, che in cucina si lavori non è un'ipotesi — è una necessità. Quella
si riempie. Dove è chiuso, resta **vuota**.

Così le caselle da compilare a mano sono quelle vere: **in produzione una
sola, il lunedì**.

⚠️ **E il terzo stato si vede a schermo**: tre pulsanti, non una spunta —
con una spunta «non l'ho ancora deciso» sparirebbe dentro il no.

## Cosa ho visto con gli occhi

A 375 punti e su **tre densità**: zero sbordo dentro il riquadro e sulla
pagina, **zero bersagli sotto soglia** (21 pulsanti), zero testi sotto i
3,20 mm. E il gesto provato dal vivo: il lunedì passa a «si lavora», la
funzione che il Blocco 3 interrogherà risponde giusto per il 31 agosto,
**nessun altro giorno toccato**. Rimesso com'era.

## 🔴 Il metro ha mentito una quarta volta

Diceva **0** bersagli sotto soglia e poi **21** alla stessa densità.
`.tocco-bottone` vale 0,85 cm esatti — cioè **esattamente** la soglia — e il
confronto in virgola mobile la mancava per **0,007 mm**. Corretto con una
tolleranza, e riprovato su un caso di risposta nota: i pulsanti già
esistenti della stessa classe.

⚠️ E un secondo errore preso in tempo: avevo scritto un elenco dei giorni
indicizzato per numero, ma quello che la schermata usa già è fatto di
oggetti e **parte dal lunedì**. Indicizzarlo avrebbe mostrato i giorni
sfalsati di uno.

---

## Rilettura

**Cosa NON ho verificato con gli occhi.** Nessuna immagine: tutto è misurato
dal DOM. Del gestionale vero ho visto **solo la schermata di accesso** — non
sono entrato. Nessun turno è stato guardato in un giorno di ferie vero.

**Cosa ho contato senza leggerlo.** Le funzioni che leggono gli orari le ho
prese da un setaccio sul catalogo e ne ho aperte **tre**: se una quarta li
leggesse per una strada che il setaccio non riconosce, non l'avrei vista.

**Quali mie affermazioni sono diventate false mentre lavoravo.** Il messaggio
finale della migrazione diceva «i turni non si propongono più nei giorni di
chiusura» — vero mentre lo scrivevo, **falso dopo che ho ritirato quella
correzione**. Corretto. E ieri avevo scritto che le chiusure «coprono ferie
ed eventi»: la struttura sì, i dati sono **zero righe**.

**Quali conteggi sono pavimenti.** «Tre funzioni che leggono gli orari», per
la ragione qui sopra.

**Cosa ho lasciato sul progetto di prova.** La migrazione applicata. Il
lunedì della settimana della cucina è stato toccato e **rimesso a vuoto**,
verificato leggendo tutte e sette le righe. Nessuna lapide: la verifica
conta i residui su tutte le tabelle e passa.
