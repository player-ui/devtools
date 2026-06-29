import React from "react";
import { Navigation, Action, Text, StackedView } from "@devtools-ui/plugin";
import { VIEWS_IDS } from "../constants";

/** Display labels for the navigation actions, keyed by view id. */
const NAV_LABELS: Record<string, string> = {
  [VIEWS_IDS.PROFILE]: "Flame Graph",
  [VIEWS_IDS.RAW]: "Raw",
};

const Nav = () => (
  <Navigation>
    <Navigation.Values>
      {Object.values(VIEWS_IDS).map((viewId) => (
        <Action key={viewId} value={viewId}>
          <Action.Label>
            <Text>{NAV_LABELS[viewId] ?? viewId}</Text>
          </Action.Label>
        </Action>
      ))}
    </Navigation.Values>
  </Navigation>
);

export const Screen = ({
  main,
  footer,
  id,
}: {
  id: string;
  main: React.ReactNode;
  footer?: React.ReactNode;
}) => (
  <StackedView id={id}>
    <StackedView.Header>
      <Nav />
    </StackedView.Header>
    <StackedView.Main>{main}</StackedView.Main>
    {footer && <StackedView.Footer>{footer}</StackedView.Footer>}
  </StackedView>
);
