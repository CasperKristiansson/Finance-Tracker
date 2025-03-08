import {
  IconMenu2,
  IconDashboard,
  IconUser,
  IconFolder,
  IconCalendar,
  IconFileText,
  IconChevronUp,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/", icon: IconDashboard },
  {
    label: "Account",
    icon: IconUser,
    children: [
      { label: "Link 1", href: "/" },
      { label: "Link 2", href: "/" },
      { label: "Link 3", href: "/" },
    ],
  },
  {
    label: "Projects",
    icon: IconFolder,
    children: [
      { label: "Link 1", href: "/" },
      { label: "Link 2", href: "/" },
      { label: "Link 3", href: "/" },
    ],
  },
  { label: "Calendar", href: "/", icon: IconCalendar },
  { label: "Documentation", href: "/", icon: IconFileText },
];

export const NavigationItem = ({ item }: { item: (typeof navItems)[0] }) => {
  const [open, setOpen] = useState(false);

  if (item.children) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-x-3.5 rounded-lg px-2.5 py-2 text-start text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
          {open ? (
            <IconChevronUp className="ms-auto h-4 w-4" />
          ) : (
            <IconChevronDown className="ms-auto h-4 w-4" />
          )}
        </button>
        {open && (
          <ul className="space-y-1 ps-8 pt-1">
            {item.children.map((child, index) => (
              <li key={index}>
                <a
                  className="flex items-center gap-x-3.5 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-100"
                  href={child.href}
                >
                  {child.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <a
        className="flex items-center gap-x-3.5 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-100"
        href={item.href}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {item.label}
      </a>
    </li>
  );
};

export const MobileHeader = () => (
  <div className="sticky inset-x-0 top-0 z-20 border-y border-gray-200 bg-white px-4 sm:px-6 lg:hidden lg:px-8">
    <div className="flex items-center py-2">
      <button
        type="button"
        className="flex items-center justify-center gap-x-2 rounded-lg border border-gray-200 text-gray-800 hover:text-gray-500 focus:text-gray-500 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls="hs-application-sidebar"
        aria-label="Toggle navigation"
        data-hs-overlay="#hs-application-sidebar"
      >
        <span className="sr-only">Toggle Navigation</span>
        <IconMenu2 className="h-4 w-4 shrink-0" />
      </button>
      <ol className="ms-3 flex items-center text-sm whitespace-nowrap text-gray-800">
        <li>
          Application Layout
          <IconChevronRight className="mx-3 h-2.5 w-2.5 shrink-0 text-gray-400" />
        </li>
        <li className="truncate font-semibold" aria-current="page">
          Dashboard
        </li>
      </ol>
    </div>
  </div>
);

export const Logo = () => <></>;

export const Sidebar = () => (
  <div
    id="hs-application-sidebar"
    className="hs-overlay fixed inset-y-0 start-0 z-60 hidden h-full w-65 -translate-x-full transform border-e border-gray-200 bg-white transition-all duration-300 lg:block lg:translate-x-0"
    role="dialog"
    tabIndex={-1}
    aria-label="Sidebar"
  >
    <div className="relative flex h-full max-h-full flex-col">
      <div className="flex items-center px-6 pt-4">
        <a
          className="inline-block flex-none rounded-xl text-xl font-semibold focus:opacity-80 focus:outline-none"
          href="/"
          aria-label="Preline"
        >
          <Logo />
        </a>
        <div className="ms-2 hidden lg:block"></div>
      </div>
      <div className="h-full overflow-y-auto">
        <nav className="flex w-full flex-col flex-wrap p-3">
          <ul className="flex flex-col space-y-1">
            {navItems.map((item, index) => (
              <NavigationItem key={index} item={item} />
            ))}
          </ul>
        </nav>
      </div>
    </div>
  </div>
);

export const Navigation = () => (
  <>
    <MobileHeader />
    <Sidebar />
    <div className="w-full px-4 pt-10 sm:px-6 md:px-8 lg:ps-72"></div>
  </>
);
