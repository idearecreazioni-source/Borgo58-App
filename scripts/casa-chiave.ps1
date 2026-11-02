# LA CHIAVE DI CLAUDE PER CASA, LA FINESTRA DOVE SI INCOLLA (01/11/2026).
# La apre `npm run casa:chiave`. La chiave si incolla e non si vede, non
# passa dal Blocco note (che in Windows 11 tiene copia di quello che ci si
# incolla) e si scrive nel file senza BOM, una riga sola (revisione
# ecc:security-reviewer).
param([Parameter(Mandatory = $true)][string]$Destinazione)

Write-Host ""
Write-Host "  MEMO di Casa: la chiave di Claude" -ForegroundColor Green
Write-Host "  Incolla la chiave (clic destro, oppure Ctrl+V) e premi Invio."
Write-Host "  Non si vede mentre la incolli: e' normale."
Write-Host ""
$segreta = Read-Host "  Chiave" -AsSecureString
$puntatore = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segreta)
try {
  $chiave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($puntatore).Trim()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($puntatore)
}
$testo = "# La chiave di Claude per Casa (npm run casa:chiave).`nANTHROPIC_API_KEY=$chiave`n"
[IO.File]::WriteAllText($Destinazione, $testo, (New-Object Text.UTF8Encoding $false))
$chiave = $null
$testo = $null
Write-Host ""
Write-Host "  Fatto. Questa finestra si chiude da sola." -ForegroundColor Green
Start-Sleep -Seconds 2
