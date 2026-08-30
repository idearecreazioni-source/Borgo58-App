# La tasca di Alessio — 30/08/2026, notte

**Migrazione che entra**: `20260830000012` — *la tasca di Alessio*.
**Applicata al progetto di prova**, che ora ha 355 migrazioni registrate.
⚠️ **Non è in produzione nel momento in cui scrivo**: aspetta il push.

---

## Cosa è, e cosa non è

🔴 **È un TERZO SOGGETTO**, accanto a Borgo 58 e a Orto Borgo 58, con saldo
suo. Alessio tiene contanti propri e ci compra roba per il progetto **senza
fattura**, da prima che esistesse la partita IVA. Non è deducibile, e **lui
non la dichiara**: vuole solo saperne il conto.

⚠️ **Non è la stessa cosa delle anticipazioni del socio** (Blocco 7 del
15/08): quelle sono spese fatte **per conto della società**, che la società
poi pareggia. La tasca no — non c'è niente da pareggiare, e infatti **non
registra nessuna entrata**.

## Le tre regole stanno nel database

Una regola nella schermata la aggira chiunque scriva da un'altra porta.

1. **Dalla tasca escono soldi e basta** — un trigger su `cash_movements`
   rifiuta le entrate, e il messaggio manda dove si deve andare: *«se stai
   registrando una spesa che la società gli rimborsa, non è la tasca — sono
   le anticipazioni del socio»*.
2. **L'unica regola ammessa è «Indeducibile»**, e ha **due facce**: se nessuno
   la nomina **la scrive il trigger** (è sempre la stessa, e chiederla
   sarebbe offrire la possibilità di sbagliarla — la ragione per cui la
   causale del prestito è uscita dalla firma il 29/08); se qualcuno ne nomina
   **un'altra**, si **rifiuta** invece di sovrascriverla in silenzio.
3. **Non può avere parametri fiscali né una previsione** — due trigger su
   `fiscal_settings` e `scenari_proiezione`. 🔴 **È così che resta fuori
   dalla proiezione per costruzione**: senza parametri fiscali il motore
   unico si rifiuta già da sé, quindi non c'è nessun filtro da ricordarsi di
   scrivere in ogni schermata nuova.

## Si riusa quello che c'è, e non è pigrizia

**Misurato prima di scrivere**: `cash_movements` porta già `entity_id`, e
**47 funzioni** del database filtrano già per soggetto (cercato `p_entity`
nei corpi vivi, non nei nomi). Un impianto parallelo avrebbe rifatto la prima
nota, i saldi, l'esportazione e le causali — e ognuno di quei pezzi sarebbe
potuto divergere dal suo gemello.

⚠️ **E la forma di `getEntities()` è ciò che tiene la tasca fuori dalle
schermate fiscali senza nessun filtro**: restituisce i soggetti **per nome**
(`srls`, `agricola`, `tasca`), e chi apre un menu a tendina nomina quelli che
vuole. Le **diciannove** schermate che esistevano prima di oggi non possono
offrirla — non perché qualcuno si è ricordato di escluderla, ma perché non la
nominano.

## Quello che si vede

Si registra dalla **Prima nota**, scegliendo il soggetto. Lì il verso è **uno
solo**, e la schermata **dice perché** invece di sembrare rotta — un pulsante
che sparisce senza spiegazione si legge come un guasto.
⚠️ **E cambiando soggetto con «entrata» già scelto il verso torna su
«uscita»**: altrimenti il salvataggio verrebbe respinto per una scelta fatta
*prima* di cambiare soggetto, cioè un rifiuto che non c'entra col gesto.

⚠️ **`speso_dalla_tasca()` non si chiama «saldo»**, ed è una scelta: da lì
escono soldi e basta, quindi un saldo sarebbe sempre negativo e si
leggerebbe come un debito. Quello che Alessio ha chiesto è il **conto**:
quanto ha speso e per cosa, diviso per causale.

## Come è stata provata

🔴 **Due rotture su controlli diversi**, come vuole la regola:

| rottura | cosa diventa rosso |
|---|---|
| la guardia smette di rifiutare le **entrate** | *«Un'entrata sulla tasca NON è stata respinta»* |
| la guardia **sovrascrive in silenzio** una regola diversa | *«Una regola deducibile sulla tasca NON è stata respinta»* |

⚠️ **Il blocco di verifica è stato estratto e lanciato da solo**: riapplicare
la migrazione avrebbe rimesso a posto la funzione buona *prima* di
verificarla, e la rottura sarebbe stata cancellata dalla cosa stessa che
doveva metterla alla prova (lezione del 26/08).

🔴 **E rimettendola a posto la rete delle guardie mi ha fermato**, che è la
prova che quella rete funziona: il corpo vivo era ancora quello rotto (col
messaggio accorciato), e `npm run prova:migra` ha rifiutato di riscrivere la
funzione perché «perdeva» una riga rispetto al vivo. Rimessa applicando **il
solo blocco della funzione**, e ricontrollata leggendo il corpo dal database.

✅ **La verifica vive dentro una sotto-transazione ANNULLATA** — la strada
decisa stasera: non si cancella niente, il registro delle cancellazioni resta
acceso per tutto il tempo, e `pretendi_nessun_residuo()` controlla che dopo
non sia rimasto niente in nessuna delle 119 tabelle.

**Sei controlli**, di cui **tre al contrario** (l'entrata respinta, la regola
respinta, i parametri fiscali respinti) e uno che controlla che **la società
non sia toccata** — là un'entrata con una regola deducibile passa ancora.

---

## Cosa abbiamo rovesciato

**Niente.** La tasca è un soggetto nuovo: non toglie e non cambia nessuna
decisione in vigore. In particolare **non tocca** le anticipazioni del socio
(15/08), che restano il posto dove va una spesa che la società rimborsa.

⚠️ Nessuna riga in [`decisioni_rovesciate.md`](../decisioni_rovesciate.md).

---

## Cosa NON è verificato

* 🔴 **LA SCHERMATA DELLA PRIMA NOTA NON È STATA APERTA.** Per aprirla serve
  entrare, e questa sessione ha scelto di **non digitare nessun PIN**: quello
  di collaudo finirebbe scritto qui dentro. Quindi il menu a tre voci, la
  frase che spiega la tasca e il verso unico **non li ha visti nessuno** —
  sono scritti e compilati, non guardati.
* **In produzione la tasca non esiste ancora**: la migrazione aspetta il
  push. Sul progetto di prova i soggetti sono **tre** (misurato) e la tasca
  ha **zero movimenti**, che è lo stato di partenza voluto — il gestionale
  non ne inventa nessuno.
* **Nessuna spesa vera è mai stata registrata sulla tasca**: tutto ciò che è
  provato sta dentro la verifica della migrazione, e quella si annulla.
