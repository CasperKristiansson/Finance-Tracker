import React from "react";
import CircleK from "@/assets/banks/circlek.png";
import DanskeBank from "@/assets/banks/danskebank.png";
import Nordnet from "@/assets/banks/nordnet.jpg";
import Seb from "@/assets/banks/seb.png";
import SwedBank from "@/assets/banks/swedbank.png";
import { AccountItem, type Account } from "./accountItem";

const accountsChecking: Account[] = [
  {
    bankLogo: SwedBank,
    name: "Default Checking",
    type: "Checking",
    balance: "$15,234.75",
    updated: "16 hours ago",
    chartData: [],
  },
  {
    bankLogo: Seb,
    name: "Company Checking",
    type: "Checking",
    balance: "$50,107.55",
    updated: "16 hours ago",
    chartData: [],
  },
];

const accountsInvestments: Account[] = [
  {
    bankLogo: Nordnet,
    name: "Private Investment",
    type: "Investment",
    balance: "$15,234.75",
    updated: "16 hours ago",
    chartData: [],
  },
  {
    bankLogo: DanskeBank,
    name: "House Investment",
    type: "Investment",
    balance: "$50,107.55",
    updated: "16 hours ago",
    chartData: [],
  },
  {
    bankLogo: Nordnet,
    name: "Company Investment",
    type: "Investment",
    balance: "$50,107.55",
    updated: "16 hours ago",
    chartData: [],
  },
];

const accountsCreditCards: Account[] = [
  {
    bankLogo: CircleK,
    name: "Circle K",
    type: "Credit Card",
    balance: "$15,234.75",
    updated: "16 hours ago",
    chartData: [],
  },
];

export const AccountsCard: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <AccountItem accounts={accountsChecking} />
      <AccountItem accounts={accountsInvestments} />
      <AccountItem accounts={accountsCreditCards} />
    </div>
  );
};
