import React, { useState, useEffect, useCallback } from 'react';
import { UsersIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase';
import CopyButton from '@/components/ui/copy-button';

export const TextEditor = () => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadContent();

    const channel = supabase
      .channel('public:shared_text')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'shared_text' },
        (payload: any) => {
          if (payload.new && payload.new.content !== content) {
            setContent(payload.new.content || '');
            toast.success("Text updated by another user");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('shared_text')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const newContent = data.content || '';
        if (newContent === content) {
          toast.info('Content is already up to date');
        } else {
          setContent(newContent);
          setLastSavedContent(newContent);
        }
      } else {
        const { error: insertError } = await supabase
          .from('shared_text')
          .insert([{ content: '' }]);
        
        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    loadContent();
    setIsRefreshing(false);
  };

  const handleContentChange = useCallback(async (newContent: string) => {
    setContent(newContent);
    
    try {
      if (newContent === lastSavedContent) return;

      setIsSaving(true);

      const { data } = await supabase
        .from('shared_text')
        .select('id')
        .limit(1)
        .single();

      if (data) {
        const { error } = await supabase
          .from('shared_text')
          .update({ content: newContent })
          .eq('id', data.id);

        if (error) throw error;

        setLastSavedContent(newContent);
        toast.success('Changes saved successfully');
      }
    } catch (error) {
      console.error('Error updating shared text:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [lastSavedContent]);

  // Debounce the content update
  useEffect(() => {
    const timer = setTimeout(() => {
      handleContentChange(content);
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, handleContentChange]);

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
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">Text Editor</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isRefreshing}
            title="Refresh content"
          >
            <RefreshCwIcon 
              className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : 'hover:text-gray-700'}`}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 min-h-0 relative">
        <textarea
          className="w-full h-full p-4 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none font-mono"
          placeholder="Start typing here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        {content && (
          <div className="absolute top-8 right-8">
            <CopyButton textToCopy={content} />
          </div>
        )}
      </div>
    </div>
  );
};