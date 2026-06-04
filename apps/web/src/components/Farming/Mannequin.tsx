import React from 'react';

import { assetUrl } from '../../game/constants/assetUrl';
import { useTranslation } from '../../store/language.store';
import './Mannequin.css';

interface EquipmentSlotProps {
  type: string;
  label: string;
  item?: any;
  onDoubleClick?: () => void;
}

const EquipmentSlot = ({ type, label, item, onDoubleClick }: EquipmentSlotProps) => (
  <div 
    className={`equipment-slot slot-${type} ${item ? 'has-item' : 'empty'}`}
    onDoubleClick={onDoubleClick}
  >
    <div className="slot-label-bg">{label}</div>
    {item && (
      <img src={assetUrl(item.iconPath)} alt={item.name} className="slot-icon" />
    )}
  </div>
);

export const Mannequin = ({ 
  equipment = {}, 
  onUnequip 
}: { 
  equipment?: any;
  onUnequip?: (slot: any) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="mannequin-container">

      <div className="mannequin-grid-exact">
        {/* Row 1: Head */}
        <div className="grid-row row-head">
          <EquipmentSlot 
            type="head" 
            label={t('head')}
            item={equipment.head} 
            onDoubleClick={() => onUnequip?.('ARMOR_HEAD')}
          />
        </div>

        {/* Row 2: Hands and Chest */}
        <div className="grid-row row-middle">
          <EquipmentSlot 
            type="weapon" 
            label={t('leftHand')}
            item={equipment.weaponLeft} 
            onDoubleClick={() => onUnequip?.('WEAPON_LEFT')}
          />
          <EquipmentSlot 
            type="chest" 
            label={t('chest')}
            item={equipment.chest} 
            onDoubleClick={() => onUnequip?.('ARMOR_CHEST')}
          />
          <EquipmentSlot 
            type="weapon2" 
            label={t('rightHand')}
            item={equipment.weaponRight} 
            onDoubleClick={() => onUnequip?.('WEAPON_RIGHT')}
          />
        </div>

        {/* Row 3: Legs */}
        <div className="grid-row row-legs">
          <EquipmentSlot 
            type="feet" 
            label="Jambes" 
            item={equipment.feet} 
            onDoubleClick={() => onUnequip?.('ARMOR_LEGS')}
          />
        </div>

        {/* Row 4: Accessory */}
        <div className="grid-row row-accessory">
          <EquipmentSlot 
            type="accessory" 
            label={t('accessory')}
            item={equipment.ring1 || equipment.amulet} 
            onDoubleClick={() => onUnequip?.('ACCESSORY')}
          />
        </div>
      </div>
    </div>
  );
};
