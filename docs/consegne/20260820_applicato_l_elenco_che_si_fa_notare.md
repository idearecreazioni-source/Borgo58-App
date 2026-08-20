# Applicato: l'elenco che si fa notare

**Migrazione applicata**: `20260820000004_l_elenco_che_si_fa_notare` — **1 su 1**,
dopo il push di Alessio.
**Corridoio**: `operazioni-atomiche` **v30 → v31** in produzione
(`segnala_scontrino_non_uscito`).

---

## I numeri veri, letti dalla produzione dopo l'applicazione

| | |
|---|---|
| migrazioni | **154** (erano 153) |
| ricette · voci di storia dei costi | **0 · 0** |
| menu · ingredienti | **0 · 8** |
| tracce nel registro delle cancellazioni | **26** — *invariate* |
| movimenti di cassa | **0** — *invariati* |
| conti · di cui aperti | **8 · 0** — *invariati* |
| conteggi del cassetto | **0** |
| segnalazioni della sala | **0** |

Le reti di sorveglianza, tutte ferme: **16** funzioni senza portiere, **10**
aperte ad anon, **0** date a Greenwich, **0** lapidi di prova, **0**
predefiniti di data, **0** policy al ruolo pubblico.

⚠️ **Il 16 non è cambiato** anche con quattro funzioni nuove: `conti_senza_documento`
e `segnala_scontrino_non_uscito` non sono nell'elenco perché la prima ha
l'esecuzione **revocata a tutti** (la chiamano solo altre funzioni) e la
seconda **non è `security definer` senza controllo** — pretende un utente
autenticato e rifiuta di disfare una fattura. Le due funzioni di lettura hanno
il portiere.

---

## 🔴 La rete è ARMATA, e scatterà alla prima chiusura di cassa

Misurato subito dopo l'applicazione, invece di dedurlo:

> **conti che farebbero scattare la rete oggi: 1**

È **«Divano 3»**, chiuso il **15/08 alle 22:23**, 2 coperti a 5,00 € — uno dei
conti di collaudo. Non ha nessun documento fiscale, quindi la **prima volta
che Alessio conterà il cassetto il gestionale rifiuterà**, dicendogli che c'è
un conto incassato senza documento.

⚠️ **Non l'ho sistemato io, ed è una scelta**: è un dato vero, e deciderne il
destino non è una cosa da fare per rendere più liscia una consegna. Le due
strade sono entrambe legittime — segnarlo scontrinato da *Cassa → Incassato e
scontrinato*, oppure chiudere la giornata prendendone atto — e la scelta è
sua. ⚠️ **Va comunque tolto con gli altri dati di collaudo** prima della prima
fattura vera (`npm run collaudo:stato`).

✅ **E come dimostrazione vale più di qualunque prova**: la rete non è un
meccanismo che aspetta marzo 2027 per farsi vedere. È accesa adesso, e ha già
qualcosa da dire.

---

## ⚠️ Cosa NON è verificato

1. 🔴 **Nessuna mano ha premuto niente**: né il rifiuto alla chiusura della
   giornata, né la schermata nuova della sala. In questo progetto nessuna
   prova guarda una schermata.
2. 🔴 **Non esiste nessun registratore**, quindi il giro vero — chiudo il
   conto, lo scontrino non esce — non è mai avvenuto. È provato cosa succede
   *dopo*.
3. ⚠️ **Zero conteggi del cassetto in produzione**: la rete non ha mai
   incontrato una serata vera, e la prima volta sarà quella di Alessio.
4. ⚠️ **Il punto di contatto col registratore non è mai stato sostituito da
   niente**: che sia sostituibile è un'affermazione, non una misura. Lo
   diventa col simulatore (blocco 2).

---

## Cosa abbiamo rovesciato

**Nessun rovesciamento in questo passaggio.**

---

## Per Alessio, in una riga

È in produzione e non si è mosso nessun numero del locale — ma attenzione: la
prima volta che conti il cassetto il gestionale ti fermerà, perché il conto
«Divano 3» del 15 agosto è incassato e non ha uno scontrino.

---

**Commit**: `ec98196` — «Applicato in produzione: l'elenco che si fa
notare».
**Working tree**: pulito.
**Migrazioni**: 154 in produzione, **1 applicata in questo giro**.
**Corridoio**: v31 in produzione.
**Prove**: 152 pure + 242 sull'app, tutte verdi.
