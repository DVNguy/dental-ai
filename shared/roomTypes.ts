export const CANONICAL_ROOM_TYPES = [
  "reception",
  "waiting", 
  "exam",
  "lab",
  "office",
  "storage"
] as const;

export type CanonicalRoomType = typeof CANONICAL_ROOM_TYPES[number];

const ROOM_TYPE_ALIASES: Record<string, CanonicalRoomType> = {
  "reception": "reception",
  "empfang": "reception",
  "empfangsbereich": "reception",
  "rezeption": "reception",
  
  "waiting": "waiting",
  "wartebereich": "waiting",
  "wartezimmer": "waiting",
  "warten": "waiting",
  
  "exam": "exam",
  "treatment": "exam",
  "behandlung": "exam",
  "behandlungsraum": "exam",
  "behandlungszimmer": "exam",
  "untersuchung": "exam",
  "untersuchungsraum": "exam",
  
  "lab": "lab",
  "labor": "lab",
  "laboratory": "lab",
  
  "office": "office",
  "büro": "office",
  "buero": "office",
  "verwaltung": "office",
  "personalraum": "office",
  
  "storage": "storage",
  "lager": "storage",
  "sterilisation": "storage",
  "sterilisationsraum": "storage"
};

export function normalizeRoomType(type: string): CanonicalRoomType {
  const normalized = type.toLowerCase().trim();
  return ROOM_TYPE_ALIASES[normalized] || "exam";
}

export function isValidRoomType(type: string): boolean {
  const normalized = type.toLowerCase().trim();
  return normalized in ROOM_TYPE_ALIASES;
}

export const DEFAULT_LAYOUT_SCALE_PX_PER_METER = 50;

export function pxToMeters(px: number, scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  return px / scalePxPerMeter;
}

export function metersToPx(meters: number, scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  return meters * scalePxPerMeter;
}

export function pxAreaToSqM(widthPx: number, heightPx: number, scalePxPerMeter: number = DEFAULT_LAYOUT_SCALE_PX_PER_METER): number {
  const widthM = pxToMeters(widthPx, scalePxPerMeter);
  const heightM = pxToMeters(heightPx, scalePxPerMeter);
  return Math.round(widthM * heightM * 10) / 10;
}
