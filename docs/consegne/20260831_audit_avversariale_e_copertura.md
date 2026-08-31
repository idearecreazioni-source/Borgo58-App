# Consegna — audit avversariale e copertura delle regressioni

**31/08/2026** · commit sotto questo riepilogo: **`86a6dcf`**

## Cosa è stato verificato

- 60 file e 677 prove pure: verdi.
- Copertura V8 dell'intero `src`: 9,84% righe, 9,90% istruzioni, 9,52%
  rami, 6,64% funzioni.
- Lint: nessun avviso.
- Compilazione: riuscita; resta l'avviso misurato sul chunk JavaScript da
  1.524,54 kB (361,60 kB gzip).
- Prove database senza `.env.test`: prima della correzione uscivano con codice
  zero pur non eseguendo le prove; dopo la correzione si fermano con codice uno
  e nominano le sei variabili mancanti.

Il referto completo, con perimetro, limiti e priorità, è in
`docs/referti/20260831_audit_avversariale_e_copertura_regressioni.md`.

## Cosa è cambiato

- Aggiunto `npm run test:coverage`, con report testuale, HTML e JSON.
- Aggiunto un preavvio obbligatorio a `npm run test:app`: configurazione
  incompleta o indirizzo di produzione fermano il giro prima di Vitest.
- Aggiunte quattro prove di non regressione per questo blocco.
- Il risultato rigenerabile `coverage/` non entra in Git.

## Limiti della verifica

Le credenziali del progetto Supabase di prova non erano presenti in questa
sessione. Le prove database non sono quindi dichiarate passate e la loro
copertura non è inclusa nelle percentuali. Non è stata aperta una schermata:
questa consegna non cambia l'interfaccia e il referto dichiara espressamente che
le pagine restano a zero nella misura delle prove pure.

## Cosa abbiamo rovesciato

Niente. Le regole precedenti — prove solo sul progetto di prova, nessun salto
silenzioso e distinzione fra prove pure e prove database — restano invariate.
La modifica chiude un comportamento che le contraddiceva.

## Stato finale

Il commit applicativo e il referto sono `86a6dcf`. Questo file è il solo commit
documentale conclusivo della consegna; il working tree è stato controllato
pulito dopo il commit.
