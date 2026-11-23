# «Non far leggere all'AI» chiude Scheda e Agenda, e la spesa dell'AI non sfugge al tetto (23/11/2026)

Revisione generale di work del 23/11, punti 4 e 7. Già in slave con le PR #454 e #455.

## Migrazione
- `20261123000002` (`no_ai_chiude_scheda_e_agenda`):
  - `scheda_compone_testo` prende un terzo parametro (spento di partenza: il limite di 10.000 caratteri conta ancora TUTTE le voci); `scheda_per_memo` lo accende, quindi le voci della Scheda nate da un documento con «non far leggere all'AI» non vanno più a MEMO; la «versione» della Scheda porta anche quante voci sono escluse, così MEMO non tiene in cache il testo vecchio; i contatori (voci e caratteri) restano quelli di tutte le voci.
  - `memo_leggi_agenda` salta i promemoria collegati (`documents.task_id`) a un documento riservato; il confronto notturno (`memo_confronta_con_le_pagine`, corpo vivo, una riga) li salta uguale, per non far scattare un allarme finto.
  - Termina con una verifica che si annulla da sola (zero residui) e si registra in `applied_migrations`.

## Funzioni online
- `memo-chat`:
  - dopo ogni giro del modello scrive subito il costo di quel giro (una riga con ruolo «strumento»: la chat non la mostra, il limite orario non la conta); se non riesce a scriverla, si ferma. La riga finale porta i token totali e solo il resto del costo. Il salvataggio si ritenta 3 volte e la risposta dice se il registro è stato scritto;
  - una conversazione che ha già nominato un documento (o il suo promemoria) che ora è riservato riparte dalla sola domanda di adesso; se non riesce a controllare, si ferma.
- `assistente-archivio` e `documento-leggi`: il registro della spesa si ritenta 3 volte prima di arrendersi (la risposta già pagata arriva comunque).

## Su work, ognuno col sì scritto di Alessio (dato il 23/11)
Copia di sicurezza → migrazione → le tre funzioni → «Approve and deploy» (il sito non cambia: nessun file della schermata).

## Cosa NON è verificato
- Oggi su work nessun documento è riservato e nessuna voce è collegata a un documento: la parte «no_ai» non ha effetto visibile finché lui non accende il segno.
- Le funzioni online non si eseguono da qui: le prove leggono il codice; il comportamento dal vivo con una domanda vera a MEMO non è stato provato.
