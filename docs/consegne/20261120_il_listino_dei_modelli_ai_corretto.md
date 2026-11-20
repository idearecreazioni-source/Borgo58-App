# Il listino dei modelli AI, corretto con il conto vero (20/11/2026)

Autorizzato da Alessio il 20/11/2026 («1 si»: correggere la tabella prezzi su work, con copia di sicurezza prima e migrazione).

## Migrazione
- 20261120000001 (il listino dei modelli AI corretto): aggiorna o aggiunge cinque righe di `costo_modello_ai`; Haiku 4.5 resta com'è.

## Perché
Costi e token per modello della Console di Anthropic (ultimi 30 giorni, mandati da Alessio) confrontati con il listino ufficiale.
- Opus 5: 15 / 75 € (provvisorio) → 4,60 / 23 € (listino 5 / 25 dollari, cambio 0,92).
- Sonnet 5: 2,75 / 13,75 € → 1,84 / 9,20 € (listino 2 / 10 dollari).
- Nuove: Sonnet 5.5 (1,84 / 9,20), Opus 5.5 (3,68 / 18,40), Haiku 5.5 (0,092 / 0,46).

## Cosa abbiamo rovesciato
- Cosa era stato deciso e quando: il 14/11 la riga di Opus 5 a 15 / 75 €, «prudenziale finché il listino usato dall'account non è verificato».
- La ragione di allora: nessun prezzo certo nel repository.
- Cosa si decide adesso: il listino ufficiale, confermato con i costi veri della Console del 20/11.
- Perché la ragione di allora non vale più: il prezzo ora è verificato su un conto reale. La prudenza resta in un solo punto: la cache dei prompt non è modellata, quindi ogni token d'ingresso è contato a prezzo pieno e il conto vero può solo essere più basso.

## Cosa NON deve cambiare (da ricontrollare dopo)
- I costi già scritti nelle righe di chat, voce, foto e ricetta.
- Nessun'altra tabella; Haiku 4.5 invariato (0,92 / 4,60).
- Archivio e posta calcolano il costo dal listino al momento: i conti passati con Opus 5 scendono al valore vero. È voluto.

## Prove
- Prova (progetto di prova): migrazione applicata, sei righe lette e uguali ai valori attesi; il blocco di verifica della migrazione fa fermare tutto se un prezzo non coincide.
