"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  action?: () => void;
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
}

function getTooltipPosition(
  rect: DOMRect,
  placement: "top" | "bottom" | "left" | "right",
  tooltipWidth: number,
) {
  const gap = 12;
  switch (placement) {
    case "top":
      return {
        top: rect.top + window.scrollY - gap,
        left: rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2,
        transform: "translateY(-100%)",
      };
    case "bottom":
      return {
        top: rect.bottom + window.scrollY + gap,
        left: rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2,
        transform: "translateY(0)",
      };
    case "left":
      return {
        top: rect.top + window.scrollY + rect.height / 2,
        left: rect.left + window.scrollX - gap - tooltipWidth,
        transform: "translateY(-50%)",
      };
    case "right":
      return {
        top: rect.top + window.scrollY + rect.height / 2,
        left: rect.right + window.scrollX + gap,
        transform: "translateY(-50%)",
      };
  }
}

export function GuidedTour({ steps, isOpen, onClose }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const TOOLTIP_WIDTH = 340;

  const positionTooltip = useCallback(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const placement = step.placement ?? "bottom";

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    setHighlightStyle({
      position: "absolute",
      top: rect.top + window.scrollY - 4,
      left: rect.left + window.scrollX - 4,
      width: rect.width + 8,
      height: rect.height + 8,
      borderRadius: 8,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
      zIndex: 9998,
      pointerEvents: "none",
      transition: "all 0.3s ease",
    });

    const pos = getTooltipPosition(rect, placement, TOOLTIP_WIDTH);
    setTooltipStyle({
      position: "absolute",
      ...pos,
      width: TOOLTIP_WIDTH,
      zIndex: 9999,
    });
  }, [isOpen, currentStep, steps]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      return;
    }

    const timer = setTimeout(positionTooltip, 100);
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", positionTooltip);
      window.removeEventListener("scroll", positionTooltip, true);
    };
  }, [isOpen, positionTooltip]);

  function goNext() {
    const step = steps[currentStep];

    if (step.action) {
      step.action();
      setTimeout(() => {
        if (currentStep < steps.length - 1) {
          setCurrentStep((prev) => prev + 1);
        } else {
          onClose();
        }
      }, 300);
    } else {
      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        onClose();
      }
    }
  }

  function goPrev() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }

  if (!mounted || !isOpen) return null;

  const step = steps[currentStep];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Highlight cutout */}
          <div style={highlightStyle} />

          {/* Tooltip */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={tooltipStyle}
          >
            <div className="bg-popover border border-border rounded-lg shadow-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h4>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {currentStep + 1}/{steps.length}
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {step.content}
              </p>

              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClose}
                  className="text-xs text-muted-foreground"
                >
                  Skip tour
                </Button>
                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button size="sm" variant="outline" onClick={goPrev} className="text-xs">
                      Back
                    </Button>
                  )}
                  <Button size="sm" onClick={goNext} className="text-xs">
                    {currentStep < steps.length - 1 ? "Next" : "Done"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
