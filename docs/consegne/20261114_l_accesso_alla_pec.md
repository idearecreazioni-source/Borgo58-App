# L'accesso alla PEC riprova e dice cosa ha visto (14/11/2026)

Commit sotto questa consegna: `efab0206`. Nessuna migrazione. Funzione da installare: `fattura-spedisci`.

## Perché
Il primo «Prova la PEC» su work, la mattina del 14/11, ha avuto **535**: Aruba rifiutava l'accesso, ma Alessio aveva controllato due volte utente e password, anche riscrivendo la password a mano. Il collegamento invece funzionava: il gestionale aveva raggiunto il server della PEC.

## Cosa entra
- **I bordi dei Secrets si puliscono**: spazi e «a capo» in testa o in fondo a `PEC_UTENTE` e `PEC_PASSWORD` si tolgono. La casella dei Secrets accetta più righe, quindi un Invio finisce nella password. Se c'era qualcosa da togliere, la risposta lo dice (mai cosa).
- **Se «AUTH PLAIN» è rifiutato si riprova con «AUTH LOGIN»**: sono i due modi standard, e alcuni server ne accettano davvero uno solo.
- **«Prova la PEC» dice cosa ha visto**: i modi di accesso che il server accetta, quelli provati e quanti caratteri hanno utente e password. Mai la password.

## Prove
`tests/unita/smtp.test.js` (16):
- PLAIN rifiutato e LOGIN accettato;
- tutti e due rifiutati, con un errore che dice i modi provati e le lunghezze, e non contiene la password.

## Cosa abbiamo rovesciato
Niente.

## Rilascio
Autorizzato da Alessio il 14/11 («sì, falla tutta»):
1. slave;
2. master;
3. `npm run funzione -- fattura-spedisci --conferma`;
4. Approve.
