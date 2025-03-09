import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SummaryItem {
  name: string;
  amount: number;
  color: string;
}

export const Summary: React.FC = () => {
  const assets = [
    { name: "Investments", amount: 542301.55, color: "#3b82f6" },
    { name: "Real Estate", amount: 300625.05, color: "#a855f7" },
    { name: "Cash", amount: 65342.3, color: "#f97316" },
    { name: "Vehicles", amount: 20739.77, color: "#22c55e" },
  ];

  const liabilities = [
    { name: "Loans", amount: 239137.89, color: "#eab308" },
    { name: "Credit Cards", amount: 2828.99, color: "#ef4444" },
  ];

  const totalAssets = assets.reduce((acc, item) => acc + item.amount, 0);
  const totalLiabilities = liabilities.reduce(
    (acc, item) => acc + item.amount,
    0,
  );

  function getPercentage(amount: number, total: number) {
    if (total === 0) return 0;
    return (amount / total) * 100;
  }

  return (
    <Card className="flex h-full flex-col pt-4 pr-2 pl-2">
      <Tabs defaultValue="totals" className="flex w-full flex-1 flex-col">
        <div className="flex w-full items-center justify-between">
          <h2 className="text-xl font-semibold">Summary</h2>
          <TabsList>
            <TabsTrigger value="totals">Totals</TabsTrigger>
            <TabsTrigger value="percent">Percent</TabsTrigger>
          </TabsList>
        </div>

        <Separator />

        <TabsContent value="totals" className="mt-4 space-y-6">
          <div>
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Assets</span>
              <span className="text-gray-600">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(totalAssets)}
              </span>
            </h3>
            <StackedBar items={assets} total={totalAssets} />
            <div className="mt-2 space-y-1">
              {assets.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-gray-700">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Liabilities</span>
              <span className="text-gray-600">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(totalLiabilities)}
              </span>
            </h3>
            <StackedBar items={liabilities} total={totalLiabilities} />
            <div className="mt-2 space-y-1">
              {liabilities.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="text-gray-700">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="percent" className="mt-4 space-y-6">
          <div>
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Assets</span>
              <span className="text-gray-600">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(totalAssets)}
              </span>
            </h3>
            <StackedBar items={assets} total={totalAssets} />
            <div className="mt-2 space-y-1">
              {assets.map((item) => {
                const percent = getPercentage(item.amount, totalAssets);
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-gray-700">{percent.toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Separator />
          <div>
            <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Liabilities</span>
              <span className="text-gray-600">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(totalLiabilities)}
              </span>
            </h3>
            <StackedBar items={liabilities} total={totalLiabilities} />
            <div className="mt-2 space-y-1">
              {liabilities.map((item) => {
                const percent = getPercentage(item.amount, totalLiabilities);
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-gray-700">{percent.toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

function StackedBar({ items, total }: { items: SummaryItem[]; total: number }) {
  return (
    <div className="relative h-3 w-full overflow-hidden rounded bg-gray-200">
      {items.map((item) => {
        const widthPercent = total > 0 ? (item.amount / total) * 100 : 0;
        return (
          <div
            key={item.name}
            className="h-full"
            style={{
              width: `${widthPercent}%`,
              backgroundColor: item.color,
              float: "left",
            }}
          />
        );
      })}
    </div>
  );
}
