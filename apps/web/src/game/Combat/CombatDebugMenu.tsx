import React, { useMemo, useEffect } from 'react';
import { useControls, folder, button } from 'leva';
import { useCombatStore } from '../../store/combat.store';
import { useAuthStore } from '../../store/auth.store';
import { COMBAT_COLORS } from '../constants/colors';

/**
 * Helper to convert hex to RGB triplet "r g b"
 */
function hexToRgbTriplet(hex: string): string | null {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
    if (!match) return null;
    return `${parseInt(match[1], 16)} ${parseInt(match[2], 16)} ${parseInt(match[3], 16)}`;
}

/**
 * CombatDebugMenu
 * Master UI Editor pour le Combat.
 */
export function CombatDebugMenu() {
    const combatState = useCombatStore((s) => s.combatState);
    const logs = useCombatStore((s) => s.logs);
    const sessionId = useCombatStore((s) => s.sessionId);
    const user = useAuthStore((s) => s.player);

    const [design] = useControls('Combat / Design Master', () => ({
        'Global Settings': folder({
            glassBlur: { value: 15, min: 0, max: 50, step: 1 },
            borderWidth: { value: 1.5, min: 0, max: 10, step: 0.5 },
            borderColor: { value: '#ffffff', label: 'Border Base Color' },
        }),
        'Glass Panels (Containers)': folder({
            panelBgBase: { value: '#000000', label: 'Panel BG' },
            panelOpacity: { value: 0.5, min: 0, max: 1, step: 0.01 },
            panelBorderOpacity: { value: 0.25, min: 0, max: 1, step: 0.01 },
            panelRadius: { value: 20, min: 0, max: 60, step: 1 },
            panelShadowIntensity: { value: 0.6, min: 0, max: 1, step: 0.05 },
            panelShadowBlur: { value: 50, min: 0, max: 100, step: 1 },
            panelInnerShadowOpacity: { value: 0.43, min: 0, max: 1, step: 0.01, label: 'Inner Shadow Opacity' },
            panelInnerShadowBlur: { value: 30, min: 0, max: 100, step: 1, label: 'Inner Shadow Blur' },
        }),
        'Glass Elements (Items)': folder({
            elemBgBase: { value: '#000000', label: 'Elem BG' },
            elemOpacity: { value: 0.7, min: 0, max: 1, step: 0.01 },
            elemBorderOpacity: { value: 0.12, min: 0, max: 1, step: 0.01 },
            elemRadius: { value: 12, min: 0, max: 40, step: 1 },
            elemShadowIntensity: { value: 0.4, min: 0, max: 1, step: 0.05 },
            elemShadowBlur: { value: 32, min: 0, max: 100, step: 1 },
            elemInnerShadowOpacity: { value: 0.05, min: 0, max: 1, step: 0.01, label: 'Inner Shadow Opacity' },
        }),
        'Spell Bar Premium': folder({
            barBgColor: { value: '#141414', label: 'BG Color' },
            barBgOpacity: { value: 0.6, min: 0, max: 1, step: 0.01 },
            barBlur: { value: 16, min: 0, max: 40, step: 1 },
            barRadius: { value: 24, min: 0, max: 60, step: 1 },
            barInnerShadowOpacity: { value: 0.9, min: 0, max: 1, step: 0.01, label: 'Inner Shadow Opacity' },
            barInnerShadowBlur: { value: 29, min: 0, max: 100, step: 1, label: 'Inner Shadow Blur' },
        }),
        'Resources Gauges': folder({
            gaugeSize: { value: 10, min: 6, max: 20, step: 1, label: 'Diamond Size' },
            gaugeGap: { value: 18, min: 4, max: 40, step: 1, label: 'Diamond Gap' },
            gaugeRowPadding: { value: 6, min: 0, max: 20, step: 1, label: 'Row Padding' },
        }),
        'Layout & Scale': folder({
            uiScale: { value: 1.0, min: 0.5, max: 1.5, step: 0.05 },
            panelPadding: { value: 20, min: 0, max: 60, step: 2 },
        }),
        'Export Config': button(() => console.log(JSON.stringify(design, null, 2))),
    }));

    useEffect(() => {
        const root = document.documentElement;
        const setRgbaVar = (name: string, hex: string, alpha: number) => {
            const rgb = hexToRgbTriplet(hex);
            if (rgb) {
                root.style.setProperty(`--${name}`, `rgba(${rgb.split(' ').join(',')}, ${alpha})`);
                if (name.includes('border') || name.includes('bg')) {
                    root.style.setProperty(`--${name}-rgb`, rgb);
                }
            }
        };

        // Global
        root.style.setProperty('--glass-blur', `blur(${design.glassBlur}px)`);
        root.style.setProperty('--glass-border-width', `${design.borderWidth}px`);

        // Panels
        setRgbaVar('glass-panel-bg', design.panelBgBase, design.panelOpacity);
        setRgbaVar('glass-panel-border', design.borderColor, design.panelBorderOpacity);
        root.style.setProperty('--glass-panel-radius', `${design.panelRadius}px`);
        
        const pShadowRgb = hexToRgbTriplet('#000000');
        if (pShadowRgb) {
            const pShadowRgba = `rgba(${pShadowRgb.split(' ').join(',')}, ${design.panelShadowIntensity})`;
            root.style.setProperty('--glass-panel-shadow', `0 10px ${design.panelShadowBlur}px ${pShadowRgba}`);
            
            const pInnerRgba = `rgba(${pShadowRgb.split(' ').join(',')}, ${design.panelInnerShadowOpacity})`;
            root.style.setProperty('--glass-panel-inner-shadow', `inset 0 0 ${design.panelInnerShadowBlur}px ${pInnerRgba}`);
        }

        // Elements
        setRgbaVar('glass-elem-bg', design.elemBgBase, design.elemOpacity);
        setRgbaVar('glass-elem-border', design.borderColor, design.elemBorderOpacity);
        root.style.setProperty('--glass-elem-radius', `${design.elemRadius}px`);
        
        const eShadowRgb = hexToRgbTriplet('#000000');
        if (eShadowRgb) {
            const eShadowRgba = `rgba(${eShadowRgb.split(' ').join(',')}, ${design.elemShadowIntensity})`;
            root.style.setProperty('--glass-elem-shadow', `0 8px ${design.elemShadowBlur}px ${eShadowRgba}`);
        }
        root.style.setProperty('--glass-elem-inner-shadow', `inset 0 1px 0 rgba(255, 255, 255, ${design.elemInnerShadowOpacity})`);

        // Spell Bar Premium
        setRgbaVar('spell-bar-bg', design.barBgColor, design.barBgOpacity);
        root.style.setProperty('--spell-bar-blur', `blur(${design.barBlur}px)`);
        root.style.setProperty('--spell-bar-radius', `${design.barRadius}px`);
        root.style.setProperty('--spell-bar-shadow', `inset 0 0 ${design.barInnerShadowBlur}px rgba(0,0,0,${design.barInnerShadowOpacity})`);

        // Gauges
        root.style.setProperty('--gauge-size', `${design.gaugeSize}px`);
        root.style.setProperty('--gauge-gap', `${design.gaugeGap}px`);
        root.style.setProperty('--gauge-row-padding', `${design.gaugeRowPadding}px`);

        // Scale
        root.style.setProperty('--glass-panel-padding', `${design.panelPadding}px`);
        root.style.setProperty('font-size', `${design.uiScale * 100}%`);

    }, [design]);

    // Game Colors
    const [colors] = useControls('Combat / Gameplay Colors', () => ({
        paYellow: { value: COMBAT_COLORS.PA_YELLOW },
        pmViolet: { value: COMBAT_COLORS.PM_VIOLET },
        hpRed: { value: COMBAT_COLORS.HP_RED },
        enemyRed: { value: COMBAT_COLORS.ENEMY_RED },
        glassAccent: { value: COMBAT_COLORS.GLASS_ACCENT },
    }));

    useEffect(() => {
        const root = document.documentElement;
        const updateVar = (baseName: string, hex: string) => {
            root.style.setProperty(`--${baseName}`, hex);
            const rgb = hexToRgbTriplet(hex);
            if (rgb) root.style.setProperty(`--${baseName}-rgb`, rgb);
        };
        updateVar('pa-yellow', colors.paYellow);
        updateVar('pm-violet', colors.pmViolet);
        updateVar('hp-red', colors.hpRed);
        updateVar('enemy-red', colors.enemyRed);
        updateVar('glass-accent', colors.glassAccent);
    }, [colors]);

    return null;
}
