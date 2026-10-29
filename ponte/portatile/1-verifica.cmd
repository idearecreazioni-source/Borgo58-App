@echo off
rem Le lettere accentate e le virgolette di Node si leggono giuste.
chcp 65001 >nul
rem IL PONTE SUL PORTATILE, PER IL COLLAUDO: un battito solo, per sapere
rem subito se indirizzo e chiavi in config.json sono giusti (29/10/2026).
cd /d "%~dp0.."
title Ponte Borgo58 - verifica
where node >nul 2>&1 || (echo Node non e' installato: guida del collaudo, passo A2. Hai riavviato dopo averlo installato? & pause & exit /b 1)
node ponte.mjs --verifica
echo.
pause
