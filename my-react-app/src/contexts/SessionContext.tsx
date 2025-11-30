// src/contexts/SessionContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";

interface SessionContextType {
  endSessionHandler: (() => void) | null;
  setEndSessionHandler: (handler: (() => void) | null) => void;
  dashboardHandler: (() => void) | null;
  setDashboardHandler: (handler: (() => void) | null) => void;
}

const SessionContext = createContext<SessionContextType>({
  endSessionHandler: null,
  setEndSessionHandler: () => {},
  dashboardHandler: null,
  setDashboardHandler: () => {},
});

export const useSessionContext = () => useContext(SessionContext);

export function SessionContextProvider({ children }: { children: ReactNode }) {
  const [endSessionHandler, setEndSessionHandler] = useState<(() => void) | null>(null);
  const [dashboardHandler, setDashboardHandler] = useState<(() => void) | null>(null);

  return (
    <SessionContext.Provider value={{ 
      endSessionHandler, 
      setEndSessionHandler,
      dashboardHandler,
      setDashboardHandler,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

