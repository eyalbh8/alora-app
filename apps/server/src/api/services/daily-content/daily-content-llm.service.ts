import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';

@Injectable()
export class DailyContentLlmService {
  private readonly logger = new Logger(DailyContentLlmService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    return (
      this.config.getOptional<string>('OPENAI_API_KEY') ||
      this.config.getOptional<string>('ANTHROPIC_API_KEY') ||
      ''
    );
  }

  private get openaiKey(): string {
    return this.config.getOptional<string>('OPENAI_API_KEY') || '';
  }

  private get anthropicKey(): string {
    return this.config.getOptional<string>('ANTHROPIC_API_KEY') || '';
  }

  async completeJson(system: string, user: string): Promise<Record<string, unknown>> {
    const text = await this.complete(system, user);
    return this.parseJsonObject(text);
  }

  async complete(system: string, user: string): Promise<string> {
    if (this.openaiKey) {
      return this.completeOpenAi(system, user);
    }
    if (this.anthropicKey) {
      return this.completeAnthropic(system, user);
    }
    throw new Error('No OPENAI_API_KEY or ANTHROPIC_API_KEY configured for daily content optimizer');
  }

  private async completeOpenAi(system: string, user: string): Promise<string> {
    const model =
      this.config.getOptional<string>('DAILY_CONTENT_LLM_MODEL') || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 240)}`);
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty content');
    return content;
  }

  private async completeAnthropic(system: string, user: string): Promise<string> {
    const model =
      this.config.getOptional<string>('DAILY_CONTENT_LLM_MODEL') ||
      'claude-sonnet-4-20250514';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: `${user}\n\nRespond with JSON only.` }],
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Anthropic ${response.status}: ${detail.slice(0, 240)}`);
    }
    const json = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new Error('Anthropic returned empty content');
    return text;
  }

  parseJsonObject(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through to fence extraction
    }
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      const parsed = JSON.parse(fence[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
    const brace = trimmed.match(/\{[\s\S]*\}/);
    if (brace) {
      const parsed = JSON.parse(brace[0]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
    this.logger.warn(`Failed to parse LLM JSON: ${trimmed.slice(0, 200)}`);
    throw new Error('LLM did not return a JSON object');
  }

  hasLlmConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}
