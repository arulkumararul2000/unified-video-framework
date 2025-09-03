# Contributing to Unified Video Framework

Thank you for your interest in contributing to the Unified Video Framework! This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 14+ and npm 7+
- Git
- TypeScript knowledge
- Platform-specific requirements:
  - **React Native**: Xcode (iOS), Android Studio (Android)
  - **Roku**: Roku SDK
  - **Smart TV**: Tizen Studio (Samsung), webOS SDK (LG)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/YOUR_USERNAME/unified-video-framework.git
cd unified-video-framework
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/original-org/unified-video-framework.git
```

## Development Setup

### Install Dependencies

```bash
# Install root dependencies
npm install

# Bootstrap all packages
npm run bootstrap

# Build all packages
npm run build
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific package
npm run test --scope=@unified-video/core

# Run tests with coverage
npm run test:coverage
```

### Local Development

```bash
# Start development server
node server.js

# Watch mode for all packages
npm run dev

# Watch specific package
npm run dev --scope=@unified-video/web
```

## How to Contribute

### Types of Contributions

1. **Bug Fixes**: Fix issues reported in GitHub Issues
2. **Features**: Add new features or enhance existing ones
3. **Documentation**: Improve or add documentation
4. **Tests**: Add missing tests or improve test coverage
5. **Performance**: Optimize code for better performance
6. **Platform Support**: Add support for new platforms

### Contribution Workflow

1. **Create a branch**:
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number
```

2. **Make changes**: Follow our coding standards

3. **Write tests**: Ensure your changes are tested

4. **Commit changes**:
```bash
git add .
git commit -m "feat: add amazing feature"
# Follow conventional commits
```

5. **Push to your fork**:
```bash
git push origin feature/your-feature-name
```

6. **Create Pull Request**: Open a PR from your fork to the main repository

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Provide proper types, avoid `any`
- Document complex types

```typescript
// Good
interface VideoConfig {
  url: string;
  autoPlay?: boolean;
  muted?: boolean;
}

// Bad
const config: any = { url: 'video.mp4' };
```

### JavaScript

- Use ES6+ features
- Use async/await over promises when possible
- Handle errors properly

```javascript
// Good
async function loadVideo(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('Failed to load video:', error);
    throw error;
  }
}
```

### File Structure

```
packages/
  [platform-name]/
    src/           # Source code
    tests/         # Tests
    docs/          # Documentation
    package.json   # Package config
    tsconfig.json  # TypeScript config
    README.md      # Package readme
```

### Naming Conventions

- **Files**: camelCase for JS/TS, kebab-case for others
- **Classes**: PascalCase
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces**: PascalCase with 'I' prefix optional

## Testing Guidelines

### Unit Tests

Every new feature should include unit tests:

```typescript
describe('VideoPlayer', () => {
  it('should load video source', async () => {
    const player = new VideoPlayer();
    await player.load({ url: 'test.mp4' });
    expect(player.getState()).toBe('ready');
  });
});
```

### Integration Tests

Test interactions between components:

```typescript
describe('Player Integration', () => {
  it('should handle HLS streams', async () => {
    // Test HLS functionality
  });
});
```

### Platform-Specific Tests

Each platform should have its own test suite:

- Web: Jest + Testing Library
- React Native: Jest + React Native Testing Library
- Roku: Roku Unit Testing Framework

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] Commit messages follow conventional commits
- [ ] Branch is up to date with main

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Platforms Affected
- [ ] Web
- [ ] iOS
- [ ] Android
- [ ] Smart TV
- [ ] Roku

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
```

### Review Process

1. Automated checks run (linting, tests, build)
2. Code review by maintainers
3. Address feedback
4. Approval and merge

## Reporting Issues

### Bug Reports

Use the bug report template:

```markdown
**Describe the bug**
Clear description of the issue

**To Reproduce**
1. Step one
2. Step two
3. See error

**Expected behavior**
What should happen

**Environment**
- Framework version:
- Platform:
- Browser/Device:
- OS:

**Additional context**
Any other relevant information
```

### Feature Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
Description of the problem

**Describe the solution**
Your proposed solution

**Alternatives considered**
Other solutions you've considered

**Additional context**
Any other information
```

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes
- `perf`: Performance improvements

### Examples

```bash
feat(web): add HLS.js support for streaming
fix(react-native): resolve iOS playback issue
docs(readme): update installation instructions
test(core): add unit tests for PlayerFactory
```

## Release Process

1. Version bump following semver
2. Update CHANGELOG.md
3. Create release tag
4. Publish to npm
5. Update documentation

## Getting Help

- **Discord**: [Join our Discord](https://discord.gg/example)
- **Discussions**: Use GitHub Discussions
- **Email**: dev@example.com

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Annual contributor spotlight

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to the Unified Video Framework! 🎉
