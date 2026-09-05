# SPEC-0003 — La scheda dei materiali resta in Magazzino

| Campo | Valore |
|---|---|
| Stato | Bozza — in attesa di conferma di Alessio |
| Priorità | Da definire |
| Origine | Osservazione di Alessio sulla creazione di un materiale, 05/09/2026 |
| Richieste correlate | [`M1`](../RICHIESTE.md), [`M2`](../RICHIESTE.md), [`M4`](../RICHIESTE.md), [`M5`](../RICHIESTE.md) |
| Decisioni vigenti correlate | [`DECISIONI.md`](../DECISIONI.md), sezione Materiali di consumo |

## Problema

Da «Magazzino → Materiali di consumo → Nuovo materiale» si apre una scheda
che, pur avendo titolo e ritorno corretti, attiva nel menu laterale
«Ricettario». Il percorso tecnico riusa la stessa scheda dei prodotti
alimentari, ma per chi la usa sembra di essere portato in un modulo dal quale
quel materiale è escluso.

La stessa scheda espone residui alimentari: l'esempio del nome è «Pomodoro San
Marzano DOP» e la scorta minima è espressa in kg, anche quando un materiale si
conta a pezzi, rotoli o confezioni.

## Obiettivo

Un materiale deve restare riconoscibile come tale in tutto il percorso: menu
laterale, indirizzo della schermata, ritorno, esempi e unità. La scheda può
continuare a riusare la stessa base tecnica del prodotto alimentare, perché
prezzo, fornitore, giacenza e riordino sono gli stessi; il riuso non deve però
essere visibile né confondere il posto del materiale.

## Fuori-scope

- Creare un secondo magazzino o duplicare anagrafiche e giacenze.
- Consentire a un materiale di entrare in ricette.
- Cambiare le categorie chiuse dei materiali.
- Reintrodurre i campi alimentari che sono stati tolti ai materiali.

## Decisioni aperte

1. **Proposta espressa da Alessio, da confermare:** dalla creazione alla
   modifica, la scheda di un materiale resta visivamente e nella navigazione
   sotto «Magazzino → Materiali di consumo»; «Ricettario» non si attiva.
2. Quale esempio usare nel nome: uno neutro (ad esempio «Carta forno 30 cm»)
   oppure un esempio che cambia con la categoria selezionata.
3. La scorta minima e il prezzo devono nominare l'unità effettivamente scelta
   (ad esempio «pz», «rotoli», «l»), non «kg» come valore fisso.
4. Priorità rispetto alle altre richieste aperte.

## Dipendenze

- Distinzione esistente `alimentare = false` e divieto nel database di usare
  materiali nelle ricette.
- Categorie e unità proprie dei materiali già decise.
- Base di dati condivisa con gli ingredienti per non duplicare merce, prezzi,
  fornitori, giacenze e lista della spesa.

## Criteri di accettazione

- «+ Nuovo materiale» apre una schermata con il menu Magazzino attivo e con
  ritorno a Materiali di consumo.
- L'utente non vede né interpreta il percorso come Ricettario.
- Nome, esempio, categorie, unità e spiegazioni parlano di materiali, non di
  alimenti.
- La misura visualizzata per scorta e prezzo segue l'unità selezionata.
- Il materiale creato compare in Magazzino → Materiali di consumo, mantiene
  fornitore, prezzo, scorta e controllo prezzi, e non entra nel Ricettario.

## Collegamenti a decisioni vigenti

- I materiali sono una sezione separata del Magazzino, non un filtro degli
  ingredienti.
- I materiali non possono entrare in una ricetta.
- «Varie ed eventuali» è la categoria residuale dei materiali; «Altro» non lo
  è.

## Nota per il coordinamento

La bozza non richiede una nuova struttura dati: descrive la coerenza del
percorso e del linguaggio sopra una distinzione già esistente. Dopo la
conferma delle decisioni aperte, va portata alla chat di coordinamento per il
mandato esecutivo e la verifica.
