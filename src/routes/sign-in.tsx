import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { useSignIn, useSignUp } from "@/features/auth/auth.mutations"
import { errorMessage, isAppError } from "@/lib/app-error"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/** Only same-app paths: never redirect to another origin (e.g. `//evil.example`). */
const safePath = z
  .string()
  .regex(/^\/(?!\/)/)
  .max(500)
  .optional()
  .catch(undefined)

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({ redirect: safePath }),
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ to: search.redirect ?? "/" })
  },
  head: () => ({ meta: [{ title: "Sign in · HLA-Trans" }] }),
  component: SignInPage,
})

type Mode = "sign-in" | "sign-up"

function SignInPage() {
  const search = Route.useSearch()
  const target = search.redirect ?? "/"
  const [mode, setMode] = useState<Mode>("sign-in")
  const signIn = useSignIn(target)
  const signUp = useSignUp(target)
  const active = mode === "sign-in" ? signIn : signUp
  const issues = isAppError(active.error) ? active.error.issues : {}
  const formError =
    active.error && Object.keys(issues).length === 0
      ? errorMessage(active.error, "Sign-in failed. Try again.")
      : null

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {mode === "sign-in" ? "Sign in to HLA-Trans" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {mode === "sign-in"
              ? "Use your clinician email and password."
              : "Your name is recorded on every change you make."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const value = (key: string) => String(form.get(key) ?? "")
              if (mode === "sign-in")
                signIn.mutate({
                  email: value("email"),
                  password: value("password"),
                })
              else
                signUp.mutate({
                  name: value("name"),
                  email: value("email"),
                  password: value("password"),
                })
            }}
          >
            <FieldGroup>
              {mode === "sign-up" && (
                <Field>
                  <FieldLabel htmlFor="name">Full name</FieldLabel>
                  <Input id="name" name="name" autoComplete="name" required />
                  <FieldError>{issues.name}</FieldError>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <FieldError>{issues.email}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "sign-in" ? "current-password" : "new-password"
                  }
                  required
                />
                <FieldError>{issues.password}</FieldError>
              </Field>
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <Button type="submit" disabled={active.isPending}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  signIn.reset()
                  signUp.reset()
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in")
                }}
              >
                {mode === "sign-in"
                  ? "New here? Create an account"
                  : "Have an account? Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
