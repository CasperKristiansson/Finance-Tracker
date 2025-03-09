import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ArrowUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  netWorth: number;
}

interface NetWorthPerformanceCardProps {
  netWorth: number;
  monthlyChange: number;
  data: DataPoint[];
}

export function NetWorthPerformanceCard({
  netWorth,
  monthlyChange,
  data,
}: NetWorthPerformanceCardProps) {
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
      <CardHeader>
        <CardDescription>Net Worth</CardDescription>
        <div className="flex items-center">
          <CardTitle className="text-2xl font-bold">
            {netWorth.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </CardTitle>
          <div className="ml-2 flex items-center space-x-1 text-sm">
            <ArrowUp color="oklch(0.627 0.194 149.214)" size={20} />
            <span className="text-green-600">
              {monthlyChange.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
            <span className="text-green-600">(12.5%)</span>
            <span className="ml-2 text-gray-500">1 month change</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
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
}
