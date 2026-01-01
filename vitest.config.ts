/// <reference types="vitest" />
import { defineConfig } from 'vite';

/**
 * Vitest Configuration
 * 
 * Configured for Electron main process testing with:
 * - Node environment for native module compatibility
 * - External handling for better-sqlite3 and electron
 * - Path aliases matching tsconfig
 */
export default defineConfig({
  test: {
    // Use Node environment for main process tests
    environment: 'node',
    
    // Test file patterns
    include: [
      'src/main/**/*.test.ts',
      'src/shared/**/*.test.ts'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'out',
      'dist',
      '.git'
    ],
    
    // Global test utilities
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      exclude: [
        'src/main/**/*.test.ts',
        'src/shared/**/*.test.ts',
        'src/main/index.ts',
        '**/*.d.ts'
      ]
    },
    
    // Timeout for async tests
    testTimeout: 10000,
    
    // Setup files (if needed in future)
    // setupFiles: ['./src/test/setup.ts'],
    
    // Mock configuration
    mockReset: true,
    restoreMocks: true
  },
  
  // Resolve configuration for imports
  resolve: {
    alias: {
      '@shared': '/src/shared'
    }
  }
});
