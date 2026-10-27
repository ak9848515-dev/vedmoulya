// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency / Client Ops Schema Statements
//
// Single source of truth for the DDL of every table declared in
// `src/schema/content-agency.ts`.
//
// WHY THIS EXISTS
// ---------------
// The estate convention is that every Postgres store creates its own table
// with an idempotent `CREATE TABLE IF NOT EXISTS` on startup (identity,
// capabilities, context, enterprise-brain, goals, … all do). The
// content-agency / client-ops tables were the ONE exception: `schema/
// content-agency.ts` declared 16 tables, but no DDL, migration or bootstrap
// existed anywhere in the repository (there are no `.sql` files at all).
// The live database therefore had ZERO `content_agency_*` / `client_ops_*`
// tables, and every Client Ops query failed with `relation does not exist`
// — including leads, proposals, contracts, quotations, invoices and
// payments, i.e. the entire revenue-recording surface.
//
// These statements mirror `schema/content-agency.ts` column-for-column
// (types, nullability and defaults). Every statement is idempotent, so
// running it against an existing database is a no-op and never destroys
// data. Executed exactly once per process by
// `DatabaseConnection.initializeDatabase()`.
// ──────────────────────────────────────────────────────────────────

import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export const CONTENT_AGENCY_SCHEMA_STATEMENTS: SQL[] = [
  // ── Clients ──────────────────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS content_agency_clients (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        company varchar(200) NOT NULL,
        industry varchar(120) DEFAULT '',
        brand_voice text DEFAULT '',
        target_audience text DEFAULT '',
        products jsonb DEFAULT '[]'::jsonb,
        services jsonb DEFAULT '[]'::jsonb,
        goals jsonb DEFAULT '[]'::jsonb,
        website varchar(500) DEFAULT '',
        social_links jsonb DEFAULT '{}'::jsonb,
        ai_memory text DEFAULT '',
        documents jsonb DEFAULT '[]'::jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cac_user_idx ON content_agency_clients (user_id)`,

  // ── Brand Profiles ───────────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS content_agency_brands (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64),
        name varchar(200) NOT NULL,
        tone text DEFAULT '',
        writing_style text DEFAULT '',
        vocabulary jsonb DEFAULT '[]'::jsonb,
        do_rules jsonb DEFAULT '[]'::jsonb,
        dont_rules jsonb DEFAULT '[]'::jsonb,
        cta_style text DEFAULT '',
        competitors jsonb DEFAULT '[]'::jsonb,
        keywords jsonb DEFAULT '[]'::jsonb,
        color_palette jsonb DEFAULT '[]'::jsonb,
        mission text DEFAULT '',
        vision text DEFAULT '',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cab_user_idx ON content_agency_brands (user_id)`,

  // ── Projects ─────────────────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS content_agency_projects (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        brand_id varchar(64),
        name varchar(200) NOT NULL,
        description text DEFAULT '',
        status varchar(24) NOT NULL DEFAULT 'active',
        start_date varchar(32) DEFAULT '',
        end_date varchar(32),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cap_user_idx ON content_agency_projects (user_id)`,

  // ── Content Items ────────────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS content_agency_content (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        brand_id varchar(64),
        project_id varchar(64),
        content_type varchar(32) NOT NULL,
        title varchar(300) NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'draft',
        workflow_stage varchar(32) NOT NULL DEFAULT 'brief',
        brief text DEFAULT '',
        target_audience text DEFAULT '',
        goals jsonb DEFAULT '[]'::jsonb,
        versions jsonb DEFAULT '[]'::jsonb,
        reviews jsonb DEFAULT '[]'::jsonb,
        ai_metadata jsonb,
        scheduled_for varchar(32),
        published_url varchar(500),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cacontent_user_idx ON content_agency_content (user_id)`,

  // ── Invoices ─────────────────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS content_agency_invoices (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        project_id varchar(64),
        description varchar(500) DEFAULT '',
        amount double precision DEFAULT 0,
        currency varchar(8) DEFAULT 'USD',
        status varchar(16) NOT NULL DEFAULT 'draft',
        issued_at varchar(32) DEFAULT '',
        due_date varchar(32),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cai_user_idx ON content_agency_invoices (user_id)`,

  // ── Client Ops: Leads ────────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_leads (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        company varchar(200) NOT NULL,
        contact_name varchar(200) DEFAULT '',
        contact_email varchar(320) DEFAULT '',
        contact_phone varchar(60) DEFAULT '',
        industry varchar(120) DEFAULT '',
        source varchar(60) DEFAULT '',
        status varchar(20) NOT NULL DEFAULT 'lead',
        archived boolean NOT NULL DEFAULT false,
        value double precision DEFAULT 0,
        currency varchar(8) DEFAULT 'USD',
        health_score double precision DEFAULT 50,
        next_follow_up varchar(32),
        notes text DEFAULT '',
        client_id varchar(64),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS col_user_idx ON client_ops_leads (user_id)`,

  sql`
      CREATE TABLE IF NOT EXISTS client_ops_lead_interactions (
        id varchar(64) PRIMARY KEY,
        lead_id varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        type varchar(20) NOT NULL,
        summary text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS coli_lead_idx ON client_ops_lead_interactions (lead_id)`,

  sql`
      CREATE TABLE IF NOT EXISTS client_ops_lead_tasks (
        id varchar(64) PRIMARY KEY,
        lead_id varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        title varchar(300) NOT NULL,
        due_at varchar(32),
        completed boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS colt_lead_idx ON client_ops_lead_tasks (lead_id)`,

  sql`
      CREATE TABLE IF NOT EXISTS client_ops_lead_contacts (
        id varchar(64) PRIMARY KEY,
        lead_id varchar(64) NOT NULL,
        user_id varchar(64) NOT NULL,
        name varchar(200) NOT NULL,
        email varchar(320) DEFAULT '',
        phone varchar(60) DEFAULT '',
        role varchar(120) DEFAULT '',
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS colc_lead_idx ON client_ops_lead_contacts (lead_id)`,

  // ── Client Ops: Proposals ────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_proposals (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        title varchar(300) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'draft',
        lead_id varchar(64),
        client_id varchar(64),
        current_version integer NOT NULL DEFAULT 1,
        versions jsonb DEFAULT '[]'::jsonb,
        ai_metadata jsonb,
        sent_at varchar(32),
        accepted_at varchar(32),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cop_user_idx ON client_ops_proposals (user_id)`,

  // ── Client Ops: Contracts ────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_contracts (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        title varchar(300) NOT NULL,
        start_date varchar(32) NOT NULL,
        end_date varchar(32) NOT NULL,
        value double precision DEFAULT 0,
        currency varchar(8) DEFAULT 'USD',
        status varchar(20) NOT NULL DEFAULT 'draft',
        renewal boolean NOT NULL DEFAULT false,
        auto_renew boolean NOT NULL DEFAULT false,
        current_version integer NOT NULL DEFAULT 1,
        versions jsonb DEFAULT '[]'::jsonb,
        approvals jsonb DEFAULT '[]'::jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS coc_user_idx ON client_ops_contracts (user_id)`,

  // ── Client Ops: Quotations ───────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_quotations (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        title varchar(300) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'draft',
        lead_id varchar(64),
        client_id varchar(64),
        packages jsonb DEFAULT '[]'::jsonb,
        discount double precision DEFAULT 0,
        tax_rate double precision DEFAULT 0,
        recurring boolean NOT NULL DEFAULT false,
        currency varchar(8) DEFAULT 'USD',
        subtotal double precision DEFAULT 0,
        total double precision DEFAULT 0,
        sent_at varchar(32),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS coq_user_idx ON client_ops_quotations (user_id)`,

  // ── Client Ops: Payments ─────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_payments (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        invoice_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        amount double precision NOT NULL DEFAULT 0,
        currency varchar(8) DEFAULT 'USD',
        method varchar(60) DEFAULT 'bank_transfer',
        received_at varchar(32) NOT NULL,
        note text DEFAULT '',
        created_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS cpay_user_idx ON client_ops_payments (user_id)`,

  // ── Client Ops: Documents ────────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_documents (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        project_id varchar(64),
        contract_id varchar(64),
        name varchar(300) NOT NULL,
        kind varchar(40) NOT NULL DEFAULT 'other',
        mime varchar(120) DEFAULT '',
        size integer DEFAULT 0,
        storage_key text DEFAULT '',
        metadata jsonb DEFAULT '{}'::jsonb,
        current_version integer NOT NULL DEFAULT 1,
        versions jsonb DEFAULT '[]'::jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS codoc_user_idx ON client_ops_documents (user_id)`,

  // ── Client Ops: Portal Access ────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_portal_access (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        client_id varchar(64) NOT NULL,
        email varchar(320) NOT NULL,
        token_hash varchar(64) NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        last_login_at varchar(32),
        created_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS copa_user_idx ON client_ops_portal_access (user_id)`,

  // ── Client Ops: Notifications ────────────────────────────────────────────
  sql`
      CREATE TABLE IF NOT EXISTS client_ops_notifications (
        id varchar(64) PRIMARY KEY,
        user_id varchar(64) NOT NULL,
        audience varchar(12) NOT NULL,
        client_id varchar(64),
        type varchar(30) NOT NULL,
        title varchar(300) NOT NULL,
        message text NOT NULL,
        entity_id varchar(64),
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `,
  sql`CREATE INDEX IF NOT EXISTS con_user_idx ON client_ops_notifications (user_id)`,
];

/** Execute one statement list sequentially against a drizzle database. */
export async function executeContentAgencyStatements(
  db: { execute(query: SQL): Promise<unknown> },
  statements: SQL[] = CONTENT_AGENCY_SCHEMA_STATEMENTS,
): Promise<void> {
  for (const statement of statements) {
    await db.execute(statement);
  }
}
