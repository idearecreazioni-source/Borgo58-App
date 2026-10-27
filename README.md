# Borgo 58 · Gestionale

Gestionale su misura per **Borgo 58 – Osteria Contemporanea** (Piazza Armerina, EN), apertura prevista marzo 2027. Sviluppato da Alessio Schillaci con Claude. **In produzione**: https://borgo58-app.pages.dev — ogni push su `master` ripubblica automaticamente (Cloudflare Pages).

Chi lavora nel progetto parte da **`CLAUDE.md`** (convenzioni operative, protocolli, stato dei lavori). L'autorità sulle decisioni di architettura è il Contratto Architetturale, versionato in **`docs/CONTRATTO.md`**; il dettaglio implementativo è in `docs/ARCHITETTURA.md`.

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4 + React Router 7 (SPA statica)
- **Dati**: Supabase (Postgres, EU) — permessi via RLS, migrazioni SQL versionate in `supabase/migrations/`
- **Operazioni multi-tabella**: Edge Function `operazioni-atomiche` → una funzione Postgres per operazione (una chiamata = una transazione)
- **Nessun server Node tradizionale**; mini-PC locale previsto per stampanti e registratore telematico

## Stato attuale

**Dei 15 moduli del brief ne restano 13.** L'11/10/2026 Alessio ha tolto Ricerca Ricorrente e Monitoraggio Social, che erano segnaposto senza schermate. Tutti i moduli rimasti hanno un'implementazione nel codice, e l'app è online con login reale a due ruoli (titolare/staff, barriera RLS). L'Agricolo/Orto è messo da parte nel menu finché l'azienda agricola non nasce, ma resta raggiungibile. Dettaglio aggiornato modulo per modulo in `CLAUDE.md` §7 — questo README non lo duplica.

Ricettario · Agenda · Fatture Fornitori · Magazzino · Cassa/Prima Nota · Calendario Eventi · HACCP · Agricolo/Orto (messo da parte) · Proiezione Fiscale · Personale & Buste Paga · Editor Menu · MEMO (foto e voce) · Archivio Documenti — più il modulo **Comande** (Sala e Bar su tablet).

## Sviluppo — setup di una macchina nuova

```
npm install
git config core.hooksPath .githooks
```

Il secondo comando è **obbligatorio, non opzionale**: attiva i controlli automatici pre-commit (lint a zero, build, verifica delle migrazioni). Su un clone nuovo non si attiva da solo — senza, i protocolli di `CLAUDE.md` §5 tornano affidati alla memoria.

Poi creare `.env` copiando `.env.example` (chiavi Supabase; la `anon` è pubblica per progettazione) e avviare:

```
npm run dev
```

Server di sviluppo su `http://localhost:5173` (raggiungibile anche dai tablet sulla stessa WiFi).
