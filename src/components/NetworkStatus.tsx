import React, { useEffect, useState } from 'react';
import { getClientIP, getNetworkPrefix, getCachedNetworkPrefix } from '@/utils/networkUtils';
import { toast } from 'sonner';
import { Wifi, WifiOff, RefreshCw, Lock, Globe, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface NetworkStatusProps {
  onNetworkChange?: (isConnected: boolean, networkPrefix: string, ip: string) => void;
  onRefresh?: () => void;  
  isPrivateSpace?: boolean;
  privateSpaceKey?: string;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  onNetworkChange, 
  onRefresh,
  isPrivateSpace = false,
  privateSpaceKey = ''
}) => {
  const [ip, setIp] = useState<string>('');
  const [networkPrefix, setNetworkPrefix] = useState<string>('');
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hasShownToast, setHasShownToast] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const checkNetwork = async () => {
    try {
      setStatus('checking');
      if (isRefreshing) {
        setIsRefreshing(true);
      }
      
      const clientIP = await getClientIP();
      // Use the cached network prefix if available, otherwise calculate it
      const prefix = getCachedNetworkPrefix() || getNetworkPrefix(clientIP);
      
      setIp(clientIP);
      setNetworkPrefix(prefix);
      setStatus('connected');
      setIsRefreshing(false);
      
      if (onNetworkChange) {
        onNetworkChange(true, prefix, clientIP);
      }
      
      if (!hasShownToast) {
        toast.success('Network connected', {
          description: `You're connected to network ${prefix}.*`,
          duration: 3000,
        });
        setHasShownToast(true);
      }
    } catch (error) {
      console.error('Failed to get network information:', error);
      setStatus('disconnected');
      setIsRefreshing(false);
      
      if (onNetworkChange) {
        onNetworkChange(false, '', '');
      }
      
      toast.error('Network error', {
        description: 'Unable to determine your network. Please check your connection.',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    // Check network once on component mount
    checkNetwork();
    
    // No need for cleanup as we removed the interval
    return () => {};
  }, [onNetworkChange]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    checkNetwork();
    // Call the onRefresh callback to fetch updated files/texts
    if (onRefresh) {
      onRefresh();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md text-sm animate-fade-in w-full">
      {isPrivateSpace ? (
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700">
                <Lock className="h-3 w-3 mr-1" /> Private Space
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-1 h-7 w-7" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1 h-7 w-7" 
                      onClick={() => copyToClipboard(privateSpaceKey)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy private key</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="font-mono break-all bg-slate-200 dark:bg-slate-700 p-2 rounded text-sm">
            {privateSpaceKey}
          </div>
        </div>
      ) : status === 'connected' ? (
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">
              <Wifi className="h-3 w-3 mr-1" /> Network Connected
            </Badge>
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-1 h-7 w-7" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Network prefix:</span>
            <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
              {networkPrefix}*
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Your IP:</span>
            <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
              {ip}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Network Unavailable</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-1 h-7 w-7" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default NetworkStatus;
