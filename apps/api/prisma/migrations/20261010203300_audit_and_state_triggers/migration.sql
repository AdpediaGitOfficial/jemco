-- Audit log: written by trigger on every record table. The application role
-- can INSERT nothing here and never UPDATE/DELETE (grants below assume a
-- separate role in production; locally the owner bypasses them).

CREATE OR REPLACE FUNCTION audit_row_changes() RETURNS trigger AS $$
DECLARE
  col text;
  old_v text;
  new_v text;
  actor uuid;
  row_id text;
BEGIN
  BEGIN
    actor := nullif(current_setting('app.actor_id', true), '')::uuid;
  EXCEPTION WHEN others THEN actor := NULL; END;

  IF TG_OP = 'INSERT' THEN
    row_id := NEW.id::text;
    INSERT INTO change_log(table_name, row_id, field, old_value, new_value, actor_id)
    VALUES (TG_TABLE_NAME, row_id, '*', NULL, 'created', actor);
    RETURN NEW;
  END IF;

  row_id := NEW.id::text;
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME
      AND column_name NOT IN ('updated_at')
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col) INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO change_log(table_name, row_id, field, old_value, new_value, actor_id)
      VALUES (TG_TABLE_NAME, row_id, col, old_v, new_v, actor);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_complaints AFTER INSERT OR UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION audit_row_changes();
CREATE TRIGGER audit_ncrs       AFTER INSERT OR UPDATE ON ncrs       FOR EACH ROW EXECUTE FUNCTION audit_row_changes();
CREATE TRIGGER audit_actions    AFTER INSERT OR UPDATE ON actions    FOR EACH ROW EXECUTE FUNCTION audit_row_changes();

-- No deletes on record tables, ever.
CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Deleting from % is not allowed; close or reject the record instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER no_delete_complaints BEFORE DELETE ON complaints FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER no_delete_ncrs       BEFORE DELETE ON ncrs       FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER no_delete_actions    BEFORE DELETE ON actions    FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER no_delete_change_log BEFORE DELETE ON change_log FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER no_update_change_log BEFORE UPDATE ON change_log FOR EACH ROW EXECUTE FUNCTION forbid_delete();

-- State machine: an NCR may only move along a row in state_transitions.
CREATE OR REPLACE FUNCTION enforce_ncr_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    IF NOT EXISTS (
      SELECT 1 FROM state_transitions WHERE from_state = OLD.state AND to_state = NEW.state
    ) THEN
      RAISE EXCEPTION 'Transition % -> % is not allowed', OLD.state, NEW.state;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER ncr_transition_check BEFORE UPDATE OF state ON ncrs FOR EACH ROW EXECUTE FUNCTION enforce_ncr_transition();

-- Working-day arithmetic: one definition, used by clocks and reports.
CREATE OR REPLACE FUNCTION is_working_day(d date) RETURNS boolean AS $$
  SELECT extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM working_calendar w WHERE w.date = d);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION add_working_days(start_d date, n int) RETURNS date AS $$
DECLARE d date := start_d; added int := 0;
BEGIN
  WHILE added < n LOOP
    d := d + 1;
    IF is_working_day(d) THEN added := added + 1; END IF;
  END LOOP;
  RETURN d;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION working_days_between(a date, b date) RETURNS int AS $$
  SELECT count(*)::int FROM generate_series(a + 1, b, interval '1 day') g WHERE is_working_day(g::date);
$$ LANGUAGE sql STABLE;

-- Numbering: atomic per-year sequence. Returns e.g. 'NCR-2026-0042'.
CREATE OR REPLACE FUNCTION next_number(prefix text) RETURNS text AS $$
DECLARE k text := prefix || '-' || to_char(now(), 'YYYY'); v int;
BEGIN
  INSERT INTO sequences(key, value) VALUES (k, 1)
  ON CONFLICT (key) DO UPDATE SET value = sequences.value + 1
  RETURNING value INTO v;
  RETURN k || '-' || lpad(v::text, 4, '0');
END;
$$ LANGUAGE plpgsql;
