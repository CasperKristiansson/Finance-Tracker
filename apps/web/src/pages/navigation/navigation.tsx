import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut } from "lucide-react";
import React from "react";
import { useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { AppSidebar } from "@/components/app-sidebar";
import { pageFade } from "@/components/motion-presets";
import { Spinner } from "@/components/spinner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AuthLogout } from "@/features/auth/authSaga";
import { selectIsDemo, selectUser } from "@/features/auth/authSlice";
import { useSettings } from "@/hooks/use-api";

const ProfileGate: React.FC = () => {
  const {
    firstName,
    lastName,
    loading,
    saving,
    error,
    lastSavedAt,
    changeFirstName,
    changeLastName,
    saveSettings,
  } = useSettings();
  const isDemo = useAppSelector(selectIsDemo);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(() => {
    const hasProfile = !!firstName?.trim() && !!lastName?.trim();
    return hasProfile;
  });

  const missingProfile = !firstName?.trim() || !lastName?.trim();
  const shouldBlock =
    !isDemo && (loading || saving || missingProfile || !submitted);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedFirst = (firstName || "").trim();
    const trimmedLast = (lastName || "").trim();
    if (!trimmedFirst || !trimmedLast) {
      setFormError("Please add both first and last name.");
      return;
    }
    changeFirstName(trimmedFirst);
    changeLastName(trimmedLast);
    setFormError(null);
    setSubmitted(true);
    saveSettings();
  };

  React.useEffect(() => {
    if (!missingProfile && lastSavedAt) {
      setSubmitted(true);
    }
  }, [lastSavedAt, missingProfile]);

  if (!shouldBlock) return null;

  const showSpinner = loading || saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      {showSpinner ? (
        <>
          <Spinner
            ariaLabel="Loading profile"
            height={72}
            width={72}
            color="#2563eb"
            duration={1.4}
          />
          <span className="sr-only">Loading profile</span>
        </>
      ) : (
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Profile required
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Finish your details
              </h2>
              <p className="text-sm text-slate-600">
                Add your first and last name to personalize your workspace.
              </p>
            </div>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gate-first-name">First name</Label>
                <Input
                  id="gate-first-name"
                  value={firstName ?? ""}
                  onChange={(e) => changeFirstName(e.target.value)}
                  placeholder="Ada"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gate-last-name">Last name</Label>
                <Input
                  id="gate-last-name"
                  value={lastName ?? ""}
                  onChange={(e) => changeLastName(e.target.value)}
                  placeholder="Lovelace"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            {formError || error ? (
              <p className="text-sm text-rose-600">{formError || error}</p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save and continue
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export const Navigation: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ children, title }) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const user = useAppSelector(selectUser);
  const isDemo = useAppSelector(selectIsDemo);
  const { firstName, lastName } = useSettings();

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const displayName = React.useMemo(() => {
    const name = [firstName, lastName]
      .filter((part): part is string => Boolean(part))
      .join(" ");
    if (name) return name;
    const parts = user.email.split("@")[0].split(/[._]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0].charAt(0).toUpperCase()}${parts[1].charAt(0).toUpperCase()}`;
    }
    return user.email.slice(0, 2).toUpperCase();
  }, [firstName, lastName, user.email]);

  const initials = React.useMemo(() => {
    const name = [firstName, lastName].filter((part): part is string =>
      Boolean(part),
    );
    if (name.length) {
      return name
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    const parts = user.email.split("@")[0].split(/[._]/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  }, [firstName, lastName, user.email]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ProfileGate />
        <AnimatePresence mode="wait">
          <motion.div
            key={title}
            {...pageFade}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
          >
            <motion.header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbPage>{title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex items-center gap-3">
                {isDemo ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                    Demo mode
                  </span>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 px-2"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="hidden flex-col text-left sm:flex">
                        <span className="text-sm leading-none font-medium">
                          {displayName || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Account
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Session</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => dispatch(AuthLogout())}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </motion.header>
            <div
              ref={contentRef}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 pt-0"
            >
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </SidebarInset>
    </SidebarProvider>
  );
};
