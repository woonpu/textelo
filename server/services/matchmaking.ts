import { storage } from "../storage";

interface MatchmakingResult {
  success: boolean;
  matchId?: string;
  opponentId?: string;
  queuePosition?: number;
}

export class MatchmakingService {
  private static readonly ELO_RANGE_BASE = 100;
  private static readonly ELO_RANGE_EXPANSION = 50; // Expand by 50 every 30 seconds
  private static readonly QUEUE_TIME_EXPANSION = 30000; // 30 seconds

  static async joinQueue(userId: string, matchType: 'player' | 'judge' = 'player'): Promise<MatchmakingResult> {
    try {
      // Get user's current ELO
      const user = await storage.getUser(userId);
      if (!user) {
        return { success: false };
      }

      // Check if user is already in an active match
      const activeMatch = await storage.getUserActiveMatch(userId);
      if (activeMatch) {
        return { success: false };
      }

      // Join the queue
      await storage.joinQueue(userId, user.elo, matchType);

      // Try to find a match immediately if joining as player
      if (matchType === 'player') {
        const matchResult = await this.findMatch(userId, user.elo);
        if (matchResult.success) {
          return matchResult;
        }
      }

      return { success: true, queuePosition: 1 };
    } catch (error) {
      console.error("Error joining queue:", error);
      return { success: false };
    }
  }

  static async leaveQueue(userId: string): Promise<void> {
    try {
      await storage.leaveQueue(userId);
    } catch (error) {
      console.error("Error leaving queue:", error);
    }
  }

  static async findMatch(userId: string, userElo: number): Promise<MatchmakingResult> {
    try {
      const queueEntry = await storage.getUserInQueue(userId);
      if (!queueEntry) {
        return { success: false };
      }

      // Calculate ELO range based on queue time
      const queueTime = Date.now() - (queueEntry.joinedAt?.getTime() || Date.now());
      const expansions = Math.floor(queueTime / this.QUEUE_TIME_EXPANSION);
      const eloRange = this.ELO_RANGE_BASE + (expansions * this.ELO_RANGE_EXPANSION);

      // Find opponent in queue
      const opponent = await storage.findMatchInQueue(userElo, eloRange);
      
      if (!opponent || opponent.userId === userId) {
        return { success: false };
      }

      // Find judge in queue
      const judge = await storage.findJudgeInQueue();
      
      if (!judge) {
        return { success: false };
      }

      // Create match
      const match = await storage.createMatch(userId, opponent.userId, judge.userId);
      await storage.startMatch(match.id, opponent.userId, judge.userId);

      // Remove all participants from queue
      await storage.leaveQueue(userId);
      await storage.leaveQueue(opponent.userId);
      await storage.leaveQueue(judge.userId);

      return {
        success: true,
        matchId: match.id,
        opponentId: opponent.userId,
      };
    } catch (error) {
      console.error("Error finding match:", error);
      return { success: false };
    }
  }

  static async getQueueStatus(userId: string): Promise<{
    inQueue: boolean;
    position?: number;
    estimatedWaitTime?: number;
  }> {
    try {
      const queueEntry = await storage.getUserInQueue(userId);
      if (!queueEntry) {
        return { inQueue: false };
      }

      const queueTime = Date.now() - (queueEntry.joinedAt?.getTime() || Date.now());
      return {
        inQueue: true,
        position: 1, // Simplified for now
        estimatedWaitTime: Math.max(0, 30000 - queueTime), // Estimate based on queue expansion
      };
    } catch (error) {
      console.error("Error getting queue status:", error);
      return { inQueue: false };
    }
  }
}
