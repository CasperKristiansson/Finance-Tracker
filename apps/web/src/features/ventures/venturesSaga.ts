import { createAction } from "@reduxjs/toolkit";
import type { SagaIterator } from "redux-saga";
import { call, put, select, takeLatest } from "typed-redux-saga";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import {
  removeVentureCompanyDetail,
  setVentureCompanyDetail,
  setVentureDocuments,
  setVentureNotes,
  setVentureOperationError,
  setVentureOperationLoading,
  setVenturePresign,
  setVenturesOverview,
  type VentureOperation,
} from "@/features/ventures/venturesSlice";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type { EndpointRequest, EndpointResponse } from "@/types/contracts";

const emptyVenturesOverview: EndpointResponse<"venturesOverview"> = {
  kpis: {
    total_paper_value_sek: "0",
    total_risk_adjusted_value_sek: "0",
    total_realized_value_sek: "0",
    illiquid_paper_value_sek: "0",
    company_count: 0,
    status_counts: {},
  },
  companies: [],
  ownership_edges: [],
  layout: {
    layout_key: "default",
    nodes: [],
    viewport: null,
  },
  recent_activity: [],
};

export const FetchVenturesOverview = createAction("ventures/fetchOverview");
export const FetchVentureCompany = createAction<{ companyId: string }>(
  "ventures/fetchCompany",
);
export const CreateVentureCompany = createAction<{
  data: EndpointRequest<"createVentureCompany">;
}>("ventures/createCompany");
export const UpdateVentureCompany = createAction<{
  companyId: string;
  data: EndpointRequest<"updateVentureCompany">;
}>("ventures/updateCompany");
export const DeleteVentureCompany = createAction<{ companyId: string }>(
  "ventures/deleteCompany",
);
export const CreateVentureValuation = createAction<{
  companyId: string;
  data: EndpointRequest<"createVentureValuation">;
}>("ventures/createValuation");
export const CreateVentureOwnershipEvent = createAction<{
  companyId: string;
  data: EndpointRequest<"createVentureOwnershipEvent">;
}>("ventures/createOwnershipEvent");
export const ListVentureNotes = createAction<{ companyId: string }>(
  "ventures/listNotes",
);
export const CreateVentureNote = createAction<{
  companyId: string;
  data: EndpointRequest<"createVentureNote">;
}>("ventures/createNote");
export const UpdateVentureNote = createAction<{
  companyId: string;
  noteId: string;
  data: EndpointRequest<"updateVentureNote">;
}>("ventures/updateNote");
export const DeleteVentureNote = createAction<{
  companyId: string;
  noteId: string;
}>("ventures/deleteNote");
export const ListVentureDocuments = createAction<{ companyId: string }>(
  "ventures/listDocuments",
);
export const CreateVentureDocument = createAction<{
  companyId: string;
  data: EndpointRequest<"createVentureDocument">;
}>("ventures/createDocument");
export const DeleteVentureDocument = createAction<{
  companyId: string;
  documentId: string;
}>("ventures/deleteDocument");
export const UpdateVentureLayout = createAction<{
  data: EndpointRequest<"updateVentureLayout">;
}>("ventures/updateLayout");
export const PresignVentureUpload = createAction<{
  data: EndpointRequest<"presignVentureUpload">;
}>("ventures/presignUpload");

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function* withOperation(
  operation: VentureOperation,
  worker: () => SagaIterator,
  fallback: string,
): SagaIterator {
  yield* put(setVentureOperationLoading({ operation, loading: true }));
  yield* put(setVentureOperationError({ operation, error: undefined }));
  try {
    yield* call(worker);
  } catch (error) {
    yield* put(
      setVentureOperationError({
        operation,
        error: getErrorMessage(error, fallback),
      }),
    );
  } finally {
    yield* put(setVentureOperationLoading({ operation, loading: false }));
  }
}

function* refreshAfterCompanyMutation(companyId?: string): SagaIterator {
  yield* put(FetchVenturesOverview());
  if (companyId) {
    yield* put(FetchVentureCompany({ companyId }));
  }
}

function* handleFetchOverview(): SagaIterator {
  yield* withOperation(
    "overview",
    function* fetchOverview() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) {
        yield* put(setVenturesOverview(emptyVenturesOverview));
        return;
      }
      const response: EndpointResponse<"venturesOverview"> = yield* call(
        callApiWithAuth<EndpointResponse<"venturesOverview">>,
        buildEndpointRequest("venturesOverview"),
        { loadingKey: "ventures-overview", silent: true },
      );
      yield* put(setVenturesOverview(response));
    },
    "Unable to load Ventures overview.",
  );
}

function* handleFetchCompany(
  action: ReturnType<typeof FetchVentureCompany>,
): SagaIterator {
  const { companyId } = action.payload;
  yield* withOperation(
    "detail",
    function* fetchCompany() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) {
        throw new Error("Demo mode has no Ventures company detail.");
      }
      const response: EndpointResponse<"getVentureCompany"> = yield* call(
        callApiWithAuth<EndpointResponse<"getVentureCompany">>,
        buildEndpointRequest("getVentureCompany", {
          pathParams: { companyId },
        }),
        { loadingKey: "ventures-company", silent: true },
      );
      yield* put(setVentureCompanyDetail({ companyId, detail: response }));
    },
    "Unable to load Ventures company.",
  );
}

function* handleCreateCompany(
  action: ReturnType<typeof CreateVentureCompany>,
): SagaIterator {
  yield* withOperation(
    "createCompany",
    function* createCompany() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) return;
      const response: EndpointResponse<"createVentureCompany"> = yield* call(
        callApiWithAuth<EndpointResponse<"createVentureCompany">>,
        buildEndpointRequest("createVentureCompany", {
          body: action.payload.data,
        }),
        { loadingKey: "ventures-create-company" },
      );
      const companyId = response.summary.company.id;
      yield* put(setVentureCompanyDetail({ companyId, detail: response }));
      yield* put(FetchVenturesOverview());
    },
    "Unable to create venture company.",
  );
}

function* handleUpdateCompany(
  action: ReturnType<typeof UpdateVentureCompany>,
): SagaIterator {
  const { companyId, data } = action.payload;
  yield* withOperation(
    "updateCompany",
    function* updateCompany() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        const response: EndpointResponse<"updateVentureCompany"> = yield* call(
          callApiWithAuth<EndpointResponse<"updateVentureCompany">>,
          buildEndpointRequest("updateVentureCompany", {
            pathParams: { companyId },
            body: data,
          }),
          { loadingKey: "ventures-update-company" },
        );
        yield* put(setVentureCompanyDetail({ companyId, detail: response }));
      }
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to update venture company.",
  );
}

function* handleDeleteCompany(
  action: ReturnType<typeof DeleteVentureCompany>,
): SagaIterator {
  const { companyId } = action.payload;
  yield* withOperation(
    "deleteCompany",
    function* deleteCompany() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"deleteVentureCompany">>,
          buildEndpointRequest("deleteVentureCompany", {
            pathParams: { companyId },
          }),
          { loadingKey: "ventures-delete-company" },
        );
      }
      yield* put(removeVentureCompanyDetail(companyId));
      yield* put(FetchVenturesOverview());
    },
    "Unable to delete venture company.",
  );
}

function* handleCreateValuation(
  action: ReturnType<typeof CreateVentureValuation>,
): SagaIterator {
  const { companyId, data } = action.payload;
  yield* withOperation(
    "createValuation",
    function* createValuation() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"createVentureValuation">>,
          buildEndpointRequest("createVentureValuation", {
            pathParams: { companyId },
            body: data,
          }),
          { loadingKey: "ventures-create-valuation" },
        );
      }
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to create venture valuation.",
  );
}

function* handleCreateOwnershipEvent(
  action: ReturnType<typeof CreateVentureOwnershipEvent>,
): SagaIterator {
  const { companyId, data } = action.payload;
  yield* withOperation(
    "createOwnershipEvent",
    function* createOwnershipEvent() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"createVentureOwnershipEvent">>,
          buildEndpointRequest("createVentureOwnershipEvent", {
            pathParams: { companyId },
            body: data,
          }),
          { loadingKey: "ventures-create-ownership-event" },
        );
      }
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to create venture ownership event.",
  );
}

function* handleListNotes(
  action: ReturnType<typeof ListVentureNotes>,
): SagaIterator {
  const { companyId } = action.payload;
  yield* withOperation(
    "listNotes",
    function* listNotes() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) {
        yield* put(setVentureNotes({ companyId, notes: [] }));
        return;
      }
      const response: EndpointResponse<"listVentureNotes"> = yield* call(
        callApiWithAuth<EndpointResponse<"listVentureNotes">>,
        buildEndpointRequest("listVentureNotes", {
          pathParams: { companyId },
        }),
        { loadingKey: "ventures-list-notes", silent: true },
      );
      yield* put(setVentureNotes({ companyId, notes: response.notes }));
    },
    "Unable to load venture notes.",
  );
}

function* handleCreateNote(
  action: ReturnType<typeof CreateVentureNote>,
): SagaIterator {
  const { companyId, data } = action.payload;
  yield* withOperation(
    "createNote",
    function* createNote() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"createVentureNote">>,
          buildEndpointRequest("createVentureNote", {
            pathParams: { companyId },
            body: data,
          }),
          { loadingKey: "ventures-create-note" },
        );
      }
      yield* put(ListVentureNotes({ companyId }));
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to create venture note.",
  );
}

function* handleUpdateNote(
  action: ReturnType<typeof UpdateVentureNote>,
): SagaIterator {
  const { companyId, noteId, data } = action.payload;
  yield* withOperation(
    "updateNote",
    function* updateNote() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"updateVentureNote">>,
          buildEndpointRequest("updateVentureNote", {
            pathParams: { companyId, noteId },
            body: data,
          }),
          { loadingKey: "ventures-update-note" },
        );
      }
      yield* put(ListVentureNotes({ companyId }));
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to update venture note.",
  );
}

function* handleDeleteNote(
  action: ReturnType<typeof DeleteVentureNote>,
): SagaIterator {
  const { companyId, noteId } = action.payload;
  yield* withOperation(
    "deleteNote",
    function* deleteNote() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"deleteVentureNote">>,
          buildEndpointRequest("deleteVentureNote", {
            pathParams: { companyId, noteId },
          }),
          { loadingKey: "ventures-delete-note" },
        );
      }
      yield* put(ListVentureNotes({ companyId }));
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to delete venture note.",
  );
}

function* handleListDocuments(
  action: ReturnType<typeof ListVentureDocuments>,
): SagaIterator {
  const { companyId } = action.payload;
  yield* withOperation(
    "listDocuments",
    function* listDocuments() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) {
        yield* put(
          setVentureDocuments({
            companyId,
            documents: [],
            documentHealth: { warnings: [], missing_categories: [] },
          }),
        );
        return;
      }
      const response: EndpointResponse<"listVentureDocuments"> = yield* call(
        callApiWithAuth<EndpointResponse<"listVentureDocuments">>,
        buildEndpointRequest("listVentureDocuments", {
          pathParams: { companyId },
        }),
        { loadingKey: "ventures-list-documents", silent: true },
      );
      yield* put(
        setVentureDocuments({
          companyId,
          documents: response.documents,
          documentHealth: response.document_health,
        }),
      );
    },
    "Unable to load venture documents.",
  );
}

function* handleCreateDocument(
  action: ReturnType<typeof CreateVentureDocument>,
): SagaIterator {
  const { companyId, data } = action.payload;
  yield* withOperation(
    "createDocument",
    function* createDocument() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"createVentureDocument">>,
          buildEndpointRequest("createVentureDocument", {
            pathParams: { companyId },
            body: data,
          }),
          { loadingKey: "ventures-create-document" },
        );
      }
      yield* put(ListVentureDocuments({ companyId }));
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to create venture document.",
  );
}

function* handleDeleteDocument(
  action: ReturnType<typeof DeleteVentureDocument>,
): SagaIterator {
  const { companyId, documentId } = action.payload;
  yield* withOperation(
    "deleteDocument",
    function* deleteDocument() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (!isDemo) {
        yield* call(
          callApiWithAuth<EndpointResponse<"deleteVentureDocument">>,
          buildEndpointRequest("deleteVentureDocument", {
            pathParams: { companyId, documentId },
          }),
          { loadingKey: "ventures-delete-document" },
        );
      }
      yield* put(ListVentureDocuments({ companyId }));
      yield* call(refreshAfterCompanyMutation, companyId);
    },
    "Unable to delete venture document.",
  );
}

function* handleUpdateLayout(
  action: ReturnType<typeof UpdateVentureLayout>,
): SagaIterator {
  yield* withOperation(
    "updateLayout",
    function* updateLayout() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) return;
      yield* call(
        callApiWithAuth<EndpointResponse<"updateVentureLayout">>,
        buildEndpointRequest("updateVentureLayout", {
          body: action.payload.data,
        }),
        { loadingKey: "ventures-update-layout" },
      );
      yield* put(FetchVenturesOverview());
    },
    "Unable to update venture layout.",
  );
}

function* handlePresignUpload(
  action: ReturnType<typeof PresignVentureUpload>,
): SagaIterator {
  yield* withOperation(
    "presignUpload",
    function* presignUpload() {
      const isDemo: boolean = yield* select(selectIsDemo);
      if (isDemo) {
        throw new Error("Demo mode does not create file upload URLs.");
      }
      const response: EndpointResponse<"presignVentureUpload"> = yield* call(
        callApiWithAuth<EndpointResponse<"presignVentureUpload">>,
        buildEndpointRequest("presignVentureUpload", {
          body: action.payload.data,
        }),
        { loadingKey: "ventures-presign-upload" },
      );
      yield* put(setVenturePresign(response));
    },
    "Unable to prepare venture file upload.",
  );
}

export function* VenturesSaga() {
  yield* takeLatest(FetchVenturesOverview.type, handleFetchOverview);
  yield* takeLatest(FetchVentureCompany.type, handleFetchCompany);
  yield* takeLatest(CreateVentureCompany.type, handleCreateCompany);
  yield* takeLatest(UpdateVentureCompany.type, handleUpdateCompany);
  yield* takeLatest(DeleteVentureCompany.type, handleDeleteCompany);
  yield* takeLatest(CreateVentureValuation.type, handleCreateValuation);
  yield* takeLatest(
    CreateVentureOwnershipEvent.type,
    handleCreateOwnershipEvent,
  );
  yield* takeLatest(ListVentureNotes.type, handleListNotes);
  yield* takeLatest(CreateVentureNote.type, handleCreateNote);
  yield* takeLatest(UpdateVentureNote.type, handleUpdateNote);
  yield* takeLatest(DeleteVentureNote.type, handleDeleteNote);
  yield* takeLatest(ListVentureDocuments.type, handleListDocuments);
  yield* takeLatest(CreateVentureDocument.type, handleCreateDocument);
  yield* takeLatest(DeleteVentureDocument.type, handleDeleteDocument);
  yield* takeLatest(UpdateVentureLayout.type, handleUpdateLayout);
  yield* takeLatest(PresignVentureUpload.type, handlePresignUpload);
}
