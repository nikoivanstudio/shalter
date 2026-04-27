import { cn } from "@/lib/utils"
import { useI18n } from "@/features/i18n/model/i18n-provider"
import {
  getAccountStatusLabel,
  getAccountStatusTone,
} from "@/features/profile/lib/account-status"

type AccountStatusBadgeProps = {
  role?: string | null
  email?: string | null
  className?: string
}

export function AccountStatusBadge({
  role,
  email,
  className,
}: AccountStatusBadgeProps) {
  const { tr } = useI18n()

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        getAccountStatusTone({ role, email }),
        className
      )}
    >
      {tr(getAccountStatusLabel({ role, email }))}
    </span>
  )
}
