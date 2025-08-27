import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  text,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  elo: integer("elo").default(1200).notNull(),
  peakElo: integer("peak_elo").default(1200).notNull(),
  judgeElo: integer("judge_elo").default(1200).notNull(),
  peakJudgeElo: integer("peak_judge_elo").default(1200).notNull(),
  totalMatches: integer("total_matches").default(0).notNull(),
  totalJudgeMatches: integer("total_judge_matches").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  judgeAgreements: integer("judge_agreements").default(0).notNull(),
  judgeDisagreements: integer("judge_disagreements").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const matchStatusEnum = pgEnum('match_status', ['waiting', 'active', 'completed', 'forfeit']);
export const moveRatingEnum = pgEnum('move_rating', ['brilliant', 'great', 'excellent', 'good', 'miss', 'mistake', 'blunder']);
export const matchTypeEnum = pgEnum('match_type', ['player', 'judge']);

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  player1Id: varchar("player1_id").references(() => users.id).notNull(),
  player2Id: varchar("player2_id").references(() => users.id),
  judge1Id: varchar("judge1_id").references(() => users.id),
  judge2Id: varchar("judge2_id").references(() => users.id),
  status: matchStatusEnum("status").default('waiting').notNull(),
  currentTurn: varchar("current_turn").references(() => users.id),
  winnerId: varchar("winner_id").references(() => users.id),
  player1Score: integer("player1_score").default(0),
  player2Score: integer("player2_score").default(0),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  timeLimit: integer("time_limit").default(300), // 5 minutes in seconds
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").references(() => matches.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const judgeRatings = pgTable("judge_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id).notNull(),
  judgeId: varchar("judge_id").references(() => users.id).notNull(),
  rating: moveRatingEnum("rating").notNull(),
  explanation: text("explanation"),
  ratedAt: timestamp("rated_at").defaultNow(),
});

export const queue = pgTable("queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  elo: integer("elo").notNull(),
  matchType: matchTypeEnum("match_type").default('player').notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  matchesAsPlayer1: many(matches, { relationName: "player1" }),
  matchesAsPlayer2: many(matches, { relationName: "player2" }),
  messages: many(messages),
  queueEntries: many(queue),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  player1: one(users, {
    fields: [matches.player1Id],
    references: [users.id],
    relationName: "player1",
  }),
  player2: one(users, {
    fields: [matches.player2Id],
    references: [users.id],
    relationName: "player2",
  }),
  judge1: one(users, {
    fields: [matches.judge1Id],
    references: [users.id],
    relationName: "judge1",
  }),
  judge2: one(users, {
    fields: [matches.judge2Id],
    references: [users.id],
    relationName: "judge2",
  }),
  winner: one(users, {
    fields: [matches.winnerId],
    references: [users.id],
    relationName: "winner",
  }),
  currentTurnUser: one(users, {
    fields: [matches.currentTurn],
    references: [users.id],
    relationName: "currentTurn",
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  match: one(matches, {
    fields: [messages.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  judgeRatings: many(judgeRatings),
}));

export const judgeRatingsRelations = relations(judgeRatings, ({ one }) => ({
  message: one(messages, {
    fields: [judgeRatings.messageId],
    references: [messages.id],
  }),
  judge: one(users, {
    fields: [judgeRatings.judgeId],
    references: [users.id],
  }),
}));

export const queueRelations = relations(queue, ({ one }) => ({
  user: one(users, {
    fields: [queue.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
});

export const insertJudgeRatingSchema = createInsertSchema(judgeRatings).omit({
  id: true,
  ratedAt: true,
});

export const insertQueueSchema = createInsertSchema(queue).omit({
  id: true,
  joinedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type JudgeRating = typeof judgeRatings.$inferSelect;
export type Queue = typeof queue.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertJudgeRating = z.infer<typeof insertJudgeRatingSchema>;
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type MatchStatus = typeof matchStatusEnum.enumValues[number];
export type MoveRating = typeof moveRatingEnum.enumValues[number];
export type MatchType = typeof matchTypeEnum.enumValues[number];
