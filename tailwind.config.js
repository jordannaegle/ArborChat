/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#36393f', // Discord dark
        secondary: '#2f3136', // Discord darker
        tertiary: '#202225', // Discord darkest
        primary: '#5865F2', // Discord Blurple
        'text-normal': '#dcddde',
        'text-muted': '#72767d',
      }
    },
  },
  plugins: [],
}
