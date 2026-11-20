-- =====================================================================
-- IL LISTINO DEI MODELLI AI, CORRETTO CON IL CONTO VERO — 20/11/2026
-- =====================================================================
--
-- Il 20/11 Alessio ha aperto la Console di Anthropic (pagine «Costo» e
-- «Utilizzo API», ultimi 30 giorni) e ci ha dato costi e token per modello.
-- Confrontati con il listino ufficiale, i prezzi in `costo_modello_ai` erano:
--   - claude-opus-5: 15 / 75 € per milione, segnato PROVVISORIO. Il listino
--     e' 5 / 25 dollari: la riga costava il triplo del vero.
--   - claude-sonnet-5: 2,75 / 13,75 €. Il listino e' 2 / 10 dollari: la riga
--     era circa il 50% sopra il vero (prudente, ma fermava prima del dovuto).
--   - mancavano Sonnet 5.5, Opus 5.5 e Haiku 5.5: senza la riga, MEMO si
--     ferma con «tetto» appena passa a quei modelli.
--
-- Listino in dollari (per milione di token, ingresso / uscita):
--   Sonnet 5 2 / 10 · Sonnet 5.5 2 / 10 · Opus 5 5 / 25 · Opus 5.5 4 / 20 ·
--   Haiku 5.5 0,10 / 0,50 (prompt fino a 100.000 token).
-- Conversione in euro: x 0,92, lo stesso cambio che gia' regge la riga di
-- Haiku 4.5 (1 / 5 dollari = 0,92 / 4,60 €), che resta com'e'.
--
-- ⚠️ La tabella non ha colonne per la cache dei prompt (lettura a un decimo,
--    scrittura a 1,25 volte): il costo calcolato qui conta ogni token
--    d'ingresso a prezzo pieno. E' una scelta prudente: il conto vero puo'
--    solo essere piu' basso.
-- ⚠️ I costi gia' scritti nelle righe (chat, voce, foto, ricetta) non si
--    toccano. Archivio e posta si calcolano al momento dal listino: per
--    questi, i conti passati con Opus 5 scendono al valore vero.
--
-- Idempotente (si puo' rilanciare), con verifica finale: se un prezzo non e'
-- quello scritto qui, la migrazione si ferma.
-- =====================================================================

insert into costo_modello_ai (modello, euro_milione_in, euro_milione_out, nota, aggiornato_il) values
  ('claude-opus-5',     4.6000, 23.0000, 'Listino 5 / 25 dollari per milione di token, convertito x 0,92. Confermato con il conto della Console del 20/11/2026 (Opus 5: 79.224 token, 0,51 dollari).', now()),
  ('claude-sonnet-5',   1.8400,  9.2000, 'Listino 2 / 10 dollari per milione di token, convertito x 0,92. Confermato con il conto della Console del 20/11/2026 (Sonnet 5: 3,8 milioni di token, 7,22 dollari).', now()),
  ('claude-sonnet-5-5', 1.8400,  9.2000, 'Listino 2 / 10 dollari per milione di token, convertito x 0,92. Console del 20/11/2026: 27.047 token, 0,11 dollari.', now()),
  ('claude-opus-5-5',   3.6800, 18.4000, 'Listino 4 / 20 dollari per milione di token, convertito x 0,92. Console del 20/11/2026: 43.400 token, 0,30 dollari.', now()),
  ('claude-haiku-5-5',  0.0920,  0.4600, 'Listino 0,10 / 0,50 dollari per milione di token (prompt fino a 100.000 token), convertito x 0,92. Non ancora usato.', now())
on conflict (modello) do update
   set euro_milione_in  = excluded.euro_milione_in,
       euro_milione_out = excluded.euro_milione_out,
       nota             = excluded.nota,
       aggiornato_il    = excluded.aggiornato_il;

do $verifica$
declare
  v_attesi constant text[][] := array[
    ['claude-opus-5',            '4.6000', '23.0000'],
    ['claude-sonnet-5',          '1.8400',  '9.2000'],
    ['claude-sonnet-5-5',        '1.8400',  '9.2000'],
    ['claude-opus-5-5',          '3.6800', '18.4000'],
    ['claude-haiku-5-5',         '0.0920',  '0.4600'],
    ['claude-haiku-4-5-20251001','0.9200',  '4.6000']];
  v_i integer;
  v_in numeric;
  v_out numeric;
begin
  for v_i in 1 .. array_length(v_attesi, 1) loop
    select euro_milione_in, euro_milione_out into v_in, v_out
      from costo_modello_ai where modello = v_attesi[v_i][1];
    if v_in is distinct from v_attesi[v_i][2]::numeric
       or v_out is distinct from v_attesi[v_i][3]::numeric then
      raise exception 'Listino sbagliato per %: trovato % / %, atteso % / %',
        v_attesi[v_i][1], v_in, v_out, v_attesi[v_i][2], v_attesi[v_i][3];
    end if;
  end loop;
end
$verifica$;
