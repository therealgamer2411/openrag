/// <reference types="@capacitor/background-runner" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'systems.stackcore.openrag.persistence',
  appName: 'OpenRAG Persistence',
  webDir: 'www',
  plugins: {
    BackgroundRunner: {
      label: 'openrag-node-runner',
      src: 'runner.js',
      event: 'openragNodeTick',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
};

export default config;
