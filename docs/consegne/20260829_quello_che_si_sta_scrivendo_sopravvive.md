# Quello che si sta scrivendo sopravvive a una ricarica

**Blocco 1 del mandato del 29/08.** Commit `af797e2`.
**Nessuna migrazione**: al database non serviva niente.

---

## Cosa abbiamo rovesciato

**Niente.** Nessuna voce in vigore di [`DECISIONI.md`](../DECISIONI.md) è stata
contraddetta. Il blocco aggiunge un comportamento che non esisteva.

---

## Il difetto, e la causa MISURATA

Riferito da Alessio: sul telefono, mandando l'app in secondo piano e
riprendendola, la schermata si ricarica da capo — e **se stava scrivendo
qualcosa, lo perde**. Succedeva a intervalli, e anche a lavori fermi.

La mia ipotesi precedente («è la ricarica automatica quando cambio dei file»)
era già caduta per quel motivo. La causa vera l'ho **letta nel programma che
il server di prova serve al telefono**, riga 1004 del client di Vite:

```js
if (payload.event === "vite:ws:disconnect") {
  if (hasDocument && !willUnload) {
    console.log(`[vite] server connection lost. Polling for restart...`)
    await waitForSuccessfulPing(url.href)
    location.reload()          // ← qui
  }
}
```

Quando il collegamento col computer cade, aspetta che torni e **ricarica la
pagina**. Cadere è esattamente ciò che iPhone fa a una scheda messa in secondo
piano. Questo spiega tutte e tre le cose che Alessio ha descritto:

| quello che vedeva | perché |
|---|---|
| si ricarica rientrando nell'app | il collegamento è caduto mentre era via |
| succede anche a lavori fermi | non dipende dai file: dipende dal collegamento |
| a intervalli | un rientro veloce non fa in tempo a farlo cadere |

---

## ⚠️ Ma la causa non è il problema

Quella ricarica **vive solo mentre si sviluppa**: il sito pubblicato è statico
e quel programma non ce l'ha dentro. Se avessi «curato la ricarica» avrei
curato una cosa che a marzo non esisterà.

La ricarica però resta possibile per tre strade che ci saranno anche a marzo:
iPhone che scarica dalla memoria un'app rimasta indietro, un trascinamento in
giù per sbaglio, un guasto. **Quello che non è accettabile non è la ricarica:
è perdere quello che si stava scrivendo.** Si cura quello.

---

## Il reperto: 47 schermate su 76

Misurato con un metro provato **prima** su due casi di risposta nota — la
scheda ricetta (deve dare difetto) e il manuale HACCP da stampare (deve dare
zero).

| | |
|---|---|
| schermate con almeno un campo legato allo stato | **76** |
| di queste, quelle da cui si SALVA | **47** |
| **perdono tutto a una ricarica** | **47** |
| campi in gioco | **396** |

⚠️ **Il mio primo caso «noto» era sbagliato, non il metro.** Credevo che il
manuale HACCP non avesse campi: ne ha due, il periodo. Ma un **filtro** non è
«quello che si sta scrivendo» — si ridigita in due secondi. Il criterio è
diventato: i campi devono alimentare un **salvataggio**, riconosciuto da un
`await` (un salvataggio va sul server e si aspetta; un filtro no).

---

## Il telaio: si guarda la SCHERMATA, non lo stato del programma

Ogni schermata tiene i propri campi a modo suo; quello che hanno tutte in
comune è che **i campi sono sulla pagina**. Riprendendoli da lì, una schermata
nuova è coperta senza che nessuno si ricordi di aggiungerci niente — stessa
forma del segnale delle letture tagliate, che sta nel punto unico da cui
passano le letture invece che in ogni schermata.

* `src/lib/calcoli/bozza.js` — la regola, pura e provabile da sola.
* `src/lib/bozza.js` — la metà che tocca la pagina.
* `src/components/RipresaBozza.jsx` — la riga che lo dichiara.

**Si fotografa** quando il browser sta per mandare la pagina in secondo piano
(`pagehide`, `visibilitychange`), cioè un istante prima della ricarica che
interessa, e ogni 0,4 secondi mentre si scrive. **Si rimette** solo all'avvio
della pagina: passando da una schermata all'altra dentro il gestionale questo
codice non gira affatto, ed è voluto.

⚠️ **La memoria è quella della sessione, non quella lunga.** Quello che si sta
scrivendo appartiene a *questa* apertura del gestionale: una ricarica lo
ritrova, chiudere l'app lo lascia andare. Con la memoria lunga bisognerebbe
inventare una scadenza, spazzare le vecchie e decidere cosa fare di una bozza
di tre giorni fa trovata sopra dei dati nel frattempo cambiati. Qui quel
problema non esiste.

---

## Le due regole che, sbagliate, sbaglierebbero in silenzio

**🔴 Il PIN non si conserva mai.** È l'unica riga senza un prezzo da
discutere. Provata anche dal vivo, non solo con una prova pura: scritto
«481516» in un campo della stessa forma di quello vero della schermata
d'ingresso, mandata l'app in secondo piano — **non compare nella fotografia**.

**🔴 Il vuoto non si conserva.** Se si conservasse, bastava mettere l'app in
secondo piano *mentre i dati stanno ancora arrivando dal database* per
fotografare una schermata tutta vuota, e la ricarica dopo **cancellerebbe dati
veri**. ⚠️ Il prezzo è dichiarato: un campo svuotato apposta torna pieno. Fra
«un campo svuotato torna pieno» e «dei dati veri spariscono» non c'è partita.

**Rotta in due modi**, e ognuno fa fallire un controllo **diverso**:

| rottura | prova che diventa rossa |
|---|---|
| il PIN entra fra i campi conservabili | «il PIN non si conserva, per nessun motivo» |
| si conserva anche il vuoto | «il VUOTO non si conserva» |

---

## E la ripresa si dichiara, mai in silenzio

Un valore che compare da solo deve dire da dove viene. Dopo la ricarica
compare una riga: *«La pagina si è ricaricata e ho rimesso quello che stavi
scrivendo — controlla che sia giusto prima di salvare»*, con accanto **«Non
l'avevo scritto io»**.

⚠️ E se ne va da sola dopo otto secondi, al contrario dell'avviso delle letture
tagliate. Quello dichiara che dei **numeri sono parziali**, e finché resta
qualcuno potrebbe crederci; questo dichiara un fatto già avvenuto e
verificabile guardando i campi.

---

## Visto a schermo, su due casi

**Modulo nuovo** (`/ricettario/ingredienti/nuovo`): scritto senza aspettare,
app in secondo piano, ricarica. Testo e numero tornano, e la riga lo dichiara.

**Scheda che si riempie DAL DATABASE**: corretto il nome di un ingrediente
esistente senza salvare, ricarica — la correzione sopravvive **anche se il
database rimette il valore vecchio dopo**. E il valore è dentro React, non solo
sullo schermo: letto dalle sue proprietà e provato con **cinque render
forzati**. Quindi al salvataggio partirebbe quello giusto.

⚠️ **Nessun salvataggio è stato premuto**: il database di prova è intatto —
133 ingredienti prima e dopo, nome originale invariato.

---

## Rilettura

**Cosa NON ho verificato con gli occhi**
- **Il telefono vero di Alessio.** Tutto è stato provato in un browser,
  simulando la sequenza esatta (secondo piano → ricarica). Su iPhone la
  ricarica arriva per la stessa strada, ma **nessuna mano l'ha provata**.
- **Le altre 45 schermate**: il telaio le copre tutte per costruzione, ma ne ho
  aperte **due**.

**Cosa ho contato senza leggerlo**
- Le 47 schermate e i 396 campi vengono da un setaccio sul codice: non ho
  aperto tutti i file. Il metro è provato su tre casi, non su settantasei.

**Quali mie affermazioni sono diventate false mentre lavoravo**
- Avevo scritto che il manuale HACCP «non ha nessun campo»: ne ha due.
  Corretto misurando, e il criterio ne è uscito migliore.

**Cosa ho lasciato sul progetto di prova**
- Niente. Nessuna riga scritta, nessuna lapide.

---

## Domande

Nessuna su questo blocco.
