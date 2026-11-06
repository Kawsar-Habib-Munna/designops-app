import AccountsApp from '../accounts/AccountsApp';

// The accountant's page: the accountant (and the admin) edit, every other team member can only view.
export default function AccountantPage() {
  return <AccountsApp variant="desk" />;
}
