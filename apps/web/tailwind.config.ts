import type { Config } from 'tailwindcss';
import { wingmicPreset } from '@wingmic/design-tokens/tailwind-preset';

const config: Config = {
  presets: [wingmicPreset as Config],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
};

export default config;
