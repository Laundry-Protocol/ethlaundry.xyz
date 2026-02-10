import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Laundry Cash - Ethereum Privacy Protocol';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#030304',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(0, 255, 106, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 106, 0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            display: 'flex',
          }}
        />

        {/* Corner accents - top left */}
        <div
          style={{
            position: 'absolute',
            top: 32,
            left: 32,
            width: 60,
            height: 2,
            background: 'linear-gradient(to right, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 32,
            left: 32,
            width: 2,
            height: 60,
            background: 'linear-gradient(to bottom, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        {/* Corner accents - top right */}
        <div
          style={{
            position: 'absolute',
            top: 32,
            right: 32,
            width: 60,
            height: 2,
            background: 'linear-gradient(to left, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 32,
            right: 32,
            width: 2,
            height: 60,
            background: 'linear-gradient(to bottom, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        {/* Corner accents - bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 32,
            width: 60,
            height: 2,
            background: 'linear-gradient(to right, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 32,
            width: 2,
            height: 60,
            background: 'linear-gradient(to top, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        {/* Corner accents - bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 32,
            width: 60,
            height: 2,
            background: 'linear-gradient(to left, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 32,
            width: 2,
            height: 60,
            background: 'linear-gradient(to top, rgba(0,255,106,0.5), transparent)',
            display: 'flex',
          }}
        />

        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '25%',
            right: '25%',
            height: '50%',
            background: 'radial-gradient(ellipse at center top, rgba(0,255,106,0.08), transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            width: 80,
            height: 80,
            border: '2px solid rgba(0, 255, 106, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 22,
              height: 22,
              background: 'rgba(0, 255, 106, 0.2)',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              width: 22,
              height: 22,
              background: 'rgba(0, 255, 106, 0.2)',
              display: 'flex',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              background: '#00ff6a',
              display: 'flex',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: '#e8e8e8',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            display: 'flex',
          }}
        >
          LAUNDRY CASH
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: '#00ff6a',
            letterSpacing: '0.25em',
            textTransform: 'uppercase' as const,
            marginTop: 16,
            display: 'flex',
          }}
        >
          ETHEREUM PRIVACY PROTOCOL
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 16,
            color: 'rgba(122, 122, 122, 0.8)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            marginTop: 24,
            display: 'flex',
          }}
        >
          ZERO-KNOWLEDGE PROOFS &bull; NON-CUSTODIAL &bull; LIVE ON MAINNET
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(to right, transparent, #00ff6a, transparent)',
            opacity: 0.6,
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
