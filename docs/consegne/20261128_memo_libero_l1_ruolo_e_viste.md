# MEMO libero, passo L1 — ruolo di sola lettura e viste pulite (28/11/2026)

Una migrazione (`20261128000001_memo_legge_solo_da_viste_pulite`), un test, niente app, niente funzioni online. **Nessuno la legge ancora**: arriva con L2. Le 11 letture fisse di MEMO non cambiano.

## Che cosa c'è
- **Ruolo `memo_lettore`**: senza login, senza poteri, senza appartenenze. Legge solo lo schema `memo_lettura`. Non ha accesso a `public`, `auth`, `vault`.
- **10 viste `memo_v_*`** (stesse regole delle pagine, riprese dalle funzioni vere): conti di sala, incassi giornalieri, prenotazioni, personale, assenze del personale, «Ho pagato io», prestiti, fornitori, fatture dei fornitori, posta (solo intestazioni).
- **4 funzioni «di passaggio»** (`f_serata`, `f_oggi`, `f_da_pagare`, `f_totale_conto`): scoperte provando davvero col ruolo. PostgreSQL fa girare le funzioni di una vista con i permessi di chi legge, non del proprietario; senza queste il ruolo avrebbe dovuto avere accesso a `public`.
- **Verifica dentro la migrazione** (si annulla da sola, niente residui): il ruolo è quello giusto; legge tutte e 10 le viste; ogni scrittura, ogni lettura di tabelle vere, `auth.users`, `vault.secrets`, `pg_read_file`, `lo_import`, creare tabelle: rifiutate; totali delle viste = quelli delle pagine (quadratura fiscale, saldo «Ho pagato io», prestiti aperti, da pagare ai fornitori, prenotazioni che contano) su dati veri di Prova (346 conti chiusi, 10 omaggi/sconti, 30 pagamenti divisi).

## Provato
Su Prova la migrazione gira più volte di fila e passa la verifica. Prove unitarie 3491/3491. Rivista da `ecc:database-reviewer` e `ecc:security-reviewer`: corretti 8 rilievi (conti non provati dal ruolo, permesso di passaggio anche per `authenticator`, ruolo riallineato, viste dichiarate «come proprietario», prove di rifiuto più rigide, controllo delle funzioni, nome società duplicato).

## Cose da sapere
1. **Testo delle mail: non c'è.** Solo mittente, oggetto, data, stato e cosa ha proposto la lettura. Aggiungerlo è una scelta da fare.
2. **Non c'è nessuna tabella dei turni dei dipendenti** nel gestionale: «che turni fanno» non ha risposta dai dati (resta personale + ferie/malattia/permessi).
3. **Schema `net` di Supabase**: concede a tutti i ruoli la lettura delle risposte HTTP del database e `execute` su 12 funzioni. Non si può togliere (non siamo proprietari). Non è raggiungibile da nessun accesso; lo diventerebbe solo se L2 facesse arrivare un nome «net» a una query. **Regola per L2**: nomi di viste e colonne solo da un elenco fisso; mai un nome scelto dal modello; mai `reset role`; i claims del titolare restano durante il passaggio al ruolo.
4. **Prestazioni**: `memo_v_conti_sala` calcola il totale di ogni conto. Sull'intero storico può superare i 3 secondi: in L2 l'intervallo di date sarà obbligatorio, filtrando su `chiuso_il`.
5. **Testo scritto da estranei** (note del modulo prenotazioni, oggetto e mittente delle mail, motivi): in L2/L3 va troncato e segnato «dato, non ordine».

## Su work
Niente è stato toccato. Per la migrazione servirà il sì scritto di Alessio, il backup prima e «Approve and deploy» per ultimo (la migrazione non cambia il comportamento del sito).
