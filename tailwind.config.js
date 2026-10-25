/** Tailwind build config. Regenerate css/tailwind.css with: npm run build:css */
module.exports = {
    content: [
        './index.html',
        './js/**/*.js',
        '!./js/vendor/**'
    ],
    theme: {
        extend: {
            colors: {
                'sand': '#F4F1EA',
                'clay': '#E6DFD3',
                'wood': '#D1C7B7',
                'earth': '#4A4036',
                'soil': '#2D251F',
                'jungle': '#2D6A4F',
                'canopy': '#1B4332',
                'leaf': '#40916C',
                'terracotta': '#E07A5F',
                'paper': '#FDFBF7'
            },
            fontFamily: {
                'sans': ['Inter', 'system-ui', 'sans-serif'],
                'serif': ['Merriweather', 'Georgia', 'serif'],
                'mono': ['JetBrains Mono', 'monospace']
            },
            boxShadow: {
                '2xs': '0 1px 2px rgba(0,0,0,0.03)'
            }
        }
    },
    plugins: []
};
