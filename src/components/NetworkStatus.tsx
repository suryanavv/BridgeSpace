
import React, { useEffect, useState } from 'react';
import { getClientIP, getNetworkPrefix, getCachedNetworkPrefix } from '@/utils/networkUtils';
import { toast } from 'sonner';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface NetworkStatusProps {
  onNetworkChange?: (isConnected: boolean, networkPrefix: string, ip: string) => void;
  onRefresh?: () => void;  // Add this new prop
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onNetworkChange, onRefresh }) => {
  const [ip, setIp] = useState<string>('');
  const [networkPrefix, setNetworkPrefix] = useState<string>('');
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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
      
      toast.success('Network connected', {
        description: `You're connected to network ${prefix}.*`,
        duration: 3000,
      });
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

  return (
    <div className="glass-card p-4 rounded-lg animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status === 'connected' ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : status === 'disconnected' ? (
            <WifiOff className="h-5 w-5 text-red-500" />
          ) : (
            <div className="status-indicator status-checking animate-pulse" />
          )}
          <span className="text-sm font-medium">
            {status === 'connected' ? 'Connected' : 
             status === 'disconnected' ? 'Disconnected' : 
             'Checking...'}
          </span>
        </div>
      </div>

      
    </div>
);
};

export default NetworkStatus;
