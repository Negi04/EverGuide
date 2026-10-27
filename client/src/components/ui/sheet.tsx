import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close
export const SheetTitle = Dialog.Title
export const SheetDescription = Dialog.Description

/** Slide-in panel from the right, used for mobile navigation. */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/60 data-[state=open]:animate-[fade-up_200ms_ease-out]" />
      <Dialog.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[min(22rem,100%)] flex-col bg-surface p-6 shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="size-5" aria-hidden />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
