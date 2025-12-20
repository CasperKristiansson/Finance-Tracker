import type { Meta, StoryObj } from "@storybook/react";
import { Inbox, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "../ui/button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Composed/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "No data yet.",
    description: "Import a file or add a transaction to populate this view.",
    icon: <Inbox className="h-5 w-5" />,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const WithAction: Story = {
  args: {
    action: (
      <Button size="sm" variant="outline" className="border-slate-200">
        Import data
      </Button>
    ),
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Limited access",
    description: "Connect accounts to view the latest activity.",
    icon: <ShieldAlert className="h-5 w-5" />,
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    title: "Permissions required",
    description: "You need additional permissions to view this data.",
    icon: <TriangleAlert className="h-5 w-5" />,
  },
};
