import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import type { CombatState, ItemDefinition } from '@game/shared-types';
import { EquipmentSlotType, ItemType } from '@game/shared-types';

import { equipmentApi } from '../../api/equipment.api';
import { itemsApi } from '../../api/items.api';
import { playgroundApi } from '../../api/playground.api';
import { useCombatStore } from '../../store/combat.store';

import './Playground.css';

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
  const [busy, setBusy] = useState(false);

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
    try {
      const { data } = await playgroundApi.grantEquip(sessionId, { itemId: item.id, slot });
      await apply(data);
    } finally {
      setBusy(false);
    }
  };

  const handleUnequip = async (slot: EquipmentSlotType) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await playgroundApi.unequip(sessionId, { slot });
      await apply(data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`pg-panel pg-panel--right${busy ? ' pg-busy' : ''}`}>
      <h3 className="pg-title">🎒 Équipement</h3>
      <p className="pg-hint">Équipe gratuitement n'importe quel objet — stats et sorts en direct. Une arme par main.</p>

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
