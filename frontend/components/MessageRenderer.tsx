import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface MessageRendererProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
}

interface CodeSection {
  title: string;
  language: string;
  code: string;
  expanded: boolean;
}

export default function MessageRenderer({ content, role }: MessageRendererProps) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Content copied to clipboard',
    });
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const parseStructuredResponse = (text: string) => {
    // Check if this is a structured response (starts with quoted text and has "Thought process")
    const isStructured = text.includes('## Thought process') || text.includes('Thought process');
    
    if (!isStructured || role !== 'assistant') {
      return { isStructured: false, content: text };
    }

    const sections = [];
    let currentSection = '';
    let inThoughtProcess = false;
    let thoughtProcessContent = '';
    
    const lines = text.split('\n');
    let userRequest = '';
    let acknowledgment = '';
    
    // Extract user request (quoted text at the beginning)
    const quotedMatch = text.match(/^"([^"]+)"/);
    if (quotedMatch) {
      userRequest = quotedMatch[1];
    }
    
    // Extract acknowledgment (text before "Thought process")
    const beforeThought = text.split(/##?\s*Thought process/i)[0];
    if (beforeThought) {
      acknowledgment = beforeThought.replace(/^"[^"]*"/, '').trim();
    }
    
    // Extract thought process
    const thoughtMatch = text.match(/##?\s*Thought process\s*\n(.*?)(?=##|\n<details|$)/is);
    if (thoughtMatch) {
      thoughtProcessContent = thoughtMatch[1].trim();
    }
    
    // Extract code sections
    const detailsMatches = text.matchAll(/<details>\s*<summary>([^<]+)<\/summary>\s*```(\w+)?\s*(.*?)```\s*<\/details>/gs);
    const codeSections: CodeSection[] = [];
    
    for (const match of detailsMatches) {
      const title = match[1].trim();
      const language = match[2] || 'text';
      const code = match[3].trim();
      codeSections.push({
        title,
        language,
        code,
        expanded: false
      });
    }
    
    return {
      isStructured: true,
      userRequest,
      acknowledgment,
      thoughtProcess: thoughtProcessContent,
      codeSections
    };
  };

  const parsed = parseStructuredResponse(content);

  if (!parsed.isStructured) {
    return (
      <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Request Quote */}
      {parsed.userRequest && (
        <div className="text-lg font-medium text-foreground border-l-4 border-primary pl-4 italic">
          "{parsed.userRequest}"
        </div>
      )}
      
      {/* Acknowledgment */}
      {parsed.acknowledgment && (
        <div className="text-foreground">
          {parsed.acknowledgment}
        </div>
      )}
      
      {/* Thought Process */}
      {parsed.thoughtProcess && (
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection(-1)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium text-foreground">Thought process</span>
            {expandedSections[-1] ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {expandedSections[-1] && (
            <div className="px-4 pb-4 text-sm text-muted-foreground border-t bg-muted/20">
              <div className="whitespace-pre-wrap pt-3">
                {parsed.thoughtProcess}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Implementation Section */}
      {parsed.codeSections && parsed.codeSections.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-foreground">Implementation</h3>
          <p className="text-sm text-muted-foreground">I'll create the following files:</p>
          
          {parsed.codeSections.map((section, index) => (
            <div key={index} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(index)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-sm">{section.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{section.language}</span>
                  {expandedSections[index] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </button>
              {expandedSections[index] && (
                <div className="border-t bg-muted/20">
                  <div className="flex justify-end p-2 border-b bg-muted/30">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(section.code)}
                      className="h-6 px-2 text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <pre className="p-4 text-sm overflow-x-auto">
                    <code className={`language-${section.language}`}>
                      {section.code}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}