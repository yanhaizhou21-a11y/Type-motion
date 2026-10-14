# Type Garden Studio

A production-ready, zero-cost modular web application built with **Vite 6 + TypeScript 5 (Strict Mode)** that scales to **12,000+ concurrent/monthly users with $0 storage and $0 database cost**.

Type words to grow procedural vector botanical vines, blooming roses, and foliage in real-time, or design social media and device posters with custom flower, leaf, and stalk sprites.

---

## Reference & Credits

**Type Garden Studio** is inspired by and pays direct credit to:

> **Web:** [Type Garden](https://type-garden.vercel.app/) (`https://type-garden.vercel.app/`)
>
> **Developer:** [Akshat Agarwal](https://x.com/art_akshat) ([@art_akshat](https://x.com/art_akshat))
>
> Original concept and botanical typewriter design reference: [Type Garden on Vercel](https://type-garden.vercel.app/). All credits for the original botanical generative concept and typing interactions belong to Akshat Agarwal.

This implementation builds upon the concept by introducing:
- A modular TypeScript 5 architecture with 100% strict typing.
- A zero-cost client-side storage pipeline (IndexedDB + LZString state compression).
- An OffscreenCanvas chroma-key and corner flood-fill background removal pipeline for user-uploaded sprites.
- A social media and device poster engine with 10 presets and custom dimension inputs.
- Non-blocking 30fps MP4/WebM video recording and CRC32 ZIP frames export.
- Offline-ready vector SVG exports with embedded base64 sprite images.
- Multi-gardener peer cursor sync via `BroadcastChannel`.

---

## Zero-Cost Architecture (12,000+ Users at $0/mo)

Traditional generative poster apps incur steep monthly cloud bills for asset storage (S3), relational databases (PostgreSQL), and background video rendering servers. Type Garden Studio eliminates 100% of these costs through a client-first architecture:

| Component | Traditional Approach (High Cost) | Type Garden Studio ($0 Cost) |
|---|---|---|
| **User Sprites** | Uploaded to AWS S3 / Cloud Storage | Persisted locally in `IndexedDB` via `idb-keyval` as alpha `Blob`s |
| **Garden State & Sharing** | Stored in PostgreSQL / MongoDB | Compressed into URL hash `#g=...` via `lz-string` (zero database reads/writes) |
| **Settings & Preferences** | User table in cloud database | Browser `localStorage` (palette, preset, dimensions, seed) |
| **Background Removal** | Cloud API (e.g. remove.bg at $0.20/image) | In-browser `OffscreenCanvas` chroma-key and corner luminance flood-fill |
| **MP4 / WebM Video Export** | Server-side FFmpeg queue | Client-side `MediaRecorder` at 16Mbps stream capture |
| **PNG Frames ZIP Export** | Server ZIP compression worker | Pure TypeScript in-browser PKZIP archiver with IEEE 802.3 CRC32 checksums |
| **Multi-Gardener Sync** | Dedicated WebSocket cluster | Zero-cost `BroadcastChannel` (cross-tab) and ephemeral P2P channels |
| **Hosting & CDN** | Dynamic Node.js server | 100% static asset bundle (~30KB gzipped) on Cloudflare Pages / Vercel |

---

## Features

### 1. Custom Sprite Pipeline (`src/engine/bgRemove.ts`, `src/storage/localStore.ts`)
- Accepts `.png`, `.svg`, `.jpg`, `.jpeg`, and `.webp` for:
  - **Flower Head:** Replaces rose blooms with custom flower textures.
  - **Leaf / Foliage:** Replaces procedural foliage along vine branches.
  - **Flower Stalk / Stem:** Stamps and warps textures along cubic Bezier vine splines.
- **Auto Background Removal:** Strips solid white or solid-color backgrounds via an `OffscreenCanvas` worker using corner flood-fill with adjustable tolerance and edge feathering.
- Stored directly in `IndexedDB` under keys `sprite_flower`, `sprite_leaf`, `sprite_stalk` without uploading to any remote server.

### 2. Social Media & Device Poster Engine (`src/constants.ts`, `src/engine/poster.ts`)
Comprehensive aspect ratios and resolutions with instant live preview:
- **IG Square:** 1080 x 1080 (1:1)
- **IG Portrait:** 1080 x 1350 (4:5)
- **Story / Reel / TikTok:** 1080 x 1920 (9:16)
- **YouTube / X FHD:** 1920 x 1080 (16:9)
- **X / LinkedIn Post:** 1200 x 675 (16:9)
- **Pinterest Pin:** 1000 x 1500 (2:3)
- **iPhone / Android Wallpaper:** 1170 x 2532 (Mobile)
- **iPad / Tablet:** 1668 x 2388 (3:4)
- **MacBook / Desktop:** 2560 x 1600 (16:10)
- **Print Poster A4:** 2480 x 3508 (300dpi)
- **Custom Dimensions:** Custom width and height inputs (200px to 4096px) with an orientation swap button (`⇄`).

### 3. Botanical Procedural + Sprite Hybrid Renderer (`src/engine/botanical.ts`, `src/engine/renderer.ts`)
- **Procedural Vines:** Evaluates cubic Bezier curves with parametric velocity, over/under layer weaving, and procedural thorns.
- **Spring Physics:** Damped harmonic oscillator simulation (`spr()`) for natural petal and leaf blooming.
- **Wind Sway & 3D Tilt:** Real-time wind gust simulation and 3D petal tilt responding to cursor and peer gardener positions.
- **Hybrid SVG Export:** Renders complete vector paths and embeds base64 `<image>` elements for custom sprites, ensuring exported SVGs open cleanly in Adobe Illustrator, Figma, and Inkscape.

### 4. Graphic Texture & Blend Compositor (`src/engine/textures.ts`)
- **8 Procedural Textures:** Film grain, rough paper, halftone screen, canvas weave, riso print, noise dust, fine grit, and scanlines.
- **8 Blend Modes:** Multiply, Screen, Overlay, Soft Light, Hard Light, Color Dodge, Darken, and Difference.
- **Visual Controls:** Opacity (0 to 1), Texture Scale (0.5x to 3x), Vignette falloff (0 to 1), and animated 11fps boil toggle.

### 5. Motion Presets & Dual Poster Studio (`src/ui/studioInspector.ts`, `src/engine/exporter.ts`)
- **Motion Presets:** Breathe, Grow & Wither, Typed, Gust, Reach, Scatter, and Visitor (interactive butterfly).
- **Dual Export Modes:**
  - **Video Loop Mode:** MediaRecorder 16Mbps stream capture (MP4/WebM) and pure TypeScript IEEE 802.3 CRC32 PKZIP PNG frame sequence.
  - **Still Pic Mode:** Bloom timeline scrubber (0% bud to 100% full bloom) with instant 1x/2x/3x PNG and vector SVG export.

### 6. Dynamic SEO & Social Link Previews (`src/engine/seo.ts`)
- **Adaptive URL Metadata:** Automatically detects URL hash state (`#g=...`) and query parameters (`?text=...`) to personalize `<title>`, Open Graph tags (`og:title`, `og:description`), Twitter Card metadata, and canonical links based on the specific words and palette created by the gardener.
- **Social Sharing:** In-app Share buttons with Web Share API integration on mobile devices and automatic clipboard copy fallback.
- **High-Resolution Open Graph Image:** Bundles `public/og.png` (1200 x 630) and `public/favicon.svg` for rich preview cards across WhatsApp, Telegram, Discord, X/Twitter, Facebook, and LinkedIn.
- **Structured Data:** Embeds Schema.org `WebApplication` JSON-LD metadata for Google search indexing.

---

## Project Structure

```
TYPE-GARDEN-POSTER/
├── index.html                  # Main responsive UI shell with Open Graph and Twitter Card tags
├── package.json                # Dependencies and build scripts
├── tsconfig.json               # TypeScript 5 strict configuration
├── vite.config.ts              # Vite 6 bundler config (base: './')
├── vercel.json                 # Vercel deployment and static cache headers
├── .gitignore                  # Git ignore rules
├── .github/
│   └── workflows/deploy.yml    # Automated GitHub Actions deployment pipeline
├── public/
│   ├── favicon.svg             # Transparent botanical T-M vector favicon
│   └── og.png                  # High-resolution 1200x630 social sharing preview card
├── tests/
│   └── garden.test.ts          # Comprehensive Vitest test suite (26 unit tests)
├── src/
│   ├── main.ts                 # Application lifecycle, keyboard IME, and sync
│   ├── types.ts                # Strict TypeScript interfaces
│   ├── constants.ts            # Color palettes, motion presets, poster dimensions, blend modes, and textures
│   ├── storage/
│   │   └── localStore.ts       # IndexedDB (sprites via idb-keyval) + localStorage + LZString URL compression
│   ├── engine/
│   │   ├── math.ts             # Deterministic RNG, cubic Bezier, spring physics, CRC32, and easing helpers
│   │   ├── worker.ts           # Web Worker for non-blocking background removal & PKZIP archiver
│   │   ├── bgRemove.ts         # OffscreenCanvas auto corner flood-fill background removal dispatcher
│   │   ├── textures.ts         # Procedural tile generator, blend modes, vignette, and 11fps boil
│   │   ├── botanical.ts        # Procedural vine, leaf, rose petal, and butterfly generator
│   │   ├── poster.ts           # Multi-line typography layout engine, portrait bias, and SVG exporter
│   │   ├── renderer.ts         # Canvas2D & SVG hybrid vector/sprite renderer
│   │   ├── exporter.ts         # 16Mbps MediaRecorder video stream (MP4/WebM) + CRC32 ZIP frame exporter
│   │   └── seo.ts              # URL-adaptive dynamic metadata, Open Graph, and Twitter Cards engine
│   └── ui/
│       ├── modals.ts           # Sprite manager, texture selector, credits modal, and toasts
│       └── studioInspector.ts  # 4-tab Poster Studio inspector (Design, Size & Motion, Sprites, Textures)
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v25)
- npm 9+

### Installation
```bash
npm install
```

### Development
Start the local Vite development server:
```bash
npm run dev
```

### Production Build
Type-check with strict `tsc` and bundle with Vite:
```bash
npm run build
```
The optimized bundle will be generated in `dist/` (~30KB gzipped).

### Testing
Run unit tests with Vitest:
```bash
npm test
```

### Preview Build
Preview the production build locally:
```bash
npm run preview
```

---

## Deployment

Type Garden Studio requires zero database or cloud storage backend configuration and is ready to deploy directly to Vercel or GitHub Pages.

### Deploy to Vercel

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), select **Add New Project** and import your repository.
3. Framework Preset: **Vite** (auto-detected).
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Click **Deploy**. Vercel will serve your app at a custom `.vercel.app` domain with instant global edge CDN caching.

Alternatively, deploy directly from your terminal:
```bash
npx vercel
```

### Deploy to GitHub Pages

The repository includes a ready-to-run GitHub Actions workflow in `.github/workflows/deploy.yml`.

1. Push your code to the `main` branch on GitHub.
2. In your GitHub repository, navigate to **Settings > Pages**.
3. Under **Build and deployment > Source**, choose **GitHub Actions**.
4. GitHub Actions will automatically run tests, build the Vite production bundle, and publish your site at `https://<username>.github.io/<repository-name>/`.
5. Because `vite.config.ts` uses relative asset resolution (`base: './'`), all scripts, fonts, and worker chunks load seamlessly on both subpaths and root domains.

---

## Design & Accessibility

This implementation adheres strictly to human craftsmanship standards:
- **No Em Dashes:** UI copy uses clean hyphens, colons, commas, or parentheses.
- **Accessibility:** Text elements meet WCAG AA contrast standards.
- **Mobile First:** Touch targets meet the 44px minimum recommendation; dynamic viewports reflow across mobile and desktop.
- **No Dead Controls:** Every button, slider, and input has an active, tested function.

---

## License

MIT License. Designed with reference to [type-garden.vercel.app](https://type-garden.vercel.app/).
