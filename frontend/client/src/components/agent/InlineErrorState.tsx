import { Button } from "@/components/ui/button"

export function InlineErrorState({
  message = "Failed to load —",
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  return (
    <div className="text-sm text-muted-foreground p-4">
      {message}{" "}
      <Button variant="link" className="h-auto p-0 underline ml-1" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

