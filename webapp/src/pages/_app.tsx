/**
 * Root app wrapper.
 *
 * Provides:
 *  - WagmiProvider with the Celo / Celo Alfajores config
 *  - QueryClientProvider required by wagmi v2
 *
 * The custodial onboarding flow (email/social sign-up, no seed phrase)
 * is handled server-side. WagmiProvider is still mounted so that:
 *  1. Admin / developer users can connect an injected wallet for testing.
 *  2. useReadContract / useWriteContract hooks work for on-chain reads.
 */

import type { AppProps } from 'next/app';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmiConfig';
import React, { useState } from 'react';
import Link from 'next/link';

const globalStyles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f7fafc;
    color: #1a202c;
  }
  a { color: inherit; }
`;

function NavBar() {
  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <Link
        href="/"
        style={{
          fontWeight: 800,
          fontSize: 18,
          color: '#276749',
          textDecoration: 'none',
          marginRight: 'auto',
        }}
      >
        Socialstack
      </Link>
      <Link href="/" style={{ fontSize: 14, textDecoration: 'none', color: '#4a5568' }}>
        Missions
      </Link>
      <Link href="/profile" style={{ fontSize: 14, textDecoration: 'none', color: '#4a5568' }}>
        Profile
      </Link>
      <Link
        href="/connect"
        style={{
          fontSize: 13,
          fontWeight: 600,
          padding: '6px 14px',
          background: '#276749',
          color: '#fff',
          borderRadius: 7,
          textDecoration: 'none',
        }}
      >
        Wallet
      </Link>
    </nav>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  // QueryClient is stable per session — created once via useState
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <style>{globalStyles}</style>
        <NavBar />
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
