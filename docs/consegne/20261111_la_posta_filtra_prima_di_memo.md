# La Posta filtra le mail inutili prima di MEMO (11/11/2026)

Migrazioni `20261111000001_la_posta_filtra_prima_di_memo` e `20261111000002_i_vincoli_del_filtro_si_spiegano`. È la richiesta di Alessio dell'11/11: niente spesa di MEMO per gli avvisi automatici, e una distinzione vera fra mail inutili e utili dello stesso mittente.

## Cosa c'è
- **Regole `posta_filtri`**: mittente + tipo di oggetto. Il tipo di oggetto è l'oggetto ripulito: minuscole, senza «R:»/«Fwd:», cifre al posto di «#». Il confronto può essere:
  - **uguale**: è quello che salva il tasto;
  - **inizia con**;
  - **contiene**: solo frasi di almeno 12 caratteri.
  - Il mittente intero si filtra solo se Alessio lo sceglie.
- **Il controllo prima di salvare**: un trigger su `posta_ricevuta` fa nascere la mail già «scartata», con la regola e la nota «Filtrata prima di MEMO». `posta-leggi` non la vede, quindi la spesa è zero.
- **La PEC dello SdI e il gestore PEC non si filtrano mai**: il vincolo sulla tabella, il controllo sul mittente intero e il tasto li rifiutano.
- **Tasto «Ignora le mail come questa»**, con `aggiungi_filtro_posta` dal corridoio.
  - Di base filtra «solo le mail come questa»; «tutte le mail da …» solo se scelto, con l'avviso.
  - La mail va fra le filtrate e le sue proposte aperte si chiudono come «no».
- **Pagina Posta**:
  - le filtrate stanno in «Sistemate» col bollino «Filtrata», con «Non era da filtrare: falla leggere» e «Togli la regola»;
  - l'elenco delle regole è in «Sistemate» e ognuna si toglie;
  - tolta la regola, le sue mail restano visibili, perché si riconoscono dalla nota.
- **Regole di partenza**, scelte da Alessio:
  - Credem: «notifica accesso business on», «notifica accesso mobile banking», «mybox: nuovi documenti disponibili» (inizia con);
  - Aruba: «inoltro automatico è stato impostato» (contiene).
- **Modello più caro solo per i mittenti conosciuti**: SdI, gestore PEC, fornitori in anagrafica per indirizzo o dominio, oppure una fattura elettronica letta. Gli altri usano il modello rapido. `posta-leggi` lo chiede a `mittente_conosciuto_per_la_posta`, che risponde solo alla chiave di servizio.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - avviso filtrato, mail vera di Credem no, avviso di sicurezza che contiene la frase no;
  - con la chiave di servizio il filtro scatta, il doppione si ignora e le regole non si leggono;
  - regola sulla PEC rifiutata;
  - il tasto fa la regola «uguale» e la mail dopo dello stesso tipo è filtrata, una di altro tipo no;
  - lo SdI rifiutato anche dal tasto, lo staff rifiutato;
  - mittente conosciuto: lo SdI sì, gmail no.
- **Provata su Prova** in transazioni annullate, prima di applicarla.
- **Revisioni:**
  - `ecc:database-reviewer`: corretti il «contiene» troppo largo (aggiunto il modo), la prova con la chiave di servizio, la protezione sulla stringa intera, `pg_temp`, il tasto con `on conflict`, le proposte chiuse;
  - `ecc:react-reviewer`: corretti la visibilità dopo «Togli la regola», il cursore, gli errori sul posto giusto, il riquadro che si chiude, l'avviso sulle proposte, il singolare.
- **Spiegazioni dei vincoli:** nella migrazione `20261111000002_i_vincoli_del_filtro_si_spiegano`, perché la prima era già su Prova.
- **Prove:** tests/unita/posta-a-righe.test.js (letture uguali al database) e tests/schermate/posta-a-righe.test.jsx (il tasto).

## Applicazione su work
Da pubblicare:
- la migrazione;
- le funzioni `posta-leggi` e `operazioni-atomiche`;
- la pagina.

I numeri si aggiungono dopo.
