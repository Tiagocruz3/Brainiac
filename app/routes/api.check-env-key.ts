import type { LoaderFunction } from '@remix-run/node';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

export const loader: LoaderFunction = async ({ context, request }) => {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');

    if (!provider) {
      return Response.json({ isSet: false });
    }

    // Get server environment (works for both Cloudflare and Vercel)
    const serverEnv = (context as any)?.cloudflare?.env || {};
    const llmManager = LLMManager.getInstance(serverEnv);
    const providerInstance = llmManager.getProvider(provider);

    if (!providerInstance || !providerInstance.config.apiTokenKey) {
      return Response.json({ isSet: false });
    }

    const envVarName = providerInstance.config.apiTokenKey;

    // Get API keys from cookie
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);

    /*
     * Check API key in order of precedence:
     * 1. Client-side API keys (from cookies)
     * 2. Server environment variables (from Cloudflare env or Vercel process.env)
     * 3. Process environment variables (from .env.local)
     * 4. LLMManager environment variables
     */
    const isSet = !!(
      apiKeys?.[provider] ||
      serverEnv?.[envVarName] ||
      process.env[envVarName] ||
      llmManager.env[envVarName]
    );

    return Response.json({ isSet });
  } catch (error) {
    console.error('Error checking environment key:', error);
    return Response.json({ isSet: false });
  }
};
