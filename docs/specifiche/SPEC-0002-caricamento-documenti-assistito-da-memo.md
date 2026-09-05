# SPEC-0002 — Caricamento documenti assistito da MEMO

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Osservazione di Alessio sulla schermata Archivio Documenti, 05/09/2026 |
| Richieste correlate | [`N11`](../RICHIESTE.md) — archivio a sezioni |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), sezioni MEMO e Archivio Documenti |

## Problema

Nel flusso attuale «+ Nuovo documento» apre prima un modulo di metadati e il
controllo nativo «Scegli file» non rende evidente che apre la selezione del
file. Alessio deve quindi scegliere titolo, sezione, date, importo e
controparte **prima** che MEMO abbia letto il documento da cui ricavarli.

Questo contraddice la regola vigente: MEMO propone i dati e la scheda viene
vista prima del salvataggio. Il caricamento manuale conserva il file, ma non
avvia la lettura che riempie il suo contenuto.

## Obiettivo

Il gesto principale deve essere «Carica documento»: lo tocco apre in modo
inequivocabile il selettore del computer o del telefono. Dopo la scelta del
file, MEMO lo legge e mostra una scheda **non ancora salvata** con le proposte
per titolo, sezione, data, scadenza, importo, controparte ed entità.

Alessio conferma o corregge solo i dati incerti, assenti o non deducibili. Il
documento entra nell'archivio solo alla conferma della scheda.

## Fuori-scope

- Analisi automatica di documenti non scelti da Alessio.
- Modifica delle otto sezioni chiuse dell'archivio.
- Archiviazione senza una scheda di revisione.
- Lettura di mail: resta il flusso separato della Posta in arrivo.
- Riconciliazioni contabili o registrazioni automatiche oltre la proposta dei
  metadati del documento.

## Decisioni aperte

1. **Proposta espressa da Alessio, da confermare:** il percorso normale è
   prima scegliere il file e poi far proporre a MEMO tutti i campi che può
   dedurre; il modulo vuoto resta soltanto come via secondaria per i casi
   senza file o con lettura impossibile.
2. Se MEMO è sicuro di un campo, basta mostrarlo come proposta oppure Alessio
   vuole comunque una conferma esplicita prima del salvataggio?
3. Per i file illeggibili, protetti da password o di formato non supportato,
   quale messaggio e quale via manuale devono comparire.
4. Se una scadenza è proposta da MEMO, il promemoria in Agenda nasce alla
   conferma della scheda come oggi oppure richiede un gesto separato.
5. Priorità rispetto alle altre richieste aperte.

## Dipendenze

- Lettura sicura del file scelto e tracciamento del relativo consumo.
- Catalogo chiuso delle otto sezioni: MEMO propone solo una sezione esistente.
- Regola vigente sul tetto di spesa e sulla visibilità della provenienza di
  ciascun campo (MEMO o Alessio).
- Una via manuale funzionante quando rete o servizio AI non sono disponibili.

## Criteri di accettazione

- Il primo gesto visibile è un pulsante esplicito per scegliere e caricare un
  file; non un campo tecnico ambiguo.
- La scelta del file precede la richiesta dei metadati.
- MEMO propone ogni campo deducibile dal contenuto e dichiara chiaramente
  quelli che non ha potuto ricavare, senza inventarli.
- La proposta di sezione appartiene sempre al catalogo delle sezioni vigenti.
- Prima del salvataggio si vede la scheda completa, con la provenienza dei
  campi e con la possibilità di correggere.
- Nessun documento viene archiviato né genera un promemoria prima della
  conferma.
- Se la lettura fallisce, il file non si perde e resta disponibile una via
  manuale comprensibile.

## Collegamenti a decisioni vigenti

- MEMO propone; la scheda si vede prima del salvataggio.
- I campi conservano la provenienza (MEMO o Alessio).
- Senza rete o servizio AI, l'operazione resta possibile a mano.
- Le sezioni dell'archivio sono otto e MEMO ne propone una esistente, non una
  parola libera.

## Nota per il coordinamento

La bozza è pronta per una decisione di merito sul punto 1. Dopo la conferma e
la definizione delle eccezioni, va portata alla chat di coordinamento per il
mandato esecutivo e la verifica; questa specifica non autorizza modifiche.
