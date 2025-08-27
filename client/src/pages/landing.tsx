import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Gamepad2, Mail, Lock } from "lucide-react";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, redirect to Google auth as Replit Auth handles the authentication
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-border">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Gamepad2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2" data-testid="title-welcome">
              Welcome to Tactical Messages
            </h1>
            <p className="text-muted-foreground">
              Competitive turn-based messaging battles
            </p>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={handleGoogleSignIn}
              className="w-full bg-white text-gray-900 border border-gray-300 hover:bg-gray-50"
              data-testid="button-google-signin"
            >
              <Mail className="mr-2 h-4 w-4 text-red-500" />
              Continue with Gmail
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  required
                  data-testid="input-email"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  required
                  data-testid="input-password"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full font-medium"
                data-testid="button-signin"
              >
                <Lock className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </form>
            
            <p className="text-center text-sm text-muted-foreground">
              New player? Your account will be created automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
