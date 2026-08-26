$ModelName = if ($env:MODEL_NAME) { $env:MODEL_NAME } else { "qwen3:8b" }
$OllamaBaseUrl = if ($env:OLLAMA_BASE_URL) { $env:OLLAMA_BASE_URL.TrimEnd("/") } else { "http://localhost:11434" }

function Fail-Smoke {
  param([string] $Message)
  Write-Host "FAIL: $Message"
  exit 1
}

Write-Host "Hypergraph Converter Studio local model smoke test"
Write-Host "Model: $ModelName"
Write-Host "Ollama: $OllamaBaseUrl"

try { Get-Command ollama -ErrorAction Stop | Out-Null } catch { Fail-Smoke "ollama command was not found" }
try { ollama list | Out-Null } catch { Fail-Smoke "ollama list failed; start Ollama first" }
try { curl.exe "$OllamaBaseUrl/api/tags" | Out-Null } catch { Fail-Smoke "Ollama /api/tags did not respond" }
try { ollama show $ModelName | Out-Null } catch { Fail-Smoke "model $ModelName is not installed; run: ollama pull $ModelName" }

$body = @{
  model = $ModelName
  messages = @(
    @{ role = "system"; content = 'Return only this JSON object: {"status":"ok"}' },
    @{ role = "user"; content = "Return the JSON health response." }
  )
  stream = $false
  think = $false
  format = @{
    type = "object"
    properties = @{
      status = @{
        type = "string"
        enum = @("ok")
      }
    }
    required = @("status")
    additionalProperties = $false
  }
  options = @{
    temperature = 0.1
  }
} | ConvertTo-Json -Depth 10

try {
  $response = Invoke-RestMethod -Method Post -Uri "$OllamaBaseUrl/api/chat" -ContentType "application/json" -Body $body -TimeoutSec 120
} catch {
  Fail-Smoke "structured /api/chat health request failed: $($_.Exception.Message)"
}

$content = [string] $response.message.content
if (-not $content) { Fail-Smoke "Ollama response did not include message.content" }
try {
  $inner = $content | ConvertFrom-Json
} catch {
  Fail-Smoke "message.content was not valid JSON: $($_.Exception.Message)"
}
if ($inner.status -ne "ok") { Fail-Smoke "message.content JSON did not contain status ok" }

Write-Host "PASS: $ModelName completed a tiny non-streaming structured generation."
