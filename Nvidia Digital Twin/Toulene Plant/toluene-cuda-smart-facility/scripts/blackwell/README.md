# Blackwell server — Omniverse deployment (Option B)

Linux scripts for running the full USD digital twin on the Blackwell GPU server.

**Full guide:** [omniverse/BLACKWELL_SETUP.md](../omniverse/BLACKWELL_SETUP.md)

## Scripts

| Script | Purpose |
|--------|---------|
| `setup-blackwell.sh` | First-time Node + npm + Kit detection |
| `omniverse-plant.sh` | Plant sim + Supabase + `twin_state.json` |
| `launch-kit.sh` | Open `Site.usd` in Omniverse Kit |
| `launch-kit.sh --refresh` | Open scene + apply alarm materials |
| `install-extension.sh` | Install auto-polling Kit extension |
| `deploy-from-windows.ps1` | Push project from Windows → Blackwell |

## Quick start (on Blackwell)

```bash
chmod +x scripts/blackwell/*.sh
./scripts/blackwell/setup-blackwell.sh
./scripts/blackwell/omniverse-plant.sh
# Connect DCV/Parsec, then:
./scripts/blackwell/launch-kit.sh --refresh
```

## Environment

Set in `~/.bashrc` on Blackwell:

```bash
export TKOW_PROJECT_ROOT="$HOME/toluene-cuda-smart-facility"
export TKOW_KIT_PATH="$HOME/.local/share/ov/pkg/kit-<version>/kit"
```

Also in project `.env` (see `.env.example`).

## Deploy from Windows

```powershell
.\scripts\blackwell\deploy-from-windows.ps1 -BlackwellHost user@blackwell-ip
```
