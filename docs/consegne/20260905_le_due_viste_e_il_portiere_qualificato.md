# Le due viste economiche e il portiere qualificato

## Cosa entra in produzione

Entrano, in questo ordine, le migrazioni gia' verificate sul progetto di
prova:

1. `20260904000001_le_due_viste_dei_soldi_tornano_protette`
2. `20260905000001_il_portiere_qualificato_e_il_prezzo_di_sala`

La prima rimette `security_invoker` sulle viste `v_cash_balance` e
`v_discounts_gifts_monthly`, cosi' rispettano la RLS dell'utente che le
interroga. Aggiunge inoltre la rete di diagnosi riservata al titolare per
individuare viste che scavalcano la RLS.

La seconda corregge esclusivamente le reti di diagnosi: riconosce anche il
portiere scritto come `public.is_titolare()` e non considera il solo prezzo
di listino di `menu_items_display` un dato economico riservato. Non allarga
l'accesso a costi, margini, saldi o importi.

## Perimetro

Le migrazioni non inseriscono, aggiornano o cancellano dati applicativi. La
verifica interna legge soltanto catalogo PostgreSQL e una riga tecnica di
`user_roles` necessaria a chiamare le reti protette. Le viste, le tabelle,
le policy e i ruoli esistenti non vengono riscritti; la prima migrazione
cambia l'opzione di due viste e crea/aggiorna funzioni di diagnosi con i
relativi privilegi.

## Prove svolte prima della produzione

Entrambe le versioni risultano registrate sul progetto di prova. La prima e'
stata rieseguita con esito idempotente. Le prove di rete hanno verificato che
lo staff non ottiene dati dalle due viste finanziarie, il titolare mantiene
l'accesso, e la diagnosi riservata rifiuta lo staff. I controlli CI della PR
che contiene le due migrazioni sono verdi.

## Cosa resta da verificare dopo l'applicazione

Il comando di migrazione deve registrare ciascuna versione in
`applied_migrations` e confermare i metadati attesi. Non vengono svolte
prove con dati economici o utenti reali durante l'applicazione.
