declare module "@shadergradient/react" {
  import * as React from "react";

  export const ShaderGradientCanvas: React.FC<
    React.PropsWithChildren<{
      pixelDensity?: number;
      style?: React.CSSProperties;
    }>
  >;

  export const ShaderGradient: React.FC<{
    control?: string;
    urlString?: string;
  }>;
}

declare module "@react-three/fiber";
declare module "camera-controls";
declare module "three";
declare module "three-stdlib";
