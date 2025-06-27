module.exports = {
  extends: ['../.eslintrc.js'],
  env: {
    node: true,
    es2021: true,
    commonjs: true
  },
  rules: {
    // Project-specific rules can be added here
    'no-console': 'off', // Allow console.log for bot debugging
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }]
  }
}; 