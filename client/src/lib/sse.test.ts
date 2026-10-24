import { describe, expect, it } from 'vitest'
import { readSse } from './sse'

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(chunks: string[]) {
  const messages = []
  for await (const message of readSse(streamOf(chunks))) messages.push(message)
  return messages
}

describe('readSse', () => {
  it('parses several events in one network chunk', async () => {
    expect(
      await collect(['event: delta\ndata: {"a":1}\n\nevent: done\ndata: {"b":2}\n\n']),
    ).toEqual([
      { event: 'delta', data: '{"a":1}' },
      { event: 'done', data: '{"b":2}' },
    ])
  })

  it('reassembles an event split across chunks', async () => {
    expect(await collect(['event: del', 'ta\ndata: {"te', 'xt":"hi"}\n', '\n'])).toEqual([
      { event: 'delta', data: '{"text":"hi"}' },
    ])
  })

  it('keeps multi-byte characters intact when split between chunks', async () => {
    const bytes = new TextEncoder().encode('data: ₹500\n\n')
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7)) // cuts the ₹ sign in half
        controller.enqueue(bytes.slice(7))
        controller.close()
      },
    })
    const messages = []
    for await (const message of readSse(stream)) messages.push(message)
    expect(messages).toEqual([{ event: 'message', data: '₹500' }])
  })

  it('handles CRLF line endings, comments and a final event without a blank line', async () => {
    expect(
      await collect([': keep-alive\r\n\r\nevent: done\r\ndata: x\r\n\r\nevent: tail\ndata: y']),
    ).toEqual([
      { event: 'done', data: 'x' },
      { event: 'tail', data: 'y' },
    ])
  })
})
