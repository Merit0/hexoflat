import type { TMapTier } from '../../token-keys';
import {
  attributeProfilesSchema,
  type AttributeProfile,
  type AttributeProfiles,
} from '../attribute-profile-schema';
import type { IAttributeProfileProvider } from './generator-contracts';

export class ContentAttributeProfileProvider implements IAttributeProfileProvider {
  private readonly profiles: Readonly<AttributeProfiles>;

  constructor(profiles: AttributeProfiles) {
    this.profiles = Object.freeze(attributeProfilesSchema.parse(profiles));
  }

  profileFor(level: TMapTier): AttributeProfile {
    const profile = this.profiles[`tier-${level}`];
    if (!profile) throw new Error(`NO_ATTRIBUTE_PROFILE: tier-${level}`);
    return profile;
  }
}
