import React, { createContext, useContext, useState } from 'react';
import { BitcoinBlockType } from './utilities/models';

type BlocksContextType = {
  blocks: BitcoinBlockType[] | undefined;
  setBlocks: React.Dispatch<React.SetStateAction<BitcoinBlockType[] | undefined>>;
};

const BlocksContext = createContext<BlocksContextType | undefined>(undefined);

export const BlocksProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [blocks, setBlocks] = useState<BitcoinBlockType[]>();
  return (
    <BlocksContext.Provider value={{ blocks, setBlocks }}>
      {children}
    </BlocksContext.Provider>
  );
};

export const useBlocks = () => {
  const ctx = useContext(BlocksContext);
  if (!ctx) throw new Error('useBlocks must be used within a BlocksProvider');
  return ctx;
};