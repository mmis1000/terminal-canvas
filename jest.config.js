module.exports = {
  coverageDirectory: "coverage",
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: [/src\/__tests__\/.+\.test\.ts/],
  collectCoverageFrom: ["src/**/*.{ts,js}", "!src/__tests__/**/*.{ts,js}", "!src/demos/**/*.{ts,js}"]
};