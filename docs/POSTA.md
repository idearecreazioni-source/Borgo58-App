# La posta del locale — un'app sola, una cartella sola

**A chi serve**: ad Alessio. Scritto l'11/08/2026, dopo mezza giornata
persa a sbagliare porta su Aruba.

---

## 0. Perché è un caos (e non è colpa tua)

Aruba non ha *un* accesso: ne ha **quattro**, con credenziali diverse, e
nessuno dei quattro dice all'altro che esiste. Sbagliare porta produce
messaggi come «nessun dominio associato a questa login», che sembrano
guasti e invece sono solo la porta sbagliata.

| Porta | Indirizzo | Si entra con | A cosa serve |
|---|---|---|---|
| **Webmail normale** | `webmail.aruba.it` | `info@borgo58.it` | leggere e scrivere la posta del locale |
| **Webmail PEC** | `webmail.pec.aruba.it` | l'indirizzo PEC | leggere e mandare PEC (valore legale) |
| **Pannello del dominio** | `admin.aruba.it` | `postmaster@borgo58.it` | creare caselle, DNS |
| **Area clienti** | `managehosting.aruba.it` | l'account storico (`…@aruba.it`) | ordini, rinnovi, fatture, scadenze |

Le prime due sono **posta**. Le seconde due sono **amministrazione**, e si
aprono due o tre volte l'anno. Non vanno tenute insieme nella testa.

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
3. `https://admin.aruba.it` — pannello del dominio
4. `https://managehosting.aruba.it` — area clienti

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
| `Aruba — pannello dominio (postmaster@)` | `admin.aruba.it` |
| `Aruba — area clienti` | `managehosting.aruba.it` |

I nomi cominciano tutti con `Aruba —` di proposito: scrivendo «aruba»
nella cassaforte escono tutte e quattro in fila, e si sceglie leggendo.

⚠️ **Buco da chiudere**: la password di `postmaster@borgo58.it` non è mai
stata salvata. Si rigenera dall'area clienti (**Modifica password** nella
scheda del dominio) e stavolta va messa in cassaforte **prima** di uscire
dalla pagina.

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
      collegamento, e la password la mette Bitwarden.
- [ ] Non ho dovuto chiedere a nessuno quale indirizzo usare.
