import { storage } from "../storage";
import type { Match, Message } from "@shared/schema";

export class GameEngine {
  private static readonly MATCH_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly ELO_K_FACTOR = 32;

  static async sendMessage(matchId: string, userId: string, content: string): Promise<{
    success: boolean;
    message?: Message;
    rating?: any;
    error?: string;
  }> {
    try {
      // Validate match and turn
      const match = await storage.getMatch(matchId);
      if (!match || match.status !== 'active') {
        return { success: false, error: "Match not active" };
      }

      if (match.currentTurn !== userId) {
        return { success: false, error: "Not your turn" };
      }

      // Check time limit
      if (this.isMatchExpired(match)) {
        await this.endMatch(matchId);
        return { success: false, error: "Match time expired" };
      }

      // Create message
      const message = await storage.createMessage({
        matchId,
        userId,
        content: content.trim(),
      });

      // Message created successfully - rating will be done by judge
      // No automatic AI rating, judge will manually rate messages

      // Switch turns
      const nextUserId = match.player1Id === userId ? match.player2Id : match.player1Id;
      if (nextUserId) {
        await storage.switchTurn(matchId, nextUserId);
      }

      return {
        success: true,
        message,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      return { success: false, error: "Failed to send message" };
    }
  }

  static async endMatch(matchId: string, forfeitUserId?: string): Promise<{
    success: boolean;
    result?: any;
  }> {
    try {
      const match = await storage.getMatchWithPlayers(matchId);
      if (!match || match.status !== 'active') {
        return { success: false };
      }

      // Handle forfeit
      if (forfeitUserId) {
        const winnerId = forfeitUserId === match.player1.id ? match.player2?.id : match.player1.id;
        if (winnerId) {
          await storage.setMatchWinner(matchId, winnerId, 0, 10);
          await this.updateEloRatings(match.player1.id, match.player2?.id, winnerId);
        }
        await storage.updateMatchStatus(matchId, 'forfeit');
        return { success: true };
      }

      // For matches that end due to time, judge will need to decide winner manually
      // For now, set as draw/tie until judge makes decision
      await storage.setMatchWinner(matchId, '', 5, 5); // Empty winnerId indicates draw

      // Update ELO ratings (no ELO change for draws)
      await this.updateEloRatings(match.player1.id, match.player2?.id, null);

      return {
        success: true,
        result: {
          winnerId: null,
          player1Score: 5,
          player2Score: 5,
          explanation: "Match ended. Judge will decide the winner.",
        },
      };
    } catch (error) {
      console.error("Error ending match:", error);
      return { success: false };
    }
  }

  private static isMatchExpired(match: Match): boolean {
    if (!match.startedAt) return false;
    const elapsed = Date.now() - match.startedAt.getTime();
    return elapsed > this.MATCH_DURATION;
  }

  private static async updateEloRatings(player1Id: string, player2Id: string | undefined, winnerId: string | null): Promise<void> {
    if (!player2Id) return;

    try {
      const player1 = await storage.getUser(player1Id);
      const player2 = await storage.getUser(player2Id);
      
      if (!player1 || !player2) return;

      // Calculate expected scores
      const expectedScore1 = 1 / (1 + Math.pow(10, (player2.elo - player1.elo) / 400));
      const expectedScore2 = 1 - expectedScore1;

      // Determine actual scores
      let actualScore1 = 0.5; // tie
      let actualScore2 = 0.5; // tie
      
      if (winnerId === player1Id) {
        actualScore1 = 1;
        actualScore2 = 0;
      } else if (winnerId === player2Id) {
        actualScore1 = 0;
        actualScore2 = 1;
      }

      // Calculate new ELO ratings
      const newElo1 = Math.round(player1.elo + this.ELO_K_FACTOR * (actualScore1 - expectedScore1));
      const newElo2 = Math.round(player2.elo + this.ELO_K_FACTOR * (actualScore2 - expectedScore2));

      // Update ELO ratings and stats
      await storage.updateUserElo(player1Id, newElo1);
      await storage.updateUserElo(player2Id, newElo2);
      await storage.updateUserStats(player1Id, winnerId === player1Id);
      await storage.updateUserStats(player2Id, winnerId === player2Id);
    } catch (error) {
      console.error("Error updating ELO ratings:", error);
    }
  }

  static async checkMatchTimeout(): Promise<void> {
    // This would be called by a background job to check for expired matches
    // For now, matches are checked when actions are performed
  }

  static async processJudgeRating(messageId: string, judgeId: string, rating: string, explanation?: string): Promise<{
    success: boolean;
    eloUpdated?: boolean;
  }> {
    try {
      // Create the judge rating
      await storage.createJudgeRating({
        messageId,
        judgeId,
        rating: rating as any,
        explanation: explanation || '',
      });

      // Check if both judges have now rated this message
      const allRatings = await storage.getMessageJudgeRatings(messageId);
      
      if (allRatings.length === 2) {
        // Both judges have rated - check if they agree
        const [rating1, rating2] = allRatings;
        const agreed = rating1.rating === rating2.rating;

        // Update judge ELOs based on agreement
        await this.updateJudgeElos(rating1.judgeId, rating2.judgeId, agreed);
        
        return { success: true, eloUpdated: true };
      }

      return { success: true, eloUpdated: false };
    } catch (error) {
      console.error("Error processing judge rating:", error);
      return { success: false };
    }
  }

  private static async updateJudgeElos(judge1Id: string, judge2Id: string, agreed: boolean): Promise<void> {
    try {
      const judge1 = await storage.getUser(judge1Id);
      const judge2 = await storage.getUser(judge2Id);
      
      if (!judge1 || !judge2) return;

      const JUDGE_ELO_K_FACTOR = 16; // Smaller K-factor for judges
      const AGREEMENT_BONUS = 10;  // Points gained for agreement
      const DISAGREEMENT_PENALTY = 5; // Points lost for disagreement

      if (agreed) {
        // Both judges agree - they both gain ELO
        const newElo1 = Math.max(800, judge1.judgeElo + AGREEMENT_BONUS);
        const newElo2 = Math.max(800, judge2.judgeElo + AGREEMENT_BONUS);

        await storage.updateJudgeElo(judge1Id, newElo1);
        await storage.updateJudgeElo(judge2Id, newElo2);
        await storage.updateJudgeStats(judge1Id, true);
        await storage.updateJudgeStats(judge2Id, true);
      } else {
        // Judges disagree - they both lose ELO
        const newElo1 = Math.max(800, judge1.judgeElo - DISAGREEMENT_PENALTY);
        const newElo2 = Math.max(800, judge2.judgeElo - DISAGREEMENT_PENALTY);

        await storage.updateJudgeElo(judge1Id, newElo1);
        await storage.updateJudgeElo(judge2Id, newElo2);
        await storage.updateJudgeStats(judge1Id, false);
        await storage.updateJudgeStats(judge2Id, false);
      }
    } catch (error) {
      console.error("Error updating judge ELOs:", error);
    }
  }
}
