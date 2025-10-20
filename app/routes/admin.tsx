import type { MetaFunction } from '@remix-run/node';
import { AdminPage } from '~/components/admin/AdminPage';

export const meta: MetaFunction = () => {
  return [{ title: 'Brainiac - Admin' }, { name: 'description', content: 'Brainiac Admin Panel' }];
};

export default function Admin() {
  return <AdminPage />;
}
