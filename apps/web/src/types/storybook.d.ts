declare module "@storybook/react" {
  import type {
    ComponentPropsWithoutRef,
    ComponentType,
    ReactElement,
  } from "react";

  export type Meta<T = ComponentType> = {
    title?: string;
    component?: T;
    tags?: string[];
    args?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };

  export type StoryObj<TMeta = Meta> = Record<string, unknown> & {
    args?: TMeta extends Meta<infer TComponent>
      ? Partial<ComponentPropsWithoutRef<TComponent>>
      : Record<string, unknown>;
  };

  export type Preview = {
    parameters?: Record<string, unknown>;
    decorators?: Array<
      (Story: ComponentType, context: Record<string, unknown>) => ReactElement
    >;
  };
}

declare module "@storybook/react-vite" {
  import type { UserConfig } from "vite";

  export type StorybookConfig = {
    stories?: Array<string>;
    addons?: Array<string>;
    framework?: { name: string; options?: Record<string, unknown> };
    viteFinal?: (
      config: UserConfig,
    ) => UserConfig | Promise<UserConfig | undefined> | undefined;
  };
}

declare module "@storybook/addon-essentials" {
  const addon: string;
  export default addon;
}

declare module "storybook" {}
