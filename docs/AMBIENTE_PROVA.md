# Il database di prova — guida operativa

**A chi serve**: ad Alessio. Documento del 10/08/2026.

---

## 0. Perché serve un secondo database

Oggi c'è un database solo, ed è quello del locale. Vuol dire due cose:

- le **prove automatiche** (`npm run test:app`) scrivono e cancellano nel
  database vero. Finora sono state pulite perché scritte con attenzione —
  cioè per disciplina, non per costruzione;
- ogni **migrazione** viene provata per la prima volta direttamente in
  produzione. Se fa un danno, lo fa sui dati veri.

Il progetto di prova è la rete sotto il filo: un secondo database, vuoto,
ricostruibile da zero in pochi minuti, dove si può anche rompere tutto.

**Costa zero**: il piano gratuito di Supabase permette **2 progetti
attivi** per organizzazione. Attenzione a una cosa sola: un progetto
gratuito **va in pausa dopo una settimana** che non lo si usa — se un
giorno le prove non partono, è probabile che vada semplicemente riavviato
dal pannello.

---

## 1. Creare il progetto (una volta sola)

1. Vai su **supabase.com**, entra nel tuo account e clicca **New project**.
2. Nome: **`Borgo58-Prova`**.
3. **Database Password**: clicca *Generate a password*, poi **copiala
   subito nel tuo gestore di password**. Serve ai comandi di prova.
4. **Region**: la stessa del progetto vero — **EU (Ireland)**.
5. Plan: **Free**. Clicca **Create new project** e aspetta qualche minuto.

---

## 2. Creare i quattro utenti

Il database di prova deve avere le stesse persone del vero, altrimenti le
migrazioni non possono verificarsi: molte si controllano da sole
impersonando un titolare e un membro dello staff.

Nel progetto **Borgo58-Prova**: **Authentication → Users → Add user →
Create new user**, quattro volte, con questi indirizzi:

| Indirizzo | A cosa serve |
|---|---|
| `alessio@borgo58.app` | il titolare |
| `staff@borgo58.app` | lo staff |
| `test-titolare@borgo58.app` | il titolare delle prove automatiche |
| `test-staff@borgo58.app` | lo staff delle prove automatiche |

Le password le scegli tu e **non devono essere quelle vere**: questo è un
database usa-e-getta. Quelle dei due utenti `test-` vanno scritte nel file
`.env.test` (punto 3).

Spunta **Auto Confirm User** su tutti e quattro.

---

## 3. Completare i due file di chiavi

Nel file **`.env.db`** (quello di `docs/BACKUP.md`, punto 2) riempi le due
righe rimaste:

- **`DB_URL_PROVA`** — nel progetto di prova: **Connect → Session pooler**,
  copia la riga `postgresql://...` e sostituisci `[YOUR-PASSWORD]` con la
  password del punto 1.
- **`PROVA_ANON_KEY`** — **Settings → API Keys** → la chiave **`anon`**.

Poi fai una copia di `.env.test.example` chiamata **`.env.test`** e
riempila con: l'indirizzo del progetto di prova (**Settings → Data API →
Project URL**), la stessa chiave `anon`, e le password dei due utenti
`test-`.

---

## 4. Ricostruire il database da zero

```bash
npm run prova:ricostruisci
```

Il comando applica, in ordine di data, **tutte le migrazioni del
progetto** — le stesse 49 che hanno costruito il database vero. Ci mette
qualche minuto e stampa una riga per migrazione.

Se una si ferma, il comando si ferma con lei, scrive un file
`ricostruzione_<data>.log` nella cartella del progetto e te lo dice:
**manda quel file a Claude Code così com'è**. Non è un guasto del tuo
computer: vuol dire che quella migrazione dava per scontato qualcosa che
esisteva solo nel database vero, ed è esattamente la cosa che questo
esercizio serve a scoprire.

Alla fine deve dire quante tabelle ha creato, quante migrazioni ha
registrato e quanti ruoli ha assegnato.

Per rifarlo da capo su un progetto non più vuoto:
`npm run prova:ricostruisci -- --azzera` (svuota e ricomincia).

---

## 5. Da adesso in poi: due regole

1. **Le prove automatiche girano qui.** `npm run test:app` usa
   `.env.test`, che punta al progetto di prova. Se qualcuno ci rimettesse
   l'indirizzo del database vero, le prove **si rifiutano di partire**: il
   controllo è dentro il codice, non affidato alla memoria.
2. **Ogni migrazione si applica prima qui, poi in produzione.** Prima si
   incolla nell'SQL Editor del progetto di prova; se arriva in fondo senza
   errori, si incolla in quello vero. La rete di sicurezza serve solo se
   la si usa nell'ordine giusto.

---

## 6. Cosa il progetto di prova NON riproduce

Onesto elenco, per non dare per verificato ciò che non lo è:

- **Le funzioni online (Edge Function) non sono installate qui**, e finché
  restano fuori **tre prove automatiche non girano**: quelle sul corridoio,
  la strada obbligata di ogni operazione che tocca più tabelle insieme. Non
  vengono nascoste: `npm run test:app` le salta e una riga resta **rossa**
  apposta, così nessuno dimentica che quella parte non è coperta.
  Come chiudere il buco, dal pannello del progetto di prova:
  1. **Edge Functions → Deploy a new function → Via Editor**;
  2. nome esatto: `operazioni-atomiche`;
  3. incolla il contenuto di `supabase/functions/operazioni-atomiche/index.ts`
     e premi **Deploy**. Non servono chiavi: usa quelle che Supabase dà da sé.
- Le notifiche Telegram partite per sbaglio dal progetto di prova finiscono
  contro la funzione vera e vengono **respinte**: la parola d'ordine del
  progetto di prova è generata diversa apposta. Nessuna notifica di prova
  arriva sul telefono.
- **L'archivio documenti nasce vuoto**: i file caricati vivono fuori dal
  database e si recuperano solo da una copia di sicurezza.
- **I dati del locale non ci sono** (orari, tavoli, menù): le migrazioni
  creano le tabelle, non i tuoi numeri. Se una prova ha bisogno di orari,
  se li crea da sola e li ripulisce.
