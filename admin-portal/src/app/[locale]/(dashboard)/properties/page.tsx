import { fetchPropertiesServerPage } from '@/lib/server-data';
import PropertiesClient from './PropertiesClient';

/** RSC properties list — initial data from server (US-F-001). */
export default async function PropertiesPage() {
  const result = await fetchPropertiesServerPage();
  const properties = result?.data ?? [];
  return <PropertiesClient properties={properties as Parameters<typeof PropertiesClient>[0]['properties']} />;
}
