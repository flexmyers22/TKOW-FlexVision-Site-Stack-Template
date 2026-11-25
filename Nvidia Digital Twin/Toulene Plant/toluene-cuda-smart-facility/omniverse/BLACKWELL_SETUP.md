# Option B — Full Omniverse on Blackwell (Linux / DGX)

Run the **full USD digital twin** on the Blackwell GPU server. You connect via **NICE DCV**, **Parsec**, or another remote desktop to see Omniverse Kit.

## Architecture on Blackwell

```
Your laptop (DCV / Parsec client)
        ↓  remote desktop
Blackwell server
  ├── npm run omniverse:plant     → Supabase + twin_state.json
  ├── Omniverse Kit               → plant/usd/Site.usd
  └── run_twin_refresh.py         → alarm materials on R101/H101
```

Supabase stays in the cloud — Blackwell only needs outbound HTTPS and your `.env`.

---

## 1. First-time server setup

### Option A — Deploy from your Windows machine

```powershell
cd toluene-cuda-smart-facility
.\scripts\blackwell\deploy-from-windows.ps1 -BlackwellHost user@blackwell-ip -RunPlant
```

Then SSH in and copy `.env` (not synced for security):

```bash
ssh user@blackwell-ip
cd ~/toluene-cuda-smart-facility
cp .env.example .env && nano .env
./scripts/blackwell/setup-blackwell.sh
```

### Option B — Clone directly on Blackwell

SSH into Blackwell, then:

```bash
# Clone or copy project
cd ~
git clone <your-repo-url> toluene-cuda-smart-facility
cd toluene-cuda-smart-facility

# Node.js 20+ (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Dependencies + env
npm install
cp .env.example .env
nano .env    # paste Supabase keys (same as Toulene Digital Twin project)

# Verify Supabase
npm run test:connection
```

---

## 2. Install Omniverse on Blackwell

On the **Blackwell desktop session** (not headless SSH only):

1. Install **NVIDIA Omniverse Launcher** (Linux) from [developer.nvidia.com/omniverse](https://developer.nvidia.com/omniverse)
2. From Launcher, install **USD Composer** (or **Create**)
3. Confirm Kit exists, e.g.:
   ```bash
   ls ~/.local/share/ov/pkg/kit-*/kit
   ```

Set project root (add to `~/.bashrc`):

```bash
export TKOW_PROJECT_ROOT="$HOME/toluene-cuda-smart-facility"
export TKOW_KIT_PATH="$HOME/.local/share/ov/pkg/kit-106.5.0/kit"   # adjust version
```

---

## 3. Connect to Blackwell desktop

| Method | Typical use |
|--------|-------------|
| **NICE DCV** | AWS/GCP NVIDIA AMIs — browser or DCV client |
| **Parsec** | Low-latency 3D streaming |
| **VNC** | Basic remote GUI |

SSH alone is **not enough** for Omniverse 3D — you need a GPU desktop session.

Example DCV (browser):
```
https://<blackwell-ip>:8443
```

---

## 4. Run the plant (terminal on Blackwell)

```bash
cd $TKOW_PROJECT_ROOT
./scripts/blackwell/omniverse-plant.sh
# optional tank level:
./scripts/blackwell/omniverse-plant.sh --tank-level 65
```

This runs `npm run omniverse:plant` and writes:
- `omniverse/runtime/twin_state.json`
- Supabase historian + binary updates

---

## 5. Open Omniverse + apply twin state

### A. GUI (recommended first time)

In your **DCV/Parsec session** on Blackwell:

```bash
cd $TKOW_PROJECT_ROOT
./scripts/blackwell/launch-kit.sh
```

Or manually:
1. Open **USD Composer**
2. **File → Open** → `plant/usd/Site.usd`
3. **Window → Script Editor**, paste:

```python
exec(open("/home/<user>/toluene-cuda-smart-facility/omniverse/action_graph/run_twin_refresh.py").read())
```

Replace the path with your actual `$TKOW_PROJECT_ROOT`.

### B. One-command Kit launch + refresh

```bash
./scripts/blackwell/launch-kit.sh --refresh
```

Opens `Site.usd` and runs `run_twin_refresh.py` via Kit `--exec` (requires Kit on PATH or `TKOW_KIT_PATH`).

---

## 6. Enable auto-polling (optional)

```bash
./scripts/blackwell/install-extension.sh
```

Enable **TKOW Toluene Twin Refresh** in Extension Manager — polls `twin_state.json` every 2s.

---

## 7. Daily workflow

```bash
# Terminal 1 — refresh plant data
./scripts/blackwell/omniverse-plant.sh

# DCV session — view twin (if Kit not already open)
./scripts/blackwell/launch-kit.sh --refresh
```

Expected result with current design basis:
- **R101** `ReactorShell` → red (HIGH_TEMP:1000)
- **H101** `HeaterShell` → red
- **AlarmPanel** → `R101: HIGH_TEMP:1000`, `H101: HIGH_TEMP:1000`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Kit not found` | Set `TKOW_KIT_PATH` to your `kit` binary |
| `No USD stage` | Open DCV desktop first; don’t run Kit over plain SSH |
| `twin_state.json missing` | Run `./scripts/blackwell/omniverse-plant.sh` |
| Supabase errors | Check `.env` and `npm run test:connection` |
| Black screen in Omniverse | Confirm NVIDIA driver + GPU assigned to DCV session |

---

## File map

| File | Purpose |
|------|---------|
| `scripts/blackwell/setup-blackwell.sh` | First-time server bootstrap |
| `scripts/blackwell/omniverse-plant.sh` | Plant sim + twin state on Linux |
| `scripts/blackwell/launch-kit.sh` | Open Site.usd in Kit |
| `scripts/blackwell/install-extension.sh` | Kit auto-poll extension |
| `scripts/blackwell/deploy-from-windows.ps1` | Push project from Windows |
| `omniverse/action_graph/run_twin_refresh.py` | Apply materials from twin state |
| `plant/usd/Site.usd` | Master Omniverse scene |
