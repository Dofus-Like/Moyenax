import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  SpellFamily,
  SpellEffectKind,
  SpellType,
  SpellVisualType,
  type SpellDefinition,
  type SpellEffectEntry,
} from '@game/shared-types';

import { spellsApi } from '../api/spells.api';

import './SpellCreatorPage.css';

const SPELL_ICONS = [
  '/assets/pack/spells/epee.png',
  '/assets/pack/spells/bond.png',
  '/assets/pack/spells/endurance.png',
  '/assets/pack/spells/fireball.png',
  '/assets/pack/spells/heal.png',
  '/assets/pack/spells/menhir.png',
  '/assets/pack/spells/kunai.png',
  '/assets/pack/spells/bombe.png',
  '/assets/pack/spells/velocite.png',
];

const BASE_EFFECT_KINDS = Object.values(SpellEffectKind).filter((k) => k !== SpellEffectKind.EFFECTS_LIST);
const FAMILIES = Object.values(SpellFamily);
const TYPES = Object.values(SpellType);
const VISUAL_TYPES = Object.values(SpellVisualType);

function emptyForm(): Partial<SpellDefinition> {
  return {
    name: '',
    code: '',
    description: '',
    paCost: 2,
    minRange: 1,
    maxRange: 3,
    damage: { min: 10, max: 20 },
    cooldown: 0,
    type: SpellType.DAMAGE,
    visualType: SpellVisualType.PHYSICAL,
    family: SpellFamily.COMMON,
    iconPath: '',
    sortOrder: 0,
    requiresLineOfSight: true,
    requiresLinearTargeting: false,
    effectKind: SpellEffectKind.DAMAGE_PHYSICAL,
    effectConfig: {},
    isDefault: false,
  };
}

function buildSingleDesc(kind: SpellEffectKind, dmgStr: string, cfg: Record<string, unknown> | undefined): string {
  switch (kind) {
    case SpellEffectKind.DAMAGE_PHYSICAL:
      return dmgStr ? `Inflige ${dmgStr} dégâts physiques.` : '';
    case SpellEffectKind.DAMAGE_MAGICAL:
      return dmgStr ? `Inflige ${dmgStr} dégâts magiques.` : '';
    case SpellEffectKind.HEAL:
      return dmgStr ? `Soigne ${dmgStr} PV.` : '';
    case SpellEffectKind.TELEPORT:
      return 'Téléporte sur la case cible.';
    case SpellEffectKind.SUMMON_MENHIR:
      return 'Invoque un Menhir.';
    case SpellEffectKind.BUFF_VIT_MAX:
      return cfg?.buffValue ? `Donne +${cfg.buffValue} PV max pendant ${cfg.buffDuration ?? '?'} tours.` : 'Augmente la vitalité maximale.';
    case SpellEffectKind.PUSH_LINE:
      return cfg?.pushDistance ? `Repousse la cible de ${cfg.pushDistance} cases.` : 'Repousse la cible.';
    case SpellEffectKind.BUFF_PM:
      return cfg?.buffValue ? `Donne +${cfg.buffValue} PM pendant ${cfg.buffDuration ?? '?'} tour${(cfg.buffDuration as number) > 1 ? 's' : ''}.` : '';
    case SpellEffectKind.BRULURE:
      return cfg?.damagePerTick ? `Brûlure : ${cfg.damagePerTick} dégâts magiques/tour pendant ${cfg.buffDuration ?? '?'} tour${(cfg.buffDuration as number) > 1 ? 's' : ''}.` : 'Inflige une brûlure.';
    case SpellEffectKind.SAIGNEMENT:
      return cfg?.damagePerTick ? `Saignement : ${cfg.damagePerTick} dégâts physiques/tour pendant ${cfg.buffDuration ?? '?'} tour${(cfg.buffDuration as number) > 1 ? 's' : ''}.` : 'Inflige un saignement.';
    case SpellEffectKind.ATTRACTION:
      return cfg?.pushDistance ? `Attire la cible de ${cfg.pushDistance} cases.` : 'Attire la cible.';
    case SpellEffectKind.FAIBLESSE:
      return cfg?.buffValue ? `Faiblesse : -${Math.abs(cfg.buffValue as number)} ATK pendant ${cfg.buffDuration ?? '?'} tours.` : 'Affaiblit l\'attaque.';
    case SpellEffectKind.FRAGILITE:
      return cfg?.buffValue ? `Fragilité : -${Math.abs(cfg.buffValue as number)} DEF pendant ${cfg.buffDuration ?? '?'} tours.` : 'Fragilise la défense.';
    case SpellEffectKind.IGNORANCE:
      return cfg?.buffValue ? `Ignorance : -${Math.abs(cfg.buffValue as number)} MAG pendant ${cfg.buffDuration ?? '?'} tours.` : 'Réduit la magie.';
    case SpellEffectKind.MALEDICTION:
      return cfg?.buffValue ? `Malédiction : -${Math.abs(cfg.buffValue as number)} RES pendant ${cfg.buffDuration ?? '?'} tours.` : 'Invoque une malédiction.';
    case SpellEffectKind.CECITE:
      return cfg?.buffValue ? `Cécité : -${Math.abs(cfg.buffValue as number)} PO pendant ${cfg.buffDuration ?? '?'} tours.` : 'Réduit la portée.';
    case SpellEffectKind.INACTIVITE:
      return cfg?.buffValue ? `Inactivité : -${Math.abs(cfg.buffValue as number)} PA pendant ${cfg.buffDuration ?? '?'} tours.` : 'Réduit les PA.';
    case SpellEffectKind.RALENTISSEMENT:
      return cfg?.buffValue ? `Ralentissement : -${Math.abs(cfg.buffValue as number)} PM pendant ${cfg.buffDuration ?? '?'} tours.` : 'Réduit les PM.';
    case SpellEffectKind.HEMORRAGIE:
      return cfg?.buffValue ? `Hémorragie : -${Math.abs(cfg.buffValue as number)} PV max pendant ${cfg.buffDuration ?? '?'} tours.` : 'Réduit la vitalité maximale.';
    default:
      return '';
  }
}

function buildDescription(f: Partial<SpellDefinition>): string {
  const dmg = f.damage;
  const dmgStr = dmg ? `${dmg.min}-${dmg.max}` : '';
  const cfg = f.effectConfig as Record<string, unknown> | undefined;

  if (f.effectKind === SpellEffectKind.EFFECTS_LIST) {
    const entries = (cfg?.effects as SpellEffectEntry[] | undefined) ?? [];
    return entries
      .map((entry) => buildSingleDesc(entry.kind, dmgStr, { ...entry.config, buffDuration: entry.duration ?? entry.config?.buffDuration } as Record<string, unknown>))
      .filter(Boolean)
      .join(' ');
  }

  return buildSingleDesc(f.effectKind as SpellEffectKind, dmgStr, cfg);
}

function emptyEffect(): SpellEffectEntry {
  return { kind: SpellEffectKind.DAMAGE_PHYSICAL, duration: 1, config: {} };
}

export function SpellCreatorPage(): React.ReactNode {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SpellDefinition>>(emptyForm());
  const [effects, setEffects] = useState<SpellEffectEntry[]>([]);

  const isMulti = form.effectKind === SpellEffectKind.EFFECTS_LIST;

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const setDamage = (key: 'min' | 'max', value: number) =>
    setForm((f) => ({ ...f, damage: { min: f.damage?.min ?? 0, max: f.damage?.max ?? 0, [key]: value } }));

  useEffect(() => {
    const autoDesc = buildDescription(
      isMulti ? { ...form, effectConfig: { effects } } : form,
    );
    if (autoDesc && autoDesc !== form.description) {
      setForm((prev) => ({ ...prev, description: autoDesc }));
    }
  }, [form.effectKind, form.damage?.min, form.damage?.max, isMulti ? effects : form.effectConfig]);

  const { data: spells = [], isLoading } = useQuery({
    queryKey: ['spells'],
    queryFn: () => spellsApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SpellDefinition>) => spellsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spells'] });
      setSelectedId(null);
      setForm(emptyForm());
      setEffects([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SpellDefinition> }) =>
      spellsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spells'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => spellsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spells'] });
      setSelectedId(null);
      setForm(emptyForm());
      setEffects([]);
    },
  });

  const selectSpell = (spell: SpellDefinition) => {
    setSelectedId(spell.id);
    setForm({ ...spell });
    if (spell.effectKind === SpellEffectKind.EFFECTS_LIST) {
      const raw = spell.effectConfig?.effects as SpellEffectEntry[] | undefined;
      setEffects(raw ?? []);
    } else {
      setEffects([]);
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setEffects([]);
  };

  const handleSave = () => {
    let payload: Partial<SpellDefinition>;

    if (isMulti) {
      payload = { ...form, effectKind: SpellEffectKind.EFFECTS_LIST, effectConfig: { effects } };
    } else {
      payload = form;
    }

    if (selectedId) {
      updateMutation.mutate({ id: selectedId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = () => {
    if (selectedId) deleteMutation.mutate(selectedId);
  };

  const addEffect = () => setEffects((prev) => [...prev, emptyEffect()]);

  const removeEffect = (index: number) =>
    setEffects((prev) => prev.filter((_, i) => i !== index));

  const updateEffect = (index: number, patch: Partial<SpellEffectEntry>) =>
    setEffects((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const effectValueLabel = useCallback((kind: SpellEffectKind) => {
    switch (kind) {
      case SpellEffectKind.BUFF_VIT_MAX: return 'PV max';
      case SpellEffectKind.BUFF_PM: return 'PM';
      case SpellEffectKind.PUSH_LINE: return 'Distance';
      default: return 'Valeur';
    }
  }, []);

  return (
    <div className="spell-creator-page">
      <h1>Créateur de Sorts</h1>
      <div className="scp-layout">
        <div className="scp-sidebar">
          <h2>Sorts existants</h2>
          {isLoading ? (
            <div className="scp-empty">Chargement...</div>
          ) : (
            <div className="scp-spell-list">
              {spells.map((spell) => (
                <button
                  key={spell.id}
                  className={`scp-spell-item ${selectedId === spell.id ? 'active' : ''}`}
                  onClick={() => selectSpell(spell)}
                >
                  {spell.name}
                  <span className="scp-si-code">{spell.code}</span>
                </button>
              ))}
            </div>
          )}
          <button className="scp-new-btn" onClick={handleNew}>
            + Nouveau sort
          </button>
        </div>

        <div className="scp-form">
          <h2>{selectedId ? 'Éditer' : 'Nouveau'} sort</h2>
          <div className="scp-form-grid">
            <div className="scp-field">
              <label>Nom</label>
              <input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="scp-field">
              <label>Code</label>
              <input value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="scp-field full-width">
              <label>Description (auto-générée)</label>
              <textarea value={form.description ?? ''} readOnly className="scp-desc-auto" />
            </div>
            <div className="scp-field">
              <label>Coût PA</label>
              <input type="number" min={0} max={12} value={form.paCost ?? 2} onChange={(e) => set('paCost', parseInt(e.target.value) || 0)} />
            </div>
            <div className="scp-field">
              <label>Cooldown (tours)</label>
              <input type="number" min={0} max={10} value={form.cooldown ?? 0} onChange={(e) => set('cooldown', parseInt(e.target.value) || 0)} />
            </div>
            <div className="scp-field">
              <label>Range min</label>
              <input type="number" min={0} max={20} value={form.minRange ?? 1} onChange={(e) => set('minRange', parseInt(e.target.value) || 0)} />
            </div>
            <div className="scp-field">
              <label>Range max</label>
              <input type="number" min={1} max={20} value={form.maxRange ?? 3} onChange={(e) => set('maxRange', parseInt(e.target.value) || 1)} />
            </div>
            <div className="scp-field">
              <label>Dégâts</label>
              <div className="scp-damage-row">
                <input type="number" min={0} max={9999} value={form.damage?.min ?? 0} onChange={(e) => setDamage('min', parseInt(e.target.value) || 0)} />
                <span>→</span>
                <input type="number" min={0} max={9999} value={form.damage?.max ?? 0} onChange={(e) => setDamage('max', parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="scp-field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="scp-field">
              <label>Visual</label>
              <select value={form.visualType} onChange={(e) => set('visualType', e.target.value)}>
                {VISUAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="scp-field">
              <label>Famille</label>
              <select value={form.family} onChange={(e) => set('family', e.target.value)}>
                {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="scp-field">
              <label>Effet</label>
              <select value={form.effectKind} onChange={(e) => { set('effectKind', e.target.value); if (e.target.value !== SpellEffectKind.EFFECTS_LIST) setEffects([]); }}>
                {Object.values(SpellEffectKind).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="scp-field">
              <label>LOS requise</label>
              <select value={form.requiresLineOfSight ? 'true' : 'false'} onChange={(e) => set('requiresLineOfSight', e.target.value === 'true')}>
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            </div>
            <div className="scp-field">
              <label>Tir linéaire</label>
              <select value={form.requiresLinearTargeting ? 'true' : 'false'} onChange={(e) => set('requiresLinearTargeting', e.target.value === 'true')}>
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </select>
            </div>
            <div className="scp-field full-width">
              <label>Icône</label>
              <div className="scp-icon-grid">
                {SPELL_ICONS.map((icon) => (
                  <button
                    key={icon}
                    className={`scp-icon-btn ${form.iconPath === icon ? 'selected' : ''}`}
                    onClick={() => set('iconPath', icon === form.iconPath ? '' : icon)}
                  >
                    <img src={icon} alt="" />
                  </button>
                ))}
              </div>
            </div>
            <div className="scp-field">
              <label>Accessible à tous</label>
              <select value={form.isDefault ? 'true' : 'false'} onChange={(e) => set('isDefault', e.target.value === 'true')}>
                <option value="false">Non</option>
                <option value="true">Oui (classe par défaut)</option>
              </select>
            </div>

            {!isMulti && (
              <div className="scp-field full-width">
                <label>Effect config (JSON)</label>
                <textarea
                  value={JSON.stringify(form.effectConfig ?? {}, null, 2)}
                  onChange={(e) => {
                    try { set('effectConfig', JSON.parse(e.target.value)); }
                    catch { /* ignore invalid JSON while typing */ }
                  }}
                />
              </div>
            )}
          </div>

          {isMulti && (
            <div className="scp-effects-section">
              <h3>Effets multiples</h3>
              {effects.map((effect, i) => (
                <div key={i} className="scp-effect-row">
                  <select
                    value={effect.kind}
                    onChange={(e) => updateEffect(i, { kind: e.target.value as SpellEffectKind })}
                  >
                    {BASE_EFFECT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>

                  <label className="scp-eff-label">Durée</label>
                  <input
                    type="number" min={1} max={99} className="scp-eff-duration"
                    value={effect.duration ?? 1}
                    onChange={(e) => updateEffect(i, { duration: parseInt(e.target.value) || 1 })}
                  />

                  {[SpellEffectKind.BUFF_VIT_MAX, SpellEffectKind.BUFF_PM, SpellEffectKind.PUSH_LINE].includes(effect.kind) && (
                    <>
                      <label className="scp-eff-label">{effectValueLabel(effect.kind)}</label>
                      <input
                        type="number" min={0} max={999} className="scp-eff-value"
                        value={(effect.config?.buffValue ?? effect.config?.pushDistance ?? 0) as number}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          const key = effect.kind === SpellEffectKind.PUSH_LINE ? 'pushDistance' : 'buffValue';
                          updateEffect(i, { config: { ...effect.config, [key]: val } });
                        }}
                      />
                    </>
                  )}

                  <button className="scp-eff-remove" onClick={() => removeEffect(i)}>✕</button>
                </div>
              ))}
              <button className="scp-btn-add-effect" onClick={addEffect}>
                + Ajouter un effet
              </button>
            </div>
          )}

          <div className="scp-form-actions">
            {selectedId && (
              <button className="scp-btn-delete" onClick={handleDelete} disabled={deleteMutation.isPending}>
                Supprimer
              </button>
            )}
            <button className="scp-btn-cancel" onClick={handleNew}>
              Annuler
            </button>
            <button className="scp-btn-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
