# L'account per l'intelligenza artificiale — guida operativa

**A chi serve**: ad Alessio. Blocco 5 del Mandato strutturale, l'ultimo.
Documento del 11/08/2026.

---

## 0. Cosa apre questo blocco

Dietro questo account aspettano tutte le funzioni del gestionale che
"ragionano": l'assistente, l'importatore di ricette, il monitoraggio dei
social, il consulente culinario, la lettura automatica di fatture e buste
paga, il ricevimento merci con la fotocamera. Nessuna di queste si può
costruire prima, perché tutte passano dalla stessa chiave.

**Il tetto di spesa si mette il primo giorno, non il primo mese.** È la
sola cosa che sta fra un errore di programmazione e una bolletta a tre
cifre: un ciclo che si ripete da solo può fare migliaia di richieste in
un'ora, e nessuno se ne accorge finché non arriva il conto.

---

## 1. Creare l'account (10 minuti)

1. Vai su **console.anthropic.com** e registrati con
   `borgo58.gestionale@gmail.com` (la casella del locale, non quella
   vecchia). Salva la password in Bitwarden mentre la crei.
2. Attiva subito la **verifica in due passaggi** dalle impostazioni
   dell'account: è un conto che può spendere soldi, quindi vale la stessa
   regola degli altri quattro.
3. Alla richiesta di intestazione, usa i dati della **S.r.l.s.** (ragione
   sociale e partita IVA): la spesa è un costo dell'azienda e la fattura
   deve arrivare intestata bene.

---

## 2. Il tetto di spesa — prima della chiave

Nella console, sezione **Billing / Limits**:

1. Carica un credito iniziale piccolo: **10-20 €** bastano per mesi di
   prove. Non serve una carta con addebito automatico.
2. Imposta il **limite di spesa mensile**. Suggerito per la fase attuale:
   **20 € al mese**. Si alza in trenta secondi quando i moduli veri
   saranno accesi; abbassarlo dopo un incidente non serve a niente.
3. Se la console lo permette, attiva l'**avviso via email** a metà del
   limite: così sai che stai consumando prima di essere fermo.
4. **Fai uno screenshot della schermata del limite.** Serve al validatore
   come prova che il tetto esiste — è un criterio di accettazione del
   mandato, non un capriccio.

---

## 3. La chiave

1. Sempre nella console: **API Keys → Create Key**. Chiamala `borgo58-gestionale`.
2. La chiave si vede **una volta sola**. Copiala e salvala subito in
   Bitwarden, nella voce dell'account AI.
3. ⚠️ **Non incollarla mai** in una chat, in un file del progetto, in
   un'email o in un messaggio. Chi ha quella chiave spende i tuoi soldi.
   L'unico posto dove va, oltre alla cassaforte, è il pannello Supabase
   (punto 4).

---

## 4. Metterla dove serve (pannello Supabase)

La chiave vive **solo** dentro la funzione online, mai nel sito: il sito è
pubblico, e tutto ciò che finisce nel sito è leggibile da chiunque.

1. Pannello Supabase → progetto **borgo58** → **Edge Functions → Secrets**.
2. **Add new secret**: nome esatto `ANTHROPIC_API_KEY`, valore la chiave.
3. Poi installa la funzione di prova `prova-ai` come le altre (Deploy a
   new function → Via Editor → incolla → Deploy).

---

## 5. La prova

La funzione `prova-ai` non fa niente di utile di proposito: manda al
modello la domanda più corta possibile e riporta la risposta. Serve a
dimostrare che la catena regge — **chiave nei Secrets → chiamata →
risposta** — prima che qualcuno costruisca un modulo sopra.

Risponde solo a te: chi entra come staff riceve un rifiuto.

Se qualcosa non va, il messaggio dice quale dei tre anelli si è rotto:

| Messaggio | Cosa vuol dire |
|---|---|
| «La chiave non è nei Secrets» | il punto 4 non è stato fatto, o il nome del secret è scritto diverso |
| «La chiave non è valida o è stata revocata» | la chiave è stata copiata male, o cancellata dalla console |
| «Limite di spesa o di richieste raggiunto» | il tetto del punto 2 è stato toccato: è il sistema che funziona |

---

## 6. Da qui in poi

Ogni modulo AI nuovo passa da una funzione online come questa, con la
chiave letta dai Secrets. **Nessun modulo legge la chiave direttamente dal
browser**: sarebbe come lasciare la carta di credito sul bancone.

E quando i moduli veri saranno accesi, il tetto di spesa va rivisto una
volta sola — verso l'alto, con calma, guardando quanto si è consumato
davvero nel mese precedente.
