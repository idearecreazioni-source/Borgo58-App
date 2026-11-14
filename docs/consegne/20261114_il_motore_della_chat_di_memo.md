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
