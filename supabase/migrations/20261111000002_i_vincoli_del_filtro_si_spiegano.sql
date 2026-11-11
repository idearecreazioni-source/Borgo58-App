-- I VINCOLI DEL FILTRO DELLA POSTA SI SPIEGANO (11/11/2026)
--
-- La 20261111000001 è già applicata sul progetto di prova, quindi non si
-- riscrive (regola del 23/08): le spiegazioni dei quattro vincoli di
-- `posta_filtri` che la rete delle prove ha trovato senza frase italiana
-- stanno qui. Non cambia nessun comportamento.

comment on constraint posta_filtri_mittente_check on posta_filtri is
  'Il mittente di una regola è un indirizzo di posta, scritto in minuscolo e senza spazi.';
comment on constraint posta_filtri_oggetto_tipo_check on posta_filtri is
  'Il tipo di oggetto di una regola è lungo almeno 3 lettere: uno più corto prenderebbe mail a caso. Per tutte le mail di un mittente si lascia vuoto.';
comment on constraint posta_filtri_modo_check on posta_filtri is
  'Una regola confronta l''oggetto in tre modi soltanto: uguale, inizia con, oppure contiene.';
comment on constraint posta_filtri_contiene_lungo on posta_filtri is
  'Una regola «contiene» ha bisogno di una frase di almeno 12 lettere: una parola corta prenderebbe anche mail utili.';

do $verifica$
declare
  v_n integer;
begin
  select count(*) into v_n
    from pg_constraint c
   where c.conrelid = 'public.posta_filtri'::regclass
     and c.contype = 'c'
     and nullif(btrim(coalesce(obj_description(c.oid, 'pg_constraint'), '')), '') is null;
  if v_n > 0 then
    raise exception 'VERIFICA: % vincoli di posta_filtri sono ancora senza spiegazione.', v_n;
  end if;
  raise notice 'Fatto: i vincoli del filtro della posta dicono in italiano perché rifiutano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261111000002', 'i_vincoli_del_filtro_si_spiegano')
on conflict (version) do nothing;
