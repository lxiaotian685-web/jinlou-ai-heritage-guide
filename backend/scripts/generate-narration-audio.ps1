# Generate the Mandarin, Cantonese and English narration WAV files.
# Implementation lives in generate-narration-audio.py because edge-tts is a Python
# package: Python handles the UTF-8 manifest, per-request timeouts and retries.
# Requires Python 3 with edge-tts (pip install edge-tts) and ffmpeg on PATH.
param(
  [string]$Voice = '',
  [string]$Rate = '-5%',
  [string]$Languages = ''
)

$ErrorActionPreference = 'Stop'
$python = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } elseif (Get-Command python -ErrorAction SilentlyContinue) { 'python' } else { throw 'Python is not available; edge-tts cannot run.' }

$arguments = @((Join-Path $PSScriptRoot 'generate-narration-audio.py'), "--rate=$Rate")
if ($Voice) { $arguments += @('--voice', $Voice) }
if ($Languages) { $arguments += @('--languages', $Languages) }

& $python @arguments
exit $LASTEXITCODE

