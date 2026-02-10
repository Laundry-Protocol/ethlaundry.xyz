import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
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
            inset: 1,
            border: '1px solid rgba(0, 255, 106, 0.4)',
            display: 'flex',
          }}
        />
        {/* Center cross */}
        <div
          style={{
            width: 4,
            height: 4,
            background: '#00ff6a',
            display: 'flex',
          }}
        />
        {/* Top-left block */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 8,
            height: 8,
            background: 'rgba(0, 255, 106, 0.25)',
            display: 'flex',
          }}
        />
        {/* Bottom-right block */}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            width: 8,
            height: 8,
            background: 'rgba(0, 255, 106, 0.25)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
