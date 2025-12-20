import type { Meta, StoryObj } from "@storybook/react";
import { RefreshCw } from "lucide-react";

import { Button } from "../ui/button";
import { InlineError } from "./inline-error";

const meta = {
  title: "Composed/InlineError",
  component: InlineError,
  tags: ["autodocs"],
  args: {
    message: "We couldn’t load this data. Try again in a few moments.",
  },
} satisfies Meta<typeof InlineError>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Danger: Story = {};

export const Warning: Story = {
  args: {
    variant: "warning",
    message: "This view is missing recent data while syncing completes.",
  },
};

export const NeutralWithAction: Story = {
  args: {
    variant: "neutral",
    message: "Filters returned no results.",
    action: (
      <Button size="sm" variant="ghost" className="text-sm text-slate-700">
        <RefreshCw className="mr-2 h-4 w-4" />
        Reset filters
      </Button>
    ),
  },
};
