
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { saveSharedText } from '@/utils/networkUtils';

interface TextShareProps {
  networkConnected: boolean;
  onTextShared: (text: string) => void;
}

const TextShare: React.FC<TextShareProps> = ({ networkConnected, onTextShared }) => {
  const [text, setText] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const maxLength = 5000;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    if (newText.length <= maxLength) {
      setText(newText);
      setCharCount(newText.length);
    }
  };

  const handleShare = async () => {
    if (!text.trim()) {
      toast.error('Empty text', {
        description: 'Please enter some text to share.',
      });
      return;
    }
    
    if (!networkConnected) {
      toast.error('Network disconnected', {
        description: 'Please connect to a network to share text.',
      });
      return;
    }
    
    setIsSharing(true);
    
    try {
      // Save the text to the database
      await saveSharedText(text);
      
      // Notify the parent component
      onTextShared(text);
      
      toast.success('Text shared', {
        description: 'Your text is now available on your network.',
      });
      
      // Clear text after sharing
      setText('');
      setCharCount(0);
    } catch (error) {
      console.error('Text sharing error:', error);
      toast.error('Sharing failed', {
        description: error instanceof Error ? error.message : 'Failed to share text. Please try again.',
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="glass-card rounded-lg p-6 animate-fade-in">
      <h2 className="text-lg font-medium mb-4">Share Text</h2>
      
      <Textarea
        placeholder="Type or paste text to share..."
        value={text}
        onChange={handleTextChange}
        className="resize-none min-h-[120px]"
        disabled={!networkConnected || isSharing}
      />
      
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted-foreground">
          {charCount}/{maxLength} characters
        </span>
        
        <Button
          onClick={handleShare}
          disabled={!networkConnected || !text.trim() || isSharing}
          size="sm"
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isSharing ? 'Sharing...' : 'Share Text'}
        </Button>
      </div>
      
      {!networkConnected && (
        <div className="bg-yellow-50 text-yellow-800 text-xs p-2 rounded mt-2">
          Connect to a network to share text
        </div>
      )}
    </div>
  );
};

export default TextShare;
