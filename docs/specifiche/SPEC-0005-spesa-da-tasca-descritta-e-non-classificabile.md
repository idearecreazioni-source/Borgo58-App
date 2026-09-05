# SPEC-0005 — Spesa dalla Tasca descritta e non classificabile

| Campo | Valore |
|---|---|
| Stato | Fatta il 06/09/2026 — resta da vedere con le mani |
| Priorità | Da definire |
| Origine | Osservazione di Alessio sulla Prima nota, 05/09/2026 |
| Richieste correlate | [`C10`](../RICHIESTE.md) — la Tasca |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), sezione La tasca di Alessio |

## Problema

Nella Prima nota della Tasca il campo che descrive la spesa è chiamato
«Finalità aziendale (opz., utile in verifica)»: non si capisce subito che è
il posto dove scrivere cosa è stato pagato, ad esempio un abbonamento AI.

Inoltre la schermata mostra una causale selezionabile come «Altra uscita».
Questo contraddice la decisione vigente: dalla Tasca deve essere possibile
solo «Indeducibile». Il database la impone comunque, ma l'interfaccia offre
una scelta che non può essere rispettata.

## Obiettivo

Rendere immediata la registrazione di una spesa personale per il progetto:
importo, data e una descrizione leggibile del motivo. Nella Tasca la causale
deve risultare fissa e dichiarata «Indeducibile», senza menu né possibilità di
selezionare una classificazione diversa.

## Fuori-scope

- Rendere le spese della Tasca deducibili o fiscali.
- Creare categorie fiscali nuove per ogni servizio o abbonamento.
- Trasformare la Tasca in un'anticipazione rimborsabile.
- Cambiare le causali disponibili per Borgo 58 o altri soggetti.

## Decisioni aperte

1. ✅ **Confermata da Alessio il 06/09/2026:** nella Tasca il campo si chiama
   «Descrizione della spesa» e porta l'esempio «Abbonamento AI — nome del
   servizio, mese».
2. ✅ **Decisa da Alessio il 06/09/2026: la descrizione resta LIBERA.** Il mese
   è consigliato dall'esempio, non preteso. ⚠️ La ragione va conservata perché
   non si rovesci per distrazione: *un campo che rifiuta una descrizione
   perché manca il mese fa scrivere un mese finto pur di andare avanti* — e un
   mese finto è peggio di un mese assente, perché non si distingue da uno vero.
3. Priorità rispetto alle altre richieste aperte — **ancora aperta**.

## Dipendenze

- Decisione vigente: la Tasca accetta solo uscite e solo Indeducibile.
- Il campo esistente `business_purpose`, già presente anche nell'esportazione
  della Prima nota, come descrizione del motivo della spesa.

## Criteri di accettazione

- Con soggetto «La tasca di Alessio», il campo descrittivo è riconoscibile
  senza dover interpretare il linguaggio fiscale.
- Una spesa AI può essere registrata con importo, data e descrizione in un
  solo passaggio.
- La causale visibile è «Indeducibile», fissa e non modificabile.
- Il salvataggio conserva la descrizione e la mostra nel dettaglio e
  nell'esportazione.
- Nessuna uscita della Tasca entra nei calcoli fiscali o della società.

## Collegamenti a decisioni vigenti

- La Tasca registra solo uscite, mai entrate.
- Dalla Tasca è ammessa esclusivamente la regola Indeducibile, imposta dal
  database.
- La Tasca resta fuori dalla proiezione fiscale per costruzione.

## Come è stata realizzata — 06/09/2026

La regola vive in **`src/lib/calcoli/tasca.js`**, non dentro la schermata:
come si chiama il campo, che cosa si vede al posto del menu delle causali e
quali righe entrano nella spaccatura di «Speso dalla tasca». La Prima nota la
chiama e basta.

⚠️ **Perché fuori dalla schermata, e non è una preferenza di stile:** la metà
che conta di questa specifica è *«per Borgo 58 e per l'orto non cambia
niente»*, e quella metà si prova solo potendo chiedere la regola per un
soggetto qualsiasi. Scritta dentro il modulo si sarebbe potuta provare solo
sulla Tasca — cioè proprio nel caso in cui non può sbagliare inosservata.

**Tre cose cambiano, tutte e tre solo sulla Tasca:**

1. il campo prende un titolo, «Descrizione della spesa», e l'esempio nel
   grigio. Altrove resta com'era, senza titolo, con «Finalità aziendale
   (opz., utile in verifica)» nel grigio;
2. al posto del menu delle causali compare la scritta fissa **«Indeducibile»**.
   ⚠️ Il divieto **non si sposta qui**: resta il trigger
   `guardia_movimenti_tasca` della migrazione `20260830000012`, che impone la
   regola di deducibilità e la mette da sé. Questa riga evita soltanto di
   offrire un gesto che verrebbe smentito;
3. non si salva più nessuna causale — conseguenza della 2, non una scelta a
   parte — e la riga **«senza causale»** sparisce dalla spaccatura in cima
   alla schermata. ⚠️ **Il totale «Speso dalla tasca» resta intero**, quelle
   uscite comprese: si toglie l'assenza, non il dato. Un movimento registrato
   prima del 06/09 con una causale scelta a mano continua a comparire con la
   sua.

**Il campo resta `business_purpose`**: nessuna colonna nuova, nessuna
migrazione. Il salvataggio, il dettaglio della riga e la colonna
«Finalità aziendale» del file esportato leggono lo stesso campo di prima —
e il titolo nell'esportazione **non è stato toccato**, perché quel file è uno
solo per tutti i soggetti e rinominarlo cambierebbe anche le esportazioni di
Borgo 58.

### Che cosa è verificato, e che cosa no

| Criterio | Come |
|---|---|
| Il campo è riconoscibile senza linguaggio fiscale | ✅ provato aprendo la schermata |
| Importo, data e descrizione in un solo passaggio | ✅ provato aprendo la schermata |
| La causale visibile è «Indeducibile», fissa | ✅ provato aprendo la schermata: la scritta c'è e il menu non c'è più |
| Gli altri soggetti non cambiano | ✅ provato nei due strati, e per rottura |
| Il salvataggio conserva la descrizione in dettaglio ed esportazione | 🟡 **letto nel codice, non provato sui dati**: quelle strade non sono state toccate, ma questo mandato vieta le prove contro un database |
| Nessuna uscita della Tasca entra nei calcoli fiscali | 🟡 **invariato e non riprovato**: lo impone il database, e qui non si è toccato |

⚠️ **E nessuna mano ha ancora aperto questa schermata.** Tutto ciò che è
«visto» è misurato da una prova che monta la Prima nota in un ambiente finto.
Se il titolo del campo sia leggibile sul tablet in servizio, e se «Indeducibile»
si distingua abbastanza da un campo compilabile, restano giudizi di Alessio.

## Nota per il coordinamento

La causale selezionabile è un difetto rispetto a una decisione esistente;
questa bozza non ne cambia il significato. Dopo la conferma della forma del
campo descrittivo e della priorità, va portata alla chat di coordinamento per
il mandato esecutivo e la verifica.
