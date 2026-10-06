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
