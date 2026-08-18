import { describe, expect, it } from 'vitest'
import { isAccountRow } from './accountCompetitor.mjs'

const accountId = '9fff60d7-58a1-4b28-96de-5b346e4d699b'
const account = {
  id: accountId,
  title: 'SquareOne',
  names: ['Square One'],
  domains: ['www.squareone.com.cy'],
}

describe('isAccountRow', () => {
  it('matches the brand by name when competitor id is not the workspace id', () => {
    expect(
      isAccountRow(
        { id: 'ad0aa075-89f0-4232-af40-8f7b0d5e74d6', name: 'SquareOne', isAccount: false },
        accountId,
        account,
      ),
    ).toBe(true)
  })

  it('does not mark another market player as the account', () => {
    expect(
      isAccountRow({ id: 'btb', name: 'BTB Estates', occurrences: 6 }, accountId, account),
    ).toBe(false)
  })
})
