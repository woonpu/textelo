import {
  users,
  matches,
  messages,
  queue,
  type User,
  type UpsertUser,
  type Match,
  type Message,
  type Queue,
  type InsertMatch,
  type InsertMessage,
  type InsertQueue,
  type MatchStatus,
  type MoveRating,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserElo(userId: string, newElo: number): Promise<void>;
  updateUserStats(userId: string, won: boolean): Promise<void>;
  getTopPlayers(limit: number): Promise<User[]>;
  
  // Queue operations
  joinQueue(userId: string, elo: number, matchType?: 'player' | 'judge'): Promise<Queue>;
  leaveQueue(userId: string): Promise<void>;
  findMatchInQueue(elo: number, eloRange: number): Promise<Queue | undefined>;
  findJudgeInQueue(): Promise<Queue | undefined>;
  getUserInQueue(userId: string): Promise<Queue | undefined>;
  
  // Match operations
  createMatch(player1Id: string, player2Id?: string, judgeId?: string): Promise<Match>;
  getMatch(matchId: string): Promise<Match | undefined>;
  getMatchWithPlayers(matchId: string): Promise<any>;
  updateMatchStatus(matchId: string, status: MatchStatus): Promise<void>;
  startMatch(matchId: string, player2Id: string, judgeId?: string): Promise<void>;
  setMatchWinner(matchId: string, winnerId: string, player1Score: number, player2Score: number): Promise<void>;
  switchTurn(matchId: string, nextUserId: string): Promise<void>;
  getUserActiveMatch(userId: string): Promise<Match | undefined>;
  getUserRecentMatches(userId: string, limit: number): Promise<any[]>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageRating(messageId: string, rating: MoveRating, explanation: string): Promise<void>;
  getMatchMessages(matchId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserElo(userId: string, newElo: number): Promise<void> {
    await db
      .update(users)
      .set({ 
        elo: newElo,
        peakElo: sql`GREATEST(peak_elo, ${newElo})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserStats(userId: string, won: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        totalMatches: sql`total_matches + 1`,
        wins: won ? sql`wins + 1` : sql`wins`,
        losses: won ? sql`losses` : sql`losses + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getTopPlayers(limit: number): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.elo))
      .limit(limit);
  }

  // Queue operations
  async joinQueue(userId: string, elo: number, matchType: 'player' | 'judge' = 'player'): Promise<Queue> {
    const [queueEntry] = await db
      .insert(queue)
      .values({ userId, elo, matchType })
      .onConflictDoUpdate({
        target: queue.userId,
        set: { elo, matchType, joinedAt: new Date() },
      })
      .returning();
    return queueEntry;
  }

  async leaveQueue(userId: string): Promise<void> {
    await db.delete(queue).where(eq(queue.userId, userId));
  }

  async findMatchInQueue(elo: number, eloRange: number): Promise<Queue | undefined> {
    const [match] = await db
      .select()
      .from(queue)
      .where(
        and(
          eq(queue.matchType, 'player'),
          sql`elo BETWEEN ${elo - eloRange} AND ${elo + eloRange}`,
          sql`joined_at < NOW() - INTERVAL '1 second'`
        )
      )
      .orderBy(asc(queue.joinedAt))
      .limit(1);
    return match;
  }

  async findJudgeInQueue(): Promise<Queue | undefined> {
    const [judge] = await db
      .select()
      .from(queue)
      .where(eq(queue.matchType, 'judge'))
      .orderBy(asc(queue.joinedAt))
      .limit(1);
    return judge;
  }

  async getUserInQueue(userId: string): Promise<Queue | undefined> {
    const [queueEntry] = await db
      .select()
      .from(queue)
      .where(eq(queue.userId, userId));
    return queueEntry;
  }

  // Match operations
  async createMatch(player1Id: string, player2Id?: string, judgeId?: string): Promise<Match> {
    const [match] = await db
      .insert(matches)
      .values({
        player1Id,
        player2Id,
        judgeId,
        status: (player2Id && judgeId) ? 'active' : 'waiting',
        currentTurn: player1Id,
        startedAt: (player2Id && judgeId) ? new Date() : undefined,
      })
      .returning();
    return match;
  }

  async getMatch(matchId: string): Promise<Match | undefined> {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId));
    return match;
  }

  async getMatchWithPlayers(matchId: string): Promise<any> {
    const [match] = await db
      .select({
        id: matches.id,
        status: matches.status,
        currentTurn: matches.currentTurn,
        winnerId: matches.winnerId,
        player1Score: matches.player1Score,
        player2Score: matches.player2Score,
        startedAt: matches.startedAt,
        endedAt: matches.endedAt,
        timeLimit: matches.timeLimit,
        player1: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          elo: users.elo,
        },
        player2: {
          id: sql`p2.id`,
          email: sql`p2.email`,
          firstName: sql`p2.first_name`,
          lastName: sql`p2.last_name`,
          profileImageUrl: sql`p2.profile_image_url`,
          elo: sql`p2.elo`,
        },
        judge: {
          id: sql`j.id`,
          email: sql`j.email`,
          firstName: sql`j.first_name`,
          lastName: sql`j.last_name`,
          profileImageUrl: sql`j.profile_image_url`,
          elo: sql`j.elo`,
        },
      })
      .from(matches)
      .leftJoin(users, eq(matches.player1Id, users.id))
      .leftJoin(sql`users p2`, sql`matches.player2_id = p2.id`)
      .leftJoin(sql`users j`, sql`matches.judge_id = j.id`)
      .where(eq(matches.id, matchId));
    return match;
  }

  async updateMatchStatus(matchId: string, status: MatchStatus): Promise<void> {
    await db
      .update(matches)
      .set({ 
        status,
        endedAt: status === 'completed' || status === 'forfeit' ? new Date() : undefined,
      })
      .where(eq(matches.id, matchId));
  }

  async startMatch(matchId: string, player2Id: string, judgeId?: string): Promise<void> {
    await db
      .update(matches)
      .set({
        player2Id,
        judgeId,
        status: 'active',
        startedAt: new Date(),
      })
      .where(eq(matches.id, matchId));
  }

  async setMatchWinner(matchId: string, winnerId: string, player1Score: number, player2Score: number): Promise<void> {
    await db
      .update(matches)
      .set({
        winnerId,
        player1Score,
        player2Score,
        status: 'completed',
        endedAt: new Date(),
      })
      .where(eq(matches.id, matchId));
  }

  async switchTurn(matchId: string, nextUserId: string): Promise<void> {
    await db
      .update(matches)
      .set({ currentTurn: nextUserId })
      .where(eq(matches.id, matchId));
  }

  async getUserActiveMatch(userId: string): Promise<Match | undefined> {
    const [match] = await db
      .select()
      .from(matches)
      .where(
        and(
          or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)),
          eq(matches.status, 'active')
        )
      );
    return match;
  }

  async getUserRecentMatches(userId: string, limit: number): Promise<any[]> {
    return await db
      .select({
        id: matches.id,
        status: matches.status,
        winnerId: matches.winnerId,
        player1Score: matches.player1Score,
        player2Score: matches.player2Score,
        endedAt: matches.endedAt,
        opponent: {
          id: sql`CASE WHEN matches.player1_id = ${userId} THEN p2.id ELSE p1.id END`,
          firstName: sql`CASE WHEN matches.player1_id = ${userId} THEN p2.first_name ELSE p1.first_name END`,
          lastName: sql`CASE WHEN matches.player1_id = ${userId} THEN p2.last_name ELSE p1.last_name END`,
          elo: sql`CASE WHEN matches.player1_id = ${userId} THEN p2.elo ELSE p1.elo END`,
        },
        isWinner: sql`matches.winner_id = ${userId}`,
        userWasPlayer1: sql`matches.player1_id = ${userId}`,
      })
      .from(matches)
      .leftJoin(sql`users p1`, sql`matches.player1_id = p1.id`)
      .leftJoin(sql`users p2`, sql`matches.player2_id = p2.id`)
      .where(
        and(
          or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)),
          eq(matches.status, 'completed')
        )
      )
      .orderBy(desc(matches.endedAt))
      .limit(limit);
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  }

  async updateMessageRating(messageId: string, rating: MoveRating, explanation: string): Promise<void> {
    await db
      .update(messages)
      .set({ rating, ratingExplanation: explanation })
      .where(eq(messages.id, messageId));
  }

  async getMatchMessages(matchId: string): Promise<any[]> {
    return await db
      .select({
        id: messages.id,
        content: messages.content,
        rating: messages.rating,
        ratingExplanation: messages.ratingExplanation,
        sentAt: messages.sentAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.matchId, matchId))
      .orderBy(asc(messages.sentAt));
  }
}

export const storage = new DatabaseStorage();
