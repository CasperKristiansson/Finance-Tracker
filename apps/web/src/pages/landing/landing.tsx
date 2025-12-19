import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";
import { useReducedMotion, motion } from "framer-motion";
import { ArrowRight, Github, Sparkles } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PageRoutes } from "@/data/routes";
import { cn } from "@/lib/utils";

const SHADER_URL =
  "https://www.shadergradient.co/customize?animate=on&type=plane&shader=defaults&cDistance=3.6&cPolarAngle=90&uFrequency=5.5&uSpeed=0.35&uStrength=3.8&color1=%2352ff89&color2=%23dbba95&color3=%23d0bce1&lightType=3d&grain=on&grainBlending=0.25&brightness=1.05";
const SHADER_URL_STATIC = SHADER_URL.replace("animate=on", "animate=off");
const GITHUB_URL = "https://github.com/Finance-Tracker/Finance-Tracker";

// Update SHADER_URL or pixelDensity below to tune the background while keeping the CTA layer readable.
export const Landing: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const shaderUrl = prefersReducedMotion ? SHADER_URL_STATIC : SHADER_URL;
  const pixelDensity = prefersReducedMotion ? 1 : 1.35;

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <ShaderGradientCanvas
          style={{ position: "absolute", inset: 0 }}
          pixelDensity={pixelDensity}
        >
          <ShaderGradient control="query" urlString={shaderUrl} />
        </ShaderGradientCanvas>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/65 to-slate-950/85" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-16 sm:px-10 lg:flex-row lg:items-center lg:gap-16 lg:py-24">
        <motion.div
          className="flex flex-1 flex-col gap-6 rounded-3xl bg-white/10 p-8 shadow-[0_20px_90px_-40px_rgba(0,0,0,0.6)] backdrop-blur"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 ring-1 ring-emerald-300/30">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Demo available
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-[0.22em] text-emerald-100/80 uppercase">
              Finance Tracker
            </p>
            <h1 className="text-4xl leading-tight font-semibold text-white sm:text-5xl lg:text-6xl">
              Track spending. Stay in control.
            </h1>
            <p className="text-lg text-white/80 sm:text-xl">
              Visualize where your money goes, make confident decisions, and
              keep every account aligned from one focused workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={PageRoutes.login}
              className={cn(
                buttonVariants({ size: "lg" }),
                "shadow-[0_10px_50px_-24px_rgba(80,255,155,0.6)]",
              )}
            >
              Log in
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={PageRoutes.login}
              className={cn(
                buttonVariants({ size: "lg", variant: "secondary" }),
                "bg-white/10 text-white hover:bg-white/20",
              )}
            >
              Try demo
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "text-white hover:bg-white/10",
              )}
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/75">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 ring-1 ring-white/10">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Instant insights
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 ring-1 ring-white/10">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Demo-ready workspace
            </div>
          </div>
        </motion.div>

        <motion.div
          className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_-50px_rgba(0,0,0,0.7)] backdrop-blur"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.08 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/70">Live overview</p>
              <h2 className="text-2xl font-semibold text-white">
                Financial clarity
              </h2>
            </div>
            <div className="flex h-10 items-center rounded-full bg-emerald-400/15 px-4 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/30">
              Streamlined setup
            </div>
          </div>
          <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between text-sm text-white/75">
              <span>Spending this month</span>
              <span className="font-semibold text-white">$4,280</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/75">
              <span>Upcoming bills</span>
              <span className="font-semibold text-white">$1,120</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/75">
              <span>Investments</span>
              <span className="font-semibold text-white">$28,400</span>
            </div>
          </div>
          <p className="text-sm text-white/70">
            Create momentum with a focused dashboard, fast imports, and demo
            data to explore before connecting your own accounts.
          </p>
        </motion.div>
      </div>
    </div>
  );
};
