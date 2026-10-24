import { PanelLeft } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { usePageTitle } from '@/hooks/use-page-title'
import { ConversationSidebar } from './conversation-sidebar'

/** AI Guide workspace: conversation list beside the chat, full height of the window. */
export default function GuideLayout() {
  usePageTitle('AI Guide')
  const [listOpen, setListOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0">
      <aside
        aria-label="Conversation history"
        className="hidden w-72 shrink-0 border-r border-border bg-surface lg:block"
      >
        <ConversationSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-border bg-surface px-4 py-2 lg:hidden">
          <Sheet open={listOpen} onOpenChange={setListOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <PanelLeft aria-hidden /> Conversations
              </Button>
            </SheetTrigger>
            <SheetContent className="left-0 right-auto p-0 pt-12">
              <SheetTitle className="sr-only">Conversations</SheetTitle>
              <SheetDescription className="sr-only">Your AI Guide conversations</SheetDescription>
              <ConversationSidebar onNavigate={() => setListOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
