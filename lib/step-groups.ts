// Client-safe step-grouping helpers. Deliberately has no server-only imports
// (unlike tutorial-store.ts, which pulls in firebase-admin) so they can be
// imported as values from client components.
import type { Step } from "./tutorial-store";

export type StepGroup = {
  main: Step;
  subSteps: Step[];
};

// Groups a flat, order-sorted step list into main-step blocks. Steps missing
// stepType/parentStepId (pre-migration content), or whose parent is gone, are
// treated as main steps.
export function groupSteps(steps: Step[]): StepGroup[] {
  const groups: StepGroup[] = [];
  const groupByParentId = new Map<string, StepGroup>();

  for (const step of steps) {
    if (step.stepType === "sub" && step.parentStepId && groupByParentId.has(step.parentStepId)) {
      groupByParentId.get(step.parentStepId)!.subSteps.push(step);
    } else {
      const group: StepGroup = { main: step, subSteps: [] };
      groups.push(group);
      groupByParentId.set(step.id, group);
    }
  }

  return groups;
}

// Display numbers: main steps are "1", "2", ...; their sub-steps are "1.1", "1.2", ...
export function stepLabels(steps: Step[]): Map<string, string> {
  const labels = new Map<string, string>();
  groupSteps(steps).forEach((group, i) => {
    labels.set(group.main.id, `${i + 1}`);
    group.subSteps.forEach((sub, j) => labels.set(sub.id, `${i + 1}.${j + 1}`));
  });
  return labels;
}
