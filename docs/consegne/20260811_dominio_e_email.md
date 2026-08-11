# Consegna del 11/08/2026 — dominio sul sito ed email di conferma

**Commit della consegna: `bb24c76`** (questo riepilogo è il commit
immediatamente sopra, sola documentazione). Working tree pulito.

| Commit | Cosa | Stato |
|---|---|---|
| `bb24c76` | **richieste da confermare in cima al Calendario** + documenti allineati alla prova riuscita | **non ancora pushato** |
| `f8837d8` | il collaudo della migrazione non manda più notifiche finte su Telegram | **non ancora pushato** |
| `aa518bd` | l'interruttore dell'email in *Sala e orari*, dove lo trova Alessio | già pushato |
| `74f2e27` | il dominio è **agganciato e verificato** | già pushato |
| `855f156` | **email di conferma al cliente**: migrazione `20260811000001`, Edge Function `email-cliente`, record Resend | già pushato |
| `d3b8d78` | `npm run dominio:verifica` + `docs/DOMINIO.md` | già pushato |
| `98526fe` | la casella `info@borgo58.it` nella mappa degli accessi | già pushato |

*(I commit `6e4a9cf` e `3eac056` in mezzo sono versioni precedenti di
questo stesso documento, scritte mentre le verifiche erano ancora in
corso.)*

⚠️ **Scostamento dichiarato dalla regola "nessun push senza riepilogo"**:
`d3b8d78` è stato pushato prima che questo documento esistesse. È colpa
mia — ho chiesto ad Alessio di pubblicare mentre l'operazione sul dominio
era ancora in corso, e il riepilogo si scrive dopo l'ultimo commit della
consegna. Lo copro qui, retroattivamente, insieme al resto.

**Niente da applicare**: la migrazione `20260811000001` è già in
produzione e la funzione `email-cliente` è installata. La migrazione è
stata **corretta e riapplicata** dopo il difetto del §7.

---

## 1. Cosa è successo davvero al dominio

`borgo58.it` è stato spostato dai server DNS di Aruba a quelli di
Cloudflare (`coraline` e `zeus`), **eseguito dal vivo l'11/08** sul
pannello di Alessio, con lui presente e consenziente a ogni passo.

L'operazione ha un solo modo di fare danno, ed è silenzioso: cambiando i
server DNS, **le indicazioni della posta non si spostano da sole**. Se non
vengono ricopiate, `info@borgo58.it` — creata poche ore prima, e già
l'indirizzo pubblico del locale — smette di ricevere lo stesso giorno, e
chi scrive non riceve nessun avviso: l'email sparisce.

**Il difetto trovato prima che facesse danno.** L'importazione automatica
di Cloudflare ha ricopiato tutte e 42 le righe della zona, ma ne ha messe
**33 in modalità "proxied"** — cioè fatte passare per la rete Cloudflare.
Su un sito è il comportamento voluto; sui nomi della posta
(`mail`, `mx`, `pop3`, `smtp`, `webmail`, `imap`) significa che il mondo
riceve gli indirizzi di Cloudflare al posto di quelli dei server di posta
Aruba, e la consegna fallisce. Spente una per una; restano accese solo
`borgo58.it` e `www`, che sono il sito.

Prima di procedere è stato verificato che il dominio **non ha DNSSEC
attivo**: con un DS pubblicato, il cambio di server DNS avrebbe reso il
dominio irraggiungibile del tutto, sito e posta insieme.

**Verifica dopo il passaggio**: il cambio è visibile dai risolutori
pubblici, e la posta risponde correttamente da entrambi (7 server di
consegna, SPF, DMARC, webmail/smtp/imap). Prova sul campo: Alessio ha
mandato un'email a `info@borgo58.it` **dopo** il passaggio ed è arrivata.

---

## 2. Perché esiste `npm run dominio:verifica`

Il principio del §5 del CLAUDE.md — preferire l'automazione alla
disciplina — applicato al punto più fragile di questa operazione.

- Interroga il DNS pubblico da **due risolutori indipendenti**, per non
  fidarsi di una sola risposta.
- Separa **POSTA** e **SITO**, ed esce con codice 1 **solo** se è rotta la
  posta: durante il passaggio è normale che il sito non risponda ancora,
  non è mai normale che la posta smetta.
- Controlla che ogni MX dichiarato abbia davvero degli indirizzi. Un MX
  che punta a un nome senza A è **peggio** di nessun MX: il dominio
  dichiara di ricevere posta e poi la rifiuta.
- Nessuna chiave, nessuna password: solo DNS pubblico e due richieste
  HTTP. Rieseguibile da qualunque computer, anche fra un anno.

Baseline registrata **prima** di toccare qualsiasi cosa (posta verde, sito
irraggiungibile) come termine di paragone per ogni passo successivo.

---

## 3. L'email di conferma — le tre decisioni che contano

Scelta di Alessio del 10/08: chi prenota dal sito, quando lui conferma,
deve ricevere un'email. Oggi non riceve niente.

**1. Nasce spenta** (`service_settings.email_conferma_attiva = false`).
Un messaggio spedito da un dominio non ancora verificato presso il
servizio di invio finisce nello spam, e ogni messaggio finito nello spam
peggiora la reputazione di **tutti** quelli dopo. Stesso principio di
`prenotazioni_online_attive`.

**2. Il registro degli invii non contiene l'indirizzo**, e muore con la
prenotazione (`on delete cascade`). Scriverci il destinatario sembra
comodo e sarebbe un errore: la pulizia dei dati clienti
(`20260810000004`) cancella le richieste dopo sei mesi **proprio per non
tenere i contatti**, e un registro parallelo con l'email dentro
sopravviverebbe a quella cancellazione rendendola finta. È la stessa
tensione già risolta là, risolta allo stesso modo.

**3. La decisione è separata dall'invio.** `email_conferma_dovuta()` dice
soltanto *se* l'email ci vuole; `invia_email_conferma()` la manda. Serve a
poter provare la regola dentro la migrazione — interruttore spento,
nessun indirizzo, doppione già inviato — **senza spedire niente a
nessuno**: le verifiche di questa migrazione non producono una sola email.

**Ordine delle scritture**: il segno dell'invio si scrive **prima** della
chiamata. Un errore in mezzo lascerebbe altrimenti il cliente senza email
e il registro senza traccia, e al tentativo successivo nessuno saprebbe se
era già partita. Meglio un invio perso che una conferma ricevuta due
volte, che fa dubitare il cliente di avere due tavoli.

**Un fallimento non resta invisibile.** Se Resend rifiuta l'invio, la
funzione manda un avviso su Telegram passando dalla funzione delle
notifiche (di cui condivide la parola d'ordine). Senza, il guasto sarebbe
invisibile per definizione: il gestionale dice «confermata» e il cliente
non sa niente; se ne accorgerebbe la sera, col tavolo vuoto.

---

## 4. La riga che avrebbe spento la posta

Resend propone **quattro** record. Il quarto, sotto *Enable Receiving*, è
un **MX su `@`** verso `inbound-smtp…amazonaws.com`: dirotterebbe tutta la
posta in arrivo del dominio dalle caselle Aruba a Resend, e
`info@borgo58.it` smetterebbe di ricevere all'istante. Serve solo a chi
vuole *ricevere* dentro Resend — non è il nostro caso.

I tre aggiunti (DKIM su `resend._domainkey`, MX e SPF sul sotto-dominio
`send`) sono stati **verificati uno per uno interrogando i server
autorevoli**, insieme alla prova che l'MX del dominio principale è rimasto
`mx.borgo58.it`. Valori veri elencati in [`docs/DOMINIO.md`](../DOMINIO.md)
§7, insieme all'avvertenza qui sopra.

---

## 5. Stato di verifica — onesto

| Cosa | Stato |
|---|---|
| server DNS spostati a Cloudflare | **fatto**, visibile dai risolutori pubblici |
| posta del dominio dopo lo spostamento | **verificata**: controlli verdi + email di prova arrivata sul telefono |
| tre record di Resend | **verificati** dai server autorevoli |
| migrazione `20260811000001` | **applicata in produzione** (e sul progetto di prova), funzione `email-cliente` installata |
| verifica del mittente presso Resend | **fatto**: dominio verificato, pronto a spedire |
| zona Cloudflare *Active* | **fatto** (circa un'ora e mezza dopo il cambio) |
| `borgo58.it` che apre il gestionale | **fatto e verificato**: `borgo58.it` e `www` rispondono `200` con il gestionale, e `npm run dominio:verifica` dice ✅ POSTA **e** ✅ SITO |
| un'email di conferma davvero ricevuta | **fatto**: richiesta vera dal form pubblico → conferma dal gestionale → **email arrivata in casella**. Un solo invio registrato, zero allarmi |

L'ultima riga era la più importante, e ora è verde: il modulo non è
"scritto", è **vivo**. La prova è stata fatta con i pezzi veri — form
pubblico, ruolo del titolare, funzione in produzione, casella vera.

---

## 7. Il difetto trovato applicando la migrazione in produzione

Il collaudo interno della migrazione inserisce una prenotazione finta con
`source = 'form_pubblico'` — e il trigger delle notifiche l'ha spedita su
**Telegram come una richiesta vera**: nome, data, coperti, indirizzo.
Alessio l'ha cercata nel gestionale e non l'ha trovata (la verifica la
cancella subito dopo): dal suo lato sembrava un guasto del calendario.

Il danno non è il messaggio: è che da quel momento una notifica Telegram
non significa più con certezza «è arrivato un cliente». Un canale di
allerta che ogni tanto mente vale meno di uno che tace.

**Corretto spegnendo il solo trigger delle notifiche** durante il
collaudo (`alter table … disable trigger`), non tutti. La migrazione della
privacy usava `session_replication_role = replica`, che qui sarebbe
sbagliato: fermerebbe anche il trigger che *questa* migrazione deve
provare, e la verifica passerebbe senza aver verificato niente. Se il
blocco solleva un'eccezione la DDL torna indietro con la transazione,
quindi il trigger non può restare spento per un errore — e comunque una
verifica finale controlla che sia riacceso, perché lasciarlo spento
significherebbe richieste dei clienti che non arrivano più, in silenzio.

Trappola scritta in `CLAUDE.md` §8: **ogni migrazione che scrive righe
finte in una tabella con trigger di notifica deve spegnere quel trigger.**

---

## 8. Un difetto di prodotto, trovato dallo stesso incidente

Cercando la prenotazione che non c'era, è emerso che **l'elenco del
Calendario si apre sempre su *oggi***: una richiesta per una data futura
non si vedeva aprendo la pagina, e l'unico posto dove compariva era la
notifica su Telegram. Una richiesta che nessuno vede è una richiesta a cui
nessuno risponde — e nel frattempo il posto resta bloccato (§ «una
richiesta in attesa occupa il posto»).

Ora le richieste da confermare stanno in un riquadro **sopra i filtri**,
fuori da qualunque filtro, con il numero e il perché («finché non
rispondi, il posto resta bloccato»). Da oggi in avanti, ordinate per data.
Nessun `.limit()`: troncarle nasconderebbe proprio quella che manca.

---

## 9. Quello che restava — tutto fatto

1. ✅ Fatto: mittente verificato, funzione installata, migrazione
   applicata, interruttore acceso, **prova dal vivo end-to-end riuscita**.
2. ✅ Fatto mentre scrivevo: zona attiva, `borgo58.it` e `www` agganciati
   al progetto Pages (Cloudflare ha sostituito da sé la riga di parcheggio
   con il puntamento al sito, **senza toccare l'MX**), e verifica finale
   verde su entrambi i fronti.

**Resta aperto per il prossimo giro** (fuori da questa consegna): il
modulo che fa entrare la posta di `info@borgo58.it` e delle due PEC
nell'Archivio Documenti letta dall'AI — decisione di Alessio dell'11/08,
con le tre conseguenze annotate in `CLAUDE.md` §10 (valore legale della
PEC, conservazione e tetto di spesa, «il sistema propone, Alessio
conferma»).
