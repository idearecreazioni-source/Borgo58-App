@echo off
title Borgo 58 - gestionale di PROVA (parte da solo all'accensione)
cd /d "C:\Users\User\Desktop\Claude code\Borgo58-App"

rem =====================================================================
rem  PERCHE' QUESTO FILE ESISTE - 30/08/2026
rem =====================================================================
rem
rem  Alessio: dopo un riavvio del computer, dal telefono si vede solo
rem  BIANCO. Non e' un guasto: il tunnel che porta il telefono qui e'
rem  ancora vivo (Tailscale riparte da solo, e' un servizio di Windows),
rem  ma il GESTIONALE no - e un tunnel puntato a una porta dove non
rem  risponde nessuno da' una pagina vuota, senza spiegare niente.
rem
rem  Copiando questo file nella cartella "Esecuzione automatica" di
rem  Windows, il gestionale di prova riparte da solo a ogni accensione e
rem  il caso non si presenta piu'.
rem
rem  COME SI INSTALLA (una volta sola):
rem    1. premi i tasti Windows + R;
rem    2. scrivi   shell:startup   e premi Invio: si apre una cartella;
rem    3. trascina dentro una COPIA di questo file.
rem  Per toglierlo: cancella la copia da quella cartella.
rem
rem  =====================================================================
rem  ⚠️ QUESTO APRE IL DATABASE DI **PROVA**, NON IL LOCALE VERO.
rem  =====================================================================
rem  E' voluto, ed e' la ragione per cui non si usa "Avvia Borgo 58.bat":
rem  quello lancia `npm run dev`, che si collega al gestionale VERO. Un
rem  file che parte da solo a ogni accensione e apre il locale vero e' il
rem  modo piu' facile di scrivere dati finti nei dati veri senza
rem  accorgersene.
rem  In basso a destra, in ogni schermata, c'e' un pallino: ARANCIONE =
rem  database di prova. Se lo vedi SCURO, questa finestra sta aprendo il
rem  locale vero: chiudila.
rem =====================================================================

echo.
echo   ============================================
echo     BORGO 58 - gestionale di PROVA
echo   ============================================
echo.
echo   Questa finestra tiene acceso il gestionale di prova
echo   e l'indirizzo che il telefono usa per parlare.
echo.
echo   NON CHIUDERLA mentre lo usi. Puoi ridurla a icona.
echo.

call npm run dev:prova

echo.
echo   Il server si e' fermato.
echo   Se qui sopra vedi un errore, fai uno screenshot e mandalo a Claude.
echo.
pause
