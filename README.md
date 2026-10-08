# WebAR prototype

Scan a QR code, a web page opens, tap **View on your table**, and a real-size 3D model appears through the phone camera. There is no app to install and no paid SDK. The site is plain static files built on Google's [`<model-viewer>`](https://modelviewer.dev).

* Android: WebXR in Chrome, falling back to Google Scene Viewer
* iPhone: AR Quick Look in Safari (model-viewer converts the GLB to USDZ on the phone, or you can supply your own USDZ)
* The model is scaled to real size, and `ar-scale="fixed"` stops people pinching it bigger or smaller

## Layout

```
models.json            list of models (id, name, files, real size in cm)
public/                the website, the only folder you deploy
  index.html           generated list of models
  m/<id>/index.html    generated page per model (this is what the QR code opens)
  models/<id>.glb      optimized models
  style.css
scripts/
  add-model.mjs        convert + compress + scale a scan, register it
  build-pages.mjs      regenerate the HTML from models.json
  make-qr.mjs          printable QR PNGs into qr/
  serve.mjs            local static server
tools/make-usdz.html   optional: make a USDZ for iPhone in your desktop browser
```

Requires Node 20 or newer. Run `npm install` once.

## Add a new model

```
npm run add-model -- path/to/scan.glb --id desk-lamp --name "Desk Lamp" --height 42
npm run build
```

* `--id` becomes the URL (`/m/desk-lamp/`). Use lowercase letters, numbers and dashes.
* Give **one** real dimension in centimeters: `--height`, `--width` (left to right) or `--depth` (front to back). The model is scaled uniformly to match, set on its base and centered. Measure the real object with a ruler and use its biggest dimension for the best accuracy. If you leave all three out, the file's own size is kept (glTF units are meters, and phone scanning apps usually export real scale).
* Input formats: `.glb` / `.gltf` and `.obj` work out of the box. `.fbx` and `.usdz` need [Blender](https://www.blender.org) (free) installed. If you don't have it, export GLB from your scanning app instead.
* The script prints the final file size and real dimensions. The target is under 5 MB. If a model is over that, add `--texture-size 1024` and/or `--simplify 0.5` (this keeps half the triangles, which helps with dense scans).
* Compression uses Draco by default because Scene Viewer supports it. `--meshopt` makes smaller files, but I have not confirmed Scene Viewer reads Meshopt, so test on Android before using it.

To remove a model, delete its entry from `models.json` and its files in `public/models/`, then run `npm run build`.

### iPhone USDZ

By default nothing extra is needed: when someone taps the AR button, model-viewer builds a USDZ on the iPhone itself. If the iPhone result looks wrong (missing textures, wrong materials), make a USDZ yourself:

1. `npm run serve`, then open http://localhost:8080/tools/make-usdz.html on your computer
2. Pick `public/models/<id>.glb`; a `.usdz` downloads
3. Run add-model again with `--usdz ~/Downloads/<id>.usdz`, then `npm run build`

## Test on your phone

AR only works on **HTTPS**, and Scene Viewer on Android downloads the model itself, so the phone needs a real HTTPS address. Plain `http://192.168...` on your Wi-Fi shows the 3D view but not AR.

**Option A: temporary tunnel (easiest).** `cloudflared` is already installed on this Mac.

```
npm run serve                                    # terminal 1
cloudflared tunnel --url http://localhost:8080   # terminal 2
```

cloudflared prints a random `https://<words>.trycloudflare.com` address. **Anyone with that link can see the site while the command runs.** Press Ctrl+C to shut it down. Open the link on your phone, or make QR codes for it with `npm run qr -- --base https://<words>.trycloudflare.com`. The address changes every time you start the tunnel.

**Option B: deploy a preview** to one of the hosts below and test there.

**Option C: HTTPS on your Wi-Fi only.** Use [mkcert](https://github.com/FiloSottile/mkcert), installing its root certificate on the phone. Nothing becomes public, but the setup on iPhone is fiddly (Settings > General > About > Certificate Trust Settings), so I don't recommend it to start.

## Print QR codes

```
npm run qr -- --base https://your-final-site-address
```

This writes `qr/<id>.png` (1200 × 1400 px, about 10 × 12 cm at 300 dpi) with the item name underneath. Make the QR codes **after** you know the permanent address, because a printed code can't be changed. Test each printed code with both an Android phone and an iPhone.

## Free hosting

Only `public/` needs to be hosted. Make sure `.usdz` files are served as `model/vnd.usdz+zip` (all three hosts below do this).

| Host | How | Notes |
|---|---|---|
| **Netlify** | Drag the `public/` folder onto app.netlify.com/drop, or connect the GitHub repo with publish directory `public` | Free tier, works with private repos, address like `name.netlify.app` |
| **Vercel** | Import the repo, framework "Other", output directory `public`, no build command | Free Hobby tier is for non-commercial use, so check the terms before using it for restaurants |
| **GitHub Pages** | Settings > Pages > deploy with a GitHub Actions "static HTML" workflow pointing at `public/` | Free for **public** repos only. This repo is private, so Pages needs GitHub Pro or a public repo |

All three give HTTPS automatically. A custom domain (for example `menu.yourbrand.pk`) can be added later on any of them.

## What I could not verify

* **No real device test yet.** The page loads and renders the model at the right size in Chrome (checked at phone size). The AR launch itself (WebXR, Scene Viewer, Quick Look) has to be tested on real phones.
* **Android:** AR needs a phone with Google Play Services for AR (ARCore). Many budget Android phones sold in Pakistan are **not** on Google's ARCore supported list. On those phones the page shows the 3D model but the AR button hides, and a message explains why.
* **iPhone:** Quick Look needs iOS 12 or later on an iPhone 6s or newer. The automatic USDZ is generally fine for simple textured models. The fallback tool's USDZ is valid and keeps real scale (`metersPerUnit = 1`), but I haven't opened it in Quick Look.
* **In-app browsers** (WhatsApp, Instagram, Facebook, some QR scanner apps) often block AR. The camera app on iPhone opens Safari, and Google Lens on Android opens Chrome, so both are fine.
* **Blender conversion** of FBX and USDZ is written but untested here because Blender is not installed.
* Real-size placement depends on the phone's surface tracking. Expect the size to be off by a few percent, and tracking is worse on glossy or plain white tables and in dim light.

## Sample model credits

* **Avocado:** Khronos glTF Sample Assets (CC0)
* **Carrot Cake** (photography Greg Zaal, processing James Ray Cock) and **Croissant** (scanning Dario Barresi, processing Greg Zaal): [Poly Haven](https://polyhaven.com), CC0. These are real photo scans, already at real-world scale.
