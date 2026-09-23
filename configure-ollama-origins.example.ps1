# Safe example only. Review before running anything that changes your environment.
param([string]$FrontendOrigin = $env:FRONTEND_ORIGIN)

if ([string]::IsNullOrWhiteSpace($FrontendOrigin)) {
  Write-Error "Pass -FrontendOrigin with the exact Dashboard URL printed by run-with-ollama.bat (for example http://127.0.0.1:5173)."
  exit 1
}
$Origins = "https://hypergraphproject.github.io,$FrontendOrigin"

Write-Host "Ollama origins example"
Write-Host ""
Write-Host "Allowed origins:"
Write-Host $Origins
Write-Host "The local origin must match the launcher's actual port exactly."
Write-Host ""
Write-Host "Windows user environment variable command:"
Write-Host "[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '$Origins', 'User')"
Write-Host ""
Write-Host "After setting it, fully quit/restart Ollama."
Write-Host ""
Write-Host "Linux/WSL systemd notes:"
Write-Host "sudo systemctl edit ollama"
Write-Host ""
Write-Host "[Service]"
Write-Host "Environment=`"OLLAMA_ORIGINS=$Origins`""
Write-Host ""
Write-Host "sudo systemctl daemon-reload"
Write-Host "sudo systemctl restart ollama"
