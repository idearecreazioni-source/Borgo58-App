# La Proiezione conta le fatture, e la fattura si prepara dalla chiusura del conto (13/11/2026) — pezzo 5b di 5

Commit sotto questa consegna: `2c3db036`. Il lavoro è in `db8ae204`; `2c3db036` rimette il «silenzio motivato» accanto alla lettura del registratore in `CloseOrderModal.jsx`, che le righe nuove avevano allontanato dalla sua spiegazione. Migrazione `20261113000008_la_proiezione_conta_le_fatture`. Nessuna funzione da installare.

Piano approvato da Alessio il 13/11 («sì, approvo»). Il pulsante dalla chiusura del conto l'ha chiesto Alessio («la fattura perché deve essere promessa? non può essere emessa sempre al momento?») e la chat madre l'ha passato a questa chat («sì passalo alla chat operativa»). Turno di Prova dato dalla chat madre.

## Cosa entra
- **I ricavi delle fatture senza tavolo nella Proiezione.** `misure_del_mese` è ripresa da `20260819000006` con un solo blocco in più. Le fatture ai clienti **senza tavolo** e già uscite (con il numero) entrano nei ricavi del mese **alla data della fattura**, col totale IVA compresa, come i conti.
  - Il mese risulta «misurato» anche se ha solo fatture.
  - ⚠️ **Le fatture dei tavoli no**: il loro ricavo è già il conto, e contarle raddoppierebbe.
  - Da qui il ricavo passa nei consuntivi, nell'andamento dell'anno e nella Proiezione.
- **«Prepara la fattura ora».** In Comande, chiudendo un conto con «Il cliente vuole fattura», lo scontrino non esce (come prima) e subito dopo compare la schermata `FatturaDelConto`.
  - **Al titolare** mostra **«Prepara la fattura ora»**, che apre la fattura già compilata con i piatti (`/fatture-clienti?ordine=…`), così i dati del cliente si prendono mentre è ancora al tavolo. C'è anche «Più tardi»: il conto resta «fattura promessa» in Cassa, con «Prepara la fattura».
  - **Allo staff** non mostra nessun pulsante verso una pagina chiusa: dice che la fattura la prepara il titolare e quali dati chiedere al cliente.
  - Il commento in `CloseOrderModal.jsx` che diceva «la fattura la fa Alessio da Fatture in Cloud» è aggiornato.

## Revisione (ecc:code-reviewer)
- **(critico)** La funzione nella migrazione era tagliata in fondo, per un errore nel copiarla. L'aveva fermata anche la prova a secco su Prova. Ricomposta e riprovata.
- Il lato React: nessun difetto. Il ramo «vuole fattura» salta solo la lettura del registratore, che con la fattura promessa non stampa comunque.
- ⚠️ **Da decidere con Alessio, non toccato**: lo **scontrino medio** (ricavi diviso coperti, in `andamento_anno`) si gonfia nei mesi con fatture di eventi, perché i ricavi crescono e i coperti no. Si può tenere fuori dallo scontrino medio il ricavo delle fatture senza tavolo, oppure accettarlo e scriverlo.
- Un mese già chiuso (consuntivo congelato) prima di questa migrazione non include le fatture. È coerente, ma va saputo.

## Verifica dentro la migrazione (annullata, zero residui)
1. Una fattura senza tavolo uscita entra nei ricavi del suo mese col suo totale, e il mese è «misurato».
2. Una bozza no.
3. La fattura del conto di un tavolo non aggiunge niente oltre al conto.

## Su Prova (13/11)
- A secco, poi `prova:migra`: 486 migrazioni.
- Nessun dato lasciato.

## Prove
- `tests/schermate/fattura-al-tavolo.test.jsx` (8, tre nuove):
  - il titolare vede «Prepara la fattura ora», che porta al conto giusto, e «Più tardi» chiude;
  - lo staff legge cosa fare e non ha il pulsante;
  - senza la spunta non compare niente.

  Le cinque di prima sono ancora verdi: con la spunta lo scontrino non esce.

## Cosa abbiamo rovesciato
Niente di nuovo. Il rovesciamento della decisione del 14/08 (Fatture in Cloud) è già dichiarato con il pezzo 1, voce 110.

## Rilascio su work (solo col sì di Alessio)
Insieme ai pezzi 1-5a:
1. le migrazioni `20261113000002`-`08`;
2. le funzioni `operazioni-atomiche`, `fattura-spedisci` e `posta-leggi`;
3. Approve and deploy.
