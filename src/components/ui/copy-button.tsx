"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CopyButtonProps {
  textToCopy: string;
}

export default function CopyButton({ textToCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    if (!navigator.clipboard) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        toast.error("Failed to copy");
      }
      document.body.removeChild(textArea);
      return;
    }

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        toast.error("Failed to copy");
      });
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "relative h-8 w-8 bg-white",
              copied ? "text-emerald-500" : "text-gray-700 hover:text-gray-900"
            )}
            onClick={handleCopy}
          >
            <span className={cn(
              "absolute transition-all",
              copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
            )}>
              <Check className="h-4 w-4" />
            </span>
            <span className={cn(
              "absolute transition-all",
              copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
            )}>
              <Copy className="h-4 w-4" />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{copied ? "Copied!" : "Copy to clipboard"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}