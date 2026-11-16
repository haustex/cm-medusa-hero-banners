module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/"],
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["<rootDir>/.medusa/"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.unit.spec.[jt]s"],
}
