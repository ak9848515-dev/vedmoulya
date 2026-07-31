// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Controller
// HTTP controller handling all identity API operations
// ──────────────────────────────────────────────────────────────────

import type { Context } from 'hono';
import { BaseController } from '@vedmoulya/core';
import type { IdentityApplicationService } from '@vedmoulya/services';
import { mapErrorToResponse } from '../middleware/ErrorMapper.js';
import {
  paginationQuery,
  registerUserSchema,
  updateProfileSchema,
  updatePreferencesSchema,
  updateSettingsSchema,
  deactivateUserSchema,
} from '../validation/IdentitySchemas.js';

export class IdentityController extends BaseController {
  private readonly identityService: IdentityApplicationService;

  constructor(identityService: IdentityApplicationService) {
    super('identity');
    this.identityService = identityService;
  }

  // ── POST /users ─────────────────────────────────────────────────────────

  async registerUser(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = registerUserSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const { email, displayName, givenName, familyName, password } = parsed.data;
      // In production, password hashing happens in the application service
      const passwordHash = password; // placeholder — real hashing in auth layer

      const result = await this.identityService.registerUser({
        email,
        displayName,
        givenName,
        familyName,
        passwordHash,
      });

      return c.json({ success: true, data: result }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── GET /users/:id ──────────────────────────────────────────────────────

  async getUserById(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const user = await this.identityService.getUserById(id);
      return c.json({ success: true, data: user });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── GET /users/email/:email ──────────────────────────────────────────────

  async getUserByEmail(c: Context): Promise<Response> {
    try {
      const email = c.req.param('email') as string;
      const user = await this.identityService.getUserByEmail(email);
      return c.json({ success: true, data: user });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── PATCH /users/:id/profile ─────────────────────────────────────────────

  async updateProfile(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updateProfileSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR' as const,
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.identityService.updateProfile(id, parsed.data);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── PATCH /users/:id/preferences ─────────────────────────────────────────

  async updatePreferences(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updatePreferencesSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR' as const,
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.identityService.updatePreferences(id, parsed.data);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── PATCH /users/:id/settings ────────────────────────────────────────────

  async updateSettings(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updateSettingsSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR' as const,
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.identityService.updateSettings(id, parsed.data);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── POST /users/:id/activate ─────────────────────────────────────────────

  async activateUser(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.identityService.activateUser(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── POST /users/:id/deactivate ───────────────────────────────────────────

  async deactivateUser(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      const parsed = deactivateUserSchema.safeParse(body);
      const reason = parsed.success ? parsed.data.reason : undefined;
      const result = await this.identityService.deactivateUser(id, reason);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── DELETE /users/:id ────────────────────────────────────────────────────

  async deleteUser(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      await this.identityService.archiveUser(id);
      return c.json({ success: true, data: { id, message: 'User archived' } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── GET /users ───────────────────────────────────────────────────────────

  async listUsers(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const parsed = paginationQuery.safeParse(query);
      const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
      const result = await this.identityService.listUsers({ page, limit });
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── GET /users/:id/auth-check ────────────────────────────────────────────

  async checkAuthentication(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.identityService.checkAuthentication(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── POST /users/validate ─────────────────────────────────────────────────

  async validateRegistration(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = registerUserSchema.safeParse(body);

      if (parsed.success) {
        return c.json({ success: true, data: { valid: true, errors: [] } });
      }

      const errors = parsed.error.issues.map((issue: { message: string }) => issue.message);
      return c.json({ success: true, data: { valid: false, errors } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }
}
