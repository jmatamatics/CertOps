"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamMessage } from "@/lib/types";

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "learner"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                {msg.content.split("\n").map((line, j) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return (
                      <p key={j} className="font-semibold">
                        {line.replace(/\*\*/g, "")}
                      </p>
                    );
                  }
                  if (line.startsWith("_") && line.endsWith("_")) {
                    return (
                      <p key={j} className="italic text-muted-foreground text-xs">
                        {line.replace(/_/g, "")}
                      </p>
                    );
                  }
                  return <p key={j}>{line || "\u00A0"}</p>;
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
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
