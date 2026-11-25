import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { places } from "./base";
import { questVersions } from "./content";

const geographyPoint = customType<{ data: string }>({
  dataType: () => "geography(Point,4326)",
});

export const questSearchOrigins = pgTable(
  "quest_search_origins",
  {
    id: uuid("id").primaryKey(),
    kind: text("kind", { enum: ["subway_exit", "bus_stop"] }).notNull(),
    nameKo: text("name_ko").notNull(),
    nameJa: text("name_ja").notNull(),
    location: geographyPoint("location").notNull(),
    source: text("source").notNull(),
    sourceKey: text("source_key").notNull(),
    isSample: boolean("is_sample").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => [
    unique("quest_search_origins_source_key_uq").on(
      table.source,
      table.kind,
      table.sourceKey,
    ),
    check("quest_search_origins_kind_ck", sql`${table.kind} in ('subway_exit', 'bus_stop')`),
    check(
      "quest_search_origins_verification_ck",
      sql`(${table.isSample} or ${table.verifiedAt} is not null)
        and (${table.kind} <> 'bus_stop' or ${table.isSample})`,
    ),
    check(
      "quest_search_origins_labels_ck",
      sql`btrim(${table.nameKo}) <> '' and btrim(${table.nameJa}) <> ''
        and btrim(${table.source}) <> '' and btrim(${table.sourceKey}) <> ''`,
    ),
    check("quest_search_origins_location_ck", sql`not ST_IsEmpty(${table.location}::geometry)`),
  ],
);

export const questStartPoints = pgTable(
  "quest_start_points",
  {
    questVersionId: uuid("quest_version_id")
      .primaryKey()
      .references(() => questVersions.id, { onDelete: "restrict" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "restrict" }),
    location: geographyPoint("location").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("quest_start_points_location_idx").using("gist", table.location),
    index("quest_start_points_place_idx").on(table.placeId),
    check("quest_start_points_location_ck", sql`not ST_IsEmpty(${table.location}::geometry)`),
  ],
);
