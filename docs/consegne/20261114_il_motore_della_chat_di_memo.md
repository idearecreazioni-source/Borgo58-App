# Consegna — il motore della chat di MEMO

## Cosa entra

- Nuova Edge Function `memo-chat`: solo titolare, storico ricostruito dal
  server, Claude Sonnet con strumenti di sola lettura e nessun SQL prodotto
  dal modello.
- Freni prima di ogni giro: tetto mensile, 60 messaggi orari, cinque giri,
  otto strumenti, 1.500 token in uscita e 0,25 € stimati.
- Strumenti SQL limitati a 50 righe per Piano, Cassa, Fatture fornitori,
  Agenda e Magazzino; ogni risultato porta conteggio e totale.
- Registro di domanda, risposta, strumenti, token, costo e riferimenti
  brevi. Un listino assente resta un costo non noto, mai uno zero finto.
- Controllo deterministico dei numeri e fonti «Dove l'ho letto».

## Fuori da questa PR

Non entra nessuna pagina o pannello (PR 5), nessuna scrittura sul
gestionale e nessuna proposta approvabile (PR 8). Le 26 domande della voce
restano invariate.

## Prima di applicare

Confrontare sul database vivo le funzioni riusate elencate in testa alla
migrazione e provare una risposta del Piano contro il totale della sua
schermata. La migrazione contiene una verifica annullata; non è stata
eseguita qui perché questa consegna non tocca database remoti.

## Revisione (Claude, 14/11)

Codice di ChatGPT, rivisto da Claude e provato davvero su Prova (funzione `memo-chat` installata e chiamata: staff rifiutato, domanda del titolare risposta con riferimenti e costo 0,02 €). Dalla revisione del database, corretti: conteggi e totali su TUTTE le righe (non sulle prime 50) e fatture da pagare per prime (migrazione `20261114000015`); risposta provvisoria non più data per finale, cronologia che non parte da una risposta di MEMO, nome dello strumento controllato (funzione). Restano da fare, non urgenti: costo registrato anche se la funzione si interrompe (`try/finally`), messaggi `in_corso` appesi, campi liberi tagliati a 300 caratteri, ricerca con `%` e `_` letterali.
