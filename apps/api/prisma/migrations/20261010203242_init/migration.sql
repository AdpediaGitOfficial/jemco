-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "out_of_office" BOOLEAN NOT NULL DEFAULT false,
    "department_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_map" (
    "process" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "primary_pic_id" UUID,
    "backup_pic_id" UUID,

    CONSTRAINT "routing_map_pkey" PRIMARY KEY ("process")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_other" TEXT,
    "process" TEXT NOT NULL,
    "process_other" TEXT,
    "priority" TEXT NOT NULL,
    "customer_name" TEXT,
    "supplier_name" TEXT,
    "po_do_number" TEXT NOT NULL,
    "delivery_date" DATE,
    "cef_number" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "quantity_unit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "raised_by_id" UUID NOT NULL,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triaged_by_id" UUID,
    "triaged_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "rejection_text" TEXT,
    "duplicate_of_id" UUID,
    "info_question" TEXT,
    "info_answer" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ncrs" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "complaint_id" UUID,
    "state" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "priority" TEXT NOT NULL,
    "department_id" UUID NOT NULL,
    "assignee_id" UUID,
    "respond_by" DATE,
    "return_count" INTEGER NOT NULL DEFAULT 0,
    "triage_notes" TEXT,
    "containment" TEXT,
    "root_cause" TEXT,
    "root_cause_category" TEXT,
    "action_plan" TEXT,
    "completed_at" TIMESTAMP(3),
    "dispositions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disposition_note" TEXT,
    "cost_of_nc" DECIMAL(14,2),
    "verification_result" TEXT,
    "return_reason" TEXT,
    "qa_justification" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMP(3),
    "effectiveness_due" DATE,
    "effectiveness_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ncrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "ncr_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "complaint_id" UUID,
    "ncr_id" UUID,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ncr_links" (
    "from_id" UUID NOT NULL,
    "to_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "ncr_links_pkey" PRIMARY KEY ("from_id","to_id")
);

-- CreateTable
CREATE TABLE "state_transitions" (
    "from_state" TEXT NOT NULL,
    "to_state" TEXT NOT NULL,
    "roles" TEXT[],
    "reason_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "state_transitions_pkey" PRIMARY KEY ("from_state","to_state")
);

-- CreateTable
CREATE TABLE "transition_log" (
    "id" UUID NOT NULL,
    "ncr_id" UUID NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transition_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "priority" TEXT NOT NULL,
    "triage_days" INTEGER NOT NULL,
    "response_days" INTEGER NOT NULL,
    "resolution_days" INTEGER NOT NULL,
    "verification_days" INTEGER NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("priority")
);

-- CreateTable
CREATE TABLE "sla_clocks" (
    "id" UUID NOT NULL,
    "ncr_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "stopped_at" TIMESTAMP(3),
    "breached_at" TIMESTAMP(3),
    "alert50_at" TIMESTAMP(3),
    "alert80_at" TIMESTAMP(3),

    CONSTRAINT "sla_clocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_calendar" (
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "working_calendar_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "lookup_options" (
    "list" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_ms" TEXT NOT NULL,
    "help_en" TEXT,
    "help_ms" TEXT,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lookup_options_pkey" PRIMARY KEY ("list","code")
);

-- CreateTable
CREATE TABLE "sequences" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "id" BIGSERIAL NOT NULL,
    "table_name" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "actor_id" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_number_key" ON "complaints"("number");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_raised_by_id_idx" ON "complaints"("raised_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ncrs_number_key" ON "ncrs"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ncrs_complaint_id_key" ON "ncrs"("complaint_id");

-- CreateIndex
CREATE INDEX "ncrs_state_idx" ON "ncrs"("state");

-- CreateIndex
CREATE INDEX "ncrs_assignee_id_idx" ON "ncrs"("assignee_id");

-- CreateIndex
CREATE INDEX "ncrs_department_id_idx" ON "ncrs"("department_id");

-- CreateIndex
CREATE INDEX "actions_ncr_id_idx" ON "actions"("ncr_id");

-- CreateIndex
CREATE INDEX "transition_log_ncr_id_idx" ON "transition_log"("ncr_id");

-- CreateIndex
CREATE INDEX "sla_clocks_ncr_id_idx" ON "sla_clocks"("ncr_id");

-- CreateIndex
CREATE INDEX "sla_clocks_due_at_idx" ON "sla_clocks"("due_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "change_log_table_name_row_id_idx" ON "change_log"("table_name", "row_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_map" ADD CONSTRAINT "routing_map_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_map" ADD CONSTRAINT "routing_map_primary_pic_id_fkey" FOREIGN KEY ("primary_pic_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_map" ADD CONSTRAINT "routing_map_backup_pic_id_fkey" FOREIGN KEY ("backup_pic_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_triaged_by_id_fkey" FOREIGN KEY ("triaged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "ncrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "ncrs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_links" ADD CONSTRAINT "ncr_links_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "ncrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ncr_links" ADD CONSTRAINT "ncr_links_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "ncrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_log" ADD CONSTRAINT "transition_log_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "ncrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transition_log" ADD CONSTRAINT "transition_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_clocks" ADD CONSTRAINT "sla_clocks_ncr_id_fkey" FOREIGN KEY ("ncr_id") REFERENCES "ncrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
