# Quali dati di persone tratta il gestionale, e dove stanno

**A cosa serve**: a scrivere l'informativa privacy con dati veri invece che
a memoria, e a rispondere in un pomeriggio se un cliente o un dipendente
chiede *«cosa avete di mio?»* o *«cancellatemi»*.

**Come è stato compilato**: interrogando lo schema reale del database
(10/08/2026), non ricordando. Va rifatto così ogni volta che si aggiunge un
modulo che raccoglie dati di persone.

---

## 1. Clienti — chi chiede un tavolo

| Dove | Cosa c'è | Chi lo vede |
|---|---|---|
| `reservations` | nome, telefono, email, numero di persone, data e ora, **note libere**, momento del consenso (`privacy_consent_at`) | titolare e staff (serve in sala) |
| `customers` | nome, telefono, email, note — la rubrica, creata **da sola** alla prima richiesta con un telefono | titolare e staff; i dati economici del cliente solo il titolare |

⚠️ **Le note libere sono il punto delicato.** Il modulo pubblico invita a
scrivere allergie: un'allergia è un dato sulla salute, la categoria che il
GDPR protegge di più. Non serve smettere di chiederla — serve saperlo, dirlo
nell'informativa, e non farne mai un uso diverso dall'accoglienza in sala.

**Per quanto restano**: richieste **rifiutate o annullate** → cancellate
automaticamente dopo **6 mesi** (valore in `service_settings`,
`mesi_conservazione_richieste`; lo cambia Alessio, non serve un programmatore).
Insieme sparisce il contatto in rubrica, ma **solo** se non gli resta
nessun'altra prenotazione né sconto/omaggio. Le prenotazioni **confermate**
restano: sono la storia del locale. Ogni pulizia lascia una riga in
`privacy_pulizie` (quante righe e quando, mai quali).

---

## 2. Dipendenti — il gruppo di dati più delicato del sistema

| Dove | Cosa c'è |
|---|---|
| `employees` | nome, cognome, ruolo, tipo di contratto, date di assunzione e fine, telefono, email, **reddito dell'anno precedente**, note |
| `payslips` | buste paga: mese, lordo, netto, riferimento del documento, note |
| `employee_documents` | documenti e loro scadenze (tipo, descrizione, riferimento) |
| `employee_leaves` | ferie, permessi, malattia: tipo, periodo, giorni, note |

**Chi li vede**: solo il titolare. È la barriera più importante del sistema
— era anche il primo difetto vero trovato (08/08/2026: i promemoria
dell'Agenda mostravano allo staff nomi e documenti dei colleghi).

**Per quanto**: nessuna cancellazione automatica, ed è voluto — sono
documenti di lavoro con obblighi di conservazione fiscali e contributivi.
Il termine giusto lo dice il consulente del lavoro, non il programma.

---

## 3. Fornitori e altre persone che compaiono

| Dove | Cosa c'è |
|---|---|
| `suppliers` | ragione sociale, **persona di contatto**, telefono, email |
| `foraged_items` | `forager_name`: chi ha raccolto (serve alla tracciabilità HACCP) |
| `documents` | l'archivio: titolo, controparti, file caricati — il contenuto dei file può contenere qualsiasi dato personale (contratti, buste paga, fatture) |
| `auth.users` (Supabase) | gli account di chi entra nel gestionale: indirizzo email e password cifrata |

---

## 4. Il registro delle cancellazioni — da non dimenticare

`deleted_records` conserva una **copia completa** di ogni riga cancellata
dalle 12 tabelle sorvegliate (soldi, fisco, lavoro, documenti). Quindi
contiene dati personali anche dopo che sono stati cancellati altrove, ed è
leggibile **solo dal titolare**.

Unica eccezione, voluta: la pulizia automatica delle richieste scadute
(§1) scrive nel registro una riga **senza** nome, telefono, email e note.
Il motivo è ovvio una volta detto: cancellare per privacy e depositarne la
fotocopia integrale nel registro significa non aver cancellato niente.

---

## 5. Dove NON ci sono dati di persone

Ricettario, magazzino, HACCP (temperature e pulizie), menù, comande e prima
nota trattano cose, non persone. I nomi che ci si trovano sono di piatti,
attrezzature, ingredienti e tavoli.

---

## 6. Se qualcuno chiede la cancellazione

1. Cercare il telefono o l'email in **Calendario Eventi → prenotazioni** e in
   **Anagrafica Clienti**.
2. Cancellare le richieste non confermate e la scheda cliente.
3. Se la persona è venuta davvero e ci sono prenotazioni confermate o
   documenti fiscali collegati, quelli non si cancellano: si spiega perché
   (obbligo di conservazione), e si cancella il resto.
4. Rispondere entro un mese, come dice l'informativa.

*Da rifare a ogni modulo nuovo che raccoglie dati di persone. Un elenco che
descrive il sistema di sei mesi fa è peggio di nessun elenco: dà sicurezza
senza darne il motivo.*
