# La chiave dell'iPhone ha un tetto di token (25/11/2026)

Revisione dell'11/11, punto 17 (scelta B della chat madre). La barriera di Casa (decisione dell'1/11) non si tocca e non nascono chiavi nuove.

## Migrazione
- `20261125000001` (`la_chiave_dell_iphone_ha_un_tetto_di_token`):
  - `registra_dettatura_da_chiave` riporta i token di ogni dettatura in un intervallo sensato: domanda 0–40.000, risposta 0–4.000, cache 0–200.000 (corpo vivo cambiato in due punti, controllato: ogni riga deve comparire una volta sola);
  - `voce_limite_dettature` (l'unico posto dei limiti, usato da entrambe le porte) ferma la chiave anche oltre 500.000 token nell'ultima ora, oltre alle 60 dettature già previste;
  - termina con una verifica annullata (13 dettature da 44.000 token fermano la chiave) e si registra in `applied_migrations`.
- Provata il 25/11 su Prova: verifica passata, `voce.test.js` e `permessi.test.js` verdi (52 test).

## Limite noto, accettato
Con la chiave si può ancora leggere il catalogo col piano. **Se perdi il telefono, revoca la chiave in un tocco** dal gestionale.

## Su work, ognuno col sì scritto di Alessio
Copia di sicurezza → migrazione `20261125000001` → nessuna funzione online da pubblicare → «Approve and deploy» (il sito non cambia).
