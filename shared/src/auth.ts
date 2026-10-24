import { z } from 'zod'

const email = z.email('Please enter a valid email address.').max(254)

/** Password rules used at registration and when choosing a new password. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Please enter your password.'),
})

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Please enter your name.').max(80),
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: 'Please accept the Terms and Privacy Policy.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email })

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>
