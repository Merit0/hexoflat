import { IResource, IResourceTraits } from '@/abstraction/hexobject-abstraction';

export function makeResource(
  traits: IResourceTraits,
  options?: {
    amount?: number;
    maxAmount?: number;
  },
): IResource {
  const max = options?.maxAmount ?? 1;

  return {
    traits,
    isAvailable: true,
    amount: max,
    maxAmount: max,
    regrowMs: null,
    regrowAt: null,
  };
}
