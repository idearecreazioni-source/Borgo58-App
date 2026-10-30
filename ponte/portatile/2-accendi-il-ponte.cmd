@echo off
rem Le lettere accentate e le virgolette di Node si leggono giuste.
chcp 65001 >nul
rem IL PONTE SUL PORTATILE, A MANO: niente servizio di Windows, niente
rem installa.ps1. Gira finche' questa finestra resta aperta (29/10/2026).
cd /d "%~dp0.."
title Ponte Borgo58 - ACCESO (chiudi questa finestra per spegnerlo)
where node >nul 2>&1 || (echo Node non e' installato: guida del collaudo, passo A2. Hai riavviato dopo averlo installato? & pause & exit /b 1)
echo Il ponte si accende. Per spegnerlo chiudi questa finestra con la X in alto a destra.
echo.
node ponte.mjs
echo.
echo Il ponte e' spento.
pause
