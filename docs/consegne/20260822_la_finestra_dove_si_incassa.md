# La finestra dove si incassa — allargata, e una frase che non era più vera

**Nato da**: il collaudo di Alessio a 800 × 1280, calibrazione 74. Ingrandire
le scritte dentro un contenitore rimasto piccolo aveva tagliato «Omaggio» e
mandato «Pagano in due modi» su quattro righe.
**Nessuna migrazione, nessun tocco al database né allo scarico.**

---

## 1 · La finestra — misurata prima e dopo

| | prima | dopo |
|---|---|---|
| larghezza della finestra | **384 punti** (`max-w-sm`) | **753 punti** (`max-w-3xl`) |
| margine per lato, su uno schermo da 800 | 208 | **16** |
| i quattro modi di chiudere | 4 in fila, ~84 punti l'uno | **2 righe da 2**, 357 punti l'uno |
| etichette tagliate | «Omaggio» | **nessuna** |
| etichette che vanno a capo | «Pagano in due modi» su 4 righe | **nessuna** |

**Verificato riga per riga**, non a occhio: per ogni pulsante ho confrontato
la larghezza del contenuto con quella del pulsante (nessuno taglia) e ho
contato i rettangoli del nodo di testo (**tutti su una riga sola**: ×, Paga
contante, Paga carta, Pagano in due modi, Alla romana, Sconto, Omaggio,
Annulla tavolo).

⚠️ **I quattro modi restano su due righe anche con la finestra larga**, ed è
la scelta che il mandato indicava: in fila sarebbero 178 punti l'uno e
«Pagano in due modi» a 3,20 mm non ci sta. *Un'etichetta tagliata su un
pulsante che tocca i soldi è peggio di un pulsante in più in verticale.*

⚠️ **E il difetto era della stessa famiglia di quello della pianta di
stamattina**: una misura fissa (`max-w-sm`) dentro qualcosa che avrebbe
dovuto adattarsi. Ingrandire il contenuto senza guardare il contenitore lo fa
uscire, e il modo in cui esce è sempre lo stesso — **si taglia in silenzio**.

---

## 2 · 🔴 La didascalia: non era una didascalia, era una frase FALSA

Il mandato chiedeva di giudicare se fosse un avviso o una spiegazione, e di
dirlo. **È una terza cosa.** La frase era:

> «Nessun incasso viene registrato in cassa: l'integrazione con il
> registratore telematico (§3.2) arriverà con l'hardware.»

**Misurato sul database vero, leggendo `saldo_tesoreria` viva:**

```
contante_atteso = contante_prima_nota + incassi_contanti_sala + mance_in_cassa
```

e `incassi_contanti_sala` somma **le quote in contante dei conti chiusi**. La
schermata Cassa li mostra anche scomposti: *«+ X di sala (N conti)»*.

🔴 **Quindi quei soldi nel cassetto ci sono, e la frase dice il contrario.**
Era vera quando è stata scritta — fino al **14/08** il saldo di cassa
escludeva davvero gli incassi di sala — ed è stata superata dal lavoro sulla
tesoreria del **15/08**, che ha proprio tolto quell'avvertenza dalla
schermata Cassa perché non era più vera. **Qui è rimasta.**

⚠️ **Quello che resta vero è molto più stretto**: non nasce un *movimento* di
prima nota. Ma chi legge «nessun incasso viene registrato in cassa» capisce
che quei soldi non compaiono da nessuna parte, e va a cercarli.

**Tolta.** E **non** sostituita da una versione «scritta come avviso»: al
momento di incassare non c'è niente da avvertire. Il limite che esiste
davvero — com'è composto il cassetto teorico — è già scritto dov'è utile,
sotto il saldo in Cassa.

⚠️ **La lezione è più grande della frase**: *una frase giusta quando è stata
scritta, che nessuno ha riletto quando il gestionale è cambiato sotto.* È la
stessa forma dei conteggi scritti a mano che invecchiano — e non c'è nessun
controllo che se ne accorga, perché una frase non è un numero.

---

## 3 · 🔴 Un danno che ho fatto io, sul progetto di prova

Ripulendo il conto di prova ho lanciato una cancellazione con un perimetro
largo:

```sql
delete from deleted_records where table_name = 'order_items'
  and (record->>'order_id') not in (select id::text from orders);
```

Volevo togliere la traccia della mia riga. **Ne ha tolte 307**: tutte quelle
di righe di comanda i cui conti non esistono più — cioè quasi tutte quelle
del progetto di prova.

- **La produzione non è stata toccata**: lo strumento si rifiuta di girare
  sul database vero e non ci ha mai puntato. Misurato dopo: prova a **720**
  tracce rimaste, **zero** di `order_items`.
- **Le 303 prove sui dati veri passano tutte**: nessuna dipendeva da quelle
  righe. I guardiani delle migrazioni contano le tracce *prima e dopo* dentro
  la stessa esecuzione, quindi non si appoggiano allo storico.
- **Il conto rimasto l'ho poi tolto nel modo giusto**: mirato per
  identificativo, coi due trigger spenti e **riaccesi controllando** — che è
  come andava fatta anche la prima volta.

⚠️ **Perché è successo**: ho scritto un `delete` su una tabella-registro
**senza misurare prima quante righe avrebbe preso**. È esattamente la regola
che questo progetto applica alle migrazioni (§2: *mai una cancellazione fuori
da una migrazione con blocco di verifica*) e che ho applicato a uno script di
servizio come se lì non valesse — la stessa esenzione inventata del 17/08.
**Un comando di pulizia è codice come gli altri.**

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Non l'ha visto un occhio**: la finestra è misurata, non guardata. Se
   753 punti *sembrino* troppi o troppo pochi è un giudizio di Alessio.
2. ⚠️ **Su uno schermo più stretto di 384 punti** non ho misurato: lì la
   finestra prende tutta la larghezza meno i margini, come prima.
3. ⚠️ **Le altre finestre restano indietro**, come dichiarato nel giro
   precedente: preconto, conferme di annullamento, calibrazione — testo fino
   a 1,35 mm. Non toccate.
4. ⚠️ **Lo storico delle cancellazioni del progetto di prova non è più
   quello di prima** (§3). Si rifà da zero con una ricostruzione, se un
   domani servisse.

---

## Cosa abbiamo rovesciato

**Niente.** La finestra si allarga e una frase falsa se ne va: nessuna
decisione cambia.

⚠️ **E la frase tolta non è un rovesciamento della regola del 14/08** — *«il
limite va detto nella schermata, non sottinteso»* — che resta intera: quella
regola chiede di dichiarare i limiti **veri**, e questo non lo è più dal
15/08. Toglierla è ciò che quella regola impone, non un'eccezione.

---

## 4 · Cosa ho guardato

Con l'accesso di collaudo, a **800 × 1280**, `b58_pxcm` = **74**: aperto T3,
segnato un piatto, inviato, premuto **«Chiudi conto»**. La finestra misura
**753 punti da 16 a 769**, il contenuto è *Chiusura conto — T3 · 1× Caponata
di melanzane · 10,00 € · TOTALE 10,00 € · Paga contante · Paga carta · Pagano
in due modi · Alla romana · Sconto · Omaggio · Annulla tavolo* — e **la frase
sul registratore telematico non c'è più**.

**Suite**: 258 prove pure, 303 sui dati veri. Tutte verdi.
