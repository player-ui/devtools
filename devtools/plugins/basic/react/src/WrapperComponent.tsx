import React, { useEffect, useState } from "react";
import type { PluginStore } from "@player-devtools/plugin";
import type { DevtoolsPluginsStore } from "@player-devtools/types";

export type DevtoolsWrapperProps = React.PropsWithChildren<{
  state: DevtoolsPluginsStore;
  playerID: string;
}>;

export type WrapperComponentProps = {
  Component: React.ComponentType;
  Wrapper: React.ComponentType<DevtoolsWrapperProps>;
  store: PluginStore;
  playerID: string;
};

export const WrapperComponent = ({
  Component,
  Wrapper,
  store,
  playerID,
}: WrapperComponentProps): React.JSX.Element => {
  const [state, setState] = useState(store.getState());
  useEffect(() => store.subscribe(setState), [store]);
  return (
    <Wrapper state={state} playerID={playerID}>
      <Component />
    </Wrapper>
  );
};
