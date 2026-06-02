import { Plus, RefreshCw } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { InlineError } from "@/components/composed/inline-error";
import { LoadingCard } from "@/components/composed/loading-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccountsApi, useVenturesApi } from "@/hooks/use-api";
import { CompanyBottomPanel } from "@/pages/ventures/components/company-bottom-panel";
import { VentureGraph } from "@/pages/ventures/components/venture-graph";
import { VentureKpiRow } from "@/pages/ventures/components/venture-kpi-row";
import {
  AddCompanySheet,
  AddValuationSheet,
  EditOwnershipSheet,
  NoteSheet,
} from "@/pages/ventures/components/venture-mutation-sheets";

export const Ventures: React.FC = () => {
  const {
    overview,
    companyDetails,
    loading,
    errors,
    fetchOverview,
    fetchCompany,
    updateLayout,
    createCompany,
    createValuation,
    createOwnershipEvent,
    createNote,
    updateNote,
    presignUpload,
    presignsByRequestId,
  } = useVenturesApi();
  const { options: accountOptions, fetchAccountOptions } = useAccountsApi();
  const [selectedCompanyId, setSelectedCompanyId] = useState<
    string | undefined
  >();
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addValuationCompanyId, setAddValuationCompanyId] = useState<
    string | undefined
  >();
  const [editOwnershipCompanyId, setEditOwnershipCompanyId] = useState<
    string | undefined
  >();
  const [noteCompanyId, setNoteCompanyId] = useState<string | undefined>();

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchAccountOptions({ includeInactive: false });
  }, [fetchAccountOptions]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    if (companyDetails[selectedCompanyId]) return;
    fetchCompany(selectedCompanyId);
  }, [companyDetails, fetchCompany, selectedCompanyId]);

  useEffect(() => {
    const companyId =
      addValuationCompanyId ?? editOwnershipCompanyId ?? noteCompanyId;
    if (!companyId) return;
    if (companyDetails[companyId]) return;
    fetchCompany(companyId);
  }, [
    addValuationCompanyId,
    companyDetails,
    editOwnershipCompanyId,
    fetchCompany,
    noteCompanyId,
  ]);

  const selectedSummary = useMemo(
    () =>
      overview?.companies.find(
        (summary) => summary.company.id === selectedCompanyId,
      ),
    [overview?.companies, selectedCompanyId],
  );

  const isInitialLoading = loading.overview && !overview;
  const selectedDetail = selectedCompanyId
    ? companyDetails[selectedCompanyId]
    : undefined;
  const mutationCompanyId =
    addValuationCompanyId ?? editOwnershipCompanyId ?? noteCompanyId;
  const mutationDetail = mutationCompanyId
    ? companyDetails[mutationCompanyId]
    : undefined;

  return (
    <div className="flex min-h-full flex-col gap-6 bg-slate-50/70 p-2 md:p-4">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
            Ventures
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Founder equity, company history, and private holdings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-800"
          >
            Paper values stay outside net worth
          </Badge>
          <Button
            type="button"
            size="sm"
            onClick={() => setAddCompanyOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add company
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={loading.overview}
          >
            <RefreshCw
              className={loading.overview ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Refresh
          </Button>
        </div>
      </section>

      {errors.overview ? (
        <InlineError
          message={errors.overview}
          action={
            <Button size="sm" variant="outline" onClick={fetchOverview}>
              Retry
            </Button>
          }
        />
      ) : null}

      {isInitialLoading ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <LoadingCard lines={3} />
            <LoadingCard lines={3} />
            <LoadingCard lines={3} />
            <LoadingCard lines={3} />
          </div>
          <LoadingCard className="min-h-[680px]" lines={8} />
        </>
      ) : overview ? (
        <>
          <VentureKpiRow kpis={overview.kpis} />
          <VentureGraph
            overview={overview}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={setSelectedCompanyId}
            onLayoutChange={updateLayout}
            onAddCompany={() => setAddCompanyOpen(true)}
          >
            {selectedSummary ? (
              <CompanyBottomPanel
                summary={selectedSummary}
                detail={selectedDetail}
                recentActivity={overview.recent_activity}
                loading={loading.detail}
                error={errors.detail}
                onClose={() => setSelectedCompanyId(undefined)}
                onAddValuation={() =>
                  setAddValuationCompanyId(selectedSummary.company.id)
                }
                onEditOwnership={() =>
                  setEditOwnershipCompanyId(selectedSummary.company.id)
                }
                onAddNote={() => setNoteCompanyId(selectedSummary.company.id)}
              />
            ) : null}
          </VentureGraph>
        </>
      ) : null}

      <AddCompanySheet
        open={addCompanyOpen}
        onOpenChange={setAddCompanyOpen}
        companies={overview?.companies ?? []}
        accounts={accountOptions}
        loading={loading}
        errors={errors}
        presignsByRequestId={presignsByRequestId}
        presignUpload={presignUpload}
        createCompany={createCompany}
      />
      <AddValuationSheet
        open={Boolean(addValuationCompanyId)}
        onOpenChange={(open) => {
          if (!open) setAddValuationCompanyId(undefined);
        }}
        detail={mutationDetail}
        loading={loading}
        errors={errors}
        createValuation={createValuation}
      />
      <EditOwnershipSheet
        open={Boolean(editOwnershipCompanyId)}
        onOpenChange={(open) => {
          if (!open) setEditOwnershipCompanyId(undefined);
        }}
        detail={mutationDetail}
        companies={overview?.companies ?? []}
        loading={loading}
        errors={errors}
        createOwnershipEvent={createOwnershipEvent}
      />
      <NoteSheet
        open={Boolean(noteCompanyId)}
        onOpenChange={(open) => {
          if (!open) setNoteCompanyId(undefined);
        }}
        detail={mutationDetail}
        loading={loading}
        errors={errors}
        createNote={createNote}
        updateNote={updateNote}
      />
    </div>
  );
};
