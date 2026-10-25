-- LE OPERAZIONI DI MEMO DICHIARATE ALLE RETI (25/10/2026)
--
-- La `20261025000042` e' gia' applicata sul progetto di prova, quindi non si
-- riscrive (regola del 23/08): la dichiarazione che chiude il caso sta qui.
--
-- 🔴 IL CASO. La rete `tests/app/migrazioni-senza-portieri.test.js` accusa la
-- 0042 di chiamare `fai_operazione_memo()` in un blocco senza claims. Il
-- blocco e' `$fai$`, e il nome li' compare SOLO dentro le stringhe che la
-- migrazione incolla nel corpo di `fai_azione_dettata` prima di eseguirlo
-- con `execute`: e' la riscrittura di un corpo di funzione, non una
-- chiamata. Nessuna riga viene eseguita come titolare in quel blocco.
-- ⚠️ La depurazione della rete non tocca le stringhe di proposito (una
-- stringa che finisce in un `execute` PUO' essere una chiamata vera), quindi
-- qui si dichiara la coppia invece di allargare la depurazione.
--
-- rete-portieri: 20261025000042 chiama fai_operazione_memo — il nome sta solo nel testo dei rami incollati nel corpo di fai_azione_dettata ed eseguito come definizione; le chiamate vere sono nel blocco di verifica, che imposta i claims del titolare.
--
-- Questa migrazione non cambia niente: verifica che la riscrittura della
-- 0042 sia davvero nel corpo vivo, cosi' la dichiarazione non resta in piedi
-- se un giorno quel ramo sparisse.

do $verifica$
declare
  v_def text := replace(pg_get_functiondef('public.fai_azione_dettata(text,jsonb)'::regprocedure), E'\r', '');
  v_n   integer;
begin
  if to_regprocedure('public.fai_operazione_memo(text,jsonb)') is null then
    raise exception 'VERIFICA: fai_operazione_memo non esiste: la 0042 non e'' applicata qui.';
  end if;
  v_n := (length(v_def) - length(replace(v_def, 'then return fai_operazione_memo', '')))
         / length('then return fai_operazione_memo');
  if v_n <> 5 then
    raise exception 'VERIFICA: fai_azione_dettata manda a fai_operazione_memo % tipi invece di 5.', v_n;
  end if;
  raise notice 'Fatto: fai_azione_dettata manda i cinque tipi del blocco 1 a fai_operazione_memo; la dichiarazione alla rete dei portieri regge.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261025000043', 'le_operazioni_di_memo_dichiarate_alle_reti')
on conflict (version) do nothing;
