import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    './src/App.tsx',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Hanken Grotesk', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Hanken Grotesk', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#f6f5f1',
          dim: '#dadada',
          bright: '#f6f5f1',
          container: {
            lowest: '#faf9f6',
            low: '#f0efeb',
            DEFAULT: '#eeeeee',
            high: '#e8e8e8',
            highest: '#e2e2e2',
          },
        },
        'on-surface': {
          DEFAULT: '#1a1c1c',
          variant: '#444748',
        },
        primary: '#000000',
        'on-primary': '#faf9f6',
        outline: {
          DEFAULT: '#747878',
          variant: '#c4c7c7',
        },
      },
    },
  },
};

export default config;
