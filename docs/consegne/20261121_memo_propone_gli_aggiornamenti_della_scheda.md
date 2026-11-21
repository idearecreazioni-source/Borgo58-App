# MEMO propone gli aggiornamenti della Scheda (21/11/2026, pezzo B1)

Parte del piano della Scheda di memoria approvato da Alessio il 20/11; il via a questo pezzo («subito») l'ha dato lui il 21/11 in chat, dopo il caricamento della Scheda su work. Questo documento esiste prima del rilascio: **la migrazione NON è su work**. Su work va solo col sì scritto di Alessio e col suo «Approve and deploy».

## Cosa fa
Quando Alessio apre `/memo/scheda`, il database calcola le **proposte** con regole fisse (nessun modello AI, costo zero) e la pagina le mostra sopra l'elenco: **Sì / Non farlo / Correggi**. Niente viene scritto sulla Scheda senza il suo Sì.

Regole fisse:
- **Fornitore nuovo in anagrafica** (ultimi 60 giorni, non occasionale, non spento): proposta di aggiungere una voce in «fornitori», fonte «riferito». Il testo è fatto solo da nome, categoria, giorni di consegna e condizioni di pagamento: mai telefono, e-mail, partita IVA, referente o note.
- **Contratto nuovo in Archivio** (sezione «contratti», ultimi 60 giorni, non scaduto): proposta di aggiungere una voce in «locale» (se titolo o controparte parlano di affitto/locazione) o in «società», fonte «documentato», collegata al documento. Mai note né importi.
- **Voci da riconfermare**: fornitori e consulenti dopo 12 mesi, locale e concept dopo 6; le decisioni mai; qualunque voce (tranne le decisioni) la cui data «da rivedere» è passata. Il Sì aggiorna la data «verificata il» e, se la fonte era «riferito» o «da verificare», la porta a «confermato».
- **Voci da spegnere**: contratto collegato scaduto, fornitore spento in anagrafica. Il Sì spegne la voce (non si cancella mai).
- Al massimo **5 proposte nuove al giorno** (giorno di Roma). Una proposta non decisa scade dopo 30 giorni; una rifiutata non si ripropone per 90 giorni, una scaduta per 30. Una sola proposta in attesa per voce.
- Prima di proporre si scarta ciò che il database rifiuterebbe (IBAN, codici fiscali, numeri di carta) o che contiene parole delicate (debito, prestito, causa, avvocato…): se ne dice solo il numero.
- Un fornitore già scritto a mano in una voce (anche spenta) di «fornitori» o «consulenti» non genera proposta: una voce spenta è una scelta di Alessio.

## Migrazione
- **20261121000002** (memo propone gli aggiornamenti della Scheda): tabella `scheda_proposte`; funzioni `scheda_proposte_genera()` e `scheda_proposta_decidi(...)` (le uniche aperte, solo titolare); calcolo e aiuti interni chiusi a tutti; RLS solo-lettura per il titolare; verifica interna annullata con 16 controlli.
- Prerequisito: la 20261120000002 (Scheda) già applicata. Non tocca colonne di `documents` o `suppliers`: li legge soltanto.
- Costante nel calcolo: `2026-11-21`. Prima di quella data nessun fornitore o contratto è «nuovo»: senza, il primo giorno arriverebbe tutto il vecchio in blocco.

## Funzione online da aggiornare al rilascio
- `operazioni-atomiche` (il corridoio): il Sì scrive su due tabelle (la voce e la proposta), quindi passa dal corridoio come ogni scrittura multi-tabella. Il nome `scheda_proposta_decidi` è stato aggiunto al suo elenco chiuso. ⚠️ Se la pagina nuova va online prima che il corridoio sia installato, il Sì risponde «la parte online non è ancora stata aggiornata» e **non scrive niente**; `scripts/rilascio.mjs` lo controlla prima di pubblicare.
- Ordine: prima la migrazione, poi il corridoio, poi il sito (Approve and deploy).
- Nessuna chiamata al modello, nessun'altra Edge Function.

## Cosa NON deve cambiare (da ricontrollare dopo il rilascio)
- La Scheda resta com'è finché Alessio non preme Sì: subito dopo la migrazione ha ancora le sue 35 voci, i suoi numeri e i suoi limiti.
- `scheda_per_memo()` e la cache di MEMO: una proposta non cambia il testo per MEMO finché non è accettata.
- Nessun costo: nessuna riga nuova in `consumi_ai()`.

## Cose da sapere
- **Numeri [S#] «bruciati».** Una proposta non riserva un numero: nasce quando la voce viene scritta. Un Sì rifiutato dal database (per esempio per i limiti) può comunque far avanzare il contatore dei numeri, che non torna indietro. È già così per le voci scritte a mano.
- **Una riconferma non lascia riga nello storico della voce** quando cambia solo la data «verificata il»: lo storico guarda testo, fonte, attiva, chiave e sezione. La traccia è nella proposta (`decisa_da`, `decisa_il`, `voce_id`). Cambia però `aggiornata_il`, quindi la versione di `scheda_per_memo()` e la cache dei prompt di MEMO si rinnovano: voluto.
- **Voce cambiata dopo la proposta.** Se Alessio ha corretto la voce a mano nel frattempo, il Sì non la sovrascrive: la proposta diventa «scaduta» e la pagina lo dice («La voce è cambiata nel frattempo»).
- **Anzianità di una voce per la riconferma**: `coalesce(verificata_il, valida_dal, creata_il)`. Le 35 voci caricate il 21/11 hanno il 2026 come data di inizio o di creazione: le prime riconferme (locale e concept, 6 mesi) non arriveranno prima di aprile 2027.
- **Il giorno è quello di Roma** (`Europe/Rome`) in tutti i conteggi.
- **Correggi cambia solo il testo.** La sezione si cambia dalla Scheda.
- Le proposte dalla chat (tipo `scheda_aggiorna`) e dalla Posta non ci sono ancora: sono il pezzo successivo (B2/B3) e useranno lo stesso tipo «modifica» già previsto qui.
- Per un lavoro notturno futuro basta chiamare `scheda_proposte_calcola()` da un cron (oggi non serve: si genera all'apertura della pagina).

## Prove
- Verifica interna della migrazione (Prova, annullata, zero residui): permessi di anon, staff e titolare; il testo del fornitore non contiene contatti né note; seconda chiamata senza doppioni; Correggi a 301 e a 300 caratteri; Sì che scrive come il titolare (storico); rifiuto a 89 e 91 giorni; voce spenta con lo stesso nome; IBAN finto nel nome saltato e contato; riconferma che non abbassa la fonte e non tocca le decisioni; voce cambiata a mano dopo la proposta; spegni da contratto scaduto; fonte che scende senza e con conferma; proposta non cancellabile; tetto di 5 al giorno; Sì rifiutato con la Scheda a 60 voci con la proposta ancora in attesa.
- Prove sul testo della migrazione (`tests/unita/scheda-proposte-sql.test.js`), regole pure (`tests/unita/scheda-proposte.test.js`) e schermate (`tests/schermate/scheda-proposte.test.jsx`).
- ⚠️ La verifica della migrazione gira su dati inventati (`Zz …`) e viene annullata. Su work non è stata eseguita: lì si vede alla prima apertura della pagina dopo il rilascio (le proposte compaiono solo per fornitori e contratti creati dal 21/11 in poi, quindi all'inizio la sezione dirà «MEMO non ha proposte oggi»).
