"""
One-off importer for legacy transactions/loans.

Usage:
  AWS_PROFILE=Personal python scripts/import_legacy_transactions.py --user Google_105712732762355947213

Optional flags:
  --stage default                # SSM stage prefix (/finance-tracker/{stage}/db/*)
  --loan-cash-account Swedbank   # Where CSN payouts land (default Swedbank)
"""

from __future__ import annotations

import argparse
import hashlib
import os
from decimal import Decimal
import sys
from datetime import date
from pathlib import Path
from typing import Dict, Iterable, Optional, Sequence, Tuple
from uuid import UUID

import boto3
import pandas as pd
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.append(str(REPO_ROOT))

from sqlalchemy.exc import IntegrityError
from sqlmodel import delete, select

from apps.api.models import (
    Account,
    Category,
    InvestmentHolding,
    InvestmentSnapshot,
    Loan,
    LoanEvent,
    Transaction,
    TransactionLeg,
)
from apps.api.services.transaction import TransactionService
from apps.api.shared import (
    AccountType,
    CategoryType,
    CreatedSource,
    InterestCompound,
    TransactionStatus,
    TransactionType,
    ensure_balanced_legs,
    configure_engine,
    scope_session_to_user,
)
from apps.api.shared.session import get_session
TX_PATH = REPO_ROOT / "docs" / "data" / "Transactions Export.xlsx"
LOAN_PATH = REPO_ROOT / "docs" / "data" / "Loans Export.xlsx"


def fetch_db_url_from_ssm(stage: str) -> str:
    prefix = f"/finance-tracker/{stage}/db/"
    ssm = boto3.client("ssm", region_name="eu-north-1")
    names = [f"{prefix}endpoint", f"{prefix}name", f"{prefix}user", f"{prefix}password"]
    resp = ssm.get_parameters(Names=names, WithDecryption=True)
    values = {param["Name"]: param["Value"] for param in resp["Parameters"]}
    missing = [name for name in names if name not in values]
    if missing:
        raise RuntimeError(f"Missing SSM parameters: {', '.join(missing)}")

    endpoint = values[f"{prefix}endpoint"]
    name = values[f"{prefix}name"]
    user = values[f"{prefix}user"]
    password = values[f"{prefix}password"]
    return f"postgresql+psycopg2://{user}:{password}@{endpoint}:5432/{name}"


def progress(label: str, current: int, total: int) -> None:
    pct = (current / total) * 100 if total else 100
    bar_len = 30
    filled = int(bar_len * pct / 100)
    bar = "#" * filled + "-" * (bar_len - filled)
    print(f"\r{label} [{bar}] {pct:5.1f}% ({current}/{total})", end="", flush=True)
    if current >= total:
        print()


def make_external_id(
    occurred_at, account_name: str, amount: Decimal, category: Optional[str], note: str, type_label: str
) -> str:
    raw = f"{occurred_at.isoformat()}|{account_name}|{amount}|{category}|{note}|{type_label}"
    return "legacy-" + hashlib.sha1(raw.encode()).hexdigest()


def ensure_accounts(session, user_id: str) -> Tuple[Dict[str, str], Dict[str, str]]:
    rename_map = {
        "Card": "Swedbank",
        "Nordnet": "Nordnet Private",
        "Company Nordnet": "Nordnet Company",
        "Company Account": "SEB Company",
        "Swedbank Savings": "Swedbank Savings",
        "Paypal": "Paypal",
        "Gift Card": "Gift Card",
        "Danske Bank": "Bospar",
        "Cash": "Cash",
    }
    account_configs = {
        "Swedbank": (AccountType.NORMAL, True, "banks/swedbank.png"),
        "Nordnet Private": (AccountType.INVESTMENT, True, "banks/nordnet.jpg"),
        "Nordnet Company": (AccountType.INVESTMENT, True, "banks/nordnet.jpg"),
        "SEB Company": (AccountType.NORMAL, True, "banks/seb.png"),
        "Bospar": (AccountType.INVESTMENT, True, "banks/danskebank.png"),
        "Circle K Mastercard": (AccountType.NORMAL, True, "banks/circlek.png"),
        "Cash": (AccountType.NORMAL, True, None),
        "Swedbank Savings": (AccountType.NORMAL, False, "banks/swedbank.png"),
        "Paypal": (AccountType.NORMAL, False, None),
        "Gift Card": (AccountType.NORMAL, False, None),
    }

    account_ids: Dict[str, str] = {}
    for name, (atype, active, icon) in account_configs.items():
        legacy_aliases = {"Bospar": ["Danske Bank"]}.get(name, [])
        existing = session.exec(
            select(Account).where(Account.user_id == user_id, Account.name == name)
        ).one_or_none()
        if existing is None and legacy_aliases:
            existing = session.exec(
                select(Account).where(
                    Account.user_id == user_id, Account.name.in_(legacy_aliases)
                )
            ).one_or_none()
        if existing:
            existing.account_type = atype
            existing.is_active = active
            existing.name = name
            existing.icon = icon
            account_ids[name] = existing.id
            continue
        acc = Account(name=name, account_type=atype, is_active=active, icon=icon)
        session.add(acc)
        session.flush()
        account_ids[name] = acc.id

    session.commit()

    offset = session.exec(
        select(Account).where(Account.user_id == user_id, Account.name == "Offset")
    ).one_or_none()
    if not offset:
        offset = Account(
            name="Offset",
            account_type=AccountType.NORMAL,
            is_active=False,
        )
        session.add(offset)
        session.flush()
    else:
        offset.name = offset.name or "Offset"
    account_ids["_offset"] = offset.id

    return rename_map, account_ids


def ensure_categories(session, user_id: str, tx_df: pd.DataFrame) -> Tuple[Dict[str, str], Dict[str, CategoryType]]:
    def resolve(typeset):
        if "Income" in typeset and "Expense" in typeset:
            return CategoryType.ADJUSTMENT
        if "Income" in typeset:
            return CategoryType.INCOME
        if "Expense" in typeset:
            return CategoryType.EXPENSE
        return CategoryType.ADJUSTMENT

    cat_map: Dict[str, set] = {}
    for _, row in tx_df.iterrows():
        cat = row["Category"]
        ttype = row["Type"]
        if pd.isna(cat):
            continue
        cat = str(cat).strip()
        if cat in {"Investment", "Bospar"}:
            continue
        cat_map.setdefault(cat, set()).add(ttype)

    category_ids: Dict[str, str] = {}
    category_types: Dict[str, CategoryType] = {}
    for cat, typeset in cat_map.items():
        ctype = resolve(typeset)
        existing = session.exec(
            select(Category).where(Category.user_id == user_id, Category.name == cat)
        ).one_or_none()
        if existing:
            existing.category_type = ctype
            category_ids[cat] = existing.id
            category_types[cat] = ctype
            continue
        c = Category(name=cat, category_type=ctype)
        session.add(c)
        session.flush()
        category_ids[cat] = c.id
        category_types[cat] = ctype

    if "Adjustment" not in category_ids:
        c = Category(name="Adjustment", category_type=CategoryType.ADJUSTMENT)
        session.add(c)
        session.flush()
        category_ids["Adjustment"] = c.id
        category_types["Adjustment"] = CategoryType.ADJUSTMENT

    loan_cat = session.exec(
        select(Category).where(Category.user_id == user_id, Category.name == "CSN Loan")
    ).one_or_none()
    if not loan_cat:
        loan_cat = Category(name="CSN Loan", category_type=CategoryType.LOAN)
        session.add(loan_cat)
        session.flush()
    category_ids["CSN Loan"] = loan_cat.id
    category_types["CSN Loan"] = CategoryType.LOAN

    session.commit()
    return category_ids, category_types


def purge_all_transactional_data(session) -> int:
    """Delete all transactional data across users (transactions, legs, loans, investment snapshots)."""

    statements = [
        delete(InvestmentHolding).execution_options(include_all_users=True),
        delete(InvestmentSnapshot).execution_options(include_all_users=True),
        delete(LoanEvent).execution_options(include_all_users=True),
        delete(TransactionLeg).execution_options(include_all_users=True),
        delete(Transaction).execution_options(include_all_users=True),
        delete(Loan).execution_options(include_all_users=True),
    ]
    total_deleted = 0
    for stmt in statements:
        result = session.exec(stmt)
        total_deleted += result.rowcount or 0
    session.commit()
    return total_deleted


def import_investment_snapshots_from_legacy(
    session,
    *,
    user_id: str,
    tx_df: pd.DataFrame,
    rename_map: Dict[str, str],
    investment_account_names: Sequence[str],
) -> None:
    """Derive aggregate investment snapshots from legacy account balances.

    The legacy export models investment value changes as per-account income deltas
    (including negative values) and transfers into/out of investment accounts.
    In the new system, investment value belongs in `InvestmentSnapshot` (not categories).
    """

    investment_accounts = set(investment_account_names)
    if not investment_accounts:
        print("No investment accounts configured; skipping investment snapshots.")
        return

    def normalize(value: object) -> Optional[str]:
        if value is None or pd.isna(value):
            return None
        s = str(value).strip()
        if not s:
            return None
        lowered = s.lower()
        if lowered in {"nan", "undefined", "none"}:
            return None
        return s

    df = tx_df.copy()
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce", format="mixed")
    df = df.dropna(subset=["Date"]).sort_values("Date")
    if df.empty:
        print("No transaction rows found; skipping investment snapshots.")
        return

    quantize = Decimal("0.01")
    balances: dict[str, Decimal] = {name: Decimal("0") for name in investment_accounts}

    # Accumulate end-of-day totals where investment value changes.
    daily_totals: dict[date, Decimal] = {}
    daily_accounts: dict[date, dict[str, Decimal]] = {}

    for row in df.itertuples(index=False):
        ttype = str(row.Type)
        src_raw = normalize(row.Account)
        if not src_raw:
            continue
        src_name = rename_map.get(src_raw, src_raw)

        category_raw = normalize(getattr(row, "Category", None))
        dest_name = rename_map.get(category_raw, category_raw) if category_raw else None

        try:
            amount = Decimal(str(row.Amount))
        except Exception:
            continue

        amt = abs(amount).quantize(quantize)

        if ttype == "Transfer-Out":
            if src_name in investment_accounts:
                balances[src_name] -= amt
            if dest_name and dest_name in investment_accounts:
                balances[dest_name] += amt
        elif ttype == "Expense":
            if src_name in investment_accounts:
                balances[src_name] -= amt
        else:  # Income (including negative deltas)
            if src_name in investment_accounts:
                balances[src_name] += amount.quantize(quantize)

        day = pd.to_datetime(row.Date).to_pydatetime().date()
        daily_totals[day] = sum(balances.values(), Decimal("0")).quantize(quantize)
        daily_accounts[day] = {name: value.quantize(quantize) for name, value in balances.items()}

    if not daily_totals:
        print("No investment balance changes detected; skipping investment snapshots.")
        return

    days_sorted = sorted(daily_totals.keys())
    latest_total = daily_totals[days_sorted[-1]]

    inserted = 0
    for day in days_sorted:
        per_account = daily_accounts.get(day) or {}
        snapshot = InvestmentSnapshot(
            provider="legacy",
            report_type="balance_derived",
            account_name="Legacy investments (derived)",
            snapshot_date=day,
            portfolio_value=daily_totals[day],
            raw_text="Derived from legacy Transactions Export.xlsx",
            parsed_payload={
                "source": "Transactions Export.xlsx",
                "method": "running_balance",
                "investment_accounts": sorted(investment_accounts),
                "portfolio_value": float(daily_totals[day]),
                "accounts": {name: float(value) for name, value in per_account.items()},
            },
        )
        session.add(snapshot)
        inserted += 1

    session.commit()
    print(f"Investment snapshots inserted: {inserted} (latest value: {latest_total})")


def import_loans(
    session, user_id: str, account_ids: Dict[str, str], loan_cat_id: str, cash_account: str
) -> None:
    ts = TransactionService(session)
    loan_df = pd.read_excel(LOAN_PATH)
    total = len(loan_df)
    if not total:
        print("No loan rows found; skipping.")
        return

    loan_account = session.exec(
        select(Account).where(Account.user_id == user_id, Account.name == "CSN Loan")
    ).one_or_none()
    if not loan_account:
        loan_account = Account(name="CSN Loan", account_type=AccountType.DEBT, is_active=True)
        session.add(loan_account)
        session.flush()
    else:
        loan_account.name = loan_account.name or "CSN Loan"

    loan = session.exec(select(Loan).where(Loan.account_id == loan_account.id)).one_or_none()
    if not loan:
        csn_total = Decimal(str(loan_df["amount"].sum()))
        loan = Loan(
            account_id=loan_account.id,
            origin_principal=csn_total,
            current_principal=csn_total,
            interest_rate_annual=Decimal("0"),
            interest_compound=InterestCompound.YEARLY,
        )
        session.add(loan)
        session.flush()
    session.commit()

    inserted = 0
    for idx, row in loan_df.iterrows():
        amount = Decimal(str(row["amount"]))
        if amount == 0:
            progress("Loans", idx + 1, total)
            continue
        occurred_at = pd.to_datetime(row["date"]).to_pydatetime()
        legs = [
            TransactionLeg(account_id=loan_account.id, amount=-amount),
            TransactionLeg(account_id=account_ids[cash_account], amount=amount),
        ]
        tx = Transaction(
            category_id=loan_cat_id,
            transaction_type=TransactionType.TRANSFER,
            description="CSN payout",
            occurred_at=occurred_at,
            posted_at=occurred_at,
            status=TransactionStatus.IMPORTED,
            created_source=CreatedSource.IMPORT,
            external_id=make_external_id(occurred_at, "CSN", amount, "CSN Loan", "", "Loan"),
        )
        try:
            ts.create_transaction(tx, legs)
            inserted += 1
        except IntegrityError:
            session.rollback()
        progress("Loans", idx + 1, total)
    session.commit()
    print(f"Loans inserted: {inserted}/{total}")


def adjust_study_grants_with_loans(tx_df: pd.DataFrame, loan_df: pd.DataFrame) -> pd.DataFrame:
    """Reduce Study Grant income rows by nearby loan payouts to avoid double-counting cash."""

    if tx_df.empty or loan_df.empty:
        return tx_df

    adjusted = tx_df.copy()
    study_mask = adjusted["Category"].astype(str).str.strip().eq("Study Grant")
    if not study_mask.any():
        return adjusted

    study_dates = pd.to_datetime(adjusted.loc[study_mask, "Date"], errors="coerce", format="mixed")
    study_remaining: dict[int, Decimal] = {}
    for idx, amount in adjusted.loc[study_mask, "Amount"].items():
        try:
            study_remaining[idx] = Decimal(str(amount))
        except Exception:
            study_remaining[idx] = Decimal("0")

    loan_dates = pd.to_datetime(loan_df["date"], errors="coerce", format="mixed")

    for loan_idx, loan_row in loan_df.iterrows():
        try:
            loan_amount = Decimal(str(loan_row["amount"]))
        except Exception:
            continue
        if loan_amount <= 0:
            continue

        loan_date = loan_dates.iloc[loan_idx]
        if pd.isna(loan_date):
            continue

        diffs = (study_dates - loan_date).abs()
        if diffs.isna().all():
            continue
        study_idx = diffs.idxmin()

        remaining = study_remaining.get(study_idx)
        if remaining is None:
            continue

        new_value = remaining - loan_amount
        if new_value < 0:
            new_value = Decimal("0")
        study_remaining[study_idx] = new_value

    for idx, value in study_remaining.items():
        adjusted.at[idx, "Amount"] = float(value)

    return adjusted


def import_transactions(
    session,
    rename_map: Dict[str, str],
    account_ids: Dict[str, str],
    investment_account_ids: set[UUID],
    cat_ids: Dict[str, str],
    cat_types: Dict[str, CategoryType],
    tx_df: Optional[pd.DataFrame] = None,
    *,
    batch_size: int = 1000,
) -> None:
    df = tx_df.copy() if tx_df is not None else pd.read_excel(TX_PATH)
    total = len(df)
    inserted = skipped = zero_skipped = dup_skipped = 0
    investment_skipped = investment_transfer_redirected = 0
    offset_id = account_ids["_offset"]
    quantize = Decimal("0.01")
    user_id = session.info.get("user_id")
    seen_external: set[str] = set()

    def normalize(value: object) -> Optional[str]:
        if value is None or pd.isna(value):
            return None
        s = str(value).strip()
        if not s:
            return None
        lowered = s.lower()
        if lowered in {"nan", "undefined", "none"}:
            return None
        return s

    transactions: list[Transaction] = []
    legs_pending: list[tuple[int, list[TransactionLeg]]] = []

    def infer_transaction_type(
        legs: Iterable[TransactionLeg], category_type: Optional[CategoryType], fallback: TransactionType
    ) -> TransactionType:
        if fallback == TransactionType.ADJUSTMENT:
            return TransactionType.ADJUSTMENT
        if category_type is not None:
            mapping = {
                CategoryType.INCOME: TransactionType.INCOME,
                CategoryType.EXPENSE: TransactionType.EXPENSE,
                CategoryType.ADJUSTMENT: TransactionType.ADJUSTMENT,
                CategoryType.INTEREST: TransactionType.EXPENSE,
                CategoryType.LOAN: TransactionType.TRANSFER,
            }
            mapped = mapping.get(category_type)
            if mapped is not None:
                return mapped

        amounts = [Decimal(leg.amount) for leg in legs]
        has_positive = any(val > 0 for val in amounts)
        has_negative = any(val < 0 for val in amounts)
        if has_positive and has_negative:
            return TransactionType.TRANSFER
        return fallback

    def validate_legs(tx_type: TransactionType, legs: Iterable[TransactionLeg]) -> None:
        legs_list = list(legs)
        ensure_balanced_legs([leg.amount for leg in legs_list])
        has_positive = any(Decimal(leg.amount) > 0 for leg in legs_list)
        has_negative = any(Decimal(leg.amount) < 0 for leg in legs_list)
        if not (has_positive and has_negative):
            raise ValueError("Transactions must include positive and negative legs")
        if tx_type == TransactionType.TRANSFER:
            unique_accounts = {leg.account_id for leg in legs_list}
            if len(unique_accounts) < 2:
                raise ValueError("Transfers require at least two distinct accounts")

    for idx, row in enumerate(df.itertuples(index=False), start=1):
        amount = Decimal(str(row.Amount))
        if amount == 0:
            zero_skipped += 1
            progress("Transactions", idx, total)
            continue

        occurred_at = pd.to_datetime(row.Date).to_pydatetime()
        acct_raw = normalize(row.Account)
        if not acct_raw:
            skipped += 1
            progress("Transactions", idx, total)
            continue

        account_name = rename_map.get(acct_raw, acct_raw)
        account_id = account_ids.get(account_name)
        if not account_id:
            skipped += 1
            progress("Transactions", idx, total)
            continue

        if account_id in investment_account_ids and str(row.Type) != "Transfer-Out":
            investment_skipped += 1
            progress("Transactions", idx, total)
            continue

        category_name = normalize(getattr(row, "Category", None))
        if category_name in {"Investment", "Bospar"} and str(row.Type) != "Transfer-Out":
            investment_skipped += 1
            progress("Transactions", idx, total)
            continue

        category_id = cat_ids.get(category_name) if category_name else None
        note_str = normalize(getattr(row, "Note", None)) or ""
        ttype = str(row.Type)
        external_id = make_external_id(
            occurred_at, account_name, amount, category_name, note_str, ttype
        )
        if external_id in seen_external:
            dup_skipped += 1
            progress("Transactions", idx, total)
            continue
        seen_external.add(external_id)

        description = note_str or category_name
        if ttype == "Transfer-Out":
            dest_name = rename_map.get(category_name, category_name) if category_name else None
            dest_id = account_ids.get(dest_name or "")
            if dest_id is None:
                raise ValueError(
                    f"Transfer-Out missing destination account mapping for category '{category_name}'"
                )
            amt = abs(amount).quantize(quantize)
            src_is_invest = account_id in investment_account_ids
            dest_is_invest = dest_id in investment_account_ids
            if src_is_invest and dest_is_invest:
                investment_skipped += 1
                progress("Transactions", idx, total)
                continue
            if src_is_invest and not dest_is_invest:
                legs = [
                    TransactionLeg(account_id=dest_id, amount=amt),
                    TransactionLeg(account_id=offset_id, amount=-amt),
                ]
                tx_type = TransactionType.TRANSFER
                category_id = None
                category_type = None
                description = note_str or f"Transfer from investments to {dest_name}"
                investment_transfer_redirected += 1
            elif dest_is_invest and not src_is_invest:
                legs = [
                    TransactionLeg(account_id=account_id, amount=-amt),
                    TransactionLeg(account_id=offset_id, amount=amt),
                ]
                tx_type = TransactionType.TRANSFER
                category_id = None
                category_type = None
                description = note_str or f"Transfer to investments ({dest_name})"
                investment_transfer_redirected += 1
            else:
                if dest_id == account_id:
                    tx_type = TransactionType.ADJUSTMENT
                    legs = [
                        TransactionLeg(account_id=account_id, amount=-amt),
                        TransactionLeg(account_id=offset_id, amount=amt),
                    ]
                    description = note_str or "Adjustment (self transfer)"
                else:
                    legs = [
                        TransactionLeg(account_id=account_id, amount=-amt),
                        TransactionLeg(account_id=dest_id, amount=amt),
                    ]
                    tx_type = TransactionType.TRANSFER
                category_id = None
                category_type = None
                description = note_str or f"Transfer to {dest_name}"
        elif ttype == "Income":
            if amount < 0:
                tx_type = TransactionType.ADJUSTMENT
                category_id = category_id or cat_ids.get("Adjustment")
                amt = abs(amount).quantize(quantize)
                legs = [
                    TransactionLeg(account_id=account_id, amount=-amt),
                    TransactionLeg(account_id=offset_id, amount=amt),
                ]
            else:
                tx_type = TransactionType.INCOME
                amt = abs(amount).quantize(quantize)
                legs = [
                    TransactionLeg(account_id=account_id, amount=amt),
                    TransactionLeg(account_id=offset_id, amount=-amt),
                ]
        else:  # Expense
            tx_type = TransactionType.EXPENSE
            amt = abs(amount).quantize(quantize)
            legs = [
                TransactionLeg(account_id=account_id, amount=-amt),
                TransactionLeg(account_id=offset_id, amount=amt),
            ]

        category_type = (
            cat_types.get(category_name) if category_name and ttype != "Transfer-Out" else None
        )
        inferred_type = infer_transaction_type(legs, category_type, tx_type)
        validate_legs(inferred_type, legs)

        tx = Transaction(
            category_id=category_id,
            transaction_type=inferred_type,
            description=description,
            occurred_at=occurred_at,
            posted_at=occurred_at,
            status=TransactionStatus.IMPORTED,
            created_source=CreatedSource.IMPORT,
            external_id=external_id,
        )
        if user_id:
            tx.user_id = user_id
            for leg in legs:
                leg.user_id = user_id
        transactions.append(tx)
        legs_pending.append((len(transactions) - 1, legs))

        progress("Transactions", idx, total)

    # Bulk insert transactions to get IDs, then bulk insert legs
    for start in range(0, len(transactions), batch_size):
        chunk = transactions[start : start + batch_size]
        session.bulk_save_objects(chunk, return_defaults=True)
        session.commit()
    inserted = len(transactions)

    legs_to_insert: list[TransactionLeg] = []
    for tx_index, legs in legs_pending:
        tx_id = transactions[tx_index].id
        for leg in legs:
            leg.transaction_id = tx_id
            legs_to_insert.append(leg)

    for start in range(0, len(legs_to_insert), batch_size * 2):
        chunk = legs_to_insert[start : start + batch_size * 2]
        session.bulk_save_objects(chunk, return_defaults=False)
        session.commit()

    print(
        f"Transactions inserted: {inserted}/{total} (zero skipped: {zero_skipped}, dupes skipped: {dup_skipped}, investment skipped: {investment_skipped}, investment transfers redirected: {investment_transfer_redirected}, other skipped: {skipped})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="One-off legacy import")
    parser.add_argument("--user", required=True, help="Target user id")
    parser.add_argument("--stage", default="default", help="SSM stage prefix")
    parser.add_argument(
        "--loan-cash-account",
        default="Swedbank",
        help="Account name receiving CSN payouts after rename mapping",
    )
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL") or fetch_db_url_from_ssm(args.stage)
    configure_engine(db_url, pool_pre_ping=True)

    session = get_session()
    session.expire_on_commit = False
    scope_session_to_user(session, args.user)

    tx_df = pd.read_excel(TX_PATH)
    loan_df = pd.read_excel(LOAN_PATH)
    tx_df = adjust_study_grants_with_loans(tx_df, loan_df)

    rename_map, account_ids = ensure_accounts(session, args.user)
    purged = purge_all_transactional_data(session)
    print(f"Purged existing transactional rows across all users: {purged}")

    # Ensure legacy-specific categories don't linger.
    session.exec(
        delete(Category)
        .where(Category.user_id == args.user, Category.name.in_(["Investment", "Bospar"]))
        .execution_options(include_all_users=True)
    )
    session.commit()

    investment_account_ids = set(
        session.exec(
            select(Account.id).where(
                Account.user_id == args.user,
                Account.account_type == AccountType.INVESTMENT,
            )
        ).all()
    )
    investment_account_names = [
        name
        for name, acc_id in account_ids.items()
        if name != "_offset" and acc_id in investment_account_ids
    ]

    import_investment_snapshots_from_legacy(
        session,
        user_id=args.user,
        tx_df=tx_df,
        rename_map=rename_map,
        investment_account_names=investment_account_names,
    )

    cat_ids, cat_types = ensure_categories(session, args.user, tx_df)

    import_loans(session, args.user, account_ids, cat_ids["CSN Loan"], args.loan_cash_account)
    import_transactions(
        session,
        rename_map,
        account_ids,
        investment_account_ids,
        cat_ids,
        cat_types,
        tx_df=tx_df,
    )


if __name__ == "__main__":
    main()
