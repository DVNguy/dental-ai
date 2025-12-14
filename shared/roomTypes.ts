import { PX_PER_METER, pxToM, mToPx, px2ToM2 } from "./units";

export const CANONICAL_ROOM_TYPES = [
  "reception",
  "waiting", 
  "exam",
  "xray",
  "lab",
  "office",
  "sterilization",
  "storage",
  "toilet",
  "kitchen",
  "changing"
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
  
  "xray": "xray",
  "röntgen": "xray",
  "roentgen": "xray",
  "röntgenraum": "xray",
  "x-ray": "xray",
  
  "office": "office",
  "büro": "office",
  "buero": "office",
  "verwaltung": "office",
  "personalraum": "office",
  
  "sterilization": "sterilization",
  "sterilisation": "sterilization",
  "sterilisationsraum": "sterilization",
  "steri": "sterilization",
  
  "storage": "storage",
  "lager": "storage",
  "lagerraum": "storage",
  
  "toilet": "toilet",
  "toilette": "toilet",
  "wc": "toilet",
  "badezimmer": "toilet",
  "sanitär": "toilet",
  
  "kitchen": "kitchen",
  "küche": "kitchen",
  "kueche": "kitchen",
  "pausenraum": "kitchen",
  "teeküche": "kitchen",
  
  "changing": "changing",
  "umkleide": "changing",
  "umkleideraum": "changing",
  "garderobe": "changing"
};

export function normalizeRoomType(type: string): CanonicalRoomType {
  const normalized = type.toLowerCase().trim();
  return ROOM_TYPE_ALIASES[normalized] || "exam";
}

export function isValidRoomType(type: string): boolean {
  const normalized = type.toLowerCase().trim();
  return normalized in ROOM_TYPE_ALIASES;
}

/** @deprecated Use PX_PER_METER from shared/units.ts */
export const DEFAULT_LAYOUT_SCALE_PX_PER_METER = PX_PER_METER;

/** @deprecated Use pxToM from shared/units.ts */
export function pxToMeters(px: number, scalePxPerMeter: number = PX_PER_METER): number {
  return px / scalePxPerMeter;
}

/** @deprecated Use mToPx from shared/units.ts */
export function metersToPx(meters: number, scalePxPerMeter: number = PX_PER_METER): number {
  return meters * scalePxPerMeter;
}

/** @deprecated Use px2ToM2 from shared/units.ts */
export function pxAreaToSqM(widthPx: number, heightPx: number, scalePxPerMeter: number = PX_PER_METER): number {
  const widthM = widthPx / scalePxPerMeter;
  const heightM = heightPx / scalePxPerMeter;
  return Math.round(widthM * heightM * 10) / 10;
}
