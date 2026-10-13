import * as React from 'react';
import { cn } from './utils';

export { cn };

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Resolves a CSS variable expression like 'var(--primary)' or hex/HSL string
 */
export function resolveThemeColor(element: HTMLElement | null, colorExpr: string): string {
  if (typeof window === 'undefined' || !element) return colorExpr;
  const trimmed = colorExpr.trim();
  if (trimmed.startsWith('var(') && trimmed.endsWith(')')) {
    const varName = trimmed.slice(4, -1).split(',')[0].trim();
    const rawVal =
      getComputedStyle(element).getPropertyValue(varName).trim() ||
      getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!rawVal) return '#f55123';
    if (rawVal.startsWith('#') || rawVal.startsWith('rgb') || rawVal.startsWith('hsl')) {
      return rawVal;
    }
    return `hsl(${rawVal})`;
  }
  return trimmed;
}

/**
 * Parses any CSS color string (#hex, rgb(), hsl()) into { r, g, b } (0-255)
 */
export function parseColorToRgb(colorStr: string, fallback: RgbColor = { r: 245, g: 81, b: 35 }): RgbColor {
  if (!colorStr) return fallback;
  const s = colorStr.trim();

  // Hex #rrggbb or #rgb
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
    }
  }

  // rgb(r, g, b)
  const rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
    };
  }

  // hsl(h s% l%) or hsl(h, s%, l%)
  const hslMatch = s.match(/hsla?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/i);
  if (hslMatch) {
    const h = ((Number(hslMatch[1]) % 360) + 360) % 360;
    const sat = Math.max(0, Math.min(100, Number(hslMatch[2]))) / 100;
    const light = Math.max(0, Math.min(100, Number(hslMatch[3]))) / 100;

    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = light - c / 2;
    let r1 = 0,
      g1 = 0,
      b1 = 0;

    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  return fallback;
}

/**
 * Triggers a re-render key when root style attributes (--primary, class, etc.) change
 */
export function useThemeKey(): number {
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const obs = new MutationObserver(() => {
      setKey((k) => k + 1);
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme'],
    });
    return () => obs.disconnect();
  }, []);

  return key;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const manual = document.documentElement.getAttribute('data-reduced-motion') === 'true';
      setReduced(mq.matches || manual);
    };
    update();
    mq.addEventListener('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduced-motion'],
    });
    return () => {
      mq.removeEventListener('change', update);
      obs.disconnect();
    };
  }, []);

  return reduced;
}

export function useVisibilityPause(
  ref: React.RefObject<Element | null>,
  options: { threshold?: number } = {}
): boolean {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { threshold: options.threshold ?? 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, options.threshold]);

  return visible;
}
