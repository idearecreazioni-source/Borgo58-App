# La posta chiede se la fattura c'è già (08/11/2026)

Migrazione `20261108000002_la_posta_chiede_se_la_fattura_c_e_gia`. È la correzione del difetto trovato alla prima PEC vera dopo il rilascio, la fattura 330/F.

## Il difetto
- `posta-leggi` leggeva `supplier_invoices` con la chiave di servizio per sapere se la fattura era già registrata.
- Quella chiave non può leggere le tabelle dei soldi, apposta (20260812000003). La risposta era 403.
- La mail restava «da leggere», veniva ripresa ogni 15 minuti e partiva l'avviso «posta letta a metà».
- Le prove non lo vedevano: nessuna parla al database come la chiave di servizio.

## La correzione
- **Niente permesso sulla tabella.** Al suo posto c'è `fattura_gia_registrata_per_la_posta(text[])`:
  - la può chiamare solo la chiave di servizio;
  - dati 1 o 2 nomi del file SdI, risponde numero, data e quando è stata registrata la fattura, oppure niente;
  - non escono importi né fornitori.
- **posta-leggi** la chiama al posto della lettura diretta.
- `registra_fattura_dalla_posta` ed `esegui_azione_posta` non hanno lo stesso buco: le chiama il titolare col suo accesso.

## Controlli
- **Verifica dentro la migrazione** (si annulla da sola):
  - la chiave di servizio resta senza accesso alle fatture;
  - la lettura diretta è rifiutata;
  - una .xml.p7m è trovata col nome .xml, come la 330/F;
  - un file nuovo non dà righe;
  - una lista lunga non ha risposta;
  - anon e utenti non la possono chiamare.
- **Prova unitaria** sul codice di posta-leggi: fallisce senza la correzione e passa con.
- **Revisione `ecc:database-reviewer`:** nessun problema CRITICAL, HIGH o MEDIUM.

## Da tenere d'occhio (non toccati qui)
Con la stessa chiave, `posta-leggi` legge anche altre tre cose che non le sono concesse:
- `service_settings`: il tetto dei tentativi;
- `suppliers`: l'elenco dei fornitori per il carico;
- `vocabolari_per_assistente()`: gli elenchi.

Lì un rifiuto non blocca la lettura, ma il programma va avanti senza quei dati.

## Applicazione su work
I numeri si aggiungono dopo.
