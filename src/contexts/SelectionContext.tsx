import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SelectionContextType {
    selectedSeat: number | null;
    setSelectedSeat: (seat: number | null) => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export const SelectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

    return (
        <SelectionContext.Provider value={{ selectedSeat, setSelectedSeat }}>
            {children}
        </SelectionContext.Provider>
    );
};

export const useSelection = () => {
    const context = useContext(SelectionContext);
    if (context === undefined) {
        throw new Error('useSelection must be used within a SelectionProvider');
    }
    return context;
};
