import { describe, expect, it } from 'vitest';
import { LoginSchema } from './auth';

describe('LoginSchema', () => {
  it('acepta email y password válidos', () => {
    const r = LoginSchema.safeParse({
      email: 'admin@demo.com',
      password: 'secret123',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    const r = LoginSchema.safeParse({
      email: 'no-es-email',
      password: 'secret123',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('email');
    }
  });

  it('rechaza password corto (< 6)', () => {
    const r = LoginSchema.safeParse({
      email: 'a@b.cl',
      password: '123',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path[0]).toBe('password');
      expect(r.error.issues[0]?.message).toContain('6');
    }
  });

  it('rechaza campos faltantes', () => {
    const r = LoginSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('acepta password de exactamente 6 caracteres', () => {
    const r = LoginSchema.safeParse({
      email: 'a@b.cl',
      password: '123456',
    });
    expect(r.success).toBe(true);
  });
});