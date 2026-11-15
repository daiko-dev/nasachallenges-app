declare module 'aladin-lite' {
  export interface AladinOptions {
    survey?: string;
    fov?: number;
    target?: string;
    cooFrame?: 'J2000' | 'galactic' | 'ICRS';
    showReticle?: boolean;
    showZoomControl?: boolean;
    showFullscreenControl?: boolean;
    showLayersControl?: boolean;
    showGotoControl?: boolean;
    showFrame?: boolean;
    showCooLocation?: boolean;
    showCooGridControl?: boolean;
    showProjectionControl?: boolean;
    showShareControl?: boolean;
    showSettingsControl?: boolean;
    showSimbadPointerControl?: boolean;
    reticleColor?: string;
    reticleSize?: number;
  }

  export interface AladinInstance {
    gotoRaDec(ra: number, dec: number): void;
    setFov(fovDeg: number): void;
    getRaDec(): [number, number];
    getFov(): [number, number];
    setImageSurvey(survey: string | unknown): void;
    createImageSurvey(
      id: string,
      name: string,
      url: string,
      cooFrame?: string,
      maxOrder?: number,
      options?: { imgFormat?: string }
    ): unknown;
    on(event: 'positionChanged' | 'objectClicked' | 'click', cb: (data: unknown) => void): void;
    destroy?: () => void;
  }

  export interface AladinNamespace {
    init: Promise<void>;
    aladin(container: string | HTMLElement, options?: AladinOptions): AladinInstance;
  }

  const A: AladinNamespace;
  export default A;
}
