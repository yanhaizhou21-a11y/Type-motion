import {
  AppState,
  Butterfly,
  GiftRose,
  Letter,
  PaletteColors,
  PeerGardener,
  PerchPoint,
  PosterEngineData,
  SpriteRecord,
  TextureConfig
} from './types';
import {
  FLOWERS,
  FONT_FAMILY,
  RAW_PALETTES,
  TINTS,
  getPalette,
  PRESETS
} from './constants';
import {
  loadSettingsFromLocal,
  saveSettingsToLocal,
  decodeGardenStateFromUrl,
  encodeGardenStateToUrl
} from './storage/localStore';
import { eo } from './engine/math';
import { removeBackgroundOffscreen } from './engine/bgRemove';
import { TextureCompositor } from './engine/textures';
import {
  genLetterBotanicals,
  genEndBotanicals,
  stepAndDrawFlies
} from './engine/botanical';
import {
  createCanvasBackend,
  createSvgBackend,
  drawRose,
  renderBotanicalScene
} from './engine/renderer';
import {
  buildPoster,
  drawPosterScene,
  exportPosterSvgString,
  layoutCore
} from './engine/poster';
import {
  detectSupportedVideoMime,
  exportCanvasFramesZip,
  exportCanvasVideo,
  triggerDownload
} from './engine/exporter';
import { StudioInspector } from './ui/studioInspector';
import { ModalManager } from './ui/modals';
import { initSeoListener, updateDynamicSeo } from './engine/seo';

export class TypeGardenApp {
  public state: AppState = {
    mode: 'type',
    posterVersion: 'loop',
    picScrub: 0.65,
    picFormat: 'png',
    loopDur: 0,
    loopFps: 30,
    preset: 'breathe',
    palette: 0,
    text: 'in bloom',
    seed: 7,
    sizeId: 'ig-sq',
    pw: 1080,
    ph: 1080,
    status: '',
    busy: false
  };

  public sprites: SpriteRecord = {
    flower: { img: null, rawUrl: null, cleanUrl: null, removeBg: false, tol: 38, scale: 1.0, name: '' },
    leaf: { img: null, rawUrl: null, cleanUrl: null, removeBg: false, tol: 38, scale: 1.0, name: '' },
    stalk: { img: null, rawUrl: null, cleanUrl: null, removeBg: false, tol: 38, scale: 1.0, name: '' }
  };

  public tex: TextureConfig = {
    type: 'grain',
    blend: 'soft-light',
    opacity: 0.28,
    scale: 1.0,
    vignette: 0.22,
    animate: true,
    customUrl: null,
    customImg: null,
    customName: '',
    videoUrl: null,
    videoEl: null,
    videoName: ''
  };

  public compositor = new TextureCompositor();
  public modals!: ModalManager;
  public inspector!: StudioInspector;

  private cv!: HTMLCanvasElement;
  private g!: CanvasRenderingContext2D;
  private pcv!: HTMLCanvasElement;
  private inp!: HTMLInputElement;
  private appEl!: HTMLElement;

  private letters: Letter[] = [];
  private uid = 1;
  private cache: Record<string, number> = {};
  private Sd = 0;
  private St = 0;
  private cx = 0;
  private cy = 0;
  private ctx_ = 0;
  private cty = 0;
  private wrapped = false;
  private t0 = performance.now();
  private lastKey = 0;
  private lt = 0;
  private pt0 = 0;
  private dpr = 1;
  private W = 0;
  private H = 0;

  private mx: number | null = null;
  private my: number | null = null;
  private composing = false;
  private _kd = false;
  private touch = false;
  private iv = '\u200b';
  private prevMobVal = '';

  private flies: Butterfly[] = [];
  private perch: PerchPoint[] = [];
  private gifts: GiftRose[] = [];
  private peers = new Map<string, PeerGardener>();
  private me!: { id: string; n: string; c: string };
  private net: { send: (ev: string, payload: unknown) => void; close: () => void } | null = null;
  private others = 0;
  private lastSend = 0;
  private sentX: number | null = null;
  private sentY: number | null = null;
  private lastTap: { t: number; x: number; y: number } | null = null;
  private lastPlant = 0;

  private posterData: PosterEngineData | null = null;
  private vmime = detectSupportedVideoMime();

  constructor() {
    initSeoListener();
    this.loadState();
    this.initDOM();
    this.initPeers();
    this.initLoop();
    updateDynamicSeo(this.state.text, this.state.palette, this.state.preset);
  }

  private loadState(): void {
    const fromUrl = decodeGardenStateFromUrl();
    if (fromUrl) {
      this.state.text = fromUrl.text || this.state.text;
      this.state.palette = fromUrl.palette ?? this.state.palette;
      this.state.seed = fromUrl.seed ?? this.state.seed;
      this.state.preset = fromUrl.preset || this.state.preset;
      this.state.sizeId = fromUrl.sizeId || this.state.sizeId;
      this.state.pw = fromUrl.pw || this.state.pw;
      this.state.ph = fromUrl.ph || this.state.ph;
    } else {
      const local = loadSettingsFromLocal();
      if (local) {
        if (local.palette != null) this.state.palette = local.palette;
        if (local.preset) this.state.preset = local.preset;
        if (local.sizeId) this.state.sizeId = local.sizeId;
        if (local.pw) this.state.pw = local.pw;
        if (local.ph) this.state.ph = local.ph;
        if (local.text) this.state.text = local.text;
        if (local.posterVersion) this.state.posterVersion = local.posterVersion;
        if (local.picScrub != null) this.state.picScrub = local.picScrub;
        if (local.picFormat) this.state.picFormat = local.picFormat;
        if (local.loopDur != null) this.state.loopDur = local.loopDur;
        if (local.loopFps != null) this.state.loopFps = local.loopFps;

        if (local.sprites) {
          (['flower', 'leaf', 'stalk'] as const).forEach((k) => {
            const sv = local.sprites?.[k];
            if (sv && sv.rawUrl) {
              this.sprites[k].rawUrl = sv.rawUrl;
              this.sprites[k].removeBg = !!sv.removeBg;
              this.sprites[k].tol = sv.tol ?? 38;
              this.sprites[k].scale = sv.scale ?? 1.0;
              this.sprites[k].name = sv.name || k;
              this.rebuildSpriteImage(k, false);
            }
          });
        }

        if (local.tex) {
          Object.assign(this.tex, local.tex, { customImg: null, videoEl: null });
          if (this.tex.customUrl) {
            const im = new Image();
            im.onload = () => {
              this.tex.customImg = im;
              this.inspector.render(this.state, this.pal(), this.sprites, this.tex, !!this.vmime);
            };
            im.src = this.tex.customUrl;
          }
        }
      }
    }
  }

  private saveState(): void {
    saveSettingsToLocal(this.state, this.sprites, this.tex);
    const query = encodeGardenStateToUrl(this.state);
    if (typeof window !== 'undefined' && window.location) {
      const current = window.location.search || window.location.hash;
      if (query && current !== query) {
        window.history.replaceState(null, '', `${window.location.pathname}${query}`);
      } else if (!query && (window.location.search || window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
    updateDynamicSeo(this.state.text, this.state.palette, this.state.preset);
  }

  private async shareGardenUrl(): Promise<void> {
    const query = encodeGardenStateToUrl(this.state);
    const url = `${window.location.origin}${window.location.pathname}${query}`;
    const clean = (this.state.text || '').trim();
    const title = clean.length > 0 ? `Type Garden: "${clean}"` : 'Type Garden Studio';
    const text = clean.length > 0
      ? `Check out my botanical typography for "${clean}" in Type Garden Studio!`
      : 'Type words to grow blooming roses and botanical vines in Type Garden Studio!';

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      /mobile|android|iphone|ipad/i.test(navigator.userAgent || '')
    ) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      this.modals.showToast('Garden share link copied to clipboard!');
    } catch {
      this.modals.showToast(url);
    }
  }

  public pal(): PaletteColors {
    return getPalette(this.state.palette);
  }

  public measureWidth(ch: string): number {
    if (this.cache[ch] != null) return this.cache[ch];
    this.g.font = `700 100px ${FONT_FAMILY}`;
    let w = this.g.measureText(ch).width / 100;
    if (ch === ' ') w *= 1.4;
    return (this.cache[ch] = w);
  }

  private initDOM(): void {
    this.cv = document.getElementById('tg-cv') as HTMLCanvasElement;
    this.g = this.cv.getContext('2d')!;
    this.pcv = document.getElementById('tg-pcv') as HTMLCanvasElement;
    this.inp = document.getElementById('tg-inp') as HTMLInputElement;
    this.appEl = document.getElementById('tg-app')!;

    this.touch = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (this.touch) document.documentElement.setAttribute('data-touch', '');

    this.modals = new ModalManager(() => this.refocus());

    const panelEl = document.getElementById('tg-panel')!;
    this.inspector = new StudioInspector(panelEl, {
      onStateChange: (patch) => this.setState(patch),
      onSpriteUpload: (slot, file) => this.handleSpriteUpload(slot, file),
      onSpriteClear: (slot) => this.clearSprite(slot),
      onSpriteUpdate: (slot, patch) => {
        Object.assign(this.sprites[slot], patch);
        if ('removeBg' in patch || 'tol' in patch) {
          this.rebuildSpriteImage(slot, true);
        } else {
          this.saveState();
        }
      },
      onTextureTypeChange: (type) => {
        this.tex.type = type;
        if (type === 'video' && this.tex.videoEl) {
          this.tex.videoEl.play().catch(() => {});
        }
        this.inspector.render(this.state, this.pal(), this.sprites, this.tex, !!this.vmime);
        this.saveState();
      },
      onTextureBlendChange: (blend) => {
        this.tex.blend = blend;
        this.saveState();
      },
      onTextureParamChange: (param, val) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.tex as any)[param] = val;
        this.saveState();
      },
      onTexturePicUpload: (file) => this.handleTexPicUpload(file),
      onTextureVideoUpload: (file) => this.handleTexVideoUpload(file),
      onExportVideo: () => this.exportVideo(),
      onExportFramesZip: () => this.exportFramesZip(),
      onExportSnapshotPng: () => this.exportSnapshotPng(),
      onExportStillPic: (fmt) => this.exportStillPic(fmt),
      onExportPosterSvg: () => this.exportPosterSvg()
    });

    // Populate quick Type-mode modal managers
    this.inspector.renderSpriteManagerPane(
      document.getElementById('tg-sprite-manager-modal'),
      this.sprites,
      'modal'
    );
    this.inspector.renderTextureManagerPane(
      document.getElementById('tg-tex-manager-modal'),
      this.tex,
      'modal'
    );

    // Global listeners
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.handleKey(e));
    window.addEventListener('pointermove', (e) => {
      this.mx = e.clientX;
      this.my = e.clientY;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') this.mx = null;
    });

    document.addEventListener('pointerleave', () => {
      this.mx = null;
    });

    // Keyboard & input handling
    this.inp.value = this.iv;
    this.inp.addEventListener('compositionstart', () => {
      this.composing = true;
    });
    this.inp.addEventListener('compositionend', () => {
      this.composing = false;
      setTimeout(() => {
        if (!this.composing) this.inputDiff(this.inp);
      }, 0);
    });
    this.inp.addEventListener('input', (e) => this.inputDiff(e.target as HTMLInputElement));

    // Mode buttons
    document.getElementById('tg-mode-type')?.addEventListener('click', () => {
      if (this.state.mode !== 'type') {
        this.setState({ mode: 'type' });
        if (this.letters.length === 0 && this.state.text) {
          const now = performance.now();
          for (const ch of this.state.text) {
            this.addLetter(ch, now);
          }
        }
        this.syncMobileInputValue();
        this.resize();
        this.refocus();
      }
    });

    document.getElementById('tg-mode-poster')?.addEventListener('click', () => {
      if (this.state.mode !== 'poster') {
        const txt = this.liveText() || this.state.text;
        this.setState({ mode: 'poster', text: txt });
      }
    });

    // Color Swatches in bottom bar & mobile dock
    const palBar = document.getElementById('tg-pal-bar');
    const mobPalBar = document.getElementById('tg-mob-pal-bar');
    [palBar, mobPalBar].forEach((container) => {
      if (container) {
        container.innerHTML = '';
        RAW_PALETTES.forEach((p, i) => {
          const btn = document.createElement('button');
          btn.setAttribute('data-tg', 'sw');
          btn.className = 'tg-sw';
          btn.setAttribute('aria-label', p[0]);
          btn.title = p[0];
          btn.style.background = p[1];
          btn.innerHTML = `<span data-tg="dot" style="background:${p[2]}"></span>`;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setState({ palette: i });
            this.refocus();
          });
          container.appendChild(btn);
        });
      }
    });

    // Mobile input & stepped poster flow
    const mobInput = document.getElementById('tg-mob-input') as HTMLInputElement | null;
    mobInput?.addEventListener('input', () => {
      const cur = mobInput.value;
      let p = 0;
      while (p < this.prevMobVal.length && p < cur.length && this.prevMobVal[p] === cur[p]) p++;
      const dels = this.prevMobVal.length - p;
      const adds = cur.slice(p);
      const now = performance.now();
      this.lastKey = now;
      for (let i = 0; i < dels; i++) this.wither(now);
      for (const ch of adds) {
        if (ch === '\n') {
          this.letters = [];
          this.layout();
        } else {
          this.addLetter(ch, now);
        }
      }
      this.prevMobVal = cur;
    });

    document.getElementById('tg-mob-btn-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mobInput) mobInput.value = '';
      this.prevMobVal = '';
      this.letters = [];
      this.layout();
      this.refocus();
    });

    document.getElementById('tg-mob-btn-goto-poster')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const txt = mobInput?.value.trim() || this.liveText();
      this.setState({
        mode: 'poster',
        text: txt || this.state.text
      });
      document.body.setAttribute('data-mob-view', 'preview');
    });

    document.getElementById('tg-mob-back-type')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setState({ mode: 'type' });
      if (this.letters.length === 0 && this.state.text) {
        const now = performance.now();
        for (const ch of this.state.text) {
          this.addLetter(ch, now);
        }
      }
      this.syncMobileInputValue();
      this.refocus();
    });

    const mobViewPrev = document.getElementById('tg-mob-view-preview');
    const mobViewEdit = document.getElementById('tg-mob-view-edit');
    mobViewPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.setAttribute('data-mob-view', 'preview');
      mobViewPrev.classList.add('active');
      mobViewEdit?.classList.remove('active');
      this.rebuildPosterData();
    });
    mobViewEdit?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.setAttribute('data-mob-view', 'edit');
      mobViewEdit.classList.add('active');
      mobViewPrev?.classList.remove('active');
    });

    document.getElementById('tg-mob-stage-png')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportSnapshotPng();
    });
    document.getElementById('tg-mob-stage-share')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.shareGardenUrl();
    });
    document.getElementById('tg-mob-poster-share')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.shareGardenUrl();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const vv = window.visualViewport;
        if (vv) {
          const offset = window.innerHeight - (vv.height + vv.offsetTop);
          document.documentElement.style.setProperty('--tg-kb-offset', `${Math.max(0, offset)}px`);
        }
      });
    }

    // Type mode quick download buttons
    document.getElementById('tg-btn-png')?.addEventListener('click', () => {
      this.saveTypePng();
      this.refocus();
    });
    document.getElementById('tg-btn-svg')?.addEventListener('click', () => {
      this.saveTypeSvg();
      this.refocus();
    });

    const onShare = async () => {
      await this.shareGardenUrl();
      this.refocus();
    };
    document.getElementById('tg-btn-share')?.addEventListener('click', onShare);
    document.getElementById('tg-btn-poster-share')?.addEventListener('click', onShare);

    // Tap/Click to focus, spawn fly, or double-tap plant rose
    this.appEl.addEventListener('pointerdown', (ev) => {
      if (this.state.mode !== 'type' || !this.inp) return;
      if (
        ev.target &&
        (ev.target as HTMLElement).closest &&
        ((ev.target as HTMLElement).closest('.tg-modal') ||
          (ev.target as HTMLElement).closest('[data-tg="bar"]') ||
          (ev.target as HTMLElement).closest('.tg-mobile-dock') ||
          (ev.target as HTMLElement).closest('[data-tg="modes"]'))
      ) {
        return;
      }
      const onCanvas = ev.target === this.cv;
      if (window.innerWidth <= 680) {
        mobInput?.focus();
      } else {
        this.inp.focus({ preventScroll: true });
      }
      if (onCanvas) {
        const now = performance.now();
        const lp = this.lastTap;
        this.lastTap = { t: now, x: ev.clientX, y: ev.clientY };
        if (
          lp &&
          now - lp.t < 340 &&
          Math.hypot(ev.clientX - lp.x, ev.clientY - lp.y) < 40 &&
          now - (this.lastPlant || 0) > 1800
        ) {
          this.lastPlant = now;
          this.lastTap = null;
          const g = {
            x: Math.round((ev.clientX / this.W) * 1000) / 1000,
            y: Math.round((ev.clientY / this.H) * 1000) / 1000,
            s: Math.floor(Math.random() * 1e6)
          };
          this.liveRose(g);
          if (this.net) this.net.send('r', g);
        } else {
          this.spawnFly(ev.clientX, ev.clientY);
        }
      }
    });

    if (document.fonts) {
      document.fonts.load(`700 100px ${FONT_FAMILY}`).then(() => {
        this.cache = {};
        this.layout(true);
        this.rebuildPosterData();
      }).catch(() => {});
    }

    this.resize();
    this.rebuildPosterData();
    document.body.setAttribute('data-tg-mode', this.state.mode);
    document.body.setAttribute('data-mob-view', 'preview');
    this.syncMobileInputValue();
    if (this.state.text && this.letters.length === 0) {
      const now = performance.now();
      for (const ch of this.state.text) {
        this.addLetter(ch, now);
      }
    }
    this.updateUI();

    if (!this.touch) {
      setTimeout(() => this.refocus(), 60);
    }
  }

  public setState(patch: Partial<AppState>): void {
    Object.assign(this.state, patch);
    this.updateUI();
    if (
      'seed' in patch ||
      'preset' in patch ||
      'text' in patch ||
      'mode' in patch ||
      'palette' in patch ||
      'pw' in patch ||
      'ph' in patch ||
      'sizeId' in patch ||
      'loopDur' in patch ||
      'posterVersion' in patch ||
      'picScrub' in patch ||
      'picFormat' in patch ||
      'loopFps' in patch
    ) {
      this.rebuildPosterData();
      this.saveState();
    }
  }

  private updateUI(): void {
    const s = this.state;
    const isType = s.mode === 'type';
    const curPal = this.pal();

    this.appEl.style.background = curPal.bg;
    document.documentElement.style.setProperty('--tg-flower', curPal.C.red);
    document.documentElement.style.setProperty('--tg-stem', curPal.C.blue);
    document.documentElement.style.setProperty('--tg-detail', curPal.C.line);

    document.body.setAttribute('data-tg-mode', s.mode);
    if (isType) {
      this.syncMobileInputValue();
    }
    this.cv.style.display = isType ? 'block' : 'none';
    const peersEl = document.getElementById('tg-peers');
    if (peersEl) peersEl.style.display = isType ? 'block' : 'none';
    const barEl = document.getElementById('tg-bar');
    if (barEl) {
      barEl.style.display = isType ? 'flex' : 'none';
      barEl.style.color = curPal.C.text;
    }
    const posterEl = document.getElementById('tg-poster');
    if (posterEl) posterEl.style.display = isType ? 'none' : 'grid';

    const btnType = document.getElementById('tg-mode-type');
    const btnPoster = document.getElementById('tg-mode-poster');
    if (btnType) {
      btnType.style.background = isType ? '#FFFFFF' : 'transparent';
      btnType.style.color = isType ? '#000000' : '#BDBDBD';
    }
    if (btnPoster) {
      btnPoster.style.background = !isType ? '#FFFFFF' : 'transparent';
      btnPoster.style.color = !isType ? '#000000' : '#BDBDBD';
    }

    const swatches = document.querySelectorAll('[data-tg="sw"]');
    swatches.forEach((sw, i) => {
      const el = sw as HTMLElement;
      const isAct = s.palette === i;
      const p = RAW_PALETTES[i];
      el.style.borderColor = isAct
        ? curPal.C.text
        : p[1] === curPal.bg
        ? '#3A3A3A'
        : 'transparent';
      el.style.transform = isAct ? 'scale(1.1)' : 'scale(1)';
    });

    if (this.pcv) {
      if (this.pcv.width !== s.pw || this.pcv.height !== s.ph) {
        this.pcv.width = s.pw;
        this.pcv.height = s.ph;
      }
      this.pcv.style.aspectRatio = `${s.pw} / ${s.ph}`;
    }

    const stageMeta = document.getElementById('tg-stage-meta');
    if (stageMeta) {
      const pr = PRESETS.find((p) => p.id === s.preset) || PRESETS[0];
      const effT = s.loopDur && s.loopDur > 0 ? s.loopDur : pr.T;
      const fps = s.loopFps || 30;
      stageMeta.textContent = `${s.pw} × ${s.ph} · ${
        s.posterVersion === 'loop'
          ? `${pr.label} (${effT / 1000}s @ ${fps}fps)`
          : `Still Pose (${Math.round((s.picScrub ?? 0.65) * 100)}%)`
      } · ${curPal.name}`;
    }

    this.inspector.render(this.state, curPal, this.sprites, this.tex, !!this.vmime);
  }

  public rebuildPosterData(): void {
    if (!this.g) return;
    this.posterData = buildPoster(
      this.state.text,
      this.state.seed,
      this.state.preset,
      this.state.pw,
      this.state.ph,
      this.state.loopDur,
      (ch) => this.measureWidth(ch)
    );
    this.pt0 = performance.now();
  }

  public handleSpriteUpload(slot: 'flower' | 'leaf' | 'stalk', file: File): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const isJpg = /jpe?g$/i.test(file.name) || file.type === 'image/jpeg';
      const sp = this.sprites[slot];
      sp.rawUrl = dataUrl;
      sp.name = file.name.slice(0, 22);
      if (isJpg) sp.removeBg = true;
      this.rebuildSpriteImage(slot, true);
    };
    reader.readAsDataURL(file);
  }

  public rebuildSpriteImage(slot: 'flower' | 'leaf' | 'stalk', persist = true): void {
    const sp = this.sprites[slot];
    if (!sp.rawUrl) {
      sp.img = null;
      sp.cleanUrl = null;
      this.updateUI();
      if (persist) this.saveState();
      return;
    }

    const rawImg = new Image();
    rawImg.crossOrigin = 'anonymous';
    rawImg.onload = async () => {
      if (!sp.removeBg) {
        sp.img = rawImg;
        sp.cleanUrl = sp.rawUrl;
        this.updateUI();
        if (persist) this.saveState();
        return;
      }
      try {
        const cleanDataUrl = await removeBackgroundOffscreen(rawImg, sp.tol, 512);
        const cleanImg = new Image();
        cleanImg.onload = () => {
          sp.img = cleanImg;
          sp.cleanUrl = cleanDataUrl;
          this.updateUI();
          if (persist) this.saveState();
        };
        cleanImg.src = cleanDataUrl;
      } catch {
        sp.img = rawImg;
        sp.cleanUrl = sp.rawUrl;
        this.updateUI();
      }
    };
    rawImg.src = sp.rawUrl;
  }

  public clearSprite(slot: 'flower' | 'leaf' | 'stalk'): void {
    this.sprites[slot] = {
      img: null,
      rawUrl: null,
      cleanUrl: null,
      removeBg: false,
      tol: 38,
      scale: 1.0,
      name: ''
    };
    this.updateUI();
    this.saveState();
  }

  public handleTexPicUpload(file: File): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const im = new Image();
      im.onload = () => {
        this.tex.customUrl = url;
        this.tex.customImg = im;
        this.tex.customName = file.name.slice(0, 18);
        this.tex.type = 'custom';
        this.updateUI();
        this.saveState();
      };
      im.src = url;
    };
    reader.readAsDataURL(file);
  }

  public handleTexVideoUpload(file: File): void {
    if (!file) return;
    if (this.tex.videoUrl) URL.revokeObjectURL(this.tex.videoUrl);
    const url = URL.createObjectURL(file);
    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    vid.onloadeddata = () => {
      vid.play().catch(() => {});
      this.tex.videoUrl = url;
      this.tex.videoEl = vid;
      this.tex.videoName = file.name.slice(0, 18);
      this.tex.type = 'video';
      this.updateUI();
    };
  }

  private resize(): void {
    const c = this.cv;
    const r = c.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    if (!r.width) return;
    this.W = r.width;
    this.H = r.height;
    this.dpr = d;
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
    this.layout(true);
  }

  private layout(snap = false): void {
    if (!this.W) return;
    const A = this.letters.filter((l) => !l.dead);
    const res = layoutCore(A, this.W, this.H, this.wrapped, (ch) => this.measureWidth(ch));
    this.wrapped = res.wrapped;
    A.forEach((l) => {
      if (l.x == null) {
        l.x = l.tx;
        l.y = l.ty;
      }
    });
    const S = res.S;
    const last = A[A.length - 1];
    this.St = S;
    this.ctx_ = last ? last.tx! + (last.tw || 0) / 2 + 0.07 * S : this.W / 2;
    this.cty = last ? last.ty! - 0.33 * S : this.H / 2;
    if (snap || !this.Sd) {
      this.Sd = S;
      this.cx = this.ctx_;
      this.cy = this.cty;
      A.forEach((l) => {
        l.x = l.tx;
        l.y = l.ty;
      });
    }
  }

  private refocus(): void {
    if (this.state.mode === 'type') {
      if (window.innerWidth <= 680) {
        (document.getElementById('tg-mob-input') as HTMLInputElement | null)?.focus();
      } else if (this.inp) {
        this.inp.focus({ preventScroll: true });
      }
    }
  }

  private syncMobileInputValue(): void {
    const mobInp = document.getElementById('tg-mob-input') as HTMLInputElement | null;
    if (!mobInp) return;
    const live = this.liveText();
    const targetVal = live.length > 0 ? live : (this.state.text || '');
    if (mobInp.value !== targetVal && mobInp !== document.activeElement) {
      mobInp.value = targetVal;
      this.prevMobVal = targetVal;
    }
  }

  public liveText(): string {
    return (this.letters || []).filter((l) => !l.dead).map((l) => l.ch).join('').trim();
  }

  private inputDiff(el: HTMLInputElement): void {
    const S = this.iv;
    if (this.state.mode !== 'type' || this._kd) {
      this.iv = this.composing ? el.value : S;
      if (!this.composing) el.value = S;
      return;
    }
    const old = this.iv == null ? S : this.iv;
    const cur = el.value;
    let p = 0;
    while (p < old.length && p < cur.length && old[p] === cur[p]) p++;
    let dels = old.length - p;
    if (p === 0 && old[0] === S && old.length > 1) dels -= 1;
    const now = performance.now();
    this.lastKey = now;
    for (let i = 0; i < dels; i++) this.wither(now);
    for (const ch of cur.slice(p)) {
      if (ch === S) continue;
      if (ch.charCodeAt(0) === 10) {
        this.letters = [];
        this.layout();
      } else {
        this.addLetter(ch, now);
      }
    }
    if (this.composing) this.iv = cur;
    else {
      el.value = S;
      this.iv = S;
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.state.mode !== 'type') return;
    if (this.modals.isAnyModalOpen()) return;

    if (e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.shiftKey ? this.saveTypeSvg() : this.saveTypePng();
      }
      return;
    }
    if (e.target && (e.target as HTMLElement).tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.target && (e.target as HTMLElement).tagName === 'INPUT' && e.target !== this.inp) return;

    const now = performance.now();
    const A = this.letters.filter((l) => !l.dead);
    const last = A[A.length - 1];

    if (e.key === 'Backspace') {
      e.preventDefault();
      this.mark();
      if (!last) return;
      last.dead = now;
      const pv = A[A.length - 2];
      if (pv && pv.ch !== ' ') {
        pv.cut = null;
        pv.endEls = null;
        pv.tb = now;
      }
      this.layout();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.mark();
      this.letters = [];
      this.layout();
      return;
    }
    if (e.key.length !== 1) return;
    e.preventDefault();
    this.mark();
    this.addLetter(e.key, now);
  }

  private mark(): void {
    this.lastKey = performance.now();
    this._kd = true;
    setTimeout(() => {
      this._kd = false;
    }, 0);
  }

  private addLetter(ch: string, now: number): void {
    const A = this.letters.filter((l) => !l.dead);
    const last = A[A.length - 1];
    if (ch === ' ') {
      if (last && last.ch !== ' ') {
        last.cut = now;
        genEndBotanicals(last, now - (last.birth || 0), (c) => this.measureWidth(c));
      }
      this.letters.push({ ch: ' ', id: this.uid++, birth: now, els: [], ws: 0, wi: 0, prev: null });
      this.layout();
      return;
    }
    const same = last && last.ch !== ' ';
    const l: Letter = {
      ch,
      id: this.uid++,
      birth: now,
      tb: now,
      ws: same ? last.ws : Math.floor(Math.random() * 1e9),
      wi: same ? last.wi + 1 : 0,
      prev: same ? last : null
    };
    genLetterBotanicals(l, (c) => this.measureWidth(c));
    this.letters.push(l);
    this.layout();
  }

  private wither(now: number): void {
    const A = this.letters.filter((l) => !l.dead);
    const last = A[A.length - 1];
    if (!last) return;
    last.dead = now;
    const pv = A[A.length - 2];
    if (pv && pv.ch !== ' ') {
      pv.cut = null;
      pv.endEls = null;
      pv.tb = now;
    }
    this.layout();
  }

  public spawnFly(cx: number, cy: number): void {
    if (this.flies.length >= 6) {
      const o = this.flies.find((f) => f.st !== 'leave');
      if (o) {
        o.st = 'leave';
        o.pid = null;
        o.ex = o.x < this.W / 2 ? -80 : this.W + 80;
        o.ey = o.y - this.H * 0.3;
      }
    }
    const taken = new Set(this.flies.filter((f) => f.st !== 'leave').map((f) => f.pid));
    let best: PerchPoint | null = null;
    let bd = 1e9;
    for (const p of this.perch) {
      if (taken.has(p.id)) continue;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const left = cx < this.W / 2;
    const sz = Math.max(9, this.Sd * 0.09);
    this.flies.push({
      x: left ? -40 : this.W + 40,
      y: cy + (Math.random() - 0.5) * this.H * 0.4,
      vx: 0,
      vy: 0,
      st: best ? 'fly' : 'wander',
      pid: best ? best.id : null,
      hx: cx,
      hy: cy,
      t0: performance.now(),
      ph: Math.random() * 6,
      sz,
      seed: Math.random() * 100,
      ang: 0
    });
  }

  private initPeers(): void {
    const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
    this.me = {
      id: Math.random().toString(36).slice(2, 10),
      n: pick(FLOWERS),
      c: pick(TINTS)
    };

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('tg-live');
        const roster = new Map<string, { n: string; c: string; t: number }>();
        const publish = () => {
          const now = Date.now();
          const out: Record<string, { n: string; c: string }> = {};
          for (const [k, v] of roster) {
            if (now - v.t > 3500) roster.delete(k);
            else out[k] = { n: v.n, c: v.c };
          }
          this.livePresence(out);
        };
        const beat = () => {
          roster.set(this.me.id, { n: this.me.n, c: this.me.c, t: Date.now() });
          bc.postMessage({ k: 'hello', id: this.me.id, n: this.me.n, c: this.me.c });
          publish();
        };
        bc.onmessage = ({ data: d }) => {
          if (d.k === 'hello') {
            const had = roster.has(d.id);
            roster.set(d.id, { n: d.n, c: d.c, t: Date.now() });
            if (!had) publish();
          } else if (d.k === 'bye') {
            roster.delete(d.id);
            publish();
          } else if (d.k === 'p') {
            this.livePeer(d.payload);
          } else if (d.k === 'r') {
            this.liveRose(d.payload);
          }
        };
        beat();
        setInterval(beat, 1000);
        this.net = {
          send: (ev, payload) => bc.postMessage({ k: ev, payload }),
          close: () => {
            bc.postMessage({ k: 'bye', id: this.me.id });
            bc.close();
          }
        };
      } catch {
        this.net = null;
      }
    }
  }

  private livePresence(roster: Record<string, { n: string; c: string }>): void {
    const countEl = document.getElementById('tg-count');
    const n = new Set([...Object.keys(roster), this.me.id]).size;
    this.others = n - 1;
    if (countEl) countEl.textContent = n > 1 ? `${n} gardeners here` : '';
  }

  private livePeer(d: { i: string; x?: number; y?: number; h?: boolean }): void {
    if (!d || d.i === this.me.id) return;
    let p = this.peers.get(d.i);
    if (!p) {
      if (this.peers.size >= 30) return;
      const el = document.createElement('div');
      el.className = 'tg-peer';
      el.style.opacity = '0';
      el.innerHTML =
        '<svg width="18" height="20" viewBox="0 0 18 20"><path d="M1 1L1 16L5.5 12L8.5 19L11.5 17.6L8.6 11H15Z" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg><span></span>';
      document.getElementById('tg-peers')?.appendChild(el);
      p = { id: d.i, el, x: null, y: null, tx: 0, ty: 0, t: 0, h: true, op: 0 };
      this.peers.set(d.i, p);
    }
    p.t = performance.now();
    p.h = !!d.h;
    if (!d.h && typeof d.x === 'number' && typeof d.y === 'number') {
      p.tx = Math.min(1.02, Math.max(-0.02, d.x));
      p.ty = Math.min(1.02, Math.max(-0.02, d.y));
      if (p.x == null) {
        p.x = p.tx * this.W;
        p.y = p.ty * this.H;
      }
    }
  }

  private liveRose(g: { x: number; y: number; s?: number }): void {
    if (!g || typeof g.x !== 'number' || typeof g.y !== 'number') return;
    this.gifts.push({
      x: Math.min(1, Math.max(0, g.x)),
      y: Math.min(1, Math.max(0, g.y)),
      t0: performance.now(),
      rot: (Math.random() - 0.5) * 0.8,
      e: { ph1: Math.random() * 6.28, ph2: Math.random() * 6.28, turns: 1.4 + Math.random() * 0.5 }
    });
    if (this.gifts.length > 14) this.gifts.shift();
  }

  private initLoop(): void {
    const loop = () => {
      requestAnimationFrame(loop);
      this.frame();
    };
    loop();
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min(64, now - (this.lt || now));
    this.lt = now;

    if (this.state.mode === 'poster') {
      if (this.pcv && this.posterData && !this.state.busy) {
        const t =
          this.state.posterVersion === 'pic'
            ? (this.state.picScrub ?? 0.65) * this.posterData.T
            : now - (this.pt0 || 0);

        const g = this.pcv.getContext('2d')!;
        g.setTransform(1, 0, 0, 1, 0, 0);
        const B = createCanvasBackend(g, this.sprites);
        drawPosterScene(
          B,
          t,
          this.posterData,
          this.pal(),
          this.sprites,
          this.state.posterVersion === 'pic'
        );
        this.compositor.applyTextureOverlay(
          g,
          this.posterData.W,
          this.posterData.H,
          now,
          this.tex,
          this.state.posterVersion === 'pic'
        );
      }
      return;
    }

    // Type mode easing & physics
    const k = 1 - Math.exp(-dt / 80);
    this.Sd += (this.St - this.Sd) * k;
    this.cx += (this.ctx_ - this.cx) * k;
    this.cy += (this.cty - this.cy) * k;
    for (const l of this.letters) {
      if (!l.dead && l.tx != null && l.ty != null) {
        if (l.x == null) l.x = l.tx;
        if (l.y == null) l.y = l.ty;
        l.x += (l.tx - l.x) * k;
        l.y += (l.ty - l.y) * k;
      }
    }
    this.letters = this.letters.filter((l) => !(l.dead && now - l.dead > 300));

    // Step peers broadcast
    const N = this.others + 1;
    const iv = Math.min(10000, Math.max(125, (1000 * N * N) / 40));
    if (this.net && this.others > 0 && this.mx != null && !document.hidden && now - this.lastSend >= iv) {
      const x = Math.round((this.mx / this.W) * 1000) / 1000;
      const y = Math.round((this.my! / this.H) * 1000) / 1000;
      if (x !== this.sentX || y !== this.sentY) {
        this.lastSend = now;
        this.sentX = x;
        this.sentY = y;
        this.net.send('p', { i: this.me.id, x, y });
      }
    }

    // Paint Type Mode canvas
    this.paintType(now);
  }

  private paintType(now: number): void {
    const g = this.g;
    const d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    const curPal = this.pal();
    g.fillStyle = curPal.bg;
    g.fillRect(0, 0, this.W, this.H);

    const B = createCanvasBackend(g, this.sprites);
    this.perch = [];

    // Pointer 3D tilt tracking
    for (const l of this.letters) {
      let tx = 0;
      let ty = 0;
      const A = !l.dead && l.ch !== ' ' && this.mx != null ? [this.mx, this.my!] : null;
      if (A) {
        const dx = A[0] - l.x!;
        const dy = A[1] - (l.y! - this.Sd * 0.6);
        const dist = Math.hypot(dx, dy);
        const reach = Math.max(260, this.Sd * 3.2);
        if (dist < reach && dist > 1) {
          const w = 1 - dist / reach;
          const s = w * w * (3 - 2 * w);
          tx = (dx / dist) * s;
          ty = (dy / dist) * s;
        }
      }
      const c = l.lean || (l.lean = [0, 0]);
      c[0] += (tx - c[0]) * 0.07;
      c[1] += (ty - c[1]) * 0.07;
    }

    renderBotanicalScene(
      B,
      now,
      {
        letters: this.letters,
        S: this.Sd,
        C: curPal.C,
        boil: true,
        recoil: 20,
        speed: 1,
        wither: 260,
        textAll: false
      },
      this.sprites,
      this.perch
    );

    // Butterflies
    this.flies = stepAndDrawFlies(
      B,
      this.flies,
      this.perch,
      now,
      curPal.C,
      this.W,
      this.H,
      Math.min(48, now - (this.lt || now))
    );

    // Gift roses
    if (this.gifts.length) {
      const LIFE = 60000;
      this.gifts = this.gifts.filter((gf) => now - gf.t0 < LIFE);
      for (const gf of this.gifts) {
        const age = now - gf.t0;
        const w = 1 - eo((age - (LIFE - 2200)) / 2200);
        g.globalAlpha = Math.max(0, w);
        drawRose(
          B,
          gf.x * this.W,
          gf.y * this.H + (1 - w) * this.Sd * 0.3,
          this.Sd * 0.24 * (0.65 + 0.35 * w),
          gf.rot + (1 - w) * 0.6,
          gf.e,
          age,
          null,
          curPal.C,
          this.sprites
        );
      }
      g.globalAlpha = 1;
    }

    // Caret
    const S = this.Sd;
    const on = now - this.lastKey < 500 || Math.floor(now / 530) % 2 === 0;
    const hf = eo((now - this.t0) / 600);
    if (on && hf > 0) {
      const h = 0.8 * S * hf;
      const w = Math.max(2, S * 0.03);
      B.rect(this.cx - w / 2, this.cy - h / 2, w, h, curPal.C.text);
    }

    this.compositor.applyTextureOverlay(g, this.W, this.H, now, this.tex, false);
  }

  public saveTypePng(): void {
    this.paintType(performance.now());
    if (!this.cv || !this.cv.width || !this.cv.height) return;
    this.cv.toBlob((b) => {
      if (b) triggerDownload(b, 'garden.png');
    });
  }

  public saveTypeSvg(): void {
    const curPal = this.pal();
    const svgBackend = createSvgBackend(this.sprites);
    renderBotanicalScene(
      svgBackend.backend,
      performance.now(),
      {
        letters: this.letters,
        S: this.Sd,
        C: curPal.C,
        boil: false,
        recoil: 20,
        speed: 1,
        wither: 260,
        textAll: false
      },
      this.sprites,
      []
    );

    const elements = svgBackend.getElements();
    const texSvg = this.compositor.getTextureSvgElements(this.tex, this.W, this.H);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(this.W)}" height="${Math.round(this.H)}" viewBox="0 0 ${Math.round(this.W)} ${Math.round(this.H)}"><defs><style>@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&amp;display=swap');text{font-family:'Playfair Display',Georgia,serif;font-weight:700;}</style>${texSvg.defs}</defs><rect width="100%" height="100%" fill="${curPal.bg}"/>${elements}${texSvg.rects}</svg>`;
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), 'garden.svg');
  }

  public async exportVideo(): Promise<void> {
    if (!this.posterData || !this.vmime || this.state.busy) return;
    const P = this.posterData;
    const fps = this.state.loopFps || 30;
    this.setState({ busy: true, status: 'Recording…' });

    try {
      const renderFrame = (t: number, targetCanvas?: HTMLCanvasElement) => {
        const dest = targetCanvas || this.pcv;
        if (!dest) return;
        if (dest.width !== P.W || dest.height !== P.H) {
          dest.width = P.W;
          dest.height = P.H;
        }
        const g = dest.getContext('2d')!;
        g.setTransform(1, 0, 0, 1, 0, 0);
        const B = createCanvasBackend(g, this.sprites);
        drawPosterScene(B, t, P, this.pal(), this.sprites, false);
        this.compositor.applyTextureOverlay(g, P.W, P.H, t, this.tex, false);

        if (targetCanvas && this.pcv && targetCanvas !== this.pcv) {
          const pg = this.pcv.getContext('2d');
          if (pg) {
            pg.setTransform(1, 0, 0, 1, 0, 0);
            pg.drawImage(targetCanvas, 0, 0, this.pcv.width, this.pcv.height);
          }
        }
      };

      const res = await exportCanvasVideo(
        renderFrame,
        P.W,
        P.H,
        P.T,
        fps,
        this.vmime,
        (pct) => this.setState({ status: `Recording ${pct}%` })
      );

      triggerDownload(res.blob, `garden-${P.W}x${P.H}-${fps}fps.${res.ext}`);
      this.setState({ busy: false, status: `Saved ${res.ext.toUpperCase()} loop` });
    } catch {
      this.setState({ busy: false, status: 'Video export failed' });
    }
  }

  public async exportFramesZip(): Promise<void> {
    if (!this.posterData || this.state.busy) return;
    const P = this.posterData;
    const fps = this.state.loopFps || 30;
    this.setState({ busy: true, status: 'Rendering frames…' });

    try {
      const renderFrame = (t: number, targetCanvas?: HTMLCanvasElement) => {
        const dest = targetCanvas || this.pcv;
        if (!dest) return;
        if (dest.width !== P.W || dest.height !== P.H) {
          dest.width = P.W;
          dest.height = P.H;
        }
        const g = dest.getContext('2d')!;
        g.setTransform(1, 0, 0, 1, 0, 0);
        const B = createCanvasBackend(g, this.sprites);
        drawPosterScene(B, t, P, this.pal(), this.sprites, false);
        this.compositor.applyTextureOverlay(g, P.W, P.H, t, this.tex, false);

        if (targetCanvas && this.pcv && targetCanvas !== this.pcv) {
          const pg = this.pcv.getContext('2d');
          if (pg) {
            pg.setTransform(1, 0, 0, 1, 0, 0);
            pg.drawImage(targetCanvas, 0, 0, this.pcv.width, this.pcv.height);
          }
        }
      };

      const zipBlob = await exportCanvasFramesZip(
        renderFrame,
        P.W,
        P.H,
        P.T,
        fps,
        (pct) => this.setState({ status: `Rendering ${pct}%` })
      );

      triggerDownload(zipBlob, `garden-${P.W}x${P.H}-${fps}fps-frames.zip`);
      this.setState({ busy: false, status: 'Saved PNG frames (.zip)' });
    } catch {
      this.setState({ busy: false, status: 'Frame export failed' });
    }
  }

  public exportSnapshotPng(): void {
    if (!this.pcv || !this.pcv.width || !this.pcv.height) return;
    this.pcv.toBlob((b) => {
      if (b) {
        triggerDownload(b, `poster-${this.state.pw}x${this.state.ph}.png`);
        this.setState({ status: 'Saved Snapshot (.png)' });
      }
    });
  }

  public exportStillPic(fmt: 'png' | 'jpeg' | 'webp'): void {
    if (!this.posterData) return;
    const P = this.posterData;
    const t = (this.state.picScrub ?? 0.65) * P.T;

    const c = document.createElement('canvas');
    c.width = P.W;
    c.height = P.H;
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const B = createCanvasBackend(g, this.sprites);
    drawPosterScene(B, t, P, this.pal(), this.sprites, true);
    this.compositor.applyTextureOverlay(g, P.W, P.H, t, this.tex, true);

    if (this.pcv) {
      if (this.pcv.width !== P.W || this.pcv.height !== P.H) {
        this.pcv.width = P.W;
        this.pcv.height = P.H;
      }
      const pg = this.pcv.getContext('2d');
      pg?.drawImage(c, 0, 0);
    }

    const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;

    c.toBlob((b) => {
      if (b) {
        triggerDownload(b, `garden-${P.W}x${P.H}.${ext}`);
        this.setState({ status: `Saved Still Pic (.${ext})` });
      }
    }, mime, 0.95);
  }

  public exportPosterSvg(): void {
    if (!this.posterData) return;
    const P = this.posterData;
    const t = (this.state.picScrub ?? 0.65) * P.T;
    const svgStr = exportPosterSvgString(
      P,
      t,
      this.pal(),
      this.sprites,
      this.tex,
      this.compositor
    );
    triggerDownload(new Blob([svgStr], { type: 'image/svg+xml' }), `garden-${P.W}x${P.H}.svg`);
    this.setState({ status: 'Saved Vector SVG (.svg)' });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).tg = new TypeGardenApp();
});
