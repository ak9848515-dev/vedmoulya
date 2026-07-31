// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Identity Contracts
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import type {
  RegisterUserCommand,
  SignInCommand,
  GetUserQuery,
  UserCreatedEvent,
  IdentityMessage,
} from '../src/contracts/IdentityContracts.js';

describe('IdentityContracts', () => {
  describe('command types', () => {
    it('RegisterUserCommand has required fields', () => {
      const cmd: RegisterUserCommand = {
        type: 'RegisterUser',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
      };
      expect(cmd.type).toBe('RegisterUser');
      expect(cmd.email).toBe('test@example.com');
    });

    it('SignInCommand has required fields', () => {
      const cmd: SignInCommand = {
        type: 'SignIn',
        email: 'test@example.com',
        password: 'secret123',
      };
      expect(cmd.type).toBe('SignIn');
    });
  });

  describe('query types', () => {
    it('GetUserQuery has required fields', () => {
      const query: GetUserQuery = {
        type: 'GetUser',
        userId: 'user-1' as any,
      };
      expect(query.type).toBe('GetUser');
    });
  });

  describe('event types', () => {
    it('UserCreatedEvent has required fields', () => {
      const event: UserCreatedEvent = {
        type: 'identity.user.created',
        userId: 'user-1' as any,
        email: 'test@example.com',
        timestamp: new Date(),
        correlationId: 'corr-1',
      };
      expect(event.type).toBe('identity.user.created');
    });
  });

  describe('unions', () => {
    it('IdentityMessage accepts commands', () => {
      const msg: IdentityMessage = {
        type: 'RegisterUser',
        email: 'test@example.com',
        displayName: 'Test',
        passwordHash: 'hash',
      } as IdentityMessage;
      expect(msg).toBeDefined();
    });

    it('IdentityMessage accepts queries', () => {
      const msg: IdentityMessage = {
        type: 'GetUser',
        userId: 'user-1' as any,
      } as IdentityMessage;
      expect(msg).toBeDefined();
    });
  });
});
