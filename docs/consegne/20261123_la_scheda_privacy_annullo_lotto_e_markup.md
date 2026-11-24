# La Scheda: privacy nel database, annullo del lotto e testo senza markup (23/11/2026)

Revisione generale di work del 23/11, punti 6, 8 e 10. Già in slave con le PR #459, #460 e #461.

## Migrazioni
- `20261123000003` (`scheda_privacy_nel_database`), punto 8:
  - il portiere della Scheda rifiuta anche le parole delicate (debito, prestito, causa, avvocato, malattia, salute, pignoramento, ipoteca), dicendo quale ha trovato; spegnere una voce già dentro non ricontrolla il testo (non cambia), quindi si può spegnere anche se contiene una parola delicata;
  - «Correggi» (`scheda_proposta_decidi`, corpo vivo, una riga) rifiuta telefoni ed e-mail nel testo corretto;
  - un IBAN scritto «IT 60 …» (spazio dopo la sigla) non passa, solo per i paesi che si usano e con almeno 4 gruppi.
- `20261123000004` (`annullo_del_lotto_pulisce_la_scheda`), punto 6:
  - `import_lotto_annulla` (corpo vivo, una riga) chiude le proposte in attesa nate dai documenti del lotto, prima di toglierli;
  - `import_lotto_voci_scheda(lotto)` elenca le voci attive della Scheda nate da quei documenti: la pagina le mostra dopo l'annullo e NON le spegne da sola.
- `20261123000005` (`scheda_senza_segni_di_markup`), punto 10: `scheda_riga_per_memo` sostituisce «<» e «>» con «‹» e «›» e appiattisce gli a capo, per un testo che va a MEMO dentro `<scheda>…</scheda>`.
- Ognuna termina con una verifica che si annulla da sola (zero residui; i numeri [S#] non si sprecano) e si registra in `applied_migrations`.

## Sito
- La pagina Importa, dopo un annullo, elenca le voci della Scheda che restano (con link alla Scheda); se non riesce a leggerle non annulla niente.

## Funzione online
- `memo-chat`: sostituisce «<» e «>» anche nel testo della Scheda e nel testo di un documento aperto (riquadro `<documento>`).

## Su work, ognuno col sì scritto di Alessio (dato il 24/11)
Copia di sicurezza → le tre migrazioni → funzione `memo-chat` → «Approve and deploy».

## Cosa NON è verificato
- La pagina Importa con un annullo vero e voci vere nella Scheda non è stata vista in un browser: solo prove di schermata e prove su Prova.
- Su work oggi non ci sono voci collegate a documenti né lotti annullati: il punto 6 non ha effetto visibile finché non succede.
- Le voci già nella Scheda non si ricontrollano: la privacy nuova vale per i testi nuovi o cambiati.
