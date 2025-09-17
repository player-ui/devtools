import type { StorybookConfig } from "@storybook/react-vite";
import remarkGfm from "remark-gfm";

const config: StorybookConfig = {
  stories: ["../src/**/*.@(stories.@(js|tsx|ts))", "../src/**/*.mdx"],
  core: {
    disableTelemetry: true,
  },
  addons: [
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    "@storybook/blocks",
    "@player-ui/storybook",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(config) {
    const { mergeConfig } = await import("vite");

    return mergeConfig(config, {
      resolve: {
        dedupe: ["@player-ui/react", "@player-ui/player", "@player-tools/dsl"],
      },
    });
  },
  docs: {
    autodocs: "tag",
  },
};

export default config;
