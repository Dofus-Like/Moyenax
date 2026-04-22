import { SpellResolverService } from './spell-resolver.service';
import { Item, Spell, SpellFamily, ItemType, SpellType, SpellVisualType, SpellEffectKind } from '@prisma/client';

describe('SpellResolverService', () => {
  let service: SpellResolverService;

  beforeEach(() => {
    service = new SpellResolverService();
  });

  const mockSpell = (id: string, code: string, family: SpellFamily, isDefault = false): Spell => ({
    id,
    code,
    name: code,
    description: null,
    paCost: 3,
    minRange: 1,
    maxRange: 3,
    damageMin: 10,
    damageMax: 20,
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family,
    iconPath: null,
    sortOrder: 0,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: null,
    isDefault,
  });

  const mockItem = (id: string, name: string): Item => ({
    id,
    name,
    description: null,
    type: ItemType.WEAPON,
    family: null,
    iconPath: null,
    rank: 1,
    statsBonus: null,
    grantsSpells: null,
    craftCost: null,
    shopPrice: 10,
  });

  const allSpells = [
    mockSpell('claque-id', 'spell-claque', SpellFamily.COMMON, true),
    mockSpell('bond-id', 'spell-bond', SpellFamily.WARRIOR),
    mockSpell('frappe-id', 'spell-frappe', SpellFamily.WARRIOR),
    mockSpell('soin-id', 'spell-soin', SpellFamily.MAGE),
  ];

  it('grants default spells', () => {
    const result = service.resolveSpells([], [allSpells[0]], [], allSpells);
    expect(result['claque-id']).toBe(1);
  });

  it('grants Bond when Sword and Shield are equipped (Combo)', () => {
    const epee = mockItem('epee-id', 'Épée');
    const bouclier = mockItem('bouclier-id', 'Bouclier');
    
    const result = service.resolveSpells([epee, bouclier], [allSpells[0]], [], allSpells);
    
    expect(result['bond-id']).toBe(1);
    expect(result['claque-id']).toBe(1);
  });

  it('grants Warrior spells with +1 level when Full Set is equipped', () => {
    const items = [
        mockItem('h', 'Heaume'),
        mockItem('a', 'Armure'),
        mockItem('b', 'Bottes de fer'),
        mockItem('r', 'Anneau du Guerrier'),
    ];

    const result = service.resolveSpells(items, [allSpells[0]], [], allSpells);
    
    // Warrior spells should be at 1 because they are granted by the set
    expect(result['frappe-id']).toBe(1);
    expect(result['bond-id']).toBe(1);
  });

  it('stacks levels when multiple sources grant the same spell', () => {
    // 1 setup where Bond is granted by COMBO + ITEM_GRANT
    const epee = mockItem('epee-id', 'Épée');
    const bouclier = mockItem('bouclier-id', 'Bouclier');
    const grants = [{ itemId: 'epee-id', spellId: 'bond-id' }];

    const result = service.resolveSpells([epee, bouclier], [], grants, allSpells);
    
    // Bond from combo (1) + Bond from item grant (1) = 2
    expect(result['bond-id']).toBe(2);
  });
});
