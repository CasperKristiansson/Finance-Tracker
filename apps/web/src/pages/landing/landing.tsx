import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PageRoutes } from "@/data/routes";
import { cn } from "@/lib/utils";

export const Landing: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <ShaderGradientCanvas
          style={{ position: "absolute", inset: 0 }}
          pixelDensity={1.5}
        >
          <ShaderGradient
            animate="on"
            axesHelper="off"
            brightness={1.2}
            cAzimuthAngle={180}
            cDistance={3.1}
            cPolarAngle={90}
            cameraZoom={1}
            color1="#ff945e"
            color2="#dbccb8"
            color3="#b9bee1"
            destination="onCanvas"
            embedMode="off"
            envPreset="lobby"
            format="gif"
            fov={45}
            frameRate={10}
            gizmoHelper="hide"
            grain="on"
            lightType="3d"
            pixelDensity={1.5}
            positionX={-1.4}
            positionY={0}
            positionZ={0}
            range="disabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            shader="defaults"
            type="plane"
            uAmplitude={1}
            uDensity={2.2}
            uFrequency={5.5}
            uSpeed={0.2}
            uStrength={4}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/25 to-slate-950/45" />
      </div>

      <motion.div
        className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 px-6 text-center"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow-[0_14px_45px_rgba(0,0,0,0.35)] sm:text-6xl lg:text-7xl">
            Money clarity in one calm space
          </h1>
          <h2 className="text-lg font-medium text-white/90 sm:text-2xl">
            Track accounts, budgets, and goals with a focused, beautiful
            overview.
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to={PageRoutes.login}
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-white text-slate-900 shadow-[0_16px_45px_-28px_rgba(0,0,0,0.65)] hover:bg-white/90",
            )}
          >
            Log in
          </Link>
          <Link
            to={PageRoutes.login}
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "bg-white/20 text-white ring-1 ring-white/40 hover:bg-white/30",
            )}
          >
            Try demo
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
