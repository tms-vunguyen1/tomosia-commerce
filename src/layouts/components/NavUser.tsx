"use client";

import DynamicIcon from "@/helpers/DynamicIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Gravatar from "react-gravatar";
import { BsPerson } from "react-icons/bs";

export const fetchUser = async () => {
  try {
    // The access token is httpOnly and unreadable here by design; the server
    // resolves it and returns the profile only.
    const response = await fetch("/api/customer/me");

    if (!response.ok) {
      return null;
    }

    const { customer } = await response.json();
    return customer;
  } catch (error) {
    console.log("Error fetching user details:", error);
    return null;
  }
};

const NavUser = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const userInfo = await fetchUser();
      setUser(userInfo);
    };

    getUser();
  }, [pathname]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-nav-user]")) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" });
    setUser(null);
    setDropdownOpen(false);
    router.refresh();
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return (
    <div className="relative" data-nav-user>
      {user ? (
        <button
          onClick={toggleDropdown}
          className="relative cursor-pointer text-left sm:text-xs flex items-center justify-center"
        >
          <div className="flex items-center gap-x-1">
            <div className="h-6 w-6 border border-darkmode-border dark:border-border rounded-full overflow-hidden">
              <Gravatar
                email={user?.email}
                style={{ borderRadius: "50px" }}
                key={user?.email}
              />
            </div>
            <div className="leading-none max-md:hidden">
              <div className="flex items-center">
                <svg
                  className={`w-5 text-text-dark dark:text-darkmode-text-dark dark:hover:text-darkmode-text-primary transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>
        </button>
      ) : (
        <Link
          className="text-xl text-text-dark hover:text-text-primary dark:border-darkmode-border dark:text-white flex items-center"
          href="/login"
          aria-label="login"
        >
          <BsPerson className="dark:hover:text-darkmode-primary" />
        </Link>
      )}

      {dropdownOpen && (
        <div className="absolute right-0 z-20 mt-2 w-64 origin-top-right rounded-xl border border-border bg-body py-2 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150 dark:border-darkmode-border dark:bg-darkmode-body">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-sm font-semibold text-text-dark dark:text-darkmode-text-dark">
              {user?.firstName?.split(" ")[0]}
            </span>
          </div>

          <div className="mx-2 h-px bg-border dark:bg-darkmode-border" />

          {/* User info row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border dark:border-darkmode-border">
              <Gravatar email={user?.email} key={user?.email} className="h-full w-full" />
            </div>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-medium text-text-dark dark:text-darkmode-text-dark">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-text-dark/60 dark:text-darkmode-text-dark/60">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="mx-2 h-px bg-border dark:bg-darkmode-border" />

          {/* Orders row */}
          <Link
            href="/account/orders"
            onClick={() => setDropdownOpen(false)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text-dark transition-colors hover:bg-black/5 dark:text-darkmode-text-dark dark:hover:bg-white/5"
          >
            <DynamicIcon icon="FaBoxOpen" className="text-base" />
            My Orders
          </Link>

          <div className="mx-2 h-px bg-border dark:bg-darkmode-border" />

          {/* Logout row */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text-dark transition-colors hover:bg-black/5 dark:text-darkmode-text-dark dark:hover:bg-white/5"
          >
            <DynamicIcon icon="FaArrowRightFromBracket" className="text-base" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

export default NavUser;