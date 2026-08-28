# Blocco 2 — il rifiuto muto

**28/08/2026** · Blocco 2 del mandato.

| | |
|---|---|
| **HEAD dichiarato** | `1859945` — *Il rifiuto che non diceva quale* |
| **Working tree** | pulito al momento del commit |
| **Migrazioni introdotte** | `20260828000001`, `20260828000002` |
| **In produzione** | 🔴 **nessuna delle due** — applicate solo al progetto di prova |
| **Prove** | 519 di calcolo, 446 sull'app — verdi |

---

## La misura, prima di costruire

Il mandato chiede di contare i punti che rifiutano senza dire perché, e di
dichiarare **come** si è contato. Il conteggio è **esaustivo sul database**
(interrogando il catalogo, non leggendo i file) e **a campione sull'app**.

### Famiglia 1 — il vincolo del database che scatta

**La macchina per tradurre esiste dal 24/08 e funziona.** `nomeDelVincolo()`
riconosce **quattro** forme di messaggio, `spiega_vincolo()` va a prendere la
frase italiana, e `src/lib/supabase.js` la rimette al posto di quella di
Postgres — nel punto unico da cui passa ogni richiesta.

🔴 **Il guardiano che la tiene RIFORNITA ne copriva una su quattro.**
`vincoli_senza_frase()`, nato il 25/08, filtra `contype = 'c'`.

| forma | quanti | senza frase |
|---|---|---|
| limiti (`check`) | 232 | 154 *(congelati dal 25/08)* |
| **unicità** | **23** | **23** |
| **chiavi esterne `restrict`** | **58** | **56** |
| **chiavi esterne `no action`** | **7** | **7** |
| esclusioni | 1 | 0 |

**Ottantasei rifiuti muti**, e nessuno poteva far diventare rossa nessuna
prova: la rete non li guardava, e **una unicità nata muta domani sarebbe stata
invisibile per sempre**.

⚠️ **E sono proprio quelli che scattano in servizio.** Un `check` ferma un
numero assurdo — càpita a chi digita. Questi fermano un **gesto**: un tavolo
già occupato, un doppione, una prenotazione che non si cancella perché ci sta
sopra un conto.

### 🔴 Famiglia 1-bis — una QUINTA forma non era riconosciuta affatto

Misurata sul progetto di prova **provocando i rifiuti veri e leggendo cosa
torna**, non dedotta dalla documentazione:

```
23502  null value in column "obbl" of relation "_mis_b58"
       violates not-null constraint
```

🔴 **Quel messaggio non ha nessun nome di vincolo fra virgolette**, quindi
tutte e quattro le espressioni fallivano e **la frase arrivava a schermo in
inglese**, nominando una colonna di database. Le colonne obbligatorie senza
valore predefinito sono **341, su 116 tabelle**; ne avevano un commento **32**.

### Famiglia 2 — il controllo nell'app che blocca senza spiegare

**Misurato a campione, e il conteggio grezzo non è un risultato**: `disabled=`
compare **185 volte** in `src/`, e **zero** di queste hanno un `title=` sulla
stessa riga. ⚠️ Quel numero non dice niente, perché `disabled` copre tre cose
diverse: un'azione in corso (`saving`), un campo obbligatorio vuoto (la ragione
si vede a schermo), e **una regola che chi guarda non può vedere** — solo la
terza è un rifiuto muto.

⚠️ **Non ho separato le tre a tappeto**, e lo dichiaro: un setaccio sul testo
non le distingue, e in questo progetto un setaccio non provato ha già dato
quattro falsi allarmi su dieci (22/08). La forma sana esiste già ed è quella da
riusare — `motivoStato()` in `RicettaDetail.jsx`, che restituisce un `impedito`
con **la ragione e cosa fare prima**. **Resta da fare**, ed è la domanda n. 3.

### Famiglia 3 — la funzione che torna un fallimento generico

Non aperta. Dichiarata non misurata.

---

## Cosa entra

**Le 23 frasi delle unicità, scritte tutte.** Ognuna dice COSA è stato
rifiutato, PERCHÉ e COSA FARE ADESSO — la terza parte è quella che distingue un
rifiuto da un vicolo cieco. Da adesso **il conto dei muti fra le unicità è
ZERO, ed è una proprietà, non un perdono**.

**La rete allargata alle quattro forme che il gestionale sa tradurre**, con la
linea di partenza delle chiavi esterne congelata (63 in produzione, 64 sulla
prova — la differenza è una chiave esterna nata con le migrazioni in attesa).

⚠️ **Le chiavi esterne `cascade` e `set null` restano FUORI apposta**, e il
filtro è dichiarato nel corpo della funzione: sono 111 su 176 e **non rifiutano
niente** — alla cancellazione del padre agiscono. Pretendere 111 frasi per un
messaggio che nessuno leggerà mai è il modo in cui una rete viene spenta.

**La quinta forma riconosciuta**, con `spiega_campo_obbligatorio()` e **38 nomi
italiani** sulle quindici tabelle su cui si scrive tutti i giorni.

⚠️ **Non 341.** Scriverne 341 stanotte vorrebbe dire scriverne la maggior parte
senza sapere cosa contengono — cioè produrre frasi plausibili, che è peggio di
nessuna frase. **Nessuna rete pretende le altre 303**: il debito è dichiarato,
non sorvegliato.

---

## 🔴 VISTO CON GLI OCCHI, dal collegamento dell'app

Salvando un tavolo senza nome, il messaggio che arriva a chi lavora:

**prima** — `null value in column "label" of relation "dining_tables" violates
not-null constraint`

**dopo, senza il nome italiano** — «Manca un dato che il gestionale considera
obbligatorio: «label». …»

**dopo, con il nome italiano** — «Manca un dato che il gestionale considera
obbligatorio: **il nome del tavolo (è quello che finisce sul biglietto della
cucina e sul preconto)**. Non è una regola che puoi aggirare compilando
diversamente — è un pezzo che non è arrivato. Se il campo a schermo ti sembrava
pieno, questa è l'informazione da riportare.»

⚠️ E `campo_mancante` viaggia accanto con l'origine tecnica: una traduzione che
cancella la fonte è una traduzione di cui non ci si può fidare.

---

## Le rotture, che è come si giudicano le prove

| rottura | esito |
|---|---|
| il riconoscitore troppo STRETTO (non riconosce più niente) | 🔴 3 prove rosse |
| il riconoscitore troppo LARGO (riconosce qualunque messaggio) | 🔴 **4** rosse, e la quarta è *«non confonde un doppione con un dato mancante»* |
| un'**unicità** nata muta | 🔴 il guardiano la nomina — è il difetto che questa consegna chiude |
| una chiave esterna **`cascade`** nata muta | ✅ tace — la rete non è più larga di ciò che sa tradurre |
| una chiave esterna **`restrict`** nata muta | 🔴 la nomina — senza questo, il caso sopra sarebbe verde perché la rete non guarda affatto le chiavi esterne |
| una colonna **inesistente** | ✅ non riceve una spiegazione inventata |
| una **tabella** inesistente | ✅ non riceve la spiegazione di una colonna omonima di un'altra tabella |

⚠️ **La seconda rottura diventa rossa su una prova che la prima lasciava
verde**: è quella che dimostra che il controllo discrimina invece di limitarsi
a passare.

---

## Cosa abbiamo rovesciato

**Niente.** La regola del 24/08 — *una regola sola, la traduzione vive nel
punto unico da cui passa ogni richiesta* — è rispettata: la quinta forma è
stata aggiunta **lì dentro**, non in una schermata.

---

## Voci di `docs/DECISIONI.md` toccate

**Nessuna.**

---

## Rilettura

- **Cosa NON ho verificato con gli occhi** — 🔴 **nessuna schermata è stata
  aperta.** Il rifiuto tradotto l'ho letto dal *collegamento dell'app* dentro
  una prova, che è il tratto giusto ma non è uno schermo: **come la frase si
  vede in una schermata non lo ha visto nessuno**. E delle 23 frasi nuove,
  **nessuna è mai scattata davanti a una persona**.
- **Cosa ho contato senza leggerlo** — le 154 frasi mancanti sui `check` e i 111
  legami `cascade`/`set null` sono conteggi dal catalogo, non letti uno per uno.
  Le **23 frasi delle unicità le ho scritte leggendo la definizione di ognuna**.
- **Quali mie affermazioni sono diventate false mentre lavoravo** — una: avevo
  scritto nella verifica che `p_scadenza`… no, quella è del Blocco 5. Qui:
  ho scritto che i vincoli senza frase erano «86 su 89»; dopo aver scritto le
  23 frasi il numero vero dei muti è **63**, tutti chiavi esterne, tutti
  congelati. Il testo della migrazione dice il numero **di prima**, ed è
  giusto così — descrive la misura che l'ha motivata.
- **Blocchi non aperti** — vedi il riepilogo finale.
- **Conteggi che sono pavimenti** — 🔴 **i 185 `disabled=`**: è un pavimento in
  senso stretto (sono almeno tanti), ma soprattutto **non è una misura dei
  rifiuti muti** — è il numero dei candidati da leggere. La famiglia 2 è
  misurata a campione, non chiusa.
- **Cosa ho lasciato sul progetto di prova** — niente. Le due tabelle di prova
  della verifica sono create e distrutte dentro la migrazione; il rifiuto della
  prova sull'app è un inserimento **respinto**, quindi non nasce nessuna riga.
