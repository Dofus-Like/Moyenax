import type { InventoryItem } from '@game/shared-types';
import { EquipmentSlotType } from '@game/shared-types';

import { useTranslation } from '../store/language.store';
import './Mannequin.css';



interface MannequinProps {
  equipment: Record<EquipmentSlotType, InventoryItem | null>;
  onEquip: (slot: EquipmentSlotType, inventoryItemId: string) => void;
  onUnequip: (slot: EquipmentSlotType) => void;
}

export const Mannequin: React.FC<MannequinProps> = ({ equipment, onEquip, onUnequip }) => {
  const { t } = useTranslation();
  const slots = [
    { type: EquipmentSlotType.ARMOR_HEAD, label: t('head'), className: 'slot-head' },
    { type: EquipmentSlotType.ARMOR_CHEST, label: t('chest'), className: 'slot-chest' },
    { type: EquipmentSlotType.ARMOR_LEGS, label: t('legs'), className: 'slot-legs' },
    { type: EquipmentSlotType.WEAPON_LEFT, label: t('leftHand'), className: 'slot-weapon-left' },
    { type: EquipmentSlotType.WEAPON_RIGHT, label: t('rightHand'), className: 'slot-weapon-right' },
    { type: EquipmentSlotType.ACCESSORY, label: t('accessory'), className: 'slot-accessory' },
  ];

  const handleDrop = (e: React.DragEvent, slot: EquipmentSlotType) => {
    e.preventDefault();
    const inventoryItemId = e.dataTransfer.getData('inventoryItemId');
    if (inventoryItemId) {
      onEquip(slot, inventoryItemId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragStart = (e: React.DragEvent, slot: EquipmentSlotType) => {
    e.dataTransfer.setData('unequipSlot', slot);
  };

  return (
    <div className="mannequin-wrapper">
      <div className="mannequin-grid">
        {slots.map((s) => (
          <div
            key={s.type}
            className={`equipment-slot ${s.className} ${equipment[s.type] ? 'filled' : 'empty'}`}
            onDrop={(e) => handleDrop(e, s.type)}
            onDragOver={handleDragOver}
            onDoubleClick={() => equipment[s.type] && onUnequip(s.type)}
          >

            <span className="slot-label">{s.label}</span>
            {equipment[s.type] && (
              <div 
                className="equipped-item"
                draggable
                onDragStart={(e) => handleDragStart(e, s.type)}
              >
                <span className="item-name">{equipment[s.type]?.item.name}</span>
              </div>
            )}
          </div>
        ))}
        <div className="mannequin-silhouette" />

      </div>
    </div>
  );
};
