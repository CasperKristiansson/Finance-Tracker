import type { Meta, StoryObj } from "@storybook/react";

import { LoadingCard } from "./loading-card";

const meta = {
  title: "Composed/LoadingCard",
  component: LoadingCard,
  tags: ["autodocs"],
  args: {
    lines: 5,
  },
} satisfies Meta<typeof LoadingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dense: Story = {
  args: { lines: 8, lineClassName: "h-2.5" },
};

export const Compact: Story = {
  args: { lines: 3, className: "max-w-md" },
};
