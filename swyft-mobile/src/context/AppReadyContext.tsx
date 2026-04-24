import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction } from "react";

interface AppReadyContextType {
  isAppReady: boolean;
  setAppReady: Dispatch<SetStateAction<boolean>>;
}

const AppReadyContext = createContext<AppReadyContextType>({
  isAppReady: false,
  setAppReady: () => {},
});

export const AppReadyProvider = ({ children }: { children: ReactNode }) => {
  const [isAppReady, setAppReady] = useState(false);
  return (
    <AppReadyContext.Provider value={{ isAppReady, setAppReady }}>
      {children}
    </AppReadyContext.Provider>
  );
};

export const useAppReady = () => useContext(AppReadyContext);