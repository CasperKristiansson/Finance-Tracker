import { type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useNavigationGuard } from "@/lib/navigation-guard";
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
  const { state } = useSidebar();
  const { canNavigate } = useNavigationGuard();
  const collapsed = state === "collapsed";

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
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.altKey ||
                    event.ctrlKey ||
                    event.shiftKey
                  ) {
                    return;
                  }
                  if (isActive) {
                    event.preventDefault();
                    return;
                  }
                  if (!canNavigate(item.url)) {
                    event.preventDefault();
                  }
                }}
                className={cn(
                  "group flex w-full items-center rounded-md p-2 text-sm transition-[color,padding,justify-content,gap] hover:text-slate-900",
                  collapsed ? "justify-center gap-0" : "gap-2",
                  isActive && "bg-muted font-medium text-foreground",
                )}
              >
                {item.icon && (
                  <item.icon
                    className={cn(
                      "h-4 w-4 transition-colors group-hover:text-slate-900",
                      isActive && "text-primary",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "truncate transition-colors group-hover:text-slate-900",
                    collapsed && "hidden",
                  )}
                >
                  {item.title}
                </span>
              </Link>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
