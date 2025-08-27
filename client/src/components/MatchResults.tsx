import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, RotateCcw, Home } from "lucide-react";

interface MatchResultsProps {
  match: any;
  user: any;
  opponent: any;
  messages: any[];
  onPlayAgain: () => void;
  onReturnHome: () => void;
}

export default function MatchResults({
  match,
  user,
  opponent,
  messages,
  onPlayAgain,
  onReturnHome,
}: MatchResultsProps) {
  const isWinner = match.winnerId === user.id;
  const isDraw = !match.winnerId;
  
  const userMessages = messages.filter(msg => msg.user.id === user.id);
  const opponentMessages = messages.filter(msg => msg.user.id === opponent.id);

  const getRatingCounts = (userMessages: any[]) => {
    const counts = {
      brilliant: 0,
      great: 0,
      excellent: 0,
      good: 0,
      miss: 0,
      mistake: 0,
      blunder: 0,
    };
    
    userMessages.forEach(msg => {
      if (msg.rating && counts.hasOwnProperty(msg.rating)) {
        counts[msg.rating as keyof typeof counts]++;
      }
    });
    
    return counts;
  };

  const userRatings = getRatingCounts(userMessages);
  const opponentRatings = getRatingCounts(opponentMessages);

  const getDisplayName = (playerUser: any) => {
    if (playerUser?.firstName || playerUser?.lastName) {
      return `${playerUser.firstName || ''} ${playerUser.lastName || ''}`.trim();
    }
    return playerUser?.email?.split('@')[0] || 'Player';
  };

  const calculateEloChange = () => {
    // Simplified ELO calculation for display
    if (isDraw) return 0;
    return isWinner ? 18 : -16;
  };

  const eloChange = calculateEloChange();
  const newElo = user.elo + eloChange;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="match-results-modal">
      <Card className="w-full max-w-md shadow-2xl border-border mx-4">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">
              {isWinner ? "🏆" : isDraw ? "🤝" : "😔"}
            </div>
            <h2 className={`text-2xl font-bold ${
              isWinner ? 'text-green-500' : isDraw ? 'text-yellow-500' : 'text-red-500'
            }`} data-testid="text-match-result">
              {isWinner ? 'Victory!' : isDraw ? 'Draw!' : 'Defeat!'}
            </h2>
            <p className="text-muted-foreground">Match completed</p>
          </div>
          
          <div className="space-y-4 mb-6">
            <div className="bg-accent rounded-lg p-4" data-testid="user-performance">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Your Performance</span>
                <span className={`font-bold ${
                  match.player1Score > match.player2Score ? 'text-green-500' : 
                  match.player1Score < match.player2Score ? 'text-red-500' : 
                  'text-yellow-500'
                }`}>
                  {user.id === match.player1.id ? match.player1Score : match.player2Score}/10
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {Object.entries(userRatings).map(([rating, count]) => 
                  count > 0 && (
                    <span key={rating} className="mr-2">
                      {rating}: <span className={`rating-${rating}`}>{count}</span>
                    </span>
                  )
                ).filter(Boolean).length > 0 ? 
                  Object.entries(userRatings).map(([rating, count]) => 
                    count > 0 && (
                      <span key={rating} className="mr-2">
                        {rating}: <span className={`rating-${rating}`}>{count}</span>
                      </span>
                    )
                  ) : 
                  "No moves made"
                }
              </div>
            </div>
            
            <div className="bg-accent rounded-lg p-4" data-testid="opponent-performance">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">{getDisplayName(opponent)} Performance</span>
                <span className={`font-bold ${
                  match.player1Score < match.player2Score ? 'text-green-500' : 
                  match.player1Score > match.player2Score ? 'text-red-500' : 
                  'text-yellow-500'
                }`}>
                  {opponent.id === match.player1.id ? match.player1Score : match.player2Score}/10
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {Object.entries(opponentRatings).map(([rating, count]) => 
                  count > 0 && (
                    <span key={rating} className="mr-2">
                      {rating}: <span className={`rating-${rating}`}>{count}</span>
                    </span>
                  )
                ).filter(Boolean).length > 0 ? 
                  Object.entries(opponentRatings).map(([rating, count]) => 
                    count > 0 && (
                      <span key={rating} className="mr-2">
                        {rating}: <span className={`rating-${rating}`}>{count}</span>
                      </span>
                    )
                  ) : 
                  "No moves made"
                }
              </div>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4" data-testid="elo-change">
              <div className="flex justify-between items-center">
                <span className="font-semibold">ELO Change</span>
                <span className={`font-bold text-lg ${
                  eloChange > 0 ? 'text-green-500' : eloChange < 0 ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  {eloChange > 0 ? '+' : ''}{eloChange}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span>{user.elo}</span> → <span className="text-primary font-semibold">{newElo}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <Button
              onClick={onPlayAgain}
              className="w-full font-semibold"
              data-testid="button-play-again"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Play Again
            </Button>
            <Button
              onClick={onReturnHome}
              variant="secondary"
              className="w-full font-semibold"
              data-testid="button-return-home"
            >
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
