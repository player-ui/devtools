import React, { useEffect, useState } from "react";
import type { DevtoolsWrapperProps } from "./types";

export const DefaultBasicDevtoolsWrapper = ({
  state,
  playerID,
  children,
}: DevtoolsWrapperProps): React.JSX.Element => {
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    if (playerID === state.currentPlayer) {
      setHighlight(true);
      const timer = setTimeout(() => {
        setHighlight(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [playerID, state.currentPlayer]);

  return (
    <div id={playerID} style={highlight ? { border: "2px solid blue" } : {}}>
      {children}
    </div>
  );
};
