import { FileImage } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAppSelector } from "@/app/hooks";
import { selectIsDemo, selectToken } from "@/features/auth/authSlice";
import type { VentureOverview } from "@/features/ventures/venturesSlice";
import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import { cn } from "@/lib/utils";
import { initialsForName } from "@/pages/ventures/utils/format";
import type { EndpointResponse } from "@/types/contracts";

const logoUrlCache = new Map<string, { url: string; expiresAt: number }>();

type VentureCompanyLogoProps = {
  company: VentureOverview["companies"][number]["company"];
  className?: string;
  imageClassName?: string;
};

export const VentureCompanyLogo: React.FC<VentureCompanyLogoProps> = ({
  company,
  className,
  imageClassName,
}) => {
  const token = useAppSelector(selectToken);
  const isDemo = useAppSelector(selectIsDemo);
  const [logoState, setLogoState] = useState<{
    storageKey?: string;
    url?: string;
    failed?: boolean;
  }>({});
  const activeLogoUrl =
    logoState.storageKey === company.logo_storage_key && !logoState.failed
      ? logoState.url
      : undefined;

  useEffect(() => {
    if (!company.logo_storage_key || !token || isDemo) return;

    const logoStorageKey = company.logo_storage_key;
    const cachedLogoForStorageKey = logoUrlCache.get(logoStorageKey);
    if (
      cachedLogoForStorageKey &&
      cachedLogoForStorageKey.expiresAt > Date.now()
    ) {
      const cachedLogoUrl = cachedLogoForStorageKey.url;
      let cancelled = false;
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          setLogoState({
            storageKey: logoStorageKey,
            url: cachedLogoUrl,
          });
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    let cancelled = false;
    void apiFetch<EndpointResponse<"presignVentureUpload">>(
      buildEndpointRequest("presignVentureUpload", {
        token,
        body: {
          operation: "download",
          purpose: "logo",
          storage_key: logoStorageKey,
          file_name: company.logo_file_name,
          mime_type: company.logo_content_type,
        },
      }),
    )
      .then(({ data: presign }) => {
        const expiresInMs = Math.max(
          0,
          (presign.expires_in_seconds - 30) * 1000,
        );
        logoUrlCache.set(logoStorageKey, {
          url: presign.url,
          expiresAt: Date.now() + expiresInMs,
        });
        if (!cancelled) {
          setLogoState({
            storageKey: logoStorageKey,
            url: presign.url,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLogoState({
            storageKey: logoStorageKey,
            failed: true,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    company.logo_content_type,
    company.logo_file_name,
    company.logo_storage_key,
    isDemo,
    token,
  ]);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm",
        className,
      )}
      style={
        company.node_color ? { backgroundColor: company.node_color } : undefined
      }
      title={company.logo_file_name ?? undefined}
    >
      {activeLogoUrl ? (
        <img
          src={activeLogoUrl}
          alt=""
          className={cn(
            "h-full w-full rounded-full object-cover",
            imageClassName,
          )}
          onError={() => {
            if (company.logo_storage_key) {
              logoUrlCache.delete(company.logo_storage_key);
            }
            setLogoState({
              storageKey: company.logo_storage_key ?? undefined,
              failed: true,
            });
          }}
        />
      ) : company.logo_storage_key ? (
        <FileImage className="h-5 w-5" />
      ) : (
        initialsForName(company.name)
      )}
    </div>
  );
};
