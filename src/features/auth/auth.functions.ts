import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { errorMiddleware } from "@/features/shared/middleware"
import {
  currentUser,
  signInWithEmail,
  signOutCurrent,
  signUpWithEmail,
} from "@/server/auth.server"

const email = z.email("Enter a valid email address.").max(254)
const signInInput = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
})
const signUpInput = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200),
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "Use at most 128 characters."),
})
export type SignInInput = z.infer<typeof signInInput>
export type SignUpInput = z.infer<typeof signUpInput>

export const sessionFn = createServerFn({ method: "GET" })
  .middleware([errorMiddleware])
  .handler(() => currentUser())

export const signInFn = createServerFn({ method: "POST" })
  .middleware([errorMiddleware])
  .validator(signInInput)
  .handler(({ data }) => signInWithEmail(data.email, data.password))

export const signUpFn = createServerFn({ method: "POST" })
  .middleware([errorMiddleware])
  .validator(signUpInput)
  .handler(({ data }) => signUpWithEmail(data.name, data.email, data.password))

export const signOutFn = createServerFn({ method: "POST" })
  .middleware([errorMiddleware])
  .handler(() => signOutCurrent())
