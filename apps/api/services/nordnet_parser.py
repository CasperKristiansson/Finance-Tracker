"""Lightweight pre-parser for Nordnet text exports (Swedish formatting)."""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable, Optional


class NordnetPreParser:
    """Parse Nordnet exports into a structured payload before AI cleanup."""

    def parse(self, raw_text: str) -> dict[str, Any]:
        if not raw_text or not raw_text.strip():
            raise ValueError("raw_text is required for parsing")

        lowered = raw_text.lower()
        if "portföljrapport" in lowered or "innehav" in lowered:
            return self._parse_portfolio_report(raw_text)
        if "transaktion" in lowered or "kontoutdrag" in lowered:
            return self._parse_transactions(raw_text)

        # fallback: treat as portfolio-style dump
        return self._parse_portfolio_report(raw_text)

    def _parse_portfolio_report(self, text: str) -> dict[str, Any]:
        lines = self._prep_lines(text)
        snapshot_date = self._extract_latest_date(lines)
        sections = self._split_sections(lines)
        portfolio_value = self._find_number_after_keywords(
            lines, {"marknadsvärde", "total"}
        ) or self._find_number_in_section(sections, {"resultat", "marknadsvärde"})
        holdings = self._parse_holdings(lines)

        payload: dict[str, Any] = {
            "report_type": "portfolio_report",
            "snapshot_date": snapshot_date.isoformat() if snapshot_date else None,
            "portfolio_value": portfolio_value,
            "holdings": holdings,
            "sections": sections,
        }
        return payload

    def _parse_transactions(self, text: str) -> dict[str, Any]:
        lines = self._prep_lines(text)
        sections = self._split_sections(lines)

        rows = []
        i = 0
        while i < len(lines):
            line = lines[i]
            tx_date = self._parse_date(line)
            if tx_date is None:
                i += 1
                continue

            account = self._next_nonempty(lines, i + 1)
            tx_type = self._next_nonempty(lines, i + 2)
            description = self._next_nonempty(lines, i + 3)

            amount_line, amount_idx = self._find_amount_line(lines, start=i + 1)
            amount, currency = self._parse_money(amount_line) if amount_line else (None, None)
            quantity = self._parse_quantity_between(lines, i + 4, amount_idx)

            rows.append(
                {
                    "date": tx_date.isoformat(),
                    "account": account,
                    "transaction_type": tx_type,
                    "description": description,
                    "quantity": quantity,
                    "amount": amount,
                    "currency": currency,
                }
            )

            i = amount_idx + 1 if amount_idx is not None else i + 1

        snapshot_date = self._extract_latest_date(lines)
        payload: dict[str, Any] = {
            "report_type": "transactions",
            "snapshot_date": snapshot_date.isoformat() if snapshot_date else None,
            "rows": rows,
            "sections": sections,
        }
        return payload

    def _prep_lines(self, text: str) -> list[str]:
        return [line.strip() for line in text.splitlines()]

    def _split_sections(self, lines: Iterable[str]) -> dict[str, list[str]]:
        headings = {
            "fördelning",
            "risk",
            "resultat",
            "innehav",
            "aktier",
            "fonder",
            "transaktioner",
            "kontoutdrag",
        }
        sections: dict[str, list[str]] = {}
        current_key: Optional[str] = None

        for line in lines:
            lowered = line.lower()
            key = None
            for heading in headings:
                if lowered.startswith(heading):
                    key = heading
                    break
            if key:
                current_key = key
                sections.setdefault(current_key, [])
                continue
            if current_key:
                if line:
                    sections[current_key].append(line)
        return sections

    def _extract_latest_date(self, lines: Iterable[str]) -> Optional[date]:
        dates = []
        for line in lines:
            parsed = self._parse_date(line)
            if parsed:
                dates.append(parsed)
        return max(dates) if dates else None

    def _parse_date(self, text: str) -> Optional[date]:
        match = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
        if not match:
            return None
        try:
            return date.fromisoformat(match.group(0))
        except ValueError:
            return None

    def _parse_holdings(self, lines: list[str]) -> list[dict[str, Any]]:
        holdings: list[dict[str, Any]] = []
        name: Optional[str] = None
        values: list[str] = []
        started = False

        for line in lines:
            if not line:
                continue
            if not started and line.lower().startswith("innehav"):
                started = True
                continue
            if not started:
                continue
            if self._looks_like_name(line):
                if name:
                    record = self._build_holding(name, values)
                    if record:
                        holdings.append(record)
                name = line
                values = []
            else:
                values.append(line)

        if name:
            record = self._build_holding(name, values)
            if record:
                holdings.append(record)

        return holdings

    def _looks_like_name(self, text: str) -> bool:
        if not text:
            return False
        if re.match(r"^[\d\-\u2212,\. ]+$", text):
            return False
        if text.endswith("%"):
            return False
        if re.search(r"\b(SEK|EUR|USD|NOK|DKK)\b", text) and re.search(r"\d", text):
            return False
        lowered = text.lower()
        if any(
            lowered.startswith(prefix)
            for prefix in ("portföljrapport", "innehav", "fördelning", "resultat", "risk")
        ):
            return False
        return True

    def _build_holding(self, name: str, values: list[str]) -> Optional[dict[str, Any]]:
        if not values:
            return None

        market_price, price_currency = self._parse_money(values[0])
        gav = self._parse_decimal(values[1]) if len(values) > 1 else None
        quantity = self._parse_decimal(values[2]) if len(values) > 2 else None

        market_value, value_currency = (None, None)
        if len(values) > 3:
            market_value, value_currency = self._parse_money(values[3])

        unrealized, _ = (None, None)
        if len(values) > 4:
            unrealized, _ = self._parse_money(values[4])

        allocation_pct = self._parse_percent(values[5]) if len(values) > 5 else None

        currency = price_currency or value_currency or "SEK"
        return {
            "name": name,
            "currency": currency,
            "market_price": market_price,
            "average_price": gav,
            "quantity": quantity,
            "market_value_sek": market_value,
            "unrealized_result": unrealized,
            "allocation_pct": allocation_pct,
        }

    def _parse_percent(self, text: str) -> Optional[float]:
        if not text:
            return None
        cleaned = text.replace("%", "").strip()
        number = self._parse_decimal(cleaned)
        return float(number) if number is not None else None

    def _parse_decimal(self, text: str) -> Optional[Decimal]:
        if text is None:
            return None
        cleaned = (
            text.replace("\u2212", "-")
            .replace("−", "-")
            .replace(" ", "")
            .replace("\xa0", "")
            .replace(",", ".")
        )
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        try:
            return Decimal(match.group(0))
        except InvalidOperation:
            return None

    def _parse_money(self, text: str) -> tuple[Optional[Decimal], Optional[str]]:
        if not text:
            return None, None
        currency_match = re.search(r"\b([A-Z]{3})\b", text)
        currency = currency_match.group(1) if currency_match else None
        number = self._parse_decimal(text)
        return number, currency

    def _find_number_after_keywords(
        self, lines: Iterable[str], keywords: set[str]
    ) -> Optional[Decimal]:
        for line in lines:
            lowered = line.lower()
            if any(keyword in lowered for keyword in keywords):
                number = self._parse_decimal(line)
                if number is not None:
                    return number
        return None

    def _find_number_in_section(
        self, sections: dict[str, list[str]], names: set[str]
    ) -> Optional[Decimal]:
        for name in names:
            for line in sections.get(name, []):
                number = self._parse_decimal(line)
                if number is not None:
                    return number
        return None

    def _find_amount_line(
        self, lines: list[str], start: int = 0
    ) -> tuple[Optional[str], Optional[int]]:
        for idx in range(start, len(lines)):
            line = lines[idx]
            if line and re.search(r"\b(SEK|EUR|USD|NOK|DKK)\b", line):
                return line, idx
        return None, None

    def _parse_quantity_between(
        self, lines: list[str], start: int, end: Optional[int]
    ) -> Optional[Decimal]:
        if end is None:
            return None
        for idx in range(start, end):
            line = lines[idx]
            if re.match(r"^-?\d+(?:,\d+)?$", line):
                return self._parse_decimal(line)
        return None

    def _next_nonempty(self, lines: list[str], start: int) -> Optional[str]:
        for idx in range(start, len(lines)):
            value = lines[idx]
            if value:
                return value
        return None


__all__ = ["NordnetPreParser"]
