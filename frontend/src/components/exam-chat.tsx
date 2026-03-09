"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import type { ExamMessage } from "@/lib/types";

function TypewriterMarkdown({ content, speed = 12 }: { content: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= content.length) {
        setDisplayed(content);
        setDone(true);
        clearInterval(id);
      } else {
        setDisplayed(content.slice(0, i));
      }
    }, speed);
    return () => clearInterval(id);
  }, [content, speed]);

  return (
    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_h2]:text-base [&_h2]:mt-2 [&_h2]:mb-1 [&_strong]:text-foreground [&_em]:text-muted-foreground">
      <ReactMarkdown>{done ? content : displayed}</ReactMarkdown>
    </div>
  );
}

function MarkdownBubble({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_h2]:text-base [&_h2]:mt-2 [&_h2]:mb-1 [&_strong]:text-foreground [&_em]:text-muted-foreground">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

interface ExamChatProps {
  messages: ExamMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ExamChat({
  messages,
  inputValue,
  onInputChange,
  onSend,
  disabled,
  placeholder = "Type your response...",
}: ExamChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    if (messages.length > prevCountRef.current) {
      const lastIdx = messages.length - 1;
      if (messages[lastIdx]?.role === "agent") {
        setAnimatingIndex(lastIdx);
      }
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !disabled) onSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === "learner" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "learner"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.role === "agent" && i === animatingIndex ? (
                  <TypewriterMarkdown content={msg.content} />
                ) : msg.role === "agent" ? (
                  <MarkdownBubble content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {disabled && messages.length > 0 && messages[messages.length - 1]?.role === "learner" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
              {" "}Evaluating your response
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border pt-3 flex gap-2 items-end">
        <textarea
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[60px] disabled:opacity-50"
        />
        <Button
          size="icon"
          onClick={onSend}
          disabled={disabled || !inputValue.trim()}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
