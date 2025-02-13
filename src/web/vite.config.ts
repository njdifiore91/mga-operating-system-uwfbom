import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for development
      fastRefresh: true,
      // Babel configuration for production optimization
      babel: {
        plugins: [
          ['@babel/plugin-transform-runtime'],
          process.env.NODE_ENV === 'production' && [
            'transform-react-remove-prop-types',
            { removeImport: true }
          ]
        ].filter(Boolean)
      }
    }),
    // Enable TypeScript path aliases
    tsconfigPaths()
  ],

  server: {
    // Development server configuration
    port: 3000,
    host: true,
    proxy: {
      // Proxy API requests to backend during development
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
    // Browser compatibility targets based on requirements
    target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // Core vendor dependencies
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled'
          ],
          // Analytics and visualization dependencies
          analytics: [
            '@mui/x-charts',
            '@mui/x-data-grid'
          ],
          // Form handling dependencies
          forms: [
            'react-hook-form',
            'yup',
            '@hookform/resolvers'
          ]
        }
      }
    },
    // Terser options for production builds
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  },

  resolve: {
    alias: {
      // Path alias configuration matching tsconfig
      '@': '/src'
    }
  },

  define: {
    // Global constants
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __API_URL__: JSON.stringify(process.env.VITE_API_URL),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },

  // CSS configuration
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

  // Optimization settings
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled'
    ],
    exclude: ['@mui/x-charts'] // Lazy loaded
  },

  // Preview server configuration
  preview: {
    port: 3000,
    host: true
  }
});