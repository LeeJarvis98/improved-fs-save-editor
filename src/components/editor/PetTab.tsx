import { useEffect, useRef, useState } from 'react';
import { loadPetIndex } from '../../lib/petIndex';
import { SpriteCrop } from '../SpriteCrop';
import { setPet, clearPet } from '../../lib/dwellerEdit';
import { useSaveStore } from '../../store/saveStore';
import type { PetIndex, PetMeta } from '../../types/pets';
import type { IconRect } from '../../types/icons';
import type { EquipRef } from '../../types/save';
import type { RenderableDweller } from '../../lib/dwellerRender';
import { SortFilterBar } from './SortFilterBar';
import { filterByText } from '../../lib/pickerSort';
import { type Rarity } from '../../lib/petRarity';
import { UnknownItemCard } from './UnknownItemCard';
import { fluidGridStyle, fluidTileStyle } from './fluidGrid';
import { useUnknownItemGuard } from './UnknownItemModal';
import { useFavorites, pinFavorites } from '../../lib/useFavorites';
import { FavoriteToggle } from './FavoriteToggle';
import { requestGearChange } from './GearSwapDialog';
import { useGearSource, useStashGear } from '../../lib/useStashGear';
import { describeStashItem, type ItemCatalogs } from '../StashItemInfo';
import { StashCornerChip } from './StashCornerChip';
import { StashViewHeader } from './StashViewHeader';

const RARITY_ORDER: Record<string, number> = { Normal: 0, Rare: 1, Legendary: 2 };

const tileClass = (selected: boolean) => [
  'group relative rounded border flex flex-col items-center overflow-hidden transition-colors',
  selected ? 'border-green-400 bg-green-950/40 ring-1 ring-green-400' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500',
].join(' ');

function PetTile({ name, icon, rarity, bonus, selected, onClick, title, children }: {
  name: string;
  icon?: IconRect | null;
  rarity?: string;
  bonus?: string;
  selected: boolean;
  onClick: () => void;
  title?: string;
  /** Corner overlays (favorite marker, stash count, …). */
  children?: React.ReactNode;
}) {
  return (
    <button
      title={title ?? name}
      aria-pressed={selected}
      data-selected={selected || undefined}
      onClick={onClick}
      className={tileClass(selected)}
      style={fluidTileStyle(170, 170)}
    >
      {children}
      <div className="flex-1 flex items-center justify-center w-full">
        {icon ? <SpriteCrop rect={icon} size={104} title={name} /> : <div className="w-16 h-16" />}
      </div>
      <div className="w-full px-1 pb-1 text-center leading-tight">
        <div className="text-xs font-medium text-zinc-100 truncate">{name}</div>
        {rarity && <div className="text-[11px] text-zinc-400">{rarity}</div>}
        {bonus && <div className="text-[11px] text-zinc-400 truncate" title={bonus}>{bonus}</div>}
      </div>
    </button>
  );
}

export function PetTab({ dweller: _dweller }: { dweller: RenderableDweller }) {
  const [petIndex, setPetIndex] = useState<PetIndex | null>(null);
  const unmounted = useRef(false);

  const equippedPet = useSaveStore((s) =>
    (s.getSelectedDweller() as { equippedPet?: EquipRef } | null)?.equippedPet);
  const equippedId = equippedPet?.id;
  const equipFromStash = useSaveStore((s) => s.equipSelectedFromStash);

  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [source, setSource] = useGearSource('pet');
  const stash = useStashGear('Pet');

  useEffect(() => {
    unmounted.current = false;
    loadPetIndex().then((idx) => { if (!unmounted.current) setPetIndex(idx); });
    return () => { unmounted.current = true; };
  }, []);

  // The equipped pet is unknown when its id isn't in our catalog. Computed before
  // any early return so the hook order stays stable (known while loading).
  const known = !petIndex || !equippedId || equippedId in petIndex.pets;
  const { isUnknown, openInfo, guardSelect, modal } = useUnknownItemGuard(equippedId, known);
  const { favorites, toggle } = useFavorites('pet');

  if (!petIndex) return <div className="text-zinc-400 text-sm">Loading pets…</div>;

  const catalogs: ItemCatalogs = { pets: petIndex, weapons: null, sprites: null };
  const change = (fn: Parameters<typeof requestGearChange>[0]) => guardSelect(() => requestGearChange(fn));

  const pets: PetMeta[] = Object.values(petIndex.pets).sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      a.breed.localeCompare(b.breed) ||
      (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0),
  );

  const byRarity = rarity ? pets.filter((p) => p.rarity === rarity) : pets;
  const visible = filterByText(byRarity, query, (p) => `${p.name} ${p.bonus} ${p.bonusLabel} ${p.rarity}`);
  // Mirrors OptionGrid/WeaponTab's favorites pattern: pin favorites to front.
  // Each cell must keep `relative` + `group` classes for the FavoriteToggle marker.
  const ordered = pinFavorites(visible, (p) => p.id, favorites);

  // Stashed pets keep their own name and bonus (extraData), so show those
  // rather than the catalog defaults.
  const stashed = stash.groups
    .map((g) => {
      const meta = petIndex.pets[g.item.id];
      const display = describeStashItem(g.item, catalogs);
      return { group: g, meta, name: display.name, bonus: String(display.detail ?? '') };
    })
    .filter((p) => !rarity || p.meta?.rarity === rarity);
  const stashMatches = filterByText(stashed, query, (p) => `${p.name} ${p.bonus} ${p.meta?.rarity ?? ''}`);

  const equippedDisplay = equippedPet ? describeStashItem(equippedPet, catalogs) : null;

  return (
    <div>
      <SortFilterBar
        mode="pet"
        query={query}
        onQueryChange={setQuery}
        onReset={() => { setQuery(''); setRarity(null); }}
        rarity={rarity}
        onRarityChange={setRarity}
        source={source}
        onSourceChange={setSource}
        stashCount={stash.count}
      />
      {source === 'global' ? (
        <div className="grid gap-1.5 p-1" style={fluidGridStyle(170, 0.9)}>
          {/* Unknown equipped pet — pinned warning card (preserved on export). */}
          {isUnknown && equippedId && (
            <UnknownItemCard id={equippedId} onWarn={openInfo} />
          )}
          {/* None card — clears the pet (pinned to the front). */}
          <button
            key="__none__"
            title="No pet"
            aria-pressed={!equippedId}
            onClick={() => change((d) => clearPet(d))}
            className={[
              'rounded border flex flex-col items-center justify-center overflow-hidden transition-colors',
              !equippedId ? 'border-green-400 bg-green-950/40 ring-1 ring-green-400' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500',
            ].join(' ')}
            style={fluidTileStyle(170, 170)}
          >
            <span className="text-sm text-zinc-300">None</span>
          </button>

          {ordered.map((pet) => {
            const inStash = stash.countById.get(pet.id) ?? 0;
            return (
              <PetTile
                key={pet.id}
                name={pet.name}
                icon={pet.icon}
                rarity={pet.rarity}
                bonus={pet.bonusLabel}
                selected={pet.id === equippedId}
                onClick={() => change((d) => setPet(d, pet))}
                title={inStash
                  ? `${pet.name} (${pet.rarity}; ${inStash} in stash; picking it here adds a new one)`
                  : `${pet.name} (${pet.rarity})`}
              >
                {inStash > 0 && <StashCornerChip>In stash ×{inStash}</StashCornerChip>}
                <FavoriteToggle active={favorites.includes(pet.id)} onToggle={() => toggle(pet.id)} />
              </PetTile>
            );
          })}
        </div>
      ) : (
        <>
          <StashViewHeader
            name={equippedDisplay?.name ?? 'No pet'}
            icon={equippedDisplay?.icon && <SpriteCrop rect={equippedDisplay.icon} size={44} />}
            detail={equippedDisplay?.detail}
            warning={isUnknown ? 'Not recognized by this editor' : undefined}
            onUnequip={equippedPet ? () => change((d) => clearPet(d)) : undefined}
          />
          {stashMatches.length === 0 ? (
            <div className="px-2 py-2 text-sm text-zinc-500">
              {stash.count === 0 ? 'No pets in the stash.' : 'No stashed pets match.'}
            </div>
          ) : (
            <div className="grid gap-1.5 p-1" style={fluidGridStyle(170, 0.9)}>
              {stashMatches.map((p) => (
                <PetTile
                  key={p.group.key}
                  name={p.name}
                  icon={p.meta?.icon}
                  rarity={p.meta?.rarity}
                  bonus={p.bonus}
                  selected={false}
                  onClick={() => equipFromStash(p.group.indices[0])}
                  title={`Equip ${p.name} from the stash (swaps with the equipped pet)`}
                >
                  <StashCornerChip count={p.group.indices.length} />
                </PetTile>
              ))}
            </div>
          )}
        </>
      )}
      {modal}
    </div>
  );
}
