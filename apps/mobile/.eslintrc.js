module.exports = {
  root: true,
  extends: ['@ralens/eslint-config/react'],
  overrides: [
    {
      files: ['*.js'],
      env: {
        node: true,
      },
    },
  ],
};
