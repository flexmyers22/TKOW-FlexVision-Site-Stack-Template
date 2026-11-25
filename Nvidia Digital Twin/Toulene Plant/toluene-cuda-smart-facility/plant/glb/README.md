# GLB — Web Viewer assets

Procedural GLB exports derived from USD equipment definitions and design metadata.

**Rule:** USD is the Omniverse master scene; GLB is the web viewer derivative.

## Generate

```bash
npm run export:glb
```

Writes `plant/glb/*.glb` and `plant/glb/manifest.json`.

## Assets

| GLB | USD master | Equipment |
|-----|------------|-----------|
| T101.glb | Equipment/T101.usd | Toluene tank |
| P101.glb | Equipment/P101.usd | Feed pump |
| H101.glb | Equipment/H101.usd | Heater |
| R101.glb | Equipment/R101.usd | Reactor |
| D101.glb | Equipment/D101.usd | Flash drum |
| C101.glb | Equipment/C101.usd | Side column |
| C102.glb | Equipment/C102.usd | Benzene column |
| C103.glb | Equipment/C103.usd | Xylene column |

## Web viewer

Open `dashboards/viewer.html` via a local static server (e.g. `npx serve .`) to browse GLB assets.
