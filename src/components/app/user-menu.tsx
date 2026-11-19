import { getRouteApi } from "@tanstack/react-router"
import { useSignOut } from "@/features/auth/auth.mutations"
import { Button } from "@/components/ui/button"

const rootRoute = getRouteApi("__root__")

export function UserMenu() {
  const { user } = rootRoute.useRouteContext()
  const signOut = useSignOut()
  if (!user) return null
  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden text-sm text-muted-foreground sm:inline"
        title={user.email}
      >
        {user.name}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        Sign out
      </Button>
    </div>
  )
}
