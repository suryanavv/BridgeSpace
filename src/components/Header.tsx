
import React from 'react';
import { Network } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-6 animate-slide-down">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-md">
              <Network className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">BridgeSpace</h1>
              <p className="text-sm text-muted-foreground">Share files and text over WiFi</p>
            </div>
          </div>
          
        </div>
      </div>
    </header>
  );
};

export default Header;
