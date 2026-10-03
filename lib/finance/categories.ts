/**
 * The owner's chart of accounts. Keys are stored on transactions; labels and
 * grouping drive the form, the P&L and the exports. Add a category here and
 * it appears everywhere. Never rename a key once used.
 */
export type FinanceGroup = "revenue" | "cost_of_sales" | "operating" | "below_the_line";

export interface FinanceCategory {
  key: string;
  label: string;
  group: FinanceGroup;
  /** Shown as a hint in the form. */
  hint?: string;
  /** Sign convention for P&L: revenue and credits add, costs subtract. */
  effect: "income" | "cost";
}

export const GROUP_LABEL: Record<FinanceGroup, string> = {
  revenue: "Revenue",
  cost_of_sales: "Cost of sales",
  operating: "Operating expenses",
  below_the_line: "Below operating profit",
};

export const FINANCE_CATEGORIES: FinanceCategory[] = [
  // Revenue
  { key: "subscription_revenue", label: "Subscription revenue", group: "revenue", effect: "income", hint: "Monthly and annual plans (picked up from Stripe automatically)." },
  { key: "setup_revenue", label: "Setup / customisation revenue", group: "revenue", effect: "income", hint: "Custom package, on-site days." },
  { key: "other_revenue", label: "Other revenue", group: "revenue", effect: "income" },

  // Cost of sales
  { key: "cloud_infrastructure", label: "Cloud infrastructure", group: "cost_of_sales", effect: "cost", hint: "Cloudflare, storage, domains." },
  { key: "messaging_api", label: "Email / SMS / API costs", group: "cost_of_sales", effect: "cost", hint: "Resend, Twilio, maps and other usage-billed APIs." },
  { key: "payment_processing", label: "Payment processing", group: "cost_of_sales", effect: "cost", hint: "Stripe fees (picked up automatically)." },
  { key: "direct_development", label: "Direct development costs", group: "cost_of_sales", effect: "cost" },
  { key: "onboarding_support", label: "Customer onboarding & support", group: "cost_of_sales", effect: "cost", hint: "Time or tools spent getting each school live." },

  // Operating expenses
  { key: "software_ai", label: "Software & AI", group: "operating", effect: "cost" },
  { key: "marketing", label: "Marketing", group: "operating", effect: "cost" },
  { key: "sales", label: "Sales", group: "operating", effect: "cost" },
  { key: "travel", label: "Travel", group: "operating", effect: "cost" },
  { key: "subsistence", label: "Subsistence", group: "operating", effect: "cost", hint: "Meals and overnights on trips to schools, shows, Belfast–Dublin." },
  { key: "mileage", label: "Mileage / motor expenses", group: "operating", effect: "cost" },
  { key: "trade_shows", label: "Trade shows & events", group: "operating", effect: "cost", hint: "Boat shows, RYA / Irish Sailing conferences, stands." },
  { key: "memberships", label: "Memberships & subscriptions", group: "operating", effect: "cost", hint: "Industry bodies, trade associations." },
  { key: "professional_services", label: "Professional services", group: "operating", effect: "cost", hint: "Accounting, legal." },
  { key: "data_protection", label: "Data protection & compliance", group: "operating", effect: "cost", hint: "GDPR work, DPAs, cyber audits." },
  { key: "ip_trademarks", label: "IP & trademarks", group: "operating", effect: "cost" },
  { key: "equipment", label: "Equipment", group: "operating", effect: "cost" },
  { key: "depreciation", label: "Depreciation", group: "operating", effect: "cost", hint: "Spreads laptops and kit over their useful life." },
  { key: "insurance_pi", label: "Insurance — professional indemnity", group: "operating", effect: "cost" },
  { key: "insurance_cyber", label: "Insurance — cyber liability", group: "operating", effect: "cost" },
  { key: "insurance_pl", label: "Insurance — public liability", group: "operating", effect: "cost" },
  { key: "contractors", label: "Contractors & freelancers", group: "operating", effect: "cost", hint: "Design, copywriting, ad hoc dev outside direct costs." },
  { key: "payroll", label: "Payroll", group: "operating", effect: "cost" },
  { key: "employer_prsi_ni", label: "Employer PRSI / NI", group: "operating", effect: "cost" },
  { key: "pension", label: "Pension contributions", group: "operating", effect: "cost" },
  { key: "recruitment", label: "Recruitment", group: "operating", effect: "cost" },
  { key: "training_cpd", label: "Training & CPD", group: "operating", effect: "cost" },
  { key: "phone_internet", label: "Phone & internet", group: "operating", effect: "cost" },
  { key: "office_admin", label: "Office / admin", group: "operating", effect: "cost" },
  { key: "bank_charges", label: "Bank charges", group: "operating", effect: "cost" },
  { key: "fx_gain_loss", label: "Foreign exchange gains / losses", group: "operating", effect: "cost", hint: "Enter a gain as a negative amount." },
  { key: "bad_debts", label: "Bad debts", group: "operating", effect: "cost" },
  { key: "client_entertainment", label: "Client entertainment", group: "operating", effect: "cost", hint: "Kept separate — usually not deductible for corporation tax." },

  // Below operating profit
  { key: "interest_income", label: "Interest income", group: "below_the_line", effect: "income" },
  { key: "interest_expense", label: "Interest expense", group: "below_the_line", effect: "cost" },
  { key: "rd_tax_credit", label: "R&D tax credit", group: "below_the_line", effect: "income", hint: "Software development can qualify in Ireland and the UK." },
  { key: "corporation_tax", label: "Corporation tax", group: "below_the_line", effect: "cost" },
];

export const CATEGORY_BY_KEY: Record<string, FinanceCategory> = Object.fromEntries(FINANCE_CATEGORIES.map((c) => [c.key, c]));
export const CATEGORY_KEYS = FINANCE_CATEGORIES.map((c) => c.key) as [string, ...string[]];
export const categoriesIn = (group: FinanceGroup) => FINANCE_CATEGORIES.filter((c) => c.group === group);
