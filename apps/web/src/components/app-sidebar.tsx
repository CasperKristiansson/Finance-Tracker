import {
  BookOpen,
  Settings2,
  BarChart2,
  TrendingUp,
  CreditCard,
  PieChart,
  Target,
  Home,
  Banknote,
  Upload,
  Layers,
  Receipt,
  RotateCcw,
} from "lucide-react";
import * as React from "react";
import { useAppSelector } from "@/app/hooks";
import LogoLarge from "@/assets/LogoLarge.png";
import LogoSmall from "@/assets/LogoSmall.png";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PageRoutes } from "@/data/routes";
import { selectUser } from "@/features/auth/authSlice";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: PageRoutes.home,
      icon: Home,
    },
    {
      title: "Accounts",
      url: PageRoutes.accounts,
      icon: Banknote,
    },
    {
      title: "Categories",
      url: PageRoutes.categories,
      icon: Layers,
    },
    {
      title: "Budgets",
      url: PageRoutes.budgets,
      icon: PieChart,
    },
    {
      title: "Imports",
      url: PageRoutes.imports,
      icon: Upload,
    },
    {
      title: "Subscriptions",
      url: PageRoutes.subscriptions,
      icon: Layers,
    },
    {
      title: "Transactions",
      url: PageRoutes.transactions,
      icon: BookOpen,
    },
    {
      title: "Returns",
      url: PageRoutes.returns,
      icon: RotateCcw,
    },
  ],
  navExtra: [
    {
      title: "Reports",
      url: PageRoutes.reports,
      icon: BarChart2,
    },
    {
      title: "Cash Flow",
      url: PageRoutes.cashFlow,
      icon: TrendingUp,
    },
    {
      title: "Taxes",
      url: PageRoutes.taxes,
      icon: Receipt,
    },
    {
      title: "Loans",
      url: PageRoutes.loans,
      icon: CreditCard,
    },
    {
      title: "Investments",
      url: PageRoutes.investments,
      icon: PieChart,
    },
    {
      title: "Goals",
      url: PageRoutes.goals,
      icon: Target,
    },
    {
      title: "Settings",
      url: PageRoutes.settings,
      icon: Settings2,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const select = useAppSelector(selectUser);
  const [animating, setAnimating] = React.useState(false);
  const hasMounted = React.useRef(false);

  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    setAnimating(true);
    const timeout = window.setTimeout(() => setAnimating(false), 220);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const showLargeLogo = state === "expanded" && !animating;
  const showSmallLogo = state === "collapsed" && !animating;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {showLargeLogo ? (
          <img src={LogoLarge} alt="Logo" className="mt-2 h-6 px-2" />
        ) : showSmallLogo ? (
          <img src={LogoSmall} alt="Logo" className="mt-2 h-6 px-1" />
        ) : (
          <div className="h-6" />
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} title="Core" />
        <NavMain items={data.navExtra} title="Features" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={select} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
