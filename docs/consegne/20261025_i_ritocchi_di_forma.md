# I ritocchi di forma — 25/10/2026

**HEAD dichiarato sotto questo riepilogo:** `98180b1` («Agenda: torna «task»…»), sopra `2781fe2` (prova visiva), `81a0b24` (voci 20-21), `264c77e` (voce 19) e `e3f15ae` (voci 1-18), su `origin/master` `5216686` (dopo l'unione dell'interfaccia, #200/#206). Working tree pulito al momento della scrittura. **Nessuna migrazione, nessuna funzione online, nessun dato toccato.**

## Origine
Controllo visivo completo del gestionale sul progetto di prova (artifact «Ritocchi del gestionale»), 18 difetti numerati. Alessio: «1 tutti» → si applicano tutti e 18.

## Cosa cambia (27 file, +161 −69)
Numerazione dell'artifact «Ritocchi del gestionale».

1. **Via «Media» da ogni impegno** — in Dashboard il bollino compare solo su priorità `alta` e si chiama «Urgente»; categoria nascosta se `altro`. `src/pages/Dashboard.jsx`
2. **«Agenda completa →» accanto agli impegni** — spostato accanto al titolo «Impegni di oggi». `src/pages/Dashboard.jsx`
3. **Gli orari** — servizio spento: casella + nome + «chiuso»; acceso: campi in griglia 2/4 colonne con l'etichetta sopra. `calendario/SalaEOrari.jsx`
4. **«Ce la faccio?»** — elenco a schede sul telefono, tabella da `sm` in su. `cassa/Previsione.jsx`; tolta la voce da `NOTE_LARGHE` in `src/lib/calcoli/larghezza.js` (lo pretende `tests/unita/larghezza.test.js`).
5. **Il pulsante per caricare un file** — verde come le altre azioni. `cassa/MovimentiBanca.jsx`, `fatture/ImportaFatturaElettronica.jsx`, `fiscale/Previsioni.jsx`
6. **Comande / Sala** — sottotitolo «Nessun conto aperto» oppure «N conti aperti · tocca un tavolo». `comande/Sala.jsx`
7. **«Da classificare»** — schede sul telefono, tabella da `sm`. `fiscale/Deducibilita.jsx`
8. **«In che direzione stiamo andando»** — stesso schema. `fiscale/AndamentoMensile.jsx`
9. **Simulatore** — il segno meno solo se c'è credito IVA. `fiscale/SimulatoreFiscale.jsx`
10. **Lista della spesa** — «sotto scorta minima» non va a capo; «Segna acquistato» pulsante verde, «Rimuovi» bordato. `magazzino/ListaSpesa.jsx`
11. **Ordini** — righe senza fornitore: primi 5 nomi + «e altre N», con «Vedi tutte». `magazzino/Ordini.jsx`
12. **Registro temperature** — il pulsante dell'apparecchio è verde finché non è registrato, poi bordato. `haccp/TemperatureLog.jsx`
13. **Ingredienti** — la ricerca su riga propria sul telefono. `ricettario/IngredientiList.jsx`
14. **Piatti** — filtri in colonna, larghezza piena sul telefono. `ricettario/RicetteList.jsx`
15. **Le righe dei vini** — sul telefono due righe per voce, nome intero in cima («Carricante dell'Etna» invece di «Carric»). `menu-editor/BevandeVini.jsx`
16. ~~**Agenda** — «task» → «impegno».~~ **RITIRATA**: il 20/09/2026 Alessio aveva chiesto «task» (rovesciando l'11/09), e `tests/schermate/agenda-dice-task.test.jsx` lo sorveglia — è diventata rossa sulla coda di GitHub. La proposta mostrata ad Alessio non diceva che era una sua scelta: si torna a «task» e glielo si chiede. `agenda/AgendaList.jsx`, `agenda/TaskForm.jsx` invariati rispetto a `master`.
17. **Titoli** — sette uniformati a `font-display text-2xl text-b58-charcoal`, tolto il `p-4` doppio. `assistente/Fotografa.jsx`, `magazzino/Fermi.jsx`, `magazzino/Scadenze.jsx`, `magazzino/SpesaSpicciola.jsx`, `ricettario/AnteprimaDaTesto.jsx`, `ricettario/BozzeList.jsx`, `ricettario/SchedeProdotti.jsx`
18. **Archivio documenti** — metadati uniti con `filter(Boolean).join(" · ")`: niente puntino orfano. `documenti/ArchivioDocumentiHome.jsx`

19. **Prima nota: tolto «Contante in cassa»** (aggiunto dopo, decisione di Alessio del 25/10). Resta «Banca». `cassa/PrimaNota.jsx`. ⚠️ `getCashBalance` si continua a chiamare perché porta anche `saldo_banca`.
20. **Cassa: «Prima nota» come le altre porte** — tolto `principale` dalla `Scorciatoia`: piena di verde sembrava la sezione corrente. `cassa/CassaHome.jsx`
21. **Prima nota: il selezionato è uguale sui quattro pulsanti** — Uscita (era terracotta) ed Entrata (era oliva) ora usano lo stesso stampo di Contante/Banca (`border-b58-charcoal bg-b58-charcoal/5`). `cassa/PrimaNota.jsx`

## Verificato
- `npm run lint`: zero avvisi. `npm run test`: **2280 prove pure verdi** (rilanciate dopo il riallineamento su `5216686`). `npm run build`: riuscita.
- `npm run test:schermate`: **440 prove verdi** (54 file), lanciate in locale dopo che la coda le aveva trovate rosse sulla voce 16.
- `npm run test:visive` verde in locale (Chrome senza schermo). La prova visiva della Dashboard è stata **aggiornata**: cercava il bollino su ogni impegno e «Agenda completa →» accanto al saluto; ora pretende «Urgente» sull'impegno a priorità alta (rotta apposta: rossa su tutte le forme). `scripts/prova-visiva-schermate.mjs`
- Prima nota guardata a 1366 punti sul progetto di prova: in alto a destra solo «Banca: 5.954,32 €»; Uscita ed Entrata selezionate hanno lo stesso aspetto di Contante. ⚠️ La fila delle porte in Cassa **non è stata fotografata** (lo scorrimento della cattura non ci è arrivato): il cambio è la sola rimozione di `principale`.
- Sbordo misurato dal DOM a **390 punti** su Previsione, Deducibilità, Andamento mensile, Bevande e vini, Ricette: **zero**.
- Fotografie prima/dopo a 390 e ~1280 punti, sul progetto di prova (`bnwqgpuyzmzujxfbtyvs`), con scritture e produzione bloccate dallo script di cattura.

## Non verificato
- Nessun telefono vero: le misure sono del browser automatico.
- `npm run test:app` **non lanciato** (le modifiche sono solo di presentazione, ma resta non lanciato); le gira la coda su GitHub.
- Colori e leggibilità con la luce del ristorante: giudizio di Alessio.

## Dato per fatto senza misurarlo
- Nulla di nuovo: nessuna regola o dato toccato.

## Affermazioni diventate false durante il lavoro
- «2280 prove verdi» era vero ma **non bastava**: le prove sulle schermate (`npm run test:schermate`) non erano state lanciate, ed erano quelle che sorvegliano la parola «task».

## A margine: Prima nota −25.721,66 contro Cassa 1.352,49 (prova)
Guardato. **Non è un difetto di calcolo**: `v_cash_balance` conta i soli movimenti di prima nota con `mezzo='cassa'`; `saldo_tesoreria()` aggiunge gli incassi in contanti dei conti chiusi e le mance in contanti. Sul prova: −25.721,66 + 26.874,70 (contanti di 162 conti chiusi) + 199,45 (mance) = 1.352,49. In produzione oggi non ci sono conti chiusi, quindi lo scarto non esiste. L'etichetta «Contante in cassa» in Prima nota faceva credere a un ammanco: Alessio ha deciso di **toglierla** (voce 19). Il contante si legge in Cassa.

## Cosa abbiamo rovesciato
Nessuna decisione rovesciata **nel risultato finale**. La voce 16 ne rovesciava una (il «task» del 20/09) ed è stata ritirata prima dell'unione. La voce 19 toglie un numero ma non tocca la decisione del 31/08 sulla tasca (lì si mostra già il conto, non il saldo). ⚠️ Il bollino «Urgente» solo su priorità alta **non tocca** la priorità calcolata dell'Agenda: cambia solo cosa mostra la Dashboard.
