import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      babel: {
        plugins: [
          ['@babel/plugin-transform-runtime'],
          ...(process.env.NODE_ENV === 'production' 
            ? [['transform-react-remove-prop-types', { removeImport: true }]]
            : [])
        ]
      }
    }),
    tsconfigPaths()
  ],

  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled'
          ],
          analytics: [
            '@mui/x-charts',
            '@mui/x-data-grid'
          ],
          forms: [
            'react-hook-form',
            'yup',
            '@hookform/resolvers'
          ]
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  },

  resolve: {
    alias: {
      '@': '/src'
    }
  },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __API_URL__: JSON.stringify(process.env.VITE_API_URL),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  css: {
    modules: {
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/variables.scss";'
      }
    }
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled'
    ],
    exclude: ['@mui/x-charts']
  },

  preview: {
    port: 3000,
    host: true
  }
});