# Vocabolario, riga 10: «(facoltativo)», concordato col nome — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71, **corretta da lui lo
stesso giorno**: «(facoltativo)» deve concordare con il nome a cui si
riferisce («Nota (facoltativa)», «Descrizione (facoltativa)»), e resta
«(facoltativo)» solo con i nomi maschili.

**Solo testo a schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni
online**: nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## ⚠️ Correzione di questo riepilogo

- La prima stesura diceva «31 sostituzioni in 27 file». Contate una per una
  sul diff, le sostituzioni erano **47**: il conto era sbagliato.
- La prima stesura diceva anche che «(facoltativo)» andava bene accanto a un
  nome femminile. Alessio l'ha corretto, e questa stesura lo applica.

## La regola

Al posto di «(opzionale)», «(opz.)» e «(facoltativa/o)»:
- **«(facoltativo)»** con un nome maschile;
- **«(facoltativa)»** con un nome femminile;
- **«(facoltative)»** con un plurale femminile.

Più «Il file è facoltativo» al posto di «Il file è opzionale».

## Le 47 sostituzioni, verificate una per una

**29 femminili → «(facoltativa)»**
- «Nota» in Prima nota, Sconti e omaggi, Sezione personale, Archivio, Non
  conformità, Pulizia e sanificazione (×2), Raccolta propria, Ricevimento
  merci, Temperature, Lista della spesa, Magazzino, Registra carico, Mance,
  scheda ingrediente, scheda ricetta.
- «Nota sul rischio di contaminazione» (Raccolta propria).
- La nota della deducibilità («Nota — a cosa serve ricordarsi che si
  applica»).
- «Descrizione» (scheda impegno).
- «Scadenza» ×2 (Catalogo strumenti, Registra carico).
- «Categoria» (scheda ingrediente).
- «Sottocategoria» (nuova ricetta).
- «Tecnica» (scheda ricetta).
- «Area» (Pulizia e sanificazione).
- «Mansione» (Personale).
- «Finalità aziendale» ×2 (spesa di tasca, Deduzioni).
- «Temp. °C» (Ricevimento merci: è la **temperatura**).

**1 plurale femminile → «(facoltative)»**
- «Controparti (facoltative, es. locatore, assicurazione)» (Archivio).

**3 già «(facoltativa)» su master, tornate come prima**
- La nota degli allergeni del piatto, la «Nota» delle Produzioni, la
  «Categoria» della spesa spicciola.
- La PR le aveva cambiate in «(facoltativo)»: ora sono identiche a master e
  **non fanno più parte della PR**.

**14 maschili → restano «(facoltativo)»**
- «Promemoria Telegram», «Rif. documento» ×2 (è il riferimento),
  «Riferimento», «Cliente», «Device», «Esito», «Ingrediente collegato»,
  «Tipo», «Telefono», «Fornitore», «Costo unitario, IVA esclusa»;
- «In vigore dal» (dal **giorno**);
- «Il file è facoltativo».

Tre scelte da interpretazione, dichiarate:
- «Temp. °C» → femminile, perché è la temperatura;
- «Device» → maschile, l'uso italiano («il device»);
- «In vigore dal» → maschile: il nome sottinteso è il giorno.

Conteggio: **29 + 1 + 3 + 14 = 47**. Nel diff della PR restano **44**
righe cambiate (29 + 1 + 14), controllate estraendole dal diff una per una
col nome accanto.

Le due prove che citano la frase della spesa di tasca sono aggiornate a
«Finalità aziendale (facoltativa, utile in verifica)»:
- `tests/unita/tasca-prima-nota.test.js`;
- `tests/schermate/prima-nota-tasca.test.jsx`.

## ⚠️ Rimandati a dopo la #57: sei file, 14 «(opz.)»

La #57 riscrive le stesse righe (misurato con `git merge-tree`). Si faranno
con la stessa regola di concordanza:
- `components/FormNotaCredito.jsx` (1);
- `agricolo/AgricoloHome.jsx` (3);
- `agricolo/Cessioni.jsx` (2);
- `fatture/FattureFornitoriHome.jsx` (4);
- `fiscale/AndamentoMensile.jsx` (1);
- `personale/DipendenteDetail.jsx` (3).

## Come è stato verificato

- Sostituzioni della correzione contate: 34 frasi (32 del codice più le 2
  prove), ognuna trovata esattamente il numero di volte atteso.
- `npm run lint` pulito; `npm run build` riuscita.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows
  (`indice-richieste`, `indice-rovesciamenti`), rosse anche su master.
- Prove sulle schermate **129/132**. Le tre rosse sono i tempi scaduti già
  noti (`rotte-chiuse` «da /cassa», `varco-pubblico` ×2), gli stessi del
  codice di master. `prima-nota-tasca` da sola: **7/7**.
- Simulazione locale, mai pubblicata: fuse in ordine su master le PR
  #72–#81, con questa versione della #79. Nessun conflitto, e il risultato
  non entra in conflitto con nessuna delle PR #57–#71.
- **Controlli su GitHub non lanciati per questa versione**: il commit porta
  `[skip ci]`, perché il mandato del 12/09 esclude il progetto di prova e un
  push normale fa partire da solo anche quel controllo. Partiranno quando
  Alessio li autorizza.

## Cosa NON è verificato

- Non misurato a schermo: «(facoltativa)» e «(facoltativo)» hanno la stessa
  lunghezza. Rispetto a «(opz.)» sono sette caratteri in più, quasi sempre in
  un segnaposto.

## Cosa abbiamo rovesciato

Niente. La prima stesura di questo stesso riepilogo scriveva la regola
contraria (il segno unico): corretta qui, prima di qualunque unione.

---

**Hash di HEAD dichiarato**: `c24b21b` sul ramo `vocabolario-facoltativo`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
