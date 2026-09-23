import { Button } from "@/components/ui/button"
import { useLanguage } from "@/i18n/LanguageContext"

export function InlineErrorState({
  message,
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  const { t } = useLanguage()
  return (
    <div className="text-sm text-muted-foreground p-4">
      {message ?? t("common.load_failed")}{" "}
      <Button variant="link" className="h-auto p-0 underline ml-1" onClick={onRetry}>
        {t("common.try_again")}
      </Button>
    </div>
  )
}

