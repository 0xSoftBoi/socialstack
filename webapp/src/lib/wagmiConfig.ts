/**
 * wagmi v2 configuration for Socialstack.
 *
 * Targets Celo Alfajores testnet for MVP. Switch `chains` to `[celo]`
 * when deploying to mainnet.
 *
 * The injected connector is included as a fallback for developers / admin
 * users with MetaMask. End-users go through the custodial (no-wallet)
 * onboarding flow — no external wallet required for MVP.
 */

import { createConfig, http } from 'wagmi';
import { celo, celoAlfajores } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [celoAlfajores, celo],
  connectors: [injected()],
  transports: {
    [celoAlfajores.id]: http(),
    [celo.id]: http(),
  },
});

/** Chain used by the MVP relayer and read calls. */
export const MVP_CHAIN = celoAlfajores;
