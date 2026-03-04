"""HTTP handler contract registry used for frontend type generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

from pydantic import BaseModel

from ..schemas import (
    AccountCreate,
    AccountUpdate,
    AccountWithBalance,
    BackupRunResponse,
    CashflowForecastQuery,
    CashflowForecastResponse,
    CategoryCreate,
    CategoryListResponse,
    CategoryOptionsResponse,
    CategoryRead,
    CategoryUpdate,
    DashboardOverviewQuery,
    DashboardOverviewResponse,
    DateRangeReportQuery,
    DateRangeReportResponse,
    ExportReportRequest,
    ExportReportResponse,
    GoalCreate,
    GoalListResponse,
    GoalRead,
    GoalUpdate,
    ImportCategorySuggestJobRequest,
    ImportCategorySuggestJobResponse,
    ImportCategorySuggestRequest,
    ImportCategorySuggestResponse,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportDraftDeleteResponse,
    ImportDraftListResponse,
    ImportDraftSaveRequest,
    ImportDraftSaveResponse,
    ImportFileDownloadRequest,
    ImportFileDownloadResponse,
    ImportFileListResponse,
    ImportPersistFilesRequest,
    ImportPersistFilesResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
    InvestmentOverviewResponse,
    InvestmentSnapshotCreateRequest,
    InvestmentSnapshotCreateResponse,
    InvestmentTransactionListQuery,
    InvestmentTransactionListResponse,
    ListAccountOptionsQuery,
    ListAccountOptionsResponse,
    ListAccountsQuery,
    ListAccountsResponse,
    ListCategoriesQuery,
    ListCategoryOptionsQuery,
    LoanActivityCreateRequest,
    LoanActivityCreateResponse,
    LoanCreateRequest,
    LoanEventListQuery,
    LoanEventListResponse,
    LoanPortfolioSeriesQuery,
    LoanPortfolioSeriesRead,
    LoanRead,
    LoanScheduleQuery,
    LoanScheduleRead,
    LoanUpdate,
    MergeCategoriesRequest,
    MonthlyReportQuery,
    MonthlyReportResponse,
    NetWorthHistoryQuery,
    NetWorthHistoryResponse,
    NetWorthProjectionQuery,
    NetWorthProjectionResponse,
    QuarterlyReportQuery,
    QuarterlyReportResponse,
    ReconcileAccountRequest,
    ReconcileAccountResponse,
    SettingsRequest,
    SettingsResponse,
    TaxEventCreateRequest,
    TaxEventCreateResponse,
    TaxEventListQuery,
    TaxEventListResponse,
    TaxSummaryQuery,
    TaxSummaryResponse,
    TaxTotalSummaryResponse,
    TotalOverviewQuery,
    TotalOverviewResponse,
    TotalReportQuery,
    TotalReportResponse,
    TransactionCreate,
    TransactionListQuery,
    TransactionListResponse,
    TransactionRead,
    TransactionRecentQuery,
    TransactionRecentResponse,
    TransactionUpdate,
    WarmupResponse,
    YearlyCategoryDetailQuery,
    YearlyCategoryDetailResponse,
    YearlyOverviewQuery,
    YearlyOverviewRangeQuery,
    YearlyOverviewRangeResponse,
    YearlyOverviewResponse,
    YearlyReportQuery,
    YearlyReportResponse,
)

ModelType: TypeAlias = type[BaseModel]


@dataclass(frozen=True)
class HandlerHttpContract:
    request_model: ModelType | None = None
    response_model: ModelType | None = None
    query_model: ModelType | None = None
    path_model: ModelType | None = None


HTTP_HANDLER_CONTRACTS: dict[str, HandlerHttpContract] = {
    "apps/api/handlers/backups.run_transactions_backup": HandlerHttpContract(
        response_model=BackupRunResponse
    ),
    "apps/api/handlers/warmup.warm_database": HandlerHttpContract(response_model=WarmupResponse),
    "apps/api/handlers/accounts.list_accounts": HandlerHttpContract(
        query_model=ListAccountsQuery,
        response_model=ListAccountsResponse,
    ),
    "apps/api/handlers/accounts.list_account_options": HandlerHttpContract(
        query_model=ListAccountOptionsQuery,
        response_model=ListAccountOptionsResponse,
    ),
    "apps/api/handlers/accounts.create_account": HandlerHttpContract(
        request_model=AccountCreate,
        response_model=AccountWithBalance,
    ),
    "apps/api/handlers/accounts.update_account": HandlerHttpContract(
        request_model=AccountUpdate,
        response_model=AccountWithBalance,
    ),
    "apps/api/handlers/accounts.reconcile_account": HandlerHttpContract(
        request_model=ReconcileAccountRequest,
        response_model=ReconcileAccountResponse,
    ),
    "apps/api/handlers/imports.preview_imports": HandlerHttpContract(
        request_model=ImportPreviewRequest,
        response_model=ImportPreviewResponse,
    ),
    "apps/api/handlers/imports.commit_imports": HandlerHttpContract(
        request_model=ImportCommitRequest,
        response_model=ImportCommitResponse,
    ),
    "apps/api/handlers/imports.persist_import_files": HandlerHttpContract(
        request_model=ImportPersistFilesRequest,
        response_model=ImportPersistFilesResponse,
    ),
    "apps/api/handlers/imports.list_import_drafts": HandlerHttpContract(
        response_model=ImportDraftListResponse
    ),
    "apps/api/handlers/imports.get_import_draft": HandlerHttpContract(
        response_model=ImportPreviewResponse
    ),
    "apps/api/handlers/imports.save_import_draft": HandlerHttpContract(
        request_model=ImportDraftSaveRequest,
        response_model=ImportDraftSaveResponse,
    ),
    "apps/api/handlers/imports.delete_import_draft": HandlerHttpContract(
        response_model=ImportDraftDeleteResponse
    ),
    "apps/api/handlers/import_files.list_import_files": HandlerHttpContract(
        response_model=ImportFileListResponse
    ),
    "apps/api/handlers/import_files.download_import_file": HandlerHttpContract(
        request_model=ImportFileDownloadRequest,
        response_model=ImportFileDownloadResponse,
    ),
    "apps/api/handlers/bedrock_suggestions.suggest_import_categories": HandlerHttpContract(
        request_model=ImportCategorySuggestRequest,
        response_model=ImportCategorySuggestResponse,
    ),
    "apps/api/handlers/bedrock_suggestions.enqueue_import_category_suggestions": (
        HandlerHttpContract(
            request_model=ImportCategorySuggestJobRequest,
            response_model=ImportCategorySuggestJobResponse,
        )
    ),
    "apps/api/handlers/settings.get_settings": HandlerHttpContract(response_model=SettingsResponse),
    "apps/api/handlers/settings.save_settings": HandlerHttpContract(
        request_model=SettingsRequest,
        response_model=SettingsResponse,
    ),
    "apps/api/handlers/categories.list_categories": HandlerHttpContract(
        query_model=ListCategoriesQuery,
        response_model=CategoryListResponse,
    ),
    "apps/api/handlers/categories.list_category_options": HandlerHttpContract(
        query_model=ListCategoryOptionsQuery,
        response_model=CategoryOptionsResponse,
    ),
    "apps/api/handlers/categories.create_category": HandlerHttpContract(
        request_model=CategoryCreate,
        response_model=CategoryRead,
    ),
    "apps/api/handlers/categories.update_category": HandlerHttpContract(
        request_model=CategoryUpdate,
        response_model=CategoryRead,
    ),
    "apps/api/handlers/categories.merge_categories": HandlerHttpContract(
        request_model=MergeCategoriesRequest,
        response_model=CategoryRead,
    ),
    "apps/api/handlers/goals.list_goals": HandlerHttpContract(response_model=GoalListResponse),
    "apps/api/handlers/goals.create_goal": HandlerHttpContract(
        request_model=GoalCreate,
        response_model=GoalRead,
    ),
    "apps/api/handlers/goals.update_goal": HandlerHttpContract(
        request_model=GoalUpdate,
        response_model=GoalRead,
    ),
    "apps/api/handlers/goals.delete_goal": HandlerHttpContract(),
    "apps/api/handlers/transactions.list_transactions": HandlerHttpContract(
        query_model=TransactionListQuery,
        response_model=TransactionListResponse,
    ),
    "apps/api/handlers/transactions.list_recent_transactions": HandlerHttpContract(
        query_model=TransactionRecentQuery,
        response_model=TransactionRecentResponse,
    ),
    "apps/api/handlers/transactions.create_transaction": HandlerHttpContract(
        request_model=TransactionCreate,
        response_model=TransactionRead,
    ),
    "apps/api/handlers/transactions.update_transaction": HandlerHttpContract(
        request_model=TransactionUpdate,
        response_model=TransactionRead,
    ),
    "apps/api/handlers/transactions.delete_transaction": HandlerHttpContract(),
    "apps/api/handlers/tax.list_tax_events": HandlerHttpContract(
        query_model=TaxEventListQuery,
        response_model=TaxEventListResponse,
    ),
    "apps/api/handlers/tax.create_tax_event": HandlerHttpContract(
        request_model=TaxEventCreateRequest,
        response_model=TaxEventCreateResponse,
    ),
    "apps/api/handlers/tax.tax_summary": HandlerHttpContract(
        query_model=TaxSummaryQuery,
        response_model=TaxSummaryResponse,
    ),
    "apps/api/handlers/tax.tax_total_summary": HandlerHttpContract(
        response_model=TaxTotalSummaryResponse
    ),
    "apps/api/handlers/loans.create_loan": HandlerHttpContract(
        request_model=LoanCreateRequest,
        response_model=LoanRead,
    ),
    "apps/api/handlers/loans.create_loan_activity": HandlerHttpContract(
        request_model=LoanActivityCreateRequest,
        response_model=LoanActivityCreateResponse,
    ),
    "apps/api/handlers/loans.update_loan": HandlerHttpContract(
        request_model=LoanUpdate,
        response_model=LoanRead,
    ),
    "apps/api/handlers/loans.list_loan_events": HandlerHttpContract(
        query_model=LoanEventListQuery,
        response_model=LoanEventListResponse,
    ),
    "apps/api/handlers/loans.list_loan_portfolio_series": HandlerHttpContract(
        query_model=LoanPortfolioSeriesQuery,
        response_model=LoanPortfolioSeriesRead,
    ),
    "apps/api/handlers/loans.get_loan_schedule": HandlerHttpContract(
        query_model=LoanScheduleQuery,
        response_model=LoanScheduleRead,
    ),
    "apps/api/handlers/reporting.monthly_report": HandlerHttpContract(
        query_model=MonthlyReportQuery,
        response_model=MonthlyReportResponse,
    ),
    "apps/api/handlers/reporting.yearly_report": HandlerHttpContract(
        query_model=YearlyReportQuery,
        response_model=YearlyReportResponse,
    ),
    "apps/api/handlers/reporting.yearly_overview": HandlerHttpContract(
        query_model=YearlyOverviewQuery,
        response_model=YearlyOverviewResponse,
    ),
    "apps/api/handlers/reporting.yearly_overview_range": HandlerHttpContract(
        query_model=YearlyOverviewRangeQuery,
        response_model=YearlyOverviewRangeResponse,
    ),
    "apps/api/handlers/reporting.yearly_category_detail": HandlerHttpContract(
        query_model=YearlyCategoryDetailQuery,
        response_model=YearlyCategoryDetailResponse,
    ),
    "apps/api/handlers/reporting.quarterly_report": HandlerHttpContract(
        query_model=QuarterlyReportQuery,
        response_model=QuarterlyReportResponse,
    ),
    "apps/api/handlers/reporting.date_range_report": HandlerHttpContract(
        query_model=DateRangeReportQuery,
        response_model=DateRangeReportResponse,
    ),
    "apps/api/handlers/reporting.total_report": HandlerHttpContract(
        query_model=TotalReportQuery,
        response_model=TotalReportResponse,
    ),
    "apps/api/handlers/reporting.total_overview": HandlerHttpContract(
        query_model=TotalOverviewQuery,
        response_model=TotalOverviewResponse,
    ),
    "apps/api/handlers/reporting.dashboard_overview": HandlerHttpContract(
        query_model=DashboardOverviewQuery,
        response_model=DashboardOverviewResponse,
    ),
    "apps/api/handlers/reporting.net_worth_history": HandlerHttpContract(
        query_model=NetWorthHistoryQuery,
        response_model=NetWorthHistoryResponse,
    ),
    "apps/api/handlers/reporting.cashflow_forecast": HandlerHttpContract(
        query_model=CashflowForecastQuery,
        response_model=CashflowForecastResponse,
    ),
    "apps/api/handlers/reporting.net_worth_projection": HandlerHttpContract(
        query_model=NetWorthProjectionQuery,
        response_model=NetWorthProjectionResponse,
    ),
    "apps/api/handlers/reporting.export_report": HandlerHttpContract(
        request_model=ExportReportRequest,
        response_model=ExportReportResponse,
    ),
    "apps/api/handlers/investments.list_investment_transactions": HandlerHttpContract(
        query_model=InvestmentTransactionListQuery,
        response_model=InvestmentTransactionListResponse,
    ),
    "apps/api/handlers/investments.investment_overview": HandlerHttpContract(
        response_model=InvestmentOverviewResponse
    ),
    "apps/api/handlers/investments.create_investment_snapshot": HandlerHttpContract(
        request_model=InvestmentSnapshotCreateRequest,
        response_model=InvestmentSnapshotCreateResponse,
    ),
}


__all__ = ["HandlerHttpContract", "HTTP_HANDLER_CONTRACTS"]
