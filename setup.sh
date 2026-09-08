#!/usr/bin/env bash
# Local LightRAG environment bootstrap.
# Run from the repo root INSIDE WSL2 Ubuntu:  bash setup.sh
set -euo pipefail

ENV_NAME="lightrag"
PY_VERSION="3.10"
LLM_MODEL="llama3.1:8b"          # Q4_K_M by default (~4.9GB)
EMBED_MODEL="nomic-embed-text"   # 768-dim
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- 0. sanity
[[ "$(uname -s)" == "Linux" ]] || die "Run this inside WSL2 Ubuntu, not PowerShell."
grep -qiE 'microsoft|wsl' /proc/version || warn "WSL not detected; continuing anyway."

log "Repo root: $REPO_ROOT"

# ------------------------------------------------------- 1. OS dependencies
log "Installing OS packages (sudo required)"
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  build-essential \
  libgl1 \
  ffmpeg \
  poppler-utils \
  curl \
  ca-certificates \
  git \
  pkg-config

# --------------------------------------------------------------- 2. Node.js
if command -v node >/dev/null 2>&1 && [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge 20 ]]; then
  log "Node.js $(node -v) already present"
else
  log "Installing Node.js 20 LTS (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v && npm -v

# ---------------------------------------------------------- 3. Conda env
command -v conda >/dev/null 2>&1 || die "conda not on PATH. Install Miniconda in WSL first: \
https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh"

eval "$(conda shell.bash hook)"

if conda env list | awk '{print $1}' | grep -qx "$ENV_NAME"; then
  log "Conda env '$ENV_NAME' exists; reusing"
else
  log "Creating conda env '$ENV_NAME' (Python $PY_VERSION)"
  conda create -y -n "$ENV_NAME" "python=$PY_VERSION"
fi

conda activate "$ENV_NAME"
python -V
python -m pip install --upgrade pip setuptools wheel

# --------------------------------- 4. PyTorch cu128 nightly (Blackwell sm_120)
# Must be installed BEFORE other packages so nothing pulls a CPU/cu126 wheel.
log "Installing PyTorch nightly (CUDA 12.8) for Blackwell sm_120"
pip3 install --pre torch torchvision torchaudio \
  --index-url https://download.pytorch.org/whl/nightly/cu128

log "Verifying GPU visibility (expect capability (12, 0))"
python - <<'PY'
import torch
print("torch:", torch.__version__)
print("cuda available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("device:", torch.cuda.get_device_name(0))
    print("capability:", torch.cuda.get_device_capability(0))
    total = torch.cuda.get_device_properties(0).total_memory / 1024**3
    print(f"vram: {total:.1f} GiB")
else:
    print("WARNING: no CUDA device. Check the Windows NVIDIA driver (>= 560) and WSL GPU passthrough.")
PY

# ------------------------------------------------------ 5. Python packages
log "Installing project Python requirements"
pip install -r "$REPO_ROOT/requirements.txt"

python - <<'PY'
import fitz, arxiv, fastapi, lightrag
print("PyMuPDF:", fitz.__doc__.strip().splitlines()[0] if fitz.__doc__ else "installed")
print("arxiv:", getattr(arxiv, "__version__", "installed"))
print("fastapi:", fastapi.__version__)
print("lightrag:", getattr(lightrag, "__version__", "installed"))
PY

# ------------------------------------------------------------- 6. Ollama
if command -v ollama >/dev/null 2>&1; then
  log "Ollama already installed: $(ollama --version 2>/dev/null || true)"
else
  log "Installing Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
fi

mkdir -p "$REPO_ROOT/workspace"

log "Starting Ollama server (background) if not already listening"
if ! curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  nohup ollama serve > "$REPO_ROOT/workspace/ollama.log" 2>&1 &
  for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 \
  || warn "Ollama not responding on 11434. Start it manually with 'ollama serve'."

log "Pulling quantized models (never unquantized: 8GB VRAM ceiling)"
ollama pull "$LLM_MODEL"
ollama pull "$EMBED_MODEL"
ollama list

# ------------------------------------------------- 7. Frontend (Vite + Tailwind v4)
if [[ -d "$REPO_ROOT/frontend" ]]; then
  log "frontend/ already exists; skipping Vite scaffold"
else
  log "Scaffolding React frontend with Vite"
  cd "$REPO_ROOT"
  npm create vite@latest frontend -- --template react
fi

cd "$REPO_ROOT/frontend"
log "Installing frontend dependencies (Tailwind v4 Vite plugin + axios)"
npm install
npm install axios
npm install tailwindcss @tailwindcss/vite

log "Writing frontend/vite.config.js (Tailwind plugin + /api proxy to FastAPI)"
cat > vite.config.js <<'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Frontend calls /api/*; Vite forwards to FastAPI on 8000.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
EOF

log "Writing frontend/src/index.css (Tailwind v4 single-import)"
cat > src/index.css <<'EOF'
@import "tailwindcss";
EOF

cd "$REPO_ROOT"

# --------------------------------------------- 8. VS Code interpreter binding
log "Writing .vscode/settings.json with the resolved interpreter path"
CONDA_PY="$(conda run -n "$ENV_NAME" python -c 'import sys; print(sys.executable)' | tr -d '\r')"
[[ -x "$CONDA_PY" ]] || die "Could not resolve the conda python for '$ENV_NAME'."
mkdir -p "$REPO_ROOT/.vscode"
cat > "$REPO_ROOT/.vscode/settings.json" <<EOF
{
  "python.defaultInterpreterPath": "$CONDA_PY",
  "python.terminal.activateEnvironment": true,
  "python.analysis.extraPaths": ["\${workspaceFolder}/backend", "\${workspaceFolder}/scripts"],
  "python.envFile": "\${workspaceFolder}/.env",
  "files.exclude": {
    "**/__pycache__": true,
    "workspace/pdfs": true
  },
  "search.exclude": {
    "frontend/node_modules": true,
    "workspace": true
  },
  "[python]": { "editor.formatOnSave": false },
  "terminal.integrated.defaultProfile.linux": "bash"
}
EOF

mkdir -p "$REPO_ROOT/workspace/pdfs" "$REPO_ROOT/backend" "$REPO_ROOT/scripts"

log "Done. Next steps:"
cat <<EOF

  conda activate $ENV_NAME

  # Phase 2 - build the corpus (30 cs.LG papers)
  python scripts/fetch_and_parse.py

  # Phase 3 - start the API
  uvicorn backend.main:app --host 0.0.0.0 --port 8000

  # Phase 4 - start the UI (separate terminal)
  cd frontend && npm run dev     # http://localhost:5173

EOF
