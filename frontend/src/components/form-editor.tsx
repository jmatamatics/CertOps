"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function toLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLongText(value: string): boolean {
  return value.length > 80 || value.includes("\n");
}

interface FieldEditorProps {
  label: string;
  value: unknown;
  onChange: (newValue: unknown) => void;
  depth?: number;
}

function FieldEditor({ label, value, onChange, depth = 0 }: FieldEditorProps) {
  if (typeof value === "string") {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        {isLongText(value) ? (
          <textarea
            className="w-full bg-muted/30 border border-border rounded-md p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[80px]"
            rows={Math.min(Math.max(value.split("\n").length, 3), 10)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            type="text"
            className="w-full bg-muted/30 border border-border rounded-md p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
        <input
          type="number"
          className="w-full bg-muted/30 border border-border rounded-md p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {label}
          </label>
          <p className="text-xs text-muted-foreground italic">Empty list</p>
        </div>
      );
    }

    if (typeof value[0] === "string") {
      return <StringListEditor label={label} items={value as string[]} onChange={onChange} />;
    }

    if (typeof value[0] === "object" && value[0] !== null) {
      return (
        <ObjectListEditor
          label={label}
          items={value as Record<string, unknown>[]}
          onChange={onChange}
          depth={depth}
        />
      );
    }
  }

  if (typeof value === "object" && value !== null) {
    return (
      <ObjectEditor
        label={label}
        obj={value as Record<string, unknown>}
        onChange={onChange}
        depth={depth}
      />
    );
  }

  return null;
}

function StringListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (newValue: unknown) => void;
}) {
  function updateItem(index: number, newValue: string) {
    const updated = [...items];
    updated[index] = newValue;
    onChange(updated);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, ""]);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-muted/30 border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => removeItem(i)}
            className="text-xs text-destructive shrink-0"
          >
            Remove
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addItem} className="text-xs">
        + Add item
      </Button>
    </div>
  );
}

function ObjectListEditor({
  label,
  items,
  onChange,
  depth,
}: {
  label: string;
  items: Record<string, unknown>[];
  onChange: (newValue: unknown) => void;
  depth: number;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function updateItem(index: number, updated: unknown) {
    const newItems = [...items];
    newItems[index] = updated as Record<string, unknown>;
    onChange(newItems);
  }

  function removeItem(index: number) {
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
    onChange(items.filter((_, i) => i !== index));
  }

  const nameField = items[0]
    ? (["name", "title", "level", "criterion", "stem", "assessment_ref"] as const).find(
        (f) => f in items[0],
      )
    : undefined;

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        {label} ({items.length})
      </label>
      {items.map((item, i) => {
        const itemLabel = nameField
          ? String(item[nameField]).slice(0, 60)
          : `Item ${i + 1}`;

        return (
          <Card key={i} className="border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex-1 flex items-center justify-between text-left min-w-0"
                  onClick={() =>
                    setExpandedIndex(expandedIndex === i ? null : i)
                  }
                >
                  <span className="text-sm font-medium truncate">
                    {itemLabel}
                  </span>
                  <Badge variant="outline" className="shrink-0 ml-2 text-[10px]">
                    {expandedIndex === i ? "Collapse" : "Expand"}
                  </Badge>
                </button>
                {items.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeItem(i)}
                    className="shrink-0 ml-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </Button>
                )}
              </div>
              {expandedIndex === i && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  <ObjectEditor
                    label=""
                    obj={item}
                    onChange={(updated) => updateItem(i, updated)}
                    depth={depth + 1}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ObjectEditor({
  label,
  obj,
  onChange,
  depth,
}: {
  label: string;
  obj: Record<string, unknown>;
  onChange: (newValue: unknown) => void;
  depth: number;
}) {
  function updateField(key: string, newValue: unknown) {
    onChange({ ...obj, [key]: newValue });
  }

  return (
    <div className="space-y-3">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      {Object.entries(obj).map(([key, val]) => (
        <FieldEditor
          key={key}
          label={toLabel(key)}
          value={val}
          onChange={(newVal) => updateField(key, newVal)}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

// ── Main exported component ──

interface FormEditorProps {
  title: string;
  data: unknown;
  onSave: (updated: unknown) => void;
  onCancel: () => void;
}

export function FormEditor({ title, data, onSave, onCancel }: FormEditorProps) {
  const [formData, setFormData] = useState<unknown>(
    JSON.parse(JSON.stringify(data)),
  );

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Editing: {title}</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="text-xs"
          >
            &larr; Back to sections
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Edit the fields below, then click <strong>Save &amp; Replay</strong>{" "}
          to regenerate all downstream artifacts.
        </p>

        <Separator />

        <FieldEditor label="" value={formData} onChange={setFormData} />

        <Separator />

        <div className="flex gap-2">
          <Button size="sm" onClick={() => onSave(formData)}>
            Save &amp; Replay
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
