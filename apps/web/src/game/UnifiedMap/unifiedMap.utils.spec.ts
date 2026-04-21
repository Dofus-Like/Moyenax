import { calculateBoundaryEdges, toPositionKey, toWorldPosition } from './unifiedMap.utils';
import { COMBAT_COLORS } from '../constants/colors';

describe('calculateBoundaryEdges', () => {
  it('should return 4 edges for a single tile', () => {
    const tiles = [{ x: 5, y: 5 }];
    const edges = calculateBoundaryEdges(tiles);
    
    expect(edges).toHaveLength(4);
    
    // Check if it covers all sides
    // Top
    expect(edges).toContainEqual({ start: [4.5, 4.5], end: [5.5, 4.5] });
    // Bottom
    expect(edges).toContainEqual({ start: [4.5, 5.5], end: [5.5, 5.5] });
    // Left
    expect(edges).toContainEqual({ start: [4.5, 4.5], end: [4.5, 5.5] });
    // Right
    expect(edges).toContainEqual({ start: [5.5, 4.5], end: [5.5, 5.5] });
  });

  it('should only return perimeter edges for a 2x2 square', () => {
    const tiles = [
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }
    ];
    const edges = calculateBoundaryEdges(tiles);
    
    // Each outer tile has 2 edges exposed. 4 tiles * 2 = 8 edges total.
    expect(edges).toHaveLength(8);
    
    // Check Top edges
    expect(edges).toContainEqual({ start: [-0.5, -0.5], end: [0.5, -0.5] }); // (0,0) top
    expect(edges).toContainEqual({ start: [0.5, -0.5], end: [1.5, -0.5] });  // (1,0) top
    
    // Check Internal edges should NOT be present
    // Vertical internal at x=0.5: between (0,0) and (1,0)
    expect(edges).not.toContainEqual({ start: [0.5, -0.5], end: [0.5, 0.5] });
  });

  it('should handle L-shaped formations', () => {
    const tiles = [
      { x: 0, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }
    ];
    const edges = calculateBoundaryEdges(tiles);
    
    // (0,0): Top, Left, Right (3)
    // (0,1): Left, Bottom (2)
    // (1,1): Top, Right, Bottom (3)
    // Total: 8
    expect(edges).toHaveLength(8);
    
    // Inner corner check: (0,0) bottom and (0,1) top should be missing
    expect(edges).not.toContainEqual({ start: [-0.5, 0.5], end: [0.5, 0.5] });
  });

  it('should return empty array for empty input', () => {
    expect(calculateBoundaryEdges([])).toEqual([]);
  });
});

describe('toPositionKey', () => {
  it('should format coordinates correctly', () => {
    expect(toPositionKey(10, -5)).toBe('10,-5');
  });
});

describe('toWorldPosition', () => {
  it('should center tiles correctly based on gridSize', () => {
    const gridSize = 10;
    // (0,0) with size 10 should be at -4.5 (left/top)
    expect(toWorldPosition(0, 0, gridSize)).toEqual([-4.5, 0, -4.5]);
    // (5,5) with size 10 should be at 0.5 (center-ish)
    expect(toWorldPosition(5, 5, gridSize)).toEqual([0.5, 0, 0.5]);
    // (9,9) with size 10 should be at 4.5 (right/bottom)
    expect(toWorldPosition(9, 9, gridSize)).toEqual([4.5, 0, 4.5]);
  });
});

describe('COMBAT_COLORS', () => {
  it('should contain all essential tactical keys', () => {
    const requiredKeys = [
      'PM_VIOLET', 'PA_YELLOW', 'HP_RED', 'HEAL_GREEN', 'RANGE_ORANGE'
    ];
    requiredKeys.forEach(key => {
      expect(COMBAT_COLORS).toHaveProperty(key);
      expect(COMBAT_COLORS[key as keyof typeof COMBAT_COLORS]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('should have consistent dark variations for main types', () => {
    expect(COMBAT_COLORS).toHaveProperty('PM_VIOLET_DARK');
    expect(COMBAT_COLORS).toHaveProperty('PA_YELLOW_DARK');
  });
});
