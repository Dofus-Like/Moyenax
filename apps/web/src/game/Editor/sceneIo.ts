import type { SceneTemplate } from '@game/shared-types';

/** Sérialise un SceneTemplate et déclenche son téléchargement en .json. */
export function downloadTemplate(template: SceneTemplate): void {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${template.name || 'scene'}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
