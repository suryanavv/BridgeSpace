
import React from 'react';
import NetworkStatus from '@/components/NetworkStatus';

interface HeaderProps {
  onNetworkChange: (connected: boolean, prefix: string, ip: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onNetworkChange }) => {
  return (
    <header className="w-full py-6 animate-slide-down">
      <div className="container max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="pl-2 rounded-md">
              <img 
                src="/rocket.svg" 
                alt="BridgeSpace Logo" 
                className="h-10 w-10 text-primary"
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">BridgeSpace</h1>
              <p className="text-xs text-muted-foreground">Share files and text over WiFi</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <NetworkStatus onNetworkChange={onNetworkChange} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
