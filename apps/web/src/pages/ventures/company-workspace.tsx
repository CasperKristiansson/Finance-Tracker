import { BriefcaseBusiness } from "lucide-react";
import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "@/components/composed/empty-state";
import { InlineError } from "@/components/composed/inline-error";
import { LoadingCard } from "@/components/composed/loading-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { useVenturesApi } from "@/hooks/use-api";
import { CompanyHeader } from "@/pages/ventures/components/company-header";
import { CompanyMetricStrip } from "@/pages/ventures/components/company-metric-strip";
import { CompanyRelationshipStrip } from "@/pages/ventures/components/company-relationship-strip";
import { DocumentHealthCard } from "@/pages/ventures/components/document-health-card";
import { OwnershipRiskPanel } from "@/pages/ventures/components/ownership-risk-panel";
import { RecentNotesCard } from "@/pages/ventures/components/recent-notes-card";
import { TimelineHighlights } from "@/pages/ventures/components/timeline-highlights";
import { ValuationHistoryChart } from "@/pages/ventures/components/valuation-history-chart";

export const CompanyWorkspace: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const {
    overview,
    companyDetails,
    loading,
    errors,
    fetchOverview,
    fetchCompany,
  } = useVenturesApi();
  const detail = companyId ? companyDetails[companyId] : undefined;

  useEffect(() => {
    if (!companyId) return;
    fetchCompany(companyId);
  }, [companyId, fetchCompany]);

  useEffect(() => {
    if (!overview && !loading.overview) {
      fetchOverview();
    }
  }, [fetchOverview, loading.overview, overview]);

  if (!companyId) {
    return (
      <div className="p-2 md:p-4">
        <InlineError message="Missing venture company id." />
      </div>
    );
  }

  const isInitialLoading = loading.detail && !detail;

  if (isInitialLoading) {
    return (
      <div className="flex min-h-full flex-col gap-5 bg-slate-50/70 p-2 md:p-4">
        <LoadingCard className="min-h-40" lines={5} />
        <LoadingCard className="min-h-24" lines={3} />
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <LoadingCard className="min-h-80" lines={7} />
          <LoadingCard className="min-h-80" lines={7} />
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <LoadingCard className="min-h-64" lines={6} />
          <LoadingCard className="min-h-64" lines={6} />
          <LoadingCard className="min-h-64" lines={6} />
        </div>
      </div>
    );
  }

  if (errors.detail && !detail) {
    return (
      <div className="flex min-h-full flex-col gap-4 bg-slate-50/70 p-2 md:p-4">
        <InlineError
          message={errors.detail}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchCompany(companyId)}
            >
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-full flex-col bg-slate-50/70 p-2 md:p-4">
        <EmptyState
          className="min-h-80"
          title="Company not found"
          description="This venture company is not available in the current workspace."
          icon={<BriefcaseBusiness className="h-6 w-6" />}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to={PageRoutes.ventures}>Back to Ventures</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-5 bg-slate-50/70 p-2 md:p-4">
      {errors.detail ? (
        <InlineError
          message={errors.detail}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchCompany(companyId)}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      <CompanyHeader
        detail={detail}
        loading={loading.detail}
        onRefresh={() => fetchCompany(companyId)}
      />
      <CompanyMetricStrip detail={detail} />
      <CompanyRelationshipStrip detail={detail} overview={overview} />

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="bg-white shadow-sm">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline" disabled>
            Timeline
          </TabsTrigger>
          <TabsTrigger value="valuation" disabled>
            Valuation
          </TabsTrigger>
          <TabsTrigger value="notes" disabled>
            Notes
          </TabsTrigger>
          <TabsTrigger value="documents" disabled>
            Documents
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <ValuationHistoryChart detail={detail} />
            <OwnershipRiskPanel detail={detail} />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <TimelineHighlights detail={detail} />
            <RecentNotesCard detail={detail} />
            <DocumentHealthCard detail={detail} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
