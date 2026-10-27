// This package runs in both the browser and Node, so it only has standard JavaScript
// types: adding DOM or Node types would let code slip in that works in one and breaks in
// the other. The WHATWG URL API exists in both, so the part used here is declared.
// (Not imported anywhere: the client and server programs get URL from DOM/Node types.)
declare class URL {
  constructor(url: string, base?: string)
  readonly protocol: string
  readonly hostname: string
  readonly pathname: string
  readonly searchParams: { get(name: string): string | null }
}
