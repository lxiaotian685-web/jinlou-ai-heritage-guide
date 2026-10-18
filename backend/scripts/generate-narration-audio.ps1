$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type -AssemblyName System.Speech

$targetDirectory = Join-Path $PSScriptRoot '..\public\media\narrations'
New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
$manifest = node (Join-Path $PSScriptRoot 'tts-manifest.js') | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer

try {
  $speaker.SelectVoice('Microsoft Huihui Desktop')
  $speaker.Rate = -1
  foreach ($item in $manifest) {
    $target = Join-Path $targetDirectory $item.filename
    $speaker.SetOutputToWaveFile($target)
    $speaker.Speak($item.text)
    $speaker.SetOutputToNull()
  }
} finally {
  $speaker.Dispose()
}

Write-Output "Narration audio generated: $($manifest.Count) files"
