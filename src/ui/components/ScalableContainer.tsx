import React, { useRef, useState, useEffect } from 'react';

interface ScalableContainerProps {
    children: React.ReactNode;
    targetWidth?: number;
    targetHeight?: number;
}

export const ScalableContainer: React.FC<ScalableContainerProps> = ({
    children,
    targetWidth = 900,
    targetHeight = 500
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                // Add some padding
                const availableWidth = width - 40;
                const availableHeight = height - 40;

                const scaleX = availableWidth / targetWidth;
                const scaleY = availableHeight / targetHeight;

                // Scale down if needed, allow slight scale up
                const newScale = Math.min(scaleX, scaleY, 1.1);
                setScale(newScale);
            }
        };

        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [targetWidth, targetHeight]);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
            <div
                style={{
                    width: targetWidth,
                    height: targetHeight,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    flexShrink: 0
                }}
            >
                {children}
            </div>
        </div>
    );
};
