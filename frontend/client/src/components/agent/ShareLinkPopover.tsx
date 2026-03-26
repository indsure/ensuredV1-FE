import { useMemo, useState } from "react"
import { Check, Copy, Link2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"

type Props = {
  shareUrl: string | null
  shareEnabled: boolean
  disabled?: boolean
  onDisable: () => Promise<void>
}

export function ShareLinkPopover({ shareUrl, shareEnabled, disabled, onDisable }: Props) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const canShare = useMemo(() => !!shareUrl && shareEnabled, [shareUrl, shareEnabled])

  async function copy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Your browser blocked clipboard access." })
    }
  }

  async function disable() {
    setBusy(true)
    try {
      await onDisable()
    } catch {
      toast({ variant: "destructive", title: "Update failed", description: "Could not disable the share link." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled || !shareUrl}
          aria-label="Share link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Share link</div>
          <div className="text-xs text-muted-foreground">Copy the URL to send to your client.</div>
        </div>

        <div className="flex gap-2">
          <Input readOnly value={shareUrl ?? ""} />
          <Button variant="outline" onClick={copy} disabled={!shareUrl}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Disable</div>
            <div className="text-xs text-muted-foreground">Turn off this link immediately.</div>
          </div>
          <Switch checked={!canShare} onCheckedChange={() => void disable()} disabled={busy || disabled} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

