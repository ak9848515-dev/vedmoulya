// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authorization: Ownership Guard
// Guard utilities for verifying resource ownership before operations
// ──────────────────────────────────────────────────────────────────

import { AuthorizationError } from '@vedmoulya/core';

export interface OwnedResource {
  id: string;
  ownerId: string;
}

export const OwnershipGuard = {
  /** Verify that a user owns a specific resource */
  verify(userId: string, resource: OwnedResource, resourceType: string): void {
    if (userId !== resource.ownerId) {
      throw new AuthorizationError(`You do not own this ${resourceType}`);
    }
  },

  /** Check if a user owns a resource (no throw) */
  check(userId: string, resourceOwnerId: string): boolean {
    return userId === resourceOwnerId;
  },

  /** Filter an array of resources to only include owned items */
  filterOwned<T extends OwnedResource>(userId: string, resources: T[]): T[] {
    return resources.filter((r) => r.ownerId === userId);
  },

  /** Assert that multiple resources are all owned by the user */
  verifyAll(userId: string, resources: OwnedResource[], resourceType: string): void {
    for (const resource of resources) {
      if (resource.ownerId !== userId) {
        throw new AuthorizationError(`You do not own ${resourceType}: ${resource.id}`);
      }
    }
  },
};
