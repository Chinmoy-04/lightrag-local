# Local LightRAG environment bootstrap for native Windows.
# Run from an elevated or normal PowerShell in the repo root:
#   Set-ExecutionPolicy -Scope Process Bypass
#   .\setup.ps1
$ErrorActionPreference = "Stop"

$EnvName = "lightrag"
$PyVersion = "3.10"
$LlmModel = "llama3.1:8b"
$EmbedModel = "nomic-embed-text"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn([string]$Message) {
    Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Assert-Command([string]$Name, [string]$Hint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name not found on PATH. $Hint"
    }
}

Set-Location $RepoRoot
Write-Step "Repo root: $RepoRoot"

# --------------------------------------------------------------- Node.js
Write-Step "Checking Node.js"
Assert-Command "node" "Install Node 20+ LTS from https://nodejs.org"
Assert-Command "npm" "Install Node 20+ LTS from https://nodejs.org"
node -v
npm -v

# --------------------------------------------------------------- Conda
Write-Step "Checking Conda / Miniconda"
if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
    Write-Warn "conda not on PATH. Installing Miniconda into $env:USERPROFILE\miniconda3"
    $Installer = Join-Path $env:TEMP "Miniconda3-latest-Windows-x86_64.exe"
    $Url = "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe"
    Invoke-WebRequest -Uri $Url -OutFile $Installer
    Start-Process -FilePath $Installer -ArgumentList @(
        "/S",
        "/RegisterPython=0",
        "/AddToPath=1",
        "/D=$env:USERPROFILE\miniconda3"
    ) -Wait

    $CondaBat = Join-Path $env:USERPROFILE "miniconda3\Scripts\conda.exe"
    if (-not (Test-Path $CondaBat)) {
        throw "Miniconda install finished but conda.exe was not found at $CondaBat"
    }

    # Refresh PATH for this session
    $env:Path = "$env:USERPROFILE\miniconda3;$env:USERPROFILE\miniconda3\Scripts;$env:USERPROFILE\miniconda3\Library\bin;" + $env:Path
}

Assert-Command "conda" "Open a new PowerShell after installing Miniconda, then re-run .\setup.ps1"
conda --version

Write-Step "Accepting Conda Terms of Service (idempotent)"
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main | Out-Null
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r | Out-Null
# Windows Miniconda also uses the msys2 channel.
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/msys2 | Out-Null

$EnvExists = conda env list | Select-String -Pattern "(^|\s)$EnvName(\s|$)"
if ($EnvExists) {
    Write-Step "Conda env '$EnvName' exists; reusing"
} else {
    Write-Step "Creating conda env '$EnvName' (Python $PyVersion)"
    conda create -y -n $EnvName "python=$PyVersion"
    if ($LASTEXITCODE -ne 0) { throw "conda create failed with exit code $LASTEXITCODE" }
}

# Prefer conda-run for reliable env targeting in scripts
function Invoke-InEnv {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & conda run -n $EnvName --no-capture-output @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed in env '$EnvName' (exit $LASTEXITCODE): $($Args -join ' ')"
    }
}

Write-Step "Upgrading pip tooling"
Invoke-InEnv python -m pip install --upgrade pip setuptools wheel

# --------------------------------- PyTorch cu128 (Blackwell sm_120)
Write-Step "Installing PyTorch (CUDA 12.8) for Blackwell sm_120"
$NightlyOk = $true
try {
    Invoke-InEnv python -m pip install --pre --upgrade --force-reinstall torch --index-url https://download.pytorch.org/whl/nightly/cu128
    Invoke-InEnv python -m pip install --pre --upgrade --force-reinstall torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cu128
} catch {
    $NightlyOk = $false
    Write-Warn "Nightly cu128 install failed; falling back to stable cu128"
}

if (-not $NightlyOk) {
    Invoke-InEnv python -m pip install --upgrade --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
}

Write-Step "Verifying GPU visibility (expect capability (12, 0))"
Invoke-InEnv python -c @"
import torch
print('torch:', torch.__version__)
print('cuda available:', torch.cuda.is_available())
if torch.cuda.is_available():
    print('device:', torch.cuda.get_device_name(0))
    print('capability:', torch.cuda.get_device_capability(0))
    total = torch.cuda.get_device_properties(0).total_memory / 1024**3
    print(f'vram: {total:.1f} GiB')
else:
    print('WARNING: no CUDA device. Update the NVIDIA Game Ready/Studio driver (>= 560).')
"@

# ------------------------------------------------------ Python packages
Write-Step "Installing project Python requirements"
Invoke-InEnv python -m pip install -r (Join-Path $RepoRoot "requirements.txt")

Invoke-InEnv python -c @"
import fitz, arxiv, fastapi, lightrag
print('PyMuPDF ok')
print('arxiv:', getattr(arxiv, '__version__', 'installed'))
print('fastapi:', fastapi.__version__)
print('lightrag:', getattr(lightrag, '__version__', 'installed'))
"@

# ------------------------------------------------------------- Ollama
Write-Step "Checking Ollama"
Assert-Command "ollama" "Install Ollama for Windows from https://ollama.com/download"
ollama --version

Write-Step "Pulling quantized models (8GB VRAM ceiling)"
ollama pull $LlmModel
ollama pull $EmbedModel
ollama list

# ------------------------------------------------- Frontend (Vite + Tailwind v4)
$FrontendDir = Join-Path $RepoRoot "frontend"
if (Test-Path $FrontendDir) {
    Write-Step "frontend/ already exists; skipping Vite scaffold"
} else {
    Write-Step "Scaffolding React frontend with Vite (non-interactive)"
    $env:CI = "true"
    npm create vite@latest frontend -- --template react
}

Set-Location $FrontendDir
Write-Step "Installing frontend dependencies (Tailwind v4 + axios)"
npm install
npm install axios
npm install tailwindcss @tailwindcss/vite

Write-Step "Writing frontend/vite.config.js"
@"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
"@ | Set-Content -Encoding utf8 (Join-Path $FrontendDir "vite.config.js")

Write-Step "Writing frontend/src/index.css"
'@import "tailwindcss";' | Set-Content -Encoding utf8 (Join-Path $FrontendDir "src\index.css")

Set-Location $RepoRoot

# --------------------------------------------- VS Code interpreter binding
Write-Step "Writing .vscode/settings.json"
$CondaPy = (& conda run -n $EnvName python -c "import sys; print(sys.executable)").Trim()
if (-not (Test-Path $CondaPy)) {
    throw "Could not resolve conda python for '$EnvName'"
}
# JSON needs escaped backslashes for Windows paths
$CondaPyJson = $CondaPy.Replace('\', '\\')
New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot ".vscode") | Out-Null
@"
{
  "python.defaultInterpreterPath": "$CondaPyJson",
  "python.terminal.activateEnvironment": true,
  "python.analysis.extraPaths": ["`${workspaceFolder}/backend", "`${workspaceFolder}/scripts"],
  "python.envFile": "`${workspaceFolder}/.env",
  "files.exclude": {
    "**/__pycache__": true,
    "workspace/pdfs": true
  },
  "search.exclude": {
    "frontend/node_modules": true,
    "workspace": true
  },
  "[python]": { "editor.formatOnSave": false }
}
"@ | Set-Content -Encoding utf8 (Join-Path $RepoRoot ".vscode\settings.json")

New-Item -ItemType Directory -Force -Path @(
    (Join-Path $RepoRoot "workspace\pdfs"),
    (Join-Path $RepoRoot "backend"),
    (Join-Path $RepoRoot "scripts")
) | Out-Null

Write-Step "Done. Next steps:"
Write-Host @"

  conda activate $EnvName

  # Phase 2 - build the corpus
  python scripts\fetch_and_parse.py

  # Phase 3 - start the API
  uvicorn backend.main:app --host 127.0.0.1 --port 8000

  # Phase 4 - start the UI
  cd frontend
  npm run dev

"@
