/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f1f5fb',
          100: '#e2ebf7',
          200: '#c7d8ed',
          300: '#9db9dc',
          400: '#7298c8',
          500: '#4f78b2',
          600: '#355d98',
          700: '#244a82',
          800: '#193968',
          900: '#102b55',
          950: '#091d3d',
        },
        gold: {
          50: '#fdfaf4',
          100: '#f8f0df',
          200: '#f0dfbb',
          300: '#e3c58c',
          400: '#cba35c',
          500: '#b98b3d',
          600: '#9d712d',
          700: '#805823',
          800: '#68461e',
          900: '#513618',
        },
        cream: {
          50: '#fcfdfd',
          100: '#f5f8fb',
          200: '#eaf1f7',
          300: '#dce7f1',
          400: '#c9d9e8',
        },
        charcoal: {
          50: '#f7f9fb',
          100: '#edf1f5',
          200: '#dce3eb',
          300: '#c2ccd7',
          400: '#929eac',
          500: '#687585',
          600: '#4d5a6a',
          700: '#364352',
          800: '#263342',
          900: '#172330',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'scale-in': 'scale-in 0.25s ease-out forwards',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
