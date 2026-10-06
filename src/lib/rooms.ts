import type { SaveJson } from '../types/save';

/**
 * A room in vault.rooms. The room's `dwellers` array holds the serializeIds of
 * the dwellers currently assigned to it; that array is the source of truth for
 * assignment (a dweller's own `savedRoom` can be stale).
 */
export interface Room {
  type: string;
  class?: string;
  /** Merge width: 1, 2 or 3 adjacent segments. */
  mergeLevel?: number;
  /** Upgrade level: 1..3. */
  level?: number;
  row?: number;
  col?: number;
  dwellers?: number[];
  deserializeID?: number;
  [k: string]: unknown;
}

// Internal room type -> in-game display name.
const ROOM_NAMES: Record<string, string> = {
  Entrance: 'Vault Door',
  Elevator: 'Elevator',
  LivingQuarters: 'Living Quarters',
  Storage: 'Storage Room',
  Overseer: "Overseer's Office",
  Radio: 'Radio Studio',
  Geothermal: 'Power Generator',
  Energy2: 'Nuclear Reactor',
  Cafeteria: 'Diner',
  Hydroponic: 'Garden',
  WaterPlant: 'Water Treatment',
  Water2: 'Water Purification',
  NukaCola: 'Nuka-Cola Bottler',
  MedBay: 'Medbay',
  ScienceLab: 'Science Lab',
  Gym: 'Weight Room',
  Armory: 'Armory',
  SuperRoom2: 'Fitness Room',
  Bar: 'Lounge',
  Classroom: 'Classroom',
  Dojo: 'Athletics Room',
  Casino: 'Game Room',
  BarberShop: 'Barbershop',
  WeaponFactory: 'Weapon Workshop',
  OutfitFactory: 'Outfit Workshop',
  DesignFactory: 'Theme Workshop',
};

export function getRooms(s: SaveJson | null | undefined): Room[] {
  const rooms = (s?.vault as { rooms?: unknown } | undefined)?.rooms;
  return Array.isArray(rooms) ? (rooms as Room[]) : [];
}

/** One occupied room instance, named so same-type rooms stay distinguishable. */
export interface RoomEntry {
  /** Stable key: the room's deserializeID, or its array index when missing. */
  key: string;
  room: Room;
  /** Display name, lettered when the vault has several occupied rooms of this type ("Power Generator B"). */
  name: string;
  dwellerIds: number[];
}

const letter = (i: number): string =>
  i < 26 ? String.fromCharCode(65 + i) : letter(Math.floor(i / 26) - 1) + letter(i % 26);

/**
 * Every room with at least one assigned dweller, ordered top floor first and
 * left to right. Same-type rooms are kept separate and lettered A, B, C… in
 * that order.
 */
export function getOccupiedRooms(s: SaveJson | null | undefined): RoomEntry[] {
  const occupied = getRooms(s)
    .map((room, i) => ({ room, i }))
    .filter(({ room }) => Array.isArray(room.dwellers) && room.dwellers.length > 0)
    .sort((a, b) => ((a.room.row ?? 0) - (b.room.row ?? 0)) || ((a.room.col ?? 0) - (b.room.col ?? 0)) || (a.i - b.i));

  const totals = new Map<string, number>();
  for (const { room } of occupied) totals.set(room.type, (totals.get(room.type) ?? 0) + 1);
  const seen = new Map<string, number>();

  return occupied.map(({ room, i }) => {
    const n = seen.get(room.type) ?? 0;
    seen.set(room.type, n + 1);
    const base = roomDisplayName(room);
    return {
      key: typeof room.deserializeID === 'number' ? String(room.deserializeID) : `idx-${i}`,
      room,
      name: (totals.get(room.type) ?? 0) > 1 ? `${base} ${letter(n)}` : base,
      dwellerIds: room.dwellers as number[],
    };
  });
}

/** Map of dweller serializeId -> the occupied room whose `dwellers` array contains it. */
export function buildRoomAssignments(s: SaveJson | null | undefined): Map<number, RoomEntry> {
  const map = new Map<number, RoomEntry>();
  for (const entry of getOccupiedRooms(s)) {
    for (const id of entry.dwellerIds) {
      if (!map.has(id)) map.set(id, entry);
    }
  }
  return map;
}

export function getDwellerRoom(s: SaveJson | null | undefined, serializeId: number): Room | null {
  return getRooms(s).find((r) => Array.isArray(r.dwellers) && r.dwellers.includes(serializeId)) ?? null;
}

export function roomDisplayName(room: Room): string {
  return ROOM_NAMES[room.type] ?? room.type.replace(/([a-z])([A-Z0-9])/g, '$1 $2');
}

/** e.g. "Diner · Lv 3 · 3-wide" (merge suffix omitted for single rooms). */
export function roomLabel(room: Room, name: string = roomDisplayName(room)): string {
  const parts = [name];
  if (typeof room.level === 'number') parts.push(`Lv ${room.level}`);
  if (typeof room.mergeLevel === 'number' && room.mergeLevel > 1) parts.push(`${room.mergeLevel}-wide`);
  return parts.join(' · ');
}

/** Remove a dweller's serializeId from every room's `dwellers` array. */
export function unassignDweller(s: SaveJson, serializeId: number): SaveJson {
  const rooms = getRooms(s);
  if (!rooms.some((r) => Array.isArray(r.dwellers) && r.dwellers.includes(serializeId))) return s;
  const next = rooms.map((r) =>
    Array.isArray(r.dwellers) && r.dwellers.includes(serializeId)
      ? { ...r, dwellers: r.dwellers.filter((id) => id !== serializeId) }
      : r,
  );
  return { ...s, vault: { ...(s.vault ?? {}), rooms: next } };
}
