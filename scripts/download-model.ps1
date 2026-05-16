param(
    [string]$OutputPath = "../public/models/hand_landmarker.task"
)

$url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
$outDir = Split-Path $OutputPath -Parent

if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Write-Host "Downloading MediaPipe Hand Landmarker model..." -ForegroundColor Cyan
$progressPreference = 'silentlyContinue'
Invoke-WebRequest -Uri $url -OutFile $OutputPath -UseBasicParsing
$progressPreference = 'continue'

$file = Get-Item $OutputPath
Write-Host "Done: $($file.Length) bytes saved to $OutputPath" -ForegroundColor Green
