import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRecentWorkPromptIds,
  normalizePromptText,
  scorePromptOpportunity,
  selectDailyContentPrompt,
  type SelectablePrompt,
} from './daily-content-prompt-selection.util';

describe('normalizePromptText', () => {
  it('collapses whitespace and lowercases', () => {
    assert.equal(normalizePromptText('  Hello   World  '), 'hello world');
  });
});

describe('buildRecentWorkPromptIds', () => {
  it('links by promptId and by normalized text', () => {
    const map = new Map([['best crm for startups', 'p1']]);
    const ids = buildRecentWorkPromptIds(
      [
        { promptId: 'p2' },
        { promptText: 'Best CRM for Startups' },
        { promptText: 'unrelated' },
      ],
      map,
    );
    assert.equal(ids.has('p2'), true);
    assert.equal(ids.has('p1'), true);
    assert.equal(ids.size, 2);
  });
});

describe('scorePromptOpportunity', () => {
  it('prefers low visibility and declining commercial prompts', () => {
    const low: SelectablePrompt = {
      id: 'a',
      prompt: 'a',
      avgVisibility: 10,
      visibilityChange: -15,
      type: 'COMMERCIAL',
      volume: 500,
      topicPriority: 5,
    };
    const high: SelectablePrompt = {
      id: 'b',
      prompt: 'b',
      avgVisibility: 90,
      visibilityChange: 10,
      type: 'INFORMATIONAL',
    };
    assert.ok(scorePromptOpportunity(low) > scorePromptOpportunity(high));
  });
});

describe('selectDailyContentPrompt', () => {
  it('returns null when nothing is eligible', () => {
    const result = selectDailyContentPrompt({
      prompts: [{ id: 'p1', prompt: 'hello', avgVisibility: 5 }],
      recentWorkPromptIds: new Set(['p1']),
      recentRunPromptIds: new Set(),
    });
    assert.equal(result, null);
  });

  it('skips recent runs and picks the highest opportunity', () => {
    const result = selectDailyContentPrompt({
      prompts: [
        { id: 'p1', prompt: 'used', avgVisibility: 5, type: 'COMMERCIAL' },
        { id: 'p2', prompt: 'ok', avgVisibility: 20, visibilityChange: -5 },
        { id: 'p3', prompt: 'better', avgVisibility: 8, visibilityChange: -20, type: 'COMMERCIAL' },
      ],
      recentWorkPromptIds: new Set(),
      recentRunPromptIds: new Set(['p1']),
    });
    assert.ok(result);
    assert.equal(result!.prompt.id, 'p3');
    assert.match(result!.rationale, /commercial/i);
  });
});
