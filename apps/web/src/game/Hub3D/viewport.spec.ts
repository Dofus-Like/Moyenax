import { describe, expect, it } from 'vitest';

import {
  CAMERA_DRAG_THRESHOLD_PX,
  CAMERA_DRAG_THRESHOLD_PX_MOBILE,
  CAMERA_ROTATE_SENSITIVITY,
  CAMERA_ROTATE_SENSITIVITY_MOBILE,
  CAMERA_ZOOM,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MAX_MOBILE,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MIN_MOBILE,
  CAMERA_ZOOM_MOBILE,
  MOBILE_BREAKPOINT_PX,
} from './constants';
import { getViewportMode, pickCameraViewportConfig } from './viewport';

describe('getViewportMode', () => {
  it('returns mobile below the breakpoint', () => {
    expect(getViewportMode(360)).toBe('mobile');
    expect(getViewportMode(390)).toBe('mobile');
    expect(getViewportMode(414)).toBe('mobile');
    expect(getViewportMode(MOBILE_BREAKPOINT_PX - 1)).toBe('mobile');
  });

  it('returns desktop at and above the breakpoint', () => {
    expect(getViewportMode(MOBILE_BREAKPOINT_PX)).toBe('desktop');
    expect(getViewportMode(1366)).toBe('desktop');
    expect(getViewportMode(1920)).toBe('desktop');
  });
});

describe('pickCameraViewportConfig', () => {
  it('returns the desktop tuning on desktop', () => {
    expect(pickCameraViewportConfig('desktop')).toEqual({
      zoom: CAMERA_ZOOM,
      zoomMin: CAMERA_ZOOM_MIN,
      zoomMax: CAMERA_ZOOM_MAX,
      rotateSensitivity: CAMERA_ROTATE_SENSITIVITY,
      dragThresholdPx: CAMERA_DRAG_THRESHOLD_PX,
    });
  });

  it('returns the mobile tuning on mobile', () => {
    expect(pickCameraViewportConfig('mobile')).toEqual({
      zoom: CAMERA_ZOOM_MOBILE,
      zoomMin: CAMERA_ZOOM_MIN_MOBILE,
      zoomMax: CAMERA_ZOOM_MAX_MOBILE,
      rotateSensitivity: CAMERA_ROTATE_SENSITIVITY_MOBILE,
      dragThresholdPx: CAMERA_DRAG_THRESHOLD_PX_MOBILE,
    });
  });

  it('mobile zoom range is wider on the dezoom side than desktop', () => {
    const desktop = pickCameraViewportConfig('desktop');
    const mobile = pickCameraViewportConfig('mobile');
    expect(mobile.zoom).toBeLessThan(desktop.zoom);
    expect(mobile.zoomMin).toBeLessThan(desktop.zoomMin);
  });

  it('mobile rotate is less sensitive than desktop', () => {
    const desktop = pickCameraViewportConfig('desktop');
    const mobile = pickCameraViewportConfig('mobile');
    expect(mobile.rotateSensitivity).toBeLessThan(desktop.rotateSensitivity);
  });

  it('mobile drag threshold is more permissive than desktop', () => {
    const desktop = pickCameraViewportConfig('desktop');
    const mobile = pickCameraViewportConfig('mobile');
    expect(mobile.dragThresholdPx).toBeGreaterThan(desktop.dragThresholdPx);
  });
});
