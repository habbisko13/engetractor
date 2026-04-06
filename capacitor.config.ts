import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.engetractor.app',
  appName: 'Engetractor',
  webDir: 'dist',
  server: {
    // Substitua pelo link real que o Render te deu
    url: 'https://engetractor.onrender.com', 
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;