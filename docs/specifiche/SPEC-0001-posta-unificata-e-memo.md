# SPEC-0001 — Posta Borgo 58 unificata e trattata da MEMO

| Campo | Valore |
|---|---|
| Stato | In definizione — due decisioni confermate, altre aperte |
| Priorità | Da definire |
| Origine | Conversazione di progettazione, 04/09/2026 |
| Richiesta correlata | [`N1`](../RICHIESTE.md) — casella dedicata e mail dei clienti nel gestionale |
| Decisioni vigenti correlate | [`mandato posta dei clienti`](../mandati/20260820_la_posta_dei_clienti.md); [`DECISIONI.md`](../DECISIONI.md) |

## Problema

Le caselle inerenti a Borgo 58 sono separate dal gestionale. Le informazioni
ricevute nella posta non confluiscono nel luogo dove si seguono clienti,
fornitori, documenti e attività; MEMO non può quindi leggerle né aiutare a
trattarle nel loro contesto.

## Obiettivo

Far convergere **subito tutte** le mail delle caselle Borgo 58 nel gestionale,
in una Posta in arrivo unica ma distinguibile per casella. MEMO deve leggere
solo le mail che Alessio decide di affidargli: nessuna analisi automatica di
spam o messaggi irrilevanti, per evitare costo e lavoro senza valore. Sulle
mail affidate a MEMO, può proporre una classificazione e la prossima azione
utile. Le mail e gli allegati devono restare rintracciabili nel loro contesto
(cliente, fornitore, documento o attività).

MEMO propone e spiega: non invia messaggi, non archivia definitivamente, non
crea movimenti e non modifica dati senza una conferma esplicita di Alessio o
di chi ha l'autorità prevista.

## Fuori-scope

- Invio automatico di email o campagne commerciali.
- Regole sul consenso diverse da quelle già vigenti.
- Invii broadcast WhatsApp, SMS o integrazioni con account non ancora scelti.
- Cancellazione o modifica delle mail presso il provider.
- Autonomia di MEMO per azioni che producono effetti esterni o contabili.

## Decisioni aperte

1. Per ogni casella, il gestionale deve leggere soltanto la posta in arrivo o
   anche la posta inviata e le bozze.
2. Quanto tempo conservare nel gestionale messaggi e allegati, e se mantenerne
   una copia completa o solo i dati necessari con collegamento alla casella.
3. Quale proposta può fare MEMO: etichetta, riassunto, collegamento a cliente
   o fornitore, bozza di risposta, creazione di attività, oppure una parte di
   queste.
4. Quali categorie devono essere visibili fin dall'inizio (clienti, fornitori,
   fatture/documenti, prenotazioni, richieste operative, spam/irrilevanti).
5. Priorità rispetto alle richieste già aperte e prerequisiti pratici di
   accesso alle caselle.

## Dipendenze

- Credenziali o metodo di accesso autorizzato a ciascuna casella.
- Il blocco aperto della posta dei clienti: una mail di cliente va trattata
  come conversazione sulla scheda cliente, non come documento da archiviare.
- Regole esistenti sul consenso e sulle due porte separate per messaggi di
  servizio e commerciali.
- Valutazione di privacy, autorizzazioni e trattamento degli allegati prima
  di far leggere il contenuto a MEMO.

## Criteri di accettazione

- Le caselle approvate confluiscono in un'unica vista con mittente, data,
  oggetto, casella destinataria e stato di trattamento, senza confondere le
  rispettive identità.
- Una mail di cliente riconosciuta o confermata è visibile nella relativa
  scheda cliente come conversazione; non viene scambiata per un documento.
- MEMO restituisce una proposta distinguibile dall'azione definitiva e mostra
  quale testo o allegato l'ha motivata.
- Una mail non assegnata esplicitamente a MEMO non viene inviata al modello né
  analizzata: spam e messaggi irrilevanti restano fuori dal consumo di risorse.
- Nessuna proposta di MEMO produce invii, archiviazioni definitive, movimenti
  o modifiche senza conferma umana.
- Allegati e messaggi non diventano accessibili a ruoli non autorizzati.
- Le funzioni già esistenti per consenso e comunicazioni ai clienti continuano
  a rispettare le regole vigenti.

## Collegamenti a decisioni vigenti

- La mail della prenotazione resta facoltativa.
- Tutte le caselle Borgo 58 entrano nel primo collegamento; MEMO legge solo
  mail affidategli da Alessio una per una. Vedi [`DECISIONI.md`](../DECISIONI.md).
- Il consenso è necessario per le comunicazioni commerciali e viene fatto
  rispettare dal database; non è richiesto per le comunicazioni di servizio.
- Il gestionale non invia liste WhatsApp.
- Le comunicazioni ai clienti devono partire dal gestionale, non dalla posta
  personale di Alessio.

## Nota per il coordinamento

Prima di un mandato esecutivo servono la definizione delle cinque decisioni
aperte, la priorità e una verifica degli accessi disponibili. La specifica non
autorizza collegamenti a caselle, accesso a messaggi o lavori tecnici.
