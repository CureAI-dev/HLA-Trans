import { notFound } from "@tanstack/react-router"
import { isAppError } from "./app-error"

/** Loader helper: a NOT_FOUND AppError becomes the router's notFound(). */
export async function ensureOrNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") throw notFound()
    throw error
  }
}
