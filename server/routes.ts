import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { MatchmakingService } from "./services/matchmaking";
import { GameEngine } from "./services/gameEngine";
import { insertMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Matchmaking routes
  app.post('/api/queue/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { matchType = 'player' } = req.body;
      const result = await MatchmakingService.joinQueue(userId, matchType);
      res.json(result);
    } catch (error) {
      console.error("Error joining queue:", error);
      res.status(500).json({ message: "Failed to join queue" });
    }
  });

  app.post('/api/queue/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await MatchmakingService.leaveQueue(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving queue:", error);
      res.status(500).json({ message: "Failed to leave queue" });
    }
  });

  app.get('/api/queue/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await MatchmakingService.getQueueStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error getting queue status:", error);
      res.status(500).json({ message: "Failed to get queue status" });
    }
  });

  app.get('/api/queue/poll', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const result = await MatchmakingService.findMatch(userId, user.elo);
      res.json(result);
    } catch (error) {
      console.error("Error polling for match:", error);
      res.status(500).json({ message: "Failed to poll for match" });
    }
  });

  // Match routes
  app.get('/api/matches/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const match = await storage.getUserActiveMatch(userId);
      if (!match) {
        return res.json(null);
      }
      const matchWithPlayers = await storage.getMatchWithPlayers(match.id);
      res.json(matchWithPlayers);
    } catch (error) {
      console.error("Error getting active match:", error);
      res.status(500).json({ message: "Failed to get active match" });
    }
  });

  app.get('/api/matches/:matchId', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user.claims.sub;
      
      const match = await storage.getMatchWithPlayers(matchId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      // Check if user is part of this match
      if (match.player1.id !== userId && match.player2?.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(match);
    } catch (error) {
      console.error("Error getting match:", error);
      res.status(500).json({ message: "Failed to get match" });
    }
  });

  app.get('/api/matches/:matchId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user.claims.sub;

      // Verify user is part of this match
      const match = await storage.getMatch(matchId);
      if (!match || (match.player1Id !== userId && match.player2Id !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMatchMessages(matchId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting match messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post('/api/matches/:matchId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user.claims.sub;
      
      const validation = insertMessageSchema.safeParse({
        matchId,
        userId,
        content: req.body.content,
      });

      if (!validation.success) {
        return res.status(400).json({ message: "Invalid message data" });
      }

      const result = await GameEngine.sendMessage(matchId, userId, validation.data.content);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post('/api/matches/:matchId/forfeit', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user.claims.sub;

      const result = await GameEngine.endMatch(matchId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error forfeiting match:", error);
      res.status(500).json({ message: "Failed to forfeit match" });
    }
  });

  app.post('/api/matches/:matchId/end', isAuthenticated, async (req: any, res) => {
    try {
      const { matchId } = req.params;
      const result = await GameEngine.endMatch(matchId);
      res.json(result);
    } catch (error) {
      console.error("Error ending match:", error);
      res.status(500).json({ message: "Failed to end match" });
    }
  });

  // Judge-specific routes
  app.post('/api/messages/:messageId/rate', isAuthenticated, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      const judgeId = req.user.claims.sub;
      const { rating, explanation } = req.body;

      // Use the game engine to process the judge rating
      const result = await GameEngine.processJudgeRating(messageId, judgeId, rating, explanation);
      
      if (result.success) {
        res.json({ 
          success: true, 
          eloUpdated: result.eloUpdated,
          message: result.eloUpdated ? "Rating submitted. Judge ELOs updated based on agreement." : "Rating submitted. Waiting for other judge."
        });
      } else {
        res.status(400).json({ message: "Failed to process judge rating" });
      }
    } catch (error) {
      console.error("Error rating message:", error);
      res.status(500).json({ message: "Failed to rate message" });
    }
  });

  // User stats routes
  app.get('/api/users/recent-matches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const matches = await storage.getUserRecentMatches(userId, 10);
      res.json(matches);
    } catch (error) {
      console.error("Error getting recent matches:", error);
      res.status(500).json({ message: "Failed to get recent matches" });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const topPlayers = await storage.getTopPlayers(10);
      res.json(topPlayers);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ message: "Failed to get leaderboard" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
