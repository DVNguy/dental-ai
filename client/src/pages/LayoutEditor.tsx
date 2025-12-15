import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Undo, Info, Trash2, RotateCw, X, Settings2, Pencil, Building2, ShieldAlert, Gauge, Lightbulb, ArrowRight, Link2, Footprints, MoreHorizontal, Layers, Activity, AlertTriangle, CheckCircle, Loader2, Package, Monitor, DoorOpen, Square } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn, dedupeByKey, slugify } from "@/lib/utils";
import { usePractice } from "@/contexts/PracticeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Room, Workflow, WorkflowStep, ArchitecturalElement, ArchitecturalElementType, StepLineType } from "@shared/schema";
import type { LayoutEfficiencyResult, WorkflowEfficiencyResult, RoomSizeBenchmark, InventoryItem, InventoryRulesResponse } from "@/lib/api";
import { PX_PER_METER, pxToM, mToPx, GRID_M, snapToGridM, clampM, normalizeToMeters, sqM } from "@shared/units";
import { METERS_PER_TILE, classifyRoomSize, roomSizeBucketLabel, roomSizeBucketColor } from "@shared/layoutUnits";

// Architectural element types with default dimensions (in meters)
const ELEMENT_TYPES = [
  { id: "door" as const, label: "Tür", width: 0.9, icon: DoorOpen, color: "bg-amber-100 border-amber-400" },
  { id: "window" as const, label: "Fenster", width: 1.2, icon: Square, color: "bg-sky-100 border-sky-400" },
];

// Wall thickness for CAD-style rendering (in pixels)
const WALL_THICKNESS = 2;
const WALL_COLOR = "#94a3b8"; // slate-400 (professional gray)

// Room type to fill color mapping for SVG rendering
const ROOM_FILL_COLORS: Record<string, string> = {
  "reception": "#dbeafe",     // blue-100
  "waiting": "#dcfce7",       // green-100
  "exam": "#ffffff",          // white
  "xray": "#e0e7ff",          // indigo-100
  "office": "#ffedd5",        // orange-100
  "sterilization": "#e0f2fe", // sky-100
  "lab": "#f3e8ff",           // purple-100
  "storage": "#fef3c7",       // amber-100
  "toilet": "#cffafe",        // cyan-100
  "kitchen": "#ecfccb",       // lime-100
  "changing": "#ffe4e6",      // rose-100
};

// Interface for wall segment with gaps
interface WallSegment {
  side: "top" | "right" | "bottom" | "left";
  segments: Array<{ start: number; end: number }>; // Segments to draw (gaps excluded)
}

// Interface for element on wall
interface ElementOnWall {
  element: ArchitecturalElement;
  side: "top" | "right" | "bottom" | "left";
  positionOnWall: number; // Position along the wall (0 to wall length)
}

// Calculate wall segments with gaps for doors/windows
function calculateWallSegments(
  roomWidthPx: number,
  roomHeightPx: number,
  roomXPx: number,
  roomYPx: number,
  elements: ArchitecturalElement[],
  roomFloor: number
): { walls: WallSegment[]; elementsOnWalls: ElementOnWall[] } {
  const tolerance = 15;
  const elementsOnWalls: ElementOnWall[] = [];

  // Find elements on each wall
  for (const el of elements) {
    if (el.floor !== roomFloor) continue;
    const elCenterX = el.x + (el.rotation === 0 ? el.width / 2 : 4);
    const elCenterY = el.y + (el.rotation === 0 ? 4 : el.width / 2);

    // Check top wall
    if (Math.abs(elCenterY - roomYPx) < tolerance && elCenterX >= roomXPx - tolerance && elCenterX <= roomXPx + roomWidthPx + tolerance) {
      elementsOnWalls.push({ element: el, side: "top", positionOnWall: elCenterX - roomXPx });
    }
    // Check bottom wall
    else if (Math.abs(elCenterY - (roomYPx + roomHeightPx)) < tolerance && elCenterX >= roomXPx - tolerance && elCenterX <= roomXPx + roomWidthPx + tolerance) {
      elementsOnWalls.push({ element: el, side: "bottom", positionOnWall: elCenterX - roomXPx });
    }
    // Check left wall
    else if (Math.abs(elCenterX - roomXPx) < tolerance && elCenterY >= roomYPx - tolerance && elCenterY <= roomYPx + roomHeightPx + tolerance) {
      elementsOnWalls.push({ element: el, side: "left", positionOnWall: elCenterY - roomYPx });
    }
    // Check right wall
    else if (Math.abs(elCenterX - (roomXPx + roomWidthPx)) < tolerance && elCenterY >= roomYPx - tolerance && elCenterY <= roomYPx + roomHeightPx + tolerance) {
      elementsOnWalls.push({ element: el, side: "right", positionOnWall: elCenterY - roomYPx });
    }
  }

  // Helper to create segments with gaps
  const createSegmentsWithGaps = (wallLength: number, elementsOnThisWall: ElementOnWall[]): Array<{ start: number; end: number }> => {
    if (elementsOnThisWall.length === 0) {
      return [{ start: 0, end: wallLength }];
    }

    // Sort elements by position
    const sorted = [...elementsOnThisWall].sort((a, b) => a.positionOnWall - b.positionOnWall);
    const segments: Array<{ start: number; end: number }> = [];
    let currentPos = 0;

    for (const elOnWall of sorted) {
      const halfWidth = elOnWall.element.width / 2;
      const gapStart = Math.max(0, elOnWall.positionOnWall - halfWidth);
      const gapEnd = Math.min(wallLength, elOnWall.positionOnWall + halfWidth);

      if (gapStart > currentPos) {
        segments.push({ start: currentPos, end: gapStart });
      }
      currentPos = gapEnd;
    }

    if (currentPos < wallLength) {
      segments.push({ start: currentPos, end: wallLength });
    }

    return segments;
  };

  const walls: WallSegment[] = [
    { side: "top", segments: createSegmentsWithGaps(roomWidthPx, elementsOnWalls.filter(e => e.side === "top")) },
    { side: "right", segments: createSegmentsWithGaps(roomHeightPx, elementsOnWalls.filter(e => e.side === "right")) },
    { side: "bottom", segments: createSegmentsWithGaps(roomWidthPx, elementsOnWalls.filter(e => e.side === "bottom")) },
    { side: "left", segments: createSegmentsWithGaps(roomHeightPx, elementsOnWalls.filter(e => e.side === "left")) },
  ];

  return { walls, elementsOnWalls };
}

// Generate SVG path for walls with gaps
function generateWallPath(walls: WallSegment[], width: number, height: number): string {
  const paths: string[] = [];
  const halfWall = WALL_THICKNESS / 2;

  for (const wall of walls) {
    for (const seg of wall.segments) {
      switch (wall.side) {
        case "top":
          paths.push(`M ${seg.start} ${halfWall} L ${seg.end} ${halfWall}`);
          break;
        case "bottom":
          paths.push(`M ${seg.start} ${height - halfWall} L ${seg.end} ${height - halfWall}`);
          break;
        case "left":
          paths.push(`M ${halfWall} ${seg.start} L ${halfWall} ${seg.end}`);
          break;
        case "right":
          paths.push(`M ${width - halfWall} ${seg.start} L ${width - halfWall} ${seg.end}`);
          break;
      }
    }
  }

  return paths.join(" ");
}

// Render a door in CAD style with configurable hinge and opening direction
function renderDoorSVG(
  element: ArchitecturalElement,
  side: "top" | "right" | "bottom" | "left",
  positionOnWall: number,
  roomWidthPx: number,
  roomHeightPx: number
): React.ReactNode {
  const doorWidth = element.width;
  const doorLeafLength = doorWidth * 0.9; // Door leaf slightly shorter than opening
  const arcRadius = doorLeafLength;

  // Get hinge and opening direction from element (defaults if not set)
  const hinge = element.hinge || "left";
  const openingDir = element.openingDirection || "in";

  // Calculate position and rotation based on which wall, hinge position, and opening direction
  let leafPath = "", arcPath = "";
  const halfWidth = doorWidth / 2;

  // For vertical walls (left/right), "left" hinge means top of opening, "right" means bottom
  // For horizontal walls (top/bottom), "left" hinge means left side, "right" means right side
  // Arc always goes from the end of the door leaf to the opposite side of the opening on the wall

  switch (side) {
    case "top": {
      const wallY = WALL_THICKNESS / 2;
      const openingLeft = positionOnWall - halfWidth;
      const openingRight = positionOnWall + halfWidth;
      const hingeX = hinge === "left" ? openingLeft + 2 : openingRight - 2;
      const arcEndX = hinge === "left" ? openingRight - 2 : openingLeft + 2;

      if (openingDir === "in") {
        // Opens into room (downward)
        const leafEndY = wallY + doorLeafLength;
        leafPath = `M ${hingeX} ${wallY} L ${hingeX} ${leafEndY}`;
        const sweep = hinge === "left" ? 0 : 1;
        arcPath = `M ${hingeX} ${leafEndY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${arcEndX} ${wallY}`;
      } else {
        // Opens outside room (upward)
        const leafEndY = wallY - doorLeafLength;
        leafPath = `M ${hingeX} ${wallY} L ${hingeX} ${leafEndY}`;
        const sweep = hinge === "left" ? 1 : 0;
        arcPath = `M ${hingeX} ${leafEndY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${arcEndX} ${wallY}`;
      }
      break;
    }
    case "bottom": {
      const wallY = roomHeightPx - WALL_THICKNESS / 2;
      const openingLeft = positionOnWall - halfWidth;
      const openingRight = positionOnWall + halfWidth;
      const hingeX = hinge === "left" ? openingLeft + 2 : openingRight - 2;
      const arcEndX = hinge === "left" ? openingRight - 2 : openingLeft + 2;

      if (openingDir === "in") {
        // Opens into room (upward)
        const leafEndY = wallY - doorLeafLength;
        leafPath = `M ${hingeX} ${wallY} L ${hingeX} ${leafEndY}`;
        const sweep = hinge === "left" ? 1 : 0;
        arcPath = `M ${hingeX} ${leafEndY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${arcEndX} ${wallY}`;
      } else {
        // Opens outside room (downward)
        const leafEndY = wallY + doorLeafLength;
        leafPath = `M ${hingeX} ${wallY} L ${hingeX} ${leafEndY}`;
        const sweep = hinge === "left" ? 0 : 1;
        arcPath = `M ${hingeX} ${leafEndY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${arcEndX} ${wallY}`;
      }
      break;
    }
    case "left": {
      // Vertical wall: hinge "left" = top of opening, "right" = bottom of opening
      const wallX = WALL_THICKNESS / 2;
      const openingTop = positionOnWall - halfWidth;
      const openingBottom = positionOnWall + halfWidth;
      const hingeY = hinge === "left" ? openingTop + 2 : openingBottom - 2;
      const arcEndY = hinge === "left" ? openingBottom - 2 : openingTop + 2;

      if (openingDir === "in") {
        // Opens into room (rightward)
        const leafEndX = wallX + doorLeafLength;
        leafPath = `M ${wallX} ${hingeY} L ${leafEndX} ${hingeY}`;
        const sweep = hinge === "left" ? 1 : 0;
        arcPath = `M ${leafEndX} ${hingeY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${wallX} ${arcEndY}`;
      } else {
        // Opens outside room (leftward)
        const leafEndX = wallX - doorLeafLength;
        leafPath = `M ${wallX} ${hingeY} L ${leafEndX} ${hingeY}`;
        const sweep = hinge === "left" ? 0 : 1;
        arcPath = `M ${leafEndX} ${hingeY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${wallX} ${arcEndY}`;
      }
      break;
    }
    case "right": {
      // Vertical wall: hinge "left" = top of opening, "right" = bottom of opening
      const wallX = roomWidthPx - WALL_THICKNESS / 2;
      const openingTop = positionOnWall - halfWidth;
      const openingBottom = positionOnWall + halfWidth;
      const hingeY = hinge === "left" ? openingTop + 2 : openingBottom - 2;
      const arcEndY = hinge === "left" ? openingBottom - 2 : openingTop + 2;

      if (openingDir === "in") {
        // Opens into room (leftward)
        const leafEndX = wallX - doorLeafLength;
        leafPath = `M ${wallX} ${hingeY} L ${leafEndX} ${hingeY}`;
        const sweep = hinge === "left" ? 0 : 1;
        arcPath = `M ${leafEndX} ${hingeY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${wallX} ${arcEndY}`;
      } else {
        // Opens outside room (rightward)
        const leafEndX = wallX + doorLeafLength;
        leafPath = `M ${wallX} ${hingeY} L ${leafEndX} ${hingeY}`;
        const sweep = hinge === "left" ? 1 : 0;
        arcPath = `M ${leafEndX} ${hingeY} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${wallX} ${arcEndY}`;
      }
      break;
    }
  }

  return (
    <g key={`door-${element.id}`}>
      {/* Door leaf (solid line) */}
      <path
        d={leafPath}
        stroke="#8B4513"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Door swing arc (dashed) */}
      <path
        d={arcPath}
        stroke="#8B4513"
        strokeWidth={1}
        strokeDasharray="4 3"
        fill="none"
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

// Render a window in CAD style
function renderWindowSVG(
  element: ArchitecturalElement,
  side: "top" | "right" | "bottom" | "left",
  positionOnWall: number,
  roomWidthPx: number,
  roomHeightPx: number
): React.ReactNode {
  const windowWidth = element.width;
  const windowDepth = WALL_THICKNESS + 2; // Slightly thicker than wall

  let x = 0, y = 0, rectX = 0, rectY = 0, rectW = 0, rectH = 0;
  let line1 = "", line2 = "";

  switch (side) {
    case "top":
      x = positionOnWall;
      y = 0;
      rectX = x - windowWidth/2;
      rectY = -1;
      rectW = windowWidth;
      rectH = windowDepth;
      // Double line for glass effect
      line1 = `M ${rectX + 2} ${rectY + windowDepth/2} L ${rectX + rectW - 2} ${rectY + windowDepth/2}`;
      line2 = `M ${rectX + 2} ${rectY + windowDepth/2 + 2} L ${rectX + rectW - 2} ${rectY + windowDepth/2 + 2}`;
      break;
    case "bottom":
      x = positionOnWall;
      y = roomHeightPx;
      rectX = x - windowWidth/2;
      rectY = y - windowDepth + 1;
      rectW = windowWidth;
      rectH = windowDepth;
      line1 = `M ${rectX + 2} ${rectY + windowDepth/2 - 1} L ${rectX + rectW - 2} ${rectY + windowDepth/2 - 1}`;
      line2 = `M ${rectX + 2} ${rectY + windowDepth/2 + 1} L ${rectX + rectW - 2} ${rectY + windowDepth/2 + 1}`;
      break;
    case "left":
      x = 0;
      y = positionOnWall;
      rectX = -1;
      rectY = y - windowWidth/2;
      rectW = windowDepth;
      rectH = windowWidth;
      line1 = `M ${rectX + windowDepth/2} ${rectY + 2} L ${rectX + windowDepth/2} ${rectY + rectH - 2}`;
      line2 = `M ${rectX + windowDepth/2 + 2} ${rectY + 2} L ${rectX + windowDepth/2 + 2} ${rectY + rectH - 2}`;
      break;
    case "right":
      x = roomWidthPx;
      y = positionOnWall;
      rectX = x - windowDepth + 1;
      rectY = y - windowWidth/2;
      rectW = windowDepth;
      rectH = windowWidth;
      line1 = `M ${rectX + windowDepth/2 - 1} ${rectY + 2} L ${rectX + windowDepth/2 - 1} ${rectY + rectH - 2}`;
      line2 = `M ${rectX + windowDepth/2 + 1} ${rectY + 2} L ${rectX + windowDepth/2 + 1} ${rectY + rectH - 2}`;
      break;
  }

  return (
    <g key={`window-${element.id}`}>
      {/* Window frame */}
      <rect
        x={rectX}
        y={rectY}
        width={rectW}
        height={rectH}
        fill="#e0f2fe"
        stroke="#0ea5e9"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {/* Double glass lines */}
      <path d={line1} stroke="#0ea5e9" strokeWidth={1} opacity={0.7} vectorEffect="non-scaling-stroke" />
      <path d={line2} stroke="#0ea5e9" strokeWidth={1} opacity={0.7} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

// Wall edge interface for snap calculations
interface WallEdge {
  roomId: string;
  side: "top" | "bottom" | "left" | "right";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  rotation: number; // 0 for horizontal, 90 for vertical
}

// Get all wall edges from rooms (in pixels)
function getWallEdges(rooms: Room[], currentFloor: number): WallEdge[] {
  const edges: WallEdge[] = [];
  for (const room of rooms.filter(r => r.floor === currentFloor)) {
    const x = mToPx(room.x);
    const y = mToPx(room.y);
    const w = mToPx(room.width);
    const h = mToPx(room.height);

    // Top edge (horizontal)
    edges.push({ roomId: room.id, side: "top", x1: x, y1: y, x2: x + w, y2: y, rotation: 0 });
    // Bottom edge (horizontal)
    edges.push({ roomId: room.id, side: "bottom", x1: x, y1: y + h, x2: x + w, y2: y + h, rotation: 0 });
    // Left edge (vertical)
    edges.push({ roomId: room.id, side: "left", x1: x, y1: y, x2: x, y2: y + h, rotation: 90 });
    // Right edge (vertical)
    edges.push({ roomId: room.id, side: "right", x1: x + w, y1: y, x2: x + w, y2: y + h, rotation: 90 });
  }
  return edges;
}

// Find the nearest wall edge to snap to
function findSnapWall(
  cursorX: number,
  cursorY: number,
  elementWidthPx: number,
  edges: WallEdge[],
  snapThreshold: number = 30
): { x: number; y: number; rotation: number; edge: WallEdge } | null {
  let bestSnap: { x: number; y: number; rotation: number; edge: WallEdge; distance: number } | null = null;

  for (const edge of edges) {
    const isHorizontal = edge.rotation === 0;

    if (isHorizontal) {
      // Check if cursor is near this horizontal edge
      const distY = Math.abs(cursorY - edge.y1);
      if (distY < snapThreshold) {
        // Check if cursor X is within edge bounds (with some margin)
        const halfWidth = elementWidthPx / 2;
        if (cursorX >= edge.x1 - halfWidth && cursorX <= edge.x2 + halfWidth) {
          // Clamp X so element stays on the wall
          const clampedX = Math.max(edge.x1 + halfWidth, Math.min(edge.x2 - halfWidth, cursorX));
          const snapX = clampedX - halfWidth;
          const snapY = edge.y1 - 4; // Slight offset so element sits on wall

          if (!bestSnap || distY < bestSnap.distance) {
            bestSnap = { x: snapX, y: snapY, rotation: 0, edge, distance: distY };
          }
        }
      }
    } else {
      // Vertical edge
      const distX = Math.abs(cursorX - edge.x1);
      if (distX < snapThreshold) {
        const halfWidth = elementWidthPx / 2;
        if (cursorY >= edge.y1 - halfWidth && cursorY <= edge.y2 + halfWidth) {
          const clampedY = Math.max(edge.y1 + halfWidth, Math.min(edge.y2 - halfWidth, cursorY));
          const snapX = edge.x1 - 4;
          const snapY = clampedY - halfWidth;

          if (!bestSnap || distX < bestSnap.distance) {
            bestSnap = { x: snapX, y: snapY, rotation: 90, edge, distance: distX };
          }
        }
      }
    }
  }

  return bestSnap ? { x: bestSnap.x, y: bestSnap.y, rotation: bestSnap.rotation, edge: bestSnap.edge } : null;
}

// Get the center position of a door element (in pixels)
function getDoorCenter(door: ArchitecturalElement): { x: number; y: number } {
  const isHorizontal = door.rotation === 0;
  return {
    x: door.x + (isHorizontal ? door.width / 2 : 4),
    y: door.y + (isHorizontal ? 4 : door.width / 2),
  };
}

// Find doors that belong to a room (on its walls)
function getDoorsForRoom(room: Room, doors: ArchitecturalElement[], tolerance: number = 15): ArchitecturalElement[] {
  const roomLeft = mToPx(room.x);
  const roomRight = mToPx(room.x + room.width);
  const roomTop = mToPx(room.y);
  const roomBottom = mToPx(room.y + room.height);

  return doors.filter(door => {
    const doorCenter = getDoorCenter(door);
    const isHorizontal = door.rotation === 0;

    if (isHorizontal) {
      // Door is on a horizontal wall (top or bottom)
      const onTopWall = Math.abs(doorCenter.y - roomTop) < tolerance;
      const onBottomWall = Math.abs(doorCenter.y - roomBottom) < tolerance;
      const withinXBounds = doorCenter.x >= roomLeft - tolerance && doorCenter.x <= roomRight + tolerance;
      return (onTopWall || onBottomWall) && withinXBounds;
    } else {
      // Door is on a vertical wall (left or right)
      const onLeftWall = Math.abs(doorCenter.x - roomLeft) < tolerance;
      const onRightWall = Math.abs(doorCenter.x - roomRight) < tolerance;
      const withinYBounds = doorCenter.y >= roomTop - tolerance && doorCenter.y <= roomBottom + tolerance;
      return (onLeftWall || onRightWall) && withinYBounds;
    }
  });
}

// Find the nearest door from a room to a target point
function findNearestDoorToTarget(
  room: Room,
  targetX: number,
  targetY: number,
  doors: ArchitecturalElement[]
): { x: number; y: number } | null {
  const roomDoors = getDoorsForRoom(room, doors);
  if (roomDoors.length === 0) return null;

  let nearestDoor = roomDoors[0];
  let nearestDistance = Infinity;

  for (const door of roomDoors) {
    const doorCenter = getDoorCenter(door);
    const dist = Math.sqrt(
      Math.pow(doorCenter.x - targetX, 2) + Math.pow(doorCenter.y - targetY, 2)
    );
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestDoor = door;
    }
  }

  return getDoorCenter(nearestDoor);
}

function computeBezierPath(
  fromRoom: Room,
  toRoom: Room,
  offset: number = 0,
  doors: ArchitecturalElement[] = []
): { path: string; startX: number; startY: number; endX: number; endY: number; arrowPoints: Array<{x: number; y: number; angle: number}> } {
  const fromCenterX = mToPx(fromRoom.x + fromRoom.width / 2);
  const fromCenterY = mToPx(fromRoom.y + fromRoom.height / 2);
  const toCenterX = mToPx(toRoom.x + toRoom.width / 2);
  const toCenterY = mToPx(toRoom.y + toRoom.height / 2);

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  // Try to use door positions for start and end points
  const fromDoor = findNearestDoorToTarget(fromRoom, toCenterX, toCenterY, doors);
  const toDoor = findNearestDoorToTarget(toRoom, fromCenterX, fromCenterY, doors);

  let baseStartX: number, baseStartY: number, baseEndX: number, baseEndY: number;
  let c1x: number, c1y: number, c2x: number, c2y: number;

  // Use door position if available, otherwise fall back to wall center
  if (fromDoor) {
    baseStartX = fromDoor.x;
    baseStartY = fromDoor.y;
  } else if (Math.abs(dx) >= Math.abs(dy)) {
    baseStartX = mToPx(fromRoom.x + (dx > 0 ? fromRoom.width : 0));
    baseStartY = mToPx(fromRoom.y + fromRoom.height / 2);
  } else {
    baseStartX = mToPx(fromRoom.x + fromRoom.width / 2);
    baseStartY = mToPx(fromRoom.y + (dy > 0 ? fromRoom.height : 0));
  }

  if (toDoor) {
    baseEndX = toDoor.x;
    baseEndY = toDoor.y;
  } else if (Math.abs(dx) >= Math.abs(dy)) {
    baseEndX = mToPx(toRoom.x + (dx > 0 ? 0 : toRoom.width));
    baseEndY = mToPx(toRoom.y + toRoom.height / 2);
  } else {
    baseEndX = mToPx(toRoom.x + toRoom.width / 2);
    baseEndY = mToPx(toRoom.y + (dy > 0 ? 0 : toRoom.height));
  }

  const segDx = baseEndX - baseStartX;
  const segDy = baseEndY - baseStartY;
  const segLen = Math.sqrt(segDx * segDx + segDy * segDy) || 1;
  const perpX = -segDy / segLen;
  const perpY = segDx / segLen;

  const startX = baseStartX + perpX * offset;
  const startY = baseStartY + perpY * offset;
  const endX = baseEndX + perpX * offset;
  const endY = baseEndY + perpY * offset;

  // Calculate control points based on direction
  const actualDx = endX - startX;
  const actualDy = endY - startY;

  if (Math.abs(actualDx) >= Math.abs(actualDy)) {
    const baseC1x = startX + actualDx * 0.4;
    const baseC1y = startY;
    const baseC2x = endX - actualDx * 0.4;
    const baseC2y = endY;
    c1x = baseC1x;
    c1y = baseC1y;
    c2x = baseC2x;
    c2y = baseC2y;
  } else {
    const baseC1x = startX;
    const baseC1y = startY + actualDy * 0.4;
    const baseC2x = endX;
    const baseC2y = endY - actualDy * 0.4;
    c1x = baseC1x;
    c1y = baseC1y;
    c2x = baseC2x;
    c2y = baseC2y;
  }

  const path = `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${endX} ${endY}`;

  const bezierPoint = (t: number) => {
    const u = 1 - t;
    const x = u*u*u*startX + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*endX;
    const y = u*u*u*startY + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*endY;
    return { x, y };
  };

  const bezierTangent = (t: number) => {
    const u = 1 - t;
    const tx = 3*u*u*(c1x - startX) + 6*u*t*(c2x - c1x) + 3*t*t*(endX - c2x);
    const ty = 3*u*u*(c1y - startY) + 6*u*t*(c2y - c1y) + 3*t*t*(endY - c2y);
    return Math.atan2(ty, tx) * (180 / Math.PI);
  };

  const arrowPoints = [0.5].map(t => ({
    ...bezierPoint(t),
    angle: bezierTangent(t)
  }));

  return { path, startX, startY, endX, endY, arrowPoints };
}

function computePreviewPath(fromRoom: Room, mouseX: number, mouseY: number): string {
  const fromCenterX = mToPx(fromRoom.x + fromRoom.width / 2);
  const fromCenterY = mToPx(fromRoom.y + fromRoom.height / 2);
  
  const dx = mouseX - fromCenterX;
  const dy = mouseY - fromCenterY;
  
  let startX: number, startY: number;
  let c1x: number, c1y: number, c2x: number, c2y: number;
  
  if (Math.abs(dx) >= Math.abs(dy)) {
    startX = mToPx(fromRoom.x + (dx > 0 ? fromRoom.width : 0));
    startY = mToPx(fromRoom.y + fromRoom.height / 2);
    c1x = startX + dx * 0.5;
    c1y = startY;
    c2x = mouseX - dx * 0.5;
    c2y = mouseY;
  } else {
    startX = mToPx(fromRoom.x + fromRoom.width / 2);
    startY = mToPx(fromRoom.y + (dy > 0 ? fromRoom.height : 0));
    c1x = startX;
    c1y = startY + dy * 0.5;
    c2x = mouseX;
    c2y = mouseY - dy * 0.5;
  }
  
  return `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${mouseX} ${mouseY}`;
}

type RoomStatus = {
  status: 'optimal' | 'undersized' | 'oversized' | 'unknown';
  message: string;
  actualSqM: number;
};

function getRoomStatus(
  type: string,
  widthM: number,
  heightM: number,
  benchmarks: Record<string, RoomSizeBenchmark> | undefined
): RoomStatus {
  const areaSqM = widthM * heightM;

  if (!benchmarks || !benchmarks[type]) {
    return {
      status: 'unknown',
      message: `Keine Standards für "${type}" verfügbar`,
      actualSqM: areaSqM,
    };
  }

  const standard = benchmarks[type];
  const tolerance = standard.optimalSqM * 0.1; // ±10% tolerance for optimal

  if (areaSqM < standard.minSqM) {
    return {
      status: 'undersized',
      message: `Zu klein (${areaSqM.toFixed(1)}m² < min ${standard.minSqM}m²)`,
      actualSqM: areaSqM,
    };
  }

  if (areaSqM > standard.maxSqM) {
    return {
      status: 'oversized',
      message: `Zu groß (${areaSqM.toFixed(1)}m² > max ${standard.maxSqM}m²)`,
      actualSqM: areaSqM,
    };
  }

  if (Math.abs(areaSqM - standard.optimalSqM) <= tolerance) {
    return {
      status: 'optimal',
      message: `Optimal (${areaSqM.toFixed(1)}m² ≈ Ziel ${standard.optimalSqM}m²)`,
      actualSqM: areaSqM,
    };
  }

  // Within range but not optimal
  if (areaSqM < standard.optimalSqM) {
    return {
      status: 'optimal', // Still acceptable, green
      message: `OK (${areaSqM.toFixed(1)}m², Ziel: ${standard.optimalSqM}m²)`,
      actualSqM: areaSqM,
    };
  } else {
    return {
      status: 'optimal', // Still acceptable, green
      message: `OK (${areaSqM.toFixed(1)}m², Ziel: ${standard.optimalSqM}m²)`,
      actualSqM: areaSqM,
    };
  }
}

export default function LayoutEditor() {
  const { t } = useTranslation();
  const { practiceId } = usePractice();
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentFloor, setCurrentFloor] = useState<number>(0);
  
  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [widthDraft, setWidthDraft] = useState<number>(2);
  const [heightDraft, setHeightDraft] = useState<number>(2);
  
  const [connectMode, setConnectMode] = useState(false);
  const [pendingFromRoomId, setPendingFromRoomId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoverRoomId, setHoverRoomId] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [showEdgePanel, setShowEdgePanel] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [highlightedStepIds, setHighlightedStepIds] = useState<Set<string>>(new Set());

  // Architectural elements state
  const [draggingElement, setDraggingElement] = useState<{ type: ArchitecturalElementType; widthM: number } | null>(null);
  const [elementPreview, setElementPreview] = useState<{ x: number; y: number; rotation: number; valid: boolean } | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Connection line selection state
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Room drag offset tracking for live connection updates
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Zoom & Pan state (infinite canvas)
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const analysisDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aiInvalidateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nameDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const widthDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heightDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRoomIdRef = useRef<string | null>(null);
  const hasCreatedDefaultWorkflow = useRef(false);
  
  const ROOM_TYPES = [
    { id: "reception", label: t("rooms.reception"), color: "bg-blue-100 border-blue-300", w: 3, h: 2 },
    { id: "waiting", label: t("rooms.waiting"), color: "bg-green-100 border-green-300", w: 4, h: 3 },
    { id: "exam", label: t("rooms.exam"), color: "bg-white border-gray-300", w: 2.4, h: 2.4 },
    { id: "xray", label: t("rooms.xray"), color: "bg-indigo-100 border-indigo-300", w: 3, h: 3 },
    { id: "office", label: t("rooms.office"), color: "bg-orange-100 border-orange-300", w: 2.4, h: 2.4 },
    { id: "sterilization", label: t("rooms.sterilization"), color: "bg-sky-100 border-sky-300", w: 3.5, h: 3 },
    { id: "lab", label: t("rooms.lab"), color: "bg-purple-100 border-purple-300", w: 2, h: 2 },
    { id: "storage", label: t("rooms.storage"), color: "bg-amber-100 border-amber-300", w: 3, h: 2 },
    { id: "toilet", label: t("rooms.toilet"), color: "bg-cyan-100 border-cyan-300", w: 2.2, h: 2 },
    { id: "kitchen", label: t("rooms.kitchen"), color: "bg-lime-100 border-lime-300", w: 3, h: 2.5 },
    { id: "changing", label: t("rooms.changing"), color: "bg-rose-100 border-rose-300", w: 3, h: 2.2 },
  ];

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", practiceId],
    queryFn: () => api.rooms.list(practiceId!),
    enabled: !!practiceId,
    select: (data) => data.map((room) => ({
      ...room,
      x: normalizeToMeters(room.x),
      y: normalizeToMeters(room.y),
      width: normalizeToMeters(room.width),
      height: normalizeToMeters(room.height),
    })),
  });

  const { data: architecturalElements = [] } = useQuery({
    queryKey: ["elements", practiceId],
    queryFn: () => api.elements.list(practiceId!),
    enabled: !!practiceId,
  });

  const { data: efficiencyData } = useQuery<LayoutEfficiencyResult>({
    queryKey: ["layout-efficiency", practiceId],
    queryFn: () => api.layout.efficiency(practiceId!),
    enabled: !!practiceId && rooms.length > 0,
    staleTime: 2000,
    refetchOnWindowFocus: false,
  });

  const { data: benchmarksData } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => api.benchmarks.get(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const roomSizeBenchmarks = benchmarksData?.roomSizes;

  const { data: inventoryRulesData } = useQuery<InventoryRulesResponse>({
    queryKey: ["inventory-rules"],
    queryFn: () => api.knowledge.getInventoryRules(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: rawWorkflows = [], isLoading: isWorkflowsLoading } = useQuery({
    queryKey: ["workflows", practiceId],
    queryFn: () => api.workflows.list(practiceId!),
    enabled: !!practiceId,
  });
  
  const workflows = useMemo(() => {
    const deduped = dedupeByKey(rawWorkflows, wf => wf.name);
    if (process.env.NODE_ENV === 'development' && rawWorkflows.length !== deduped.length) {
      console.warn('[Workflow Dedup]', {
        total: rawWorkflows.length,
        unique: deduped.length,
        duplicates: rawWorkflows.length - deduped.length,
      });
    }
    return deduped;
  }, [rawWorkflows]);

  const activeWorkflow = workflows.find(w => w.id === selectedWorkflowId) || workflows[0];
  
  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflowId) {
      setSelectedWorkflowId(workflows[0].id);
    }
  }, [workflows, selectedWorkflowId]);

  const { data: connections = [] } = useQuery({
    queryKey: ["connections", practiceId],
    queryFn: () => api.connections.listByPractice(practiceId!),
    enabled: !!practiceId,
  });

  const { data: workflowSteps = [] } = useQuery({
    queryKey: ["workflowSteps", selectedWorkflowId],
    queryFn: () => api.workflowSteps.list(selectedWorkflowId!),
    enabled: !!selectedWorkflowId,
  });

  const { data: workflowAnalysis, isLoading: isAnalysisLoading, refetch: refetchAnalysis } = useQuery<WorkflowEfficiencyResult>({
    queryKey: ["workflow-analysis", practiceId],
    queryFn: () => api.ai.analyzeWorkflows({ practiceId: practiceId!, includeRAG: false }),
    enabled: false,
    staleTime: 30000,
  });

  const triggerAnalysis = useCallback(() => {
    clearTimeout(analysisDebounceRef.current);
    analysisDebounceRef.current = setTimeout(() => {
      refetchAnalysis();
      setShowAnalysisModal(true);
    }, 300);
  }, [refetchAnalysis]);

  useEffect(() => {
    if (workflowAnalysis?.workflows) {
      const expensiveIds = new Set<string>();
      for (const wf of workflowAnalysis.workflows) {
        for (const step of wf.top3ExpensiveSteps) {
          expensiveIds.add(step.stepId);
        }
      }
      setHighlightedStepIds(expensiveIds);
    }
  }, [workflowAnalysis]);

  const upsertWorkflowMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; actorType: "patient" | "staff" | "instruments"; source?: "builtin" | "custom" | "knowledge" }) =>
      api.workflows.upsert(practiceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", practiceId] });
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: (data: { fromRoomId: string; toRoomId: string; kind?: "patient" | "staff" }) =>
      api.connections.create(practiceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: (id: string) => api.connections.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
  });

  const updateConnectionMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { kind?: "patient" | "staff"; weight?: number } }) =>
      api.connections.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
  });

  const createWorkflowStepMutation = useMutation({
    mutationFn: (data: { fromRoomId: string; toRoomId: string; weight?: number }) =>
      api.workflowSteps.create(selectedWorkflowId!, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workflowSteps", selectedWorkflowId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
      setPendingFromRoomId(variables.toRoomId);
    },
  });

  const deleteWorkflowStepMutation = useMutation({
    mutationFn: (id: string) => api.workflowSteps.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflowSteps", selectedWorkflowId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
  });

  const updateWorkflowStepMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { weight?: number; lineType?: StepLineType } }) =>
      api.workflowSteps.update(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["workflowSteps", selectedWorkflowId] });

      // Snapshot the previous value
      const previousSteps = queryClient.getQueryData<WorkflowStep[]>(["workflowSteps", selectedWorkflowId]);

      // Optimistically update the cache
      if (previousSteps) {
        const updatedSteps = previousSteps.map(step =>
          step.id === id ? { ...step, ...updates } : step
        );
        queryClient.setQueryData(["workflowSteps", selectedWorkflowId], updatedSteps);
      }

      return { previousSteps };
    },
    onSuccess: () => {
      // Refetch to ensure we have the latest server data
      queryClient.invalidateQueries({ queryKey: ["workflowSteps", selectedWorkflowId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    },
    onError: (error, _variables, context) => {
      console.error("[updateWorkflowStep] Error:", error);
      // Rollback to previous state on error
      if (context?.previousSteps) {
        queryClient.setQueryData(["workflowSteps", selectedWorkflowId], context.previousSteps);
      }
    },
  });

  const lastSeededPracticeId = useRef<string | null>(null);
  
  useEffect(() => {
    if (practiceId !== lastSeededPracticeId.current) {
      hasCreatedDefaultWorkflow.current = false;
    }
    
    if (
      practiceId && 
      !isWorkflowsLoading &&
      rawWorkflows.length === 0 && 
      !upsertWorkflowMutation.isPending &&
      !hasCreatedDefaultWorkflow.current
    ) {
      hasCreatedDefaultWorkflow.current = true;
      lastSeededPracticeId.current = practiceId;
      upsertWorkflowMutation.mutate({ 
        name: "Neupatient (Patient Flow)", 
        slug: "neupatient-patient-flow",
        actorType: "patient",
        source: "builtin"
      });
    }
  }, [practiceId, rawWorkflows.length, isWorkflowsLoading, upsertWorkflowMutation.isPending]);

  const getCanvasBoundsM = useCallback(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      return { width: pxToM(rect.width), height: pxToM(rect.height) };
    }
    return { width: pxToM(1200), height: pxToM(800) };
  }, []);

  const scheduleAIInvalidation = useCallback(() => {
    clearTimeout(aiInvalidateTimer.current);
    aiInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["ai-analysis", practiceId] });
      queryClient.invalidateQueries({ queryKey: ["layout-efficiency", practiceId] });
    }, 2000);
  }, [queryClient, practiceId]);

  const createRoomMutation = useMutation({
    mutationFn: (data: { type: string; name: string; x: number; y: number; width: number; height: number; floor: number }) =>
      api.rooms.create(practiceId!, { 
        ...data, 
        practiceId: practiceId!,
        x: Math.round(mToPx(data.x)),
        y: Math.round(mToPx(data.y)),
        width: Math.round(mToPx(data.width)),
        height: Math.round(mToPx(data.height)),
      }),
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", practiceId] });
      scheduleAIInvalidation();
      setSelectedRoomId(newRoom.id);
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Room> }) => {
      const apiUpdates: Partial<Room> = { ...updates };
      if (apiUpdates.x !== undefined) apiUpdates.x = Math.round(mToPx(apiUpdates.x));
      if (apiUpdates.y !== undefined) apiUpdates.y = Math.round(mToPx(apiUpdates.y));
      if (apiUpdates.width !== undefined) apiUpdates.width = Math.round(mToPx(apiUpdates.width));
      if (apiUpdates.height !== undefined) apiUpdates.height = Math.round(mToPx(apiUpdates.height));
      return api.rooms.update(id, apiUpdates);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["rooms", practiceId] });
      const previous = queryClient.getQueryData<Room[]>(["rooms", practiceId]);
      queryClient.setQueryData<Room[]>(["rooms", practiceId], (old) =>
        old?.map((r) => (r.id === id ? { ...r, ...updates } : r)) ?? []
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["rooms", practiceId], context.previous);
      }
    },
    onSuccess: (serverRoom) => {
      queryClient.setQueryData<Room[]>(["rooms", practiceId], (old) =>
        old?.map((r) => (r.id === serverRoom.id ? serverRoom : r)) ?? []
      );
      scheduleAIInvalidation();
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => api.rooms.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["rooms", practiceId] });
      const previous = queryClient.getQueryData<Room[]>(["rooms", practiceId]);
      queryClient.setQueryData<Room[]>(["rooms", practiceId], (old) =>
        old?.filter((r) => r.id !== id) ?? []
      );
      if (selectedRoomId === id) {
        setSelectedRoomId(null);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["rooms", practiceId], context.previous);
      }
    },
    onSuccess: () => {
      scheduleAIInvalidation();
    },
  });

  // Architectural element mutations
  const createElementMutation = useMutation({
    mutationFn: (data: { type: ArchitecturalElementType; x: number; y: number; width: number; rotation: number; floor: number }) =>
      api.elements.create(practiceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elements", practiceId] });
    },
  });

  const deleteElementMutation = useMutation({
    mutationFn: (id: string) => api.elements.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elements", practiceId] });
    },
  });

  const updateElementMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { x?: number; y?: number; width?: number; rotation?: number; floor?: number; hinge?: "left" | "right"; openingDirection?: "in" | "out" } }) =>
      api.elements.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["elements", practiceId] });
    },
  });

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedRoomType = selectedRoom ? ROOM_TYPES.find(t => t.id === selectedRoom.type) : null;

  useEffect(() => {
    clearTimeout(nameDebounceTimer.current);
    clearTimeout(widthDebounceTimer.current);
    clearTimeout(heightDebounceTimer.current);
    
    if (selectedRoom) {
      setRoomNameDraft(selectedRoom.name);
      setWidthDraft(selectedRoom.width);
      setHeightDraft(selectedRoom.height);
      pendingRoomIdRef.current = selectedRoom.id;
    }
  }, [selectedRoom?.id]);

  useEffect(() => {
    if (selectedRoom) {
      if (roomNameDraft !== selectedRoom.name && pendingRoomIdRef.current === selectedRoom.id) {
        setRoomNameDraft(selectedRoom.name);
      }
      if (widthDraft !== selectedRoom.width && pendingRoomIdRef.current === selectedRoom.id) {
        setWidthDraft(selectedRoom.width);
      }
      if (heightDraft !== selectedRoom.height && pendingRoomIdRef.current === selectedRoom.id) {
        setHeightDraft(selectedRoom.height);
      }
    }
  }, [selectedRoom?.name, selectedRoom?.width, selectedRoom?.height]);

  useEffect(() => {
    return () => {
      clearTimeout(aiInvalidateTimer.current);
      clearTimeout(nameDebounceTimer.current);
      clearTimeout(widthDebounceTimer.current);
      clearTimeout(heightDebounceTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && connectMode) {
        if (pendingFromRoomId) {
          setPendingFromRoomId(null);
          setMousePos(null);
          setHoverRoomId(null);
        } else {
          setConnectMode(false);
        }
      }
      // Space key for panning mode
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setIsSpacePressed(false);
        setIsPanning(false);
        lastPanPos.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [connectMode, pendingFromRoomId]);

  // Global mouse event handlers for panning (to continue panning even when mouse is over child elements)
  useEffect(() => {
    if (!isPanning) return;

    // Set global cursor to grabbing during pan
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (lastPanPos.current) {
        const deltaX = e.clientX - lastPanPos.current.x;
        const deltaY = e.clientY - lastPanPos.current.y;
        lastPanPos.current = { x: e.clientX, y: e.clientY };
        setViewTransform(prev => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      lastPanPos.current = null;
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isPanning]);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom centered on mouse position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(viewTransform.scale * zoomFactor, 0.25), 4);

    // Calculate new pan to keep mouse position stable
    const scaleRatio = newScale / viewTransform.scale;
    const newX = mouseX - (mouseX - viewTransform.x) * scaleRatio;
    const newY = mouseY - (mouseY - viewTransform.y) * scaleRatio;

    setViewTransform({ x: newX, y: newY, scale: newScale });
  }, [viewTransform]);

  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Start panning with space+drag, middle mouse button, OR left click anywhere when not in special modes
    // Check if the click is on an interactive element (room, connection, etc.)
    const targetElement = e.target as HTMLElement;
    const isOnRoom = targetElement.closest('[data-testid^="room-"]');
    const isOnConnection = targetElement.closest('[data-testid^="connection-"]');
    const isOnButton = targetElement.closest('button');
    const isOnInteractiveElement = isOnRoom || isOnConnection || isOnButton;

    // Allow panning with: space+drag, middle mouse, or left click on background (not on interactive elements)
    if (isSpacePressed || e.button === 1 || (e.button === 0 && !isOnInteractiveElement && !connectMode && !draggingElement)) {
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  }, [isSpacePressed, connectMode, draggingElement]);

  const handlePanMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && lastPanPos.current) {
      const deltaX = e.clientX - lastPanPos.current.x;
      const deltaY = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    }
  }, [isPanning]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
    lastPanPos.current = null;
  }, []);

  // Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - viewTransform.x) / viewTransform.scale,
      y: (screenY - viewTransform.y) / viewTransform.scale,
    };
  }, [viewTransform]);

  // Reset view to default
  const resetView = useCallback(() => {
    setViewTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Wall edges for snap-to-wall calculations
  const wallEdges = useMemo(() => getWallEdges(rooms, currentFloor), [rooms, currentFloor]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    // Handle panning first
    if (isPanning) {
      handlePanMove(e);
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert to canvas coordinates (accounting for zoom/pan)
    const { x: cursorX, y: cursorY } = screenToCanvas(screenX, screenY);

    // Handle connection mode (store in canvas coordinates for proper bezier path calculation)
    if (connectMode && pendingFromRoomId) {
      setMousePos({ x: cursorX, y: cursorY });
    }

    // Handle element dragging with snap-to-wall (in canvas coordinates)
    if (draggingElement) {
      const elementWidthPx = mToPx(draggingElement.widthM);
      // Scale wall edges to account for zoom
      const scaledEdges = wallEdges.map(edge => ({
        ...edge,
        x1: edge.x1,
        y1: edge.y1,
        x2: edge.x2,
        y2: edge.y2,
      }));
      const snap = findSnapWall(cursorX, cursorY, elementWidthPx, scaledEdges);

      if (snap) {
        setElementPreview({ x: snap.x, y: snap.y, rotation: snap.rotation, valid: true });
      } else {
        // Show preview at cursor but mark as invalid
        setElementPreview({ x: cursorX - elementWidthPx / 2, y: cursorY - 4, rotation: 0, valid: false });
      }
    }
  }, [connectMode, pendingFromRoomId, draggingElement, wallEdges, isPanning, handlePanMove, screenToCanvas]);

  const handleCanvasMouseUp = useCallback(() => {
    if (draggingElement && elementPreview?.valid) {
      // Create the element at the snapped position
      createElementMutation.mutate({
        type: draggingElement.type,
        x: Math.round(elementPreview.x),
        y: Math.round(elementPreview.y),
        width: Math.round(mToPx(draggingElement.widthM)),
        rotation: elementPreview.rotation,
        floor: currentFloor,
      });
    }
    setDraggingElement(null);
    setElementPreview(null);
  }, [draggingElement, elementPreview, createElementMutation, currentFloor]);

  const handleElementDragStart = useCallback((type: ArchitecturalElementType, widthM: number) => {
    setDraggingElement({ type, widthM });
    setSelectedRoomId(null);
  }, []);

  const handleNameChange = (value: string) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setRoomNameDraft(value);
    clearTimeout(nameDebounceTimer.current);
    nameDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room && value !== room.name) {
        updateRoomMutation.mutate({ id: targetRoomId, updates: { name: value } });
      }
    }, 500);
  };

  const handleNameBlur = () => {
    clearTimeout(nameDebounceTimer.current);
    if (selectedRoom && roomNameDraft !== selectedRoom.name) {
      updateRoomMutation.mutate({ id: selectedRoom.id, updates: { name: roomNameDraft } });
    }
  };

  const handleWidthChange = (valM: number) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setWidthDraft(valM);
    clearTimeout(widthDebounceTimer.current);
    widthDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room) {
        const bounds = getCanvasBoundsM();
        const clampedX = clampM(room.x, 0, bounds.width - valM);
        const updates: Partial<Room> = { width: valM };
        if (clampedX !== room.x) {
          updates.x = clampedX;
        }
        updateRoomMutation.mutate({ id: targetRoomId, updates });
      }
    }, 300);
  };

  const handleHeightChange = (valM: number) => {
    const targetRoomId = selectedRoomId;
    if (!targetRoomId) return;
    
    setHeightDraft(valM);
    clearTimeout(heightDebounceTimer.current);
    heightDebounceTimer.current = setTimeout(() => {
      const room = rooms.find(r => r.id === targetRoomId);
      if (room) {
        const bounds = getCanvasBoundsM();
        const clampedY = clampM(room.y, 0, bounds.height - valM);
        const updates: Partial<Room> = { height: valM };
        if (clampedY !== room.y) {
          updates.y = clampedY;
        }
        updateRoomMutation.mutate({ id: targetRoomId, updates });
      }
    }, 300);
  };

  const addRoom = (typeId: string) => {
    const typeDef = ROOM_TYPES.find(t => t.id === typeId);
    if (!typeDef) return;

    createRoomMutation.mutate({ 
      type: typeId,
      name: "", 
      x: 2,
      y: 2,
      width: typeDef.w,
      height: typeDef.h,
      floor: currentFloor
    });
  };

  const updateRoom = (id: string, updates: Partial<Room>) => {
    updateRoomMutation.mutate({ id, updates });
  };

  const handleRotate = () => {
    if (!selectedRoom) return;
    const bounds = getCanvasBoundsM();
    const newWidth = selectedRoom.height;
    const newHeight = selectedRoom.width;
    const clampedX = clampM(selectedRoom.x, 0, bounds.width - newWidth);
    const clampedY = clampM(selectedRoom.y, 0, bounds.height - newHeight);
    updateRoom(selectedRoom.id, { 
      width: newWidth, 
      height: newHeight,
      x: clampedX,
      y: clampedY
    });
  };

  const deleteRoom = (id: string) => {
    deleteRoomMutation.mutate(id);
  };

  const clearAllRooms = () => {
    rooms.forEach(room => {
      deleteRoomMutation.mutate(room.id);
    });
  };

  const handleDragEnd = (room: Room, info: { offset: { x: number; y: number } }, shiftPressed: boolean) => {
    const bounds = getCanvasBoundsM();
    // Adjust for zoom scale - framer-motion provides screen-space offsets
    let newX = room.x + pxToM(info.offset.x / viewTransform.scale);
    let newY = room.y + pxToM(info.offset.y / viewTransform.scale);

    if (!shiftPressed) {
      newX = snapToGridM(newX);
      newY = snapToGridM(newY);
    }

    newX = clampM(newX, 0, bounds.width - room.width);
    newY = clampM(newY, 0, bounds.height - room.height);

    // Calculate pixel delta for moving attached elements
    const deltaXPx = mToPx(newX) - mToPx(room.x);
    const deltaYPx = mToPx(newY) - mToPx(room.y);

    // Find elements attached to this room (doors/windows on its walls)
    const roomElements = architecturalElements.filter(el => {
      if (el.floor !== room.floor) return false;
      const elCenter = getDoorCenter(el);
      const roomLeft = mToPx(room.x);
      const roomRight = mToPx(room.x + room.width);
      const roomTop = mToPx(room.y);
      const roomBottom = mToPx(room.y + room.height);
      const tolerance = 20;

      const isHorizontal = el.rotation === 0;
      if (isHorizontal) {
        const onTopWall = Math.abs(elCenter.y - roomTop) < tolerance;
        const onBottomWall = Math.abs(elCenter.y - roomBottom) < tolerance;
        const withinXBounds = elCenter.x >= roomLeft - tolerance && elCenter.x <= roomRight + tolerance;
        return (onTopWall || onBottomWall) && withinXBounds;
      } else {
        const onLeftWall = Math.abs(elCenter.x - roomLeft) < tolerance;
        const onRightWall = Math.abs(elCenter.x - roomRight) < tolerance;
        const withinYBounds = elCenter.y >= roomTop - tolerance && elCenter.y <= roomBottom + tolerance;
        return (onLeftWall || onRightWall) && withinYBounds;
      }
    });

    // Update room position
    updateRoom(room.id, { x: newX, y: newY });

    // Move attached elements with the room
    if (roomElements.length > 0 && (deltaXPx !== 0 || deltaYPx !== 0)) {
      roomElements.forEach(el => {
        updateElementMutation.mutate({
          id: el.id,
          updates: {
            x: el.x + deltaXPx,
            y: el.y + deltaYPx,
          },
        });
      });
    }
  };

  const handleRoomClickInConnectMode = (roomId: string) => {
    if (!connectMode || !activeWorkflow) return;
    
    if (!pendingFromRoomId) {
      setPendingFromRoomId(roomId);
    } else if (pendingFromRoomId !== roomId) {
      createWorkflowStepMutation.mutate({ fromRoomId: pendingFromRoomId, toRoomId: roomId });
    }
  };

  const toggleConnectMode = () => {
    setConnectMode(prev => !prev);
    setPendingFromRoomId(null);
    if (connectMode) {
      setSelectedRoomId(null);
    }
  };

  const connectionArrows = useMemo(() => {
    const floorRooms = rooms.filter(r => r.floor === currentFloor);
    // Apply drag offset to the room being dragged for live updates
    const adjustedRooms = floorRooms.map(r => {
      if (r.id === draggingRoomId) {
        return {
          ...r,
          x: r.x + pxToM(dragOffset.x / viewTransform.scale),
          y: r.y + pxToM(dragOffset.y / viewTransform.scale),
        };
      }
      return r;
    });
    const roomMap = new Map(adjustedRooms.map(r => [r.id, r]));
    const validSteps = workflowSteps.filter(step => roomMap.has(step.fromRoomId) && roomMap.has(step.toRoomId));

    // Filter doors on current floor for routing
    const floorDoors = architecturalElements.filter(
      el => el.floor === currentFloor && el.type === "door"
    );

    const pairSet = new Set(validSteps.map(s => `${s.fromRoomId}|${s.toRoomId}`));
    const bidirectionalPairs = new Set<string>();
    for (const step of validSteps) {
      const reverseKey = `${step.toRoomId}|${step.fromRoomId}`;
      if (pairSet.has(reverseKey)) {
        bidirectionalPairs.add(`${step.fromRoomId}|${step.toRoomId}`);
        bidirectionalPairs.add(reverseKey);
      }
    }

    return validSteps
      .map((step, index) => {
        const fromRoom = roomMap.get(step.fromRoomId)!;
        const toRoom = roomMap.get(step.toRoomId)!;

        const pairKey = `${step.fromRoomId}|${step.toRoomId}`;
        const isBidirectional = bidirectionalPairs.has(pairKey);
        let offset = 0;
        if (isBidirectional) {
          offset = step.fromRoomId < step.toRoomId ? 6 : -6;
        }

        // Pass doors to enable door-to-door routing
        const { path, startX, startY, endX, endY, arrowPoints } = computeBezierPath(fromRoom, toRoom, offset, floorDoors);
        
        // Line type determines color (semantic, not distance-based)
        // default = slate, critical = red, optional = amber, automated = green
        const lineType = step.lineType || "default";
        let lineColor = "rgb(100, 116, 139)"; // slate-500
        let lineLabel = "Standard";

        switch (lineType) {
          case "critical":
            lineColor = "rgb(239, 68, 68)"; // red-500
            lineLabel = "Kritisch";
            break;
          case "optional":
            lineColor = "rgb(245, 158, 11)"; // amber-500
            lineLabel = "Optional";
            break;
          case "automated":
            lineColor = "rgb(34, 197, 94)"; // green-500
            lineLabel = "Automatisiert";
            break;
        }

        // Weight determines stroke width: 1=3px, 2=5px, 3=7px
        const weight = step.weight || 1;
        const strokeWidth = weight === 3 ? 7 : weight === 2 ? 5 : 3;
        const weightLabel = weight === 3 ? "Sehr häufig" : weight === 2 ? "Häufig" : "Normal";

        // Line style based on actorType: patient=solid, staff/instruments=dashed
        const strokeDasharray = activeWorkflow?.actorType === 'staff' || activeWorkflow?.actorType === 'instruments'
          ? "5 5"
          : undefined;

        return {
          id: step.id,
          stepIndex: step.stepIndex,
          path,
          midX: (startX + endX) / 2,
          midY: (startY + endY) / 2,
          arrowPoints,
          fromRoomId: step.fromRoomId,
          toRoomId: step.toRoomId,
          fromRoomName: fromRoom.name || ROOM_TYPES.find(t => t.id === fromRoom.type)?.label || fromRoom.type,
          toRoomName: toRoom.name || ROOM_TYPES.find(t => t.id === toRoom.type)?.label || toRoom.type,
          lineType,
          lineColor,
          lineLabel,
          weight,
          strokeWidth,
          weightLabel,
          strokeDasharray,
        };
      });
  }, [workflowSteps, rooms, currentFloor, ROOM_TYPES, activeWorkflow?.actorType, architecturalElements, draggingRoomId, dragOffset, viewTransform.scale]);

  const previewPath = useMemo(() => {
    if (!connectMode || !pendingFromRoomId || !mousePos) return null;
    const fromRoom = rooms.find(r => r.id === pendingFromRoomId);
    if (!fromRoom) return null;

    // Filter doors for current floor for preview path
    const floorDoors = architecturalElements.filter(
      el => el.floor === currentFloor && el.type === "door"
    );

    if (hoverRoomId && hoverRoomId !== pendingFromRoomId) {
      const toRoom = rooms.find(r => r.id === hoverRoomId);
      if (toRoom) {
        return computeBezierPath(fromRoom, toRoom, 0, floorDoors).path;
      }
    }

    return computePreviewPath(fromRoom, mousePos.x, mousePos.y);
  }, [connectMode, pendingFromRoomId, mousePos, hoverRoomId, rooms, currentFloor, architecturalElements]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="min-h-[4.5rem] py-3 border-b flex items-center justify-between px-8 bg-card z-10 shrink-0 shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-primary">{t("layout.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("layout.subtitle")}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {workflows.length > 0 && (
            <Select value={selectedWorkflowId || ""} onValueChange={setSelectedWorkflowId}>
              <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-workflow">
                <SelectValue placeholder="Workflow wählen" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const grouped = workflows.reduce((acc, wf) => {
                    const key = wf.actorType || 'patient';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(wf);
                    return acc;
                  }, {} as Record<string, typeof workflows>);
                  
                  const sortGroup = (items: typeof workflows) => 
                    [...items].sort((a, b) => {
                      if (a.source === 'builtin' && b.source !== 'builtin') return -1;
                      if (a.source !== 'builtin' && b.source === 'builtin') return 1;
                      return a.name.localeCompare(b.name, 'de');
                    });
                  
                  const groupLabels: Record<string, string> = {
                    patient: t("workflow.groupPatient", "Patientenflüsse"),
                    staff: t("workflow.groupStaff", "Mitarbeiterflüsse"),
                    instruments: t("workflow.groupInstruments", "Instrumente/Sterilisation"),
                  };
                  
                  const groupOrder = ['patient', 'staff', 'instruments'];
                  
                  return groupOrder.filter(g => grouped[g]?.length).map((groupKey, gi) => (
                    <div key={groupKey}>
                      {gi > 0 && <div className="h-px bg-border my-1" />}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {groupLabels[groupKey]}
                      </div>
                      {sortGroup(grouped[groupKey]).map(wf => (
                        <SelectItem key={wf.id} value={wf.id} className="text-xs pl-4" data-testid={`workflow-item-${wf.slug || wf.id}`}>
                          {wf.name}
                          {wf.source === 'builtin' && <span className="ml-1 text-[10px] text-muted-foreground">(Standard)</span>}
                        </SelectItem>
                      ))}
                    </div>
                  ));
                })()}
              </SelectContent>
            </Select>
          )}
          
          <Select 
            value={currentFloor.toString()} 
            onValueChange={(val) => setCurrentFloor(parseInt(val))}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="select-floor">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-1" className="text-xs">{t("editor.floorUG")}</SelectItem>
              <SelectItem value="0" className="text-xs">{t("editor.floorEG")}</SelectItem>
              <SelectItem value="1" className="text-xs">{t("editor.floorOG")}</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={connectMode ? "default" : "outline"}
            size="sm"
            onClick={toggleConnectMode}
            className={cn(
              "h-8 px-3",
              connectMode && "bg-primary text-primary-foreground"
            )}
            data-testid="button-connect-mode"
          >
            <Link2 className="h-4 w-4 mr-1.5" />
            {connectMode ? t("editor.connectModeActive", "Aktiv") : t("editor.connectMode", "Verbinden")}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={triggerAnalysis}
            disabled={isAnalysisLoading}
            className="h-8 px-3"
            data-testid="button-workflow-analysis"
          >
            {isAnalysisLoading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Activity className="h-4 w-4 mr-1.5" />
            )}
            {t("editor.workflowAnalysis", "Workflow Analyse")}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" data-testid="button-more-menu">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {connections.length > 0 && (
                <>
                  <DropdownMenuItem 
                    onClick={() => setShowEdgePanel(prev => !prev)}
                    data-testid="menu-edge-panel"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {connections.length} {connections.length === 1 ? "Verbindung" : "Verbindungen"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem 
                onClick={clearAllRooms}
                className="text-destructive"
                data-testid="menu-reset"
              >
                <Undo className="mr-2 h-4 w-4" />
                {t("layout.reset")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="w-48 border-r bg-card flex flex-col z-10 shadow-sm">
          <div className="px-3 py-2 border-b bg-muted/10">
            <h3 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Plus className="w-3 h-3" />
              {t("layout.roomTypes")}
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {ROOM_TYPES.map((room) => (
              <button
                key={room.id}
                onClick={() => addRoom(room.id)}
                className="w-full group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-transparent transition-all duration-150 text-left hover:border-primary/20 hover:bg-accent active:scale-[0.98]"
                data-testid={`button-add-room-${room.id}`}
              >
                <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", room.color)}>
                  <Plus className="w-3 h-3 opacity-40 group-hover:opacity-80 mix-blend-multiply" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-foreground/80 leading-tight">{room.label}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{room.w.toFixed(1)}×{room.h.toFixed(1)} vM</span>
                </div>
              </button>
            ))}

            {/* Architecture Section */}
            <div className="pt-3 mt-2 border-t border-border/50">
              <h4 className="font-semibold text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1 mb-2">
                <Building2 className="w-3 h-3" />
                Architektur
              </h4>
              {ELEMENT_TYPES.map((elem) => {
                const Icon = elem.icon;
                return (
                  <button
                    key={elem.id}
                    onMouseDown={() => handleElementDragStart(elem.id, elem.width)}
                    className={cn(
                      "w-full group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-transparent transition-all duration-150 text-left hover:border-primary/20 hover:bg-accent active:scale-[0.98] cursor-grab active:cursor-grabbing",
                      draggingElement?.type === elem.id && "ring-2 ring-primary bg-primary/10"
                    )}
                    data-testid={`button-add-element-${elem.id}`}
                  >
                    <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 border-2", elem.color)}>
                      <Icon className="w-3 h-3 opacity-60 group-hover:opacity-80" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-foreground/80 leading-tight">{elem.label}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">{(elem.width * 100).toFixed(0)}cm</span>
                    </div>
                  </button>
                );
              })}
              <p className="text-[9px] text-muted-foreground px-1 mt-1.5 leading-tight">
                Ziehe auf eine Wand, um zu platzieren
              </p>
            </div>
          </div>

          <div className="px-2 py-2 border-t bg-blue-50/50">
            <div className="flex items-start gap-2">
              <Info className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-600 leading-tight">
                {t("layout.tipText")}
              </p>
            </div>
          </div>
        </div>

        <div
          ref={canvasRef}
          className={cn(
            "flex-1 bg-[#F0F4F8] relative overflow-hidden",
            isSpacePressed && !isPanning ? "cursor-grab" : "",
            isPanning ? "cursor-grabbing" : "",
            draggingElement && !isPanning ? "cursor-grabbing" : ""
          )}
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={(e) => {
            handlePanEnd();
            handleCanvasMouseUp();
          }}
          onMouseLeave={() => {
            handlePanEnd();
            setMousePos(null);
            if (draggingElement) {
              setDraggingElement(null);
              setElementPreview(null);
            }
          }}
          onClick={(e) => {
            if (isPanning || isSpacePressed) return; // Don't handle clicks during pan
            // Check if click was on background (not on room/connection/button)
            const targetElement = e.target as HTMLElement;
            const isOnRoom = targetElement.closest('[data-testid^="room-"]');
            const isOnConnection = targetElement.closest('[data-testid^="connection-"]');
            const isOnButton = targetElement.closest('button');
            const isOnPopover = targetElement.closest('.bg-white.rounded-lg.shadow-xl'); // Connection popover
            const isOnInteractiveElement = isOnRoom || isOnConnection || isOnButton || isOnPopover;

            if (!isOnInteractiveElement) {
              if (connectMode && pendingFromRoomId) {
                setPendingFromRoomId(null);
                setMousePos(null);
                setHoverRoomId(null);
              } else {
                setSelectedRoomId(null);
                setSelectedElementId(null);
                setSelectedConnectionId(null);
              }
            }
          }}
        >
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, #000 1px, transparent 1px),
                linear-gradient(to bottom, #000 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />
          
          {connectMode && pendingFromRoomId && (
            <div 
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-100 border border-green-300 text-green-800 shadow-lg rounded-lg px-4 py-2 z-50 pointer-events-none flex items-center gap-2"
              data-testid="hint-cancel-connect"
            >
              <span className="text-xs font-medium">{t("editor.selectTarget", "Zielraum wählen")}</span>
              <span className="text-[10px] bg-green-200 rounded px-1.5 py-0.5 font-mono">ESC</span>
              <span className="text-[10px] text-green-600">{t("editor.orClickCancel", "oder Klick = Abbrechen")}</span>
            </div>
          )}
          
          <div
            className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm shadow-lg rounded-lg border px-3 py-2 z-40 pointer-events-none"
            data-testid="legend-line-types"
          >
            <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              {t("layout.lineTypeLegend", "Verbindungstyp")}
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-muted-foreground">Standard</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Kritisch</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">Optional</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Automatisiert</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                {t("layout.frequencyLegend", "Frequenz (Linienstärke)")}
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-4 h-[3px] bg-slate-400 rounded-full" />
                  <span className="text-muted-foreground">Normal</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-4 h-[5px] bg-slate-400 rounded-full" />
                  <span className="text-muted-foreground">Häufig</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-4 h-[7px] bg-slate-400 rounded-full" />
                  <span className="text-muted-foreground">Sehr häufig</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                {t("layout.actorTypeLegend", "Akteur (Linienstil)")}
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <svg width="16" height="4" className="shrink-0">
                    <line x1="0" y1="2" x2="16" y2="2" stroke="rgb(148, 163, 184)" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span className="text-muted-foreground">Patient</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="16" height="4" className="shrink-0">
                    <line x1="0" y1="2" x2="16" y2="2" stroke="rgb(148, 163, 184)" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 3" />
                  </svg>
                  <span className="text-muted-foreground">Personal</span>
                </div>
              </div>
            </div>
          </div>
          
          {efficiencyData && (
            <div 
              className="absolute bottom-4 right-4 w-64 bg-background/95 backdrop-blur-sm shadow-xl rounded-xl border p-3 z-40 pointer-events-auto"
              data-testid="card-layout-efficiency"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {t("layout.efficiencyScore", "Layout-Effizienz")}
                  </span>
                </div>
                <div className={cn(
                  "text-lg font-bold",
                  efficiencyData.score >= 70 ? "text-green-600" : efficiencyData.score >= 40 ? "text-amber-600" : "text-red-600"
                )} data-testid="text-efficiency-score">
                  {efficiencyData.score}/100
                </div>
              </div>
              
              {efficiencyData.breakdown.privacyRisk && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg" data-testid="badge-privacy-risk">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[10px] font-medium text-red-700">
                    {t("layout.privacyRisk", "Datenschutzrisiko: Empfang zu nah am Wartebereich")}
                  </span>
                </div>
              )}
              
              {efficiencyData.tips.length > 0 && (
                <div className="space-y-1.5">
                  {efficiencyData.tips.slice(0, 3).map((tip, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-tight" data-testid={`text-tip-${i}`}>{tip}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {efficiencyData.workflowAnalysis && (
                <div className="mt-2 pt-2 border-t" data-testid="section-workflow-analysis">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("layout.workflowScore", "Workflow-Effizienz")}
                      </span>
                    </div>
                    <div className={cn(
                      "text-sm font-bold",
                      efficiencyData.workflowAnalysis.workflowScore >= 70 ? "text-green-600" : 
                      efficiencyData.workflowAnalysis.workflowScore >= 40 ? "text-amber-600" : "text-red-600"
                    )} data-testid="text-workflow-score">
                      {efficiencyData.workflowAnalysis.workflowScore}/100
                    </div>
                  </div>
                  {efficiencyData.workflowAnalysis.topConnections.length > 0 && (
                    <div className="space-y-1 mb-1.5">
                      {efficiencyData.workflowAnalysis.topConnections.slice(0, 2).map((conn, i) => (
                        <div key={i} className="flex items-center gap-1 text-[9px]">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            conn.distanceClass === "short" ? "bg-green-500" :
                            conn.distanceClass === "medium" ? "bg-amber-500" : "bg-red-500"
                          )} />
                          <span className="text-muted-foreground truncate">
                            {conn.fromName} → {conn.toName}
                          </span>
                          <span className="ml-auto font-medium">{conn.distance}m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {efficiencyData.workflowMetrics && (
                <div className="mt-2 pt-2 border-t" data-testid="section-workflow-metrics">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Footprints className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("layout.workflowMetrics", "Workflow-Laufwege")}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-muted/50 rounded px-1 py-0.5">
                      <div className="text-xs font-bold text-foreground" data-testid="text-total-distance">
                        {efficiencyData.workflowMetrics.totalDistanceMeters}m
                      </div>
                      <div className="text-[8px] text-muted-foreground">Gesamt</div>
                    </div>
                    <div className="bg-muted/50 rounded px-1 py-0.5">
                      <div className="text-xs font-bold text-foreground" data-testid="text-avg-step">
                        {efficiencyData.workflowMetrics.avgStepDistanceMeters}m
                      </div>
                      <div className="text-[8px] text-muted-foreground">Ø/Schritt</div>
                    </div>
                    <div className="bg-muted/50 rounded px-1 py-0.5">
                      <div className={cn(
                        "text-xs font-bold",
                        efficiencyData.workflowMetrics.motionWasteScore > 50 ? "text-red-600" : 
                        efficiencyData.workflowMetrics.motionWasteScore > 25 ? "text-amber-600" : "text-green-600"
                      )} data-testid="text-motion-waste">
                        {efficiencyData.workflowMetrics.motionWasteScore}
                      </div>
                      <div className="text-[8px] text-muted-foreground">Verlust</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-1 z-50 pointer-events-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/90 backdrop-blur-sm"
              onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 4) }))}
              title="Zoom in"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/90 backdrop-blur-sm"
              onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.25) }))}
              title="Zoom out"
            >
              <span className="text-lg font-bold leading-none">−</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background/90 backdrop-blur-sm"
              onClick={resetView}
              title="Reset view"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
            <div className="text-[10px] text-center text-muted-foreground bg-background/90 rounded px-1 py-0.5">
              {Math.round(viewTransform.scale * 100)}%
            </div>
          </div>

          {/* Transform container for zoom/pan */}
          <div
            className="absolute inset-0 origin-top-left"
            style={{
              transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
              willChange: 'transform',
            }}
          >

          <AnimatePresence>
            {rooms.filter(r => r.floor === currentFloor).map((room) => {
              const typeDef = ROOM_TYPES.find(t => t.id === room.type);
              const isSelected = selectedRoomId === room.id;
              const isPendingFrom = pendingFromRoomId === room.id;

              // Live benchmark validation
              const roomStatus = getRoomStatus(room.type, room.width, room.height, roomSizeBenchmarks);

              // CAD-style SVG rendering
              const roomWidthPx = mToPx(room.width);
              const roomHeightPx = mToPx(room.height);
              const roomXPx = mToPx(room.x);
              const roomYPx = mToPx(room.y);
              const fillColor = ROOM_FILL_COLORS[room.type] || "#f5f5f5";

              // Calculate wall segments with gaps for doors/windows
              const { walls, elementsOnWalls } = calculateWallSegments(
                roomWidthPx,
                roomHeightPx,
                roomXPx,
                roomYPx,
                architecturalElements,
                room.floor
              );

              const wallPath = generateWallPath(walls, roomWidthPx, roomHeightPx);

              return (
                <motion.div
                  key={room.id}
                  drag={!connectMode}
                  dragMomentum={false}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    x: roomXPx,
                    y: roomYPx,
                    scale: isSelected ? 1.02 : 1,
                    opacity: 1,
                    width: roomWidthPx,
                    height: roomHeightPx,
                    zIndex: isSelected ? 50 : 1
                  }}
                  onDragStart={() => {
                    if (!connectMode) {
                      setDraggingRoomId(room.id);
                      setDragOffset({ x: 0, y: 0 });
                    }
                  }}
                  onDrag={(e, info) => {
                    if (!connectMode) {
                      setDragOffset({ x: info.offset.x, y: info.offset.y });
                    }
                  }}
                  onDragEnd={(e, info) => {
                    if (connectMode) return;
                    setDraggingRoomId(null);
                    setDragOffset({ x: 0, y: 0 });
                    const shiftPressed = (e as MouseEvent).shiftKey;
                    handleDragEnd(room, info, shiftPressed);
                  }}
                  onClick={(e) => {
                    if (connectMode) {
                      e.stopPropagation();
                      handleRoomClickInConnectMode(room.id);
                    }
                  }}
                  onMouseEnter={() => connectMode && setHoverRoomId(room.id)}
                  onMouseLeave={() => connectMode && setHoverRoomId(null)}
                  className={cn(
                    "absolute flex flex-col items-center justify-center select-none transition-shadow duration-200 will-change-transform group",
                    connectMode ? "cursor-pointer" : "cursor-move",
                    isSelected ? "ring-4 ring-primary/20 shadow-2xl z-50" : "hover:shadow-lg",
                    connectMode && isPendingFrom && "ring-4 ring-green-400",
                    connectMode && !isPendingFrom && pendingFromRoomId && "ring-2 ring-blue-300"
                  )}
                  data-testid={`room-${room.id}`}
                >
                  {/* SVG-based CAD rendering */}
                  <svg
                    width={roomWidthPx}
                    height={roomHeightPx}
                    className="absolute inset-0 pointer-events-none overflow-visible"
                  >
                    {/* Floor fill (no stroke) */}
                    <rect
                      x={WALL_THICKNESS / 2}
                      y={WALL_THICKNESS / 2}
                      width={roomWidthPx - WALL_THICKNESS}
                      height={roomHeightPx - WALL_THICKNESS}
                      fill={fillColor}
                      stroke="none"
                    />
                    {/* Walls with gaps for doors/windows */}
                    <path
                      d={wallPath}
                      stroke={WALL_COLOR}
                      strokeWidth={WALL_THICKNESS}
                      strokeLinecap="square"
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Render doors and windows in CAD style */}
                    {elementsOnWalls.map((elOnWall) => {
                      if (elOnWall.element.type === "door") {
                        return renderDoorSVG(
                          elOnWall.element,
                          elOnWall.side,
                          elOnWall.positionOnWall,
                          roomWidthPx,
                          roomHeightPx
                        );
                      } else {
                        return renderWindowSVG(
                          elOnWall.element,
                          elOnWall.side,
                          elOnWall.positionOnWall,
                          roomWidthPx,
                          roomHeightPx
                        );
                      }
                    })}
                  </svg>

                  {/* Edit button on hover (top-right) */}
                  {!connectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoomId(room.id);
                      }}
                      className="absolute top-1 right-1 p-1.5 rounded-md bg-white/80 hover:bg-white shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
                      data-testid={`button-edit-room-${room.id}`}
                    >
                      <Pencil className="w-3 h-3 text-slate-600" />
                    </button>
                  )}

                  {/* Room labels: name + subtle dimensions */}
                  <div className="text-center pointer-events-none p-2 w-full overflow-hidden relative z-10 flex flex-col items-center justify-center">
                    <div className="font-bold text-xs text-slate-800 truncate px-1">
                      {room.name || typeDef?.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      {room.width.toFixed(1).replace('.', ',')} × {room.height.toFixed(1).replace('.', ',')}m
                    </div>
                    {connectMode && isPendingFrom && (
                      <div className="text-[9px] text-green-700 font-bold mt-1 bg-green-100 inline-block px-1.5 rounded">
                        {t("editor.connectFrom", "Start →")}
                      </div>
                    )}
                  </div>

                  {connectMode && (
                    <>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm opacity-60 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm opacity-60 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Architectural Elements Interaction Layer (click to select, hover for delete) */}
          {architecturalElements
            .filter(el => el.floor === currentFloor)
            .map((element) => {
              const isHorizontal = element.rotation === 0;
              const isSelected = selectedElementId === element.id;
              const isDoor = element.type === "door";

              return (
                <div
                  key={element.id}
                  className={cn(
                    "absolute group cursor-pointer",
                    isSelected && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{
                    left: element.x,
                    top: element.y,
                    width: isHorizontal ? element.width : 8,
                    height: isHorizontal ? 8 : element.width,
                    zIndex: isSelected ? 60 : 55, // Above rooms for interaction
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDoor) {
                      setSelectedElementId(element.id);
                      setSelectedRoomId(null); // Deselect room when selecting element
                    }
                  }}
                  data-testid={`element-${element.id}`}
                >
                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteElementMutation.mutate(element.id);
                      if (selectedElementId === element.id) {
                        setSelectedElementId(null);
                      }
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-md hover:bg-red-600"
                    data-testid={`button-delete-element-${element.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {/* Settings button for doors */}
                  {isDoor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedElementId(element.id);
                        setSelectedRoomId(null);
                      }}
                      className="absolute -top-2 -left-2 w-5 h-5 bg-amber-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-md hover:bg-amber-600"
                      title="Tür konfigurieren"
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

          {/* Element drag preview */}
          {elementPreview && draggingElement && (
            <div
              className={cn(
                "absolute pointer-events-none z-50 transition-opacity",
                elementPreview.valid ? "opacity-80" : "opacity-30"
              )}
              style={{
                left: elementPreview.x,
                top: elementPreview.y,
                width: elementPreview.rotation === 0 ? mToPx(draggingElement.widthM) : 8,
                height: elementPreview.rotation === 0 ? 8 : mToPx(draggingElement.widthM),
              }}
            >
              {draggingElement.type === "door" ? (
                <div className="w-full h-full bg-amber-500 rounded-sm border-2 border-amber-600" />
              ) : (
                <div className="w-full h-full bg-sky-400 rounded-sm border-2 border-sky-500" />
              )}
              {elementPreview.valid && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-green-500 text-white text-[10px] px-2 py-0.5 rounded shadow">
                  ✓ Loslassen zum Platzieren
                </div>
              )}
              {!elementPreview.valid && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500 text-white text-[10px] px-2 py-0.5 rounded shadow">
                  Näher an Wand ziehen
                </div>
              )}
            </div>
          )}

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            data-testid="svg-connections"
          >
            {connectionArrows.map(arrow => {
              const isSelected = selectedConnectionId === arrow.id;
              return (
              <g key={arrow.id} data-testid={`connection-${arrow.id}`}>
                <title>{`${arrow.fromRoomName} → ${arrow.toRoomName}\nTyp: ${arrow.lineLabel}\nFrequenz: ${arrow.weightLabel}`}</title>
                {/* Invisible wider hit area for click detection */}
                <path
                  d={arrow.path}
                  stroke="transparent"
                  strokeWidth={Math.max(20, arrow.strokeWidth + 14)}
                  strokeLinecap="round"
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedConnectionId(isSelected ? null : arrow.id);
                  }}
                />
                {/* Visible path */}
                <path
                  d={arrow.path}
                  stroke={arrow.lineColor}
                  strokeWidth={arrow.strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={arrow.strokeDasharray}
                  fill="none"
                  className={cn(
                    "transition-all duration-200",
                    isSelected && "filter drop-shadow-lg"
                  )}
                />
                {/* Highlight ring when selected */}
                {isSelected && (
                  <path
                    d={arrow.path}
                    stroke="rgb(59, 130, 246)"
                    strokeWidth={arrow.strokeWidth + 6}
                    strokeLinecap="round"
                    strokeDasharray={arrow.strokeDasharray}
                    fill="none"
                    opacity={0.3}
                    className="pointer-events-none"
                  />
                )}
                {arrow.arrowPoints.map((pt, i) => {
                  // Scale arrow size based on stroke width
                  const scale = arrow.strokeWidth / 3;
                  return (
                    <polygon
                      key={i}
                      points={`${-4 * scale},${-3 * scale} ${4 * scale},0 ${-4 * scale},${3 * scale}`}
                      fill={arrow.lineColor}
                      transform={`translate(${pt.x}, ${pt.y}) rotate(${pt.angle})`}
                      className="transition-all duration-200"
                    />
                  );
                })}
                {connectMode && (
                  <circle
                    cx={arrow.midX}
                    cy={arrow.midY}
                    r="12"
                    fill="#ef4444"
                    className="pointer-events-auto cursor-pointer hover:fill-red-600 transition-colors"
                    onClick={() => deleteWorkflowStepMutation.mutate(arrow.id)}
                    data-testid={`button-delete-connection-${arrow.id}`}
                  />
                )}
                {connectMode && (
                  <text
                    x={arrow.midX}
                    y={arrow.midY + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="bold"
                    className="pointer-events-none select-none"
                  >
                    ×
                  </text>
                )}
              </g>
            );})}
            {previewPath && (
              <path
                d={previewPath}
                stroke="#22c55e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="8 4"
                fill="none"
                className="animate-pulse"
                data-testid="preview-connection"
              />
            )}
          </svg>

          {/* Connection Properties Popover */}
          {selectedConnectionId && (() => {
            const conn = connectionArrows.find(c => c.id === selectedConnectionId);
            if (!conn) return null;

            const LINE_TYPE_OPTIONS: Array<{ value: StepLineType; label: string; color: string }> = [
              { value: "default", label: "Standard", color: "rgb(100, 116, 139)" },
              { value: "critical", label: "Kritisch", color: "rgb(239, 68, 68)" },
              { value: "optional", label: "Optional", color: "rgb(245, 158, 11)" },
              { value: "automated", label: "Automatisiert", color: "rgb(34, 197, 94)" },
            ];

            // Get current workflow's actorType for line style display
            const currentActorType = activeWorkflow?.actorType || 'patient';
            const isStaffLine = currentActorType === 'staff' || currentActorType === 'instruments';

            return (
              <div
                className="absolute bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 min-w-[240px]"
                style={{
                  left: conn.midX + 20,
                  top: conn.midY - 80,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-700">Verbindung bearbeiten</h4>
                  <button
                    onClick={() => setSelectedConnectionId(null)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-[10px] text-slate-500 mb-3 flex items-center gap-1">
                  <span className="font-medium text-slate-700">{conn.fromRoomName}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-medium text-slate-700">{conn.toRoomName}</span>
                </div>

                <div className="space-y-3">
                  {/* Line Style (based on workflow actorType) */}
                  <div>
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-1.5 block">
                      Linienstil (Akteur)
                    </label>
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                      <svg width="32" height="8" className="shrink-0">
                        <line
                          x1="0" y1="4" x2="32" y2="4"
                          stroke={conn.lineColor}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={isStaffLine ? "6 4" : undefined}
                        />
                      </svg>
                      <span className="text-[10px] font-medium text-slate-700">
                        {currentActorType === 'patient' ? 'Patient (durchgezogen)' :
                         currentActorType === 'staff' ? 'Mitarbeiter (gestrichelt)' :
                         'Instrumente (gestrichelt)'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Wird durch den Workflow-Typ bestimmt: "{activeWorkflow?.name}"
                    </p>
                  </div>

                  {/* Color / Priority Type */}
                  <div>
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-1.5 block">
                      Priorität / Farbe
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LINE_TYPE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            updateWorkflowStepMutation.mutate({
                              id: conn.id,
                              updates: { lineType: opt.value }
                            });
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all border-2",
                            conn.lineType === opt.value
                              ? "bg-slate-100"
                              : "bg-slate-50 hover:bg-slate-100 border-transparent"
                          )}
                          style={{
                            borderColor: conn.lineType === opt.value ? opt.color : undefined,
                          }}
                        >
                          <svg width="16" height="8" className="shrink-0">
                            <line
                              x1="0" y1="4" x2="16" y2="4"
                              stroke={opt.color}
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray={isStaffLine ? "4 3" : undefined}
                            />
                          </svg>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-1.5 block">
                      Frequenz (Linienstärke)
                    </label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map(w => (
                        <button
                          key={w}
                          onClick={() => {
                            updateWorkflowStepMutation.mutate({
                              id: conn.id,
                              updates: { weight: w }
                            });
                          }}
                          className={cn(
                            "flex-1 py-1.5 rounded text-[10px] font-medium transition-all flex flex-col items-center gap-1",
                            conn.weight === w
                              ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300 ring-offset-1"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                          )}
                        >
                          <svg width="20" height={w === 3 ? 7 : w === 2 ? 5 : 3}>
                            <line
                              x1="0" y1={w === 3 ? 3.5 : w === 2 ? 2.5 : 1.5}
                              x2="20" y2={w === 3 ? 3.5 : w === 2 ? 2.5 : 1.5}
                              stroke={conn.lineColor}
                              strokeWidth={w === 3 ? 7 : w === 2 ? 5 : 3}
                              strokeLinecap="round"
                              strokeDasharray={isStaffLine ? "4 3" : undefined}
                            />
                          </svg>
                          <span>{w === 1 ? "Normal" : w === 2 ? "Häufig" : "Sehr häufig"}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <button
                      onClick={() => {
                        deleteWorkflowStepMutation.mutate(conn.id);
                        setSelectedConnectionId(null);
                      }}
                      className="w-full py-1.5 rounded text-[10px] font-medium bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Verbindung löschen
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          </div>
          {/* End of transform container */}
        </div>

        {showEdgePanel && connectionArrows.length > 0 && (
          <div className="w-64 border-l bg-card flex flex-col z-10 shadow-sm" data-testid="panel-edges">
            <div className="px-3 py-2 border-b bg-muted/10">
              <h3 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3 h-3" />
                {t("layout.connections", "Verbindungen")}
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {connectionArrows.map(conn => (
                  <div
                    key={conn.id}
                    className="rounded-lg border bg-background/50 hover:bg-accent/50 transition-colors overflow-hidden"
                    data-testid={`edge-item-${conn.id}`}
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: conn.lineColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-medium truncate">
                          {conn.fromRoomName}
                        </div>
                        <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <ArrowRight className="w-2.5 h-2.5" />
                          <span className="truncate">{conn.toRoomName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="text-[9px] font-mono font-medium px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: `${conn.lineColor}20`,
                            color: conn.lineColor
                          }}
                        >
                          {conn.lineLabel}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deleteWorkflowStepMutation.mutate(conn.id)}
                          data-testid={`button-delete-edge-${conn.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="px-2 py-1.5 border-t bg-muted/30 flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[9px] text-muted-foreground font-medium">Frequenz:</span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          Wie oft wird dieser Weg genutzt? Beeinflusst die Linienstärke.
                        </TooltipContent>
                      </Tooltip>
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map((w) => (
                          <Tooltip key={w}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => updateWorkflowStepMutation.mutate({ id: conn.id, updates: { weight: w } })}
                                className={cn(
                                  "w-5 h-5 rounded text-[9px] font-bold transition-all",
                                  conn.weight === w
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                )}
                                data-testid={`button-weight-${conn.id}-${w}`}
                              >
                                {w}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {w === 1 ? "Normal" : w === 2 ? "Häufig" : "Sehr häufig"}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="px-2 py-2 border-t bg-muted/10">
              <div className="text-[9px] text-muted-foreground text-center">
                {connectionArrows.length} {connectionArrows.length === 1 ? "Verbindung" : "Verbindungen"}
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {selectedRoom && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 w-80 bg-background/95 backdrop-blur-md shadow-2xl rounded-2xl border border-border/50 z-50 overflow-hidden"
            >
              <div className="h-8 bg-muted/40 w-full flex items-center justify-center border-b">
                  <div className="w-12 h-1 rounded-full bg-foreground/10" />
              </div>

              <div className="p-4 pt-2">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-xl shadow-sm border-2 flex items-center justify-center", ROOM_TYPES.find(t => t.id === selectedRoom.type)?.color)}>
                           <Settings2 className="w-6 h-6 opacity-50 mix-blend-multiply" />
                      </div>
                      <div>
                      <h4 className="font-bold text-lg leading-none">{roomNameDraft || selectedRoomType?.label}</h4>
                      <p className="text-xs text-muted-foreground font-mono mt-1 uppercase tracking-wide">{selectedRoomType?.label}</p>
                      </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedRoomId(null)}>
                      <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                      <Label htmlFor="roomName" className="text-xs font-bold uppercase text-muted-foreground">{t("editor.roomName")}</Label>
                      <Input 
                          id="roomName"
                          value={roomNameDraft} 
                          onChange={(e) => handleNameChange(e.target.value)}
                          onBlur={handleNameBlur}
                          placeholder={selectedRoomType?.label}
                          className="bg-white/50 border-slate-200 focus:bg-white transition-all"
                          data-testid="input-room-name"
                      />
                  </div>

                  <Separator className="bg-border/50" />

                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.width")}</Label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded" data-testid="text-width-tiles">{Math.round(widthDraft / METERS_PER_TILE)} Tiles</span>
                          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">~{widthDraft.toFixed(1)} vM</span>
                        </div>
                      </div>
                      <Slider 
                        value={[widthDraft]} 
                        min={1} 
                        max={8} 
                        step={0.1} 
                        onValueChange={([val]) => handleWidthChange(val)}
                        data-testid="slider-width"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                         <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.height")}</Label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded" data-testid="text-height-tiles">{Math.round(heightDraft / METERS_PER_TILE)} Tiles</span>
                          <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">~{heightDraft.toFixed(1)} vM</span>
                        </div>
                      </div>
                      <Slider 
                        value={[heightDraft]} 
                        min={1} 
                        max={8} 
                        step={0.1} 
                        onValueChange={([val]) => handleHeightChange(val)}
                        data-testid="slider-height"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-border/30">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.area")}</Label>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded font-medium", roomSizeBucketColor(classifyRoomSize(selectedRoom.type, sqM(widthDraft, heightDraft))))} data-testid="text-room-bucket">
                          {roomSizeBucketLabel(classifyRoomSize(selectedRoom.type, sqM(widthDraft, heightDraft)))}
                        </span>
                        <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-bold" data-testid="text-room-area">
                          ~{sqM(widthDraft, heightDraft)} vM²
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">{t("editor.floor")}</Label>
                      <Select
                        value={String(selectedRoom.floor)}
                        onValueChange={(val) => updateRoom(selectedRoom.id, { floor: parseInt(val, 10) })}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-floor">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">{t("editor.floorUG")}</SelectItem>
                          <SelectItem value="0">{t("editor.floorEG")}</SelectItem>
                          <SelectItem value="1">{t("editor.floorOG")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-border/50" />

                  {/* Inventory Check Section */}
                  {(() => {
                    const CATEGORY_MAP: Record<string, string> = {
                      "exam": "behandlung",
                      "treatment": "behandlung",
                      "xray": "behandlung",
                      "reception": "empfang",
                      "waiting": "wartezimmer",
                      "lab": "labor",
                      "storage": "lager",
                      "office": "büro",
                      "sterilization": "labor",
                    };
                    const categoryKey = CATEGORY_MAP[selectedRoom.type] || selectedRoom.type;
                    const inventoryItems = inventoryRulesData?.byCategory?.[categoryKey] || [];
                    const roomAreaSqM = widthDraft * heightDraft;

                    // Calculate total required area
                    let totalItemAreaSqM = 0;
                    for (const item of inventoryItems) {
                      if (item.dimensions?.width_cm && item.dimensions?.depth_cm) {
                        const itemAreaM2 = (item.dimensions.width_cm / 100) * (item.dimensions.depth_cm / 100);
                        const clearanceM = (item.clearance_cm || 60) / 100;
                        // Add clearance on all sides
                        const totalWidth = (item.dimensions.width_cm / 100) + clearanceM * 2;
                        const totalDepth = (item.dimensions.depth_cm / 100) + clearanceM * 2;
                        totalItemAreaSqM += totalWidth * totalDepth;
                      }
                    }
                    // Add 30% traffic area
                    const requiredAreaWithTraffic = totalItemAreaSqM * 1.3;
                    const isSufficient = roomAreaSqM >= requiredAreaWithTraffic;
                    const hasSurfaceItems = inventoryItems.some(i => i.placement?.toLowerCase().includes("oberfläche") || i.placement?.toLowerCase().includes("surface") || i.placement?.toLowerCase().includes("tisch"));

                    return inventoryItems.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <Label className="text-xs font-bold uppercase text-muted-foreground">
                            {t("editor.inventoryCheck", "Ausstattungs-Check (AI)")}
                          </Label>
                        </div>

                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {inventoryItems.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-start justify-between text-xs p-2 bg-muted/30 rounded-md">
                              <div className="flex items-start gap-2">
                                {item.placement?.toLowerCase().includes("surface") || item.placement?.toLowerCase().includes("oberfläche") || item.placement?.toLowerCase().includes("tisch") ? (
                                  <Monitor className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                ) : (
                                  <Package className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                )}
                                <div>
                                  <span className="font-medium">{item.item}</span>
                                  {item.dimensions && (item.dimensions.width_cm || item.dimensions.depth_cm) && (
                                    <span className="text-muted-foreground ml-1">
                                      ({item.dimensions.width_cm || "?"}×{item.dimensions.depth_cm || "?"} cm)
                                    </span>
                                  )}
                                  {(item.placement?.toLowerCase().includes("surface") || item.placement?.toLowerCase().includes("oberfläche") || item.placement?.toLowerCase().includes("tisch")) && (
                                    <div className="text-amber-600 text-[10px] mt-0.5">
                                      Benötigt Oberfläche (z.B. Tisch)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {inventoryItems.length > 5 && (
                            <div className="text-[10px] text-muted-foreground text-center">
                              +{inventoryItems.length - 5} weitere Items
                            </div>
                          )}
                        </div>

                        {/* Area check summary */}
                        {totalItemAreaSqM > 0 && (
                          <div className={cn(
                            "p-2 rounded-md text-xs flex items-center gap-2",
                            isSufficient ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                          )}>
                            {isSufficient ? (
                              <CheckCircle className="h-4 w-4 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              {isSufficient
                                ? `Raum groß genug für Standard-Ausstattung`
                                : `Kritisch! Ausstattung benötigt ca. ${requiredAreaWithTraffic.toFixed(1)} m²`
                              }
                            </span>
                          </div>
                        )}

                        {hasSurfaceItems && (
                          <div className="text-[10px] text-amber-600 flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            Einige Items benötigen Tische/Ablagen
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}

                  <Separator className="bg-border/50" />

                  <div className="grid grid-cols-2 gap-3">
                     <Button
                      variant="outline"
                      className="hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors"
                      onClick={handleRotate}
                      data-testid="button-rotate"
                    >
                      <RotateCw className="mr-2 h-4 w-4" />
                      {t("editor.rotate")}
                    </Button>
                    <Button
                      variant="destructive"
                      className="shadow-sm hover:shadow-md transition-all"
                      onClick={() => deleteRoom(selectedRoom.id)}
                      data-testid="button-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("editor.delete")}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Door Configuration Panel */}
          {selectedElementId && architecturalElements.find(el => el.id === selectedElementId)?.type === "door" && (() => {
            const selectedElement = architecturalElements.find(el => el.id === selectedElementId);
            if (!selectedElement) return null;

            return (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-72 bg-background/95 backdrop-blur-md shadow-2xl rounded-2xl border border-border/50 z-50 overflow-hidden"
              >
                <div className="h-8 bg-amber-50 w-full flex items-center justify-center border-b border-amber-200">
                  <div className="w-12 h-1 rounded-full bg-amber-300" />
                </div>

                <div className="p-4 pt-2">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
                        <DoorOpen className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base leading-none">Tür-Einstellungen</h4>
                        <p className="text-xs text-muted-foreground mt-1">CAD-Konfiguration</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mr-2 -mt-2 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setSelectedElementId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {/* Hinge Side */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Anschlag (Scharniere)</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedElement.hinge === "left" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElementMutation.mutate({
                            id: selectedElement.id,
                            updates: { hinge: "left" }
                          })}
                        >
                          Links
                        </Button>
                        <Button
                          variant={selectedElement.hinge === "right" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElementMutation.mutate({
                            id: selectedElement.id,
                            updates: { hinge: "right" }
                          })}
                        >
                          Rechts
                        </Button>
                      </div>
                    </div>

                    {/* Opening Direction */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Öffnungsrichtung</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedElement.openingDirection === "in" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElementMutation.mutate({
                            id: selectedElement.id,
                            updates: { openingDirection: "in" }
                          })}
                        >
                          Innen
                        </Button>
                        <Button
                          variant={selectedElement.openingDirection === "out" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => updateElementMutation.mutate({
                            id: selectedElement.id,
                            updates: { openingDirection: "out" }
                          })}
                        >
                          Außen
                        </Button>
                      </div>
                    </div>

                    {/* Visual Preview */}
                    <div className="bg-muted/30 rounded-lg p-3 border">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Vorschau</div>
                      <svg width="100%" height="60" viewBox="0 0 120 60" className="mx-auto">
                        {/* Wall */}
                        <rect x="10" y="25" width="100" height="10" fill="#1e293b" />
                        {/* Door opening */}
                        <rect x="45" y="25" width="30" height="10" fill="#f0f4f8" />
                        {/* Door leaf and arc based on config */}
                        {(() => {
                          const isLeft = selectedElement.hinge === "left";
                          const isIn = selectedElement.openingDirection === "in";
                          const hingeX = isLeft ? 45 : 75;
                          const leafEndX = isLeft ? 75 : 45;
                          const arcY = isIn ? 35 : 25;
                          const arcStartY = isIn ? 35 : 25;
                          const sweep = (isLeft && isIn) || (!isLeft && !isIn) ? 1 : 0;

                          return (
                            <>
                              {/* Door leaf */}
                              <line
                                x1={hingeX}
                                y1={30}
                                x2={isIn ? hingeX : hingeX}
                                y2={isIn ? (isLeft ? 55 : 55) : (isLeft ? 5 : 5)}
                                stroke="#8B4513"
                                strokeWidth="3"
                                strokeLinecap="round"
                                transform={`rotate(${isLeft ? (isIn ? 45 : -45) : (isIn ? -45 : 45)}, ${hingeX}, 30)`}
                              />
                              {/* Arc */}
                              <path
                                d={`M ${hingeX} ${arcStartY} A 25 25 0 0 ${sweep} ${leafEndX} ${isIn ? 55 : 5}`}
                                fill="none"
                                stroke="#8B4513"
                                strokeWidth="1"
                                strokeDasharray="3 2"
                                opacity="0.6"
                              />
                              {/* Hinge indicator */}
                              <circle cx={hingeX} cy={30} r="3" fill="#8B4513" />
                            </>
                          );
                        })()}
                      </svg>
                      <div className="text-center text-[10px] text-muted-foreground mt-1">
                        {selectedElement.hinge === "left" ? "Links" : "Rechts"} / {selectedElement.openingDirection === "in" ? "Innen" : "Außen"}
                      </div>
                    </div>

                    <Separator />

                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        deleteElementMutation.mutate(selectedElement.id);
                        setSelectedElementId(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Tür löschen
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-workflow-analysis">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {t("editor.workflowAnalysisTitle", "Workflow-Analyse")}
            </DialogTitle>
            <DialogDescription>
              {t("editor.workflowAnalysisDesc", "Effizienz-Score basierend auf Laufwegen und Prozessabläufen")}
            </DialogDescription>
          </DialogHeader>
          
          {isAnalysisLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : workflowAnalysis ? (
            workflowAnalysis.workflows.length === 0 ? (
              <div className="text-center py-8 space-y-3" data-testid="no-workflow-steps-message">
                <div className="text-muted-foreground">
                  Keine Workflow-Schritte vorhanden
                </div>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Um die Workflow-Analyse zu nutzen, verbinden Sie Räume mit dem "Verbinden"-Button. Klicken Sie auf einen Raum als Start, dann auf einen anderen als Ziel.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setShowAnalysisModal(false); setConnectMode(true); }}
                  className="mt-2"
                  data-testid="button-start-connecting"
                >
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Workflow erstellen
                </Button>
              </div>
            ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Gesamt-Score</div>
                  <div className={cn(
                    "text-3xl font-bold",
                    workflowAnalysis.overallScore >= 70 ? "text-green-600" : 
                    workflowAnalysis.overallScore >= 40 ? "text-amber-600" : "text-red-600"
                  )} data-testid="text-overall-score">
                    {workflowAnalysis.overallScore}/100
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-muted-foreground">Friction-Index</div>
                  <div className="text-xl font-semibold" data-testid="text-friction-index">
                    {workflowAnalysis.overallFrictionIndex}%
                  </div>
                </div>
              </div>

              {workflowAnalysis.workflows.map((wf) => (
                <div key={wf.workflowId} className="border rounded-lg p-3" data-testid={`workflow-${wf.workflowId}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{wf.workflowName}</span>
                    <span className={cn(
                      "text-sm font-bold",
                      wf.score >= 70 ? "text-green-600" : wf.score >= 40 ? "text-amber-600" : "text-red-600"
                    )}>
                      {wf.score}/100
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                    <div>Gesamtweg: <span className="font-medium text-foreground">{wf.totalDistanceM}m</span></div>
                    <div>Etagenwechsel: <span className="font-medium text-foreground">{wf.floorChangeCount}</span></div>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 mt-1" />{wf.distanceBandCounts.short}
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 ml-1" />{wf.distanceBandCounts.medium}
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-1 ml-1" />{wf.distanceBandCounts.long}
                    </div>
                  </div>
                  
                  {wf.top3ExpensiveSteps.length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t">
                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        Teuerste Schritte:
                      </div>
                      {wf.top3ExpensiveSteps.map((step, i) => (
                        <div 
                          key={step.stepId} 
                          className={cn(
                            "text-xs px-2 py-1 rounded flex items-center justify-between",
                            step.distanceBand === "long" ? "bg-red-50 text-red-700" :
                            step.distanceBand === "medium" ? "bg-amber-50 text-amber-700" :
                            "bg-green-50 text-green-700"
                          )}
                          data-testid={`expensive-step-${i}`}
                        >
                          <span>{step.fromRoomName} → {step.toRoomName}</span>
                          <span className="font-medium">{step.distanceM}m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {workflowAnalysis.recommendations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Empfehlungen
                  </div>
                  {workflowAnalysis.recommendations.slice(0, 3).map((rec) => (
                    <div 
                      key={rec.id} 
                      className={cn(
                        "p-3 rounded-lg border text-sm",
                        rec.priority === "high" ? "bg-red-50 border-red-200" :
                        rec.priority === "medium" ? "bg-amber-50 border-amber-200" :
                        "bg-blue-50 border-blue-200"
                      )}
                      data-testid={`recommendation-${rec.id}`}
                    >
                      <div className="font-medium flex items-center gap-2">
                        {rec.priority === "high" ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : rec.priority === "medium" ? (
                          <Info className="h-4 w-4 text-amber-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                        )}
                        {rec.title}
                      </div>
                      <p className="text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Keine Analyse-Daten verfügbar
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
