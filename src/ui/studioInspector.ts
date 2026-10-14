import { AppState, PaletteColors, SpriteRecord, TextureConfig } from '../types';
import { PRESETS, RAW_PALETTES, SIZES, TEX_TYPES, BLENDS } from '../constants';

export interface StudioInspectorCallbacks {
  onStateChange: (patch: Partial<AppState>) => void;
  onSpriteUpload: (slot: 'flower' | 'leaf' | 'stalk', file: File) => void;
  onSpriteClear: (slot: 'flower' | 'leaf' | 'stalk') => void;
  onSpriteUpdate: (slot: 'flower' | 'leaf' | 'stalk', patch: { removeBg?: boolean; tol?: number; scale?: number }) => void;
  onTextureTypeChange: (type: TextureConfig['type']) => void;
  onTextureBlendChange: (blend: TextureConfig['blend']) => void;
  onTextureParamChange: (param: 'opacity' | 'scale' | 'vignette' | 'animate', val: number | boolean) => void;
  onTexturePicUpload: (file: File) => void;
  onTextureVideoUpload: (file: File) => void;
  onExportVideo: () => void;
  onExportFramesZip: () => void;
  onExportSnapshotPng: () => void;
  onExportStillPic: (fmt: 'png' | 'jpeg' | 'webp') => void;
  onExportPosterSvg: () => void;
}

export class StudioInspector {
  private container: HTMLElement;
  private callbacks: StudioInspectorCallbacks;

  constructor(container: HTMLElement, callbacks: StudioInspectorCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.bindStaticListeners();
  }

  private bindStaticListeners(): void {
    const root = this.container;

    // Version switcher (Video Loop vs Still Pic)
    root.querySelector('#tg-pver-loop')?.addEventListener('click', () => {
      this.callbacks.onStateChange({ posterVersion: 'loop' });
    });
    root.querySelector('#tg-pver-pic')?.addEventListener('click', () => {
      this.callbacks.onStateChange({ posterVersion: 'pic' });
    });

    // Tab buttons
    root.querySelectorAll('[data-ptab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const target = tabBtn.getAttribute('data-ptab');
        root.querySelectorAll('[data-ptab]').forEach((b) => b.classList.toggle('active', b === tabBtn));
        root.querySelectorAll('[data-ptab-pane]').forEach((pane) => {
          const el = pane as HTMLElement;
          el.style.display = el.getAttribute('data-ptab-pane') === target ? 'flex' : 'none';
        });
      });
    });

    // Garden text input
    const pText = root.querySelector('#tg-ptext') as HTMLInputElement | null;
    pText?.addEventListener('input', (e) => {
      this.callbacks.onStateChange({ text: (e.target as HTMLInputElement).value });
    });
    pText?.addEventListener('focus', () => {
      if (pText) pText.style.borderColor = '#FFFFFF';
    });
    pText?.addEventListener('blur', () => {
      if (pText) pText.style.borderColor = '#262626';
    });

    // Reshuffle seed
    root.querySelector('#tg-btn-reshuffle')?.addEventListener('click', () => {
      this.callbacks.onStateChange({ seed: Math.floor(Math.random() * 1e6) });
    });

    // Still pic scrubber
    const scrub = root.querySelector('#tg-pic-scrub') as HTMLInputElement | null;
    const scrubVal = root.querySelector('#tg-scrub-val');
    scrub?.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value) || 0;
      if (scrubVal) scrubVal.textContent = `${Math.round(v * 100)}%`;
      this.callbacks.onStateChange({ picScrub: v });
    });

    // Loop duration & fps
    const loopDur = root.querySelector('#tg-loop-dur') as HTMLSelectElement | null;
    loopDur?.addEventListener('change', (e) => {
      this.callbacks.onStateChange({ loopDur: parseInt((e.target as HTMLSelectElement).value, 10) || 0 });
    });

    const loopFps = root.querySelector('#tg-loop-fps') as HTMLSelectElement | null;
    loopFps?.addEventListener('change', (e) => {
      this.callbacks.onStateChange({ loopFps: (parseInt((e.target as HTMLSelectElement).value, 10) || 30) as 24 | 30 | 60 });
    });

    // Format chips for Still Pic
    root.querySelectorAll('[data-pic-fmt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fmt = btn.getAttribute('data-pic-fmt') as 'png' | 'jpeg' | 'webp';
        this.callbacks.onStateChange({ picFormat: fmt });
      });
    });

    // Dimensions input & swap
    const cw = root.querySelector('#tg-cw') as HTMLInputElement | null;
    const ch = root.querySelector('#tg-ch') as HTMLInputElement | null;
    const applyDims = () => {
      const w = Math.max(200, Math.min(4096, parseInt(cw?.value || '1080', 10) || 1080));
      const h = Math.max(200, Math.min(4096, parseInt(ch?.value || '1080', 10) || 1080));
      if (cw) cw.value = String(w);
      if (ch) ch.value = String(h);
      this.callbacks.onStateChange({ sizeId: 'custom', pw: w, ph: h });
    };
    cw?.addEventListener('change', applyDims);
    ch?.addEventListener('change', applyDims);

    root.querySelector('#tg-btn-swap-wh')?.addEventListener('click', () => {
      if (cw && ch) {
        const nw = parseInt(ch.value, 10) || 1080;
        const nh = parseInt(cw.value, 10) || 1080;
        cw.value = String(nw);
        ch.value = String(nh);
        this.callbacks.onStateChange({ sizeId: 'custom', pw: nw, ph: nh });
      }
    });

    // Export buttons
    root.querySelector('#tg-btn-export-video')?.addEventListener('click', () => this.callbacks.onExportVideo());
    root.querySelector('#tg-btn-export-frames')?.addEventListener('click', () => this.callbacks.onExportFramesZip());
    root.querySelector('#tg-btn-export-poster-png')?.addEventListener('click', () => this.callbacks.onExportSnapshotPng());
    root.querySelector('#tg-btn-export-poster-pic')?.addEventListener('click', () => {
      const activeFmt = root.querySelector('[data-pic-fmt].active')?.getAttribute('data-pic-fmt') || 'png';
      this.callbacks.onExportStillPic(activeFmt as 'png' | 'jpeg' | 'webp');
    });
    root.querySelector('#tg-btn-export-poster-svg')?.addEventListener('click', () => this.callbacks.onExportPosterSvg());
  }

  public render(
    state: AppState,
    _palette: PaletteColors,
    sprites: SpriteRecord,
    tex: TextureConfig,
    hasVideoMime: boolean
  ): void {
    const root = this.container;
    const isLoop = state.posterVersion !== 'pic';
    const pr = PRESETS.find((p) => p.id === state.preset) || PRESETS[0];
    const effT = state.loopDur && state.loopDur > 0 ? state.loopDur : pr.T;
    const fps = state.loopFps || 30;

    // Header updates
    const infoLabel = root.querySelector('#tg-info-label');
    if (infoLabel) {
      infoLabel.textContent = isLoop
        ? `${state.pw}×${state.ph} · ${effT / 1000}s · ${fps}fps`
        : `${state.pw}×${state.ph} · ${(state.picFormat || 'png').toUpperCase()}`;
    }

    const btnLoop = root.querySelector('#tg-pver-loop') as HTMLElement | null;
    const btnPic = root.querySelector('#tg-pver-pic') as HTMLElement | null;
    if (btnLoop && btnPic) {
      btnLoop.style.background = isLoop ? '#FFFFFF' : 'transparent';
      btnLoop.style.color = isLoop ? '#000000' : '#8E8E8E';
      btnPic.style.background = !isLoop ? '#FFFFFF' : 'transparent';
      btnPic.style.color = !isLoop ? '#000000' : '#8E8E8E';
    }

    // Design tab visibility
    const picScrubWrap = root.querySelector('#tg-pic-scrubber-wrap') as HTMLElement | null;
    const loopCfgWrap = root.querySelector('#tg-loop-cfg-wrap') as HTMLElement | null;
    if (picScrubWrap) picScrubWrap.style.display = isLoop ? 'none' : 'flex';
    if (loopCfgWrap) loopCfgWrap.style.display = isLoop ? 'grid' : 'none';

    const ptext = root.querySelector('#tg-ptext') as HTMLInputElement | null;
    if (ptext && ptext.value !== state.text) {
      ptext.value = state.text;
    }

    // Palette cards
    const palCards = root.querySelector('#tg-pal-cards');
    if (palCards && palCards.children.length === 0) {
      palCards.innerHTML = '';
      RAW_PALETTES.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'tg-pal-card';
        btn.id = `tg-pal-card-${i}`;
        btn.setAttribute('aria-label', p[0]);
        btn.innerHTML = `
          <span style="display:flex;align-items:center;justify-content:center;height:44px;border-radius:8px;background:${p[1]}">
            <span style="width:18px;height:18px;border-radius:50%;background:${p[2]}"></span>
            <span style="width:12px;height:12px;border-radius:50%;background:${p[3]};margin-left:-4px"></span>
            <span style="font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:18px;color:${p[5]};margin-left:8px">Aa</span>
          </span>
          <span style="padding:0 4px;color:#EDEDED;">${p[0]}</span>
        `;
        btn.addEventListener('click', () => {
          this.callbacks.onStateChange({ palette: i });
        });
        palCards.appendChild(btn);
      });
    }

    RAW_PALETTES.forEach((_, i) => {
      const card = root.querySelector(`#tg-pal-card-${i}`) as HTMLElement | null;
      if (card) {
        card.style.borderColor = state.palette === i ? '#FFFFFF' : '#2A2A2A';
      }
    });

    // Size presets & Motion presets
    const sizeList = root.querySelector('#tg-size-list');
    if (sizeList && sizeList.children.length === 0) {
      sizeList.innerHTML = '';
      SIZES.forEach((sz) => {
        const btn = document.createElement('button');
        btn.className = 'tg-preset-btn';
        btn.id = `tg-size-${sz.id}`;
        btn.innerHTML = `
          <span style="font-size:12px;color:#FFFFFF;">${sz.label}</span>
          <span style="color:#8C8C8C;font-size:10px;">${sz.sub}</span>
        `;
        btn.addEventListener('click', () => {
          const cwEl = root.querySelector('#tg-cw') as HTMLInputElement | null;
          const chEl = root.querySelector('#tg-ch') as HTMLInputElement | null;
          if (cwEl) cwEl.value = String(sz.w);
          if (chEl) chEl.value = String(sz.h);
          this.callbacks.onStateChange({ sizeId: sz.id, pw: sz.w, ph: sz.h });
        });
        sizeList.appendChild(btn);
      });
    }

    SIZES.forEach((sz) => {
      const btn = root.querySelector(`#tg-size-${sz.id}`) as HTMLElement | null;
      if (btn) {
        const isAct = state.sizeId === sz.id && state.pw === sz.w && state.ph === sz.h;
        btn.style.background = isAct ? '#161616' : 'transparent';
        btn.style.borderColor = isAct ? '#FFFFFF' : '#2A2A2A';
      }
    });

    const presetList = root.querySelector('#tg-preset-list');
    if (presetList && presetList.children.length === 0) {
      presetList.innerHTML = '';
      PRESETS.forEach((p) => {
        const btn = document.createElement('button');
        btn.className = 'tg-preset-btn';
        btn.id = `tg-preset-${p.id}`;
        btn.innerHTML = `
          <span style="font-size:13px;color:#FFFFFF;">${p.label}</span>
          <span style="color:#8C8C8C;font-size:11px;">${p.sub}</span>
        `;
        btn.addEventListener('click', () => {
          this.callbacks.onStateChange({ preset: p.id });
        });
        presetList.appendChild(btn);
      });
    }

    PRESETS.forEach((p) => {
      const btn = root.querySelector(`#tg-preset-${p.id}`) as HTMLElement | null;
      if (btn) {
        btn.style.background = state.preset === p.id ? '#161616' : 'transparent';
        btn.style.borderColor = state.preset === p.id ? '#FFFFFF' : '#2A2A2A';
      }
    });

    // Render sprites manager
    this.renderSpriteManagerPane(root.querySelector('#tg-sprite-manager'), sprites, 'pane');

    // Render texture manager
    this.renderTextureManagerPane(root.querySelector('#tg-tex-manager'), tex, 'pane');

    // Footer updates
    const exportHead = root.querySelector('#tg-export-head');
    if (exportHead) {
      exportHead.textContent = isLoop
        ? `Video Loop · ${state.pw} × ${state.ph}`
        : `Still Pic · ${state.pw} × ${state.ph}`;
    }

    const exportPicBox = root.querySelector('#tg-export-pic-box') as HTMLElement | null;
    const exportLoopBox = root.querySelector('#tg-export-loop-box') as HTMLElement | null;
    if (exportPicBox) exportPicBox.style.display = isLoop ? 'none' : 'flex';
    if (exportLoopBox) exportLoopBox.style.display = isLoop ? 'flex' : 'none';

    root.querySelectorAll('[data-pic-fmt]').forEach((btn) => {
      const fmt = btn.getAttribute('data-pic-fmt');
      btn.classList.toggle('active', (state.picFormat || 'png') === fmt);
    });

    const picBtn = root.querySelector('#tg-btn-export-poster-pic');
    if (picBtn) {
      const fmtUp = (state.picFormat || 'png').toUpperCase();
      picBtn.textContent = `Download Still Pic (${fmtUp} · ${state.pw}×${state.ph})`;
    }

    const vidBtn = root.querySelector('#tg-btn-export-video') as HTMLButtonElement | null;
    if (vidBtn) {
      vidBtn.disabled = state.busy;
      vidBtn.textContent = hasVideoMime
        ? state.busy
          ? 'Exporting…'
          : `Export Video Loop (${state.pw}×${state.ph} · ${fps}fps)`
        : 'Video export unavailable in this browser';
    }

    const framesBtn = root.querySelector('#tg-btn-export-frames') as HTMLButtonElement | null;
    if (framesBtn) framesBtn.disabled = state.busy;

    const statusEl = root.querySelector('#tg-status');
    if (statusEl) statusEl.textContent = state.status;
  }

  public renderSpriteManagerPane(
    container: HTMLElement | null,
    sprites: SpriteRecord,
    idPrefix: string
  ): void {
    if (!container) return;
    container.innerHTML = '';
    const slots: { key: 'flower' | 'leaf' | 'stalk'; title: string; hint: string }[] = [
      { key: 'flower', title: 'Flower Head', hint: 'Replaces rose bloom' },
      { key: 'leaf', title: 'Leaf / Foliage', hint: 'Replaces side leaves' },
      { key: 'stalk', title: 'Flower Stalk / Stem', hint: 'Repeats along vines' }
    ];

    slots.forEach((sl) => {
      const sp = sprites[sl.key];
      const card = document.createElement('div');
      card.className = 'tg-asset-card';
      const inputId = `tg-file-${sl.key}-${idPrefix}`;

      card.innerHTML = `
        <div class="tg-asset-row">
          <div class="tg-asset-thumb">
            ${sp.cleanUrl ? `<img src="${sp.cleanUrl}" alt="${sl.key}">` : `<span style="font-size:10px;color:#666;">Vec</span>`}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="color:#FFF;font-size:12px;font-weight:500;">${sl.title}</div>
            <div style="color:#777;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${sp.name ? sp.name : sl.hint}
            </div>
          </div>
          <label for="${inputId}" class="tg-mini-btn" style="cursor:pointer;">Upload</label>
          <input id="${inputId}" type="file" accept=".png,.svg,.jpg,.jpeg,.webp,image/*" style="display:none;">
          ${sp.rawUrl ? `<button class="tg-mini-btn danger" data-clear="${sl.key}">✕</button>` : ''}
        </div>
        ${
          sp.rawUrl
            ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:4px;border-top:1px solid #1E1E1E;font-size:11px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;color:#BDBDBD;">
              <input type="checkbox" data-bg="${sl.key}" ${sp.removeBg ? 'checked' : ''}>
              Auto No-BG
            </label>
            <div style="display:flex;align-items:center;gap:5px;flex:1;max-width:140px;">
              <span style="color:#777;font-size:10px;">Scale</span>
              <input type="range" data-scale="${sl.key}" min="0.4" max="2.2" step="0.1" value="${sp.scale}" style="width:100%;">
            </div>
          </div>
        `
            : ''
        }
      `;

      const fileInp = card.querySelector(`#${inputId}`) as HTMLInputElement | null;
      fileInp?.addEventListener('change', (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (f) this.callbacks.onSpriteUpload(sl.key, f);
      });

      const clrBtn = card.querySelector(`[data-clear="${sl.key}"]`);
      clrBtn?.addEventListener('click', () => this.callbacks.onSpriteClear(sl.key));

      const bgChk = card.querySelector(`[data-bg="${sl.key}"]`) as HTMLInputElement | null;
      bgChk?.addEventListener('change', (e) => {
        this.callbacks.onSpriteUpdate(sl.key, { removeBg: (e.target as HTMLInputElement).checked });
      });

      const scRng = card.querySelector(`[data-scale="${sl.key}"]`) as HTMLInputElement | null;
      scRng?.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value) || 1.0;
        this.callbacks.onSpriteUpdate(sl.key, { scale: val });
      });

      container.appendChild(card);
    });
  }

  public renderTextureManagerPane(
    container: HTMLElement | null,
    tx: TextureConfig,
    idPrefix: string
  ): void {
    if (!container) return;
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'tg-asset-card';
    const upPicId = `tg-tex-file-${idPrefix}`;
    const upVidId = `tg-tex-vid-${idPrefix}`;

    const chipsHtml = TEX_TYPES.map(
      (t) =>
        `<button type="button" class="tg-tex-chip ${tx.type === t.id ? 'active' : ''}" data-tex-type="${t.id}">${t.label}</button>`
    ).join('');

    const blendsHtml = BLENDS.map(
      (b) => `<option value="${b.id}" ${tx.blend === b.id ? 'selected' : ''}>${b.label}</option>`
    ).join('');

    card.innerHTML = `
      <div class="tg-tex-grid" style="grid-template-columns:repeat(4,1fr);">${chipsHtml}</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
        <div>
          <div style="color:#888;font-size:10px;margin-bottom:4px;">Blend Mode</div>
          <select class="tg-select" data-tex-blend>${blendsHtml}</select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <div>
            <div style="color:#888;font-size:10px;margin-bottom:4px;">Pic Texture (PNG/JPG/WebP)</div>
            <label for="${upPicId}" class="tg-mini-btn" style="display:block;text-align:center;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${tx.customName ? tx.customName : 'Upload Pic'}
            </label>
            <input id="${upPicId}" type="file" accept=".png,.svg,.jpg,.jpeg,.webp,image/*" style="display:none;">
          </div>
          <div>
            <div style="color:#888;font-size:10px;margin-bottom:4px;">Video Loop (MP4/WebM)</div>
            <label for="${upVidId}" class="tg-mini-btn" style="display:block;text-align:center;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-color:#9FB4FF;color:#9FB4FF;">
              ${tx.videoName ? tx.videoName : 'Upload Video'}
            </label>
            <input id="${upVidId}" type="file" accept=".mp4,.webm,.mov,video/*" style="display:none;">
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="color:#AAA;width:62px;">Opacity</span>
          <input type="range" data-tex-op min="0" max="1" step="0.02" value="${tx.opacity}" style="flex:1;">
          <span data-tex-op-val style="color:#888;width:34px;text-align:right;">${Math.round(tx.opacity * 100)}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="color:#AAA;width:62px;">Scale</span>
          <input type="range" data-tex-sc min="0.4" max="2.5" step="0.1" value="${tx.scale}" style="flex:1;">
          <span data-tex-sc-val style="color:#888;width:34px;text-align:right;">${tx.scale.toFixed(1)}×</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="color:#AAA;width:62px;">Vignette</span>
          <input type="range" data-tex-vig min="0" max="0.9" step="0.03" value="${tx.vignette}" style="flex:1;">
          <span data-tex-vig-val style="color:#888;width:34px;text-align:right;">${Math.round(tx.vignette * 100)}%</span>
        </div>
        <label style="display:flex;align-items:center;gap:6px;color:#BDBDBD;cursor:pointer;padding-top:2px;">
          <input type="checkbox" data-tex-anim ${tx.animate ? 'checked' : ''}>
          Animate grain / texture boil (11 fps)
        </label>
      </div>
    `;

    card.querySelectorAll('[data-tex-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-tex-type') as TextureConfig['type'];
        this.callbacks.onTextureTypeChange(type);
      });
    });

    const blendSel = card.querySelector('[data-tex-blend]') as HTMLSelectElement | null;
    blendSel?.addEventListener('change', (e) => {
      this.callbacks.onTextureBlendChange((e.target as HTMLSelectElement).value as TextureConfig['blend']);
    });

    const picInp = card.querySelector(`#${upPicId}`) as HTMLInputElement | null;
    picInp?.addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) this.callbacks.onTexturePicUpload(f);
    });

    const vidInp = card.querySelector(`#${upVidId}`) as HTMLInputElement | null;
    vidInp?.addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) this.callbacks.onTextureVideoUpload(f);
    });

    const opRng = card.querySelector('[data-tex-op]') as HTMLInputElement | null;
    const opVal = card.querySelector('[data-tex-op-val]');
    opRng?.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value) || 0;
      if (opVal) opVal.textContent = `${Math.round(v * 100)}%`;
      this.callbacks.onTextureParamChange('opacity', v);
    });

    const scRng = card.querySelector('[data-tex-sc]') as HTMLInputElement | null;
    const scVal = card.querySelector('[data-tex-sc-val]');
    scRng?.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value) || 1;
      if (scVal) scVal.textContent = `${v.toFixed(1)}×`;
      this.callbacks.onTextureParamChange('scale', v);
    });

    const vigRng = card.querySelector('[data-tex-vig]') as HTMLInputElement | null;
    const vigVal = card.querySelector('[data-tex-vig-val]');
    vigRng?.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value) || 0;
      if (vigVal) vigVal.textContent = `${Math.round(v * 100)}%`;
      this.callbacks.onTextureParamChange('vignette', v);
    });

    const animChk = card.querySelector('[data-tex-anim]') as HTMLInputElement | null;
    animChk?.addEventListener('change', (e) => {
      this.callbacks.onTextureParamChange('animate', (e.target as HTMLInputElement).checked);
    });

    container.appendChild(card);
  }
}
