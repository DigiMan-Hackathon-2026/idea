import { sql } from "drizzle-orm";
import {
  check,
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const supplierOrganizations = pgTable(
  "supplier_orgs",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "supplier_orgs_name_length_ck",
      sql`char_length(btrim(${table.name})) between 1 and 120`,
    ),
    check(
      "supplier_orgs_kind_ck",
      sql`${table.kind} in ('internal', 'external')`,
    ),
    check(
      "supplier_orgs_status_ck",
      sql`${table.status} in ('active', 'suspended', 'archived')`,
    ),
  ],
);

export const adminPrincipals = pgTable(
  "admin_principals",
  {
    id: uuid("id").primaryKey(),
    issuer: varchar("issuer", { length: 300 }).notNull(),
    subject: varchar("subject", { length: 300 }).notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("admin_principals_issuer_subject_uq").on(
      table.issuer,
      table.subject,
    ),
    check(
      "admin_principals_issuer_nonempty_ck",
      sql`char_length(btrim(${table.issuer})) > 0`,
    ),
    check(
      "admin_principals_subject_nonempty_ck",
      sql`char_length(btrim(${table.subject})) > 0`,
    ),
    check(
      "admin_principals_role_ck",
      sql`${table.role} in ('editor', 'admin')`,
    ),
    check(
      "admin_principals_status_ck",
      sql`${table.status} in ('active', 'disabled')`,
    ),
  ],
);

export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const visitorSessions = pgTable(
  "visitor_sessions",
  {
    id: uuid("id").primaryKey(),
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => visitors.id, { onDelete: "cascade" }),
    tokenHashVersion: integer("token_hash_version").notNull(),
    tokenHash: bytea("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("visitor_sessions_token_hash_uq").on(
      table.tokenHashVersion,
      table.tokenHash,
    ),
    check(
      "visitor_sessions_hash_version_ck",
      sql`${table.tokenHashVersion} between 1 and 32767`,
    ),
    check(
      "visitor_sessions_hash_length_ck",
      sql`octet_length(${table.tokenHash}) = 32`,
    ),
    check(
      "visitor_sessions_expiry_ck",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    index("visitor_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey(),
    nameJa: varchar("name_ja", { length: 200 }),
    addressKo: varchar("address_ko", { length: 300 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "places_address_length_ck",
      sql`char_length(btrim(${table.addressKo})) between 1 and 300`,
    ),
    check(
      "places_latitude_ck",
      sql`${table.latitude} is null or ${table.latitude} between -90 and 90`,
    ),
    check(
      "places_longitude_ck",
      sql`${table.longitude} is null or ${table.longitude} between -180 and 180`,
    ),
    check(
      "places_coordinate_pair_ck",
      sql`(${table.latitude} is null) = (${table.longitude} is null)`,
    ),
  ],
);
