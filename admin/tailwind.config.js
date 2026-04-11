/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Airbnb palette */
        airbnb: {
          red: '#ff385c',
          'red-dark': '#e00b41',
          dark: '#222222',
          secondary: '#6a6a6a',
          surface: '#f2f2f2',
          border: '#c1c1c1',
          error: '#c13515',
          legal: '#428bff',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        /* Airbnb scale */
        airbnb: '8px',
        badge: '14px',
        card: '20px',
        large: '32px',
      },
      boxShadow: {
        'airbnb-card':
          'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.1) 0px 4px 8px',
        'airbnb-hover': 'rgba(0,0,0,0.08) 0px 4px 12px',
        'airbnb-focus':
          'rgb(255,255,255) 0px 0px 0px 4px, rgba(0,0,0,0.2) 0px 0px 0px 6px',
      },
      fontWeight: {
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
