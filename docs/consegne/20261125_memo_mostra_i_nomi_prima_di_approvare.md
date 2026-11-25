# MEMO mostra i nomi veri prima di approvare (25/11/2026)

Revisione dell'11/11, punto 16.

## Migrazione
- `20261125000004` (`prima_di_approvare_si_leggono_i_nomi`): per movimenti di cassa, carichi e giacenze, accanto a ogni identificativo il database scrive il nome letto dalla sua tabella (`causale_nome`, `fornitore_nome`, `prodotto_nome`, `conto_nome`). Chi approva vede cosa verrà scritto davvero, non solo la frase dell'AI. Se l'identificativo non c'è più, il nome vecchio sparisce.
- Nuova funzione `voce_nomi_leggibili` (chiusa a tutti), innestata in `voce_risolvi_dati` cambiando il corpo vivo in un punto solo (controllato: l'ancora deve comparire una volta sola).
- I nomi non cambiano cosa viene scritto: le funzioni che eseguono l'azione leggono un campo alla volta (verificato dalla revisione ECC).
- Provata il 25/11 su Prova: verifica passata, 78 test su voce/MEMO/permessi verdi.

## Sito
- Nell'appunto da approvare si leggono «causale», «prodotto», «conto» (e «fornitore») per nome; i codici restano nascosti.
- I nomi scritti dal database non compaiono più come testo da correggere nel modulo di correzione (si sarebbero sovrascritti in silenzio).

## Su work, ognuno col sì scritto di Alessio
Copia di sicurezza → migrazione `20261125000004` → nessuna funzione online → «Approve and deploy» (il sito cambia: appunti MEMO).
