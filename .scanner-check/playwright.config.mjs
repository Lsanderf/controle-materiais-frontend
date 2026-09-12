import config from '../playwright.config.js';
export default { ...config, testDir: '../e2e', outputDir: '../test-results', webServer: undefined };
