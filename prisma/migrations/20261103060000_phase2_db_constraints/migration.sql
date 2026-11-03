-- Append-only protection for the points ledger.
CREATE TRIGGER IF NOT EXISTS point_ledger_no_update
BEFORE UPDATE ON "PointLedger"
BEGIN
  SELECT RAISE(ABORT, 'PointLedger is append-only');
END;

CREATE TRIGGER IF NOT EXISTS point_ledger_no_delete
BEFORE DELETE ON "PointLedger"
BEGIN
  SELECT RAISE(ABORT, 'PointLedger is append-only');
END;

-- Basic non-negative inventory protection.
CREATE TRIGGER IF NOT EXISTS reward_stock_nonnegative_update
BEFORE UPDATE ON "Reward"
WHEN NEW."stock" < 0
BEGIN
  SELECT RAISE(ABORT, 'Reward stock cannot be negative');
END;

CREATE TRIGGER IF NOT EXISTS reward_stock_nonnegative_insert
BEFORE INSERT ON "Reward"
WHEN NEW."stock" < 0
BEGIN
  SELECT RAISE(ABORT, 'Reward stock cannot be negative');
END;
