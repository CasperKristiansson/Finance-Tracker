import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EndpointResponse } from "@/types/contracts";

export type VentureOverview = EndpointResponse<"venturesOverview">;
export type VentureCompanyDetail = EndpointResponse<"getVentureCompany">;
export type VentureNotes = EndpointResponse<"listVentureNotes">["notes"];
export type VentureDocuments =
  EndpointResponse<"listVentureDocuments">["documents"];
export type VentureDocumentHealth =
  EndpointResponse<"listVentureDocuments">["document_health"];
export type VenturePresign = EndpointResponse<"presignVentureUpload">;

export type VentureOperation =
  | "overview"
  | "detail"
  | "createCompany"
  | "updateCompany"
  | "deleteCompany"
  | "createValuation"
  | "createOwnershipEvent"
  | "listNotes"
  | "createNote"
  | "updateNote"
  | "deleteNote"
  | "listDocuments"
  | "createDocument"
  | "deleteDocument"
  | "updateLayout"
  | "presignUpload";

type VentureLoadingState = Record<VentureOperation, boolean>;
type VentureErrorState = Partial<Record<VentureOperation, string>>;

export interface VenturesState {
  overview?: VentureOverview;
  companyDetails: Record<string, VentureCompanyDetail | undefined>;
  notesByCompany: Record<string, VentureNotes | undefined>;
  documentsByCompany: Record<string, VentureDocuments | undefined>;
  documentHealthByCompany: Record<string, VentureDocumentHealth | undefined>;
  lastPresign?: VenturePresign;
  loading: VentureLoadingState;
  errors: VentureErrorState;
}

const emptyLoadingState = (): VentureLoadingState => ({
  overview: false,
  detail: false,
  createCompany: false,
  updateCompany: false,
  deleteCompany: false,
  createValuation: false,
  createOwnershipEvent: false,
  listNotes: false,
  createNote: false,
  updateNote: false,
  deleteNote: false,
  listDocuments: false,
  createDocument: false,
  deleteDocument: false,
  updateLayout: false,
  presignUpload: false,
});

const initialState: VenturesState = {
  overview: undefined,
  companyDetails: {},
  notesByCompany: {},
  documentsByCompany: {},
  documentHealthByCompany: {},
  lastPresign: undefined,
  loading: emptyLoadingState(),
  errors: {},
};

const venturesSlice = createSlice({
  name: "ventures",
  initialState,
  reducers: {
    setVenturesOverview(state, action: PayloadAction<VentureOverview>) {
      state.overview = action.payload;
      delete state.errors.overview;
    },
    setVentureCompanyDetail(
      state,
      action: PayloadAction<{
        companyId: string;
        detail: VentureCompanyDetail;
      }>,
    ) {
      const { companyId, detail } = action.payload;
      state.companyDetails[companyId] = detail;
      state.notesByCompany[companyId] = detail.notes;
      state.documentsByCompany[companyId] = detail.documents;
      state.documentHealthByCompany[companyId] = detail.document_health;
      delete state.errors.detail;
    },
    removeVentureCompanyDetail(state, action: PayloadAction<string>) {
      delete state.companyDetails[action.payload];
      delete state.notesByCompany[action.payload];
      delete state.documentsByCompany[action.payload];
      delete state.documentHealthByCompany[action.payload];
    },
    setVentureNotes(
      state,
      action: PayloadAction<{ companyId: string; notes: VentureNotes }>,
    ) {
      state.notesByCompany[action.payload.companyId] = action.payload.notes;
      const detail = state.companyDetails[action.payload.companyId];
      if (detail) {
        detail.notes = action.payload.notes;
      }
      delete state.errors.listNotes;
    },
    setVentureDocuments(
      state,
      action: PayloadAction<{
        companyId: string;
        documents: VentureDocuments;
        documentHealth: VentureDocumentHealth;
      }>,
    ) {
      const { companyId, documents, documentHealth } = action.payload;
      state.documentsByCompany[companyId] = documents;
      state.documentHealthByCompany[companyId] = documentHealth;
      const detail = state.companyDetails[companyId];
      if (detail) {
        detail.documents = documents;
        detail.document_health = documentHealth;
      }
      delete state.errors.listDocuments;
    },
    setVenturePresign(state, action: PayloadAction<VenturePresign>) {
      state.lastPresign = action.payload;
      delete state.errors.presignUpload;
    },
    setVentureOperationLoading(
      state,
      action: PayloadAction<{ operation: VentureOperation; loading: boolean }>,
    ) {
      state.loading[action.payload.operation] = action.payload.loading;
    },
    setVentureOperationError(
      state,
      action: PayloadAction<{
        operation: VentureOperation;
        error?: string;
      }>,
    ) {
      if (action.payload.error) {
        state.errors[action.payload.operation] = action.payload.error;
      } else {
        delete state.errors[action.payload.operation];
      }
    },
    resetVentures: () => initialState,
  },
  selectors: {
    selectVenturesState: (state) => state,
    selectVenturesOverview: (state) => state.overview,
    selectVentureCompanyDetails: (state) => state.companyDetails,
    selectVentureCompanyDetail: (state, companyId: string) =>
      state.companyDetails[companyId],
    selectVentureNotes: (state, companyId: string) =>
      state.notesByCompany[companyId] ?? [],
    selectVentureDocuments: (state, companyId: string) =>
      state.documentsByCompany[companyId] ?? [],
    selectVentureLoading: (state) => state.loading,
    selectVentureErrors: (state) => state.errors,
    selectVentureLastPresign: (state) => state.lastPresign,
  },
});

export const {
  removeVentureCompanyDetail,
  resetVentures,
  setVentureCompanyDetail,
  setVentureDocuments,
  setVentureNotes,
  setVentureOperationError,
  setVentureOperationLoading,
  setVenturePresign,
  setVenturesOverview,
} = venturesSlice.actions;

export const {
  selectVentureCompanyDetail,
  selectVentureCompanyDetails,
  selectVentureDocuments,
  selectVentureErrors,
  selectVentureLastPresign,
  selectVentureLoading,
  selectVentureNotes,
  selectVenturesOverview,
  selectVenturesState,
} = venturesSlice.selectors;

export const VenturesReducer = venturesSlice.reducer;
