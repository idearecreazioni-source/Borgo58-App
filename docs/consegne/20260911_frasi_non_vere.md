# Quattro frasi che non erano più vere — 11/09/2026 (mandato notturno 2, fase 2)

Solo testo. **Migrazioni**: nessuna. **Funzioni online**: nessuna.
**Database**: non toccato. **Logica**: non toccata. **HEAD dichiarato**: vedi
l'ultima riga.

Trovate dal censimento dei testi del mandato notturno 2 e **verificate sul
codice di master**. Si toglie o si raddrizza soltanto la parte falsa: il resto
di ogni frase, e la sua posizione, non cambiano.

---

## Cosa cambia

| schermata | prima | adesso | perché era falsa |
|---|---|---|---|
| Ricettario, card «Menu» (`RicettarioHome.jsx`) | «Struttura 4-4-4-2, prezzi di vendita, margini, simulatore what-if.» | «Prezzi di vendita, margini, simulatore what-if.» | la struttura 4-4-4-2 è stata tolta dal menu (commento in `MenuDetail.jsx`, «Struttura 4-4-4-2 TOLTA») |
| Proiezione fiscale, card «Le previsioni» (`ProiezioneFiscaleHome.jsx`) | «Il tuo piano caricato dal foglio, chiuso e non più ritoccabile. Le riproiezioni si confrontano con la prima.» | «Il tuo piano, scritto a mano o caricato dal foglio. Una volta chiuso non si ritocca più: le riproiezioni si confrontano con la prima.» | dal 15/08 una previsione si scrive anche a mano (`/fiscale/previsioni/nuova`) e resta modificabile finché non si chiude |
| Lista della spesa, «non l'ho preso» (`ListaSpesa.jsx`) | «…se invece te l'hanno regalata, scegli «Avuta gratis».» | «…scegli «Me l'hanno regalato».» | il pulsante si chiama «Me l'hanno regalato» (`ESITI`, riga 57); «Avuta gratis» non esiste |
| Previsione, personale (`PrevisioneForm.jsx`) | «…l'altro lo calcola il gestionale con le ore qui sotto…» | «…con le ore qui sopra…» | `ListaModificabile` disegna `extra` (la casella delle ore) **prima** di `sotto2` (questa frase) |

## Come è stato verificato

- Lint pulito, compilazione riuscita.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, già
  note su master.
- Prove sulle schermate **129/132**: le tre rosse sono quelle già note su
  master (`rotte-chiuse` ×1 e `varco-pubblico` ×2, tempo scaduto).
- **Fusione di prova** con #57, #58, #59, #60, #61, #62, #63 e #64: nessun
  conflitto.
- ⚠️ **Trovato rileggendo prima di provare**: i commenti che spiegano le
  correzioni erano finiti in mezzo a due frasi. In JSX un a capo prima di
  un'espressione non diventa uno spazio: sarebbe uscito «scegli«Me l'hanno
  regalato»» e «lo calcola ilgestionale». Spostati fuori dal testo prima del
  commit.
- **Censimento dopo la correzione**, sul progetto di prova: `/ricettario` e
  `/fiscale` a iPhone 390, 440, caratteri grandi e computer si aprono senza
  niente che sbordi o si sovrapponga, senza nessuna scrittura. **Fotografie
  guardate** (390): la card «Le previsioni» dice «Il tuo piano, scritto a mano
  o caricato dal foglio. Una volta chiuso non si ritocca più: le
  riproiezioni si confrontano con la prima.», la card «Menu» dice «Prezzi di
  vendita, margini, simulatore what-if.».

## Cosa NON è verificato

- Le frasi della Lista della spesa e della previsione compaiono dopo un gesto
  (la chiusura di una riga, il modulo di una previsione): non sono state
  aperte nel browser. La loro forma è quella di prima, con una parola
  diversa.
- Non visto su un iPhone vero.

## Cosa abbiamo rovesciato

Niente: si correggono frasi rimaste indietro rispetto a decisioni già prese.

---

**Hash di HEAD dichiarato**: `6b994a0` sul ramo `frasi-non-vere`, cioè il
commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito.
