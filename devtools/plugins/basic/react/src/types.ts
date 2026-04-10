import type { DevtoolsPluginsStore } from "@player-devtools/types";

export type DevtoolsWrapperProps = React.PropsWithChildren<{
  state: DevtoolsPluginsStore;
  playerID: string;
}>;
