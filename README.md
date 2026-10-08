# WebAR menu prototype

One QR code on the table opens a restaurant menu. Every dish has a photo, price and description, and a **See it on your table** button that places a real-size 3D scan of it in front of you through the phone camera. There is no app to install and no paid SDK. The site is plain static files built on Google's [`<model-viewer>`](https://modelviewer.dev).

* Android: WebXR in Chrome, falling back to Google Scene Viewer
* iPhone: AR Quick Look in Safari, using a USDZ file shipped with each dish
* Dishes are scaled to real size, and `ar-scale="fixed"` stops people pinching them bigger or smaller

Live demo: https://ibrahim-ziaa.github.io/webar-prototype/

## Layout

```
restaurant.json        restaurant name, tagline, currency, category order
models.json            the dishes: name, category, price, description, credit, files, real size
public/                the website, the only folder you deploy
  index.html           the generated menu (this is what the QR code opens)
  models/<id>.glb      optimized 3D models (+ <id>.usdz for iPhone)
  posters/<id>.webp    dish photos rendered from the models
  style.css
scripts/
  fetch-polyhaven.mjs  download a free CC0 scan from Poly Haven into input/
  add-model.mjs        convert + compress + scale a scan, register it
  make-posters.mjs     render the dish photos (uses your installed Chrome)
  build-pages.mjs      regenerate the menu from the JSON files
  make-qr.mjs          the printable QR code
  serve.mjs            local static server
tools/make-usdz.html   make a USDZ for iPhone in your desktop browser
```

Requires Node 20 or newer and Google Chrome. Run `npm install` once.

## Change the restaurant

Edit `restaurant.json` (name, tagline, currency, and the order of categories), then `npm run build`.

## Add a dish

```
npm run add-model -- path/to/scan.glb --id chicken-biryani --name "Chicken Biryani" --width 26
```

Then open `models.json` and fill in the new dish's `category` (one from restaurant.json), `price` and `description`. Then:

```
npm run posters
npm run build
```

and make its iPhone file (see below).

* `--id` is used in file names and in links that open one dish directly (`/#chicken-biryani`). Use lowercase letters, numbers and dashes.
* Give **one** real dimension in centimeters: `--height`, `--width` (left to right) or `--depth` (front to back). The model is scaled uniformly to match, set on its base and centered. Measure the real plate with a ruler and use its biggest dimension. If you leave all three out, the file's own size is kept (glTF units are meters, and phone scanning apps usually export real scale).
* Re-running add-model for an existing id keeps its price, description and category.
* Input formats: `.glb` / `.gltf` and `.obj` work out of the box. `.fbx` and `.usdz` need [Blender](https://www.blender.org) (free) installed. If you don't have it, export GLB from your scanning app instead.
* The script prints the final file size and real dimensions. The target is under 5 MB. If a model is over that, add `--texture-size 1024` and/or `--simplify 0.5` (this keeps half the triangles, which helps with dense scans).
* Compression uses Draco by default because Scene Viewer supports it. `--meshopt` makes smaller files, but I have not confirmed Scene Viewer reads Meshopt, so test on Android before using it.

To use a free scan from [Poly Haven](https://polyhaven.com/models), run `npm run fetch-polyhaven -- <asset-id>` (the last part of the asset's URL). It prints the exact add-model command, with the real size.

To remove a dish, delete its entry from `models.json` and its files in `public/models/` and `public/posters/`, then `npm run build`.

### iPhone USDZ

Ship a USDZ with every model. Without one, model-viewer builds it on the iPhone when AR is tapped, and on bigger scans that can fail and leave Quick Look blank. To make one:

1. `npm run serve`, then open http://localhost:8080/tools/make-usdz.html on your computer
2. Pick `public/models/<id>.glb`; a `.usdz` downloads
3. Copy it to `public/models/<id>.usdz`, set `"usdz": "<id>.usdz"` for that dish in models.json, then `npm run build`

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

## Print the QR code

```
npm run qr -- --base https://ibrahim-ziaa.github.io/webar-prototype
```

This writes `qr/menu.png` (1200 × 1500 px, about 10 × 12.7 cm at 300 dpi) with the restaurant name underneath. There is one code for the whole menu. Add `--dish <id>` to also make a code that opens one dish directly. Make codes only once the address is permanent, because a printed code can't be changed. Test the printed code with both an Android phone and an iPhone.

## Free hosting

Only `public/` needs to be hosted. Make sure `.usdz` files are served as `model/vnd.usdz+zip` (all three hosts below do this).

| Host | How | Notes |
|---|---|---|
| **Netlify** | Drag the `public/` folder onto app.netlify.com/drop, or connect the GitHub repo with publish directory `public` | Free tier, works with private repos, address like `name.netlify.app` |
| **Vercel** | Import the repo, framework "Other", output directory `public`, no build command | Free Hobby tier is for non-commercial use, so check the terms before using it for restaurants |
| **GitHub Pages** (in use) | Already set up: `.github/workflows/pages.yml` publishes `public/` on every push to `main` | Free for public repos. Live at https://ibrahim-ziaa.github.io/webar-prototype/ |

All three give HTTPS automatically. A custom domain (for example `menu.yourbrand.pk`) can be added later on any of them.

## What I could not verify

* **Device coverage.** AR has been confirmed on one phone. The menu and 3D viewer are checked in Chrome at phone size. Test on a range of Android phones and iPhones before showing a restaurant.
* **Android:** AR needs a phone with Google Play Services for AR (ARCore). Many budget Android phones sold in Pakistan are **not** on Google's ARCore supported list. On those phones the page shows the 3D model but the AR button hides, and a message explains why.
* **iPhone:** Quick Look needs iOS 12 or later on an iPhone 6s or newer. The shipped USDZ files keep real scale (`metersPerUnit = 1`).
* **In-app browsers** (WhatsApp, Instagram, Facebook, some QR scanner apps) often block AR. The camera app on iPhone opens Safari, and Google Lens on Android opens Chrome, so both are fine.
* **Blender conversion** of FBX and USDZ is written but untested here because Blender is not installed.
* Real-size placement depends on the phone's surface tracking. Expect the size to be off by a few percent, and tracking is worse on glossy or plain white tables and in dim light.

## Sample dish credits

The demo dishes are real photo scans from [Poly Haven](https://polyhaven.com), all CC0 (free for commercial use, no credit required). Credits are also shown in the menu footer, from `models.json`.

* Strawberry Chocolate Cake: Kuutti Siitonen
* Carrot Cake: Greg Zaal, James Ray Cock
* Butter Croissant: Dario Barresi, Greg Zaal
* Fresh Bread Rolls: Alexander Shulha
* Fresh Pomegranate: Oliver Harries

Prices and descriptions are placeholders, and "The Demo Bakehouse" is a made-up name.
