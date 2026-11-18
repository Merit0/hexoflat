import { z } from 'zod';
import { hexobjectKeySchema } from '../content/content-schema';
import { refineTokenEntry } from '../tokens/token-entry';
import { itemTokenSchema } from '../tokens/token-schema';

export const LISTING_SLOTS = 8;
export const LISTING_MAX_PRICE = 999;

export const listingSchema = z
  .object({
    key: hexobjectKeySchema,
    amount: z.number().int().positive(),
    unitPrice: z.number().int().min(1).max(LISTING_MAX_PRICE),
    token: itemTokenSchema.optional(),
  })
  .strict()
  .superRefine(refineTokenEntry((listing) => listing.key));
export type Listing = z.infer<typeof listingSchema>;

export const listingsSchema = z.array(listingSchema.nullable()).length(LISTING_SLOTS);
export type Listings = z.infer<typeof listingsSchema>;

export function emptyListings(): Listings {
  return Array.from({ length: LISTING_SLOTS }, () => null);
}
