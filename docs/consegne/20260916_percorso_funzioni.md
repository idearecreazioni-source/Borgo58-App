# 16/09/2026 — Il percorso delle funzioni non cambia

## Perché

Il Security Advisor di Borgo58-Prova segnalava quindici funzioni di `public`
con **Function Search Path Mutable**. Tutte erano `SECURITY INVOKER`, senza
`search_path` esplicito: non scavalcavano la RLS, ma un chiamante poteva
influenzare lo schema in cui risolvere i nomi non qualificati.

## Cosa cambia

- **Migrazione `20260916000001_il_percorso_delle_funzioni_non_cambia.sql`** —
  imposta `search_path=public` sulle quindici firme segnalate, una per una.
  Non ricrea corpi di funzioni e non cambia dati, RLS, trigger o permessi.
  Il blocco di verifica controlla che tutte le firme esistano e abbiano la
  configurazione esatta prima di registrare la migrazione.

## Prova eseguita su Borgo58-Prova

- Collegamento verificato al solo progetto `bnwqgpuyzmzujxfbtyvs`.
- Applicazione atomica: 15 `ALTER FUNCTION`, verifica interna passata e
  `20260916000001` registrata.
- Controllo successivo in sola lettura: **15 su 15** funzioni con
  `search_path=public`.
- Chiamata come ruolo `authenticated`: `azione_percorso('promemoria')` ha
  restituito `/agenda/nuovo`; `normalize_phone('+39 (02) 123-456')` ha
  restituito `+3902123456`.

## Cosa non cambia

- Nessuna modifica è stata fatta in produzione.
- L'avviso relativo a `pg_net` resta documentato come non applicabile:
  l'estensione è gestita da Supabase e lo schema tecnico `net` non è esposto
  dalla Data API.

## Passo successivo

Controllo del diff e della proposta; soltanto dopo un ok separato si potrà
valutare il merge e, in un secondo momento, l'applicazione in produzione.
