# Consegna del 14/08/2026 (quattordicesima) — il pulsante dove sta il gesto

**Commit della consegna: `511a851`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa |
|---|---|
| `511a851` | il pulsante dove sta il gesto: dentro il tavolo, non fisso in cima |

**Nessuna migrazione.** Produzione invariata: **97 migrazioni**, corridoio
**v20**, elenco anonimi **12**. Solo schermata.

Quinta e ultima coda del blocco Sala. ⚠️ **Questa volta la correzione
precedente funzionava**: Alessio l'ha provata, la doppia prenotazione si
faceva, e la sua osservazione è su *dove* stava il comando.

---

## 1. La correzione della correzione

> *«ho provato e funziona ma avrei preferito che comparisse un pulsante
> "aggiungi prenotazione" quando si tocca un tavolo già prenotato
> piuttosto uno fisso in alto»*

Ha ragione, ed è **la stessa idea di tutta questa schermata**: il gesto
comincia dalla sala, non da una barra dei comandi.

Il pulsante fisso risolveva il difetto ma **lo risolveva lontano dal
punto in cui il problema si presenta**: tocchi il tavolo di Rossi, e la
via per aggiungerne un'altra sta da un'altra parte. È lo stesso errore di
forma della prenotazione che si prendeva su un'altra pagina — corretto
ieri, e ripetuto in piccolo.

**Ora**: tocchi il tavolo → si apre quella prenotazione → dentro c'è
**«+ Aggiungi una prenotazione su questo tavolo»**, che parte con quel
tavolo già scelto. Cominciare da un tavolo **libero** resta un tocco solo,
come prima: è il caso normale, e il caso normale non deve costare di più.

---

## 2. ⚠️ Dove mi sono scostato dalla sua richiesta, e perché

Alessio ha detto *«un tavolo già prenotato **entro le 20**»* — cioè i
**gialli**.

**Il pulsante compare anche sui verdi.** Non è una svista: la sua
decisione di ieri, presa fra tre strade, era che **il verde avvisa e non
blocca**. Nasconderlo lì sarebbe bloccare dalla finestra ciò che avevamo
deciso di non bloccare dalla porta — e con la peggiore delle
motivazioni, cioè per comodità di chi implementa.

Al posto del divieto c'è la frase, accanto al pulsante:

- *«Arriva entro le 20:00: il tavolo può servire una seconda volta.»*
- *«Arriva dopo le 20:00: è l'ultimo giro di questo tavolo.»*

Poi decide lui, come per tutto il resto di questa sala. **Se preferisce
che sui verdi il pulsante sparisca davvero, è una riga** — ma va detto
che sarebbe un cambio della decisione di ieri, non una rifinitura.

---

## 3. Verifica

| Cosa | Stato |
|---|---|
| lint, build | puliti |
| prove automatiche | **55 verdi**, invariate |
| modifiche al database | **nessuna** |
| **produzione** | **97 migrazioni**, invariata |
| file toccati | `PiantaGiornata.jsx`, questo riepilogo |

⚠️ **Un difetto introdotto e corretto durante il lavoro**: togliendo il
pulsante fisso è rimasto un `</div>` orfano — il riquadro che lo
conteneva era stato aggiunto insieme a lui. La build si è fermata subito
con «Expected corresponding closing tag». Nessun rischio (non compilava,
quindi non poteva uscire), ma va scritto: **il gancio pre-commit ha fatto
esattamente il lavoro per cui esiste.**

---

## 4. Cosa NON è verificato, e lo dico chiaro

- **Il pulsante nuovo non è stato premuto da nessuno.** Vale ancora quanto
  scritto nel riepilogo precedente: nessuna prova automatica copre questa
  schermata, e il comportamento del tocco è verificato solo leggendolo.
- **La doppia prenotazione col pulsante contestuale** — tocco il tavolo di
  Rossi, aggiungo Bianchi alle 21:30, il tavolo diventa mezzo giallo e
  mezzo verde — è la prova che chiude tutta questa serie, e non è ancora
  stata fatta.
- **Restano non provati da una mano vera** il trascinamento e il giro del
  tavolo.
- ⚠️ **In produzione restano due prenotazioni di prova** di Alessio
  («alessio» e «Alessio», entrambe alle 20:00): da togliere prima che
  arrivino prenotazioni vere (§5 punto 8).
- **La riga del Contratto §5 sui tavoli uniti è ancora quella vecchia.**
  Quinto riepilogo che lo dichiara. È un commit separato di due minuti e
  aspetta un sì; finché non arriva, **il Contratto descrive come "da
  decidere" una cosa che è in produzione da oggi** — ed è esattamente il
  tipo di scostamento che il documento esiste per impedire.
