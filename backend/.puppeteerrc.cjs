const { join } = require("path");

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to a directory inside the backend project.
  // This ensures Render retains the downloaded Chrome browser across builds and deployment.
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
