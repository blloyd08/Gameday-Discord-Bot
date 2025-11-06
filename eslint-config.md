# ESLint Configuration for Gameday Discord Bot

This document explains the ESLint configuration and recommendations for the Gameday Discord Bot project.

## Overview

The ESLint configuration is designed to enforce code quality, consistency, and best practices for TypeScript development in a Discord bot environment. The configuration includes rules for TypeScript-specific patterns, general JavaScript best practices, and Discord.js-specific considerations.

## Configuration Details

### File: `eslint.config.mjs`

The main ESLint configuration file is located at `eslint.config.mjs` and includes:

1. **File Targeting**: Applies to all `.ts` files
2. **Ignores**: Excludes `node_modules`, `out`, `aws`, and `tools` directories
3. **Globals**: Includes both browser and Node.js globals for proper linting
4. **Recommended Rules**: Extends from `@eslint/js` and `typescript-eslint` recommended configurations
5. **Custom Rules**: Additional rules specifically tailored for this project

## Custom Rules Explained

### TypeScript-Specific Rules

- `@typescript-eslint/no-unused-vars`: Errors on unused variables (enforces clean code)
- `@typescript-eslint/no-explicit-any`: Warns on `any` type usage (promotes type safety)
- `@typescript-eslint/explicit-function-return-type`: Warns on missing return types (improves code clarity)
- `@typescript-eslint/no-require-imports`: Errors on `require()` imports (encourages ES6 imports)
- `@typescript-eslint/consistent-type-imports`: Enforces consistent import styles (improves code organization)

### General JavaScript Rules

- `no-console`: Warns on console usage (good for production builds)
- `no-debugger`: Errors on debugger statements (prevents accidental debug code)
- `no-var`: Errors on `var` declarations (encourages `const`/`let`)
- `prefer-const`: Encourages `const` over `let` when values don't change
- `eqeqeq`: Requires strict equality checks (`===` instead of `==`)
- `curly`: Requires curly braces for all control flow statements
- `semi`: Enforces semicolons (consistent formatting)
- `quotes`: Enforces single quotes (consistent string formatting)
- `comma-dangle`: Enforces trailing commas (easier code maintenance)

### Discord.js Specific Rules

- `no-await-in-loop`: Warns on async/await in loops (performance consideration)
- `no-async-promise-executor`: Errors on problematic async promise executor patterns

## Usage

### Running Linting

```bash
# Check for linting issues
npm run lint

# Automatically fix fixable issues
npm run lint-fix
```

### Integration

The linting is integrated into the project's npm scripts and will run during development and CI/CD processes.

## Best Practices

1. **Type Safety**: Leverage TypeScript's type system to catch errors early
2. **Code Consistency**: Maintain consistent formatting and style
3. **Performance**: Avoid common performance pitfalls in Discord bot development
4. **Debugging**: Use proper debugging practices (avoid console.log in production)
5. **Async/Await**: Follow best practices for asynchronous code patterns

## Customization

To modify the rules:
1. Edit `eslint.config.mjs`
2. Run `npm run lint` to test changes
3. Adjust rules as needed for your specific development preferences

This configuration provides a solid foundation for maintaining high-quality code in the Gameday Discord Bot while being tailored to the specific needs of a Discord.js application.
