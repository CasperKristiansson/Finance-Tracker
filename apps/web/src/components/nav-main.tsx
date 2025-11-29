import { type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
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
                  "flex w-full items-center gap-2 rounded-md p-2 text-sm",
                  isActive && "bg-muted font-medium text-foreground",
                )}
              >
                {item.icon && (
                  <item.icon
                    className={cn("h-4 w-4", isActive && "text-primary")}
                  />
                )}
                <span className="truncate">{item.title}</span>
              </Link>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
