import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import NavigationHeader from "@/components/NavigationHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Clock, Trophy, Target, Users } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isQueuing, setIsQueuing] = useState(false);
  const [queueTime, setQueueTime] = useState(0);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check for active match
  const { data: activeMatch } = useQuery({
    queryKey: ["/api/matches/active"],
    enabled: isAuthenticated,
    refetchInterval: 2000,
    retry: false,
  });

  // Get recent matches
  const { data: recentMatches = [] } = useQuery({
    queryKey: ["/api/users/recent-matches"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Get leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["/api/leaderboard"],
    retry: false,
  });

  // Queue mutations
  const joinQueueMutation = useMutation({
    mutationFn: (matchType: 'player' | 'judge' = 'player') => 
      apiRequest("POST", "/api/queue/join", { matchType }),
    onSuccess: async (response) => {
      const result = await response.json();
      if (result.success && result.matchId) {
        setLocation(`/match/${result.matchId}`);
      } else if (result.success) {
        setIsQueuing(true);
        setQueueTime(0);
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to join queue",
        variant: "destructive",
      });
    },
  });

  const leaveQueueMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/queue/leave"),
    onSuccess: () => {
      setIsQueuing(false);
      setQueueTime(0);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    },
  });

  // Poll for matches while queuing
  const { refetch: pollForMatch } = useQuery({
    queryKey: ["/api/queue/poll"],
    enabled: false,
    retry: false,
  });

  // Queue timer and polling
  useEffect(() => {
    if (!isQueuing) return;

    const timer = setInterval(() => {
      setQueueTime(prev => prev + 1);
    }, 1000);

    const pollTimer = setInterval(async () => {
      try {
        const response = await pollForMatch();
        if (response.data) {
          const result = response.data as any;
          if (result.success && result.matchId) {
            setIsQueuing(false);
            setLocation(`/match/${result.matchId}`);
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(pollTimer);
    };
  }, [isQueuing, pollForMatch, setLocation]);

  // Redirect to active match if exists
  useEffect(() => {
    if (activeMatch && !isQueuing) {
      setLocation(`/match/${activeMatch.id}`);
    }
  }, [activeMatch, isQueuing, setLocation]);

  const handleStartMatchmaking = () => {
    joinQueueMutation.mutate('player');
  };

  const handleJoinAsJudge = () => {
    joinQueueMutation.mutate('judge');
  };

  const handleCancelQueue = () => {
    leaveQueueMutation.mutate();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateWinRate = (wins: number, totalMatches: number) => {
    if (totalMatches === 0) return 0;
    return Math.round((wins / totalMatches) * 100);
  };

  const getUserRank = (userElo: number, leaderboard: any[]) => {
    const rank = leaderboard.findIndex(player => player.elo <= userElo) + 1;
    return rank || leaderboard.length + 1;
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Play Area */}
          <div className="lg:col-span-2">
            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2" data-testid="title-ready-battle">
                    Ready for Battle?
                  </h2>
                  <p className="text-muted-foreground">
                    Queue up and test your tactical messaging skills against players of similar skill level.
                  </p>
                </div>
                
                {!isQueuing ? (
                  <div className="mb-6 space-y-4">
                    <Button 
                      onClick={handleStartMatchmaking}
                      disabled={joinQueueMutation.isPending}
                      className="w-full bg-primary text-primary-foreground px-8 py-4 text-xl font-bold hover:bg-primary/90 transition-all duration-200 glow-effect hover:scale-105"
                      data-testid="button-find-match"
                    >
                      <Play className="mr-2 h-5 w-5" />
                      FIND MATCH
                    </Button>
                    <Button 
                      onClick={handleJoinAsJudge}
                      disabled={joinQueueMutation.isPending}
                      variant="secondary"
                      className="w-full px-8 py-4 text-xl font-bold hover:scale-105 transition-all duration-200"
                      data-testid="button-play-as-judge"
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      PLAY AS JUDGE
                    </Button>
                  </div>
                ) : (
                  <div className="animate-pulse-glow bg-accent rounded-lg p-6 border border-primary">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <div className="animate-spin">
                        <Target className="text-primary h-5 w-5" />
                      </div>
                      <span className="text-lg font-semibold" data-testid="text-searching">
                        Searching for opponent...
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      Looking for players with ELO {user.elo - 150}-{user.elo + 150}
                    </p>
                    <div className="text-sm text-muted-foreground">
                      Queue time: <span data-testid="text-queue-time">{formatTime(queueTime)}</span>
                    </div>
                    <Button 
                      variant="destructive"
                      className="mt-4"
                      onClick={handleCancelQueue}
                      disabled={leaveQueueMutation.isPending}
                      data-testid="button-cancel-search"
                    >
                      Cancel Search
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Recent Matches */}
            <Card className="mt-8 border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4" data-testid="title-recent-matches">
                  Recent Matches
                </h3>
                <div className="space-y-3">
                  {recentMatches.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      No matches played yet. Start your first battle!
                    </p>
                  ) : (
                    recentMatches.map((match: any, index: number) => (
                      <div 
                        key={match.id} 
                        className="flex items-center justify-between py-3 border-b border-border last:border-b-0"
                        data-testid={`match-result-${index}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${match.isWinner ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div>
                            <span className="font-medium">
                              vs {match.opponent.firstName || 'Unknown Player'}
                            </span>
                            <div className="text-sm text-muted-foreground">
                              {match.endedAt ? new Date(match.endedAt).toLocaleDateString() : 'Recently'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${match.isWinner ? 'text-green-500' : 'text-red-500'}`}>
                            {match.isWinner ? 'Victory' : 'Defeat'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {match.isWinner ? '+' : '-'}
                            {Math.abs(Math.round((match.isWinner ? 1 : -1) * 18))} ELO
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar Stats */}
          <div className="space-y-6">
            {/* Player Stats */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4" data-testid="title-your-stats">
                  Your Stats
                </h3>
                <div className="space-y-4">
                  <div className="border-b border-border pb-3 mb-3">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Player Stats</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Player ELO</span>
                        <span className="font-bold text-primary" data-testid="text-current-elo">
                          {user.elo}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peak Player ELO</span>
                        <span className="font-semibold" data-testid="text-peak-elo">
                          {user.peakElo}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Win Rate</span>
                        <span className="font-semibold text-green-500" data-testid="text-win-rate">
                          {calculateWinRate(user.wins, user.totalMatches)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Player Matches</span>
                        <span className="font-semibold" data-testid="text-total-matches">
                          {user.totalMatches}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Judge Stats</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Judge ELO</span>
                        <span className="font-bold text-amber-500" data-testid="text-judge-elo">
                          {user.judgeElo || 1200}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peak Judge ELO</span>
                        <span className="font-semibold" data-testid="text-peak-judge-elo">
                          {user.peakJudgeElo || 1200}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agreement Rate</span>
                        <span className="font-semibold text-blue-500" data-testid="text-agreement-rate">
                          {calculateWinRate(user.judgeAgreements || 0, user.totalJudgeMatches || 0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Judge Matches</span>
                        <span className="font-semibold" data-testid="text-judge-matches">
                          {user.totalJudgeMatches || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Leaderboard Preview */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4" data-testid="title-leaderboard">
                  Leaderboard
                </h3>
                <div className="space-y-3">
                  {leaderboard.slice(0, 3).map((player: any, index: number) => (
                    <div key={player.id} className="flex items-center space-x-3" data-testid={`leaderboard-player-${index}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-primary text-primary-foreground' : 
                        index === 1 ? 'bg-secondary text-secondary-foreground' : 
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="flex-1 font-medium">
                        {player.firstName || 'Player'} {player.lastName || ''}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {player.elo}
                      </span>
                    </div>
                  ))}
                  
                  {leaderboard.length > 3 && (
                    <div className="border-t border-border pt-3 mt-3">
                      <div className="flex items-center space-x-3 bg-accent rounded-lg p-2" data-testid="leaderboard-your-rank">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                          {getUserRank(user.elo, leaderboard)}
                        </div>
                        <span className="flex-1 font-medium">You</span>
                        <span className="text-sm text-muted-foreground">
                          {user.elo}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
