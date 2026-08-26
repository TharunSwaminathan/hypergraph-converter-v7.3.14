$ModelName = if ($env:MODEL_NAME) { $env:MODEL_NAME } else { "qwen3:8b" }
$OllamaBaseUrl = if ($env:OLLAMA_BASE_URL) { $env:OLLAMA_BASE_URL.TrimEnd("/") } else { "http://localhost:11434" }
$BridgeBaseUrl = if ($env:BRIDGE_OLLAMA_URL) { $env:BRIDGE_OLLAMA_URL.TrimEnd("/") } else { "http://127.0.0.1:8787/ollama" }
$BridgeHealthUrl = if ($env:BRIDGE_HEALTH_URL) { $env:BRIDGE_HEALTH_URL } else { "http://127.0.0.1:8787/health" }

function Test-Step {
  param(
    [string] $Label,
    [scriptblock] $Command
  )
  Write-Host ""
  Write-Host "== $Label =="
  try {
    & $Command
    if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
      Write-Host "OK: $Label"
    } else {
      Write-Host "WARN: $Label failed with exit code $LASTEXITCODE"
    }
  } catch {
    Write-Host "WARN: $Label failed: $($_.Exception.Message)"
  }
}

function Test-OptionalCurl {
  param(
    [string] $Label,
    [string] $Url,
    [string] $MissingMessage
  )
  Write-Host ""
  Write-Host "== $Label =="
  try {
    curl.exe "$Url"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "OK: $Label responded"
    } else {
      Write-Host "INFO: $MissingMessage"
    }
  } catch {
    Write-Host "INFO: $MissingMessage"
  }
}

$healthBody = @{
  model = $ModelName
  messages = @(
    @{ role = "system"; content = "Return only this JSON object: {`"status`":`"ok`"}" },
    @{ role = "user"; content = "health" }
  )
  stream = $false
  think = $false
  format = @{
    type = "object"
    properties = @{ status = @{ type = "string"; enum = @("ok") } }
    required = @("status")
    additionalProperties = $false
  }
  options = @{ temperature = 0.1 }
} | ConvertTo-Json -Depth 8

Test-Step "Node command exists" { Get-Command node -ErrorAction Stop | Out-Host }
Test-Step "npm command exists" { Get-Command npm -ErrorAction Stop | Out-Host }
Test-Step "Ollama command exists" { Get-Command ollama -ErrorAction Stop | Out-Host }
Test-Step "ollama list works" { ollama list }
Test-Step "Ollama API tags from Windows" { curl.exe "$OllamaBaseUrl/api/tags" }
Test-Step "model $ModelName is present" { ollama show $ModelName }
Test-Step "direct tiny structured generation" {
  Invoke-RestMethod -Method Post -Uri "$OllamaBaseUrl/api/chat" -ContentType "application/json" -Body $healthBody -TimeoutSec 120 | Out-Host
}

Test-OptionalCurl "bridge health if running" "$BridgeHealthUrl" "bridge is not running or not reachable at $BridgeHealthUrl"
Test-OptionalCurl "bridged Ollama tags if bridge is running" "$BridgeBaseUrl/api/tags" "bridged Ollama tags are not reachable at $BridgeBaseUrl/api/tags"

Write-Host ""
Write-Host "This PowerShell check matters when the browser is Windows Chrome, even if Ollama is installed inside WSL."
