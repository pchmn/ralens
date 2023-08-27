module.exports = {
  root: true,
  extends: ['@prevezic/eslint-config/react'],
  overrides: [
    {
      files: ['*.js'],
      env: {
        node: true,
      },
    },
  ],
};
