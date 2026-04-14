import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  rootDir: "./src",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  clearMocks: true,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
  },
};

export default config;
