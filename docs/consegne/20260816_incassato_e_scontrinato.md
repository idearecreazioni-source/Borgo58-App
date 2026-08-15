# Consegna del 16/08/2026 (prima) — incassato e scontrinato

> ⚠️ **DOCUMENTO POSTUMO.** Scritto il 16/08/2026 **dopo** il push del
> commit e **dopo** che la migrazione era già stata applicata in
> produzione. Scostamento dalla regola di `CLAUDE.md` §2; **l'eccezione
> d'emergenza non si applica**, era lavoro nuovo. Rilevato dal validatore;
> la rete che impedisce il ripetersi è in
> `20260816_i_riepiloghi_arretrati.md`.

**Commit coperto: `a565379`.**

**Applicata in produzione**: `20260816000001` (15/08, ore 22:30). **108
migrazioni.** Corridoio non toccato (**v24**): nessuna operazione nuova —
scrivere il documento fiscale su un conto è una tabella sola, categoria A.

⚠️ Questa consegna **non modifica** `docs/CONTRATTO.md`.

---

## 1. Da dove nasce

Da una domanda operativa di Alessio: *«se un collaboratore incassa senza
documento fiscale, cosa mi aspetto? e se un cliente vuole la fattura che
gli mando domani?»*.

🔴 **La risposta onesta era che il gestionale non se ne accorgeva**, e non
per una scelta: un conto chiuso portava l'importo, il modo di pagamento e
i piatti, e del documento fiscale non c'era traccia. Un conto incassato e
mai scontrinato era, per il gestionale, **identico a tutti gli altri**.

---

## 2. Due totali, non uno

**Incassato** e **fiscalizzato** sono numeri diversi, e ciò che serve è la
**differenza** con sotto l'elenco dei conti che la compongono. Un numero
solo li nasconderebbe entrambi — è la stessa forma del saldo di cassa che
escludeva in silenzio gli incassi di sala.

⚠️ **La differenza non sparisce da sola**: resta finché non la si chiude,
come le fatture da pagare nelle uscite attese. *Un elenco che si svuota da
solo è un elenco che non serve a niente.*

---

## 3. Il terzo stato, e qui è il più importante di tutti

La colonna nasce **vuota**, e vuoto vuol dire «nessuno ha ancora detto
cosa è stato emesso» — **non** «niente è stato emesso».

⚠️ Se il valore predefinito fosse «scontrino», la quadratura **tornerebbe
sempre, per costruzione**, proprio nel caso in cui serve che non torni.
Sarebbe un numero rassicurante e falso: la stessa forma dell'elenco
allergeni vuoto e dello scarto a zero.

⚠️ **Conseguenza dichiarata nell'avvertenza**, perché non sembri un
guasto: oggi tutti i conti risultano da fiscalizzare, perché il
registratore telematico non c'è e quindi **nessun conto ha davvero un
documento**.

---

## 4. Cosa il modello tiene separato

- **«Fattura da emettere» è un impegno preso con un cliente**, non una
  dimenticanza, ed è contata a parte. Confonderle toglierebbe
  l'informazione.
- **Una fattura non si dichiara emessa senza dire quando**: vincolo del
  database, perché quella data è la sola cosa che distingue «fatta» da
  «promessa».
- **Gli omaggi restano fuori per costruzione** — incasso zero, nessun
  corrispettivo da emettere — e non per una condizione scritta a mano che
  qualcuno può dimenticare.

---

## 5. Cosa NON è stato toccato, e perché

⚠️ **La chiusura del conto in sala non chiede cosa è stato emesso.**

Due ragioni, e la seconda è la più forte:
1. Lezione del 14/08: rendere obbligatoria la causale ruppe l'«alla
   romana». Prima di aggiungere un campo a un gesto si guarda **chi lo
   chiama** — e qui il chiamante è la sala, con un cliente che aspetta.
   Chi non risponde lascia il conto in elenco: **non blocca, ricorda**.
2. Oggi quella domanda avrebbe **una sola risposta possibile**: senza
   registratore telematico nessuno può battere uno scontrino. Quando il
   registratore arriverà riempirà la colonna da solo per gli scontrini, e
   l'unico caso manuale rimasto — «vuole fattura» — meriterà di essere
   chiesto al momento.

---

## 6. Verifica

| Cosa | Stato |
|---|---|
| la migrazione sul progetto di prova | **applicata tre volte**: idempotente |
| tre conti: scontrinato, fattura promessa, niente | **i tre totali tornano** (100 incassati, 50 fiscalizzati, 50 in sospeso) |
| la fattura promessa è contata **a parte** | **provato** (30 su 1 conto) |
| l'elenco mostra solo i conti in sospeso | **provato** |
| si sistema dopo, e il conto esce dall'elenco | **provato** in migrazione e da fuori |
| una fattura senza data di emissione | **respinta dal vincolo**, anche scrivendo in tabella |
| un omaggio (incasso zero) non risulta da fiscalizzare | **provato** |
| …e l'avvertenza lo dichiara | **provato** |
| lo staff respinto su quadratura ed elenco | **provato col token vero** |
| prove automatiche | **90 verdi** (erano 86) |
| lint, build | puliti |
| **produzione** | **108 migrazioni**, corridoio **v24** (non toccato) |
| elenco anonimi · `security definer` senza portiere | **12** · **13**, invariati |
| residui in produzione | **zero** |
| avvisi partiti durante l'applicazione | **zero** |

---

## 7. Il primo dato vero di questo blocco

⚠️ **La schermata non è nata vuota.** In produzione c'era già un conto
chiuso da Alessio la sera del 15/08 — Divano 3, 2 coperti, pagato in
contanti, senza documento — e compare subito nell'elenco dei conti da
sistemare. Quello stesso conto è anche il primo incasso di sala che entra
nel saldo del contante, letto dai conti chiusi come previsto dal Blocco 6a.

È il primo pezzo di dato reale su cui questa parte del gestionale lavora.

---

## 8. Cosa NON è verificato

- ⚠️ **Nessuno ha usato la schermata**: i pulsanti «Scontrino fatto»,
  «Vuole fattura» e «Fattura fatta» non li ha premuti una mano vera.
- **Il caso «fattura da emettere» non è mai stato percorso in
  produzione**, solo in migrazione e nelle prove.
- **Il confronto col registratore telematico non esiste**: è il pezzo che
  darà la verifica esterna, e dipende dall'hardware (Contratto B1).
- **Un solo conto reale** in produzione: tutto il resto è provato su dati
  costruiti apposta.
