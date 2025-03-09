import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
  netWorth: number; // e.g. 687041.79
  monthlyChange: number; // e.g. 23542.96
  data: DataPoint[]; // e.g. array of { date, netWorth }
}

export function NetWorthPerformanceCard({
  netWorth,
  monthlyChange,
  data,
}: NetWorthPerformanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {netWorth.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </CardTitle>
        <CardDescription>
          {monthlyChange.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}{" "}
          (1 month change)
        </CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            {/* Gradient for the area fill */}
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* If you want grid lines, remove `strokeDasharray="3 3"` or style as needed */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            {/* Hide axes to mimic the minimal design */}
            <XAxis dataKey="date" hide />
            <YAxis hide />

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
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
