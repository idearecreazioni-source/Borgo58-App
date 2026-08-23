# L'assistente sul gestionale di prova — manca solo la chiave

**23/08/2026, notte.** Tutto pronto: **manca un comando, e lo dai tu.**

---

## Cosa c'è già

Le cinque funzioni che usano l'assistente sono **installate sul progetto di
prova** (prima ce n'erano solo due, e nessuna delle cinque):

| funzione | a cosa serve |
|---|---|
| `assistente-archivio` | «Chiedi all'archivio» — risponde sui documenti |
| `schede-prodotto` | compila le schede dei prodotti nuovi |
| `documento-leggi` | legge il contenuto di un documento archiviato |
| `posta-leggi` | legge la posta in arrivo e propone cosa farne |
| `prova-ai` | la prova che la catena risponde |

E l'archivio del progetto di prova adesso **ha dentro dieci documenti col
loro testo** — contratto di locazione, manuale HACCP, polizza, SCIA, verbale
ASP — quindi l'assistente ha qualcosa di vero su cui rispondere.

---

## Cosa manca: la chiave

Sul progetto di prova la chiave dell'assistente **non c'è**, e non la metto
io: è la tua, e ogni domanda che l'assistente riceve **costa**.

Da una finestra PowerShell normale, dentro la cartella del progetto:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=la-tua-chiave --project-ref bnwqgpuyzmzujxfbtyvs
```

⚠️ **`bnwqgpuyzmzujxfbtyvs` è il progetto di PROVA**, non il locale vero. Sul
locale vero la chiave c'è già dall'11/08 e non va toccata.

---

## Come si vede se funziona

1. apri il gestionale di prova (`npm run dev:prova`);
2. vai su **Archivio documenti → Chiedi all'archivio**;
3. chiedi: *«quanto pago d'affitto e cosa succede dopo il primo anno?»*

Se la chiave è a posto, risponde **2.000 € al mese** e dice che dal secondo
anno il canone si aggiorna del 75% dell'ISTAT — perché quel contratto è
davvero dentro l'archivio di prova, con quel testo.

Se la chiave manca, risponde che non riesce a raggiungere l'assistente: è un
rifiuto chiaro, non un silenzio.

---

## ⚠️ Due cose da sapere

1. **La spesa è la stessa cassa del locale vero**: la chiave è una, e il
   tetto di 10 $/mese vale per tutte e due. Una giornata di collaudo con
   venti domande costa pochi centesimi, ma **è la stessa cassa**.
2. **Sul progetto di prova non arriva posta**: `posta-leggi` è installata, ma
   la casella che legge è quella vera. Le diciotto mail che vedi in *Posta in
   arrivo* sono scritte dallo scenario, non arrivate davvero.
