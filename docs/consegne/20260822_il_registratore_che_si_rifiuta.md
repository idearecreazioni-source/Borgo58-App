# Il registratore che si rifiuta — blocco 2

**Mandato del 20/08**, blocco 2. **Nessuna migrazione.** 17 prove nuove
(10 pure, 7 sui dati veri).

⚠️ **Nota di processo, dichiarata perché non si perda**: tre file di questo
blocco — `src/lib/registratoreSimulato.js` e le due prove — sono finiti
**dentro il commit precedente** (`c8675bf`, i due mesi finti) per un mio
`git add -A`. Quel messaggio non li nomina. Non riscrivo la storia: sono
scritti qui.

---

## 1 · La misura, prima di costruire

### Cosa esiste già, e cosa NON copre

| pezzo | cosa fa | cosa **non** copre |
|---|---|---|
| `orders.documento_fiscale` | `null` · `scontrino` · `fattura_da_emettere` · `fattura` | niente distingue *«non è uscito»* da *«non l'ho ancora segnato»* — ma è voluto: `null` significa la seconda, e resta in elenco |
| `conti_da_fiscalizzare()` | l'elenco dei conti incassati senza documento | **solo quelli che il gestionale sa scoperti** |
| `quadratura_fiscale()` | incassato contro fiscalizzato, con la differenza in euro | 🔴 **la pagina bianca**: quel conto risulta scontrinato, e la quadratura dice che è tutto a posto |
| `segnala_scontrino_non_uscito()` | rimette il conto in elenco e lascia traccia | — (concessa a `authenticated`: **anche lo staff**, com'è giusto) |

**Misurato in produzione di prova**: 56 conti chiusi, **0 con documento
fiscale**, `quadratura_fiscale` dice *incassato 5.105 € · fiscalizzato 0 € ·
56 conti da fare*. La rete funziona.

### 🔴 Il reperto che il mandato cercava

> *«Il punto di contatto è dichiarato sostituibile, ma non è mai stato
> sostituito da niente, quindi che sia sostituibile è un'affermazione, non
> una misura.»*

**Misurato: `emettiScontrino` non è chiamata da nessuna schermata.** L'unico
posto che la importa è una prova automatica del blocco 1.

⚠️ **Quindi oggi la fiscalizzazione è tutta a mano**: da *Cassa →
Incassato e scontrinato*, Alessio segna conto per conto con
`setDocumentoFiscale`. Il registratore non viene interpellato **mai**.

**Cosa vuol dire per questo blocco**: il simulatore *può* prendere il posto
del punto di contatto — stessa firma, stessi esiti, e c'è una prova che lo
verifica — **ma non c'è ancora nessuna chiamata da sostituire nel giro
vero**. L'aggancio «chiudo il conto → lo scontrino esce» **non esiste**, e
costruirlo è una decisione di prodotto, non un dettaglio: 🔵 **la lascio ad
Alessio invece di forzarla**, come chiedeva il mandato.

### E cosa succede oggi se la stampa fallisce — provato, non dedotto

Non può fallire, **perché non avviene**. Il conto si chiude sempre, l'incasso
c'è, il documento resta vuoto e il conto finisce nell'elenco. È esattamente
il comportamento che il mandato vuole — ci si arriva però perché il
registratore non è collegato, non perché qualcuno abbia gestito il guasto.

---

## 2 · I modi di fallire: misurati, e **non combaciano**

`registratore.js` dichiara cinque esiti. Il mandato chiede quattro guasti.
Confrontati:

| guasto chiesto | esiste come esito? |
|---|---|
| stampante **muta** | ✅ `MUTO` |
| risposta **a metà** | ✅ `A_META` |
| **doppia stampa** | ❌ **non è un esito** — è `FATTO` due volte |
| **pagina bianca** | ❌ **non può esserlo** — l'apparecchio risponde `FATTO` con un numero regolare |

🔴 **E le due che mancano sono le due che contano.** Non è una dimenticanza
di chi ha scritto gli esiti: sono guasti che **il protocollo non può
riportare**, perché dal lato della macchina è andato tutto bene. *Un
simulatore che riproducesse solo i cinque esiti dichiarati simulerebbe
esattamente i guasti che il gestionale sa già gestire* — cioè non
servirebbe a niente.

**Per questo il simulatore tiene separate due cose**: `risposte` (il
protocollo) e `stampate` (**la carta**). Nella pagina bianca il protocollo
dice «fatto» e la carta è vuota; tenerli insieme renderebbe impossibile
provare proprio il caso per cui questo blocco esiste.

---

## 3 · Cosa si può provare adesso, senza hardware

`creaRegistratoreSimulato({ guasto })`, sette guasti accendibili uno per
volta. Provato:

- **muto, a metà, errore, non collegato** → lo scontrino non risulta emesso,
  il conto **resta chiuso** (la sala non si blocca mai) e **senza
  documento**;
- 🔴 **pagina bianca** → il gestionale lo segna emesso **e ha ragione a
  farlo**: la risposta è indistinguibile da una riuscita, campo per campo. Il
  conto **sparisce dall'elenco** mentre fiscalmente non esiste niente. Poi la
  segnalazione manuale lo rimette dentro e **toglie anche il numero** —
  altrimenti resterebbe il riferimento a uno scontrino mai uscito;
- **doppia stampa** → due fogli sulla carta, **un conto solo**. È la regola
  del 15/08 (*«i conti chiusi sono l'unica fonte dei ricavi»*) guardata dal
  lato in cui potrebbe rompersi: se gli incassi si contassero dalla carta,
  questo li raddoppierebbe.

### ✅ E la rottura, come chiedeva il mandato

Fatto finta che **tutto vada sempre bene** — cioè il simulatore che risponde
`fatto` e stampa sempre:

> **14 prove su 17 diventano rosse**, e sono quelle giuste: i quattro guasti,
> la pagina bianca, la doppia stampa, e quella che dice *«nessun controllo
> sulla risposta può accorgersene»*.

Se non fossero diventate rosse, il simulatore starebbe simulando il successo
e basta.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Il simulatore non è agganciato a niente** (§1): riproduce i guasti e
   le prove li esercitano, ma **nessuna schermata del gestionale chiede uno
   scontrino**. Il giorno che l'aggancio esisterà, queste prove diranno se
   regge — oggi dicono che il simulatore è pronto.
2. ⚠️ **Nessun interruttore a schermo.** I guasti si accendono dal codice
   delle prove. Un pannello per Alessio serve **dopo** l'aggancio: prima non
   avrebbe niente da far fallire.
3. ⚠️ **`a_meta` è modellato come «carta incerta»**: nel simulatore non esce
   niente, ma nella realtà la carta *può* essere uscita e il gestionale non
   lo sa. È il caso in cui la segnalazione manuale serve **nei due versi**, e
   la seconda direzione (segnare «in realtà è uscito») non esiste.
4. ⚠️ **Niente hardware, e nessun protocollo vero**: il simulatore è
   generico, come il mandato chiedeva.
5. **Blocchi 3 e 4 non toccati**, per mandato.

---

## Cosa abbiamo rovesciato

**Niente.** `registratore.js` non è stato modificato: il simulatore gli si
affianca senza toccarlo, ed è la prova che quella forma reggeva.

⚠️ **E in particolare non è stato rovesciato «oggi risponde sempre
non_collegato»**: resta la verità del gestionale vero — non c'è nessun
apparecchio. Il simulatore vive **accanto**, e lo usano le prove.
