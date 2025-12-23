# Investment snapshot cleanup plan

## Context

- Nordnet snapshot ingestion endpoints and client flows were removed. There are no remaining write paths into `investment_snapshots` / `investment_holdings` from the API.
- Read paths still exist: `apps/api/handlers/investments.investment_metrics` (and `investment_overview`) load snapshots and holdings for analytics, and `apps/api/services/reporting_total.py` queries `InvestmentSnapshot` for totals. Any cleanup must account for these consumers.
- Legacy rows may remain in the `investment_snapshots`, `investment_holdings`, and `investment_transactions` tables and could be stale now that ingestion is gone.

## Recommended migration steps

1. **Inventory & dependency check**
   - Confirm no background jobs or Lambdas write to the snapshot tables (grep for `InvestmentSnapshot`/`InvestmentHolding` outside the handlers noted above).
   - Decide whether analytics/reporting should continue to surface historic snapshot data or rely solely on ledger-derived metrics; update the handlers/services accordingly before dropping tables.
2. **Archive existing rows**
   - Take a timestamped export of the three tables for rollback/audit (e.g. `pg_dump -t investment_snapshots -t investment_holdings -t investment_transactions > backup_investment_snapshots_$(date +%F).sql`).
   - Optionally upload the dump to a restricted S3 bucket with retention tagging before deletion.
3. **Cleanup data if unused**
   - If historic data should be retained elsewhere, insert it into an archive schema or object storage and then delete from the primary tables:  
     `DELETE FROM investment_transactions; DELETE FROM investment_holdings; DELETE FROM investment_snapshots;`  
     (or `TRUNCATE ... CASCADE` if foreign keys demand).
4. **Schema decommissioning**
   - Once code paths are updated to avoid snapshot tables, drop them (and related constraints/indexes) in a migration:  
     `DROP TABLE IF EXISTS investment_transactions; DROP TABLE IF EXISTS investment_holdings; DROP TABLE IF EXISTS investment_snapshots;`
   - Remove ORM models and repository references in the same change to keep the API surface consistent.

Document the chosen path and retention period so reporting expectations are clear before removing the tables.
