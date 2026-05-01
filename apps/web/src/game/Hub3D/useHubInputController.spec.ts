import { Vector2 } from 'three';
import { describe, expect, it } from 'vitest';

import { computeNdcFromRect } from './useHubInputController';

const RECT_FULLHD = { left: 0, top: 0, width: 1920, height: 1080 };

describe('computeNdcFromRect', () => {
  it('maps the rect center to (0, 0)', () => {
    const out = new Vector2();
    const ok = computeNdcFromRect({ clientX: 960, clientY: 540 }, RECT_FULLHD, out);
    expect(ok).toBe(true);
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it('maps the top-left corner to (-1, +1)', () => {
    const out = new Vector2();
    computeNdcFromRect({ clientX: 0, clientY: 0 }, RECT_FULLHD, out);
    expect(out.x).toBeCloseTo(-1, 6);
    expect(out.y).toBeCloseTo(1, 6);
  });

  it('maps the bottom-right corner to (+1, -1)', () => {
    const out = new Vector2();
    computeNdcFromRect({ clientX: 1920, clientY: 1080 }, RECT_FULLHD, out);
    expect(out.x).toBeCloseTo(1, 6);
    expect(out.y).toBeCloseTo(-1, 6);
  });

  it('respects an offset rect (canvas not at viewport origin)', () => {
    const rect = { left: 200, top: 100, width: 800, height: 600 };
    const out = new Vector2();
    computeNdcFromRect({ clientX: 600, clientY: 400 }, rect, out);
    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it('returns false for a zero-sized rect (canvas not yet laid out)', () => {
    const out = new Vector2();
    const ok = computeNdcFromRect(
      { clientX: 100, clientY: 100 },
      { left: 0, top: 0, width: 0, height: 0 },
      out,
    );
    expect(ok).toBe(false);
  });
});
