-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "notifications_channel_sent_at_idx" ON "notifications"("channel", "sent_at");

-- Audit trigger: accept the key column as an argument so tables without `id` are covered;
-- never log password hashes.
CREATE OR REPLACE FUNCTION audit_row_changes() RETURNS trigger AS $$
DECLARE
  col text; old_v text; new_v text; actor uuid; row_id text; keycol text := coalesce(TG_ARGV[0], 'id');
BEGIN
  BEGIN actor := nullif(current_setting('app.actor_id', true), '')::uuid; EXCEPTION WHEN others THEN actor := NULL; END;
  EXECUTE format('SELECT ($1).%I::text', keycol) INTO row_id USING (CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
  IF TG_OP = 'INSERT' THEN
    INSERT INTO change_log(table_name, row_id, field, old_value, new_value, actor_id) VALUES (TG_TABLE_NAME, row_id, '*', NULL, 'created', actor);
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO change_log(table_name, row_id, field, old_value, new_value, actor_id) VALUES (TG_TABLE_NAME, row_id, '*', 'deleted', NULL, actor);
    RETURN OLD;
  END IF;
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name NOT IN ('updated_at', 'password_hash')
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col) INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO change_log(table_name, row_id, field, old_value, new_value, actor_id) VALUES (TG_TABLE_NAME, row_id, col, old_v, new_v, actor);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Configuration and people are audited too (ISO: who changed a rule, when).
CREATE TRIGGER audit_users          AFTER INSERT OR UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION audit_row_changes('id');
CREATE TRIGGER audit_user_roles     AFTER INSERT OR DELETE ON user_roles      FOR EACH ROW EXECUTE FUNCTION audit_row_changes('user_id');
CREATE TRIGGER audit_routing_map    AFTER INSERT OR UPDATE ON routing_map     FOR EACH ROW EXECUTE FUNCTION audit_row_changes('process');
CREATE TRIGGER audit_sla_policies   AFTER INSERT OR UPDATE ON sla_policies    FOR EACH ROW EXECUTE FUNCTION audit_row_changes('priority');
CREATE TRIGGER audit_lookup_options AFTER INSERT OR UPDATE ON lookup_options  FOR EACH ROW EXECUTE FUNCTION audit_row_changes('code');
CREATE TRIGGER audit_calendar       AFTER INSERT OR DELETE ON working_calendar FOR EACH ROW EXECUTE FUNCTION audit_row_changes('date');
