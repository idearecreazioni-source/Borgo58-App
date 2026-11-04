-- =====================================================================
-- L'ANNULLO DAL GESTIONALE È SOSPESO — 04/11/2026, collaudo dal fornitore.
-- =====================================================================
--
-- 🔴 COSA È SUCCESSO. Sul registratore di prova (in modalità MF, non RT:
--    lo scontrino dice «SF.» e ha il logo «/F») il «VOID …» è stato
--    stampato come una riga di testo, e le righe dello scontrino che il
--    ponte mandava dopo sono diventate una VENDITA NUOVA (11:23 e 11:51).
--    Il manuale Epson Rev. U, §5.6 (pag. 45): il documento di annullo c'è
--    solo sui registratori RT.
-- 🔴 COSA FA QUESTA MIGRAZIONE. Finché `annullo_sospeso()` è vero, nessun
--    lavoro 'annullo' può entrare nella coda — qualunque funzione lo chieda
--    — e quelli già in coda diventano falliti senza partire. Così nemmeno
--    un ponte vecchio, che lo manderebbe con le righe di vendita, ne trova
--    uno da prendere.
-- ⚠️ Non riscrive nessuna funzione: si applica da sola, anche prima delle
--    migrazioni 000003-000005, e non tocca scontrini, chiusure e comande.
-- ⚠️ Per riaccenderlo: una migrazione che fa tornare falso
--    `annullo_sospeso()`, dopo una prova su un registratore in modalità RT
--    e col sì di Alessio.

create or replace function public.annullo_sospeso()
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select true
$function$;

revoke all on function public.annullo_sospeso() from public, anon, authenticated;
comment on function public.annullo_sospeso() is
  'Vero finché l''annullo dello scontrino dal gestionale è sospeso (dal 04/11/2026, collaudo: il VOID è uscito come vendita su un registratore in modalità MF).';

create or replace function public.annullo_non_entra_in_coda()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.tipo = 'annullo' and annullo_sospeso() then
    raise exception 'L''annullo dal gestionale è sospeso: fallo a mano dal registratore.';
  end if;
  return new;
end $function$;

revoke all on function public.annullo_non_entra_in_coda() from public, anon, authenticated;

drop trigger if exists annullo_non_entra_in_coda on lavori_stampa;
create trigger annullo_non_entra_in_coda
  before insert on lavori_stampa
  for each row execute function annullo_non_entra_in_coda();

-- Gli annulli che aspettano: falliti, non partono.
update lavori_stampa
   set stato = 'fallito', finito_il = now(), errore_codice = 'rifiutato',
       errore_testo = 'L''annullo dal gestionale è stato sospeso prima che partisse: fallo a mano dal registratore.'
 where tipo = 'annullo' and stato = 'in_coda';

-- Verifica
do $verifica$
declare
  v_disp uuid;
  v_ok   boolean := false;
begin
  if not annullo_sospeso() then
    raise exception 'VERIFICA: l''annullo non risulta sospeso.';
  end if;
  if exists (select 1 from lavori_stampa where tipo = 'annullo' and stato = 'in_coda') then
    raise exception 'VERIFICA: è rimasto un annullo in coda.';
  end if;
  begin
    -- Anche scrivendo nella tabella, un annullo non entra.
    select id into v_disp from dispositivi limit 1;
    insert into lavori_stampa (dispositivo_id, tipo) values (v_disp, 'annullo');
  exception when others then v_ok := sqlerrm like '%sospeso%';
  end;
  if not v_ok then
    raise exception 'VERIFICA: con l''annullo sospeso un annullo è entrato in coda.';
  end if;
  raise notice 'Fatto: l''annullo è sospeso; nessun annullo può entrare nella coda, e nessuno ci aspetta.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261104000006', 'l_annullo_e_sospeso')
on conflict (version) do nothing;
