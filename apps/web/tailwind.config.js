/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#FAF7F2',
        cream: '#FFFCF6',
        paper: '#F3EBDD',
        paperDark: '#E8DDC9',
        sepia: '#5C4632',
        sepiaSoft: '#7A6249',
        sepiaDark: '#3E2F22',
        bordeaux: '#7B2D26',
        bordeauxDeep: '#5C2120',
        forest: '#2F4F2F',
        gold: '#B8860B',
        ink: '#1F1B16',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Lora', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        shelf: '0 1px 0 0 rgba(92, 70, 50, 0.08), 0 2px 6px -1px rgba(92, 70, 50, 0.12)',
        shelfLg:
          '0 4px 12px -2px rgba(92, 70, 50, 0.18), 0 14px 36px -10px rgba(92, 70, 50, 0.22)',
        card: '0 1px 2px 0 rgba(92, 70, 50, 0.06), 0 6px 18px -4px rgba(92, 70, 50, 0.10)',
        innerPaper: 'inset 0 1px 2px 0 rgba(92, 70, 50, 0.06)',
      },
      backgroundImage: {
        'hero-warmth': 'linear-gradient(135deg, #FFFCF6 0%, #FAF7F2 40%, #F3EBDD 100%)',
        'panel-warmth': 'linear-gradient(160deg, #5C4632 0%, #3E2F22 60%, #7B2D26 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s ease-out forwards',
      },
    },
  },
  plugins: [],
};
