import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import NavigationHeader from "@/components/NavigationHeader";
import MatchInterface from "@/components/MatchInterface";
import MatchResults from "@/components/MatchResults";

export default function Match() {
  const { matchId } = useParams<{ matchId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showResults, setShowResults] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes

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

  // Get match data
  const { data: match, isLoading: matchLoading } = useQuery({
    queryKey: ["/api/matches", matchId],
    enabled: !!matchId && isAuthenticated,
    refetchInterval: 2000,
    retry: false,
  });

  // Get match messages
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["/api/matches", matchId, "messages"],
    enabled: !!matchId && isAuthenticated,
    refetchInterval: 1000,
    retry: false,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest("POST", `/api/matches/${matchId}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId] });
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
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Forfeit mutation
  const forfeitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${matchId}/forfeit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId] });
      setShowResults(true);
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
        description: "Failed to forfeit match",
        variant: "destructive",
      });
    },
  });

  // End match mutation
  const endMatchMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/matches/${matchId}/end`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId] });
      setShowResults(true);
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

  // Timer logic
  useEffect(() => {
    if (!match || match.status !== 'active' || !match.startedAt) return;

    const startTime = new Date(match.startedAt).getTime();
    const duration = match.timeLimit * 1000; // Convert to milliseconds

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.floor((duration - elapsed) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Time's up, end the match
        endMatchMutation.mutate();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [match, endMatchMutation]);

  // Check if match is completed
  useEffect(() => {
    if (match && (match.status === 'completed' || match.status === 'forfeit')) {
      setShowResults(true);
    }
  }, [match]);

  const handleSendMessage = (content: string) => {
    if (content.trim()) {
      sendMessageMutation.mutate(content.trim());
    }
  };

  const handleForfeit = () => {
    if (confirm("Are you sure you want to forfeit this match?")) {
      forfeitMutation.mutate();
    }
  };

  const handlePlayAgain = () => {
    setShowResults(false);
    setLocation("/");
  };

  const handleReturnHome = () => {
    setShowResults(false);
    setLocation("/");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || matchLoading || !user || !match) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!match.player2) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Waiting for opponent...</h2>
            <p className="text-muted-foreground">
              Please wait while we find you an opponent.
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mt-4"></div>
          </div>
        </div>
      </div>
    );
  }

  const isYourTurn = match.currentTurn === user.id;
  const opponent = match.player1.id === user.id ? match.player2 : match.player1;

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader />
      
      <MatchInterface
        match={match}
        messages={messages}
        user={user}
        opponent={opponent}
        isYourTurn={isYourTurn}
        timeRemaining={timeRemaining}
        onSendMessage={handleSendMessage}
        onForfeit={handleForfeit}
        isSending={sendMessageMutation.isPending}
        formatTime={formatTime}
      />

      {showResults && (
        <MatchResults
          match={match}
          user={user}
          opponent={opponent}
          messages={messages}
          onPlayAgain={handlePlayAgain}
          onReturnHome={handleReturnHome}
        />
      )}
    </div>
  );
}
