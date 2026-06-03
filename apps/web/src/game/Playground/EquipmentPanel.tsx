import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { CombatState, ItemDefinition } from '@game/shared-types';
import { EquipmentSlotType, ItemType } from '@game/shared-types';

import { itemsApi } from '../../api/items.api';
import { playgroundApi } from '../../api/playground.api';
import { useAuthStore } from '../../store/auth.store';
import { useCombatStore } from '../../store/combat.store';

import './Playground.css';

const SLOT_BY_TYPE: Partial<Record<ItemType, EquipmentSlotType>> = {
  [ItemType.WEAPON]: EquipmentSlotType.WEAPON_RIGHT,
  [ItemType.ARMOR_HEAD]: EquipmentSlotType.ARMOR_HEAD,
  [ItemType.ARMOR_CHEST]: EquipmentSlotType.ARMOR_CHEST,
  [ItemType.ARMOR_LEGS]: EquipmentSlotType.ARMOR_LEGS,
  [ItemType.ACCESSORY]: EquipmentSlotType.ACCESSORY,
};

const GROUP_ORDER: ItemType[] = [
  ItemType.WEAPON,
  ItemType.ARMOR_HEAD,
  ItemType.ARMOR_CHEST,
  ItemType.ARMOR_LEGS,
  ItemType.ACCESSORY,
];

const GROUP_LABELS: Record<string, string> = {
  [ItemType.WEAPON]: 'Armes',
  [ItemType.ARMOR_HEAD]: 'Tête',
  [ItemType.ARMOR_CHEST]: 'Torse',
  [ItemType.ARMOR_LEGS]: 'Jambes',
  [ItemType.ACCESSORY]: 'Anneaux',
};

interface EquipmentPanelProps {
  sessionId: string;
}

export function EquipmentPanel({ sessionId }: EquipmentPanelProps) {
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const combatState = useCombatStore((s) => s.combatState);
  const user = useAuthStore((s) => s.player);
  const userId = user?.id ?? (user as { _id?: string } | null)?._id ?? undefined;
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ['playground', 'items'],
    queryFn: async () => (await itemsApi.getAll()).data as ItemDefinition[],
  });

  const equippedIds = useMemo(() => {
    const self = userId ? combatState?.players?.[userId] : undefined;
    const list = (self?.items ?? []) as { id: string }[];
    return new Set(list.map((it) => it.id));
  }, [combatState, userId]);

  const groups = useMemo(() => {
    const equippable = items.filter((it) => SLOT_BY_TYPE[it.type]);
    return GROUP_ORDER.map((type) => ({
      type,
      label: GROUP_LABELS[type],
      items: equippable.filter((it) => it.type === type),
    })).filter((g) => g.items.length > 0);
  }, [items]);

  const applyState = (state: CombatState) => setCombatState(state);

  const handleEquip = async (item: ItemDefinition) => {
    const slot = SLOT_BY_TYPE[item.type];
    if (!slot || busy) return;
    setBusy(true);
    try {
      const { data } = await playgroundApi.grantEquip(sessionId, { itemId: item.id, slot });
      applyState(data);
    } finally {
      setBusy(false);
    }
  };

  const handleUnequip = async (item: ItemDefinition) => {
    const slot = SLOT_BY_TYPE[item.type];
    if (!slot || busy) return;
    setBusy(true);
    try {
      const { data } = await playgroundApi.unequip(sessionId, { slot });
      applyState(data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`pg-panel pg-panel--right${busy ? ' pg-busy' : ''}`}>
      <h3 className="pg-title">🎒 Équipement</h3>
      <p className="pg-hint">Équipe gratuitement n'importe quel objet — stats et sorts se mettent à jour en direct.</p>

      {groups.map((group) => (
        <div key={group.type} className="pg-equip-group">
          <p className="pg-subtitle">{group.label}</p>
          {group.items.map((item) => {
            const equipped = equippedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`pg-item-btn${equipped ? ' is-equipped' : ''}`}
                onClick={() => (equipped ? handleUnequip(item) : handleEquip(item))}
              >
                <span>{item.name}</span>
                {equipped ? (
                  <span className="pg-unequip">✕</span>
                ) : (
                  <span className="pg-item-rank">rang {item.rank}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
