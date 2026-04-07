import { selectAnatomy } from "@chakra-ui/anatomy";
import { createMultiStyleConfigHelpers } from "@chakra-ui/react";
import { theme } from "flipper-plugin";

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(selectAnatomy.keys);

export const Select = defineMultiStyleConfig({
  baseStyle: definePartsStyle({
    field: {
      background: theme.buttonDefaultBackground,
      color: theme.textColorPrimary,
    },
    icon: {
      color: theme.textColorPrimary,
    },
  }),
});
