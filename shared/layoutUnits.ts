export const GRID_SIZE_PX = 40;
export const METERS_PER_TILE = 0.8;

export function pxToTiles(px: number): number {
  return Math.round(px / GRID_SIZE_PX);
}

export function tilesToPx(tiles: number): number {
  return tiles * GRID_SIZE_PX;
}

export function tilesToApproxMeters(tiles: number): number {
  return Math.round(tiles * METERS_PER_TILE * 10) / 10;
}

export function pxToApproxMeters(px: number): number {
  return tilesToApproxMeters(pxToTiles(px));
}

export type DistanceBucket = "short" | "medium" | "long";

export function classifyDistanceBucket(tiles: number): DistanceBucket {
  if (tiles <= 3) return "short";
  if (tiles <= 8) return "medium";
  return "long";
}

export function distanceBucketLabel(bucket: DistanceBucket, lang: "de" | "en" = "de"): string {
  const labels = {
    de: { short: "kurz", medium: "mittel", long: "lang" },
    en: { short: "short", medium: "medium", long: "long" },
  };
  return labels[lang][bucket];
}

export function roomAreaTiles(widthPx: number, heightPx: number): number {
  return pxToTiles(widthPx) * pxToTiles(heightPx);
}

export function roomAreaApproxSqm(widthPx: number, heightPx: number): number {
  const widthM = tilesToApproxMeters(pxToTiles(widthPx));
  const heightM = tilesToApproxMeters(pxToTiles(heightPx));
  return Math.round(widthM * heightM * 10) / 10;
}

export type RoomSizeBucket = "undersized" | "ok" | "optimal" | "oversized";

export interface RoomSizeStandard {
  minSqM: number;
  maxSqM: number;
  optimalSqM: number;
}

const ROOM_SIZE_DEFAULTS: Record<string, RoomSizeStandard> = {
  reception: { minSqM: 8, maxSqM: 14, optimalSqM: 10 },
  waiting: { minSqM: 15, maxSqM: 35, optimalSqM: 22 },
  exam: { minSqM: 9, maxSqM: 12, optimalSqM: 10 },
  lab: { minSqM: 8, maxSqM: 15, optimalSqM: 10 },
  office: { minSqM: 10, maxSqM: 18, optimalSqM: 14 },
  sterilization: { minSqM: 8, maxSqM: 14, optimalSqM: 10.5 },
  storage: { minSqM: 4, maxSqM: 10, optimalSqM: 6 },
  toilet: { minSqM: 3, maxSqM: 6, optimalSqM: 4.4 },
  kitchen: { minSqM: 6, maxSqM: 12, optimalSqM: 7.5 },
  changing: { minSqM: 5, maxSqM: 10, optimalSqM: 6.6 },
};

export function classifyRoomSize(roomType: string, areaSqm: number): RoomSizeBucket {
  const normalized = roomType.toLowerCase().trim();
  const standards = ROOM_SIZE_DEFAULTS[normalized];
  
  if (!standards) {
    if (areaSqm < 6) return "undersized";
    if (areaSqm > 20) return "oversized";
    return "ok";
  }
  
  const { minSqM, maxSqM, optimalSqM } = standards;
  
  if (areaSqm < minSqM) return "undersized";
  if (areaSqm > maxSqM) return "oversized";
  
  const optimalRange = optimalSqM * 0.15;
  if (areaSqm >= optimalSqM - optimalRange && areaSqm <= optimalSqM + optimalRange) {
    return "optimal";
  }
  
  return "ok";
}

export function roomSizeBucketLabel(bucket: RoomSizeBucket, lang: "de" | "en" = "de"): string {
  const labels = {
    de: { undersized: "zu klein", ok: "ok", optimal: "optimal", oversized: "zu groß" },
    en: { undersized: "too small", ok: "ok", optimal: "optimal", oversized: "too large" },
  };
  return labels[lang][bucket];
}

export function roomSizeBucketColor(bucket: RoomSizeBucket): string {
  switch (bucket) {
    case "undersized": return "text-orange-600 bg-orange-100";
    case "ok": return "text-blue-600 bg-blue-100";
    case "optimal": return "text-green-600 bg-green-100";
    case "oversized": return "text-red-600 bg-red-100";
  }
}

export function distanceBucketColor(bucket: DistanceBucket): string {
  switch (bucket) {
    case "short": return "text-green-600 bg-green-100";
    case "medium": return "text-yellow-600 bg-yellow-100";
    case "long": return "text-red-600 bg-red-100";
  }
}

export function distanceInTiles(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): number {
  const cx1 = x1 + w1 / 2;
  const cy1 = y1 + h1 / 2;
  const cx2 = x2 + w2 / 2;
  const cy2 = y2 + h2 / 2;
  const distPx = Math.sqrt(Math.pow(cx2 - cx1, 2) + Math.pow(cy2 - cy1, 2));
  return pxToTiles(distPx);
}
