# Vocabolario, riga 7: «la commercialista» — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## Perché

Il ruolo resta vero anche se un giorno cambia la persona, e alcune schermate
le può vedere qualcun altro. Deducibilità e Deduzioni avevano le due parole
sulla stessa schermata.

## Cosa cambia — nove frasi in sei file

| File | Prima | Adesso |
|---|---|---|
| `agenda/StampaAdempimenti.jsx` | «da portare a Laura o da tenere appeso» | «da portare alla commercialista …» |
| `fiscale/Deducibilita.jsx` | «(domande L4 e L9 per Laura)» | «(… per la commercialista)» |
| `fiscale/SimulatoreFiscale.jsx` | «I numeri veri li determina Laura» | «… la commercialista» |
| `fiscale/SimulatoreFiscale.jsx` | «Accendila dopo Laura.» | «Accendila dopo il parere della commercialista.» |
| `fiscale/SimulatoreFiscale.jsx` | «Confermati da Laura il» | «Confermati dalla commercialista il» |
| `agricolo/Cessioni.jsx` | «Da validare con Laura» | «… con la commercialista» |
| `cassa/ScontiOmaggi.jsx` | «da verificare con Laura» | «… con la commercialista» |
| `cassa/ScontiOmaggi.jsx` | «quello che serve a Laura per l'autofattura» | «… alla commercialista …» |
| `fiscale/DeduzioniFiscali.jsx` | «sempre da validare con Laura.» | «… con la commercialista.» |

Non cambiano:
- i nomi tecnici (`parametri_confermati_da_laura`,
  `parametriConfermatiDaLaura`);
- i commenti nel codice;
- le frasi scritte dal database (non si toccano migrazioni).

## Come è stato verificato

- Sostituzioni contate: ogni frase trovata esattamente una volta.
- Dopo: «Laura» compare in `src` solo nei due nomi tecnici e nei commenti.
- `oxlint` pulito sui sei file.
- `git merge-tree` con i rami di #57–#73 e con `vocabolario-scorta-minima`:
  nessun conflitto. `Cessioni.jsx`, `ScontiOmaggi.jsx` e `DeduzioniFiscali.jsx`
  li tocca anche la #57, in altre righe.
- Nessuna prova sulle schermate cita queste frasi.

## Cosa NON è verificato

- Non misurato a schermo. È solo testo: una frase si allunga di qualche
  parola («Accendila dopo il parere della commercialista.»).

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `f96fd2a` sul ramo `vocabolario-commercialista`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
