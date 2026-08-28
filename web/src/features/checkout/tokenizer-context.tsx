import { createContext, useContext, type ReactNode } from 'react';
import { createStubTokenizer, type CardTokenizer } from './card-tokenizer';

/**
 * The tokenizer is handed to the card form directly rather than through Redux,
 * so the card never becomes part of an action or of application state. The
 * default is the stub, which is what runs with no provider key configured.
 */
const TokenizerContext = createContext<CardTokenizer>(createStubTokenizer());

export function TokenizerProvider({
  tokenizer,
  children,
}: {
  tokenizer: CardTokenizer;
  children: ReactNode;
}) {
  return <TokenizerContext.Provider value={tokenizer}>{children}</TokenizerContext.Provider>;
}

export const useTokenizer = () => useContext(TokenizerContext);
