import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: '#030304',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Border */}
        <div
          style={{
            position: 'absolute',
            inset: 4,
            border: '2px solid rgba(0, 255, 106, 0.35)',
            display: 'flex',
          }}
        />
        {/* Top-left block */}
        <div
          style={{
            position: 'absolute',
            top: 32,
            left: 32,
            width: 44,
            height: 44,
            background: 'rgba(0, 255, 106, 0.2)',
            display: 'flex',
          }}
        />
        {/* Bottom-right block */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 32,
            width: 44,
            height: 44,
            background: 'rgba(0, 255, 106, 0.2)',
            display: 'flex',
          }}
        />
        {/* Horizontal line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 40,
            right: 40,
            height: 2,
            background: 'rgba(0, 255, 106, 0.5)',
            transform: 'translateY(-50%)',
            display: 'flex',
          }}
        />
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 40,
            bottom: 40,
            width: 2,
            background: 'rgba(0, 255, 106, 0.5)',
            transform: 'translateX(-50%)',
            display: 'flex',
          }}
        />
        {/* Center square */}
        <div
          style={{
            width: 20,
            height: 20,
            background: '#00ff6a',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
