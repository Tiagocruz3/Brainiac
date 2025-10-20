import React, { useState, useEffect } from 'react';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { APIKeyManager, getApiKeysFromCookies } from '~/components/chat/APIKeyManager';
import { PROVIDER_LIST } from '~/utils/constants';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';
import Cookies from 'js-cookie';

export function ModelSettingsTab() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
  const [modelList, setModelList] = useState<ModelInfo[]>([]);
  const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
  const [model, setModel] = useState<string>('');
  const [provider, setProvider] = useState<ProviderInfo>(PROVIDER_LIST[0]);

  // Load saved model and provider from cookies (to sync with main chat)
  useEffect(() => {
    const savedModel = Cookies.get('selectedModel');
    const savedProvider = Cookies.get('selectedProvider');
    
    if (savedModel) {
      setModel(savedModel);
    }
    
    if (savedProvider) {
      const providerInfo = PROVIDER_LIST.find(p => p.name === savedProvider);
      if (providerInfo) {
        setProvider(providerInfo);
      }
    }
  }, []);

  // Fetch models from API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsModelLoading('all');
      fetch('/api/models')
        .then((response) => response.json())
        .then((data) => {
          const typedData = data as { modelList: ModelInfo[] };
          setModelList(typedData.modelList);
        })
        .catch((error) => {
          console.error('Error fetching model list:', error);
        })
        .finally(() => {
          setIsModelLoading(undefined);
        });
    }
  }, []);

  // Save model and provider when they change (to cookies for sync with main chat)
  useEffect(() => {
    if (model) {
      Cookies.set('selectedModel', model, { expires: 30 });
      // Notify main chat interface of model change
      window.dispatchEvent(new CustomEvent('modelChanged', { detail: { model } }));
    }
  }, [model]);

  useEffect(() => {
    if (provider) {
      Cookies.set('selectedProvider', provider.name, { expires: 30 });
      // Notify main chat interface of provider change
      window.dispatchEvent(new CustomEvent('providerChanged', { detail: { provider } }));
    }
  }, [provider]);

  const handleApiKeyChange = async (providerName: string, key: string) => {
    const newApiKeys = { ...apiKeys, [providerName]: key };
    setApiKeys(newApiKeys);
    Cookies.set('apiKeys', JSON.stringify(newApiKeys));

    // Fetch provider-specific models when API key is added
    setIsModelLoading(providerName);

    let providerModels: ModelInfo[] = [];

    try {
      const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
      const data = await response.json();
      providerModels = (data as { modelList: ModelInfo[] }).modelList;
    } catch (error) {
      console.error('Error loading dynamic models for:', providerName, error);
    }

    // Update models for the specific provider
    setModelList((prevModels) => {
      const otherModels = prevModels.filter((model) => model.provider !== providerName);
      return [...otherModels, ...providerModels];
    });
    setIsModelLoading(undefined);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">AI Model Configuration</h2>
        <p className="text-bolt-elements-textSecondary">
          Configure your AI providers, models, and API keys. These settings will be used across all chat sessions.
        </p>
      </div>

      <div className="space-y-8">
        {/* Model Selection Section */}
        <div className="bg-bolt-elements-bg-depth-3 rounded-xl p-6 border border-bolt-elements-borderColor">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Model Selection</h3>
          <ModelSelector
            key={provider?.name + ':' + modelList.length}
            model={model}
            setModel={setModel}
            modelList={modelList}
            provider={provider}
            setProvider={setProvider}
            providerList={PROVIDER_LIST as ProviderInfo[]}
            apiKeys={apiKeys}
            modelLoading={!!isModelLoading}
          />
        </div>

        {/* API Key Management Section */}
        {provider && !LOCAL_PROVIDERS.includes(provider.name) && (
          <div className="bg-bolt-elements-bg-depth-3 rounded-xl p-6 border border-bolt-elements-borderColor">
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">API Key Configuration</h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-4">
              Secure your API keys. They are stored locally in your browser and never sent to our servers.
            </p>
            <APIKeyManager
              provider={provider}
              apiKey={apiKeys[provider.name] || ''}
              setApiKey={(key) => handleApiKeyChange(provider.name, key)}
            />
          </div>
        )}

        {/* Provider Information */}
        <div className="bg-bolt-elements-bg-depth-3 rounded-xl p-6 border border-bolt-elements-borderColor">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Provider Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Current Provider
              </label>
              <div className="text-bolt-elements-textPrimary font-mono bg-bolt-elements-bg-depth-4 px-3 py-2 rounded-lg">
                {provider?.name || 'None selected'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Current Model
              </label>
              <div className="text-bolt-elements-textPrimary font-mono bg-bolt-elements-bg-depth-4 px-3 py-2 rounded-lg">
                {model || 'None selected'}
              </div>
            </div>
          </div>
          
          {provider?.getApiKeyLink && (
            <div className="mt-4 p-4 bg-bolt-elements-bg-depth-4 rounded-lg">
              <p className="text-sm text-bolt-elements-textSecondary mb-2">
                Need an API key for {provider.name}?
              </p>
              <a
                href={provider.getApiKeyLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-bolt-elements-item-contentAccent hover:underline"
              >
                Get API Key
                <div className="i-ph:arrow-square-out text-sm"></div>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
