import { ChevronsUpDown, LogOut } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { AuthLogout } from "@/features/auth/authSaga";
import type { AuthState } from "@/features/auth/authSlice";
import {
  selectFirstName,
  selectLastName,
} from "@/features/settings/settingsSlice";

function getNameFromEmail(email: string): string {
  if (!email) return "";

  const localPart = email.split("@")[0];

  const nameParts = localPart.split(/[._]/);

  if (nameParts.length >= 2) {
    const firstName =
      nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
    const lastName =
      nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);

    return `${firstName} ${lastName}`;
  }

  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

export function NavUser({ user }: { user: AuthState["user"] }) {
  const { isMobile } = useSidebar();
  const dispatch = useAppDispatch();
  const settingsFirstName = useAppSelector(selectFirstName);
  const settingsLastName = useAppSelector(selectLastName);

  const profileName =
    [settingsFirstName, settingsLastName].filter(Boolean).join(" ") ||
    getNameFromEmail(user.email);

  const initials =
    (settingsFirstName?.charAt(0) || getNameFromEmail(user.email).charAt(0)) +
    ((settingsLastName || getNameFromEmail(user.email).split(" ")[1] || "").charAt(0) || "");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{profileName}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{profileName}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => dispatch(AuthLogout())}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
