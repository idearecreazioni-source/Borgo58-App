# Le letture di MEMO dicono quello che dicono le pagine (15/11/2026)

## Perché
Su work la chat ha dato 69 voci e 98.586,80 € per il piano, la pagina 63 e 77.620,80 €: le voci «madri» (la cui cifra è già la somma delle sottovoci) venivano contate insieme alle sottovoci. Un revisore (Fable 5.2) ha confrontato tutte e undici le letture con le pagine (`RAPPORTO_revisore_letture_MEMO_15-11.md`): due non coincidevano sui soldi, cinque davano numeri che nessuna pagina mostra. Su work: fatture fornitori 8.913,22 € di «da pagare» contro 0,00 € della pagina (10 fatture, tutte pagate); banca −247,39 € contro un saldo di 752,61 €; cassa −2.607,39 € mescolando due soggetti.

## Cosa cambia (migrazione `20261115000013`, funzione `memo-chat`, pannello)
- **Piano**: elenco delle voci senza sottovoci vive (come la pagina); una sottovoce porta il nome della madre.
- **Fatture fornitori**: «da pagare» solo per le non pagate; prima le non pagate.
- **Cassa**: soggetto su ogni riga; conteggio e totale per soggetto.
- **Banca**: tolto il «saldo» dai movimenti caricati; fuori gli ignorati; prima quelli da abbinare.
- **HACCP**: prima le non conformità aperte e le temperature fuori soglia; la ricerca non guarda più i nomi dei campi.
- **Agenda e magazzino**: totale zero (non vuol dire niente), e lo dice la descrizione dello strumento.
- **Chat**: ogni strumento dice a MEMO che cosa vuol dire il suo totale; le fonti sopra le otto si scrivono per intervallo; il grassetto `**così**` si vede in grassetto.

## Come si è provato
La verifica della migrazione crea una madre con due sottovoci e controlla 2 righe, conteggio 2, totale 30; crea una fattura da pagare e una pagata e controlla che il «da pagare» sia solo quello della prima; confronta il conteggio di MEMO con quello che conta la pagina. Annulla tutto (zero residui). Provata su Prova (499) e `memo-chat` installata.

## Non fatto (per dopo)
Prenotazioni (annullate e passate), «sotto soglia» del magazzino (regola dei prodotti non tenuti), costo piatti senza prezzo di vendita, fatture ai clienti senza «incassata», conteggio per registro in HACCP.

## Su work
Migrazioni `20261115000013` e `20261115000014` (ritocchi HACCP dopo la rilettura del revisore); funzione `memo-chat`. Copia prima.

## Rilettura del revisore (Fable 5.2)
Ha riletto la correzione: i cinque difetti gravi sono corretti. Ritocchi fatti (migrazione `20261115000014`): HACCP senza totale e con il ricevimento merci non conforme fra le righe prioritarie; descrizione delle fatture fornitori che dice che il conteggio comprende anche le pagate. Ancora da completare: prove «MEMO = pagina» con dati per cassa a due soggetti, banca con un ignorato e ordine HACCP.
