# Copia di sicurezza dei dati — guida operativa

**A chi serve**: ad Alessio. Ogni passaggio è scritto per essere eseguito
senza sapere niente di programmazione. Documento del 11/08/2026.

---

## 0. Perché esiste questo documento

Il piano gratuito di Supabase **non fa nessuna copia automatica dei dati**
(lo dice la loro documentazione: i backup giornalieri partono dal piano a
pagamento). Finché si resta sul piano gratuito, l'unica copia dei dati del
locale è quella che facciamo noi.

Cosa c'è dentro quel database: prenotazioni e clienti, prima nota e
incassi, fatture fornitori, magazzino, registrazioni HACCP, personale e
buste paga, documenti dell'archivio. Perderlo non è un fastidio tecnico:
è la contabilità e gli obblighi di legge del locale.

Con questa guida la copia si fa con **un comando**, e — cosa che conta di
più — si **verifica** che quella copia sia davvero capace di rimettere in
piedi tutto (paragrafo 5).

---

## 1. Una volta sola: installare gli strumenti (10 minuti)

Servono tre programmini di PostgreSQL (`pg_dump`, `psql`) che sanno
parlare col database. Si installano una volta e non si toccano più.

1. Apri **https://www.postgresql.org/download/windows/** e clicca
   **Download the installer**.
2. Nella tabella che si apre, cerca la riga della **versione 17** e clicca
   l'icona di **Windows x86-64**. Parte un file da circa 350 MB.
3. Apri il file scaricato. Windows chiederà il permesso: **Sì**.
4. Clicca **Next** finché arrivi alla schermata **Select Components**.
   Qui **togli la spunta a tutto tranne "Command Line Tools"**.
   *(Non ci serve un database sul tuo computer: solo gli attrezzi.)*
5. **Next** fino a **Finish**. Non chiede password perché non stiamo
   installando nessun server.

Per controllare che sia andata bene: apri il progetto e lancia
`npm run backup`. Se ti risponde che non trova gli strumenti, rifai il
punto 4 (probabilmente "Command Line Tools" era rimasto senza spunta).

---

## 2. Una volta sola: le chiavi

Serve un file di chiavi che vive **solo sul tuo computer**. Nel progetto
c'è il modello: si chiama `.env.db.example`.

1. Nella cartella del progetto, fai una copia di `.env.db.example` e
   rinominala **`.env.db`** (senza `.example`).
2. Apri `.env.db` col Blocco note e riempi le righe così:

**`DB_URL_PRODUZIONE`** — è l'indirizzo del database vero:
   - vai su **supabase.com** → progetto **borgo58**;
   - in alto clicca **Connect**;
   - scegli la scheda **Session pooler** e copia la riga che comincia con
     `postgresql://`;
   - incollala nel file e **sostituisci `[YOUR-PASSWORD]`** con la
     password del database. Se non la ricordi: **Settings → Database →
     Reset database password**, generane una nuova e conservala nel
     gestore di password. *(Cambiarla non spegne niente: l'app non usa
     quella password.)*

**`SERVICE_ROLE_PRODUZIONE`** — serve a scaricare i documenti caricati:
   - **Settings → API Keys** → riga **`service_role`** → **Reveal** →
     copia e incolla.
   - ⚠️ Questa è la chiave più potente del progetto. Sta solo in questo
     file, che non finisce mai su GitHub.

Le due righe `..._PROVA` si riempiono più avanti, quando crei il progetto
di prova (vedi `AMBIENTE_PROVA.md`). La copia di sicurezza funziona anche
senza.

---

## 3. Fare la copia — il comando di tutti i giorni

```bash
npm run backup
```

Ci mette meno di un minuto. Alla fine trovi sul Desktop una cartella
**`Backup Borgo 58`** con dentro una cartella con la data e l'ora.

Deve dirti, senza errori:

- la forma del database, il contenuto delle tabelle, gli utenti e
  l'archivio (quattro file salvati, tutti con una dimensione diversa da
  zero);
- quante tabelle e quante righe ha copiato;
- quanti documenti ha scaricato.

**Poi c'è un passaggio che il computer non può fare al posto tuo:**
copia quella cartella **fuori dal computer** — su una chiavetta, su un
disco esterno o sul tuo cloud personale. Una copia che vive solo sul PC
non protegge dal guasto del PC.

### Ogni quanto

- **Una volta a settimana** (mettilo in agenda, non affidarlo alla memoria).
- **Sempre prima** di applicare migrazioni o di una consegna grossa.
- **Sempre prima** di mettere mano a qualcosa di importante da soli.

---

## 4. Cosa la copia NON contiene

Da sapere prima che serva, non dopo:

| Cosa | Dove sta al sicuro |
|---|---|
| Le parole d'ordine del Vault (notifiche Telegram) | Vanno rifatte dopo un ripristino, con lo script di preparazione. Sono cifrate con una chiave di Supabase: copiarle non servirebbe a niente. |
| Il token del bot Telegram | Nei Secrets della funzione online. **Conservane una copia nel gestore di password.** |
| Il codice dell'app e le migrazioni | Su GitHub. |
| La configurazione del sito (Cloudflare) | Nel pannello Cloudflare, ricostruibile in 5 minuti da `CLAUDE.md` §11. |

---

## 5. Verificare che la copia funzioni davvero

Un backup mai ripristinato è una speranza, non una copia. Per questo
esiste il progetto di prova: si ripristina lì, e si contano le righe.

```bash
npm run prova:ripristina
```

Prende l'ultima copia fatta, la rimette in piedi **sul progetto di
prova** (mai su quello vero: il comando si ferma da solo se qualcuno
sbaglia indirizzo) e confronta riga per riga il prima e il dopo. Se anche
una sola tabella non torna, te lo dice e si ferma.

Da fare **almeno una volta ogni cambio importante** — e la prima volta
subito, perché è quella che dimostra che il sistema funziona.

⚠️ Dopo un ripristino il progetto di prova contiene i **dati veri**, nomi e
telefoni dei clienti compresi. Rimettilo a posto subito dopo con
`npm run prova:ricostruisci -- --azzera`.

---

## 6. Se un giorno il database vero sparisse

Ordine delle cose da fare — nessuna di queste va improvvisata quel giorno:

1. Creare un nuovo progetto Supabase (regione **EU — Irlanda**).
2. Creare gli utenti dell'app dal pannello (Authentication → Users).
3. Ripristinare la copia più recente: gli stessi passi del paragrafo 5,
   con l'indirizzo del progetto nuovo al posto di quello di prova.
4. Rimettere i valori del Vault e i Secrets della funzione delle notifiche
   (`supabase/diagnostica/20260809_firma_notifiche_setup.sql`).
5. Cambiare l'indirizzo del database in due punti: il file `.env.local`
   del computer e le variabili del sito su Cloudflare.
6. Ricaricare i documenti dell'archivio dalla cartella `file/` della copia.

Con la copia in mano è mezza giornata di lavoro. Senza, non è recuperabile.
