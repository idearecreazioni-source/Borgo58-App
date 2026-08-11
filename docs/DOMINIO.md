# `borgo58.it` — portare il dominio sul sito senza spegnere la posta

**A chi serve**: ad Alessio, click-by-click. Scritto l'11/08/2026.

Oggi `borgo58.it` apre la pagina di parcheggio di Aruba, e il gestionale
vive su `borgo58-app.pages.dev`. Alla fine di questa guida `borgo58.it`
aprirà il gestionale — **e `info@borgo58.it` continuerà a ricevere posta
esattamente come adesso**.

⚠️ **La cosa che si rompe.** Il dominio non è solo l'indirizzo del sito:
è anche ciò che dice al mondo *dove consegnare la posta*. Le due cose
viaggiano insieme sugli stessi binari. Spostando i binari da Aruba a
Cloudflare, gli indirizzi della posta **non si spostano da soli**: vanno
ricopiati. Se non lo si fa, la casella smette di ricevere lo stesso
giorno — e chi scrive al locale non riceve nessun avviso: la sua email
sparisce e basta.

Per questo esiste un comando che lo controlla al posto tuo:

```bash
npm run dominio:verifica
```

Dice due cose separate: **la posta funziona** e **il sito risponde**. La
prima è quella da guardare. Lanciato oggi, prima di toccare qualsiasi
cosa, risponde già ✅ sulla posta — quello è il risultato da riottenere
dopo ogni passaggio.

---

## 1. La tabella da riconoscere

Questi sono i binari **veri**, letti dal DNS pubblico l'11/08/2026 prima
di toccare niente. Servono al passo 2: Cloudflare li copia da solo, e
tu devi solo **verificare che ci siano tutti**.

| Nome | Tipo | Valore | A cosa serve |
|---|---|---|---|
| `borgo58.it` | MX (priorità 10) | `mx.borgo58.it` | **dove viene consegnata la posta** |
| `mx.borgo58.it` | A | 7 indirizzi `62.149.128.*` | i server che la ricevono |
| `borgo58.it` | TXT | `v=spf1 include:_spf.aruba.it ~all` | chi può scrivere a nome del dominio |
| `_dmarc.borgo58.it` | TXT | `v=DMARC1; p=none; adkim=r; aspf=r;` | regola anti-falsificazione |
| `webmail.borgo58.it` | A | `62.149.158.91`, `62.149.158.92` | la posta dal browser |
| `smtp.borgo58.it` | A | 4 indirizzi `62.149.128.20*` | l'invio dal telefono |
| `imap.borgo58.it` | CNAME | `imaps.aruba.it` | la lettura dal telefono |
| `ftp.borgo58.it` | CNAME | `www.borgo58.it` | vecchio spazio web Aruba, inutile |
| `borgo58.it` | A | `62.149.128.40` | **la pagina di parcheggio — questa sì che va sostituita** |
| `www.borgo58.it` | CNAME | `borgo58.it` | idem |

Le prime otto righe **non si toccano**. Le ultime due sono quelle che
cambiamo: sono il sito, ed è il sito che vogliamo spostare.

⚠️ **Le righe della posta devono restare "solo DNS"** (a Cloudflare:
nuvoletta **grigia**, non arancione). La nuvoletta arancione fa passare
il traffico dentro Cloudflare — utile per un sito, letale per la posta.
Cloudflare di solito lo fa già giusto da sé; va controllato.

---

## 2. Aggiungere il dominio a Cloudflare

Nello stesso account dove vive già il sito
(`borgo58.gestionale@gmail.com`).

1. Vai su `dash.cloudflare.com` → in alto a sinistra **Account Home** →
   pulsante **Add a domain** (oppure *Aggiungi un dominio*).
2. Scrivi `borgo58.it`. Scegli **Manually enter DNS records** se lo
   propone, altrimenti lascia che li importi da solo.
3. Quando chiede il piano, scegli **Free** (0 €). È in fondo alla lista.
4. Cloudflare mostra l'elenco dei binari trovati: **confrontalo con la
   tabella qui sopra**. Devono esserci tutte e dieci le righe. Se ne
   manca una della posta, aggiungila a mano con **Add record** copiando
   nome, tipo e valore dalla tabella.
5. Controlla che accanto a `mx`, `webmail`, `smtp`, `imap` la nuvoletta
   sia **grigia** (scritto *DNS only*). Se è arancione, cliccala per
   spegnerla.

**Non è ancora successo niente**: finché non si fa il passo 3, questi
binari sono scritti ma non usati da nessuno. Puoi rileggerli con calma.

---

## 3. Dire al mondo di seguire i binari nuovi

Cloudflare ti mostra **due nomi** tipo `xxx.ns.cloudflare.com`. Vanno
scritti su Aruba.

1. Entra su `admin.aruba.it` con `postmaster@borgo58.it` (è la porta del
   **pannello del dominio**, non l'area clienti — vedi `ACCESSI.md`).
2. Cerca **Gestione DNS** → **DNS personalizzati** (o *DNS esterni*).
3. Cancella i quattro nomi Aruba (`dns.technorail.com`,
   `dns2.technorail.com`, `dns3.arubadns.net`, `dns4.arubadns.cz`) e
   metti i **due** di Cloudflare.
4. Salva.

⚠️ **Aruba a questo punto ti avvisa che «la gestione della posta passerà
al DNS esterno»**. È vero, ed è previsto: la posta continua ad arrivare
alle caselle Aruba, sono solo le indicazioni stradali a stare altrove.
Non è il momento di annullare — è il momento in cui serve il passo 2
fatto bene.

Il passaggio richiede da pochi minuti a qualche ora. Cloudflare manda
un'email quando il dominio risulta **Active**.

---

## 4. Controllare la posta PRIMA di festeggiare

Appena Cloudflare dice *Active*:

```bash
npm run dominio:verifica
```

Deve dire **✅ POSTA**. Se dice ❌, torna al passo 2 e aggiungi la riga
mancante: si sistema in due minuti, e nel frattempo la posta arretrata
non si perde (chi spedisce riprova per ore prima di rinunciare).

Prova concreta, che vale più di ogni controllo: **mandati un'email da
Gmail a `info@borgo58.it`** e guarda se arriva sul telefono.

---

## 5. Attaccare il sito al dominio

1. Su Cloudflare: **Workers & Pages** → progetto **borgo58-app** →
   scheda **Custom domains** → **Set up a custom domain**.
2. Scrivi `borgo58.it` → conferma. Cloudflare sistema da solo i binari
   del sito (sostituisce le due righe di parcheggio della tabella).
3. Ripeti con `www.borgo58.it`.
4. Sempre su Cloudflare, dominio `borgo58.it` → **SSL/TLS** → modalità
   **Full (strict)**.

Poi, di nuovo:

```bash
npm run dominio:verifica
```

Deve dire **✅ POSTA** e **✅ SITO**.

---

## 6. Perché Cloudflare e non lasciare tutto su Aruba

Si poteva anche tenere il DNS di Aruba e far puntare solo `www` al sito.
Due motivi per non farlo:

- **`borgo58.it` senza `www` non si può agganciare a un sito così**: si
  sarebbe potuto solo mettere un rimbalzo, con il lucchetto di sicurezza
  che si lamenta. È l'indirizzo che finirà sul QR code e su Instagram:
  deve aprire il sito, pulito.
- **Fra poco serve un altro giro di binari**: l'email automatica di
  conferma al cliente (Resend) ha bisogno di sue righe nel DNS. Con
  tutto in un posto solo si fa in cinque minuti.

---

## 7. I record dell'email di conferma (Resend)

Aggiunti l'11/08/2026, quando è nato il servizio che manda la conferma al
cliente. **Non sono segreti**: sono dichiarazioni pubbliche, e servono a
dimostrare al mondo che quel servizio ha il permesso di scrivere a nome
di `borgo58.it`. Senza, le conferme finiscono nello spam.

| Tipo | Nome | Valore | Priorità |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwToCNOFDcEjVC0IGFvS3P8q/R3D2cs/koS4mI0nkmT26Y50tMp0wW0kiRC0yScMqZOgew2SslVB0x7L3l0B4uVD9psplIpwFS4GlSRjlWuNguFLFj4J0SRYML4VYUa5wx2uFvN+hB1wZQ2KhOo5b//KAFG/0PF5XsQFAUsn3yyQIDAQAB` | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

Tutti e tre **solo DNS** (nuvoletta grigia).

⚠️ **La riga da NON aggiungere.** Resend ne propone una quarta, sotto
*Enable Receiving*: un **MX su `@`** verso `inbound-smtp...amazonaws.com`.
Quella dirotterebbe **tutta la posta in arrivo del dominio** dalle caselle
Aruba a Resend: `info@borgo58.it` smetterebbe di ricevere all'istante.
Serve solo a chi vuole *ricevere* posta dentro Resend, che non è il nostro
caso — noi vogliamo solo mandare. L'interruttore *Enable Receiving* resta
spento.

Il nome `send` crea un sotto-dominio (`send.borgo58.it`) con una posta
sua, separata: è lì che vive il servizio di invio, e per questo il suo MX
non tocca quello del dominio principale.

---

## 8. Cosa NON è cambiato

- Le caselle di posta restano **su Aruba**: si leggono da
  `webmail.aruba.it` e dall'app del telefono esattamente come prima.
- `borgo58-app.pages.dev` continua a funzionare: è la stessa app.
- Ogni `git push` ripubblica il sito come sempre.
