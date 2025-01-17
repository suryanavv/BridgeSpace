import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UsersIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase';
import CopyButton from '@/components/ui/copy-button';
import { NetworkUtils } from '@/utils/network';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import debounce from 'lodash/debounce';

// Add this component for the animated dots
const AnimatedDots = () => (
  <span className="inline-flex ml-1">
    <span className="animate-dot">.</span>
    <span className="animate-dot" style={{ animationDelay: '0.2s' }}>.</span>
    <span className="animate-dot" style={{ animationDelay: '0.4s' }}>.</span>
  </span>
);

export const TextEditor = () => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveInProgress = useRef(false);

  // Create a memoized save function
  const saveContent = useCallback(async (newContent: string) => {
    if (saveInProgress.current) return;
    
    try {
      saveInProgress.current = true;
      setIsSaving(true);
      setAutoSaveStatus('saving');
      
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      if (!currentNetworkId) {
        throw new Error('Network not identified');
      }

      const { data } = await supabase
        .from('shared_text')
        .select('id')
        .eq('network_id', currentNetworkId)
        .single();

      if (data) {
        const { error } = await supabase
          .from('shared_text')
          .update({ 
            content: newContent,
            network_id: currentNetworkId 
          })
          .eq('network_id', currentNetworkId);

        if (error) throw error;
        
        setLastSavedContent(newContent);
        toast.success('Changes saved successfully');
      }
    } catch (error) {
      console.error('Error saving text:', error);
      toast.error('Failed to save changes');
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
      setTimeout(() => {
        setAutoSaveStatus('saved');
      }, 1000);
    }
  }, [networkId]);

  // Create debounced version of save function
  const debouncedSave = useCallback(
    debounce((newContent: string) => {
      saveContent(newContent);
    }, 1000),
    [saveContent]
  );

  // Handle content changes with debounce
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (newContent !== lastSavedContent) {
      setAutoSaveStatus('saving');
      debouncedSave(newContent);
    }
  }, [lastSavedContent, debouncedSave]);

  // Manual save handler
  const handleManualSave = async () => {
    if (content === lastSavedContent) return;
    debouncedSave.cancel(); // Cancel any pending debounced saves
    await saveContent(content);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel(); // Cancel any pending debounced saves
    };
  }, [debouncedSave]);

  useEffect(() => {
    const init = async () => {
      try {
        const detectedNetworkId = await NetworkUtils.detectNetwork();
        setNetworkId(detectedNetworkId);
        loadContent();
      } catch (error) {
        console.error('Error initializing network:', error);
        toast.error("Failed to initialize network", {
          description: "Could not detect your network. Please try again."
        });
      }
    };
    init();

    const channel = supabase
      .channel('public:shared_text')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'shared_text' },
        async (payload: any) => {
          if (payload.new && payload.new.network_id === networkId) {
            setContent(payload.new.content || '');
            setLastSavedContent(payload.new.content || '');
            toast.success("Text updated by another user");
          }
        }
      )
      .subscribe();

    // Cleanup subscription and event listeners on unmount
    return () => {
      channel.unsubscribe();
      debouncedSave.cancel();
    };
  }, [networkId, debouncedSave]);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      
      if (!currentNetworkId) {
        toast.error("Network not identified");
        return;
      }

      // Get text for current network
      const { data, error } = await supabase
        .from('shared_text')
        .select('content')
        .eq('network_id', currentNetworkId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // If no content exists, create initial record
      if (!data) {
        const { error: insertError } = await supabase
          .from('shared_text')
          .insert([
            {
              content: '',
              network_id: currentNetworkId
            }
          ]);

        if (insertError) throw insertError;
        
        setContent('');
        setLastSavedContent('');
        return;
      }

      setContent(data.content);
      setLastSavedContent(data.content);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error("Failed to load content");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const currentNetworkId = networkId || await NetworkUtils.detectNetwork();
      
      if (!currentNetworkId) {
        toast.error("Network not identified");
        return;
      }

      const { data, error } = await supabase
        .from('shared_text')
        .select('content')
        .eq('network_id', currentNetworkId)
        .single();

      if (error) throw error;

      if (data.content !== content) {
        setContent(data.content);
        toast.success('Content refreshed successfully');
      } else {
        toast.info('Content is already up to date');
      }
    } catch (error) {
      console.error('Error refreshing content:', error);
      toast.error('Failed to refresh content');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Text Editor</h2>
          <div className="flex items-center space-x-2">
            <Loader2Icon className="w-4 h-4 animate-spin" />
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Text Editor</h2>
          <Badge 
            variant="secondary" 
            className={`ml-2 transition-colors duration-300 ${
              autoSaveStatus === 'saving' 
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {autoSaveStatus === 'saving' ? (
              <span className="flex items-center">
                Auto-saving<AnimatedDots />
              </span>
            ) : 'Auto-saved'}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSave}
          disabled={isSaving || content === lastSavedContent}
        >
          Save
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <div className="relative h-full">
          <textarea
            ref={textareaRef}
            className="w-full h-full p-4 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none font-mono overflow-y-auto"
            placeholder="Start typing here..."
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleManualSave}
          />
          {content && (
            <div className="absolute top-2 right-2">
              <CopyButton textToCopy={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};