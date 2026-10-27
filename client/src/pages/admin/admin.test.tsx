import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeApi, fakeMe } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

beforeEach(() => {
  // The fake session's user id is 'user-1', which matches Asha in the fake user list.
  setSession(fakeSession())
  fakeApi.getMe.mockResolvedValue(fakeMe({ id: 'user-1', roles: ['user', 'admin'] }))
})

describe('overview', () => {
  it('shows headline counts and sign-ups as a chart or a table', async () => {
    const user = userEvent.setup()
    renderRoute('/app/admin')
    expect(await screen.findByText('People')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('5 new this week')).toBeInTheDocument()
    const chart = screen.getByRole('region', { name: 'New sign-ups per week' })
    expect(within(chart).getAllByLabelText(/^Week of /)).toHaveLength(12)

    await user.hover(within(chart).getAllByLabelText(/^Week of /)[3]!)
    expect(within(chart).getByRole('tooltip')).toHaveTextContent('3 sign-ups')

    await user.click(within(chart).getByRole('button', { name: 'Show as table' }))
    expect(within(chart).getAllByRole('row')).toHaveLength(13) // header + 12 weeks
  })
})

describe('users', () => {
  it('searches and makes someone an admin after confirming', async () => {
    const user = userEvent.setup()
    renderRoute('/app/admin/users')
    await user.type(await screen.findByLabelText('Search users'), 'ravi')
    await waitFor(() => expect(fakeApi.adminListUsers).toHaveBeenLastCalledWith('ravi'))

    const row = screen.getByText('Ravi Kumar').closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Make admin' }))
    expect(fakeApi.adminSetAdmin).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Make admin' }))
    await waitFor(() => expect(fakeApi.adminSetAdmin).toHaveBeenCalledWith('user-2', true))
  })

  it("doesn't offer removing your own admin role", async () => {
    renderRoute('/app/admin/users')
    const me = (await screen.findByText(/\(you\)/)).closest('li')!
    expect(within(me).queryByRole('button', { name: 'Remove admin' })).not.toBeInTheDocument()
    expect(within(me).getByText(/another admin can remove your role/i)).toBeInTheDocument()
  })
})

describe('knowledge base', () => {
  it('uploads a Markdown file and explains it is a draft', async () => {
    const user = userEvent.setup()
    renderRoute('/app/admin/knowledge')
    expect(await screen.findByText('Switching careers')).toBeInTheDocument()
    const markdown = '---\nslug: exam-stress\n---\n\n## Section\n\nText'
    await user.upload(
      screen.getByLabelText('Knowledge document file'),
      new File([markdown], 'exam-stress.md', { type: 'text/markdown' }),
    )
    await waitFor(() => expect(fakeApi.adminUploadDocument).toHaveBeenCalledWith(markdown))
    expect(await screen.findByText(/is stored as a draft/)).toBeInTheDocument()
  })

  it('changes a document’s status', async () => {
    const user = userEvent.setup()
    renderRoute('/app/admin/knowledge')
    const doc = (await screen.findByText('Switching careers')).closest('article')!
    expect(within(doc).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    await user.click(within(doc).getByRole('button', { name: 'Archive' }))
    await waitFor(() =>
      expect(fakeApi.adminSetDocumentStatus).toHaveBeenCalledWith('doc-1', 'archived'),
    )
  })
})

describe('AI feedback', () => {
  it('starts with unhelpful answers and shows no personal details', async () => {
    renderRoute('/app/admin/feedback')
    expect(await screen.findByText('It ignored my city.')).toBeInTheDocument()
    expect(fakeApi.adminListFeedback).toHaveBeenCalledWith('not_helpful')
    expect(screen.getByText(/not who rated it or what they asked/)).toBeInTheDocument()
  })
})

describe('audit log', () => {
  it('reads like sentences, filters by area and loads older entries', async () => {
    const user = userEvent.setup()
    renderRoute('/app/admin/audit')
    const list = await screen.findByRole('list', { name: 'Audit entries' })
    expect(within(list).getByText('Made someone an admin')).toBeInTheDocument()
    expect(within(list).getByText('Deleted account')).toBeInTheDocument()
    expect(within(list).getByText(/old-guide/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Area'), 'role')
    await waitFor(() =>
      expect(fakeApi.adminAuditLog).toHaveBeenLastCalledWith({ area: 'role', offset: 0 }),
    )
    await user.click(await screen.findByRole('button', { name: 'Show older' }))
    await waitFor(() =>
      expect(fakeApi.adminAuditLog).toHaveBeenLastCalledWith({ area: 'role', offset: 50 }),
    )
  })
})
