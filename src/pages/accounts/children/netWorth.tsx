import { ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const data = {
  netWorth: 100000,
  monthlyChange: 1000,
  data: [
    { date: "2021-01-01", netWorth: 100000 },
    { date: "2021-02-01", netWorth: 101000 },
    { date: "2021-03-01", netWorth: 110000 },
    { date: "2021-04-01", netWorth: 113000 },
    { date: "2021-05-01", netWorth: 123000 },
    { date: "2021-06-01", netWorth: 129000 },
    { date: "2021-07-01", netWorth: 132000 },
  ],
};

export const NetWorthPerformanceCard: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState("1 year");
  const [isOpen, setIsOpen] = useState(false);

  const formatYAxis = (value: number) => {
    if (value >= 1e6) {
      return `$ ${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$ ${(value / 1e3).toFixed(0)}k`;
    }
    return `$ ${value}`;
  };

  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", { month: "short" });
  };

  return (
    <Card>
      <CardHeader className="flex w-full">
        <CardDescription>Net Worth</CardDescription>
        <div className="space-between flex w-full flex-col justify-between gap-4 md:flex-row md:gap-0">
          <div className="flex items-center">
            <CardTitle className="text-2xl font-bold">
              {data.netWorth.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </CardTitle>
            <div className="ml-2 flex items-center space-x-1 text-sm">
              <ArrowUp color="oklch(0.627 0.194 149.214)" size={20} />
              <span className="text-green-600">
                {data.monthlyChange.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </span>
              <span className="text-green-600">(12.5%)</span>
              <span className="ml-2 hidden text-gray-500 lg:block">
                1 month change
              </span>
            </div>
          </div>
          <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger className="flex w-[150px] items-center justify-between rounded-md border px-3 py-1">
              {selectedRange}
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[150px]">
              <DropdownMenuItem onClick={() => setSelectedRange("6 months")}>
                6 months
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedRange("1 year")}>
                1 year
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedRange("3 years")}>
                3 years
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedRange("total")}>
                Total
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="h-64 px-4 md:px-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data.data}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatYAxis}
              domain={["dataMin", "dataMax"]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number) =>
                value.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })
              }
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#4F46E5"
              strokeWidth={2}
              fill="url(#colorNetWorth)"
              name="Net Worth"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
