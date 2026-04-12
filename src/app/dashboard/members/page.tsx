import { MembersPanel } from '@/app/dashboard/components/members-panel';

export default function MembersPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-[#f9efe4]">Gestion des membres</h1>
      <MembersPanel />
    </section>
  );
}
