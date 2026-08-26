import { describe, expect, it } from 'vitest'
import { findAccountCompetitor, isAccountCompetitor } from './accountCompetitor'

const account = {
  id: '9fff60d7-58a1-4b28-96de-5b346e4d699b',
  title: 'SquareOne',
  names: ['Square One'],
  domains: ['www.squareone.com.cy'],
}

describe('isAccountCompetitor', () => {
  it('does not treat the first competitor as the account', () => {
    expect(
      isAccountCompetitor(
        { id: 'btb', name: 'BTB Estates', domain: 'btbestates.com' },
        account,
      ),
    ).toBe(false)
  })

  it('matches the account brand by name even when ids differ', () => {
    expect(
      isAccountCompetitor(
        {
          id: 'ad0aa075-89f0-4232-af40-8f7b0d5e74d6',
          name: 'SquareOne',
          isAccount: false,
        },
        account,
      ),
    ).toBe(true)
  })

  it('matches spaced aliases and domains', () => {
    expect(isAccountCompetitor({ id: 'x', name: 'Square One' }, account)).toBe(true)
    expect(isAccountCompetitor({ id: 'x', name: 'Other', domain: 'squareone.com.cy' }, account)).toBe(
      true,
    )
  })
})

describe('findAccountCompetitor', () => {
  it('finds the account row among competitors', () => {
    const rows = [
      { id: 'btb', name: 'BTB Estates', occurrences: 6 },
      { id: 'sq', name: 'SquareOne', occurrences: 678 },
    ]
    expect(findAccountCompetitor(rows, account)?.name).toBe('SquareOne')
  })
})
