import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  body: text('body').notNull(),
  elementId: text('element_id'),
  elementLabel: text('element_label'),
  context: text('context').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('comments_created_at_idx').on(table.createdAt)]);

export const pricingConfigurations = sqliteTable('pricing_configurations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  configuration: text('configuration').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('pricing_configurations_created_at_idx').on(table.createdAt)]);

// An approved design: the full design state someone signed off on. The newest approval is the site default.
export const designApprovals = sqliteTable('design_approvals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  design: text('design').notNull(),
  estimate: text('estimate'),
  updatedAt: integer('updated_at'),
  revision: integer('revision').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, table => [index('design_approvals_created_at_idx').on(table.createdAt)]);

export const cameraPositions = sqliteTable('camera_positions', {
  deletedAt: integer('deleted_at'),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  shot: text('shot').notNull(),
  revision: integer('revision').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => [index('camera_positions_created_at_idx').on(table.createdAt)]);

// Project records use optimistic revisions so another browser cannot silently overwrite work.
export const projectDocuments = sqliteTable('project_documents', {
 id: text('id').primaryKey(), content: text('content').notNull(), revision: integer('revision').notNull().default(0), updatedAt: integer('updated_at').notNull(),
});
export const projectAccess = sqliteTable('project_access', {
 id: text('id').primaryKey(), salt: text('salt').notNull(), hash: text('hash').notNull(), failures: integer('failures').notNull().default(0), lockedUntil: integer('locked_until').notNull().default(0),
});
export const projectSessions = sqliteTable('project_sessions', {
 id: text('id').primaryKey(), expiresAt: integer('expires_at').notNull(),
});
export const projectReceipts = sqliteTable('project_receipts', {
 id: text('id').primaryKey(), fingerprint: text('fingerprint').notNull(), filename: text('filename').notNull(), pages: text('pages').notNull(), createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('project_receipts_fingerprint_idx').on(table.fingerprint)]);
