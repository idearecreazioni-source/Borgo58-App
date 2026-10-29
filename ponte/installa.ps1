# IL PONTE COME SERVIZIO DEL MINI-PC — 28/10/2026.
#
# Fa partire il ponte da solo all'accensione del mini-PC, senza che nessuno
# debba entrare con un utente, e lo riavvia da solo se si ferma.
# Usa l'Utilità di pianificazione di Windows: nessun programma da scaricare
# oltre a Node.
#
# Da lanciare in PowerShell COME AMMINISTRATORE, dalla cartella del ponte:
#   powershell -ExecutionPolicy Bypass -File .\installa.ps1
# Per toglierlo:
#   powershell -ExecutionPolicy Bypass -File .\installa.ps1 -Togli

param([switch]$Togli)

$ErrorActionPreference = "Stop"
$nome = "Borgo58 Ponte"
$cartella = $PSScriptRoot

if ($Togli) {
  Unregister-ScheduledTask -TaskName $nome -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Il ponte non parte piu' da solo. La cartella e la configurazione restano dove sono."
  exit 0
}

# 1. Node, almeno la 22.
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host "Manca Node. Scaricalo da https://nodejs.org (la versione LTS), installalo e rilancia questo comando."
  exit 1
}
$versione = [int]((& $node --version).TrimStart("v").Split(".")[0])
if ($versione -lt 22) {
  Write-Host "Node e' troppo vecchio ($(& $node --version)): serve la 22 o piu' recente."
  exit 1
}

# 2. La configurazione.
$config = Join-Path $cartella "config.json"
if (-not (Test-Path $config)) {
  Copy-Item (Join-Path $cartella "config.esempio.json") $config
  Write-Host "Ho creato config.json: aprilo con il Blocco note, scrivi le tre chiavi e rilancia questo comando."
  exit 1
}
# La chiave del ponte la legge solo il servizio (SYSTEM) e chi amministra il PC.
# Per numero e non per nome: su un Windows in italiano il gruppo si chiama
# "Amministratori", e col nome inglese il comando fallirebbe in silenzio.
# Dopo questo passo config.json si modifica aprendo il Blocco note COME
# AMMINISTRATORE.
& icacls $config /inheritance:r /grant:r "*S-1-5-18:(R)" "*S-1-5-32-544:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Non sono riuscito a proteggere config.json: lancia PowerShell come amministratore e riprova."
  exit 1
}

# 3. Prima di installare, una prova: se la chiave e' sbagliata lo si sa adesso.
& $node (Join-Path $cartella "ponte.mjs") --verifica
if ($LASTEXITCODE -ne 0) {
  Write-Host "Il ponte non riesce a parlare col gestionale: controlla config.json e la rete."
  exit 1
}

# 4. Il servizio: all'accensione, come SYSTEM, si riavvia da solo ogni minuto se cade.
$azione = New-ScheduledTaskAction -Execute $node -Argument "`"$(Join-Path $cartella 'ponte.mjs')`"" -WorkingDirectory $cartella
$quando = New-ScheduledTaskTrigger -AtStartup
$chi = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$come = New-ScheduledTaskSettingsSet -RestartCount 9999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName $nome -Action $azione -Trigger $quando -Principal $chi -Settings $come -Force | Out-Null
# Se era gia' acceso (seconda installazione, config cambiata) si ferma prima,
# cosi' riparte con la configurazione nuova.
Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $nome

Write-Host ""
Write-Host "Fatto: il ponte e' acceso e ripartira' da solo a ogni accensione del mini-PC."
Write-Host "Nel gestionale, Comande -> Stampanti, entro un minuto deve comparire 'Acceso'."
Write-Host "Il registro e' in $(Join-Path $cartella 'ponte.log')."
