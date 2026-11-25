import { useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { useSignIn, useSignUp } from "@/features/auth/auth.mutations"
import { errorMessage, isAppError } from "@/lib/app-error"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConcordMark } from "@/components/app/concord-logo"

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
  head: () => ({ meta: [{ title: "Sign in · Concord" }] }),
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
    <ScrollArea className="h-dvh">
      <main className="grid min-h-dvh bg-background md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <BrandPanel />
        <section className="flex items-center px-4 py-10 sm:px-10 md:justify-center md:px-16">
          <div className="w-full max-w-[22rem]">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {mode === "sign-in" ? "Sign in" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-pretty text-muted-foreground">
              {mode === "sign-in"
                ? "Use the email and password you registered with."
                : "Your name is recorded on every change and decision you make."}
            </p>
            <form
              noValidate
              className="mt-8"
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
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      required
                      className="h-10"
                    />
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
                    className="h-10"
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
                    className="h-10"
                  />
                  <FieldError>{issues.password}</FieldError>
                </Field>
                {formError && (
                  <p
                    role="alert"
                    className="border-l-2 border-destructive pl-3 text-sm text-destructive"
                  >
                    {formError}
                  </p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="h-10"
                  disabled={active.isPending}
                >
                  {active.isPending
                    ? mode === "sign-in"
                      ? "Signing in…"
                      : "Creating account…"
                    : mode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                </Button>
              </FieldGroup>
            </form>
            <p className="mt-8 border-t pt-6 text-sm text-muted-foreground">
              {mode === "sign-in" ? "New to Concord? " : "Already registered? "}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm font-medium"
                onClick={() => {
                  signIn.reset()
                  signUp.reset()
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in")
                }}
              >
                {mode === "sign-in" ? "Create an account" : "Sign in instead"}
              </Button>
            </p>
          </div>
        </section>
      </main>
    </ScrollArea>
  )
}

const HALF =
  "M51 36 C47 30 41 27 34.5 27 C24.5 27 19 35.5 19 46 C19 63 33 80 51 100"

/** Deep teal in both themes: the brand field, not a themed surface. */
function BrandPanel() {
  return (
    <aside className="relative flex flex-col justify-between gap-8 overflow-hidden bg-[#0a4f5c] px-4 py-6 text-[#e8f3f4] sm:px-10 md:py-10">
      <div className="flex items-center gap-2.5 text-base font-semibold">
        <ConcordMark className="size-6 md:hidden" />
        Concord
      </div>
      <svg
        viewBox="12 20 104 88"
        aria-hidden="true"
        className="hidden w-[min(78%,26rem)] self-center text-[#9fd3da] md:block"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        >
          <g className="concord-half-left">
            <path d={HALF} />
          </g>
          <g className="concord-half-right">
            <path d={HALF} transform="translate(128 0) scale(-1 1)" />
          </g>
        </g>
      </svg>
      <div className="max-w-[26rem] space-y-4">
        <p className="text-lg leading-snug font-light text-pretty md:text-2xl">
          Check donor hearts against waiting patients, and record who decided
          what, and why.
        </p>
        <p className="text-xs leading-relaxed text-[#9fc4c9]">
          Demo environment. Every patient and donor here is made up. Do not
          enter real patient information.
        </p>
      </div>
    </aside>
  )
}
