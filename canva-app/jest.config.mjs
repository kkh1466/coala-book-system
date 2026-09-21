/** @type {import('jest').Config} */
export default {
  testEnvironment: "jsdom",
  testRegex: "\\.(spec|test)\\.[mc]?tsx?$",
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  setupFiles: ["<rootDir>/jest.setup.ts"],
};
