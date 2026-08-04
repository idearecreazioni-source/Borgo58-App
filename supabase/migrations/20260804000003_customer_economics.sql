-- =====================================================================
-- Borgo 58 · Migrazione 0028 — Scheda cliente a due livelli (§3.14/§3.18)
-- =====================================================================
-- Completa l'Anagrafica Clienti con lo "storico sconti/omaggi ricevuti"
-- previsto da §3.14 e rimasto vuoto: quando l'anagrafica fu costruita
-- (20260802000009) il modulo Cassa non esisteva ancora, quindi non c'era
-- alcun dato economico da collegare. Ora c'è, e `discounts_gifts.
-- customer_id` è già in tabella dalla migrazione 20260802000011.
--
-- DUE LIVELLI, SENZA DUPLICARE IL CONTROLLO (§3.18): la scheda cliente è
-- condivisa con lo staff (§4 modulo 6, vista operativa) ma lo storico
-- sconti/omaggi è riservato al titolare (§3.4). Non serve una vista
-- "_display" né un `is_titolare()` in più: `discounts_gifts` ha già una
-- policy titolare-only (20260802000011), quindi la stessa query fatta
-- dallo staff torna semplicemente vuota. Il permesso vive dove è già
-- definito, non viene riscritto altrove — è il principio di §3.18, e una
-- regola sola è una regola che non può divergere da sé stessa.
-- Verificato dal vivo il 04/08/2026: sessione staff → 0 righe su
-- discounts_gifts anche interrogando l'API direttamente.
--
-- Qui serve quindi solo l'indice per la nuova interrogazione (per cliente
-- invece che per data), più la documentazione della scelta.
-- =====================================================================

create index idx_discounts_gifts_customer
  on discounts_gifts(customer_id)
  where customer_id is not null;

comment on index idx_discounts_gifts_customer is
  'Storico sconti/omaggi per singolo cliente nella sua scheda (§3.14). Parziale: la maggior parte dei movimenti non avrà un cliente identificato (§3.4 — il collegamento è opzionale, "quando identificabile").';

-- ---------------------------------------------------------------------
-- Nota su un campo di §3.14 che resta NON calcolabile: la spesa media
-- ---------------------------------------------------------------------
-- §3.14 elenca tra i dati derivati anche "spesa media" per cliente.
-- Continua a non essere calcolabile, e non è una dimenticanza:
-- il modulo Cassa registra la PRIMA NOTA (uscite, versamenti, movimenti
-- bancari), non le vendite per singolo cliente. Un incasso per cliente
-- esisterà solo con le comande e il registratore telematico (§3.2,
-- strada C, hardware previsto autunno 2026).
--
-- Ciò che è calcolabile oggi è solo il valore di quanto quel cliente ha
-- ricevuto in sconti e omaggi — che è comunque l'informazione utile per
-- lo scopo dichiarato in §3.4 (accorgersi di un cliente che riceve
-- omaggi con una frequenza fuori scala). La spesa media va aggiunta
-- quando esisteranno le comande, mai stimata nel frattempo.
