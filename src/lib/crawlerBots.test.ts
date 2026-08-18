import { describe, expect, it } from 'vitest'
import { getCrawlerBotDisplayName, normalizeCrawlerBot } from './crawlerBots'

describe('normalizeCrawlerBot', () => {
  it('canonicalizes spelling without merging distinct iGEO crawlers', () => {
    expect(normalizeCrawlerBot('Meta-ExternalAgent')).toBe('META_EXTERNALAGENT')
    expect(normalizeCrawlerBot('FacebookBot')).toBe('FACEBOOKBOT')
    expect(normalizeCrawlerBot('ChatGPT-User')).toBe('CHATGPT_USER')
    expect(normalizeCrawlerBot('OAI-SearchBot')).toBe('OAI_SEARCHBOT')
    expect(normalizeCrawlerBot('GPTBot')).toBe('GPTBOT')
  })
})

describe('getCrawlerBotDisplayName', () => {
  it('uses iGEO labels', () => {
    expect(getCrawlerBotDisplayName('OAI-SearchBot')).toBe('OAI-SearchBot')
    expect(getCrawlerBotDisplayName('FacebookBot')).toBe('FacebookBot')
    expect(getCrawlerBotDisplayName('PetalBot')).toBe('PetalBot')
  })
})
