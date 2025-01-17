import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';
import { NetworkInfo } from '@/integrations/supabase/types';

// Single source of truth for network management
export class NetworkUtils {
  private static networkId: string | null = null;
  private static lastValidation: number = 0;
  private static VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  static async detectNetwork(): Promise<string> {
    try {
      // Always validate for file operations
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      const ip = data.ip;
      
      // Generate network ID from IP subnet
      const networkId = this.generateNetworkId(ip);

      // Register network
      await this.registerNetwork(networkId, ip);
      
      // Update cache
      this.networkId = networkId;
      this.lastValidation = Date.now();
      
      return networkId;
    } catch (error) {
      console.error('Error detecting network:', error);
      throw new Error('Failed to detect network');
    }
  }

  private static generateNetworkId(ip: string): string {
    // Use subnet (first three segments) for network identification
    const segments = ip.split('.');
    if (segments.length !== 4) {
      throw new Error('Invalid IP address format');
    }
    return segments.slice(0, 3).join('.');
  }

  private static async registerNetwork(networkId: string, ip: string) {
    try {
      // Store network information in Supabase
      const { error } = await supabase
        .from('networks')
        .upsert({
          network_id: networkId,
          ip_address: ip,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'network_id'
        });

      if (error) {
        console.error('Error registering network:', error);
      }
    } catch (error) {
      console.error('Error registering network:', error);
    }
  }

  static async validateFileAccess(fileNetworkId?: string): Promise<boolean> {
    if (!fileNetworkId) return false;
    
    try {
      // Get current network ID
      const currentNetworkId = await this.detectNetwork();
      
      // Compare network IDs
      return currentNetworkId === fileNetworkId;
    } catch (error) {
      console.error('Error validating file access:', error);
      return false;
    }
  }

  static async isOnSameNetwork(networkId?: string): Promise<boolean> {
    if (!networkId) return false;
    return this.validateFileAccess(networkId);
  }

  static async getCurrentNetworkId(): Promise<string | null> {
    try {
      return await this.detectNetwork();
    } catch (error) {
      console.error('Error getting current network ID:', error);
      return null;
    }
  }
}
