import { goalCategories, goalCreateSchema, type Goal, type GoalCreate } from '@everguide/shared'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { FormAlert } from '@/components/common/form-alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { goalCategoryLabels } from '@/config/career'

// Form inputs produce empty strings: a blank date field or starter-milestone row means
// "none" and is cleaned up on submit. The server still validates strictly.
const formSchema = goalCreateSchema.extend({
  targetDate: z
    .union([z.literal(''), z.iso.date({ error: 'Use a valid date.' })])
    .nullable()
    .optional(),
  milestones: z
    .array(z.object({ title: z.string().trim().max(160, 'Keep the title under 160 characters.') }))
    .default([]),
})

type Props = {
  trigger: ReactNode
  /** Editing an existing goal hides the starter-milestones section. */
  goal?: Goal
  onSubmit: (values: GoalCreate) => Promise<unknown>
}

export function GoalFormDialog({ trigger, goal, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<GoalCreate>({
    resolver: zodResolver(formSchema),
    defaultValues: goal
      ? {
          title: goal.title,
          description: goal.description ?? '',
          category: goal.category,
          targetDate: goal.targetDate ?? undefined,
          milestones: [],
        }
      : { title: '', description: '', category: 'career', milestones: [{ title: '' }] },
  })
  const milestones = useFieldArray({ control: form.control, name: 'milestones' })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      // Empty starter rows are simply skipped.
      await onSubmit({
        ...values,
        targetDate: values.targetDate || null,
        milestones: (values.milestones ?? []).filter((m) => m.title.trim()),
      })
      setOpen(false)
      form.reset()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Something went wrong.')
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setServerError(null)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogTitle>{goal ? 'Edit goal' : 'New goal'}</DialogTitle>
        <DialogDescription>
          {goal
            ? 'Update the details of this goal.'
            : 'A clear goal with a few concrete milestones is easier to act on.'}
        </DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          {serverError && <FormAlert tone="error">{serverError}</FormAlert>}
          <FormField label="Goal" error={errors.title?.message}>
            <Input placeholder="e.g. Get my first data analyst job" {...form.register('title')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category">
              <NativeSelect {...form.register('category')}>
                {goalCategories.map((c) => (
                  <option key={c} value={c}>
                    {goalCategoryLabels[c]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Target date (optional)" error={errors.targetDate?.message}>
              <Input type="date" {...form.register('targetDate')} />
            </FormField>
          </div>
          <FormField label="Why it matters (optional)" error={errors.description?.message}>
            <Textarea rows={3} className="min-h-20" {...form.register('description')} />
          </FormField>

          {!goal && (
            <fieldset>
              <legend className="text-sm font-medium text-foreground">
                First milestones (optional)
              </legend>
              <div className="mt-2 space-y-2">
                {milestones.fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <Input
                        aria-label={`Milestone ${index + 1}`}
                        placeholder={
                          index === 0 ? 'e.g. Finish an SQL course' : 'Another milestone'
                        }
                        {...form.register(`milestones.${index}.title`)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove milestone ${index + 1}`}
                      onClick={() => milestones.remove(index)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
              {milestones.fields.length < 10 && (
                <Button
                  type="button"
                  variant="link"
                  className="mt-1"
                  onClick={() => milestones.append({ title: '' })}
                >
                  <Plus aria-hidden /> Add a milestone
                </Button>
              )}
            </fieldset>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : goal ? 'Save changes' : 'Create goal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
