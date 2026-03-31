import { tableAnatomy } from "@chakra-ui/anatomy";
import { createMultiStyleConfigHelpers } from "@chakra-ui/react";
import { theme } from "flipper-plugin";

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(tableAnatomy.keys);

export const Table = defineMultiStyleConfig({
  baseStyle: definePartsStyle({
    table: {
      lineHeight: 1,
    },
    td: {
      lineHeight: 1,
      color: theme.textColorPrimary,
    },
    th: {
      lineHeight: 1,
      color: theme.textColorSecondary,
    },
  }),
});
