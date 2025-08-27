import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Flag, Send, Crown, Star, ThumbsUp, Check, Minus, AlertTriangle, X } from "lucide-react";

interface MatchInterfaceProps {
  match: any;
  messages: any[];
  user: any;
  opponent: any;
  isYourTurn: boolean;
  timeRemaining: number;
  onSendMessage: (content: string) => void;
  onForfeit: () => void;
  isSending: boolean;
  formatTime: (seconds: number) => string;
}

const ratingIcons = {
  brilliant: Crown,
  great: Star,
  excellent: ThumbsUp,
  good: Check,
  miss: Minus,
  mistake: AlertTriangle,
  blunder: X,
};

const ratingColors = {
  brilliant: 'text-yellow-400',
  great: 'text-green-500',
  excellent: 'text-cyan-400',
  good: 'text-purple-500',
  miss: 'text-orange-500',
  mistake: 'text-red-500',
  blunder: 'text-red-600',
};

export default function MatchInterface({
  match,
  messages,
  user,
  opponent,
  isYourTurn,
  timeRemaining,
  onSendMessage,
  onForfeit,
  isSending,
  formatTime,
}: MatchInterfaceProps) {
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && isYourTurn && !isSending) {
      onSendMessage(messageInput);
      setMessageInput("");
    }
  };

  const getDisplayName = (playerUser: any) => {
    if (playerUser?.firstName || playerUser?.lastName) {
      return `${playerUser.firstName || ''} ${playerUser.lastName || ''}`.trim();
    }
    return playerUser?.email?.split('@')[0] || 'Player';
  };

  const getInitials = (playerUser: any) => {
    const name = getDisplayName(playerUser);
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderRating = (rating: string | null) => {
    if (!rating) return null;
    
    const IconComponent = ratingIcons[rating as keyof typeof ratingIcons];
    const colorClass = ratingColors[rating as keyof typeof ratingColors];
    
    return (
      <div className="flex items-center space-x-1">
        <span className={`text-sm font-medium capitalize ${colorClass}`}>
          {rating}
        </span>
        <IconComponent className={`text-xs ${colorClass}`} />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="border-border overflow-hidden">
        {/* Match Header */}
        <div className="bg-accent border-b border-border p-4" data-testid="match-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold" data-testid="text-player1-name">
                  {getDisplayName(user)}
                </span>
                <span className="text-primary" data-testid="text-player1-elo">
                  ({user.elo})
                </span>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={opponent.profileImageUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(opponent)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold" data-testid="text-player2-name">
                  {getDisplayName(opponent)}
                </span>
                <span className="text-primary" data-testid="text-player2-elo">
                  ({opponent.elo})
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="bg-primary text-primary-foreground px-3 py-1 rounded-lg font-mono text-lg">
                <Clock className="inline mr-1 h-4 w-4" />
                <span data-testid="text-time-remaining">{formatTime(timeRemaining)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onForfeit}
                className="text-muted-foreground hover:text-destructive"
                data-testid="button-forfeit"
              >
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Messages Area */}
        <div className="h-96 overflow-y-auto p-4 space-y-4" data-testid="messages-container">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet. Be the first to send a tactical message!</p>
            </div>
          ) : (
            messages.map((message: any, index: number) => {
              const isCurrentUser = message.user.id === user.id;
              
              return (
                <div 
                  key={message.id} 
                  className={`flex items-start space-x-3 ${isCurrentUser ? '' : 'flex-row-reverse'}`}
                  data-testid={`message-${index}`}
                >
                  <div className="flex-shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(message.user)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className={`flex-1 ${isCurrentUser ? '' : 'text-right'}`}>
                    <div className={`flex items-center space-x-2 mb-1 ${isCurrentUser ? '' : 'justify-end'}`}>
                      {!isCurrentUser && renderRating(message.rating)}
                      <span className="font-semibold">
                        {getDisplayName(message.user)}
                      </span>
                      {isCurrentUser && renderRating(message.rating)}
                    </div>
                    <div className={`rounded-lg p-3 inline-block max-w-xs ${
                      isCurrentUser 
                        ? 'bg-primary text-primary-foreground rounded-tl-none' 
                        : 'bg-secondary text-secondary-foreground rounded-tr-none'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-border p-4" data-testid="input-area">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex space-x-2">
                <Textarea
                  placeholder={isYourTurn ? "Craft your tactical message..." : "Wait for your turn..."}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1 resize-none h-20"
                  disabled={!isYourTurn || isSending}
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!messageInput.trim() || !isYourTurn || isSending}
                  className="self-end px-6 py-3"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {isYourTurn ? (
                  <span>
                    <span className="text-primary">Your turn</span> - AI will evaluate: Strategy, Psychology, Clarity, Impact
                  </span>
                ) : (
                  <span>Waiting for opponent's move...</span>
                )}
              </div>
            </div>
          </form>
        </div>
      </Card>
      
      {/* Move Ratings Legend */}
      <Card className="mt-6 border-border">
        <CardContent className="p-4">
          <h4 className="font-semibold mb-3" data-testid="title-rating-system">
            Move Rating System
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm">
            {Object.entries(ratingIcons).map(([rating, IconComponent]) => (
              <div key={rating} className="flex items-center space-x-1" data-testid={`rating-${rating}`}>
                <IconComponent className={`h-4 w-4 ${ratingColors[rating as keyof typeof ratingColors]}`} />
                <span className={`font-medium capitalize ${ratingColors[rating as keyof typeof ratingColors]}`}>
                  {rating}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
