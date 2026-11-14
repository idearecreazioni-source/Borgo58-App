// I dati inventati delle prove sul file XML delle fatture ai clienti.
// La partita IVA è quella vera di Borgo 58 (già nelle migrazioni); tutto il resto è di fantasia.

export const SOCIETA = {
  legal_name: "Borgo 58 S.r.l.s.",
  vat_number: "01343950869",
  tax_code: "01343950869",
  vat_regime: "ordinario",
  sede_indirizzo: "Via Roma 1",
  sede_cap: "84043",
  sede_comune: "Agropoli",
  sede_provincia: "SA",
  sede_nazione: "IT",
  rea_ufficio: "SA",
  rea_numero: "123456",
  capitale_sociale: 1000,
  socio_unico: "SU",
  pec: "borgo58@pec.it",
  iban: "IT60X0542811101000000123456",
};

export const DITTA = {
  denominazione: "Rossi & Figli S.r.l.",
  partita_iva: "12345678903",
  codice_fiscale: null,
  indirizzo: "Corso Italia 10",
  cap: "80100",
  comune: "Napoli",
  provincia: "NA",
  nazione: "IT",
  codice_destinatario: "KRRH6B9",
  pec: null,
};

export const PERSONA = {
  nome: "Maria",
  cognome: "D'Amico",
  partita_iva: null,
  codice_fiscale: "DMCMRA80A41H703V",
  indirizzo: "Via del Mare 3",
  cap: "84043",
  comune: "Agropoli",
  provincia: "SA",
  nazione: "IT",
  codice_destinatario: null,
  pec: "maria@pec.it",
};

export const CONTO = {
  data: "2027-01-15",
  numero: 1,
  anno: 2027,
  causale: "Conto del tavolo 7",
  modalita_pagamento: "MP08",
  prezzi_ivati: true,
};

export const RIGHE = [
  { posizione: 1, descrizione: "Pasta e fagioli", quantita: 4, prezzo_unitario: 27.5, aliquota_iva: 10 },
  { posizione: 2, descrizione: "Coperto", quantita: 4, prezzo_unitario: 3, aliquota_iva: 10 },
  { posizione: 3, descrizione: "Bottiglia d'acqua", quantita: 3, prezzo_unitario: 2.5, aliquota_iva: 22 },
];
