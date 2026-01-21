import React, { useState } from 'react';

interface Tab {
    id: string;
    label: string;
    content: React.ReactNode;
}

interface SidebarTabsProps {
    tabs: Tab[];
    defaultTabId?: string;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({ tabs, defaultTabId }) => {
    const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id);
    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Tab Header */}
            <div className="flex border-b border-gray-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={`
              flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors
              ${activeTabId === tab.id
                                ? 'text-white border-b-2 border-blue-500 bg-gray-800'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}
            `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab?.content}
            </div>
        </div>
    );
};
