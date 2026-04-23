import { EquipmentSlotType, InventoryItem } from '@game/shared-types';
import mannequinBg from '../assets/mannequin-bg.gif';
import { getItemVisualMeta } from '../utils/itemVisual';
import './Mannequin.css';

interface MannequinProps {
  equipment: Record<EquipmentSlotType, InventoryItem | null>;
  onEquip: (slot: EquipmentSlotType, inventoryItemId: string) => void;
  onUnequip: (slot: EquipmentSlotType) => void;
}

export const Mannequin: React.FC<MannequinProps> = ({ equipment, onEquip, onUnequip }) => {
  const slots = [
    { type: EquipmentSlotType.ARMOR_HEAD, label: 'Tête', className: 'slot-head' },
    { type: EquipmentSlotType.ARMOR_CHEST, label: 'Torse', className: 'slot-chest' },
    { type: EquipmentSlotType.ARMOR_LEGS, label: 'Jambes', className: 'slot-legs' },
    { type: EquipmentSlotType.WEAPON_LEFT, label: 'Main Gauche', className: 'slot-weapon-left' },
    { type: EquipmentSlotType.WEAPON_RIGHT, label: 'Main Droite', className: 'slot-weapon-right' },
    { type: EquipmentSlotType.ACCESSORY, label: 'Accessoire', className: 'slot-accessory' },
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
        {slots.map((s) => {
          const equipped = equipment[s.type];
          const visual = equipped ? getItemVisualMeta(equipped.item) : null;
          
          return (
            <div key={s.type} className={`slot-wrapper ${s.className}`}>
              <span className="slot-label">{s.label}</span>
              <div
                className={`equipment-slot ${equipped ? 'filled' : 'empty'}`}
                onDrop={(e) => handleDrop(e, s.type)}
                onDragOver={handleDragOver}
                onDoubleClick={() => equipped && onUnequip(s.type)}
              >
                {equipped && visual && (
                  <div 
                    className="equipped-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, s.type)}
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {visual.iconPath ? (
                      <img 
                        src={visual.iconPath} 
                        alt={equipped.item.name} 
                        style={{ width: '80%', height: '80%', objectFit: 'contain' }} 
                      />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>{visual.icon}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="mannequin-silhouette">
          <img src={mannequinBg} alt="Silhouette" />
        </div>
      </div>
    </div>
  );
};
