# Consegna del 12/08/2026 — chiedi all'archivio

**Commit della consegna: `6dc76ba`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

Il pezzo che «posta viva» aveva lasciato pronto senza costruirlo:
`documents.testo` conservava il contenuto di ogni documento letto, e non
serviva a niente.

**Da applicare in produzione**: `20260812000009`.
**Da installare**: `assistente-archivio`.
**Non ancora provato dal vivo**: nessuna domanda vera è stata fatta.

---

## 1. Il problema, detto per bene

L'Archivio si cerca per titolo. Per trovare un documento bisogna già
sapere come si chiama — e per sapere quanto è costato il notaio bisogna
aprirlo e leggerlo.

«Quanto ho speso dal notaio» e «quando scade il contratto di locazione»
non sono ricerche: sono domande, e la risposta sta **dentro** i file.

---

## 2. Due pezzi, e la divisione è quella di ieri

| | |
|---|---|
| `documenti_per_domanda()` | mette l'Archivio in ordine di pertinenza — titolo, controparte, note, **contenuto**. Non decide, non chiama nessuno, non costa niente |
| `assistente-archivio` | prende quell'ordine, riempie il contesto finché ha spazio, fa la domanda |

Stesso criterio della sentinella di stamattina: **la parte che si può
provare a costo zero si prova a costo zero**. Il ranking è verificato
dentro la migrazione e in 5 prove automatiche, senza chiamare l'AI.

---

## 3. Senza limite in SQL, di proposito

Il ranking gira su **tutto** l'Archivio visibile. Un `limit` lì dentro
produrrebbe la trappola del §8 di `CLAUDE.md` — documenti che sembrano
completi e non lo sono: alla domanda *«ho ricevuto niente da questo
fornitore?»* risponderebbe **no** avendo guardato i primi venti.

Il taglio lo fa chi chiama, sul contesto del modello, **e lo dichiara**.
Ogni risposta porta con sé:

- quanti documenti esistono in archivio,
- quanti ne ha letti per intero, e **quali** (con il link),
- quanti non hanno il contenuto conservato,
- se ha dovuto ripiegare sui più recenti perché la domanda non
  somigliava a niente.

Il motivo non è la trasparenza in astratto. È che un *«non risulta»* che
significa *«non ho guardato lì»* è indistinguibile da un *«non c'è»* — e
la seconda volta non lo si verifica più.

---

## 4. Il permesso non si reimplementa

`documenti_per_domanda()` è **`security invoker`**. Nessun `definer`,
nessun controllo di ruolo dentro la funzione: decide la RLS di
`documents`, come per qualunque altra lettura dell'Archivio. Uno del
personale che la chiamasse riceve **zero righe**, non un rifiuto — e non
c'è una seconda serratura da tenere allineata alla prima.

Provato dai due ruoli veri, su un archivio **non vuoto** (§5 punto 2).

---

## 5. Due difetti trovati provando, non leggendo

**1. `ts_rank` non restituisce zero quando non trova niente.**
Restituisce `1e-20`. Un numero piccolissimo *e diverso da zero*: chi
chiama lo legge come «un po' pertinente» e infila nel contesto — a
pagamento — documenti che non c'entrano nulla. Serve il test `@@`
esplicito prima del rank, perché **zero deve significare zero**.

**2. Una domanda non è una ricerca.** `websearch_to_tsquery` pretende
tutte le parole insieme: *«chi mi fa la manutenzione della caldaia?»* non
trova niente, perché nessun documento contiene anche il «fa». Le parole
vanno cercate **in alternativa** fra loro, e chi ne contiene di più viene
prima.

Il giro attraverso `plainto_tsquery` (e poi `&` → `|`) non è un vezzo: è
quello che toglie la punteggiatura e le parole vuote e riduce ogni parola
alla radice — «manutenzione» → «manutenzion». Spezzare la frase a mano
vorrebbe dire riscrivere l'italiano.

Nessuno dei due era visibile nel codice. Il primo l'ha trovato la
verifica della migrazione, il secondo la verifica subito dopo.

---

## 6. Quanto costa, scritto dove si vede

`domande_archivio` tiene domanda, risposta e token di ogni giro. Due
scopi: rileggere una risposta senza ripagarla, e **vedere la spesa
crescere prima che sia cresciuta**. È il conteggio che la consegna della
posta aveva dichiarato mancante.

Il registro si scrive col token di Alessio — nessuna chiave di servizio,
la RLS fa da sola — e se quella scrittura fallisse la risposta arriva lo
stesso: perdere il conteggio è meno grave che perdere la risposta appena
pagata. La risposta dice se il registro è stato scritto.

Modello: `claude-opus-5`. Le domande sull'Archivio sono domande su soldi,
scadenze e obblighi — una risposta sbagliata qui costa più del modello
grande. Tetto per giro: ~80.000 caratteri di contenuto, 12 documenti.

---

## 7. Legge e basta

Non scrive nell'Archivio, non crea promemoria, non tocca un documento.

Il giorno in cui un assistente potrà anche *fare*, sarà un'altra funzione
e passerà dal corridoio con la conferma di Alessio in mezzo. La regola
del modulo posta — *il sistema propone, io confermo* — non si perde per
strada perché qui sarebbe stato comodo.

La difesa contro le frasi rivolte al modello è ripetuta nelle istruzioni
(un documento archiviato può contenerle come un'email), ma quella che
conta resta strutturale: **questa funzione non ha niente da eseguire.**

---

## 8. Verifica

| Cosa | Stato |
|---|---|
| migrazione sul progetto di prova | **applicata due volte**: idempotente |
| pertinenza calcolata dal contenuto, non dal titolo | **provata** (la parola cercata non è in nessun titolo) |
| zero significa zero | **provata**: è la prova che ha trovato l'`1e-20` |
| l'elenco è tutto l'archivio, anche ciò che non c'entra | **provata** |
| il personale vede zero righe, su archivio non vuoto | **provata**, dai due ruoli veri |
| il registro delle domande rifiuta il personale | **provata** |
| prove automatiche | **29 verdi** sul progetto di prova (5 nuove) |
| lint, prove di unità, build | puliti |
| **una domanda vera al modello** | **mai fatta** |
| **produzione** | **non applicata** |

**Il limite più importante da dichiarare**: dei 4 documenti oggi in
Archivio **uno solo ha il contenuto conservato** — gli altri tre sono
stati archiviati prima che esistesse quella colonna. L'assistente lo dice
da sé («di quelli conosco solo la scheda»), ma va saputo prima: le prime
domande potranno rispondere per intero solo sui documenti entrati dopo.
Il contenuto dei tre vecchi non è recuperabile senza rileggerne i file.

---

## 9. Cosa resta

- **Il carico da fattura** (magazzino + HACCP): è il prossimo, per ordine
  di Alessio. Oggi la lettura della posta lo propone come «cose da fare a
  mano»; quando esisterà diventerà un'azione automatica di quell'elenco.
- La logica interna dei moduli che toccano soldi e obblighi — Cassa /
  Prima Nota, Proiezione Fiscale, Personale, HACCP.
