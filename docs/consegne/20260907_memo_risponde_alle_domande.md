# MEMO consultivo, fase 1 — MEMO risponde alle domande

**07/09/2026.** Riepilogo di consegna.

* **HEAD dichiarato**: `bb16932` — il commit che sta sotto questo file.
* **Ramo**: `memo-consultivo-fase-1`, aperto da `798d41a` (master). Proposta #35.
* **Migrazioni**: **nessuna.** Nessuna tabella, nessun permesso, nessuna
  funzione del database toccata. L'unica funzione online cambiata è
  `ascolta-voce`.
* **Prove**: 1.033 pure · 42 sulle schermate · 497 contro il progetto di
  prova · lint pulito · compilazione pulita.
  ⚠️ **Due prove pure restano rosse, e sono PREESISTENTI su `master`**
  (`indice-richieste`, `indice-rovesciamenti`): misurato mettendo da parte
  questo lavoro con `git stash -u` — falliscono uguale. Fuori perimetro, non
  toccate. Si rigenerano con `npm run richieste` e `npm run indice`.
* **Copia di lavoro**: un albero separato (`Desktop\Borgo58-App-memo`). I
  documenti locali non salvati di Alessio — `docs/DECISIONI.md` e
  `docs/specifiche/` — vivono nell'altra copia e non sono stati toccati.

## Cosa abbiamo rovesciato

**Niente.** Le due cose che cambiano nel modulo voce sono aggiunte: prima
MEMO capiva solo comandi, adesso una frase può essere anche una domanda. Il
comportamento sui comandi non cambia in niente.

## Le decisioni che non si leggono dal codice

1. **Il modello capisce, il database risponde.** Dal modello escono tre cose
   sole — area, quale domanda, di che cosa. Il numero lo legge il gestionale
   col permesso di chi guarda. Un numero detto dal modello sarebbe
   plausibile e non controllabile.
2. **Le letture stanno nel browser, non nella funzione online**, che gira
   con la chiave di servizio dove la RLS non c'è: leggere lì sarebbe
   consegnare dati scavalcando il permesso.
3. **Il comando vince sulla domanda, per costruzione.** Una domanda presa
   per comando si butta in un tocco; un comando preso per domanda si perde.
4. **Una domanda registra la dettatura con la filza vuota** — zero appunti —
   ma la registra: è il conto di ciò che è costato, e senza il tetto di
   spesa del mese si potrebbe superare facendo domande.
5. **Sugli allergeni il «no» non si dà** se di qualche ingrediente non li ha
   guardati nessuno: si dice «non te lo so dire», coi nomi degli scoperti.
6. **Si sceglie per identificativo, mai per somiglianza del nome**: «olio»
   non diventa «Olio» perché il nome combacia.
7. **Gli elenchi si tagliano a sei righe dichiarandolo**, e il conteggio
   nella frase resta quello vero — tranne l'elenco delle nove domande, che
   non si taglia perché non è un elenco di dati e non c'è un «tutte» da
   nessuna parte.

## Cosa NON è verificato

1. **Nessun occhio ha guardato una schermata vera.** Le prove sulle
   schermate dicono cosa c'è scritto, non come si legge in cella.
2. **Il modello non è una garanzia.** Le prove sorvegliano la regola; le 19
   frasi del collaudo sono un campione, non una misura.
3. **La lettura che fallisce non è stata provocata dal vivo**: è provata
   sulla regola, dove si può costruire.
4. **La sala non può fare nessuna domanda**, ed è un fatto misurato e
   preesistente: `registra_dettatura` pretende `is_titolare()` e `/detta` è
   chiusa allo staff. Quello che la prova dimostra è che, se un giorno ci
   arrivasse, l'Agenda non le consegnerebbe quello che non deve vedere.
