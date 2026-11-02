# «In ritardo» torna, sempre aperta e sopra «Oggi» — 27/10/2026, sera

Dopo la #253 Alessio ha guardato la Dashboard sul telefono: gli scaduti
mescolati a quelli di oggi, con «scaduto il …» su ogni riga, «rende tutto
confusionario». Ha chiesto di tornare a una sezione a parte, ma **sempre in
evidenza, non da aprire**, e **prima di «Oggi»**: «così leggo prima cosa mi
sono lasciato indietro».

## Cosa cambia

- **Dashboard**: sopra «Impegni di oggi» c'è «In ritardo (N)», con il titolo
  in terracotta. Ogni riga ha solo il titolo e, piccola e grigia a destra, la
  data («30 ago»). Sparisce quando non c'è niente di scaduto.
- **Agenda (Lista)**: torna la sezione «In ritardo», fra «Per me conta» e
  «Questa settimana». **Non si chiude più**, e i quadrotti non dicono più
  «scaduto da N giorni»: c'è la data, come per gli altri.
- **Aspetto**: tolto «Come il telefono», restano Chiaro e Scuro. Chi l'aveva
  scelto si ritrova il tema che il telefono mostrava in quel momento, salvato
  come scelta sua (`public/tema.js`), così niente cambia sotto gli occhi.

## Cosa resta com'era nella #253

- Uno scaduto continua a comparire ogni giorno finché non si spunta: la
  Dashboard legge ancora `due_date <= oggi` (`listDashboardTasks`).
- La scadenza nel database non si sposta; badge e MEMO contano gli scaduti
  come prima.

## Prove

- `tests/schermate/agenda-ritardo-sopra-oggi.test.jsx`: la sezione c'è, è
  aperta, viene prima di «Oggi», nessun «scaduto da».
- `tests/schermate/dashboard-ritardo-sopra-oggi.test.jsx`: lo scaduto sta in
  «In ritardo (1)» sopra «Impegni di oggi», con la data breve; senza scaduti
  la sezione non c'è.
- `tests/unita/agenda-sezioni.test.js`, `tests/unita/tema.test.js`.
