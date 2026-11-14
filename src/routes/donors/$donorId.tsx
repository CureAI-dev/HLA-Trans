import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/donors/$donorId")({ component: Outlet })
