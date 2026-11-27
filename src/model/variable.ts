import type { VariableConfig, VariableType, VariableValue } from '@cuttleskin/config';

/** Normalized, immutable view of a variable configuration. */
export interface VariableModel {
  readonly config: VariableConfig;
  readonly name: string;
  readonly type: VariableType;
  /** Ends of the domain (minimum and maximum, false and true); text has none. */
  readonly domainEnds: readonly VariableValue[];
}

function createDomainEnds(config: VariableConfig): VariableValue[] {
  switch (config.type) {
    case 'number':
      return [config.minimum, config.maximum];
    case 'boolean':
      return [false, true];
    case 'text':
      return [];
  }
}

export function createVariableModel(config: VariableConfig): VariableModel {
  return Object.freeze({
    config,
    name: config.name,
    type: config.type,
    domainEnds: Object.freeze(createDomainEnds(config)),
  });
}
