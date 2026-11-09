/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',
      yellow: '#FFE600',
      blue: '#0047FF',
      red: '#D10000',
    },
    borderRadius: { none: '0', sm: '2px', DEFAULT: '4px' },
    boxShadow: { none: 'none', brutal: '4px 4px 0 0 #000000' },
    fontFamily: {
      display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    extend: { borderWidth: { DEFAULT: '2px', 3: '3px' } },
  },
  plugins: [],
};
