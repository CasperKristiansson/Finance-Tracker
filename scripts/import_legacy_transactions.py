"""
One-off importer for legacy transactions/loans.

Usage:
  AWS_PROFILE=Personal python temp.py --user Google_105712732762355947213

Optional flags:
  --stage default                # SSM stage prefix (/finance-tracker/{stage}/db/*)
  --loan-cash-account Swedbank   # Where CSN payouts land (default Swedbank)
"""

from __future__ import annotations

import argparse
import hashlib
import os
from decimal import Decimal
from pathlib import Path
from typing import Dict, Optional

import boto3
import pandas as pd
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from apps.api.models import Account, Category, Loan, Transaction, TransactionLeg
from apps.api.services.transaction import TransactionService
from apps.api.shared import (
    AccountType,
    CategoryType,
    CreatedSource,
    InterestCompound,
    TransactionStatus,
    TransactionType,
    configure_engine,
    scope_session_to_user,
)
from apps.api.shared.session import get_session

BASE_DIR = Path(__file__).resolve().parent
TX_PATH = BASE_DIR / "docs" / "data" / "transactions" / "Transactions Export.xlsx"
LOAN_PATH = BASE_DIR / "docs" / "data" / "transactions" / "Loans Export.xlsx"


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


def ensure_accounts(session, user_id: str) -> Dict[str, str]:
    rename_map = {
        "Card": "Swedbank",
        "Nordnet": "Nordnet Private",
        "Company Nordnet": "Nordnet Company",
        "Company Account": "SEB Company",
        "Swedbank Savings": "Swedbank Savings",
        "Paypal": "Paypal",
        "Gift Card": "Gift Card",
        "Danske Bank": "Danske Bank",
        "Cash": "Cash",
    }
    account_configs = {
        "Swedbank": (AccountType.NORMAL, True, 10),
        "Nordnet Private": (AccountType.INVESTMENT, True, 20),
        "Nordnet Company": (AccountType.INVESTMENT, True, 30),
        "SEB Company": (AccountType.NORMAL, True, 40),
        "Danske Bank": (AccountType.NORMAL, True, 50),
        "Circle K Mastercard": (AccountType.NORMAL, True, 60),
        "Cash": (AccountType.NORMAL, True, 70),
        "Swedbank Savings": (AccountType.NORMAL, False, 900),
        "Paypal": (AccountType.NORMAL, False, 910),
        "Gift Card": (AccountType.NORMAL, False, 920),
    }

    account_ids: Dict[str, str] = {}
    for name, (atype, active, order) in account_configs.items():
        existing = session.exec(
            select(Account).where(Account.user_id == user_id, Account.display_order == order)
        ).one_or_none()
        if existing:
            existing.account_type = atype
            existing.is_active = active
            existing.display_order = order
            account_ids[name] = existing.id
            continue
        acc = Account(account_type=atype, is_active=active, display_order=order)
        session.add(acc)
        session.flush()
        account_ids[name] = acc.id

    session.commit()

    offset = session.exec(
        select(Account).where(Account.user_id == user_id, Account.display_order == 9999)
    ).one_or_none()
    if not offset:
        offset = Account(account_type=AccountType.NORMAL, is_active=False, display_order=9999)
        session.add(offset)
        session.flush()
    account_ids["_offset"] = offset.id

    return rename_map | account_ids  # type: ignore


def ensure_categories(session, user_id: str, tx_df: pd.DataFrame) -> Dict[str, str]:
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
        cat_map.setdefault(cat, set()).add(ttype)

    category_ids: Dict[str, str] = {}
    for cat, typeset in cat_map.items():
        ctype = resolve(typeset)
        existing = session.exec(
            select(Category).where(Category.user_id == user_id, Category.name == cat)
        ).one_or_none()
        if existing:
            existing.category_type = ctype
            category_ids[cat] = existing.id
            continue
        c = Category(name=cat, category_type=ctype)
        session.add(c)
        session.flush()
        category_ids[cat] = c.id

    if "Adjustment" not in category_ids:
        c = Category(name="Adjustment", category_type=CategoryType.ADJUSTMENT)
        session.add(c)
        session.flush()
        category_ids["Adjustment"] = c.id

    loan_cat = session.exec(
        select(Category).where(Category.user_id == user_id, Category.name == "CSN Loan")
    ).one_or_none()
    if not loan_cat:
        loan_cat = Category(name="CSN Loan", category_type=CategoryType.LOAN)
        session.add(loan_cat)
        session.flush()
    category_ids["CSN Loan"] = loan_cat.id

    session.commit()
    return category_ids


def import_loans(session, user_id: str, account_ids: Dict[str, str], loan_cat_id: str, cash_account: str) -> None:
    loan_df = pd.read_excel(LOAN_PATH)
    total = len(loan_df)
    if not total:
        print("No loan rows found; skipping.")
        return

    loan_account = session.exec(
        select(Account).where(Account.user_id == user_id, Account.display_order == 800)
    ).one_or_none()
    if not loan_account:
        loan_account = Account(account_type=AccountType.DEBT, is_active=True, display_order=800)
        session.add(loan_account)
        session.flush()

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

    ts = TransactionService(session)
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


def import_transactions(session, user_id: str, rename_map: Dict[str, str], ids: Dict[str, str], cat_ids: Dict[str, str]) -> None:
    df = pd.read_excel(TX_PATH)
    total = len(df)
    ts = TransactionService(session)
    inserted = skipped = zero_skipped = 0
    offset_id = ids["_offset"]

    for idx, row in df.iterrows():
        amount = Decimal(str(row["Amount"]))
        if amount == 0:
            zero_skipped += 1
            progress("Transactions", idx + 1, total)
            continue

        occurred_at = pd.to_datetime(row["Date"]).to_pydatetime()
        acct_raw = str(row["Account"]).strip()
        account_name = rename_map.get(acct_raw, acct_raw)
        account_id = ids.get(account_name)
        if not account_id:
            skipped += 1
            progress("Transactions", idx + 1, total)
            continue

        category = row.get("Category")
        category_name = None if pd.isna(category) else str(category).strip()
        category_id = cat_ids.get(category_name) if category_name else None
        note = row.get("Note")
        note_str = "" if pd.isna(note) else str(note)
        ttype = row["Type"]

        if ttype == "Transfer-Out":
            dest_raw = category_name
            dest_name = rename_map.get(dest_raw, dest_raw) if dest_raw else None
            dest_id = ids.get(dest_name) or offset_id
            amt = abs(amount)
            legs = [
                TransactionLeg(account_id=account_id, amount=-amt),
                TransactionLeg(account_id=dest_id, amount=amt),
            ]
            tx_type = TransactionType.TRANSFER
        elif ttype == "Income":
            if amount < 0:
                tx_type = TransactionType.ADJUSTMENT
                category_id = category_id or cat_ids.get("Adjustment")
            else:
                tx_type = TransactionType.INCOME
            amt = abs(amount)
            legs = [
                TransactionLeg(account_id=account_id, amount=amt),
                TransactionLeg(account_id=offset_id, amount=-amt),
            ]
        else:  # Expense
            tx_type = TransactionType.EXPENSE
            amt = abs(amount)
            legs = [
                TransactionLeg(account_id=account_id, amount=-amt),
                TransactionLeg(account_id=offset_id, amount=amt),
            ]

        tx = Transaction(
            category_id=category_id,
            transaction_type=tx_type,
            description=note_str or category_name,
            occurred_at=occurred_at,
            posted_at=occurred_at,
            status=TransactionStatus.IMPORTED,
            created_source=CreatedSource.IMPORT,
            external_id=make_external_id(occurred_at, account_name, amount, category_name, note_str, ttype),
        )
        try:
            ts.create_transaction(tx, legs)
            inserted += 1
        except IntegrityError:
            session.rollback()
            skipped += 1
        progress("Transactions", idx + 1, total)

    session.commit()
    print(f"Transactions inserted: {inserted}/{total} (zero skipped: {zero_skipped}, dupes skipped: {skipped})")


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
    scope_session_to_user(session, args.user)

    tx_df = pd.read_excel(TX_PATH)
    rename_and_ids = ensure_accounts(session, args.user)
    cat_ids = ensure_categories(session, args.user, tx_df)

    import_loans(session, args.user, rename_and_ids, cat_ids["CSN Loan"], args.loan_cash_account)
    import_transactions(session, args.user, rename_and_ids, rename_and_ids, cat_ids)


if __name__ == "__main__":
    main()
