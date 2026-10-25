import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeApi, fakeReport, fakeResume, resumeId } from '@/test/fake-api'
import { fakeSession, setSession } from '@/test/fake-supabase'
import { renderRoute } from '@/test/render-route'

beforeEach(() => {
  setSession(fakeSession())
})

const pdfFile = (name = 'Asha Rao CV.pdf', size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'application/pdf' })

describe('resume uploads', () => {
  it('explains privacy and uploads a chosen PDF', async () => {
    const user = userEvent.setup()
    renderRoute('/app/career/resume')
    expect(await screen.findByText(/stored privately/i)).toBeInTheDocument()
    expect(screen.getByText(/sent to google’s gemini/i)).toBeInTheDocument()
    await user.upload(screen.getByLabelText('Choose a PDF resume'), pdfFile())
    await waitFor(() => expect(fakeApi.uploadResume).toHaveBeenCalledOnce())
    expect((fakeApi.uploadResume.mock.calls[0]![0] as File).name).toBe('Asha Rao CV.pdf')
  })

  it('rejects non-PDF and oversized files before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderRoute('/app/career/resume')
    const input = await screen.findByLabelText('Choose a PDF resume')
    await user.upload(input, new File(['hello'], 'notes.docx', { type: 'application/msword' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose a pdf/i)
    await user.upload(input, pdfFile('big.pdf', 5 * 1024 * 1024 + 1))
    expect(await screen.findByRole('alert')).toHaveTextContent(/up to 5 mb/i)
    expect(fakeApi.uploadResume).not.toHaveBeenCalled()
  })

  it('deletes a resume after confirmation', async () => {
    fakeApi.listResumes.mockResolvedValue([fakeResume()])
    const user = userEvent.setup()
    renderRoute('/app/career/resume')
    await user.click(await screen.findByRole('button', { name: /delete asha rao cv\.pdf/i }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /delete resume/i }),
    )
    await waitFor(() => expect(fakeApi.deleteResume).toHaveBeenCalledWith(resumeId))
  })
})

describe('resume analysis', () => {
  it('sends the role and job description and shows the labelled report', async () => {
    fakeApi.getResume.mockResolvedValueOnce({ ...fakeResume(), analyses: [] }).mockResolvedValue({
      ...fakeResume({ analysisCount: 1 }),
      analyses: [
        {
          id: 'a1',
          targetRole: 'Junior data analyst',
          jobDescription: 'SQL, Excel',
          report: fakeReport,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    const user = userEvent.setup()
    renderRoute(`/app/career/resume/${resumeId}`)
    await user.type(await screen.findByLabelText(/target role/i), 'Junior data analyst')
    await user.type(screen.getByLabelText(/job description/i), 'SQL, Excel and dashboards')
    await user.click(screen.getByRole('button', { name: /analyse resume/i }))

    expect(fakeApi.analyseResume).toHaveBeenCalledWith(resumeId, {
      targetRole: 'Junior data analyst',
      jobDescription: 'SQL, Excel and dashboards',
    })
    const report = await screen.findByRole('article', { name: /resume report/i })
    expect(within(report).getByText('AI-generated report')).toBeInTheDocument()
    expect(within(report).getByText('Partial match')).toBeInTheDocument()
    expect(within(report).getByText('Tableau')).toBeInTheDocument()
  })
})
