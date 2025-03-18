
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Network, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="glass-card rounded-lg p-8 max-w-md w-full text-center animate-fade-in">
        <div className="bg-primary/10 p-3 rounded-full mx-auto mb-6 w-16 h-16 flex items-center justify-center">
          <Network className="h-8 w-8 text-primary" />
        </div>
        
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Page not found
        </p>
        
        <p className="text-sm text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <Button asChild>
          <a href="/" className="inline-flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
