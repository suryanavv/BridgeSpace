
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getCachedNetworkPrefix } from '@/utils/networkUtils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import debounce from 'lodash/debounce';

interface TextShareProps {
  networkConnected: boolean;
  onTextShared: (text: string) => void;
}

const TextShare: React.FC<TextShareProps> = ({ networkConnected, onTextShared }) => {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveInProgress = useRef(false);
  const maxLength = 5000;

  // Create memoized save function
  const saveContent = useCallback(async (newContent: string) => {
    if (saveInProgress.current || !networkConnected) return;
    
    try {
      saveInProgress.current = true;
      setIsSaving(true);
      setAutoSaveStatus('saving');
      
      const networkPrefix = getCachedNetworkPrefix();
      if (!networkPrefix) {
        throw new Error('Network not identified');
      }

      const { data: existingText } = await supabase
        .from('shared_texts')
        .select('id')
        .eq('network_prefix', networkPrefix)
        .maybeSingle();

      if (existingText) {
        // Update existing text
        const { error } = await supabase
          .from('shared_texts')
          .update({ 
            content: newContent,
            shared_at: new Date().toISOString()
          })
          .eq('id', existingText.id);

        if (error) throw error;
      } else {
        // Create new text entry
        const { error } = await supabase
          .from('shared_texts')
          .insert({
            content: newContent,
            network_prefix: networkPrefix,
            shared_at: new Date().toISOString()
          });

        if (error) throw error;
      }
      
      setLastSavedContent(newContent);
      onTextShared(newContent);
      toast.success('Changes saved successfully');
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
  }, [networkConnected, onTextShared]);

  // Create debounced version of save function
  const debouncedSave = useCallback(
    debounce((newContent: string) => {
      saveContent(newContent);
    }, 1000),
    [saveContent]
  );

  // Handle content changes with debounce
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= maxLength) {
      setText(newContent);
      if (newContent !== lastSavedContent) {
        setAutoSaveStatus('saving');
        debouncedSave(newContent);
      }
    }
  }, [lastSavedContent, debouncedSave, maxLength]);

  // Manual save handler
  const handleSave = async () => {
    if (text === lastSavedContent) return;
    debouncedSave.cancel(); // Cancel any pending debounced saves
    await saveContent(text);
  };

  // Load initial content and setup real-time subscription
  useEffect(() => {
    if (!networkConnected) return;

    const loadContent = async () => {
      try {
        const networkPrefix = getCachedNetworkPrefix();
        const { data, error } = await supabase
          .from('shared_texts')
          .select('content, shared_at')
          .eq('network_prefix', networkPrefix)
          .order('shared_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        if (data) {
          setText(data.content || '');
          setLastSavedContent(data.content || '');
        }
      } catch (error) {
        console.error('Error loading content:', error);
      }
    };

    loadContent();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('shared_texts_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_texts',
          filter: `network_prefix=eq.${getCachedNetworkPrefix()}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'content' in payload.new) {
            const newContent = payload.new.content || '';
            setText(newContent);
            setLastSavedContent(newContent);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      debouncedSave.cancel();
    };
  }, [networkConnected, debouncedSave]);

  return (
    <div className="glass-card rounded-lg p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Text Editor</h2>
        <div className="flex items-center gap-4">
          <Badge 
            variant="secondary" 
            className={`transition-colors duration-300 ${
              autoSaveStatus === 'saving' 
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {autoSaveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </Badge>
          <Button
            onClick={handleSave}
            disabled={!networkConnected || !text.trim() || isSaving || text === lastSavedContent}
            size="sm"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <Textarea
        placeholder="Start typing..."
        value={text}
        onChange={handleTextChange}
        className="min-h-[300px] resize-none font-mono"
        disabled={!networkConnected || isSaving}
      />

      {!networkConnected && (
        <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded">
          Connect to a network to start editing
        </div>
      )}
    </div>
  );
};

export default TextShare;
