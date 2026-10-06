import { useSaveStore } from '../store/saveStore';
import { SpecialIcon } from './SpecialIcon';
import { useDwellerThumbnail } from '../lib/useDwellerThumbnail';
import { isChildDweller, childDwellerIds, type RenderableDweller } from '../lib/dwellerRender';
import { decodeArgb } from '../lib/colors';
import type { Dweller } from '../types/save';
import { roomLabel, type RoomEntry } from '../lib/rooms';
import type { CardMetrics } from '../lib/cardMetrics';

const SPECIAL_LABELS = ['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const;

function toRenderable(d: Dweller, childIds: Set<number>): RenderableDweller {
  const raw = d as unknown as Record<string, any>;
  return {
    gender: d.gender,
    isChild: isChildDweller(raw as { experience?: { currentLevel?: number } }) || childIds.has(d.serializeId),
    hairName: typeof raw.hair === 'string' ? raw.hair : undefined,
    facialHair: typeof raw.faceMask === 'string' ? raw.faceMask : undefined,
    outfitName: typeof raw.equipedOutfit?.id === 'string' ? raw.equipedOutfit.id : undefined,
    happinessValue: typeof raw.happiness?.happinessValue === 'number' ? raw.happiness.happinessValue : undefined,
    skinColor: decodeArgb(raw.skinColor),
    hairColor: decodeArgb(raw.hairColor),
    outfitColor: decodeArgb(raw.outfitColor),
  };
}

interface Props {
  dweller: Dweller;
  /** The room this dweller is assigned to; null when unassigned. Omit to hide the badge. */
  room?: RoomEntry | null;
  metrics: CardMetrics;
}

export function CharacterCard({ dweller, room, metrics }: Props) {
  const { avatar, inner, icon, font } = metrics;
  const selectedId = useSaveStore((s) => s.selectedDwellerId);
  const selectDweller = useSaveStore((s) => s.selectDweller);
  const save = useSaveStore((s) => s.save);
  const isSelected = selectedId === dweller.serializeId;
  const renderable = toRenderable(dweller, childDwellerIds(save));
  const thumb = useDwellerThumbnail(renderable);

  const stats = dweller.stats?.stats;

  return (
    <div
      className={`flex flex-col items-center cursor-pointer select-none rounded px-1 py-1 transition-all ${
        isSelected ? 'ring-2 ring-green-400 bg-green-950/40' : 'hover:bg-zinc-800'
      }`}
      style={{ width: inner }}
      onClick={() => selectDweller(dweller.serializeId)}
    >
      {/* SPECIAL row: 7-column grid spanning the full avatar width */}
      <div
        className="grid mb-1"
        style={{ width: avatar, gridTemplateColumns: 'repeat(7, 1fr)' }}
      >
        {SPECIAL_LABELS.map((label, i) => {
          const val = stats?.[i + 1]?.value ?? '–';
          return (
            <span key={label} className="flex flex-col items-center leading-none">
              <SpecialIcon letter={label} size={icon} detail={typeof val === 'number' ? `${val}/10` : undefined} />
              <span className="text-zinc-300 font-mono" style={{ fontSize: font }}>{val}</span>
            </span>
          );
        })}
      </div>

      {/* Avatar */}
      <div
        className="relative bg-zinc-950 rounded border border-zinc-700 flex items-center justify-center overflow-hidden"
        style={{ width: avatar, height: avatar, flexShrink: 0 }}
      >
        {renderable.isChild ? (
          <span className="text-zinc-500 italic text-xs text-center px-2">Child</span>
        ) : thumb ? (
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span className="text-zinc-600 text-xs">…</span>
        )}
        {room !== undefined && (
          <span
            title={room ? roomLabel(room.room, room.name) : 'Not assigned to a room'}
            className={`absolute bottom-1 left-1 right-1 truncate rounded px-1.5 py-0.5 text-center leading-tight bg-black/70 ${
              room ? 'text-emerald-300' : 'text-zinc-400 italic'
            }`}
            style={{ fontSize: Math.min(11, font) }}
          >
            {room ? room.name : 'Unassigned'}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="w-full truncate text-zinc-100 text-center leading-tight mt-1" style={{ fontSize: Math.min(12, font) }}>
        {dweller.name} {dweller.lastName}
      </div>
    </div>
  );
}
