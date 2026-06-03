from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import Session

from apps.api.models import Account, Transaction, TransactionLeg
from apps.api.schemas import (
    VentureCompanyCreateRequest,
    VentureDocumentCreateRequest,
    VentureGraphEdgeLabel,
    VentureGraphLayoutNode,
    VentureGraphLayoutUpdateRequest,
    VentureGraphViewport,
    VentureNoteCreateRequest,
    VentureOwnershipCreateRequest,
    VenturePresignRequest,
    VentureValuationCreateRequest,
)
from apps.api.services import TransactionService, VentureService
from apps.api.services.ventures_storage import VentureStorage
from apps.api.shared import AccountType, TransactionType


class _FakeStorageClient:
    def generate_presigned_url(self, ClientMethod, Params, ExpiresIn):
        return f"https://example.com/{Params['Key']}"


def test_venture_company_detail_and_overview_kpis(session: Session) -> None:
    service = VentureService(session)
    detail = service.create_company(
        VentureCompanyCreateRequest(
            name="Northstar Labs",
            company_type="startup",
            status="ongoing",
            initial_valuation=VentureValuationCreateRequest(
                event_date=date(2026, 1, 1),
                label="Founder estimate",
                paper_value_sek=Decimal("1000000"),
                haircut_percentage=Decimal("40"),
                valuation_source="founder_estimate",
                liquidity_level="restricted",
                confidence_score=3,
            ),
            initial_ownership=VentureOwnershipCreateRequest(
                effective_date=date(2026, 1, 1),
                direct_ownership_pct=Decimal("65"),
            ),
        )
    )

    summary = detail.summary
    assert summary.company.name == "Northstar Labs"
    assert summary.paper_value_sek == Decimal("1000000")
    assert summary.risk_adjusted_value_sek == Decimal("600000.00")
    assert summary.ownership_pct == Decimal("65.0000")
    assert any(
        warning.code == "valuation_missing_evidence" for warning in detail.document_health.warnings
    )

    overview = service.overview()
    assert overview.kpis.total_paper_value_sek == Decimal("1000000")
    assert overview.kpis.total_risk_adjusted_value_sek == Decimal("600000.00")
    assert overview.kpis.status_counts == {"ongoing": 1}
    assert len(overview.ownership_edges) == 1


def test_account_synced_valuation_and_holding_company_edge(session: Session) -> None:
    cash = Account(name="Consulting Cash", account_type=AccountType.NORMAL)
    retained = Account(name="Retained Earnings", account_type=AccountType.NORMAL)
    offset = Account(name="Offset", account_type=AccountType.NORMAL)
    session.add_all([cash, retained, offset])
    session.commit()
    session.refresh(cash)
    session.refresh(retained)
    session.refresh(offset)

    TransactionService(session).create_transaction(
        Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=datetime(2026, 1, 5, tzinfo=timezone.utc),
            posted_at=datetime(2026, 1, 5, tzinfo=timezone.utc),
            description="Seed balance",
        ),
        [
            TransactionLeg(account_id=cash.id, amount=Decimal("250000")),
            TransactionLeg(account_id=retained.id, amount=Decimal("75000")),
            TransactionLeg(account_id=offset.id, amount=Decimal("-325000")),
        ],
    )

    service = VentureService(session)
    holding = service.create_company(VentureCompanyCreateRequest(name="Holding AB"))
    operating = service.create_company(
        VentureCompanyCreateRequest(
            name="Consulting AB",
            company_type="consulting",
            valuation_mode="account_balance_sync",
            account_links=[
                {"account_id": cash.id, "weight": Decimal("1")},
                {"account_id": retained.id, "weight": Decimal("1")},
            ],
            initial_ownership=VentureOwnershipCreateRequest(
                owner_type="company",
                owner_company_id=holding.summary.company.id,
                effective_date=date(2026, 1, 5),
                direct_ownership_pct=Decimal("100"),
            ),
        )
    )

    overview = service.overview()
    synced = next(
        company
        for company in overview.companies
        if company.company.id == operating.summary.company.id
    )
    assert synced.paper_value_sek == Decimal("325000.00")
    assert synced.risk_adjusted_value_sek == Decimal("325000.00")
    assert any(
        edge.owner_company_id == holding.summary.company.id
        and edge.company_id == operating.summary.company.id
        for edge in overview.ownership_edges
    )


def test_notes_documents_soft_delete_and_layout(session: Session) -> None:
    service = VentureService(session)
    company = service.create_company(VentureCompanyCreateRequest(name="Docs Co"))
    company_id = company.summary.company.id

    note = service.create_note(
        company_id,
        VentureNoteCreateRequest(
            title="Board reflection",
            body_markdown="**Important** update",
            tags=["board", "lesson"],
            note_date=date(2026, 2, 1),
            pinned=True,
        ),
    )
    assert service.list_notes(company_id).notes[0].id == note.id

    document = service.create_document(
        company_id,
        VentureDocumentCreateRequest(
            title="Share register",
            document_type="evidence",
            category="ownership",
            status="verified",
            storage_key="ventures/user/company/document.pdf",
            file_name="document.pdf",
            mime_type="application/pdf",
            file_size_bytes=123,
        ),
    )
    docs = service.list_documents(company_id)
    assert docs.documents[0].id == document.id
    assert "ownership" not in docs.document_health.missing_categories

    layout = service.save_graph_layout(
        VentureGraphLayoutUpdateRequest(
            nodes=[
                VentureGraphLayoutNode(
                    company_id=company_id,
                    x=Decimal("10"),
                    y=Decimal("20"),
                    pinned=True,
                )
            ],
            viewport=VentureGraphViewport(x=Decimal("1"), y=Decimal("2"), zoom=Decimal("1.2")),
            edge_labels=[
                VentureGraphEdgeLabel(
                    edge_id="ownership-founder-root-company-a-0",
                    position=Decimal("0.35"),
                )
            ],
        )
    )
    assert layout.nodes[0].pinned is True
    assert layout.viewport is not None
    assert layout.viewport.zoom == Decimal("1.2")
    assert layout.edge_labels[0].position == Decimal("0.35")

    service.delete_note(company_id, note.id)
    service.delete_document(company_id, document.id)
    assert service.list_notes(company_id).notes == []
    assert service.list_documents(company_id).documents == []


def test_direct_storage_key_download_must_belong_to_current_user(session: Session) -> None:
    storage = VentureStorage(bucket="bucket", prefix="uploads", client=_FakeStorageClient())
    service = VentureService(session, storage=storage)

    with pytest.raises(ValueError, match="outside the current user's Ventures files"):
        service.presign(
            "user-a",
            VenturePresignRequest(
                operation="download",
                storage_key="uploads/ventures/user-b/company/document.pdf",
            ),
        )


def test_logo_upload_presign_can_be_created_before_company_exists(session: Session) -> None:
    storage = VentureStorage(bucket="bucket", prefix="uploads", client=_FakeStorageClient())
    service = VentureService(session, storage=storage)

    presign = service.presign(
        "user-a",
        VenturePresignRequest(
            operation="upload",
            purpose="logo",
            file_name="logo.png",
            mime_type="image/png",
            file_size_bytes=512,
        ),
    )

    assert presign.method == "PUT"
    assert presign.storage_key.startswith("uploads/ventures/user-a/pending/logo/")


def test_document_upload_presign_requires_existing_company(session: Session) -> None:
    storage = VentureStorage(bucket="bucket", prefix="uploads", client=_FakeStorageClient())
    service = VentureService(session, storage=storage)

    with pytest.raises(ValueError, match="Missing upload fields: company_id"):
        service.presign(
            "user-a",
            VenturePresignRequest(
                operation="upload",
                purpose="document",
                file_name="memo.pdf",
                mime_type="application/pdf",
                file_size_bytes=512,
            ),
        )
