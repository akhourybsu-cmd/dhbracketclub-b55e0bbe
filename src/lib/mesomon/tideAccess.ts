import type { MesomonSaveV1 } from './types';

const passageRequirements = ['gate_opened', 'rillik_bonded'] as const;
const chamberRequirements = [...passageRequirements, 'sluice_open', 'tutorial_complete', 'currents_followed'] as const;

export function missingTideRequirement(save: MesomonSaveV1, destination: 'passage' | 'chamber') {
  const required = destination === 'passage' ? passageRequirements : chamberRequirements;
  return required.find(key => save.questFlags[key] !== true);
}
