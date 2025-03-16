import { type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function NavMain({
  items,
  title,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
  title: string;
}) {
  const location = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <SidebarMenuItem key={item.url}>
              <Link
                to={item.url}
                className={cn(
                  "flex items-center gap-2",
                  isActive && "font-bold",
                )}
              >
                <SidebarMenuButton
                  tooltip={item.title}
                  className={cn(isActive && "bg-muted text-foreground")}
                >
                  {item.icon && (
                    <item.icon className={cn(isActive && "text-primary")} />
                  )}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
