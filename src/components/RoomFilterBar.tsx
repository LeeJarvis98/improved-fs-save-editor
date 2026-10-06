import { roomLabel, type RoomEntry } from '../lib/rooms';

export const ALL_ROOMS = 'all';
export const UNASSIGNED = 'unassigned';

interface Props {
  rooms: RoomEntry[];
  /** Live dweller count per room key. */
  counts: Map<string, number>;
  total: number;
  unassignedCount: number;
  active: string;
  onSelect: (key: string) => void;
}

function Badge({ label, count, title, active, muted, onClick }: {
  label: string;
  count: number;
  title?: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'shrink-0 flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
        active ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100',
        muted && !active ? 'italic' : '',
      ].join(' ')}
    >
      {label}
      <span className={`min-w-5 px-1.5 rounded-full text-center leading-5 ${active ? 'bg-black/25' : 'bg-zinc-900 text-zinc-400'}`}>
        {count}
      </span>
    </button>
  );
}

export function RoomFilterBar({ rooms, counts, total, unassignedCount, active, onSelect }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Filter dwellers by room"
      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-t border-zinc-700 overflow-x-auto [scrollbar-width:thin]"
      onWheel={(e) => {
        // Let a plain mouse wheel scroll the badge row sideways.
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
      }}
    >
      <Badge label="All rooms" count={total} active={active === ALL_ROOMS} onClick={() => onSelect(ALL_ROOMS)} />
      {rooms.map((r) => (
        <Badge
          key={r.key}
          label={r.name}
          count={counts.get(r.key) ?? 0}
          title={`${roomLabel(r.room, r.name)} · Floor ${(r.room.row ?? 0) + 1}`}
          active={active === r.key}
          onClick={() => onSelect(r.key)}
        />
      ))}
      {unassignedCount > 0 && (
        <Badge
          label="Unassigned"
          count={unassignedCount}
          active={active === UNASSIGNED}
          muted
          onClick={() => onSelect(UNASSIGNED)}
        />
      )}
    </div>
  );
}
