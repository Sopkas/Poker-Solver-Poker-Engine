import React from 'react';

interface StudioLayoutProps {
    children: React.ReactNode; // Main content (Table)
    sidebar: React.ReactNode; // Sidebar content
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({ children, sidebar }) => {
    return (
        <div className="flex h-full w-full bg-gray-950 overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 relative flex flex-col min-w-0">
                {children}
            </div>

            {/* Sidebar */}
            <div className="w-[450px] xl:w-[40%] border-l border-gray-800 bg-gray-900 flex flex-col shadow-xl z-20 relative">
                {sidebar}
            </div>
        </div>
    );
};
