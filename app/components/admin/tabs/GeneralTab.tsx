import React from 'react';

export function GeneralTab() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-bolt-elements-textPrimary mb-2">General Settings</h2>
        <p className="text-bolt-elements-textSecondary">
          General application settings and preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Application Info */}
        <div className="bg-bolt-elements-bg-depth-3 rounded-xl p-6 border border-bolt-elements-borderColor">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Application Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Application Name
              </label>
              <div className="text-bolt-elements-textPrimary font-mono bg-bolt-elements-bg-depth-4 px-3 py-2 rounded-lg">
                Brainiac
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Version
              </label>
              <div className="text-bolt-elements-textPrimary font-mono bg-bolt-elements-bg-depth-4 px-3 py-2 rounded-lg">
                1.0.0
              </div>
            </div>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="bg-bolt-elements-bg-depth-3 rounded-xl p-6 border border-bolt-elements-borderColor">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Theme Settings</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-bolt-elements-textPrimary font-medium">Dark Theme</p>
              <p className="text-sm text-bolt-elements-textSecondary">Professional dark theme is permanently enabled</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:check-circle-fill text-green-500 w-5 h-5"></div>
              <span className="text-sm text-green-500 font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Storage Info */}
        <div className="bg-bolt-elements-bg-depth-3 rounded-xl p-6 border border-bolt-elements-borderColor">
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Storage Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-bolt-elements-textSecondary">API Keys</span>
              <span className="text-bolt-elements-textPrimary">Stored locally in browser</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-bolt-elements-textSecondary">Chat History</span>
              <span className="text-bolt-elements-textPrimary">Stored locally in IndexedDB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-bolt-elements-textSecondary">User Preferences</span>
              <span className="text-bolt-elements-textPrimary">Stored locally in browser</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
