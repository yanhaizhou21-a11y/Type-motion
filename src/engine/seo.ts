import { decodeGardenStateFromUrl, ShareableGardenState } from '../storage/localStore';
import { getPalette, PRESETS } from '../constants';

export interface SeoMetadata {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  imageUrl: string;
  keywords: string;
}

function ensureMetaTag(attributeName: 'name' | 'property', attributeValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attributeName}="${attributeValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attributeName, attributeValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function ensureLinkTag(rel: string, href: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function ensureJsonLd(jsonObj: Record<string, unknown>): void {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('tg-seo-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'tg-seo-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonObj, null, 2);
}

export function computeSeoMetadata(
  customText?: string,
  paletteIdx?: number,
  presetId?: string
): SeoMetadata {
  let text = customText?.trim();
  let palIdx = paletteIdx;
  let presId = presetId;

  if (typeof window !== 'undefined') {
    // 1. Check URL hash state (#g=...)
    const hashState: ShareableGardenState | null = decodeGardenStateFromUrl(window.location.hash);
    if (hashState) {
      if (text === undefined && hashState.text) text = hashState.text.trim();
      if (palIdx === undefined && typeof hashState.palette === 'number') palIdx = hashState.palette;
      if (presId === undefined && hashState.preset) presId = hashState.preset;
    }

    // 2. Check query params fallback (?text=...&palette=...&preset=...)
    try {
      const sp = new URLSearchParams(window.location.search);
      const qText = sp.get('text') || sp.get('t');
      const qPal = sp.get('palette') || sp.get('pal');
      const qPreset = sp.get('preset') || sp.get('p');
      if (text === undefined && qText) text = qText.trim();
      if (palIdx === undefined && qPal) {
        const parsed = parseInt(qPal, 10);
        if (!isNaN(parsed)) palIdx = parsed;
      }
      if (presId === undefined && qPreset) presId = qPreset;
    } catch {
      // In non-browser or sandbox environments
    }
  }

  const origin = typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : 'https://type-motion-mu.vercel.app';
  const pathname = typeof window !== 'undefined' && window.location ? window.location.pathname : '/';
  const fullUrl = typeof window !== 'undefined' && window.location ? window.location.href : `${origin}${pathname}`;
  const baseImgUrl = `${origin}${pathname.endsWith('/') ? pathname : pathname + '/'}og.jpg`;

  const palName = typeof palIdx === 'number' ? getPalette(palIdx).name : 'Rose noir';
  const presetDef = PRESETS.find((p) => p.id === presId);
  const presetName = presetDef ? presetDef.label : 'Breathe';

  if (text && text.length > 0) {
    const cleanText = text.replace(/[\r\n\t]+/g, ' ');
    const displayWord = cleanText.length > 32 ? `${cleanText.slice(0, 32)}...` : cleanText;
    const title = `Type Garden: "${displayWord}" · Botanical Typography`;
    const description = `Botanical typography grown from "${displayWord}" with ${palName} palette and ${presetName} animation. Designed in Type Garden Studio (zero server cost).`;
    const ogTitle = `Type Garden: "${displayWord}"`;
    const ogDescription = `A generative garden of vines, thorns, and blooming roses grown from "${displayWord}". Create and export yours in real-time.`;

    return {
      title,
      description,
      ogTitle,
      ogDescription,
      canonicalUrl: fullUrl,
      imageUrl: baseImgUrl,
      keywords: `type garden, botanical typography, ${displayWord}, ${palName}, generative art, roses, vines, motion poster, creative coding`
    };
  }

  // Default home metadata
  const defaultTitle = 'Type Garden Studio: Generative Botanical Typography & Poster Studio';
  const defaultDescription = 'Type words to grow procedural vector botanical vines, blooming roses, and leaves in real-time, or design social media and device posters with zero server cost.';
  const defaultOgTitle = 'Type Garden Studio: Botanical Typography & Motion Posters';
  const defaultOgDescription = 'Interactive generative botanical typography engine. Type to bloom flowers, design high-resolution social posters, and export MP4 video or vector SVG with zero cloud fees.';

  return {
    title: defaultTitle,
    description: defaultDescription,
    ogTitle: defaultOgTitle,
    ogDescription: defaultOgDescription,
    canonicalUrl: fullUrl,
    imageUrl: baseImgUrl,
    keywords: 'type garden studio, botanical typography, procedural vines, blooming roses, generative art, social media posters, creative coding, typescript, vite, canvas2d'
  };
}

export function updateDynamicSeo(
  customText?: string,
  paletteIdx?: number,
  presetId?: string
): SeoMetadata {
  const meta = computeSeoMetadata(customText, paletteIdx, presetId);

  if (typeof document === 'undefined') return meta;

  // 1. Update Document Title
  document.title = meta.title;

  // 2. Standard Search Meta Tags
  ensureMetaTag('name', 'description', meta.description);
  ensureMetaTag('name', 'keywords', meta.keywords);
  ensureMetaTag('name', 'author', 'Type Garden Studio (Reference: Akshat Agarwal)');

  // 3. Open Graph Meta Tags (WhatsApp, Facebook, Discord, Telegram, LinkedIn)
  ensureMetaTag('property', 'og:site_name', 'Type Garden Studio');
  ensureMetaTag('property', 'og:type', 'website');
  ensureMetaTag('property', 'og:title', meta.ogTitle);
  ensureMetaTag('property', 'og:description', meta.ogDescription);
  ensureMetaTag('property', 'og:url', meta.canonicalUrl);
  ensureMetaTag('property', 'og:image', meta.imageUrl);
  ensureMetaTag('property', 'og:image:secure_url', meta.imageUrl);
  ensureMetaTag('property', 'og:image:type', 'image/jpeg');
  ensureMetaTag('property', 'og:image:width', '1200');
  ensureMetaTag('property', 'og:image:height', '630');
  ensureMetaTag('property', 'og:image:alt', 'Type Garden Studio botanical typography overgrown with blooming roses');

  // WhatsApp / Link image fallback
  ensureLinkTag('image_src', meta.imageUrl);

  // 4. Twitter / X Cards
  ensureMetaTag('name', 'twitter:card', 'summary_large_image');
  ensureMetaTag('name', 'twitter:title', meta.ogTitle);
  ensureMetaTag('name', 'twitter:description', meta.ogDescription);
  ensureMetaTag('name', 'twitter:image', meta.imageUrl);
  ensureMetaTag('name', 'twitter:site', '@art_akshat');
  ensureMetaTag('name', 'twitter:creator', '@art_akshat');

  // 5. Canonical Link
  ensureLinkTag('canonical', meta.canonicalUrl);

  // 6. Schema.org WebApplication JSON-LD
  ensureJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    'name': meta.title,
    'description': meta.description,
    'url': meta.canonicalUrl,
    'image': meta.imageUrl,
    'applicationCategory': 'MultimediaApplication',
    'operatingSystem': 'All',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD'
    },
    'creator': {
      '@type': 'Person',
      'name': 'Akshat Agarwal',
      'url': 'https://x.com/art_akshat'
    }
  });

  return meta;
}

export function initSeoListener(): void {
  if (typeof window === 'undefined') return;

  // Initial update
  updateDynamicSeo();

  // Listen for hash changes (when a user loads or pastes a new #g=... share link)
  window.addEventListener('hashchange', () => {
    updateDynamicSeo();
  });

  // Listen for popstate (query param / history navigation)
  window.addEventListener('popstate', () => {
    updateDynamicSeo();
  });
}
