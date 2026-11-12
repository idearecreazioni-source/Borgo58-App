# Gli avvisi di sicurezza si archiviano e squillano (12/11/2026)

Migrazione `20261112000011_gli_avvisi_di_sicurezza_squillano`. PR **P1** del piano «avvisi banca e posta» del 12/11, approvato da Alessio con le scelte consigliate (domande 1, 2 e 4).

## Cosa c'è
- **Una regola della Posta può avvisare.** Colonna nuova `posta_filtri.esito`: «silenzio» (com'era finora) oppure «avvisa».
  - La mail presa da una regola che avvisa va fra le «Sistemate» col bollino **«Sicurezza»**, e arriva **una riga su Telegram**.
  - Esempio: «🔐 SICUREZZA — Credem: Codice Mr. Pin inserito errato. La mail è in Posta → Sistemate.»
  - La riga è: la nota della regola (il nome, «Credem») + l'oggetto tagliato a 80 caratteri.
- **Le due regole di partenza avvisano:**
  - `businesson@credem.it`, oggetto che comincia per «codice mr. pin inserito errato»;
  - `noreply@fatturazioneelettronica.aruba.it`, oggetto che contiene «hai disattivato la verifica in # passaggi».
  - Se Alessio aveva già una regola muta su una delle due, diventa «avvisa». Mai archiviarli in silenzio.
  - **Domanda 1:** le tre regole Credem degli accessi (Business On, mobile, MyBox) restano in silenzio.
- **La riga parte dopo il salvataggio, non prima** (trappola 1 del piano). Resend riconsegna le mail: la consegna doppia viene scartata prima di arrivare al trigger e non suona.
- **Il tetto (domanda 2): al massimo 5 righe all'ora.**
  - Le prime 5 nell'ultima ora: una riga per mail.
  - Dalla sesta: la mail non ha una riga sua. Parte **una sola** riga «Un altro avviso di sicurezza / Altri N avvisi di sicurezza, guardali in Posta → Sistemate. Sono più di 5 in un'ora: per un'ora i prossimi li trovi solo lì.»
  - Quelle che arrivano dopo, nella stessa ora, le copre quella riga. Il loro numero lo dice la prima riga singola che parte a raffica finita («Durante la raffica di prima, altri N avvisi di sicurezza senza riga qui»).
  - Ogni mail trattenuta resta scritta fra gli allarmi (senza invio): nessun avviso sparisce in silenzio.
- **Un invio che fallisce non fa perdere la mail.** Se Telegram, il Vault o pg_net non rispondono, la mail entra lo stesso col suo bollino, e nel registro del database resta un avvertimento.
- **Nella Posta, il riquadro «Ignora le mail come questa» ha una terza scelta: «Archivia e avvisami su Telegram».**
  - Fa una regola sul tipo di mail (mai su tutto il mittente: lo rifiuta anche il database).
  - La mail aperta va subito fra le Sistemate e non suona (Alessio l'ha appena vista). Suonano le prossime.
  - «Ignora» su una regola che avvisa già non la zittisce: per quello si toglie la regola.
- **Domanda 4: «Tutte le mail da …» su Credem, Aruba e Google chiede un sì in più.** Avviso «questo mittente manda anche mail importanti» e domanda «Vuoi davvero mettere da parte TUTTE le mail da …?», con il pulsante «Sì, tutte». Lo SdI e la PEC restano vietati come prima.
- **L'elenco delle regole** dice quali avvisano: bollino «Ti avvisa su Telegram» accanto alla regola.
- **La scheda «Sistemate» mostra anche gli avvisi di sicurezza e quelli della banca.** Prima la lista prendeva solo le note «Filtrata…»: gli avvisi della banca di B1 non comparivano, anche se la loro scheda diceva di sì.
- **Telegram:** `notify-telegram-reservation` ha la categoria «sicurezza»: una riga sola con «🔐 SICUREZZA —» davanti.

## Cosa NON c'è
- Nessun recupero: le mail di sicurezza già arrivate (gli esempi del 12/11 in «Da decidere») restano dove sono. Si sistemano a mano, o con «Archivia e avvisami».
- Il tetto è uno solo per tutte le regole, non uno per regola.
- La pubblicità riconosciuta da sola e il pulsante diretto «Archivia sempre questo mittente» sono la PR P2.

## Ordine di rilascio — tutto col sì di Alessio
1. **Su Prova: `prova:migra` PRIMA dei Controlli**, non dopo (i Controlli non migrano Prova).
2. Controlli verdi sulla PR, compresi `vocabolari`, `permessi`, `vincoli-che-parlano` e `migrazioni-senza-portieri`.
3. **Su work: `migra`**, solo col sì di Alessio.
4. **Funzioni online da reinstallare**, su Prova e su work:
   - `notify-telegram-reservation` (la categoria «sicurezza»). Prima della reinstallazione la riga arriva lo stesso, ma col titolo «⚠️ QUALCOSA NON VA»: reinstallarla subito dopo la migrazione.
   - `operazioni-atomiche` **non è cambiata**: l'elenco delle operazioni ammesse è per nome, e il nome `aggiungi_filtro_posta` è lo stesso. Non va reinstallata.
5. **Il sito** (bollino, terza scelta, conferma in più): col clic «Approve and deploy» di Alessio, DOPO la migrazione. La pagina manda `p_esito` solo per «Archivia e avvisami»: le altre due scelte funzionano anche prima.

## Da verificare dal vivo
- **Il primo «Codice Mr. Pin inserito errato» vero dopo il rilascio:**
  - nella Posta: fra le Sistemate, bollino «Sicurezza», nota «Avviso di sicurezza: …»;
  - su Telegram: UNA riga «🔐 SICUREZZA — Credem: …»;
  - nessuna spesa di MEMO per quella mail.
- **La riconsegna:** se Resend la manda due volte, la riga resta una.
- **Il mittente vero di Aruba:** la regola è su `noreply@fatturazioneelettronica.aruba.it`. Se la mail vera arriva da un altro indirizzo, non la prende: guardare il mittente sulla prima mail vera.
- **Con che utente gira `prova:migra`.** La verifica si ferma se la migrazione non gira come `postgres` (o `supabase_admin`): è apposta, perché con un altro utente le prove manderebbero righe vere su Telegram. Se si ferma per questo, va detto prima di forzare.

## Rischi e dubbi che restano
1. **Il mittente di una mail si può falsificare.** Cinque mail finte «Mr. Pin» consumano il tetto dell'ora: un avviso vero dopo arriva solo come numero nella riga della raffica (ed è comunque in Posta).
2. **`segnala_allarme` si può chiamare dal browser** (permesso del 13/08, già così prima di questa PR): un utente con il login può mandare righe su Telegram e consumare il tetto. Da chiudere con una scheda a parte.
3. **Le trattenute più vecchie di 24 ore** non vengono più contate da nessuna riga: restano in Posta e fra gli allarmi.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola, zero residui; nessuna riga parte su Telegram):
  - le funzioni nuove non sono aperte al browser né alla chiave di servizio; la firma vecchia del tasto non c'è più; il trigger è AFTER INSERT per riga; l'invio sta in un blocco che non fa fallire la mail;
  - le due regole di partenza avvisano, gli accessi Credem no;
  - come la chiave di servizio: il Mr. Pin nasce scartato con la nota della sicurezza e fa **una** riga, col testo atteso; la stessa mail riconsegnata non ne fa una seconda;
  - Aruba «Hai disattivato la verifica in 2 passaggi» fa la sua riga;
  - una regola in silenzio mette da parte e non suona;
  - la PEC dello SdI con lo stesso oggetto resta da leggere e non suona; una regola che avvisa sullo SdI e un esito inventato sono rifiutati;
  - il tetto: 5 righe singole, la sesta fa la riga della raffica («Un altro avviso…»), la settima tace; passata l'ora la prima riga conta la trattenuta;
  - il tasto «Archivia e avvisami»: regola che avvisa, la mail aperta non suona, la prossima sì col nome del mittente; la chiamata vecchia con due parametri funziona e non zittisce; «avvisa» su tutto il mittente e un esito inventato sono rifiutati; una regola muta diventa «avvisa»; lo staff non può.
- **Non ancora provata su Prova.**
- **Prove pure:** tests/unita/posta-a-righe.test.js (bollino «Sicurezza», nota senza regola, «Filtrata» per le mute e per la banca, descrizione dell'esito, Credem/Aruba/Google).
- **Prova di schermata:** tests/schermate/posta-a-righe.test.jsx (la terza scelta, il sì in più su Credem, nessun sì in più per un mittente qualunque, il bollino e l'elenco delle regole in «Sistemate»).
