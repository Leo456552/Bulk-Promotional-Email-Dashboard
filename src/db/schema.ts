import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";

/** Named import batch (e.g. "May 2026 Promo List") — design-flow Phase 1 */
export const contactLists = sqliteTable("contact_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  source: text("source").notNull().default("csv"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const contacts = sqliteTable(
  "contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactListId: integer("contact_list_id")
      .notNull()
      .references(() => contactLists.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    /** JSON object for arbitrary CSV columns until tags/custom fields expand */
    customFieldsJson: text("custom_fields_json"),
    /** active | unsubscribed | bounced | invalid */
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("contacts_list_email_idx").on(table.contactListId, table.email),
  ],
);

export const suppressionEntries = sqliteTable("suppression_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** draft | scheduled | sending | completed | cancelled */
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body"),
  senderName: text("sender_name"),
  replyTo: text("reply_to"),
  templateId: integer("template_id").references(() => emailTemplates.id, {
    onDelete: "set null",
  }),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const campaignRecipients = sqliteTable(
  "campaign_recipients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    /** queued | sent | failed */
    sendStatus: text("send_status").notNull().default("queued"),
    errorMessage: text("error_message"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("campaign_recipients_campaign_idx").on(table.campaignId),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
