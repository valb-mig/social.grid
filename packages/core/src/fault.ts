export type Code = 'invalid' | 'not_found' | 'conflict' | 'refused' | 'too_large' | 'busy'

export class Fault extends Error {
  code: Code

  constructor(code: Code, message: string) {
    super(message)
    this.code = code
  }
}

export function fail(code: Code, message: string): never {
  throw new Fault(code, message)
}
