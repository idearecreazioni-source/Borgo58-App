@echo off
rem Le lettere accentate e le virgolette di Node si leggono giuste.
chcp 65001 >nul
rem LA PROVA GENERALE A CASA: una stampante e un registratore finti sul
rem portatile, che sanno anche andare storti (29/10/2026).
cd /d "%~dp0.."
title Apparecchio finto Borgo58
where node >nul 2>&1 || (echo Node non e' installato: guida del collaudo, passo A2. Hai riavviato dopo averlo installato? & pause & exit /b 1)
echo Come deve comportarsi l'apparecchio finto?
echo   1  normale: stampa e dice "fatto"
echo   2  carta finita
echo   3  coperchio aperto
echo   4  muto: accetta e non risponde mai
echo   5  pagina bianca: dice "fatto" e il foglio esce vuoto
echo.
set "MODO="
set "SCELTA="
set /p "SCELTA=Scrivi il numero e premi Invio: "
if defined SCELTA set "SCELTA=%SCELTA: =%"
if "%SCELTA%"=="1" set "MODO=normale"
if "%SCELTA%"=="2" set "MODO=carta_finita"
if "%SCELTA%"=="3" set "MODO=coperchio_aperto"
if "%SCELTA%"=="4" set "MODO=muto"
if "%SCELTA%"=="5" set "MODO=pagina_bianca"
if not defined MODO (echo Numero sconosciuto. & pause & exit /b 1)
title Apparecchio finto Borgo58 - %MODO% (chiudi questa finestra per spegnerlo)
echo.
echo Per spegnere l'apparecchio finto chiudi questa finestra.
node simulatore.mjs %MODO%
pause
