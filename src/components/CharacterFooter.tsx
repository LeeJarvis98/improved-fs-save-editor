import { useRef, useState, useEffect, useMemo } from 'react';
import { useSaveStore } from '../store/saveStore';
import { CharacterCard, cardMetrics } from './CharacterCard';
import { useViewportHeight } from '../lib/useViewportHeight';
import { useWindowedRange } from '../lib/useWindowedRange';
import { filterByText } from '../lib/pickerSort';
import { buildRoomAssignments, getOccupiedRooms } from '../lib/rooms';
import { RoomFilterBar, ALL_ROOMS, UNASSIGNED } from './RoomFilterBar';

const OVERSCAN = 3;

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CharacterFooter() {
  const save = useSaveStore((s) => s.save);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Focus the field as it expands.
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const [roomFilter, setRoomFilter] = useState<string>(ALL_ROOMS);

  const all = save?.dwellers.dwellers ?? [];
  const { rooms, assignments, counts } = useMemo(() => {
    const assignments = buildRoomAssignments(save);
    const counts = new Map<string, number>();
    for (const d of save?.dwellers.dwellers ?? []) {
      const entry = assignments.get(d.serializeId);
      if (entry) counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
    }
    const rooms = getOccupiedRooms(save).filter((r) => counts.has(r.key));
    return { rooms, assignments, counts };
  }, [save]);
  const unassignedCount = all.filter((d) => !assignments.has(d.serializeId)).length;

  // Fall back to "All rooms" when the selected room empties out (e.g. after an eviction).
  const activeRoom =
    roomFilter === ALL_ROOMS || (roomFilter === UNASSIGNED && unassignedCount > 0) || counts.has(roomFilter)
      ? roomFilter
      : ALL_ROOMS;
  const inRoom = activeRoom === ALL_ROOMS
    ? all
    : all.filter((d) => {
        const entry = assignments.get(d.serializeId);
        return activeRoom === UNASSIGNED ? !entry : entry?.key === activeRoom;
      });
  const dwellers = filterByText(inRoom, query, (d) => {
    const entry = assignments.get(d.serializeId);
    return `${d.name ?? ''} ${d.lastName ?? ''} ${entry ? entry.name : 'unassigned'}`;
  });

  const selectRoom = (key: string) => {
    setRoomFilter(key);
    scrollRef.current?.scrollTo({ left: 0 });
  };
  const count = dwellers.length;

  const metrics = cardMetrics(useViewportHeight());
  const { start, end } = useWindowedRange(scrollRef, metrics.slot, count, OVERSCAN);

  if (!save) return null;

  return (
    <div className="shrink-0 relative">
      {/* Filter control: one solid fallout-green bar attached above the dweller
          bar. The funnel toggles a search field that grows to the left; the
          field and button share the same continuous green background. */}
      <div className="absolute right-3 -top-8 z-20 flex items-stretch h-8 rounded-t-md overflow-hidden bg-zinc-700">
        {/* Expanding search field (grows to the left); clipped to 0 when closed */}
        <div
          className={[
            'flex items-center overflow-hidden transition-all duration-200 ease-out',
            open ? 'w-56' : 'w-0',
          ].join(' ')}
        >
          <SearchIcon className="w-4 h-4 ml-2.5 shrink-0 text-zinc-300" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or room…"
            aria-label="Filter dwellers by name or room"
            tabIndex={open ? 0 : -1}
            className="flex-1 min-w-0 h-8 bg-transparent px-2 text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear text"
              className="shrink-0 mr-1 flex items-center justify-center w-5 h-5 rounded text-zinc-300 hover:bg-black/20"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Funnel handle */}
        <button
          type="button"
          onClick={() => { if (open) { setQuery(''); setOpen(false); } else setOpen(true); }}
          title={open ? 'Close filter' : 'Filter dwellers'}
          aria-label={open ? 'Close filter' : 'Filter dwellers'}
          aria-pressed={open}
          className="shrink-0 flex items-center justify-center w-9 text-zinc-200 hover:bg-black/20 transition-colors"
        >
          <FilterIcon className="w-4 h-4" />
        </button>
      </div>

      <RoomFilterBar
        rooms={rooms}
        counts={counts}
        total={all.length}
        unassignedCount={unassignedCount}
        active={activeRoom}
        onSelect={selectRoom}
      />

      <div
        ref={scrollRef}
        className="bg-zinc-900 border-t border-zinc-800 overflow-x-auto overflow-y-hidden"
        style={{ position: 'relative', height: metrics.strip }}
      >
        {count === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            {query ? <>No dwellers match “{query}”.</> : 'No dwellers in this room.'}
          </div>
        ) : (
          /* Inner spacer to give the scrollbar the correct total width */
          <div style={{ width: count * metrics.slot, height: '100%', position: 'relative' }}>
            {dwellers.slice(start, end).map((dweller, localIdx) => {
              const globalIdx = start + localIdx;
              return (
                <div
                  key={dweller.serializeId}
                  style={{ position: 'absolute', left: globalIdx * metrics.slot + metrics.gap / 2, top: 8, height: 'calc(100% - 16px)' }}
                >
                  <CharacterCard dweller={dweller} room={assignments.get(dweller.serializeId) ?? null} metrics={metrics} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
