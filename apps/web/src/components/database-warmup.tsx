import { Flame, Gauge, RefreshCw, TimerReset } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { WARMUP_MAX_ATTEMPTS } from "@/features/warmup/warmupSaga";
import type { WarmupState } from "@/features/warmup/warmupSlice";
import { Spinner } from "./spinner";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface DatabaseWarmupProps {
  warmupState: WarmupState;
  onRetry: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatElapsed = (startedAt?: string) => {
  if (!startedAt) return "";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s elapsed`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s elapsed`;
};

export const DatabaseWarmup: React.FC<DatabaseWarmupProps> = ({
  warmupState,
  onRetry,
}) => {
  const [progress, setProgress] = useState(14);

  useEffect(() => {
    if (warmupState.status === "ready") {
      setProgress(100);
      return;
    }

    const startTime =
      warmupState.startedAt && !Number.isNaN(Date.parse(warmupState.startedAt))
        ? new Date(warmupState.startedAt).getTime()
        : Date.now();

    const id = window.setInterval(() => {
      const elapsedSeconds = Math.max(0, (Date.now() - startTime) / 1000);
      const ceiling = warmupState.status === "failed" ? 92 : 98;
      const target = clamp(
        18 + elapsedSeconds * 1.3 + warmupState.attempts * 6,
        12,
        ceiling,
      );
      setProgress((current) => {
        if (warmupState.status === "failed") {
          return Math.max(current, target);
        }
        if (warmupState.status === "ready") {
          return 100;
        }
        return target < current ? current : target;
      });
    }, 650);

    return () => window.clearInterval(id);
  }, [warmupState.status, warmupState.startedAt, warmupState.attempts]);

  useEffect(() => {
    if (warmupState.status === "ready") {
      setProgress(100);
    }
  }, [warmupState.status]);

  const statusLabel = useMemo(() => {
    if (warmupState.status === "ready") return "Aurora is online";
    if (warmupState.status === "failed") return "Warmup stalled";
    if (!warmupState.attempts) return "Queuing the first warmup ping";
    const attempts = warmupState.attempts || 1;
    return `Checking connectivity (${attempts}/${WARMUP_MAX_ATTEMPTS})`;
  }, [warmupState.status, warmupState.attempts]);

  const helperLine =
    warmupState.status === "failed"
      ? (warmupState.lastError ??
        "Lambda likely hit the 29s cap. Retry to nudge the database again.")
      : (warmupState.note ??
        "Aurora scales to zero when idle. We are nudging it awake.");

  const elapsed = formatElapsed(warmupState.startedAt);
  const attemptLabel =
    warmupState.status === "warming"
      ? `Attempt ${Math.max(1, warmupState.attempts)} of ${WARMUP_MAX_ATTEMPTS}`
      : warmupState.status === "ready"
        ? "Ready to serve requests"
        : warmupState.status === "failed"
          ? "Warmup paused"
          : "Preparing warmup request";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(99,102,241,0.1),transparent_35%)] opacity-80" />
      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 ring-1 ring-blue-100">
                  <Flame className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs tracking-[0.24em] text-slate-500 uppercase">
                    Preparing data layer
                  </p>
                  <h1 className="text-3xl font-semibold text-slate-900">
                    Waking Aurora
                  </h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-700">
                Aurora scales down to zero when idle. We are running a warmup
                ping so the first real request does not fight a cold start. This
                typically takes 30-60 seconds and may retry if a Lambda hits the
                29s cap.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-700 ring-1 ring-slate-200">
              <TimerReset className="h-4 w-4 text-blue-600" />
              <div className="flex flex-col">
                <span className="font-semibold text-slate-900">
                  {attemptLabel}
                </span>
                <span className="text-[11px] text-slate-500">
                  {elapsed || "Clock starts once the first ping is sent"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <Progress
              value={progress}
              className="h-3 bg-slate-100"
              indicatorClassName="bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 shadow-[0_0_18px_rgba(59,130,246,0.35)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-slate-900">
                  {statusLabel}
                </span>
              </div>
              <span className="font-semibold text-blue-600">
                {Math.min(100, Math.round(progress))}%
              </span>
            </div>
          </div>

          {warmupState.status === "failed" ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-rose-50 px-4 py-4 ring-1 ring-rose-200">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-rose-900">
                  Could not confirm the database is awake yet.
                </p>
                <p className="text-xs text-rose-800">{helperLine}</p>
              </div>
              <Button variant="secondary" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" />
                Retry warmup
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                <Spinner width={24} height={24} color="#2563eb" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-900">
                  {helperLine}
                </p>
                <p className="text-xs text-slate-600">
                  We will keep checking until the cluster responds.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
