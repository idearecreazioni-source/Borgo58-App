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

> **La posta si legge in un'app sola. I pannelli si aprono da una cartella
> sola. Non si cerca mai un indirizzo a memoria.**

Tutto quello che segue serve solo a rendere vera questa frase.

---

## 2. Sul telefono: tutte le caselle nella stessa app

Sull'iPhone l'app **Gmail** tiene già insieme `borgo58.gestionale@gmail.com`
e `info@borgo58.it`. Ci entrano anche le due PEC, con lo stesso
procedimento: così **tutta la posta del locale suona in un posto solo**, e
Apple Mail resta la posta personale.

Per ogni PEC: *Gmail → foto profilo in alto → Aggiungi un altro account →
Altro (IMAP)*, poi:

| | |
|---|---|
| Indirizzo e password | quelli della PEC |
| Posta in arrivo (IMAP) | `imaps.pec.aruba.it` · porta **993** · SSL |
| Posta in uscita (SMTP) | `smtps.pec.aruba.it` · porta **465** · SSL |

⚠️ **La `s` di `imaps` non è un errore di battitura.** Con `imap.pec…` il
telefono risponde «password errata» e si perde mezz'ora a cambiare
password che erano giuste. È già successo l'11/08 con la casella normale.

Per la posta normale gli indirizzi sono `imaps.aruba.it` e
`smtps.aruba.it`, stesse porte.

### Due regole per le PEC, e sono importanti

1. **Non cancellare mai un messaggio PEC dall'app.** Il valore legale
   sta nell'originale sul server di Aruba, insieme alle ricevute di
   accettazione e consegna. Cancellandolo dall'app lo cancelli **anche
   lì**: è come strappare una raccomandata firmata.
2. **Le PEC si leggono dall'app, ma si scrivono dalla webmail PEC.**
   Mandandole dalla webmail sei sicuro che partano come PEC e che le
   ricevute finiscano dove devono. Un'app normale può farlo, ma se
   sbagli qualcosa te ne accorgi quando serve la prova — cioè troppo tardi.

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

- [ ] Devo leggere una PEC → apro l'app del telefono, non cerco l'indirizzo.
- [ ] Devo mandare una PEC → cartella `Borgo 58` → secondo collegamento.
- [ ] Devo creare una casella nuova → cartella `Borgo 58` → terzo
      collegamento, e la password la mette Bitwarden (è quella
      dell'account Aruba, non un `postmaster@` che non esiste).
- [ ] Non ho dovuto chiedere a nessuno quale indirizzo usare.
