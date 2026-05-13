/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF7F2',
        paper: '#F3EBDD',
        sepia: '#5C4632',
        sepiaSoft: '#7A6249',
        bordeaux: '#7B2D26',
        forest: '#2F4F2F',
        ink: '#1F1B16',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Lora', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        shelf: '0 1px 0 0 rgba(92, 70, 50, 0.08), 0 2px 6px -1px rgba(92, 70, 50, 0.12)',
      },
    },
  },
  plugins: [],
};
