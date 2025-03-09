import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowUp } from "lucide-react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const mockCredit = 22352;
const mockMonthlyChange = 1234;

export type Account = {
  bankLogo: string;
  name: string;
  type: string;
  balance: string;
  updated: string;
  chartData: string[];
};

export const AccountItem: React.FC<{ accounts: Account[] }> = ({
  accounts,
}) => {
  return (
    <>
      <Card className="gap-6 py-0 pt-4">
        <CardHeader className="px-4">
          <div className="space-between flex w-full flex-row justify-between">
            <div className="flex items-center">
              <CardTitle className="text-2xl font-bold">Cash</CardTitle>
              <div className="ml-2 flex items-center space-x-1 text-sm">
                <ArrowUp color="oklch(0.627 0.194 149.214)" size={20} />
                <span className="text-green-600">
                  {mockMonthlyChange.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </span>
                <span className="text-green-600">(12.5%)</span>
                <span className="ml-2 hidden text-gray-500 md:block">
                  1 month change
                </span>
              </div>
            </div>
            <div className="flex items-center">
              <h2 className="text-lg font-bold">
                {mockCredit.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </h2>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Separator />
          <Table>
            <TableBody>
              {accounts.map((account, id) => (
                <TableRow key={id}>
                  <TableCell className="w-ful">
                    <div className="ml-1 flex items-center space-x-3">
                      <img
                        src={account.bankLogo}
                        alt={`${account.name} logo`}
                        width={32}
                        height={32}
                        className="mb-1 rounded-sm object-contain"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="leading-none font-medium">
                          {account.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {account.type}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="mr-1 flex flex-col items-end gap-1">
                      <span className="leading-none font-medium">
                        {account.balance}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {account.updated}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
};
