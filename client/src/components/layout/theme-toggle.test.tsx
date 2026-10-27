import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'

afterEach(() => {
  delete document.documentElement.dataset.theme
  localStorage.clear()
})

describe('ThemeToggle', () => {
  it('starts dark, switches to light and back, and remembers the choice', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('everguide-theme')).toBe('light')
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('everguide-theme')).toBe('dark')
  })

  it('keeps every toggle on the page in sync', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    )
    await user.click(screen.getAllByRole('button', { name: 'Switch to light theme' })[0]!)
    expect(screen.getAllByRole('button', { name: 'Switch to dark theme' })).toHaveLength(2)
  })
})
