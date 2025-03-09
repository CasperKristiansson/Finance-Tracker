import * as React from "react";
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
} from "lucide-react";
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
import LogoLarge from "@/assets/LogoLarge.png";
import LogoSmall from "@/assets/LogoSmall.png";
import clsx from "clsx";

const data = {
  user: {
    name: "Casper Kristiansson",
    email: "casper.kristiansson@yahoo.se",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: Home,
    },
    {
      title: "Accounts",
      url: "#",
      icon: Banknote,
    },
    {
      title: "Transactions",
      url: "#",
      icon: BookOpen,
    },
  ],
  navExtra: [
    {
      title: "Reports",
      url: "#",
      icon: BarChart2,
    },
    {
      title: "Cash Flow",
      url: "#",
      icon: TrendingUp,
    },
    {
      title: "Loans",
      url: "#",
      icon: CreditCard,
    },
    {
      title: "Investments",
      url: "#",
      icon: PieChart,
    },
    {
      title: "Goals",
      url: "#",
      icon: Target,
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <img
          src={state === "collapsed" ? LogoSmall : LogoLarge}
          alt="Logo"
          className={clsx(
            "mt-2",
            state === "collapsed" ? "h-6 px-1" : "h-6 px-2",
          )}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} title="Core" />
        <NavMain items={data.navExtra} title="Features" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
