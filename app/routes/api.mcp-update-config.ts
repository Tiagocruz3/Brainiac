import { type ActionFunctionArgs } from '@remix-run/node';
import { createScopedLogger } from '~/utils/logger';
import { MCPService, type MCPConfig } from '~/lib/services/mcpService';

const logger = createScopedLogger('api.mcp-update-config');

export async function action({ request }: ActionFunctionArgs) {
  try {
    const raw = await request.text();
    let mcpConfig: MCPConfig = { mcpServers: {} };

    if (raw && raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          mcpConfig = parsed as MCPConfig;
        }
      } catch (parseErr) {
        logger.warn('Malformed MCP config payload, defaulting to empty config');
        mcpConfig = { mcpServers: {} };
      }
    }

    const mcpService = MCPService.getInstance();
    try {
      const serverTools = await mcpService.updateConfig(mcpConfig);
      return Response.json(serverTools);
    } catch (e) {
      // If config is invalid or servers fail to initialize, don't break the app
      logger.warn('Invalid MCP config or server init error; returning empty tools');
      return Response.json({});
    }
  } catch (error) {
    logger.error('Error updating MCP config:', error);
    return Response.json({ error: 'Failed to update MCP config' }, { status: 500 });
  }
}
