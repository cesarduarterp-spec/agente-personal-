/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Paleta cerrada: sin grises intermedios.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',
      yellow: '#FFE600',
      blue: '#0047FF',
      heat1: '#FFF9C2',
      heat2: '#FFF06B',
      heat3: '#FFE600',
    },
    borderRadius: {
      none: '0',
      DEFAULT: '2px',
      sm: '2px',
      md: '4px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      brutal: '4px 4px 0 0 #000000',
      'brutal-sm': '2px 2px 0 0 #000000',
    },
    fontFamily: {
      display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    extend: {
      borderWidth: { 3: '3px' },
    },
  },
  plugins: [],
};
