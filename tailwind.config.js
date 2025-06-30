/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'pixel-green': '#22c55e',
        'pixel-blue': '#90D5FF',
        'pixel-yellow': '#EAB308',
        'pixel-brown': '#d2691e',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
}
