# Lo scaduto torna ogni giorno, finché non si spunta — 27/10/2026

**HEAD dichiarato sotto questo riepilogo:** il commit che contiene questa riga, sul ramo `claude/ritardo-torna-oggi` aperto da `origin/slave` `223242e`. Working tree pulito.
**Nessun database e nessuna funzione toccati.**

## Origine
Alessio, il 27/10: *«vorrei che gli impegni in ritardo non finissero più nella sezione "in ritardo" ma vorrei che mi vengano riproposti nei giorni a seguire fino a quando non li spunto»*.

## Cosa cambia
- **Agenda:** la sezione «In ritardo» non c'è più.
  - Uno scaduto si legge in «Questa settimana», sotto **«Oggi»**, prima di quelli di oggi. Domani sarà ancora sotto «Oggi», e così ogni giorno finché non si spunta.
  - Il campo Scadenza dice «20/10/2026 · scaduto da 7 giorni», in forte.
  - Questi sono `giornoInAgenda` e `sezioneDi` in `src/lib/calcoli/agenda.js`.
- **Dashboard:** gli «Impegni di oggi» comprendono gli scaduti non spuntati, per primi, con «· scaduto il 20/10/2026».
  - Prima, il giorno dopo la scadenza, l'impegno spariva dalla Dashboard: la domanda era `due_date = oggi`, ora è `due_date <= oggi`.
- **La scadenza nel database non si sposta.** Resta la data vera, e così:
  - una ricorrenza continua a contare da lì;
  - il calendario mensile lo mostra al suo giorno;
  - `agenda_corsie` dice ancora `in_ritardo`, e su quella corsia contano il numero accanto al titolo e MEMO («Cosa sono in ritardo?»). Cambia dove si legge, non il dato: è lo stesso principio della stella.
- Le stellate e i lavori da fare scaduti restano nella loro sezione, come prima, con la frase «scaduto da».

## Verificato
- **Prove pure:** `agenda-sezioni` con quattro casi nuovi. Nuova `dashboard-legge-gli-scaduti`: la domanda al database.
- **Prove di schermata:**
  - nuova `agenda-scaduti-sotto-oggi`: lo scaduto sta sotto «Oggi», prima di quello di oggi, e non compare «In ritardo». È rossa se si torna a raggruppare per `due_date`, e l'ho provato;
  - nuova `dashboard-scaduti-oggi`.
- **Revisione `ecc:code-reviewer`:** approva. Applicati due rilievi:
  - tolto il colore d'allarme rimasto senza sezione;
  - aggiunta la prova della schermata dell'Agenda.
  - La data fissa nella prova della Dashboard ora si conta da oggi.

## Non verificato
- **Il gestionale vero:** serve l'anteprima, da guardare con gli impegni di Alessio.

## Rimasto com'era, apposta
- **MEMO a «cosa ho oggi»** risponde con quelli di oggi e aggiunge «Ci sono però N impegni in ritardo». È la stessa notizia detta a voce: se Alessio la vuole come la schermata, è un lavoro piccolo a parte.
- **Il calendario mensile** mostra lo scaduto al suo giorno vero.

## Dato per fatto senza misurarlo
- Nulla.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
- La sezione «In ritardo», chiusa di suo, nata il 30/08 (Blocco 3): era il posto in cui uno scaduto smetteva di farsi vedere. Rovesciata da Alessio il 27/10.
