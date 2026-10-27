import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, fakeImage, fakeMe, fakeResource, uploadedImageId } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

describe('resource library (public)', () => {
  it('lists published resources for visitors, with a log-in prompt to save', async () => {
    renderRoute('/resources')
    expect(await screen.findByRole('link', { name: 'How to budget' })).toHaveAttribute(
      'href',
      '/resources/how-to-budget',
    )
    expect(screen.getByText('Telling interview stories')).toBeInTheDocument()
    const save = screen.getAllByRole('link', { name: /log in to save/i })[0]!
    expect(save).toHaveAttribute(
      'href',
      `/login?redirect=${encodeURIComponent('/app/resources/how-to-budget')}`,
    )
    expect(screen.queryByRole('button', { name: /saved only/i })).not.toBeInTheDocument()
  })

  it('searches and filters on the server', async () => {
    const user = userEvent.setup()
    renderRoute('/resources')
    await screen.findByText('How to budget')
    await user.type(screen.getByLabelText('Search resources'), 'budget')
    await user.selectOptions(screen.getByLabelText('Type'), 'article')
    await waitFor(() =>
      expect(fakeApi.listResources).toHaveBeenLastCalledWith({
        q: 'budget',
        kind: 'article',
        offset: 0,
      }),
    )
  })

  it('explains an empty library honestly', async () => {
    fakeApi.listResources.mockResolvedValue({ resources: [], nextOffset: null })
    renderRoute('/resources')
    expect(await screen.findByText('The library is being curated')).toBeInTheDocument()
  })
})

describe('resource detail', () => {
  it('loads the video only after the person presses play', async () => {
    const user = userEvent.setup()
    const { container } = renderRoute('/resources/interview-stories')
    await screen.findByRole('heading', { level: 1, name: 'Telling interview stories' })
    expect(container.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: /play video/i }))
    const frame = await screen.findByTitle('Video: Telling interview stories')
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
    )
  })

  it('opens articles at the source in a new tab, safely', async () => {
    renderRoute('/resources/how-to-budget')
    const link = await screen.findByRole('link', { name: /open on example money/i })
    expect(link).toHaveAttribute('href', 'https://example.org/budget')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('says when a resource no longer exists', async () => {
    const { ApiError } = await import('@/lib/api')
    fakeApi.getResource.mockRejectedValue(new ApiError(404, 'not_found', 'Resource not found.'))
    renderRoute('/resources/gone-now')
    expect(await screen.findByText('Resource not found')).toBeInTheDocument()
  })
})

describe('saving resources (signed in)', () => {
  it('saves immediately, and shows saved ones on their own', async () => {
    setSession(fakeSession())
    // Keep the request open to see the optimistic state.
    let finish: (value: unknown) => void = () => {}
    fakeApi.setResourceSaved.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    )
    const user = userEvent.setup()
    renderRoute('/app/resources')
    const save = await screen.findByRole('button', { name: 'Save How to budget' })
    await user.click(save)
    expect(await screen.findByRole('button', { name: 'Saved: How to budget' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(fakeApi.setResourceSaved).toHaveBeenCalledWith('resource-1', true)

    fakeApi.listSavedResources.mockResolvedValue([fakeResource()])
    act(() => finish({ saved: true }))
    await user.click(screen.getByRole('button', { name: /saved only/i }))
    const list = await screen.findByRole('list', { name: 'Saved resources' })
    await waitFor(() => expect(within(list).getAllByRole('article')).toHaveLength(1))
    expect(within(list).getByText('How to budget')).toBeInTheDocument()
  })

  it('undoes the save if the request fails', async () => {
    setSession(fakeSession())
    fakeApi.setResourceSaved.mockRejectedValueOnce(new Error('Network problem'))
    const user = userEvent.setup()
    renderRoute('/app/resources')
    await user.click(await screen.findByRole('button', { name: 'Save How to budget' }))
    expect(await screen.findByRole('button', { name: 'Save How to budget' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('managing resources (admin)', () => {
  const asAdmin = () => {
    setSession(fakeSession())
    fakeApi.getMe.mockResolvedValue(fakeMe({ roles: ['user', 'admin'] }))
  }

  it('is hidden from people who are not admins', async () => {
    setSession(fakeSession())
    renderRoute('/app/admin/resources')
    expect(await screen.findByRole('heading', { name: /don’t have access/i })).toBeInTheDocument()
    expect(fakeApi.adminListResources).not.toHaveBeenCalled()
  })

  it('opens on mentor applications, with a tab for resources', async () => {
    asAdmin()
    const { router } = renderRoute('/app/admin')
    await screen.findByRole('heading', { name: 'Mentor applications' })
    expect(router.state.location.pathname).toBe('/app/admin/mentors')
    const tabs = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(tabs).getByRole('link', { name: 'Resources' })).toHaveAttribute(
      'href',
      '/app/admin/resources',
    )
  })

  it('shows every status and filters by it', async () => {
    asAdmin()
    const user = userEvent.setup()
    renderRoute('/app/admin/resources')
    expect(await screen.findByText('Draft guide')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Show'), 'published')
    expect(screen.queryByText('Draft guide')).not.toBeInTheDocument()
    expect(screen.getByText('How to budget')).toBeInTheDocument()
  })

  it('checks the link before saving, then publishes', async () => {
    asAdmin()
    const user = userEvent.setup()
    renderRoute('/app/admin/resources')
    await user.click(await screen.findByRole('button', { name: /new resource/i }))
    const form = screen.getByRole('form', { name: 'New resource' })
    await user.type(within(form).getByLabelText('Title'), 'Saving for a goal')
    await user.type(
      within(form).getByLabelText('Summary'),
      'Simple steps to put money aside for something you want.',
    )
    await user.type(within(form).getByLabelText('Link'), 'http://example.org/saving')
    await user.type(within(form).getByLabelText(/^Source/), 'Example Money')
    await user.click(within(form).getByRole('button', { name: 'Publish' }))
    expect(await within(form).findByText('Use a full https:// link.')).toBeInTheDocument()
    expect(fakeApi.adminCreateResource).not.toHaveBeenCalled()

    await user.clear(within(form).getByLabelText('Link'))
    await user.type(within(form).getByLabelText('Link'), 'https://example.org/saving')
    await user.click(within(form).getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(fakeApi.adminCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.org/saving', status: 'published' }),
      ),
    )
  })

  it('notices YouTube videos as they are typed', async () => {
    asAdmin()
    const user = userEvent.setup()
    renderRoute('/app/admin/resources')
    await user.click(await screen.findByRole('button', { name: /new resource/i }))
    await user.selectOptions(screen.getByLabelText('Type'), 'video')
    await user.type(screen.getByLabelText('Link'), 'https://youtu.be/dQw4w9WgXcQ')
    expect(screen.getByText(/YouTube video detected/)).toBeInTheDocument()
  })

  it('sends only the fields that changed when editing', async () => {
    asAdmin()
    const user = userEvent.setup()
    renderRoute('/app/admin/resources')
    const card = (await screen.findByText('How to budget')).closest('article')!
    await user.click(within(card).getByRole('button', { name: /edit/i }))
    const form = screen.getByRole('form', { name: 'Edit How to budget' })
    await user.clear(within(form).getByLabelText('Title'))
    await user.type(within(form).getByLabelText('Title'), 'How to budget, step by step')
    await user.click(within(form).getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(fakeApi.adminUpdateResource).toHaveBeenCalledWith('resource-1', {
        title: 'How to budget, step by step',
      }),
    )
  })

  it('unpublishes, and asks before deleting', async () => {
    asAdmin()
    const user = userEvent.setup()
    renderRoute('/app/admin/resources')
    const card = (await screen.findByText('How to budget')).closest('article')!
    await user.click(within(card).getByRole('button', { name: /unpublish/i }))
    await waitFor(() =>
      expect(fakeApi.adminUpdateResource).toHaveBeenCalledWith('resource-1', { status: 'draft' }),
    )
    await user.click(within(card).getByRole('button', { name: /delete/i }))
    expect(fakeApi.adminDeleteResource).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete resource' }))
    await waitFor(() => expect(fakeApi.adminDeleteResource).toHaveBeenCalledWith('resource-1'))
  })
})

describe('cover images', () => {
  const asAdmin = () => {
    setSession(fakeSession())
    fakeApi.getMe.mockResolvedValue(fakeMe({ roles: ['user', 'admin'] }))
  }
  const png = () => new File(['png-bytes'], 'cover.png', { type: 'image/png' })

  async function openNewForm(user: ReturnType<typeof userEvent.setup>) {
    renderRoute('/app/admin/resources')
    await user.click(await screen.findByRole('button', { name: /new resource/i }))
    const form = screen.getByRole('form', { name: 'New resource' })
    await user.type(within(form).getByLabelText('Title'), 'Saving for a goal')
    await user.type(
      within(form).getByLabelText('Summary'),
      'Simple steps to put money aside for something you want.',
    )
    await user.type(within(form).getByLabelText('Link'), 'https://example.org/saving')
    await user.type(within(form).getByLabelText(/^Source/), 'Example Money')
    return form
  }

  it('upload, then must be described before publishing', async () => {
    asAdmin()
    const user = userEvent.setup()
    const form = await openNewForm(user)
    await user.upload(within(form).getByLabelText('Cover image file'), png())
    expect(fakeApi.uploadResourceImage).toHaveBeenCalledWith(expect.any(File))
    expect(await within(form).findByAltText('Cover image preview')).toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Publish' }))
    expect(await within(form).findByText(/describe the image for people/i)).toBeInTheDocument()
    expect(fakeApi.adminCreateResource).not.toHaveBeenCalled()

    await user.type(within(form).getByLabelText('Describe the image'), 'A jar of coins')
    await user.click(within(form).getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(fakeApi.adminCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          image: { publicId: uploadedImageId, alt: 'A jar of coins' },
          status: 'published',
        }),
      ),
    )
  })

  it('are checked in the browser before uploading', async () => {
    asAdmin()
    // applyAccept: false, so the file reaches our own check instead of being filtered out.
    const user = userEvent.setup({ applyAccept: false })
    const form = await openNewForm(user)
    const input = within(form).getByLabelText('Cover image file')

    await user.upload(input, new File(['gif'], 'cover.gif', { type: 'image/gif' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Use a JPG, PNG or WebP image.')

    const big = png()
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    await user.upload(input, big)
    expect(within(form).getByRole('alert')).toHaveTextContent('Images can be up to 5 MB.')
    expect(fakeApi.uploadResourceImage).not.toHaveBeenCalled()
  })

  it('can be removed when editing, sending only that change', async () => {
    asAdmin()
    fakeApi.adminListResources.mockResolvedValue([
      fakeResource({ image: fakeImage({ publicId: uploadedImageId, alt: 'A jar of coins' }) }),
    ])
    const user = userEvent.setup()
    renderRoute('/app/admin/resources')
    const card = (await screen.findByText('How to budget')).closest('article')!
    await user.click(within(card).getByRole('button', { name: /edit/i }))
    const form = screen.getByRole('form', { name: 'Edit How to budget' })
    expect(within(form).getByLabelText('Describe the image')).toHaveValue('A jar of coins')
    await user.click(within(form).getByRole('button', { name: 'Remove' }))
    await user.click(within(form).getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(fakeApi.adminUpdateResource).toHaveBeenCalledWith('resource-1', { image: null }),
    )
  })

  it('show on cards and article pages with their description', async () => {
    const image = fakeImage({ publicId: uploadedImageId, alt: 'A jar of coins' })
    fakeApi.listResources.mockResolvedValue({
      resources: [fakeResource({ image })],
      nextOffset: null,
    })
    fakeApi.getResource.mockResolvedValue(fakeResource({ image }))
    renderRoute('/resources')
    const cardImage = await screen.findByAltText('A jar of coins')
    expect(cardImage).toHaveAttribute('srcset', image.srcSet)
    expect(cardImage).toHaveAttribute('loading', 'lazy')

    await userEvent.setup().click(screen.getByRole('link', { name: 'How to budget' }))
    const hero = await screen.findByAltText('A jar of coins')
    expect(hero).toHaveAttribute('fetchpriority', 'high')
  })
})
