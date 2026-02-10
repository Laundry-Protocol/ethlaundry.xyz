/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#00ff6a',
          secondary: '#00d45a',
          dim: 'rgba(0, 255, 106, 0.08)',
          glow: 'rgba(0, 255, 106, 0.25)',
        },
        surface: {
          primary: '#030304',
          secondary: '#08080a',
          tertiary: '#0d0d10',
          elevated: '#121215',
          card: '#0a0a0c',
        },
      },
      fontFamily: {
        display: ['Bank Gothic', 'Orbitron', 'Eurostile', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'none': '0',
      },
      letterSpacing: {
        'tech': '0.15em',
        'wide': '0.08em',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan': 'scan 3s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 4px #00ff6a, 0 0 8px rgba(0,255,106,0.25)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 8px #00ff6a, 0 0 16px rgba(0,255,106,0.25)' },
        },
        'scan': {
          '0%, 100%': { top: '0', opacity: '0' },
          '50%': { opacity: '0.5' },
          '100%': { top: '100%', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
