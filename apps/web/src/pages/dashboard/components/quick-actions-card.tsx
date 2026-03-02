import {
  FileBarChart,
  PiggyBank,
  Plus,
  Settings,
  Upload,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageRoutes } from "@/data/routes";

export const QuickActionsCard = () => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)]">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          Quick actions
        </CardTitle>
        <p className="text-xs text-slate-500">Jump into common flows</p>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link to={PageRoutes.transactions} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add transaction
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link to={PageRoutes.imports} className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Import bank file
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link to={PageRoutes.accounts} className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          View accounts
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link to={PageRoutes.reports} className="flex items-center gap-2">
          <FileBarChart className="h-4 w-4" />
          Reports
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link to={PageRoutes.goals} className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4" />
          Goals
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full justify-start gap-2">
        <Link to={PageRoutes.settings} className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </Button>
    </CardContent>
  </Card>
);
