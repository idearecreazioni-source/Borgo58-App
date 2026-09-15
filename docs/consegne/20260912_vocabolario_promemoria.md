# Vocabolario, riga 5: «promemoria» solo per l'avviso a un'ora — 12/09/2026

Scelta di Alessio del 12/09 sulla tabella della PR #71. **Solo testo a
schermo**, nessuna logica. **Migrazioni**: nessuna. **Funzioni online**:
nessuna. **HEAD dichiarato**: vedi l'ultima riga.

## La regola

- **«promemoria»** è solo l'avviso Telegram a un'ora di un impegno (scheda
  impegno: «Promemoria Telegram», «Rimuovi promemoria», «Promemoria già
  inviato il …»). Resta com'è.
- **«impegno in Agenda»** è quello che nasce da solo da una scadenza.
- **«promemoria» nel senso di «traccia da ricordare»** si riscrive.

## Cosa cambia — nove frasi in sette file

| File | Prima | Adesso |
|---|---|---|
| `documenti/DocumentoDetail.jsx:241` | «Promemoria di scadenza attivo in Agenda per il …» | «Impegno in Agenda attivo per la scadenza del …» |
| `documenti/ArchivioDocumentiHome.jsx:264` (il «?» del titolo) | «generano da soli un promemoria in Agenda» | «… un impegno in Agenda» |
| `fatture/FattureFornitoriHome.jsx:721` | «viene creato automaticamente un promemoria in Agenda» | «… un impegno in Agenda» |
| `fatture/FattureFornitoriHome.jsx:1183` | «la fattura torna fra quelle da pagare e il promemoria si riapre» | «… e l'impegno in Agenda si riapre» |
| `fiscale/CatalogoStrumenti.jsx:121` (il «?») | «crea da sé un promemoria in Agenda» | «… un impegno in Agenda» |
| `personale/DipendenteDetail.jsx:338` (cosa sparisce togliendo) | «e il suo promemoria in Agenda» | «e il suo impegno in Agenda» |
| `personale/DipendenteDetail.jsx:362` | «viene creato un promemoria in Agenda» | «… un impegno in Agenda» |
| `cassa/SezionePersonale.jsx:232-233` | «resta un promemoria; quello che sopravvive al mese diventa formale» | «resta una nota; …» |
| `fiscale/PrevisioneForm.jsx:478` | «Le voci qui sotto sono un promemoria:» | «… sono un elenco per non dimenticarne nessuna:» |

Non cambiano:
- i nomi tecnici (il tipo `promemoria` delle azioni di posta e di MEMO);
- l'elenco di parole con cui MEMO riconosce una domanda sull'Agenda;
- i commenti.

## ⚠️ Rimandati

- **Archivio documenti, riga 437** («Con una scadenza, viene creato un
  promemoria in Agenda»). È la stessa riga che la PR del vocabolario 10
  (#79) cambia in «Il file è facoltativo». Cambiarla qui creerebbe un
  conflitto fra le due PR: va fatta dopo l'unione della #79.
- **«resta qui come promemoria»** in `AppuntoDaApprovare.jsx`: file della
  #58.

## Come è stato verificato

- Sostituzioni contate: ogni frase trovata esattamente una volta. Una riga
  (Sezione personale) va a capo nel file e l'ho presa in due pezzi.
- `oxlint` pulito sui sette file.
- Prove pure **1295/1297**: le due rosse sono i fine riga di Windows, rosse
  anche su master. Nessuna prova in `tests/` cita queste frasi.
- `git merge-tree` con i rami di #57–#79 e con gli altri rami del
  vocabolario: nessun conflitto. Cinque dei sette file li tocca anche una
  PR aperta, in altre righe: `FattureFornitoriHome.jsx`,
  `CatalogoStrumenti.jsx`, `ArchivioDocumentiHome.jsx`,
  `SezionePersonale.jsx` e `DipendenteDetail.jsx` la #57, `PrevisioneForm.jsx`
  la #65.

## Cosa NON è verificato

- Non misurato a schermo: solo testo, di lunghezza simile.

## Cosa abbiamo rovesciato

Niente.

---

**Hash di HEAD dichiarato**: `4ddf9b4` sul ramo `vocabolario-promemoria`,
cioè il commit immediatamente sotto questo documento.
**Stato del working tree al momento della consegna**: pulito (la cartella
della prova visiva locale è esclusa da git e non è committata).
