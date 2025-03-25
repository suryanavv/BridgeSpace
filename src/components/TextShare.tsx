import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getCachedNetworkPrefix, saveSharedText, fetchSharedTexts } from '@/utils/networkUtils';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import debounce from 'lodash/debounce';

interface TextShareProps {
  networkConnected: boolean;
  onTextShared: (text: string) => void;
  privateSpaceKey?: string;
}

const TextShare: React.FC<TextShareProps> = ({ networkConnected, onTextShared, privateSpaceKey }) => {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveInProgress = useRef(false);
  const maxLength = 5000;

  // Create memoized save function
  const saveContent = useCallback(async (newContent: string) => {
    if (saveInProgress.current || !networkConnected) return;
    
    try {
      saveInProgress.current = true;
      setIsSaving(true);
      setAutoSaveStatus('saving');
      
      await saveSharedText(newContent, privateSpaceKey);
      
      setLastSavedContent(newContent);
      onTextShared(newContent);
      setAutoSaveStatus('saved');
      toast.success('Changes saved successfully');
    } catch (error) {
      console.error('Error saving text:', error);
      setAutoSaveStatus('unsaved');
      toast.error('Failed to save changes');
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }, [networkConnected, onTextShared, privateSpaceKey]);

  // Create debounced version of save function
  const debouncedSave = useCallback(
    debounce((newContent: string) => {
      saveContent(newContent);
    }, 10000),
    [saveContent]
  );

  // Handle content changes with debounce
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    if (newContent.length <= maxLength) {
      setText(newContent);
      if (newContent !== lastSavedContent) {
        setAutoSaveStatus('unsaved');
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
        const texts = await fetchSharedTexts(privateSpaceKey);
        if (texts && texts.length > 0) {
          setText(texts[0].content || '');
          setLastSavedContent(texts[0].content || '');
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
          filter: privateSpaceKey 
            ? `private_space_key=eq.${privateSpaceKey}` 
            : `network_prefix=eq.${getCachedNetworkPrefix()}`,
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
  }, [networkConnected, debouncedSave, privateSpaceKey]);

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md animate-fade-in">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700">
            <Save className="h-3 w-3 mr-1" /> Text Editor
          </Badge>
        </div>
        <Badge 
          variant="outline" 
          className={`transition-colors duration-300 ${
            autoSaveStatus === 'saving' 
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
              : autoSaveStatus === 'unsaved'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
          }`}
        >
          {autoSaveStatus === 'saving' ? 'Saving...' : autoSaveStatus === 'unsaved' ? 'Unsaved' : 'Saved'}
        </Badge>
      </div>

      <Textarea
        placeholder="Start typing..."
        value={text}
        onChange={handleTextChange}
        className="min-h-[250px] resize-none font-mono border-slate-200 dark:border-slate-700 focus:border-slate-400 bg-white dark:bg-slate-900 mb-3"
        disabled={!networkConnected || isSaving}
      />
      
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {text.length}/{maxLength} characters
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Auto-saves every 10 seconds
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={!networkConnected || isSaving || text === lastSavedContent}
          size="sm"
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {!networkConnected && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs rounded">
          Connect to a network or enter a private space to start editing
        </div>
      )}
    </div>
  );
};

export default TextShare;
