import { ConfigService } from '../../config/config.service';

const MCP_NOT_CONNECTED_MESSAGE =
  'This account is not connected. Paste the full MCP URL to continue.';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLiveApiKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.includes('_live_');
}

export function getMcpUrl(config: ConfigService, sourceApiBase: string): string {
  return config.mcpUrl || `${sourceApiBase}/mcp`;
}

export function resolveMcpApiKey(
  config: ConfigService,
  tenantKey: string | null | undefined,
): string | null {
  const fallback = config.mcpApiKey || config.sourceApiKey || null;
  return tenantKey || fallback || null;
}

export function maskMcpKey(key: string | null | undefined): string | null {
  if (!isLiveApiKey(key)) return null;
  const afterPrefix = key!.split('_live_')[1] || '';
  const visible = afterPrefix.slice(0, 4);
  return visible ? `${visible}…` : null;
}

/**
 * Parse a pasted MCP connection string.
 * Expected: https://…/mcp?mcp_token=…&workspace_id=…
 */
export function parseMcpConnectionInput(input: string | null | undefined): {
  apiKey: string;
  workspaceId: string;
  mcpUrl: string;
} {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) {
    throw new Error('Paste the full MCP URL, including mcp_token and workspace_id.');
  }

  if (!trimmed.includes('://') && trimmed.includes('_live_')) {
    throw new Error(
      'Paste the full MCP URL (not just the key), including mcp_token and workspace_id.',
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Paste a valid MCP URL, including mcp_token and workspace_id.');
  }

  const apiKey =
    url.searchParams.get('mcp_token') ||
    url.searchParams.get('token') ||
    url.searchParams.get('api_key') ||
    '';
  const workspaceId =
    url.searchParams.get('workspace_id') ||
    url.searchParams.get('workspaceId') ||
    url.searchParams.get('account_id') ||
    '';

  if (!isLiveApiKey(apiKey)) {
    throw new Error('The MCP URL must include a valid mcp_token.');
  }
  if (!UUID_RE.test(workspaceId)) {
    throw new Error('The MCP URL must include a valid workspace_id.');
  }

  const pathname = url.pathname.replace(/\/+$/, '') || '/mcp';
  return {
    apiKey,
    workspaceId: workspaceId.toLowerCase(),
    mcpUrl: `${url.origin}${pathname}`,
  };
}

export function validateMcpApiKey(apiKey: string | null | undefined): void {
  if (!apiKey) {
    const err = new Error(MCP_NOT_CONNECTED_MESSAGE) as Error & { code: string };
    err.code = 'MCP_NOT_CONNECTED';
    throw err;
  }
  if (!isLiveApiKey(apiKey)) {
    throw new Error('This MCP URL does not include a valid API token.');
  }
}

function parseMcpToolResult(result: unknown): unknown {
  if (result == null) throw new Error('MCP returned empty result');
  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!content || !Array.isArray(content) || content.length === 0) {
    return result;
  }
  const textContent = content.find((item) => item.type === 'text');
  if (!textContent?.text) return result;
  try {
    return JSON.parse(textContent.text);
  } catch {
    return textContent.text;
  }
}

async function mcpRpc(
  mcpUrl: string,
  accountId: string,
  apiKey: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  validateMcpApiKey(apiKey);
  const requestId = Math.random().toString(36).substring(7);
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      'X-Workspace-Id': accountId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP HTTP ${response.status}: ${errorText.slice(0, 240)}`);
  }
  const jsonRpcResponse = (await response.json()) as {
    error?: { code: number; message: string };
    result?: unknown;
  };
  if (jsonRpcResponse.error) {
    const { code, message } = jsonRpcResponse.error;
    throw new Error(`MCP error ${code}: ${message}`);
  }
  return jsonRpcResponse.result;
}

export async function callMcpTool(
  mcpUrl: string,
  accountId: string,
  apiKey: string,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  console.log(`[MCP] Calling tool: ${toolName} for account ${accountId}`);
  try {
    const result = await mcpRpc(mcpUrl, accountId, apiKey, 'tools/call', {
      name: toolName,
      arguments: args,
    });
    return parseMcpToolResult(result);
  } catch (error) {
    console.error(
      `[MCP] Error calling ${toolName}:`,
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

/** MCP `api_get` — for MCP-allowlisted paths the public REST API blocks. */
export async function mcpApiGet(
  mcpUrl: string,
  accountId: string,
  apiKey: string,
  path: string,
): Promise<unknown> {
  const attempts = [{ path }, { url: path }, { route: path }, { pathAndQuery: path }];
  let lastError: unknown;
  for (const args of attempts) {
    try {
      return await callMcpTool(mcpUrl, accountId, apiKey, 'api_get', args);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('MCP api_get failed');
}

export { MCP_NOT_CONNECTED_MESSAGE };
