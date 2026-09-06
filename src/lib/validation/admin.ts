import { z } from 'zod';

export const CreateUserSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  roleId: z.string().uuid('Choose a role').optional().or(z.literal('')),
});

export const UpdateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  isActive: z.boolean().default(true),
  roleIds: z.array(z.string().uuid()).default([]),
});

export const RoleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, 'Key is required')
    .max(40)
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, digits, and underscores only'),
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(300).optional().default(''),
  permissionIds: z.array(z.string().uuid()).default([]),
});
