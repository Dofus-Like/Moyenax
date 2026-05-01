import { useEffect, useState } from 'react';

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

export type ViewportMode = 'mobile' | 'desktop';

export interface CameraViewportConfig {
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  rotateSensitivity: number;
  dragThresholdPx: number;
}

export function getViewportMode(width: number): ViewportMode {
  return width < MOBILE_BREAKPOINT_PX ? 'mobile' : 'desktop';
}

export function pickCameraViewportConfig(mode: ViewportMode): CameraViewportConfig {
  if (mode === 'mobile') {
    return {
      zoom: CAMERA_ZOOM_MOBILE,
      zoomMin: CAMERA_ZOOM_MIN_MOBILE,
      zoomMax: CAMERA_ZOOM_MAX_MOBILE,
      rotateSensitivity: CAMERA_ROTATE_SENSITIVITY_MOBILE,
      dragThresholdPx: CAMERA_DRAG_THRESHOLD_PX_MOBILE,
    };
  }
  return {
    zoom: CAMERA_ZOOM,
    zoomMin: CAMERA_ZOOM_MIN,
    zoomMax: CAMERA_ZOOM_MAX,
    rotateSensitivity: CAMERA_ROTATE_SENSITIVITY,
    dragThresholdPx: CAMERA_DRAG_THRESHOLD_PX,
  };
}

function readWidth(): number {
  if (typeof window === 'undefined') return MOBILE_BREAKPOINT_PX;
  return window.innerWidth;
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(() => getViewportMode(readWidth()));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = (): void => setMode(getViewportMode(window.innerWidth));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return (): void => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return mode;
}
