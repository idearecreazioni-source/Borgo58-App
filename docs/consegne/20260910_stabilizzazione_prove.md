# La stabilizzazione delle prove dopo la pubblicazione — 10/09/2026

Mandato autonomo di stabilizzazione, dopo la pubblicazione di master `0947150`.
Quattro blocchi: la prova dell'Archivio intermittente, la prova dei permessi
intermittente, pulizia e affidabilità del gruppo, la differenza di versione di
`operazioni-atomiche`.

**Commit sotto questo riepilogo**: `4a06e13`, ramo `stabilizzazione-prove`, da
master `0947150` (tre commit: `b6fe896`, `f45813f`, `4a06e13`).
**Migrazioni**: nessuna.
**Funzione online toccata**: `operazioni-atomiche` — installata **solo sul
progetto di prova** (v37 → v38). In produzione resta la v36: va installata
nel prossimo mandato di pubblicazione, dopo l'unione. Il cambiamento è
compatibile all'indietro: cambia solo cosa risponde quando la verifica
dell'utente non riesce.
**Produzione**: non toccata. **Chiamate al modello**: nessuna.

---

## 1. L'Archivio: «il file tolto si riapre ancora»

- **La causa, misurata e documentata**: il download di un file del deposito
  passa da una cache (Cloudflare). Sul progetto di prova la seconda richiesta
  dello stesso file è servita da lì (`cf-cache-status: HIT`), anche con
  «zero cache» al caricamento e anche con `cacheNonce`. La documentazione di
  Supabase (Smart CDN) dice che dopo una cancellazione la cache si invalida
  «fino a 60 secondi» dopo, un centro dati alla volta. La prova scaricava il
  file subito dopo averlo tolto: su GitHub, da un altro centro dati, una
  volta lo ha ricevuto dalla cache.
- **Dove sta il difetto**: nella **prova** — misurava la cache, non la
  cancellazione. Non nel codice, non nei permessi, non nell'isolamento.
- **Non è una fuga fra utenti**: lo staff non ha mai ricevuto dalla cache la
  copia del titolare (sempre 400, mai dalla cache).
- **Misure**: 60 tentativi di riapertura dopo la rimozione, 10 giri in serie
  e 5 in parallelo: 0 riaperture qui; 0 file rimasti.
- **La correzione**: si guarda il deposito stesso, per due strade, prima e
  dopo — il link firmato (che è come il gestionale apre un documento,
  `getDocumentUrl`) e l'elenco dei file. Misurato 5 volte su 5: prima si crea
  ed è elencato, dopo «Object not found» e assente.
- **Rottura apposta**: il file rimesso subito dopo la rimozione → rossa su
  «dopo la cancellazione si crea ancora un link al file».

## 2. I permessi: «Sessione non valida» a metà prova

- **Misurato**: la sessione dello staff che ha ricevuto quella risposta
  (nata alle 13:49:54 UTC del 10/09) esiste ancora, il suo token di rinnovo
  non è revocato, e in tutta la giornata non c'è nessun logout né revoca. La
  chiamata è durata 5,2 s; le altre del file 0,2-0,9 s.
- **Escluso, misurandolo**: chiusure globali di sessione (nessuna prova le
  fa); rinnovi concorrenti (le prove non rinnovano: `autoRefreshToken:
  false`); l'attesa di 5 secondi della libreria di accesso (sia la 2.111.0 sia
  la 2.115.0 — la più recente il 06/09, quando il corridoio è stato costruito
  — non passano dal blocco senza un blocco su misura); concorrenza (300
  chiamate al corridoio, in serie e 5 in parallelo: tutte «Conto non
  trovato», massimo 835 ms; 150 verifiche dirette: tutte 200).
- **La causa che resta**: la verifica dell'utente dentro il corridoio è
  fallita per un motivo esterno, e il corridoio l'ha dichiarata «sessione non
  valida». **Quale errore esatto non è misurato**: il corridoio lo buttava via.
- **La correzione**: `sessione.ts` — 401 solo se il servizio di accesso ha
  respinto il gettone; altrimenti 503 con una frase che dice che non si è
  scritto niente, e una riga nel registro della funzione (nome, stato,
  codice; mai il gettone).
- **Il più piccolo esperimento ancora necessario**: alla prossima volta, il
  registro di `operazioni-atomiche` sul progetto di prova dirà nome e stato
  dell'errore; la prova fallirà con un 503 e non più con un falso 401.
- **Prove**: pure (la regola; e che il corridoio la usi — rossa sul corridoio
  di master); sul progetto di prova, una sessione chiusa resta «Sessione non
  valida» e una valida arriva al database.
- ⚠️ **Non elimina il guasto esterno**: se il servizio di accesso non
  risponde, la prova resta rossa — col messaggio vero. Renderla verde in quel
  caso vorrebbe dire nasconderlo.

## 3. Pulizia e affidabilità

- **Una sola prova, davvero**: `npm run test:app -- tests/app/x.test.js`
  faceva girare tutte le 557 prove dei 77 file. Corretto. La revisione Codex
  ha trovato due casi (il valore di `-t` preso per un file; il percorso
  completo di Windows rifiutato): corretti, con due prove pure rosse prima.
  Verificato dal vivo col percorso completo: 1 file, 2 prove.
- **Le sessioni**: sul progetto di prova 8.333 sessioni del titolare di prova
  e 4.713 dello staff, mai chiuse (726 nate il 10/09). Il gruppo ne lasciava
  7 a giro; adesso 0. Si chiudono in un posto solo, dopo ogni file, anche se
  fallisce. Le sessioni vecchie **non sono state toccate**.
- **Dati di prova**: identificatori propri (marchio del giro, percorsi
  `test-auto-deposito-<giro>-…`), pulizia in `afterAll` anche sui fallimenti;
  nessuna prova crea utenti.
- **Le 10 ripetizioni** del gruppo (deposito-documenti, permessi,
  due-liste, appunti-vocali, corridoio-sessione), in fila, **nessun
  rilancio**: 10 su 10 verdi al primo tentativo, 53 prove su 53 ogni volta;
  dopo ogni giro 0 sessioni aperte e 0 avanzi (spesa spicciola, lista, impegni,
  file). Fotografia delle righe di tutte le tabelle prima e dopo i dieci giri:
  **nessuna tabella ha cambiato numero di righe**, lapidi 54.313 → 54.313.
- **Prove pure**: 1.295 verdi; le 2 rosse (`indice-richieste`,
  `indice-rovesciamenti`) sono i fine riga di questa macchina, identiche su
  master, verdi su GitHub.

## 4. operazioni-atomiche v37 (prova) e v36 (produzione)

- **Il codice installato è identico** nei due progetti e uguale al file di
  master (commit `3b7e61a`, 06/09): stessa impronta a fine riga tolti.
- **Le impronte dei pacchetti differivano per i fine riga**: la prova aveva
  fine riga Linux (22.474 byte), la produzione Windows (22.902 byte, 428
  CR). `.gitattributes` non regola i `.ts` delle funzioni, e su Windows
  (`core.autocrlf=true`) escono con fine riga Windows.
- **I numeri di versione** contano le installazioni su ciascun progetto: la
  prova ne ha avuta una in più.
- **Non tocca il lavoro pubblicato**: stesso comportamento; la catena
  #42-#53 non ha toccato il corridoio.
- **Non allineato niente.** Da qui in avanti la prova è alla v38 (questa
  proposta) e la produzione alla v36 finché non si pubblica.

## Cosa non è verificato con gli occhi

- La causa esatta dell'errore di verifica del 10/09 (vedi il blocco 2).
- Il comportamento della cache da un centro dati lontano: non riproducibile
  da qui; la causa si appoggia alla documentazione e alle misure locali.

## Affermazioni diventate false mentre si lavorava

- «L'attesa di 5 secondi della libreria spiega i 5,2 secondi»: smentita
  leggendo la libreria (2.111.0 e 2.115.0).
- «Le dipendenze diverse spiegano le impronte diverse»: smentita (nessuna
  versione delle librerie Supabase pubblicata fra le due installazioni); la
  causa erano i fine riga.
- «Caricare con zero cache evita la copia vecchia»: smentita (HIT anche così).
- Due misure mie sono uscite vuote per errori miei (una richiesta con un
  carattere accentato rifiutata, un confronto su due elenchi vuoti letto
  come «identici»): rifatte, e i numeri qui sono quelli rifatti.

## Cosa abbiamo rovesciato

Niente.
