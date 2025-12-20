declare module "@shadergradient/react" {
  import * as React from "react";

  export const ShaderGradientCanvas: React.FC<
    React.PropsWithChildren<{
      pixelDensity?: number;
      style?: React.CSSProperties;
    }>
  >;

  export type ShaderGradientProps = {
    animate?: string;
    axesHelper?: string;
    brightness?: number;
    cAzimuthAngle?: number;
    cDistance?: number;
    cPolarAngle?: number;
    cameraZoom?: number;
    color1?: string;
    color2?: string;
    color3?: string;
    control?: string;
    destination?: string;
    embedMode?: string;
    envPreset?: string;
    format?: string;
    fov?: number;
    frameRate?: number;
    gizmoHelper?: string;
    grain?: string;
    lightType?: string;
    pixelDensity?: number;
    positionX?: number;
    positionY?: number;
    positionZ?: number;
    range?: string;
    rangeEnd?: number;
    rangeStart?: number;
    reflection?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    shader?: string;
    type?: string;
    uAmplitude?: number;
    uDensity?: number;
    uFrequency?: number;
    uSpeed?: number;
    uStrength?: number;
    uTime?: number;
    urlString?: string;
    wireframe?: boolean;
  };

  export const ShaderGradient: React.FC<ShaderGradientProps>;
}

declare module "@react-three/fiber";
declare module "camera-controls";
declare module "three";
declare module "three-stdlib";
