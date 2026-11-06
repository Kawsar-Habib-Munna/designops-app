import AccountsApp from './AccountsApp';

// Admin view of the accounts: can approve what the accountant adds. The accountant and the team use /accountant.
export default function AccountsPage() {
  return <AccountsApp variant="admin" />;
}
