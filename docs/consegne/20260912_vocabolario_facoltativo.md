# Vocabolario, riga 10: «(facoltativo)» ovunque — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## La regola

«(facoltativo)» al posto di «(opzionale)», «(opz.)» e «(facoltativa)», e
«Il file è facoltativo» al posto di «Il file è opzionale». Una parola intera
si legge meglio di un'abbreviazione, e sulla stessa schermata c'erano due
forme (Ricevimento merci, Lista della spesa).

⚠️ «(facoltativo)» anche accanto a un nome femminile («Nota (facoltativo)»,
«Categoria (facoltativo)»). Alessio l'ha chiesto «ovunque», e letto come
«campo facoltativo» è un segno solo invece di due.

## Cosa cambia — 31 sostituzioni in 27 file

- HACCP: Non conformità, Pulizia e sanificazione (4), Raccolta propria (3),
  Ricevimento merci (2), Temperature (2).
- Magazzino: Fornitori, Magazzino, Produzioni, Spesa spicciola, Registra
  carico (4), Lista della spesa (2).
- Cassa: Prima nota (2), Sconti e omaggi (3), Sezione personale.
- Documenti: Archivio (3, compreso «Il file è facoltativo»).
- Fiscale: Deducibilità (2), Deduzioni, Catalogo strumenti.
- Personale: Personale, Mance.
- Ricettario: Menu, Ricetta (nuova), Ricetta (scheda, 2), Ingrediente (2).
- Agenda: scheda impegno (2).
- Allergeni del piatto, e la spesa «di tasca mia» (`lib/calcoli/tasca.js`,
  «Finalità aziendale (facoltativo, utile in verifica)»).

Due prove citavano quella frase parola per parola e sono aggiornate:
`tests/unita/tasca-prima-nota.test.js` e
`tests/schermate/prima-nota-tasca.test.jsx`.

## ⚠️ Rimandati a dopo la #57: sei file, 14 «(opz.)»

La #57 riscrive le stesse righe (misurato con `git merge-tree`). Il mandato
dice di non forzare, quindi restano come sono finché la #57 non è unita:
- `components/FormNotaCredito.jsx` (1);
- `agricolo/AgricoloHome.jsx` (3);
- `agricolo/Cessioni.jsx` (2);
- `fatture/FattureFornitoriHome.jsx` (4);
- `fiscale/AndamentoMensile.jsx` (1);
- `personale/DipendenteDetail.jsx` (3).

## Come è stato verificato

- Sostituzioni contate file per file: ogni numero torna. Dopo, fuori dai sei
  file rimandati, in `src` non compaiono più «(opzionale)», «(opz.»,
  «(facoltativa)» né «è opzionale».
- `npm run lint` pulito.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, rosse
  anche su master.
- Prove sulle schermate: le uniche rosse sono i tempi scaduti già noti
  (`rotte-chiuse`, `varco-pubblico`). Rilanciate da sole, sono le **stesse
  tre col codice di master**; `prima-nota-tasca` è verde. Un quarto caso
  rosso nel giro completo («offre l'informativa…») da solo è verde.
- `git merge-tree` con i rami di #57–#78 e con gli altri rami del
  vocabolario: nessun conflitto, dopo aver tolto i sei file.

## Cosa NON è verificato

- Non misurato a schermo: «(facoltativo)» è più lungo di «(opz.)» di sette
  caratteri. Sta quasi sempre in un segnaposto (il testo grigio dentro il
  campo), e in un campo stretto sul telefono può non vedersi per intero.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `6d44727` sul ramo `vocabolario-facoltativo`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
