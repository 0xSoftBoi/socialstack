/**
 * Connect / Auth page — /connect
 *
 * Custodial onboarding stub.
 *
 * MVP intent
 * ----------
 * Real users sign up via email or social (OAuth), and the server-side
 * custodial wallet service creates a Celo wallet for them — no seed phrase
 * is shown, no gas is required. The wallet address is stored in the user's
 * session and used for on-chain reads and relayer-submitted transactions.
 *
 * This page shows:
 *  1. The custodial onboarding form (email sign-up, stubbed).
 *  2. If a custodial session exists, the wallet address + "export later" note.
 *  3. An optional injected-wallet connect (MetaMask / browser wallet) for
 *     developers and admin users who want direct on-chain access.
 *
 * The wagmi useConnect/useDisconnect/useAccount hooks handle the injected
 * wallet path. The custodial path is a POST to /api/auth/signup (stubbed here).
 */

import React, { useState } from 'react';
import Link from 'next/link';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { celoAlfajores } from 'wagmi/chains';

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

// ---- Custodial Sign-Up Form (stubbed) --------------------------------

interface CustodialFormState {
  email: string;
  status: 'idle' | 'submitting' | 'success' | 'error';
  errorMessage?: string;
  walletAddress?: string;
}

function CustodialOnboarding() {
  const [form, setForm] = useState<CustodialFormState>({
    email: '',
    status: 'idle',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) return;

    setForm((f) => ({ ...f, status: 'submitting' }));

    try {
      /**
       * Production: POST to /api/auth/signup
       * Body: { email }
       * Response: { walletAddress: string }  (custodial Celo wallet)
       *
       * The server-side service creates the wallet, stores user<>wallet in DB,
       * and returns a session cookie. The user never sees a seed phrase.
       */
      // Simulating network latency for the stub:
      await new Promise((r) => setTimeout(r, 1200));

      // Stub wallet address — replace with API response field
      const stubAddress = '0xC0FFee254729296a45a3885639AC7E10F9d549E7';

      setForm((f) => ({
        ...f,
        status: 'success',
        walletAddress: stubAddress,
      }));
    } catch {
      setForm((f) => ({
        ...f,
        status: 'error',
        errorMessage: 'Sign-up failed. Please try again.',
      }));
    }
  }

  if (form.status === 'success' && form.walletAddress) {
    return (
      <div
        style={{
          padding: '20px 24px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#276749', marginBottom: 8 }}>
          Welcome to Socialstack!
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 14, color: '#2d3748' }}>
          Your custodial Celo wallet has been created:
        </p>
        <code
          style={{
            display: 'block',
            fontFamily: 'monospace',
            fontSize: 13,
            background: '#fff',
            border: '1px solid #c6f6d5',
            borderRadius: 6,
            padding: '6px 12px',
            color: '#276749',
            marginBottom: 10,
          }}
        >
          {form.walletAddress}
        </code>
        <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>
          No seed phrase required. You can export your private key at any time from
          Settings → Export Wallet.
        </p>
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <Link
            href="/"
            style={{
              padding: '8px 18px',
              background: '#276749',
              color: '#fff',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Explore missions →
          </Link>
          <Link
            href="/profile"
            style={{
              padding: '8px 18px',
              background: '#fff',
              color: '#276749',
              border: '1px solid #276749',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Set my values →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 24,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>Get started</h2>
      <p style={{ margin: '0 0 20px', fontSize: 14, color: '#718096' }}>
        Create your free account. No crypto wallet or gas fees needed.
      </p>

      <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 6 }}>
        Email address
      </label>
      <input
        type="email"
        required
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        placeholder="you@example.com"
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1px solid #cbd5e0',
          borderRadius: 8,
          fontSize: 14,
          marginBottom: 14,
          outline: 'none',
          color: '#1a202c',
        }}
      />

      {form.status === 'error' && (
        <p style={{ fontSize: 13, color: '#c53030', margin: '0 0 10px' }}>
          {form.errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={form.status === 'submitting'}
        style={{
          width: '100%',
          padding: '11px 0',
          background: form.status === 'submitting' ? '#a0aec0' : '#276749',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 15,
          cursor: form.status === 'submitting' ? 'not-allowed' : 'pointer',
          marginBottom: 14,
        }}
      >
        {form.status === 'submitting' ? 'Creating your wallet…' : 'Create account'}
      </button>

      <p style={{ fontSize: 12, color: '#a0aec0', margin: 0, textAlign: 'center' }}>
        A custodial Celo wallet is automatically created for you. Gas fees are covered
        by the Socialstack relayer.
      </p>
    </form>
  );
}

// ---- Injected Wallet Connect (dev / admin) ----------------------------

function InjectedWalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isOnAlfajores = chainId === celoAlfajores.id;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '20px 24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>
        Developer / admin wallet
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#718096' }}>
        Connect an injected wallet (MetaMask, etc.) for direct on-chain access.
        Not required for end-users.
      </p>

      {isConnected && address ? (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#276749',
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#276749', fontWeight: 600 }}>
              {truncateAddress(address)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#718096' }}>
              {isOnAlfajores ? 'Celo Alfajores' : `Chain ${chainId}`}
            </span>
          </div>

          {!isOnAlfajores && (
            <button
              onClick={() => switchChain({ chainId: celoAlfajores.id })}
              style={{
                padding: '8px 14px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 7,
                color: '#92400e',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 10,
                display: 'block',
                width: '100%',
              }}
            >
              Switch to Celo Alfajores testnet
            </button>
          )}

          <button
            onClick={() => disconnect()}
            style={{
              padding: '8px 14px',
              background: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: 7,
              color: '#c53030',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isPending}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                background: '#edf2f7',
                border: '1px solid #cbd5e0',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#4a5568',
                cursor: isPending ? 'not-allowed' : 'pointer',
                marginBottom: 8,
                textAlign: 'left',
              }}
            >
              {isPending ? 'Connecting…' : `Connect ${connector.name}`}
            </button>
          ))}
          {error && (
            <p style={{ fontSize: 12, color: '#c53030', marginTop: 6 }}>
              {error.message}
            </p>
          )}
          <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 8 }}>
            No injected wallet? Install MetaMask or use the custodial sign-up above.
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Page ---------------------------------------------------------------

export default function ConnectPage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px 64px' }}>
      <Link href="/" style={{ color: '#276749', fontSize: 14, textDecoration: 'none' }}>
        ← Back to missions
      </Link>

      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '20px 0 4px' }}>
        Join Socialstack
      </h1>
      <p style={{ color: '#718096', marginTop: 0, marginBottom: 28 }}>
        Create an account, pick your causes, and start earning IMPACT for real-world action.
      </p>

      <CustodialOnboarding />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: '20px 0',
          color: '#cbd5e0',
        }}
      >
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        <span style={{ fontSize: 12 }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>

      <InjectedWalletConnect />
    </main>
  );
}
