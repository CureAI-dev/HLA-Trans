import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { signInFn, signOutFn, signUpFn } from "./auth.functions"
import type { SignInInput, SignUpInput } from "./auth.functions"

/** After any session change, drop every cached query (they belong to the previous user). */
function useResetSession() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async (to: string) => {
    queryClient.clear()
    await router.navigate({ to, replace: true })
    await router.invalidate()
  }
}

export function useSignIn(redirectTo: string) {
  const reset = useResetSession()
  return useMutation({
    mutationFn: (data: SignInInput) => signInFn({ data }),
    onSuccess: () => reset(redirectTo),
    meta: { silent: true },
  })
}

export function useSignUp(redirectTo: string) {
  const reset = useResetSession()
  return useMutation({
    mutationFn: (data: SignUpInput) => signUpFn({ data }),
    onSuccess: () => reset(redirectTo),
    meta: { silent: true },
  })
}

export function useSignOut() {
  const reset = useResetSession()
  return useMutation({
    mutationFn: () => signOutFn(),
    onSuccess: () => reset("/sign-in"),
    meta: { errorTitle: "Sign-out failed" },
  })
}
