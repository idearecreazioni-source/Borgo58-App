# La posta del locale — un'app sola, una cartella sola

**A chi serve**: ad Alessio. Scritto l'11/08/2026, dopo mezza giornata
persa a sbagliare porta su Aruba.

---

## 0. Perché è un caos (e non è colpa tua)

Perché Aruba non è un servizio solo: sono **due mondi separati** (il
dominio con la sua posta, e la PEC) che si assomigliano, hanno indirizzi
diversi e non si parlano. Da uno non si vede l'altro — verificato
l'11/08/2026: dall'area PEC non si arriva a `info@borgo58.it`, e non è un
permesso mancante, è proprio un altro sistema.

La semplificazione che toglie il caos:

> **Un solo account apre tutti i pannelli. Ogni casella ha la sua
> password per leggere la posta.**

| | Porta | Si entra con | A cosa serve |
|---|---|---|---|
| 📬 **posta** | `webmail.aruba.it` | `info@borgo58.it` | leggere e scrivere la posta del locale |
| 📬 **posta** | `webmail.pec.aruba.it` | l'indirizzo PEC | leggere e mandare PEC (valore legale) |
| ⚙️ **pannelli** | `admin.aruba.it` | **l'account** `…@aruba.it` | caselle e DNS del dominio |
| ⚙️ **pannelli** | `managehosting.aruba.it` | **lo stesso account** | ordini, rinnovi, fatture del dominio |
| ⚙️ **pannelli** | `areaclienti.pec.it` | **lo stesso account** | le PEC, SPID, firma digitale |

I pannelli si aprono due o tre volte l'anno e hanno **una password sola
fra tutti**. Le caselle si aprono ogni giorno e ne hanno **una ciascuna**.

⚠️ **Non esiste nessuna password di `postmaster@borgo58.it`** — verificato
l'11/08/2026 leggendo l'utente scritto nel pannello: è l'account Aruba.
`postmaster@` compare nelle guide di Aruba perché su altre configurazioni
è così, e cercare di recuperarlo porta al messaggio «la login inserita non
è valida»: non è un guasto, è una password che non c'è mai stata.

---

## 1. La regola che toglie il caos

> **La posta si legge dal telefono — PEC nell'app di Aruba, tutto il resto
> in Gmail. I pannelli si aprono da una cartella di preferiti. Non si
> cerca mai un indirizzo a memoria.**

Tutto quello che segue serve solo a rendere vera questa frase.

---

## 2. Sul telefono: due app, e il confine è la PEC

Scelta di Alessio dell'11/08/2026, ed è quella giusta:

| App | Cosa ci sta dentro |
|---|---|
| **Aruba PEC** | `alessio.schillaci@pec.it` e `borgo58@pec.it` |
| **Gmail** | `borgo58.gestionale@gmail.com` e `info@borgo58.it` (più le caselle normali che verranno) |
| **Apple Mail** | la posta personale, e basta |

**Perché le PEC non vanno nell'app normale**, pur potendocisi mettere via
IMAP: una PEC non è un'email, è una raccomandata. Il valore legale sta
nell'originale sul server insieme alle **ricevute di accettazione e
consegna** — e un'app di posta normale le tratta come messaggi qualunque:
si cancellano con un dito, e cancellandole dall'app si cancellano **anche
dal server**. L'app di Aruba invece le protegge, mostra le ricevute e le
manda come PEC vere.

Aggiungere la seconda PEC: **app Aruba PEC → menù → gestione delle caselle
→ aggiungi**, poi indirizzo e password di `borgo58@pec.it` (in cassaforte;
se manca, si rigenera da `areaclienti.pec.it`).

Per le caselle **non** PEC dentro Gmail: *foto profilo → Aggiungi un altro
account → Altro (IMAP)*, con

| | |
|---|---|
| Posta in arrivo (IMAP) | `imaps.aruba.it` · porta **993** · SSL |
| Posta in uscita (SMTP) | `smtps.aruba.it` · porta **465** · SSL |

⚠️ **La `s` di `imaps` non è un errore di battitura.** Con `imap.aruba.it`
il telefono risponde «password errata» e si perde mezz'ora a cambiare
password che erano giuste. Successo l'11/08.

---

## 3. Sul computer: una cartella nella barra dei preferiti

Crea nella barra dei preferiti di Chrome una cartella **`Borgo 58`** con
dentro questi quattro collegamenti, in quest'ordine (i primi due si usano
ogni giorno, gli altri due due volte l'anno):

1. `https://webmail.aruba.it` — posta del locale
2. `https://webmail.pec.aruba.it` — PEC
3. `https://admin.aruba.it` — pannello del dominio (caselle, DNS)
4. `https://managehosting.aruba.it` — rinnovi e fatture del dominio
5. `https://areaclienti.pec.it` — rinnovi delle PEC, SPID, firma digitale

Da lì in poi non si cerca più niente su Google: si apre la cartella.

---

## 4. Bitwarden: una voce per porta, col suo indirizzo dentro

Il caos non è solo dove cliccare: è anche **quale password**. In
cassaforte deve esserci **una voce per ogni porta**, con il campo
*sito web* compilato — così l'estensione riempie da sola i campi giusti e
non devi più chiederti quale delle quattro sia.

| Nome della voce | Sito web da mettere nella voce |
|---|---|
| `Aruba — posta info@borgo58.it` | `webmail.aruba.it` |
| `Aruba — PEC (…)` una per ciascuna | `webmail.pec.aruba.it` |
| `Aruba — account (tutti i pannelli)` | `admin.aruba.it`, `managehosting.aruba.it` **e** `areaclienti.pec.it` |

I nomi cominciano tutti con `Aruba —` di proposito: scrivendo «aruba»
nella cassaforte escono tutte in fila, e si sceglie leggendo.

L'ultima voce ha **tre indirizzi dentro la stessa scheda** (Bitwarden lo
permette: *Aggiungi URI*), perché è un accesso solo che apre tre pannelli.
Tenerne tre copie separate significa, il giorno in cui si cambia la
password, aggiornarne una e dimenticare le altre.

---

## 5. Cosa NON fare

- **Niente inoltro automatico verso la Gmail personale.** Deciso l'11/08:
  mescolare la posta del locale con quella personale toglie il confine
  fra «sto lavorando» e «non sto lavorando», e nessuno dei due ne
  guadagna. Le caselle stanno insieme nell'app, non nella stessa casella.
- **Niente password uguali fra le quattro porte.** Sono conti diversi
  proprio per questo: chi entra in uno non entra negli altri.
- **Niente credenziali in questo file.** Sta su GitHub: qui c'è solo dove
  stanno le cose, come in [`ACCESSI.md`](ACCESSI.md).

---

## 6. La prova che il sistema funziona

Fra sei mesi, senza rileggere niente:

- [ ] Devo leggere o mandare una PEC → app **Aruba PEC**, e basta.
- [ ] Devo leggere la posta del locale → app **Gmail**, e basta.
- [ ] Devo creare una casella nuova → cartella `Borgo 58` → terzo
      collegamento, e la password la mette Bitwarden (è quella
      dell'account Aruba, non un `postmaster@` che non esiste).
- [ ] Non ho dovuto chiedere a nessuno quale indirizzo usare.
