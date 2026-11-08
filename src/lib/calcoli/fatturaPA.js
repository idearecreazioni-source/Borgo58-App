// Il lettore delle fatture elettroniche vive in `supabase/functions/_shared/`
// dall'08/11/2026: lo usano sia questa app (Importa fattura elettronica) sia
// le funzioni online della posta (la fattura che arriva dalla PEC). Una sola
// copia, così le due strade non leggono mai la stessa fattura in due modi.
export * from "../../../supabase/functions/_shared/fatturaPA.js";
