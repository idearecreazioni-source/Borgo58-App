# SPEC-0009 — Appunti di spesa da collocare

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Proposta di Alessio, 05/09/2026 |
| Richieste correlate | [`C10`](../RICHIESTE.md) — La tasca; [`N11`](../RICHIESTE.md) — Archivio documenti |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), MEMO foto, MEMO voce e La tasca |

## Problema

Quando Alessio è fuori dal computer può avere soltanto una foto di uno
scontrino o una breve nota vocale. In quel momento MEMO può capire importo,
negozio o descrizione, ma non può sapere con certezza se la spesa sia della
Tasca, un anticipo rimborsabile, un'uscita della società o un documento da
archiviare. Forzare subito una registrazione contabile rischia di metterla nel
posto sbagliato.

## Obiettivo

Foto e voce possono creare un **appunto di spesa da collocare**: una traccia
provvisoria, non un movimento di denaro. MEMO conserva ciò che ha letto o
sentito e propone solo i fatti riconosciuti, per esempio importo, esercente,
data, descrizione e presenza di un documento.

Quando Alessio torna al PC apre l'elenco «Da collocare» e, per ciascun
appunto, decide una sola destinazione:

- **La mia tasca**, per una spesa personale non rimborsabile;
- **Anticipo io, poi mi rimborso**, per una spesa pagata da Alessio per conto
  della società;
- **Prima nota di Borgo 58**, per un movimento della società;
- **Archivio documenti**, se occorre prima conservare e leggere il documento;
- **Scarta**, se non era una spesa utile.

La scelta apre la rispettiva schermata già compilata con i dati dell'appunto,
ma il salvataggio resta separato e sempre controllato da Alessio.

## Fuori-scope

- Creare movimenti, registrazioni fiscali, rimborsi o carichi di magazzino al
  momento della foto o della dettatura.
- Indovinare il soggetto della spesa dalla sola frase «ho speso». 
- Considerare uno scontrino automaticamente deducibile o collegarlo a una
  fattura che non esiste ancora.
- Eliminare le normali vie manuali di Prima nota, Tasca, Anticipi e Archivio.

## Decisioni aperte

1. **Proposta espressa da Alessio, da confermare:** MEMO foto e MEMO voce
   creano prima un appunto da collocare, non una registrazione di spesa, quando
   il soggetto non è dichiarato con certezza.
2. Nome dell'area: «Spese da collocare», «Da sistemare» oppure altro nome più
   naturale per Alessio.
3. Per una foto, si conserva il file originale fino a quando l'appunto è
   collocato o scartato? Per una nota vocale, si conserva anche l'audio oppure
   soltanto la trascrizione e i dati estratti?
4. Quale promemoria mostrare se un appunto resta aperto a lungo, senza creare
   solleciti inutili.
5. Se MEMO legge una foto con certezza, Alessio vuole che proponga comunque
   l'appunto oppure può offrire direttamente la destinazione già esplicitata
   nella richiesta.

## Dipendenze

- Regola vigente: i movimenti di denaro richiedono conferma di Alessio.
- SPEC-0008 per la frase esplicita che identifica già la Tasca.
- SPEC-0002 per il percorso di lettura e revisione dei documenti archiviati.
- Una lista consultabile degli appunti aperti, senza farli entrare nei totali
  della società, nella Tasca o nella proiezione fiscale.

## Criteri di accettazione

- «Segna 100 euro di spesa in cartolibreria» crea un appunto con importo e
  descrizione riconosciuti, non un'uscita di Borgo 58.
- Una foto di scontrino crea un appunto con i dati leggibili e la fonte
  chiaramente indicata come foto; i dati incerti restano dichiarati tali.
- Un appunto aperto non altera saldi, spese fiscali, rimborsi, magazzino o
  statistiche.
- Dall'elenco, ciascun appunto si può collocare in una sola destinazione,
  completando poi la registrazione nella schermata competente.
- Il passaggio porta importo, data, descrizione e riferimento disponibile,
  senza inventare dati mancanti.
- Scartare un appunto non cancella né modifica altri movimenti; l'eventuale
  conservazione della foto o dell'audio segue la scelta esplicita di Alessio.

## Collegamenti a decisioni vigenti

- MEMO interpreta foto e voce, ma la relativa scheda viene vista prima del
  salvataggio.
- I movimenti finanziari non sono automatici.
- La Tasca è separata dalla società: solo uscite non rimborsabili, fuori dalla
  proiezione fiscale.

## Nota per il coordinamento

Questa proposta introduce una fase provvisoria comune a foto e voce, evitando
di scegliere il soggetto della spesa quando non è ancora noto. Dopo conferma,
va portata alla chat di coordinamento per il mandato esecutivo e la verifica.
