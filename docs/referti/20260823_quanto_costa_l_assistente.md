# Quanto costa l'assistente, e cosa succede quando sbaglia

**23/08/2026.** Blocchi 1 e 3 del mandato «l'assistente sul gestionale di
prova»: **misura e riporta**. ⚠️ **Niente è stato attivato.**

---

## 1 · I costi

### Cosa è misurato e cosa no

| | |
|---|---|
| **i token** | ✅ **misurati**: sei domande vere in produzione, e il testo che le funzioni spediscono davvero |
| **i prezzi al milione di token** | ⚠️ **di listino, non misurati da qui**: vanno confrontati col pannello dell'account |

⚠️ **La distinzione conta**: se i prezzi fossero diversi da come li conosco,
i totali qui sotto cambierebbero in proporzione — ma **gli ordini di
grandezza no**, ed è su quelli che si decide.

### Le cinque funzioni e i loro modelli, letti dal codice

| funzione | modello | tetto di risposta |
|---|---|---|
| `schede-prodotto` | **Haiku 4.5** (il piccolo) | 8.000 |
| `assistente-archivio` | Opus 5 | 4.000 |
| `documento-leggi` | Opus 5 | 16.000 |
| `posta-leggi` | Opus 5 con allegati, **Haiku senza** | 12.000 |
| `prova-ai` | Opus 5 | 64 |

⚠️ **Le schede prodotto usano il modello piccolo**, ed è una scelta scritta
nel codice: *«sono conoscenze di cucina standard, non ragionamento; il
modello grande costerebbe di più senza saperne di più su quanto scarta un
carciofo»*. È la ragione per cui la compilazione costa poco.

### Le schede prodotto — quello che serve al collaudo

🔴 **Si compilano a gruppi di 25** (`PRODOTTI_PER_GIRO = 25`), non tutte
insieme: cento schede sono **quattro giri**.

Misurato sul testo vero: istruzioni **3.013 caratteri**, più **119 caratteri
per prodotto**.

| | domanda | risposta (stimata) | costo |
|---|---|---|---|
| 10 schede (1 giro) | ~1.180 token | ~1.600 | **~0,9 centesimi** |
| 25 schede (1 giro) | ~1.660 token | ~4.000 | **~2,2 centesimi** |
| **100 schede (4 giri)** | ~6.650 token | ~16.000 | **~8,7 centesimi** |

⚠️ **Compilare l'intera dispensa del collaudo — 110 prodotti — costa meno di
dieci centesimi.**

### Le altre funzioni — token veri, misurati in produzione

Le sei domande all'archivio già fatte da Alessio:

| domanda | token |
|---|---|
| «quanto pagherò di affitto dopo un anno?» | 2.057 + 329 |
| «le riparazioni ordinarie e straordinarie» | 2.069 + 222 |
| «chi paga le manutenzioni straordinarie» | 4.397 + 257 |
| «quanto pagherò dopo un anno?» | 4.385 + 544 |
| «il mio n. di p.i.?» | **10.768** + 154 |

**Media: 4.289 di domanda + 304 di risposta → ~2,9 centesimi a domanda.**
La più cara delle sei: **~5,8 centesimi**.

| | costo per volta |
|---|---|
| una domanda all'archivio | **~3 centesimi** |
| leggere un documento (PDF o foto) | **~5-7 centesimi** |
| leggere una mail con allegato | **~2 centesimi** (misurato dal progetto il 12/08) |
| leggere una mail senza allegati | **frazioni di centesimo** (modello piccolo) |
| `prova-ai` | **trascurabile** (44 + 9 token) |

⚠️ **Un documento di videoscrittura non costa niente**: `.odt` e `.docx` non
passano dal modello — il testo è già dentro il file.

### Quanto entra nei 10 dollari

| | quante volte |
|---|---|
| compilazioni da 25 schede | **~460** (cioè ~11.500 schede) |
| domande all'archivio | **~340** |
| letture di documenti | **~160** |

🔴 **Il collaudo non può mangiarsi il tetto con le schede prodotto.** Anche
compilando l'intera dispensa dieci volte di seguito si spende **meno di un
euro**.

⚠️ **Il rischio, se c'è, è altrove**: le funzioni che usano il modello grande
— e soprattutto **`posta-leggi`, che gira da sola ogni quindici minuti**. Sul
progetto di prova non c'è posta in arrivo, quindi oggi non spende; ma se un
giorno ne avesse, spenderebbe **senza che nessuno prema niente**.

### Si possono separare i due conti?

⚠️ **Non l'ho potuto misurare**: serve guardare il pannello dell'account, e
da qui non ci arrivo. Quello che si può dire leggendo
[`docs/ACCOUNT_AI.md`](../ACCOUNT_AI.md): il tetto è impostato come **limite
di spesa mensile dell'account**, e le chiavi ne condividono il credito.

**Da verificare sul pannello**, in ordine di preferenza:
1. l'account permette più **spazi di lavoro** con un tetto proprio ciascuno →
   allora la prova ha il suo conto e non tocca quello vero;
2. se no, la chiave resta una sola e la separazione **non esiste**: il
   controllo è guardare la spesa, non impedirla.

---

## 2 · 🔴 Cosa succede quando l'assistente sbaglia

**Riempie sei campi.** Ecco cosa protegge ognuno, misurato sulla funzione
viva `applica_scheda_prodotto`:

| campo | protezione | dove pesa se è sbagliato |
|---|---|---|
| **allergeni** | ✅ nascono `stimati`, **non finiscono nella stampa del menu**, servono una conferma esplicita | menu del cliente |
| **stagionalità** | ❌ nessuna | ricettario |
| **conservazione** | ❌ nessuna | **scadenziario**: decide se il preavviso è 2 o 14 giorni |
| **durata in giorni** | ❌ nessuna | **scadenze dei lotti** |
| **temperatura di ricevimento** | ❌ nessuna | 🔴 **registro HACCP, che si esibisce a un'ispezione** |
| **scarto %** | 🟡 rifiuta oltre il 95% | 🔴 **food cost di ogni piatto che usa quell'ingrediente** |

⚠️ **Il rifiuto sopra il 95% non è una conferma**: è un controllo di
plausibilità, e prende solo gli errori grossolani. Uno scarto del **40% su un
prodotto che ne scarta 8** passa senza che nessuno lo sappia — ed è
esattamente l'errore verosimile di cui parla il mandato.

### Due protezioni che ci sono già

1. **Si scrive solo su quello che è vuoto.** Nessun campo deciso da Alessio
   viene mai sovrascritto.
2. **La data resta**: `campi_compilati_il` viene riempita a ogni passaggio
   della macchina.

### 🔴 Ma la traccia non si vede, e non basterebbe

**Misurato: nessuna schermata dell'app legge `campi_compilati_il`** — zero
occorrenze in tutto `src/`.

⚠️ **E anche se si vedesse, non risponderebbe alla domanda giusta**: è una
data **per prodotto, non per campo**. Se Alessio corregge a mano la
temperatura e lascia lo scarto com'era, quel prodotto porta una sola data
sotto la quale stanno **un dato suo e un dato indovinato**, indistinguibili.

**Quindi, oggi**: un dato scritto dalla macchina è **identico** a uno scritto
da Alessio, in ogni schermata e in ogni documento — compreso il manuale
HACCP.

⚠️ *Quando un dato è stato indovinato, chi legge deve poterlo sapere.* Qui
non può.

**Non è stato costruito niente**: il mandato dice di misurare e riportare.

---

## Cosa abbiamo rovesciato

**Niente.** Sono due misure; nessuna decisione precedente è stata toccata, e
nulla è stato attivato.
