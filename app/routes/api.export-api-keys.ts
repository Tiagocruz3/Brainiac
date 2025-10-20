import type { LoaderFunction } from '@remix-run/node';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

export const loader: LoaderFunction = async ({ context, request }) => {
  try {
    // Get API keys from cookie
    const cookieHeader = request.headers.get('Cookie');
    const apiKeysFromCookie = getApiKeysFromCookie(cookieHeader);

    // Get server environment (works for both Cloudflare and Vercel)
    const serverEnv = (context as any)?.cloudflare?.env || {};

    // Initialize the LLM manager to access environment variables
    const llmManager = LLMManager.getInstance(serverEnv);

    // Get all provider instances to find their API token keys
    const providers = llmManager.getAllProviders();

    // Create a comprehensive API keys object
    const apiKeys: Record<string, string> = { ...apiKeysFromCookie };

    // For each provider, check all possible sources for API keys
    for (const provider of providers) {
      if (!provider.config.apiTokenKey) {
        continue;
      }

      const envVarName = provider.config.apiTokenKey;

      // Skip if we already have this provider's key from cookies
      if (apiKeys[provider.name]) {
        continue;
      }

      // Check environment variables in order of precedence
      const envValue =
        serverEnv?.[envVarName] ||
        process.env[envVarName] ||
        llmManager.env[envVarName];

      if (envValue) {
        apiKeys[provider.name] = envValue;
      }
    }

    return Response.json(apiKeys);
  } catch (error) {
    console.error('Error exporting API keys:', error);
    return Response.json({});
  }
};
