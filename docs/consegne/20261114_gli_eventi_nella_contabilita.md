# Gli eventi nei mesi congelati e nella chiusura dell'anno (14/11/2026)

Commit sotto questa consegna: `928909cb`. Migrazione `20261114000003_gli_eventi_nella_contabilita`. Nessuna funzione online da installare.

Alessio, 14/11 («sì, aggiungile»): le fatture degli eventi (senza tavolo) entrano anche nei mesi congelati e nella chiusura dell'anno, senza contarle due volte con i conti dei tavoli fatturati. Il metodo è stato rivisto da ecc:database-reviewer prima di scrivere codice («vai con modifiche»), e le modifiche sono fatte.

## Cosa entra
- **`misure_del_mese`** dà anche `imponibile_eventi` e `imposta_eventi` (quelli congelati all'emissione). Conta le fatture **numerate, senza tavolo, non scartate**:
  - «da inviare» conta, perché ha il suo numero e sta per partire;
  - una scartata no, finché non si rimanda;
  - una bozza non ha numero.
- **`consuntivi_mensili` e `chiusure_annuali`** hanno tre colonne nuove: `ricavi_eventi`, `eventi_quanti`, `imposta_eventi`. Sono **vuote** per ciò che è già stato congelato, e vuoto vuol dire «non registrato», non zero. Aggiungere una colonna non è un UPDATE, quindi il blocco che impedisce di riscrivere un consuntivo non scatta.
- **`chiudi_mese` e `chiudi_anno`** le scrivono. E **si rifiutano** se nel periodo c'è una fattura di evento «da inviare» o scartata: entrerebbe nei numeri dopo la foto, che non si rifà.
- **`misure_dell_anno`** somma gli eventi: dalla foto del mese se li ha, dal vivo se il mese è stato fotografato prima di oggi. Una fattura ha totale e data che non cambiano.
- **Le pagine** mostrano gli eventi a parte:
  - Andamento mensile, con l'IVA;
  - Chiusura annuale, con la riga «Eventi fatturati»;
  - lo storico delle chiusure.

## Cosa NON cambia, e perché
- **La stima delle imposte a fine anno non cambia di un euro.** Il piano ha già gli eventi previsti come «linee accessorie», e nessuno li misurava. Sostituirli con quelli veri vorrebbe un margine che le fatture non hanno: il piano ha il suo costo per ogni linea, e le fatture sono IVA compresa. Il revisore l'ha sconsigliato. **È una scelta di Alessio**: gli eventi veri sostituiscono quelli previsti nella stima?
- `ricavi` di sala, scontrino medio e confronto col piano: come dopo la #399.
- Imposte, IVA e Proiezione Fiscale non leggono `misure_del_mese`: lavorano sui conti dei tavoli. Non esiste nel database un calcolo dell'IVA sulle vendite. Per ora l'IVA esatta degli eventi si vede nelle pagine, e questa è l'informazione utile per Laura.

## Revisione (ecc:database-reviewer, sul metodo)
Corretto rispetto al mio piano iniziale:
1. Niente stima del margine degli eventi con il rapporto medio del piano (mescolava basi diverse). **Non c'è.**
2. Il filtro sullo stato: prima contava anche le scartate. Ora no.
3. Un mese o un anno non si congela con una fattura di evento in sospeso.
4. Le funzioni si ricreano senza `cascade`, e i permessi si rimettono (verificato).
5. Una foto vuota per gli eventi si legge dal vivo.

Da sapere:
- Una fattura datata in un mese già congelato (prima di oggi) e poi emessa non compare nella foto, ma compare nella chiusura dell'anno, che la legge dal vivo.
- Un ordine cancellato lascerebbe la fattura senza tavolo, che diventerebbe un evento (`on delete set null`): non si duplica niente, ma il ricavo si sposta dalla sala agli eventi.
- La caparra di un evento già in prima nota e poi fatturata senza tavolo: nessun doppio conteggio nei ricavi del mese, perché la caparra non è nei ricavi.

## Verifica dentro la migrazione (annullata, zero residui)
1. Bozza e scartata non contano, «da inviare» sì. Totale, imponibile e IVA tornano.
2. Un mese con una fattura scartata non si congela. Dopo che è ripartita si congela, e la foto porta gli eventi.
3. La chiusura dell'anno somma: il mese fotografato (dalla foto), quello non fotografato (dal vivo) e quello fotografato senza il dato (dal vivo). Poi la chiusura dell'anno porta gli eventi.
4. I permessi delle funzioni ricreate sono quelli di prima: il titolare sì, da fuori no.
5. La foto del mese non cambia i ricavi di sala.

## Su Prova (14/11)
- A secco, poi `prova:migra`: 488 migrazioni.
- I lettori dei mesi (numeri del mese, confronto col piano, budget omaggi) girano ancora dopo il cambio.
- Nessun dato lasciato.

## Cosa abbiamo rovesciato
Niente.

## Rilascio su work
**Un solo rilascio con la #399** (decisione di Alessio, 14/11): le migrazioni `20261114000002` e `20261114000003` e il sito (Approve). Nessuna funzione online. **Solo col sì scritto di Alessio.**
