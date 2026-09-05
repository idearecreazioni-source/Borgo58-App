# SPEC-0007 — Anticipo collegabile alla fattura quando arriva

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Osservazione di Alessio su un anticipo al notaio, 05/09/2026 |
| Richieste correlate | Nessuna nuova; estende il flusso di anticipazioni e fatture esistente |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), Cassa e tesoreria; Archivio Documenti |

## Problema

Nel modulo «Ho pagato io», il menu «C'è già una fattura?» contiene soltanto
fatture fornitori già registrate e ancora da pagare. Se non ce ne sono, resta
una sola voce: «no, la spesa è solo questa». Un menu con una scelta unica non
spiega che non è una decisione disponibile.

Più importante: un anticipo registrato prima di ricevere la fattura non ha un
gesto per essere collegato dopo. Oggi l'unico aggancio è nella creazione della
nota; per riconciliarla in seguito bisognerebbe cancellare e ricreare una nota
ancora aperta. È fragile e rende naturale rimandare una registrazione vera.

## Obiettivo

Permettere di registrare subito un anticipo reale e, quando arriva la fattura,
agganciarla alla nota esistente senza cancellare né duplicare la spesa. Il
sistema deve mostrare chiaramente che la fattura è arrivata dopo e indicare
dove il costo viene contato.

## Fuori-scope

- Stabilire intestazione, deducibilità o trattamento fiscale della fattura:
  sono da verificare con il documento e la commercialista.
- Registrare una fattura in assenza del file o dei suoi dati.
- Creare un rimborso automatico: la scelta di pareggiare l'anticipo resta
  esplicita.
- Duplicare l'uscita quando fattura e anticipo sono collegati.

## Decisioni aperte

1. **Proposta nata dall'osservazione di Alessio, da confermare:** una nota
   d'anticipo aperta offre «Collega la fattura arrivata» e può essere
   associata successivamente a una fattura caricata nel gestionale.
2. Quando non esiste nessuna fattura collegabile, il menu a tendina sparisce e
   mostra invece «Nessuna fattura ancora registrata» con un gesto esplicito
   per aggiungerla o rimandare il collegamento.
3. Se la fattura e l'anticipo hanno importi diversi, quale confronto mostrare
   e quale strada offrire senza indovinare la ragione della differenza.
4. Dove avviare il collegamento: dalla nota aperta, dalla fattura, oppure da
   entrambe le direzioni.
5. Priorità rispetto alle altre richieste aperte.

## Dipendenze

- Registro delle anticipazioni, ancora aperte fino al rimborso.
- Fatture fornitori e loro stato di pagamento.
- Regola esistente: una fattura collegata conta il costo una sola volta; la
  nota di anticipo registra il debito verso Alessio.
- Archivio documenti per il file della fattura.

## Criteri di accettazione

- Una nota d'anticipo può essere registrata prima che esista una fattura.
- Dopo il caricamento della fattura, il collegamento si completa dalla nota o
  dalla fattura senza cancellare e ricreare dati.
- L'interfaccia non mostra un menu con una sola voce; dichiara lo stato e il
  gesto successivo.
- Il collegamento mostra data, importo, fornitore e riferimento della fattura.
- Una fattura collegata e il relativo anticipo non producono due costi.
- Il rimborso dell'anticipo resta un gesto separato e produce una sola uscita
  reale dalla cassa o dalla banca.

## Collegamenti a decisioni vigenti

- Un'anticipazione è denaro pagato da Alessio per conto della società e che la
  società gli deve.
- Il rimborso chiude l'anticipazione e genera il movimento di cassa reale.
- I documenti non vengono riscritti o cancellati per far tornare un conto.

## Nota per il coordinamento

Prima del mandato esecutivo servono le decisioni aperte sul punto di ingresso,
sulle differenze d'importo e sulla priorità. Questa specifica non modifica
fatture o anticipazioni esistenti.
