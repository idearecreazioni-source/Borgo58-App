# SPEC-0010 — Campi data e ora coerenti su telefono

| Campo | Valore |
|---|---|
| Stato | Bozza — rilievo da verificare sul dispositivo |
| Priorità | Da definire |
| Origine | Foto e domanda di Alessio, 05/09/2026 |
| Richieste correlate | Nessuna richiesta esistente da modificare |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), gesto e leggibilità su telefono |

## Problema

Nei moduli Agenda e Nuova prenotazione, data e ora stanno in due colonne. Su telefono i controlli nativi del browser hanno una larghezza minima propria: anche se il campo dichiara di occupare la larghezza della colonna, può non stringersi e sbordare a destra. Il bordo del campo ora non coincide più con gli altri campi del modulo.

Nella sezione «Promemoria Telegram» dell'Agenda i due controlli non hanno neppure un'etichetta propria: non è chiaro quale sia la data e quale l'ora, né che definiscano l'istante dell'avviso anziché la scadenza del task.

## Rilievo del codice

**Stesso difetto confermato dalla struttura del codice:**

- Agenda: data/ora di scadenza e, separatamente, data/ora del promemoria;
- Calendario Eventi: Nuova prenotazione;
- Preventivi: data e ora dell'evento.

In tutti e tre i casi esiste una griglia a due colonne sul telefono, mentre le celle e i controlli non dichiarano di poter scendere sotto la larghezza minima nativa. Il progetto contiene già la cura nella prenotazione pubblica e nella Pianta della giornata: celle e campi che possono restringersi e aspetto controllato del campo ora.

**Candidati dello stesso tipo da provare sul telefono:** caricamento fattura fornitore, cessioni agricole, anticipi personali, prima nota e moduli fiscali che passano da quattro a due colonne. Non vanno dichiarati difettosi senza la prova sul dispositivo: condividono la combinazione tecnica, ma non necessariamente la stessa larghezza disponibile.

## Obiettivo

Ogni campo data e ora deve restare entro la propria colonna, allineato agli altri campi e chiaramente spiegato. La cura deve essere una regola riusabile, non una pezza solo per Agenda e Prenotazioni.

## Fuori-scope

- Cambiare il significato delle date o delle ore.
- Rendere obbligatori campi oggi facoltativi.
- Modificare le regole di scadenza, ripetizione o invio Telegram.
- Sostituire i selettori nativi con un calendario grafico, salvo una necessità dimostrata dopo il collaudo.

## Decisioni aperte

1. **Proposta:** per date e ore affiancate sul telefono, ogni cella deve poter restringersi e il campo non può uscire dalla colonna; se lo spazio non è sufficiente, i campi vanno uno sotto l'altro anziché sovrapporsi.
2. **Proposta:** in Agenda usare etichette esplicite: «Scadenza: data» e «Scadenza: ora», poi «Avvisami il: data» e «Avvisami alle: ora».
3. Nei moduli di prenotazione e preventivo, scegliere se le etichette «Data» e «Ora» diventano «Data della prenotazione/evento» e «Ora della prenotazione/evento», oppure se basta una breve frase introduttiva comune.
4. Definire il dispositivo e la larghezza con cui verificare tutti i candidati prima di considerare chiuso il censimento.

## Criteri di accettazione

- Nelle due schermate fotografate nessun campo data/ora supera il bordo del riquadro o si sovrappone al vicino alla larghezza del telefono di Alessio.
- Il bordo sinistro e destro dei campi segue la griglia del modulo.
- Ogni coppia data/ora dichiara in parole a cosa serve, in particolare il promemoria Telegram.
- Il controllo continua ad aprire il selettore appropriato del dispositivo.
- Tutti i candidati del rilievo sono provati su telefono e classificati come corretti o corretti nello stesso mandato; non resta un elenco implicito.

## Nota per il coordinamento

Prima del mandato esecutivo Alessio deve confermare il comportamento quando i due campi non entrano: impilarli, come proposto, oppure adottare un'altra forma. Dopo la conferma, questa specifica va alla chat di coordinamento per il mandato e il collaudo reale sul telefono.
