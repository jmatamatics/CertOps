"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FrameworkView } from "@/components/framework-view";
import { LearningPathView } from "@/components/learning-path-view";
import { AssessmentsView } from "@/components/assessments-view";
import { RubricsView } from "@/components/rubrics-view";
import { ItemBankView } from "@/components/item-bank-view";
import type { CertOpsOutput } from "@/lib/types";

interface ArtifactTabsProps {
  data: CertOpsOutput;
}

export function ArtifactTabs({ data }: ArtifactTabsProps) {
  return (
    <Tabs defaultValue="framework" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="framework">Framework</TabsTrigger>
        <TabsTrigger value="learning">Learning Path</TabsTrigger>
        <TabsTrigger value="assessments">Assessments</TabsTrigger>
        <TabsTrigger value="rubrics">Rubrics</TabsTrigger>
        <TabsTrigger value="items">Item Bank</TabsTrigger>
      </TabsList>

      <TabsContent value="framework" className="mt-4">
        <FrameworkView framework={data.competency_framework} />
      </TabsContent>
      <TabsContent value="learning" className="mt-4">
        <LearningPathView progression={data.learning_progression} />
      </TabsContent>
      <TabsContent value="assessments" className="mt-4">
        <AssessmentsView assessments={data.assessments} />
      </TabsContent>
      <TabsContent value="rubrics" className="mt-4">
        <RubricsView rubrics={data.rubrics} />
      </TabsContent>
      <TabsContent value="items" className="mt-4">
        <ItemBankView items={data.item_bank} />
      </TabsContent>
    </Tabs>
  );
}
