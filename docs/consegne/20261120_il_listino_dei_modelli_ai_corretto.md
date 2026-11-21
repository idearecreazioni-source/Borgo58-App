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

## Su work (20/11/2026, sera)
- Sì scritto di Alessio: «1 si» per la correzione, «tutto confermato adesso» per copia di sicurezza e migrazione, «Sì, approva» per l'«Approve and deploy».
- Copia di sicurezza di work: 2026-11-20_2129 (163 tabelle, 2.612 righe, 56 documenti, controllata).
- Unite: #430 (migrazione), #432 (riallineamento di slave a master) e #431 (slave verso master). Giro su master 44811799610: verde.
- Migrazione applicata su work: 505 migrazioni (prima 504). Le sei righe di `costo_modello_ai` lette su work coincidono con i valori attesi (Opus 5 4,60/23,00; Sonnet 5 1,84/9,20; Sonnet 5.5 1,84/9,20; Opus 5.5 3,68/18,40; Haiku 5.5 0,092/0,46; Haiku 4.5 0,92/4,60).
- Approve and deploy dato con `gh api` col sì scritto di Alessio.
- Nota: la prima volta la migrazione non partiva su work perché su Prova mancava la riga di registro (era stata applicata a mano prima della correzione); registrata con `prova:migra`.
