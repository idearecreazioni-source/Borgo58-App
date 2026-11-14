# Voce nel pannello e conversazioni da ritrovare (15/11/2026)

Nessuna migrazione, nessuna funzione Supabase modificata, nessun commit creato.

## Cosa c'e'

- Nel pannello della chat il pulsante «Parla» usa lo stesso riconoscitore
  italiano, continuo e con testo provvisorio di MEMO voce. Premendo «Ferma»
  la trascrizione entra nel campo: Alessio puo' correggerla e decide lui
  quando inviarla.
- Quando MEMO voce risponde «Questa domanda non la so ancora fare», non
  mostra piu' il vecchio elenco chiuso: «Chiedimelo nella chat →» apre il
  pannello senza lasciare `/detta` e porta dentro la frase appena detta.
- Il pannello legge fino a 30 conversazioni gia' presenti, con titolo e
  data. Un titolo assente e' la prima domanda, accorciata solo a schermo;
  non viene inventata ne' scritta una nuova riga.
- Toccando una conversazione si rileggono soltanto i messaggi di Alessio e
  MEMO, nell'ordine in cui sono stati scritti, e la domanda successiva
  continua con il suo `conversazione_id`.

## Permessi e confini

Le nuove chiamate sono sole `select` dal browser su `memo_conversazioni` e
`memo_messaggi`. Le RLS della PR 3 restano l'unico cancello: lo staff non
vede il pulsante e il database non restituisce le righe neppure aggirando
la schermata. Nessuna funzione online, appunto, dettatura o Scorciatoia
Apple Watch e' stata cambiata.

## Prove

- `tests/unita/chat-memo.test.js`: titolo di ripiego e data della
  conversazione, oltre al contratto gia' esistente della chat.
- `tests/schermate/memo-chat.test.jsx`: trascrizione prima dell'invio,
  riapertura e prosecuzione della conversazione.
- `tests/schermate/risposta-memo.test.jsx`: dalla risposta vocale sconosciuta
  parte soltanto l'invito alla chat, senza elenco fisso.

## Scelta fatta qui

Il titolo derivato non viene salvato: e' una presentazione della prima
domanda gia' conservata nel database. Evita una scrittura aggiuntiva e resta
vero anche per le conversazioni create prima che esistesse il titolo.
