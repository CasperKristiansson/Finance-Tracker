import { BriefcaseBusiness } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "@/components/composed/empty-state";
import { InlineError } from "@/components/composed/inline-error";
import { LoadingCard } from "@/components/composed/loading-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { useVenturesApi } from "@/hooks/use-api";
import { CompanyHeader } from "@/pages/ventures/components/company-header";
import { CompanyMetricStrip } from "@/pages/ventures/components/company-metric-strip";
import { CompanyRelationshipStrip } from "@/pages/ventures/components/company-relationship-strip";
import {
  DocumentsTab,
  NotesTab,
  TimelineTab,
  ValuationTab,
} from "@/pages/ventures/components/company-workspace-tabs";
import { DocumentHealthCard } from "@/pages/ventures/components/document-health-card";
import { OwnershipRiskPanel } from "@/pages/ventures/components/ownership-risk-panel";
import { RecentNotesCard } from "@/pages/ventures/components/recent-notes-card";
import { TimelineHighlights } from "@/pages/ventures/components/timeline-highlights";
import { ValuationHistoryChart } from "@/pages/ventures/components/valuation-history-chart";
import {
  AddValuationSheet,
  EditOwnershipSheet,
  NoteSheet,
} from "@/pages/ventures/components/venture-mutation-sheets";

export const CompanyWorkspace: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const {
    overview,
    companyDetails,
    presignsByRequestId,
    loading,
    errors,
    fetchOverview,
    fetchCompany,
    createValuation,
    createOwnershipEvent,
    createNote,
    updateNote,
    createDocument,
    deleteDocument,
    presignUpload,
  } = useVenturesApi();
  const [valuationSheetOpen, setValuationSheetOpen] = useState(false);
  const [ownershipSheetOpen, setOwnershipSheetOpen] = useState(false);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<
    VentureCompanyDetail["notes"][number] | undefined
  >();
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
        onAddValuation={() => setValuationSheetOpen(true)}
        onAddNote={() => {
          setEditingNote(undefined);
          setNoteSheetOpen(true);
        }}
        onEditOwnership={() => setOwnershipSheetOpen(true)}
      />
      <CompanyMetricStrip detail={detail} />
      <CompanyRelationshipStrip detail={detail} overview={overview} />

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="bg-white shadow-sm">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <ValuationHistoryChart detail={detail} />
            <OwnershipRiskPanel detail={detail} />
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <TimelineHighlights detail={detail} />
            <RecentNotesCard
              detail={detail}
              onEditNote={(note) => {
                setEditingNote(note);
                setNoteSheetOpen(true);
              }}
            />
            <DocumentHealthCard detail={detail} />
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="space-y-5">
          <TimelineTab detail={detail} />
        </TabsContent>
        <TabsContent value="valuation" className="space-y-5">
          <ValuationTab
            detail={detail}
            onAddValuation={() => setValuationSheetOpen(true)}
          />
        </TabsContent>
        <TabsContent value="notes" className="space-y-5">
          <NotesTab
            detail={detail}
            onAddNote={() => {
              setEditingNote(undefined);
              setNoteSheetOpen(true);
            }}
            onEditNote={(note) => {
              setEditingNote(note);
              setNoteSheetOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="documents" className="space-y-5">
          <DocumentsTab
            detail={detail}
            loading={loading}
            errors={errors}
            presignsByRequestId={presignsByRequestId}
            createDocument={createDocument}
            deleteDocument={deleteDocument}
            presignUpload={presignUpload}
          />
        </TabsContent>
      </Tabs>

      <AddValuationSheet
        open={valuationSheetOpen}
        onOpenChange={setValuationSheetOpen}
        detail={detail}
        loading={loading}
        errors={errors}
        createValuation={createValuation}
      />
      <EditOwnershipSheet
        open={ownershipSheetOpen}
        onOpenChange={setOwnershipSheetOpen}
        detail={detail}
        companies={overview?.companies ?? []}
        loading={loading}
        errors={errors}
        createOwnershipEvent={createOwnershipEvent}
      />
      <NoteSheet
        open={noteSheetOpen}
        onOpenChange={(open) => {
          setNoteSheetOpen(open);
          if (!open) setEditingNote(undefined);
        }}
        detail={detail}
        note={editingNote}
        loading={loading}
        errors={errors}
        createNote={createNote}
        updateNote={updateNote}
      />
    </div>
  );
};
