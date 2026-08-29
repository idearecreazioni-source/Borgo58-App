select 'ingredienti' as che, count(*)::text as n from ingredients
union all select 'con lotti', (select count(distinct ingredient_id)::text from stock_lots where quantity_remaining > 0)
union all select 'lotti attivi', (select count(*)::text from stock_lots where quantity_remaining > 0)
union all select 'lotti scaduti', (select count(*)::text from stock_lots where quantity_remaining > 0 and expiry_date < current_date)
union all select 'preparazioni (source_type)', (select count(*)::text from ingredients where preparazione_id is not null)
union all select 'fuori magazzino', (select count(*)::text from ingredients where not coalesce(tenuto_in_magazzino,true))
union all select 'source_type valori', (select string_agg(distinct coalesce(source_type::text,'(vuoto)'), ', ') from ingredients);
