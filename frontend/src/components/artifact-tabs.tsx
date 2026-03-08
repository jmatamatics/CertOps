"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FrameworkView } from "@/components/framework-view";
import { LearningPathView } from "@/components/learning-path-view";
import { AssessmentsView } from "@/components/assessments-view";
import { RubricsView } from "@/components/rubrics-view";
import { ItemBankView } from "@/components/item-bank-view";
import { BlueprintView } from "@/components/blueprint-view";
import { FormEditor } from "@/components/form-editor";
import type { CertOpsOutput, ArtifactKey } from "@/lib/types";

interface ArtifactTabsProps {
  data: CertOpsOutput;
  onEdit?: (artifactKey: ArtifactKey, updatedData: unknown) => void;
}

const TAB_CONFIG: { key: ArtifactKey; label: string }[] = [
  { key: "competency_framework", label: "Framework" },
  { key: "learning_progression", label: "Learning Path" },
  { key: "assessments", label: "Assessments" },
  { key: "rubrics", label: "Rubrics" },
  { key: "item_bank", label: "Item Bank" },
  { key: "blueprint", label: "Blueprint" },
];

// ── Section picker: breaks an artifact into editable sections ──

interface SectionInfo {
  label: string;
  description: string;
  path: (string | number)[];
}

function getSections(key: ArtifactKey, data: CertOpsOutput): SectionInfo[] {
  switch (key) {
    case "competency_framework": {
      const fw = data.competency_framework;
      const sections: SectionInfo[] = [
        {
          label: "Track & Description",
          description: `"${fw.track}" - ${fw.description.slice(0, 80)}...`,
          path: ["__top_level__"],
        },
      ];
      fw.domains.forEach((domain, i) => {
        sections.push({
          label: domain.name,
          description: `${domain.skills.length} skills - ${domain.description.slice(0, 60)}...`,
          path: ["domains", i],
        });
      });
      return sections;
    }
    case "learning_progression": {
      const lp = data.learning_progression;
      return lp.objectives.map((obj, i) => ({
        label: `${obj.order}. ${obj.title}`,
        description: `${obj.domain} - ${obj.estimated_hours}h`,
        path: ["objectives", i],
      }));
    }
    case "assessments":
      return data.assessments.map((task, i) => ({
        label: task.title,
        description: `${task.competency_ref} - ${task.time_estimate_minutes}min`,
        path: [i],
      }));
    case "rubrics":
      return data.rubrics.map((rubric, i) => ({
        label: rubric.assessment_ref,
        description: `${rubric.criteria.length} criteria`,
        path: [i],
      }));
    case "item_bank":
      return data.item_bank.map((item, i) => ({
        label: `${item.task_type}: ${item.stem.slice(0, 60)}...`,
        description: item.competency_ref,
        path: [i],
      }));
    case "blueprint": {
      const bp = data.blueprint;
      return [
        { label: "Program Title", description: bp.program_title, path: ["program_title"] },
        { label: "Target Audience", description: bp.target_audience.slice(0, 60), path: ["target_audience"] },
        { label: "Prerequisites", description: bp.prerequisites.slice(0, 60), path: ["prerequisites"] },
        { label: "Program Overview", description: bp.program_overview.slice(0, 60) + "...", path: ["program_overview"] },
        { label: "Domain Summary", description: `${bp.domain_summary.length} domains`, path: ["domain_summary"] },
        { label: "Assessment Strategy", description: bp.assessment_strategy.slice(0, 60) + "...", path: ["assessment_strategy"] },
        { label: "Duration & Renewal", description: `${bp.estimated_duration_hours}h, ${bp.renewal_cadence.slice(0, 40)}...`, path: ["__duration_renewal__"] },
      ];
    }
  }
}

function extractSection(artifact: unknown, section: SectionInfo): unknown {
  if (section.path[0] === "__top_level__") {
    const fw = artifact as Record<string, unknown>;
    return { track: fw.track, description: fw.description };
  }
  if (section.path[0] === "__duration_renewal__") {
    const bp = artifact as Record<string, unknown>;
    return {
      estimated_duration_hours: bp.estimated_duration_hours,
      renewal_cadence: bp.renewal_cadence,
    };
  }

  let current: unknown = artifact;
  for (const key of section.path) {
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function mergeSection(
  artifact: unknown,
  section: SectionInfo,
  updated: unknown,
): unknown {
  const clone = JSON.parse(JSON.stringify(artifact));

  if (section.path[0] === "__top_level__") {
    const upd = updated as Record<string, unknown>;
    clone.track = upd.track;
    clone.description = upd.description;
    return clone;
  }
  if (section.path[0] === "__duration_renewal__") {
    const upd = updated as Record<string, unknown>;
    clone.estimated_duration_hours = upd.estimated_duration_hours;
    clone.renewal_cadence = upd.renewal_cadence;
    return clone;
  }

  if (section.path.length === 1) {
    clone[section.path[0]] = updated;
    return clone;
  }

  let parent = clone;
  for (let i = 0; i < section.path.length - 1; i++) {
    parent = parent[section.path[i]];
  }
  parent[section.path[section.path.length - 1]] = updated;
  return clone;
}

// ── Section editor (form-based) ──

function SectionEditor({
  section,
  data,
  onSave,
  onCancel,
}: {
  section: SectionInfo;
  data: unknown;
  onSave: (updated: unknown) => void;
  onCancel: () => void;
}) {
  const sectionData = extractSection(data, section);

  function handleSave(updated: unknown) {
    const merged = mergeSection(data, section, updated);
    onSave(merged);
  }

  return (
    <FormEditor
      title={section.label}
      data={sectionData}
      onSave={handleSave}
      onCancel={onCancel}
    />
  );
}

// ── Section picker (drill-down list) ──

function SectionPicker({
  artifactKey,
  data,
  onSelectSection,
  onCancel,
}: {
  artifactKey: ArtifactKey;
  data: CertOpsOutput;
  onSelectSection: (section: SectionInfo) => void;
  onCancel: () => void;
}) {
  const sections = getSections(artifactKey, data);
  const label = TAB_CONFIG.find((t) => t.key === artifactKey)?.label ?? "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Choose a section of <span className="text-primary">{label}</span> to edit
        </h4>
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-xs">
          Cancel
        </Button>
      </div>
      <Separator />
      <div className="grid gap-2">
        {sections.map((section, i) => (
          <Card
            key={i}
            className="border-border/50 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => onSelectSection(section)}
          >
            <CardContent className="flex items-center justify-between py-3 px-4">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{section.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {section.description}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 ml-3 text-[10px]">
                Edit
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Main component ──

type EditState =
  | { mode: "view" }
  | { mode: "picking"; artifactKey: ArtifactKey }
  | { mode: "editing"; artifactKey: ArtifactKey; section: SectionInfo };

export interface ArtifactTabsHandle {
  openPicker: (key: ArtifactKey) => void;
  selectSection: (key: ArtifactKey, sectionIndex: number) => void;
  resetView: () => void;
}

export const ArtifactTabs = forwardRef<ArtifactTabsHandle, ArtifactTabsProps>(
  function ArtifactTabs({ data, onEdit }, ref) {
  const [editState, setEditState] = useState<EditState>({ mode: "view" });

  useImperativeHandle(ref, () => ({
    openPicker(key: ArtifactKey) {
      setEditState({ mode: "picking", artifactKey: key });
    },
    selectSection(key: ArtifactKey, sectionIndex: number) {
      const sections = getSections(key, data);
      if (sectionIndex < sections.length) {
        setEditState({ mode: "editing", artifactKey: key, section: sections[sectionIndex] });
      }
    },
    resetView() {
      setEditState({ mode: "view" });
    },
  }));

  function handleSave(key: ArtifactKey, mergedArtifact: unknown) {
    setEditState({ mode: "view" });
    onEdit?.(key, mergedArtifact);
  }

  return (
    <Tabs defaultValue="competency_framework" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        {TAB_CONFIG.map(({ key, label }) => (
          <TabsTrigger key={key} value={key} className="text-xs">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {TAB_CONFIG.map(({ key }) => {
        const isEditingThisTab =
          editState.mode !== "view" && editState.artifactKey === key;

        return (
          <TabsContent key={key} value={key} className="mt-4">
            {/* Edit button - visible on any tab not currently being edited */}
            {onEdit && !isEditingThisTab && (
              <div data-tour="edit-button" className="flex justify-end mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEditState({ mode: "picking", artifactKey: key })
                  }
                  className="text-xs"
                >
                  Edit {TAB_CONFIG.find((t) => t.key === key)?.label}
                </Button>
              </div>
            )}

            {/* Section picker */}
            {editState.mode === "picking" && isEditingThisTab && (
              <div data-tour="section-picker">
              <SectionPicker
                artifactKey={key}
                data={data}
                onSelectSection={(section) =>
                  setEditState({ mode: "editing", artifactKey: key, section })
                }
                onCancel={() => setEditState({ mode: "view" })}
              />
              </div>
            )}

            {/* Section editor */}
            {editState.mode === "editing" && isEditingThisTab && (
              <div data-tour="form-editor">
              <SectionEditor
                section={editState.section}
                data={data[key]}
                onSave={(merged) => handleSave(key, merged)}
                onCancel={() =>
                  setEditState({ mode: "picking", artifactKey: key })
                }
              />
              </div>
            )}

            {/* Normal view when not editing this tab */}
            {!isEditingThisTab && (
              <ArtifactContent artifactKey={key} data={data} />
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
});

function ArtifactContent({
  artifactKey,
  data,
}: {
  artifactKey: ArtifactKey;
  data: CertOpsOutput;
}) {
  switch (artifactKey) {
    case "competency_framework":
      return <FrameworkView framework={data.competency_framework} />;
    case "learning_progression":
      return <LearningPathView progression={data.learning_progression} />;
    case "assessments":
      return <AssessmentsView assessments={data.assessments} />;
    case "rubrics":
      return <RubricsView rubrics={data.rubrics} />;
    case "item_bank":
      return <ItemBankView items={data.item_bank} />;
    case "blueprint":
      return <BlueprintView blueprint={data.blueprint} />;
  }
}
