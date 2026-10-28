# Le stampanti e la coda — 28/10/2026

Questo è il primo passo del collegamento delle stampanti. Alessio ha fatto la richiesta dopo l'incontro col fornitore: *«dobbiamo creare l'infrastruttura per collegare l'hardware tramite ip e poi fisseremo una data per il collaudo»*. Il 28/10 sera ha deciso il computer: *«Compriamo un mini-PC dedicato»*.

## Cosa c'è
- **Migrazione `20261028000005_le_stampanti_e_la_coda`**, con tre tabelle:
  - `dispositivi`: gli apparecchi, cioè il registratore telematico e le stampanti delle comande, con IP, porta e reparto.
  - `chiavi_ponte`: la chiave del programma sul mini-PC. Il database ne conserva solo l'impronta, come fa con la chiave del luogo.
  - `lavori_stampa`: la coda (ARCHITETTURA §4.2).
- **Funzioni del titolare:**
  - `crea_chiave_ponte`, `revoca_chiave_ponte`, `chiavi_ponte_elenco`, che dice anche se il ponte è acceso, misurandolo con l'orologio del database;
  - `chiedi_lavoro_dispositivo` (prova di stampa o lettura dello stato);
  - `annulla_lavoro_stampa`.
- **Le tre porte del ponte, aperte ad `anon` con la chiave:** `ponte_battito`, `ponte_prendi_lavori` e `ponte_esito_lavoro`.
- **Pagina `/comande/stampanti`**, solo per il titolare. Si apre dal pulsante «Stampanti» in Sala e ha tre parti:
  - il ponte, acceso o spento, con la sua chiave;
  - gli apparecchi, con «Prova di stampa» e «Leggi lo stato»;
  - le ultime prove.

## Le scelte, e perché
- **Niente scontrini.** `lavori_stampa.tipo` ammette solo `prova` e `stato`, quindi è il database a rifiutare un lavoro fiscale. Uno scontrino del registratore è un incasso vero, e per questo avrà un passo suo.
- **Il ponte raggiunge solo apparecchi della rete del locale.**
  - Sono ammessi 10/8, 172.16/12 e 192.168/16, senza .0 e .255.
  - La porta deve essere quella del tipo di apparecchio.
  - L'apparecchio finto sta solo su 127.0.0.1, con porta fra 18000 e 19999.
- **Il contenuto è testo, non comandi.** I comandi per la stampante li compone il ponte. Nel nome dell'apparecchio non entrano i caratteri di controllo né i segni `< > &`.
- **«Incerto» non si riprova da solo.**
  - Un lavoro preso dal ponte e non chiuso entro 5 minuti diventa incerto, e decide una persona («Ho guardato, chiudi»).
  - Se l'esito vero arriva dopo, dallo stesso ponte, corregge il lavoro.
- **Un lavoro aperto per apparecchio.** Premere due volte «Prova» non accoda due fogli. Quando arriveranno le comande, questo indice andrà rivisto.
- **La coda si pulisce da sola a ogni battito.** I fogli usciti restano 30 giorni, quelli andati storti 90.

## Le reti aggiornate
- `tests/app/permessi.test.js`: le funzioni eseguibili con la sola chiave pubblica passano da **14 a 17** (le tre del ponte), con la ragione scritta accanto.
- `tests/app/orfane.js`: le tre del ponte sono fra le `ORFANE_PIANIFICATE` della 20261028000005. Le chiama `ponte/`, che sta fuori da `src/`.
- Prova visiva: aggiunta la schermata `stampanti`, con dati finti scelti per andare a capo.

## Revisione ECC
**ecc:database-reviewer** ed **ecc:security-reviewer** non hanno trovato nessun difetto critico o alto. Ho applicato tutti i loro rilievi medi e utili:
- il simulatore solo su 127.0.0.1;
- niente .0 e .255;
- niente segni di comando nel nome;
- i valori del ponte normalizzati invece che rifiutati;
- la scadenza dei lavori abbandonati portata a 5 minuti e spostata in `scadi_lavori_abbandonati()`, che gira anche quando si chiede una prova o si annulla;
- l'esito tardivo che corregge un lavoro incerto;
- la frase italiana anche quando due tocchi arrivano insieme;
- `acceso` falso invece di vuoto;
- due indici.

**Lasciato com'è, e perché:**
- Nessun freno sui tentativi falliti di indovinare una chiave, come per la chiave del luogo: un freno globale permetterebbe a un estraneo di spegnere il ponte.
- La pulizia a ogni battito: con una manciata di righe non costa niente. Andrà ripensata quando entreranno lavori fiscali.

## Numeri, misurati
- **Su Prova:** applicata e riapplicata dopo la revisione, con la verifica passata, fino a «Provato e annullato: zero residui». Prova ha 447 migrazioni.
- **`npm run test:app`** su `stampanti`, `permessi`, `funzioni-senza-schermata`, `migrazioni-senza-portieri`, `scritture-dal-corridoio` e `giornata-operativa`: 6 file, **47 prove passate**. Le prove nuove in `tests/app/stampanti.test.js` sono 8, e fanno il giro intero del ponte con la sola chiave pubblica.
- **Prova visiva `stampanti`:** 6 misure su 6, a 360, 390 e 430 (telefono), 768 (tablet), 1280 e 1920 (computer).
- **Peso del gestionale:** 443,49 kB compressi su un tetto di 450. La pagina si carica solo quando la si apre.

## Non verificato
- **Nessun apparecchio vero**, e il ponte non esiste ancora: le tre porte sono state chiamate dalle prove, non da un mini-PC.
- **Produzione non toccata:** la migrazione va in produzione solo col rilascio, dopo l'ok di Alessio.
- In locale `npm run test` ha 3 prove rosse in `bozze-col-lordo` e `indirizzo-funzioni-vault`, che leggono migrazioni vecchie e non toccate qui. La causa sono gli a-capo di Windows della copia locale: il repository ha LF.

## Dato per fatto senza misurarlo
- Le porte Epson 80, 443, 8008 e 8043 (FPMate ed ePOS) e 9100 (ESC/POS) vengono dalla documentazione generale Epson. Le confermerà il fornitore il giorno del collaudo.

## Affermazioni diventate false durante il lavoro
- Nessuna.

## Cosa abbiamo rovesciato
In questo passo non è stata rovesciata nessuna decisione. La coda del mini-PC era già il disegno di ARCHITETTURA §4.2, e la Cucina continua a stampare dal browser finché le comande non passano dalla coda.

## Il prossimo passo
Il programma ponte in `ponte/`:
- il simulatore della stampante e del registratore;
- il foglio di prova ESC/POS e il documento non fiscale FPMate;
- l'installazione come servizio di Windows sul mini-PC;
- la guida click per click.
