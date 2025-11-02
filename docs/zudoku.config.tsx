import type { ZudokuConfig } from "zudoku";
import { apiKeyPlugin } from "zudoku/plugins/api-keys";

/**
 * Crawl4AI Developer Portal Configuration
 *
 * Complete terminal aesthetic branding with:
 * - Dank Mono font throughout
 * - Cyan (#50ffff) primary color
 * - Dark theme (#070708 background)
 * - Pink (#f380f5) accents
 *
 * For more information, see:
 * https://zuplo.com/docs/dev-portal/zudoku/configuration/overview
 */
const config: ZudokuConfig = {
  site: {
    title: "Crawl4AI API",
    logo: {
      src: {
        light: "/logo.png",
        dark: "/logo.png",
      },
      width: 48,
      height: 48,
    },
  },
  metadata: {
    title: "Crawl4AI API Documentation",
    description: "AI-Powered Web Crawling & Scraping API - Extract clean data from any website with LLM integration. Fast, reliable, and developer-friendly.",
    keywords: ["web scraping", "api", "crawling", "ai extraction", "llm", "developer tools", "automation", "data extraction"],
    generator: "Zudoku",
  },
  theme: {
    // Dark theme colors (terminal aesthetic)
    dark: {
      background: "#070708",
      foreground: "#e8e9ed",
      card: "#1a1a1a",
      cardForeground: "#e8e9ed",
      popover: "#1a1a1a",
      popoverForeground: "#e8e9ed",
      primary: "#50ffff",
      primaryForeground: "#070708",
      secondary: "#3f3f44",
      secondaryForeground: "#e8e9ed",
      muted: "#3f3f44",
      mutedForeground: "#a3abba",
      accent: "#f380f5",
      accentForeground: "#070708",
      destructive: "#ff3c74",
      destructiveForeground: "#e8e9ed",
      border: "#3f3f44",
      input: "#3f3f44",
      ring: "#50ffff",
      radius: "8px",
    },
    // Light theme (keep minimal, portal is dark-first)
    light: {
      background: "#ffffff",
      foreground: "#070708",
      card: "#f5f5f5",
      cardForeground: "#070708",
      popover: "#ffffff",
      popoverForeground: "#070708",
      primary: "#09b5a5",
      primaryForeground: "#ffffff",
      secondary: "#e8e9ed",
      secondaryForeground: "#070708",
      muted: "#f5f5f5",
      mutedForeground: "#8b857a",
      accent: "#f380f5",
      accentForeground: "#ffffff",
      destructive: "#ff3c74",
      destructiveForeground: "#ffffff",
      border: "#d5cec0",
      input: "#e8e9ed",
      ring: "#09b5a5",
      radius: "8px",
    },
    // Fonts - Dank Mono from docs.crawl4ai.com
    fonts: {
      sans: {
        url: "https://docs.crawl4ai.com/assets/dmvendor.css",
        fontFamily: "'Dank Mono', 'dm', Monaco, 'Courier New', monospace",
      },
      mono: {
        url: "https://docs.crawl4ai.com/assets/dmvendor.css",
        fontFamily: "'Dank Mono', 'dm', Monaco, Menlo, Consolas, monospace",
      },
    },
  },
  navigation: [
    {
      type: "category",
      label: "Documentation",
      items: [
        {
          type: "category",
          label: "Getting Started",
          icon: "sparkles",
          items: [
            {
              type: "doc",
              file: "introduction",
            },
            {
              type: "doc",
              file: "quickstart",
            },
            {
              type: "doc",
              file: "authentication",
            },
          ],
        },
        {
          type: "category",
          label: "API Reference",
          icon: "code",
          items: [
            {
              type: "link",
              label: "API Endpoints",
              to: "/api",
            },
          ],
        },
        {
          type: "category",
          label: "Resources",
          collapsible: false,
          icon: "link",
          items: [
            {
              type: "link",
              label: "Main Documentation",
              to: "https://docs.crawl4ai.com",
            },
            {
              type: "link",
              label: "GitHub",
              to: "https://github.com/unclecode/crawl4ai",
            },
            {
              type: "link",
              label: "Discord Community",
              to: "https://discord.gg/crawl4ai",
            },
          ],
        },
      ],
    },
    {
      type: "link",
      to: "/api",
      label: "API Reference",
    },
  ],
  redirects: [{ from: "/", to: "/introduction" }],
  apis: [
    {
      type: "file",
      input: "../config/routes.oas.json",
      path: "api",
    },
  ],
  authentication: {
    type: "auth0",
    domain: "crawl4ai.us.auth0.com",
    clientId: "AIOJI08vkkSD1SxavPIgXqwxUXYU9NmP",
    redirectToAfterSignUp: "/",
    redirectToAfterSignIn: "/",
    redirectToAfterSignOut: "/",
  },
  plugins: [
    apiKeyPlugin({
      deploymentName: "crawl4ai-platform-production-main-b3f10e1",
    }),
  ],
};

export default config;
