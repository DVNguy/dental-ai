export const PX_PER_METER = 50;
export const GRID_M = 0.8;

export function pxToM(px: number): number {
  return px / PX_PER_METER;
}

export function mToPx(m: number): number {
  return m * PX_PER_METER;
}

export function px2ToM2(widthPx: number, heightPx: number): number {
  const widthM = pxToM(widthPx);
  const heightM = pxToM(heightPx);
  return Math.round(widthM * heightM * 10) / 10;
}

export function snapToGridM(m: number): number {
  return Math.round(m / GRID_M) * GRID_M;
}

export function clampM(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeToMeters(value: number): number {
  const LEGACY_PIXEL_THRESHOLD = 30; // Assumes medical practice layouts < 30m; old 40px grid positions get converted
  return value >= LEGACY_PIXEL_THRESHOLD ? value / PX_PER_METER : value;
}
