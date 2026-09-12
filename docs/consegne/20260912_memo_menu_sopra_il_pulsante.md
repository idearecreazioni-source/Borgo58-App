# MEMO voce: il menu sta sopra «Premi e parla», e a microfono acceso chiede — 12/09/2026 (mandato notturno, blocco C)

Sola interfaccia. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: né letto né scritto. **Dipende dalla #58** (`memo-affidabile`,
`23ca405`) e non la modifica. **HEAD dichiarato**: `e604aae`, il commit sotto
questo riepilogo.

---

## Il difetto, misurato

Sul codice della #58, MEMO voce col microfono acceso (finto) e il menu del
telefono aperto, voce per voce: il dito al centro della voce tocca lei o altro?

| forma | voci coperte da «Ferma e manda» |
|---|---|
| iPhone 390 | 2 (Archivio Documenti, Esci) |
| iPhone 440 | 1 (Esci) |
| iPhone 390 a 64 punti per cm | 3 (Editor Menu Cartaceo, Archivio Documenti, Esci) |

La causa: il pannello del menu era `z-40` come la barra fissa del pulsante
(`BarraDelPollice`), che viene dopo nella pagina e quindi vince.

E un secondo difetto, trovato provando il punto 4 del mandato: toccare una voce
del menu a microfono acceso **cambiava pagina**, MEMO si chiudeva e quello che
si era detto spariva senza nessun avviso (misurato: pagina «/agenda», microfono
spento, niente mandato).

## Cosa cambia

1. `Layout.jsx`: il pannello del menu del telefono passa a `z-50`.
2. `src/lib/registrazioneInCorso.js` (nuovo): MEMO dice «sto registrando» e
   come lasciar perdere, cioè spegnere **senza mandare**.
3. `Detta.jsx`: segna la registrazione finché il microfono è acceso.
4. `Layout.jsx`: a microfono acceso un tocco su una voce del menu o su «Esci»
   (telefono e computer) si ferma e chiede, in cima al menu: **«Continua a
   registrare»** (chiude il menu, microfono acceso) o **«Lascia perdere e
   vai»** (spegne senza mandare, poi va o esce). A microfono spento il menu
   funziona come prima. Il «← Annulla» dentro MEMO non passa dal menu e resta
   com'era.
5. `Sidebar.jsx`: una proprietà `sopra` per l'avviso sotto il logo;
   `data-esci` su «Esci».

## Come è stato verificato

- `tests/schermate/memo-menu-sopra.test.jsx`, 7 casi: **5 rossi sul codice
  della #58 per il comportamento**, 2 verdi che non devono cambiare; tutti
  verdi dopo. `memo-lanciatore.test.jsx` (#58) verde.
- Prove sulle schermate 166, prove pure 1333 (2 rosse già rosse sul ramo di
  partenza: gli indici), lint zero, compilazione riuscita.
- ⚠️ Due file di prova (`rotte-chiuse`, `varco-pubblico`) cadono per tempo
  scaduto quando il computer è carico: da soli, qui, 12 su 12 verdi; **sul
  codice della #58 senza modifiche, da soli, le stesse 3 prove falliscono**.
  Non è questo lavoro.
- **Prova visiva senza nessun server**, microfono finto che resta acceso, sul
  codice della #58 («prima», in una copia temporanea già tolta) e su questo
  («dopo»), a iPhone 390, 440, 390 a 64 punti per cm e computer 1280. Dopo:
  **19 voci su 19 toccabili** in tutte e tre le forme del telefono, la barra
  sotto il menu; tocco su «Agenda» → chiede, pagina e microfono invariati;
  «Continua» → menu chiuso, «Ferma e manda» toccabile, microfono acceso;
  «Lascia perdere e vai» → Agenda, microfono spento.

## Cosa NON è verificato

- Safari e il microfono veri: il riconoscimento della voce è finto nelle
  prove, e la prova visiva è Chrome.
- **Stessa famiglia, fuori dal mandato e non toccata**: in testata, il logo che
  riporta alla Dashboard porta via da MEMO anche a microfono acceso, senza
  chiedere. Non passa dal menu.

## Cosa abbiamo rovesciato

Nessun rovesciamento in questo giro.
