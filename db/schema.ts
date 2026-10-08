import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
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
