import React, { useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Button } from '~/components/ui/Button';
import { ModelSettingsTab } from './tabs/ModelSettingsTab';
import { GeneralTab } from './tabs/GeneralTab';
import { classNames } from '~/utils/classNames';

type AdminTab = 'general' | 'models' | 'integrations' | 'advanced';

interface TabConfig {
  id: AdminTab;
  label: string;
  icon: string;
  component: React.ComponentType;
}

const ADMIN_TABS: TabConfig[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'i-ph:gear',
    component: GeneralTab,
  },
  {
    id: 'models',
    label: 'AI Models',
    icon: 'i-ph:robot',
    component: ModelSettingsTab,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: 'i-ph:plug',
    component: () => <div className="p-6 text-center text-gray-500">Integrations coming soon...</div>,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: 'i-ph:code',
    component: () => <div className="p-6 text-center text-gray-500">Advanced settings coming soon...</div>,
  },
];

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('models');

  const ActiveTabComponent = ADMIN_TABS.find(tab => tab.id === activeTab)?.component || GeneralTab;

  return (
    <div className="min-h-screen bg-bolt-elements-bg-depth-1">
      {/* Header */}
      <div className="border-b border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a 
                href="/" 
                className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                title="Back to Chat"
              >
                <div className="i-ph:arrow-left text-xl"></div>
              </a>
              <div>
                <h1 className="text-xl font-semibold text-bolt-elements-textPrimary">Admin Panel</h1>
                <p className="text-sm text-bolt-elements-textSecondary">Manage your Brainiac settings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Brainiac Dev" className="h-12" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-2">
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={classNames(
                    'w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-all duration-200',
                    activeTab === tab.id
                      ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentActive'
                      : 'text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary'
                  )}
                >
                  <div className={classNames(tab.icon, 'text-lg')}></div>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-bolt-elements-bg-depth-2 rounded-xl border border-bolt-elements-borderColor">
              <ClientOnly>
                {() => <ActiveTabComponent />}
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
