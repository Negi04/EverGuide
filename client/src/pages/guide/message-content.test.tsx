import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MessageContent } from './message-content'

describe('MessageContent', () => {
  it('renders paragraphs, bold text and bullet lists', () => {
    const { container } = render(
      <MessageContent content={'Start **small**.\n\n- Track spending\n- Set a goal'} />,
    )
    expect(screen.getByText('small').tagName).toBe('STRONG')
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('turns valid citation markers into buttons that open the source', async () => {
    const onCite = vi.fn()
    render(
      <MessageContent content="Save first [1]. Also [3]." citationNumbers={[1]} onCite={onCite} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Source 1' }))
    expect(onCite).toHaveBeenCalledWith(1)
    // A marker without a matching source is not clickable.
    expect(screen.queryByRole('button', { name: 'Source 3' })).not.toBeInTheDocument()
  })

  it('shows markup from the model as text instead of running it', () => {
    const { container } = render(
      <MessageContent content={'<img src=x onerror="alert(1)"> and <script>alert(2)</script>'} />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">')
  })
})
