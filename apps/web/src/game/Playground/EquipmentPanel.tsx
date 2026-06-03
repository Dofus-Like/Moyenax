import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import type { CombatState, ItemDefinition, PlayerStats } from '@game/shared-types';
import { EquipmentSlotType, ItemType } from '@game/shared-types';

import { equipmentApi } from '../../api/equipment.api';
import { itemsApi } from '../../api/items.api';
import { playgroundApi } from '../../api/playground.api';
import { useAuthStore } from '../../store/auth.store';
import { useCombatStore } from '../../store/combat.store';

import './Playground.css';

const ALL_SLOTS = Object.values(EquipmentSlotType);
const STAT_KEYS: Array<keyof PlayerStats> = ['vit', 'atk', 'mag', 'def', 'res', 'pa', 'pm', 'ini'];
const PRESETS_KEY = 'pg-build-presets';

type BuildPreset = Partial<Record<EquipmentSlotType, string | null>>;

function loadPresets(): Record<string, BuildPreset> {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '{}') as Record<string, BuildPreset>;
  } catch {
    return {};
  }
}

function statDiff(before: PlayerStats | undefined, after: PlayerStats | undefined) {
  if (!before || !after) return [];
  return STAT_KEYS.map((k) => ({ key: k, delta: after[k] - before[k] })).filter((d) => d.delta !== 0);
}

// Une arme peut aller dans chaque main ; les autres types n'ont qu'un slot.
const SLOTS_BY_TYPE: Partial<Record<ItemType, EquipmentSlotType[]>> = {
  [ItemType.WEAPON]: [EquipmentSlotType.WEAPON_RIGHT, EquipmentSlotType.WEAPON_LEFT],
  [ItemType.ARMOR_HEAD]: [EquipmentSlotType.ARMOR_HEAD],
  [ItemType.ARMOR_CHEST]: [EquipmentSlotType.ARMOR_CHEST],
  [ItemType.ARMOR_LEGS]: [EquipmentSlotType.ARMOR_LEGS],
  [ItemType.ACCESSORY]: [EquipmentSlotType.ACCESSORY],
};

const SLOT_HAND_LABEL: Partial<Record<EquipmentSlotType, string>> = {
  [EquipmentSlotType.WEAPON_RIGHT]: 'Droite',
  [EquipmentSlotType.WEAPON_LEFT]: 'Gauche',
};

const GROUP_ORDER: ItemType[] = [
  ItemType.WEAPON,
  ItemType.ARMOR_HEAD,
  ItemType.ARMOR_CHEST,
  ItemType.ARMOR_LEGS,
  ItemType.ACCESSORY,
];

const GROUP_LABELS: Record<string, string> = {
  [ItemType.WEAPON]: 'Armes (une par main)',
  [ItemType.ARMOR_HEAD]: 'Tête',
  [ItemType.ARMOR_CHEST]: 'Torse',
  [ItemType.ARMOR_LEGS]: 'Jambes',
  [ItemType.ACCESSORY]: 'Anneaux',
};

type EquipmentBySlot = Partial<Record<EquipmentSlotType, { itemId: string } | null>>;

interface EquipmentPanelProps {
  sessionId: string;
}

export function EquipmentPanel({ sessionId }: EquipmentPanelProps) {
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const combatState = useCombatStore((s) => s.combatState);
  const user = useAuthStore((s) => s.player);
  const userId = user?.id ?? (user as { _id?: string } | null)?._id ?? undefined;
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<Array<{ key: string; delta: number }>>([]);
  const [presets, setPresets] = useState<Record<string, BuildPreset>>(loadPresets);
  const diffTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const myStats = () => (userId ? combatState?.players?.[userId]?.stats : undefined);

  const showDiff = (before: PlayerStats | undefined, after: PlayerStats | undefined) => {
    const d = statDiff(before, after);
    setDiff(d);
    clearTimeout(diffTimer.current);
    if (d.length > 0) diffTimer.current = setTimeout(() => setDiff([]), 4000);
  };

  const { data: items = [] } = useQuery({
    queryKey: ['playground', 'items'],
    queryFn: async () => (await itemsApi.getAll()).data as ItemDefinition[],
  });

  const { data: equipment, refetch: refetchEquipment } = useQuery({
    queryKey: ['playground', 'equipment'],
    queryFn: async () => (await equipmentApi.getEquipment()).data as EquipmentBySlot,
  });

  const groups = useMemo(() => {
    const equippable = items.filter((it) => SLOTS_BY_TYPE[it.type]);
    return GROUP_ORDER.map((type) => ({
      type,
      label: GROUP_LABELS[type],
      items: equippable.filter((it) => it.type === type),
    })).filter((g) => g.items.length > 0);
  }, [items]);

  const apply = async (state: CombatState) => {
    setCombatState(state);
    await refetchEquipment();
  };

  const handleEquip = async (item: ItemDefinition, slot: EquipmentSlotType) => {
    if (busy) return;
    setBusy(true);
    const before = myStats();
    try {
      const { data } = await playgroundApi.grantEquip(sessionId, { itemId: item.id, slot });
      await apply(data);
      showDiff(before, userId ? data.players[userId]?.stats : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleUnequip = async (slot: EquipmentSlotType) => {
    if (busy) return;
    setBusy(true);
    const before = myStats();
    try {
      const { data } = await playgroundApi.unequip(sessionId, { slot });
      await apply(data);
      showDiff(before, userId ? data.players[userId]?.stats : undefined);
    } finally {
      setBusy(false);
    }
  };

  const savePreset = () => {
    const name = window.prompt('Nom du preset de build ?')?.trim();
    if (!name) return;
    const build: BuildPreset = {};
    for (const slot of ALL_SLOTS) build[slot] = equipment?.[slot]?.itemId ?? null;
    const next = { ...presets, [name]: build };
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    setPresets(next);
  };

  const deletePreset = (name: string) => {
    const next = { ...presets };
    delete next[name];
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    setPresets(next);
  };

  const loadPreset = async (name: string) => {
    if (busy) return;
    const build = presets[name];
    if (!build) return;
    setBusy(true);
    const before = myStats();
    let last: CombatState | undefined;
    try {
      for (const slot of ALL_SLOTS) {
        const target = build[slot] ?? null;
        const current = equipment?.[slot]?.itemId ?? null;
        if (target === current) continue;
        last = target
          ? (await playgroundApi.grantEquip(sessionId, { itemId: target, slot })).data
          : (await playgroundApi.unequip(sessionId, { slot })).data;
      }
      if (last) {
        await apply(last);
        showDiff(before, userId ? last.players[userId]?.stats : undefined);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`pg-panel${busy ? ' pg-busy' : ''}`}>
      <h3 className="pg-title">🎒 Équipement</h3>
      <p className="pg-hint">Équipe gratuitement n'importe quel objet — stats et sorts en direct. Une arme par main.</p>

      {diff.length > 0 && (
        <div className="pg-diff">
          {diff.map((d) => (
            <span key={d.key} className={d.delta > 0 ? 'pg-diff-up' : 'pg-diff-down'}>
              {d.key.toUpperCase()} {d.delta > 0 ? '+' : ''}{d.delta}
            </span>
          ))}
        </div>
      )}

      <div className="pg-presets">
        <div className="pg-meter-head">
          <p className="pg-subtitle" style={{ margin: 0 }}>Builds</p>
          <button type="button" className="pg-mini-btn" onClick={savePreset}>💾 Sauver</button>
        </div>
        {Object.keys(presets).length > 0 && (
          <div className="pg-preset-list">
            {Object.keys(presets).map((name) => (
              <div key={name} className="pg-preset-row">
                <button type="button" className="pg-preset-load" onClick={() => loadPreset(name)}>
                  {name}
                </button>
                <button type="button" className="pg-unequip" onClick={() => deletePreset(name)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {groups.map((group) => (
        <div key={group.type} className="pg-equip-group">
          <p className="pg-subtitle">{group.label}</p>
          {group.items.map((item) => {
            const slots = SLOTS_BY_TYPE[item.type] ?? [];
            const dualWield = slots.length > 1;
            return (
              <div key={item.id} className="pg-item-row">
                <span className="pg-item-name">{item.name}</span>
                <div className="pg-item-actions">
                  {slots.map((slot) => {
                    const equippedHere = equipment?.[slot]?.itemId === item.id;
                    const hand = SLOT_HAND_LABEL[slot];
                    let label: string;
                    if (equippedHere) label = dualWield ? `✕ ${hand}` : '✕';
                    else label = dualWield ? (hand ?? '') : 'Équiper';
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`pg-slot-btn${equippedHere ? ' is-equipped' : ''}`}
                        onClick={() => (equippedHere ? handleUnequip(slot) : handleEquip(item, slot))}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
