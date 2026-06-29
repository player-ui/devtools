import { ReactDevtoolsPlugin } from "@player-devtools/plugin-react";
import { ProfilerDevtoolsPlugin } from "@player-devtools/profiler-plugin";

export class ProfilerReactDevtoolsPlugin extends ReactDevtoolsPlugin<ProfilerDevtoolsPlugin> {
  name = "ProfilerReactDevtoolsPlugin";

  corePlugin: ProfilerDevtoolsPlugin;

  constructor(id?: string) {
    super();

    this.corePlugin = new ProfilerDevtoolsPlugin({
      playerID: id ?? "default-id",
      handler: this,
    });
  }
}
